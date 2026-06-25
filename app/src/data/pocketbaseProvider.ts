// PocketBaseProvider — Vereinsmodus (echtes Backend).
// Datenmodell bewusst DENORMALISIERT: teams.memberIds/captainId, leagues.teams/fixtures und
// matches.perPlayer liegen als JSON-Felder. Dadurch entspricht jedes App-Objekt 1:1 einem
// PocketBase-Record und der generische CRUD-Pfad funktioniert ohne Feld-Mapping.
// Einzige Sonderfälle: 'accounts' → PB-Auth-Collection 'users' (Passwort), sowie
// user_prefs (persönliche Einstellungen) und club_config (Vereinsname/Logo).
import PocketBase from 'pocketbase';
import type { DataProvider, Snapshot, CollectionName, AuthUser, ProviderRecord } from './provider';
import type { Settings, Role } from './types';
import { DEVICE_LOCAL_SETTING_KEYS } from './constants';

const PB_COLLECTION: Record<CollectionName, string> = {
  players: 'players',
  teams: 'teams',
  accounts: 'users',
  leagues: 'leagues',
  events: 'events',
  matches: 'matches',
};

// PocketBase liefert pro Record Systemfelder mit, die wir aus den App-Objekten heraushalten.
const SYSTEM_FIELDS = new Set(['collectionId', 'collectionName', 'created', 'updated', 'expand', 'emailVisibility', 'verified', 'password', 'passwordConfirm', 'tokenKey']);
function clean<T extends ProviderRecord>(rec: ProviderRecord): T {
  const out: ProviderRecord = {};
  for (const k of Object.keys(rec)) if (!SYSTEM_FIELDS.has(k)) out[k] = rec[k];
  return out as T;
}

function toAuthUser(m: ProviderRecord | null): AuthUser | null {
  if (!m) return null;
  return { id: String(m.id), name: String(m.name ?? ''), role: ((m.role as Role) ?? 'viewer'), active: m.active !== false };
}

export class PocketBaseProvider implements DataProvider {
  readonly mode = 'verein' as const;
  readonly authRequired = true;
  private pb: PocketBase;
  private prefsId: string | null = null;     // gecachte user_prefs-Record-ID (für Upsert)
  private clubCfgId: string | null = null;   // gecachte club_config-Record-ID (für Upsert)

  constructor(url: string) { this.pb = new PocketBase(url); }

  async loadAll(): Promise<Snapshot> {
    const opt = { requestKey: null as null };
    const [players, teams, accounts, leagues, events, matches] = await Promise.all([
      this.pb.collection('players').getFullList(opt),
      this.pb.collection('teams').getFullList(opt),
      this.pb.collection('users').getFullList(opt),
      this.pb.collection('leagues').getFullList(opt),
      this.pb.collection('events').getFullList(opt),
      this.pb.collection('matches').getFullList(opt),
    ]);

    // Vereinsweite Einstellungen (ein Datensatz) — Name, Logo UND die zentrale UI-/Counter-Konfiguration,
    // damit alle Nutzer/Board-Rechner identisch aussehen. Nur Admins dürfen schreiben (API-Rule).
    let clubName: string | undefined;
    let clubLogo: string | null = null;
    let settings: Partial<Settings> | null = null;
    try {
      const cfg = await this.pb.collection('club_config').getFirstListItem('', opt);
      this.clubCfgId = cfg.id;
      clubName = cfg.clubName as string | undefined;
      clubLogo = (cfg.clubLogo as string | null) || null;
      settings = (cfg.settings as Partial<Settings> | null) || null;
    } catch { /* noch keine club_config */ }

    // Aus user_prefs kommt nur noch der persönliche Trainings-Fortschritt (gerät-/nutzerübergreifend).
    let trainingPlays: Record<string, number> = {};
    const me = this.pb.authStore.record;
    if (me) {
      try {
        const prefs = await this.pb.collection('user_prefs').getFirstListItem(`user="${me.id}"`, opt);
        this.prefsId = prefs.id;
        trainingPlays = (prefs.trainingPlays as Record<string, number> | null) || {};
      } catch { /* noch keine prefs für diesen Nutzer */ }
    }

    const as = <T>(v: unknown): T => (v as ProviderRecord[]).map((r) => clean(r)) as T;
    // Profilfoto: PB liefert nur den Dateinamen → zu einer fertigen (Thumbnail-)URL auflösen, sonst Feld entfernen.
    const withPhoto = <T>(v: unknown): T => (v as ProviderRecord[]).map((r) => {
      const c = clean(r) as ProviderRecord;
      if (r.photo) c.photo = this.pb.files.getURL(r, String(r.photo), { thumb: '160x160' });
      else delete c.photo;
      return c;
    }) as T;
    return {
      players: withPhoto<Snapshot['players']>(players),
      teams: as<Snapshot['teams']>(teams),
      accounts: withPhoto<Snapshot['accounts']>(accounts),
      leagues: as<Snapshot['leagues']>(leagues),
      events: as<Snapshot['events']>(events),
      matches: as<Snapshot['matches']>(matches),
      settings,
      trainingPlays,
      clubName,
      clubLogo,
    };
  }

  async createRecord(coll: CollectionName, record: ProviderRecord): Promise<ProviderRecord> {
    const body = { ...record };
    delete body.photo; // Foto ist ein File-Feld und wird ausschließlich über uploadPhoto/clearPhoto gesetzt.
    if (coll === 'accounts') {
      // Auth-Collection: PocketBase verlangt password + passwordConfirm bei der Anlage.
      const pw = (body.password as string) || '';
      body.passwordConfirm = pw;
      body.emailVisibility = true;
    }
    return clean(await this.pb.collection(PB_COLLECTION[coll]).create(body) as unknown as ProviderRecord);
  }

  async updateRecord(coll: CollectionName, id: string, patch: ProviderRecord): Promise<ProviderRecord> {
    const body = { ...patch };
    delete body.photo; // Foto-File-Feld nicht über den generischen Pfad überschreiben (sonst URL-String → Fehler).
    // Beim Bearbeiten kein leeres Passwort mitsenden (würde PB ablehnen).
    if (coll === 'accounts' && !body.password) { delete body.password; delete body.passwordConfirm; }
    else if (coll === 'accounts' && body.password) body.passwordConfirm = body.password;
    return clean(await this.pb.collection(PB_COLLECTION[coll]).update(id, body) as unknown as ProviderRecord);
  }

  async deleteRecord(coll: CollectionName, id: string): Promise<void> {
    await this.pb.collection(PB_COLLECTION[coll]).delete(id);
  }

  // Profilfoto hochladen (File-Feld). PocketBase erzeugt Thumbnails on-demand.
  async uploadPhoto(coll: CollectionName, id: string, file: Blob): Promise<void> {
    const f = file instanceof File ? file : new File([file], 'avatar.png', { type: file.type || 'image/png' });
    await this.pb.collection(PB_COLLECTION[coll]).update(id, { photo: f });
  }
  async clearPhoto(coll: CollectionName, id: string): Promise<void> {
    await this.pb.collection(PB_COLLECTION[coll]).update(id, { photo: null });
  }

  async saveSettings(settings: Settings): Promise<void> {
    const me = this.pb.authStore.record;
    // Einstellungen sind vereinsweit zentral → nur Admins pflegen sie. Andere Rollen erhalten sie
    // beim Laden read-only; ein Schreibversuch würde an der API-Rule scheitern, daher hier abbrechen.
    if (!me || me.role !== 'admin') return;
    // Gerätelokale Schlüssel nicht zentral speichern (Verbindung, Modus, Geräteart, Ansichtsfilter).
    const central: Partial<Settings> = { ...settings };
    for (const k of DEVICE_LOCAL_SETTING_KEYS) delete central[k];
    const cfg = { clubName: settings.clubName, clubLogo: settings.clubLogo, settings: central as unknown };
    try {
      if (this.clubCfgId) await this.pb.collection('club_config').update(this.clubCfgId, cfg);
      else { const rec = await this.pb.collection('club_config').create(cfg); this.clubCfgId = rec.id; }
    } catch { /* keine Rechte / Collection fehlt → still ignorieren */ }
  }

  async saveTrainingPlays(plays: Record<string, number>): Promise<void> {
    const me = this.pb.authStore.record;
    if (!me) return;
    const body = { user: me.id, trainingPlays: plays as unknown };
    if (this.prefsId) await this.pb.collection('user_prefs').update(this.prefsId, body);
    else { const rec = await this.pb.collection('user_prefs').create(body); this.prefsId = rec.id; }
  }

  async login(email: string, password: string): Promise<AuthUser> {
    const auth = await this.pb.collection('users').authWithPassword(email, password);
    return toAuthUser(auth.record as unknown as ProviderRecord)!;
  }
  async logout(): Promise<void> { this.pb.authStore.clear(); this.prefsId = null; }
  currentUser(): AuthUser | null { return toAuthUser(this.pb.authStore.record as unknown as ProviderRecord | null); }

  subscribe(onChange: () => void): () => void {
    const colls = ['players', 'teams', 'users', 'leagues', 'events', 'matches', 'club_config'];
    const unsubs = colls.map((c) => this.pb.collection(c).subscribe('*', () => onChange()).catch(() => () => {}));
    return () => { unsubs.forEach((p) => { void p.then((fn) => fn()).catch(() => {}); }); };
  }
}
