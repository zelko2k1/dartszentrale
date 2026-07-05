// PocketBaseProvider — Vereinsmodus (echtes Backend).
// Datenmodell bewusst DENORMALISIERT: teams.memberIds/captainId, leagues.teams/fixtures und
// matches.perPlayer liegen als JSON-Felder. Dadurch entspricht jedes App-Objekt 1:1 einem
// PocketBase-Record und der generische CRUD-Pfad funktioniert ohne Feld-Mapping.
// Einzige Sonderfälle: 'accounts' → PB-Auth-Collection 'users' (Passwort), sowie
// user_prefs (persönliche Einstellungen) und club_config (Vereinsname/Logo).
import PocketBase, { type RecordModel } from 'pocketbase';
import type { DataProvider, Snapshot, CollectionName, AuthUser, ProviderRecord, PublicConfig, LoginResult, TwoFactorStatus, TwoFactorSetup } from './provider';
import type { Settings, Role } from './types';
import { DEVICE_LOCAL_SETTING_KEYS } from './constants';

const PB_COLLECTION: Record<CollectionName, string> = {
  players: 'players',
  teams: 'teams',
  accounts: 'users',
  leagues: 'leagues',
  events: 'events',
  matches: 'matches',
  seasons: 'seasons',
  season_snapshots: 'season_snapshots',
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

  constructor(url: string) {
    this.pb = new PocketBase(url);
    // Auto-Cancellation aus: sonst brechen GLEICHZEITIGE Mutationen auf dieselbe Collection einander ab
    // (PB-SDK keyt den Cancel-Token auf Methode+Pfad) — z. B. mehrere parallele createRecord beim
    // Saison-Klonen oder Spielplan-Import. Lese-Requests entkoppeln zusätzlich über requestKey: null.
    this.pb.autoCancellation(false);
  }

  async loadAll(): Promise<Snapshot> {
    const opt = { requestKey: null as null };
    const [players, teams, accounts, leagues, events, matches, seasons, seasonSnapshots] = await Promise.all([
      this.pb.collection('players').getFullList(opt),
      this.pb.collection('teams').getFullList(opt),
      this.pb.collection('users').getFullList(opt),
      this.pb.collection('leagues').getFullList(opt),
      this.pb.collection('events').getFullList(opt),
      this.pb.collection('matches').getFullList(opt),
      // Saisons/Snapshots sind neu (provision.mjs) — fehlt die Collection noch, nicht den ganzen Ladevorgang kippen.
      this.pb.collection('seasons').getFullList(opt).catch(() => [] as ProviderRecord[]),
      this.pb.collection('season_snapshots').getFullList(opt).catch(() => [] as ProviderRecord[]),
    ]);

    // Vereinsweite Einstellungen (ein Datensatz) — Name, Logo UND die zentrale UI-/Counter-Konfiguration,
    // damit alle Nutzer/Board-Rechner identisch aussehen. Nur Admins dürfen schreiben (API-Rule).
    let clubName: string | undefined;
    let clubLogo: string | null = null;
    let impressum: string | undefined;
    let datenschutz: string | undefined;
    let settings: Partial<Settings> | null = null;
    try {
      const cfg = await this.pb.collection('club_config').getFirstListItem('', opt);
      this.clubCfgId = cfg.id;
      clubName = cfg.clubName as string | undefined;
      clubLogo = (cfg.clubLogo as string | null) || null;
      impressum = (cfg.impressum as string | undefined) ?? '';
      datenschutz = (cfg.datenschutz as string | undefined) ?? '';
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
      seasons: as<Snapshot['seasons']>(seasons),
      seasonSnapshots: as<Snapshot['seasonSnapshots']>(seasonSnapshots),
      settings,
      trainingPlays,
      clubName,
      clubLogo,
      impressum,
      datenschutz,
    };
  }

  // Öffentlich (ohne Anmeldung) lesbare Vereins-Infos für die Login-Seite: Name, Logo und die
  // Rechtstexte (Impressum/Datenschutz). Setzt die club_config-Leseregel auf öffentlich voraus
  // (provision.mjs) — sonst 403 → null, und die Login-Seite fällt auf den lokalen Cache zurück.
  async loadPublicConfig(): Promise<PublicConfig | null> {
    try {
      const cfg = await this.pb.collection('club_config').getFirstListItem('', { requestKey: null });
      const central = (cfg.settings as Partial<Settings> | null) || {};
      return {
        clubName: cfg.clubName as string | undefined,
        clubLogo: (cfg.clubLogo as string | null) || null,
        loginLogoSize: central.loginLogoSize,
        impressum: (cfg.impressum as string | undefined) ?? '',
        datenschutz: (cfg.datenschutz as string | undefined) ?? '',
      };
    } catch { return null; }
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
    const cfg = {
      clubName: settings.clubName, clubLogo: settings.clubLogo,
      impressum: settings.impressum ?? '', datenschutz: settings.datenschutz ?? '',
      settings: central as unknown,
    };
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

  // Login über den serverseitigen 2FA-Endpunkt (pb_hooks/2fa_hooks.pb.js /api/login) statt direktem
  // authWithPassword — sonst würde die App aktives 2FA umgehen. Bei aktivem 2FA ohne/mit falschem Code
  // kommt kein Token, sondern { mfa_required:true } (200) bzw. 400/429 mit mfa_required im Fehlerbody.
  async login(email: string, password: string, code?: string): Promise<LoginResult> {
    try {
      const res = await this.pb.send('/api/login', { method: 'POST', body: { email, password, code: code ?? '' } }) as
        { token?: string; record?: ProviderRecord; mfa_required?: boolean; error?: string };
      if (res?.token && res?.record) {
        this.pb.authStore.save(res.token, res.record as unknown as RecordModel);
        return { ok: true, user: toAuthUser(res.record)! };
      }
      if (res?.mfa_required) return { ok: false, mfaRequired: true, error: res.error };
      throw new Error('Unerwartete Login-Antwort.');
    } catch (err: unknown) {
      const resp = (err as { response?: { mfa_required?: boolean; error?: string; message?: string } })?.response;
      if (resp?.mfa_required) return { ok: false, mfaRequired: true, error: resp.error || resp.message };
      throw err; // echte Auth-Fehler (falsches Passwort, deaktiviert) an den Store weiterreichen
    }
  }

  async twoFactorStatus(): Promise<TwoFactorStatus> {
    const r = await this.pb.send('/api/2fa/status', { method: 'GET' }) as { enabled?: boolean; pending?: boolean };
    return { enabled: !!r?.enabled, pending: !!r?.pending };
  }
  async twoFactorSetup(): Promise<TwoFactorSetup> {
    const r = await this.pb.send('/api/2fa/setup', { method: 'POST', body: {} }) as { secret: string; otpauth_uri: string; account: string };
    return { secret: r.secret, otpauthUri: r.otpauth_uri, account: r.account };
  }
  async twoFactorEnable(code: string): Promise<{ backupCodes: string[] }> {
    const r = await this.pb.send('/api/2fa/enable', { method: 'POST', body: { code } }) as { backupCodes: string[] };
    return { backupCodes: r.backupCodes };
  }
  async twoFactorDisable(auth: { code?: string; password?: string }): Promise<void> {
    await this.pb.send('/api/2fa/disable', { method: 'POST', body: { code: auth.code ?? '', password: auth.password ?? '' } });
  }
  async twoFactorRegenerateBackup(auth: { code?: string; password?: string }): Promise<{ backupCodes: string[] }> {
    const r = await this.pb.send('/api/2fa/backup/regenerate', { method: 'POST', body: { code: auth.code ?? '', password: auth.password ?? '' } }) as { backupCodes: string[] };
    return { backupCodes: r.backupCodes };
  }
  async twoFactorAdminList(): Promise<string[]> {
    const r = await this.pb.send('/api/2fa/admin/list', { method: 'GET' }) as { enabled?: string[] };
    return Array.isArray(r?.enabled) ? r.enabled : [];
  }
  async twoFactorAdminReset(userId: string): Promise<{ wasEnabled: boolean }> {
    const r = await this.pb.send('/api/2fa/admin/reset', { method: 'POST', body: { userId } }) as { wasEnabled?: boolean };
    return { wasEnabled: !!r?.wasEnabled };
  }
  async kioskExitAuth(email: string, password: string, allowedRoles: Role[]): Promise<AuthUser | null> {
    // Board-Sitzung merken, damit sie bei Ablehnung unverändert weiterläuft.
    const prevToken = this.pb.authStore.token;
    const prevRecord = this.pb.authStore.record;
    const restore = () => { if (prevToken) this.pb.authStore.save(prevToken, prevRecord); };
    try {
      const auth = await this.pb.collection('users').authWithPassword(email, password);
      const user = toAuthUser(auth.record as unknown as ProviderRecord);
      if (user && user.active && allowedRoles.includes(user.role)) return user; // Session bleibt der neue Nutzer.
      restore(); // Falsche Rolle / inaktiv → zurück zur Board-Sitzung.
      return null;
    } catch {
      // Fehlgeschlagener authWithPassword lässt den authStore unberührt; zur Sicherheit dennoch wiederherstellen.
      restore();
      return null;
    }
  }
  async logout(): Promise<void> { this.pb.authStore.clear(); this.prefsId = null; }
  currentUser(): AuthUser | null { return toAuthUser(this.pb.authStore.record as unknown as ProviderRecord | null); }
  // Privilegierter Endpunkt (pb_hooks/set_password.pb.js): umgeht die oldPassword/Superuser-Pflicht der Records-API.
  async setPassword(userId: string, newPassword: string): Promise<void> {
    await this.pb.send('/api/set-password', { method: 'POST', body: { userId, password: newPassword } });
  }

  subscribe(onChange: () => void): () => void {
    const colls = ['players', 'teams', 'users', 'leagues', 'events', 'matches', 'seasons', 'season_snapshots', 'club_config'];
    const unsubs = colls.map((c) => this.pb.collection(c).subscribe('*', () => onChange()).catch(() => () => {}));
    return () => { unsubs.forEach((p) => { void p.then((fn) => fn()).catch(() => {}); }); };
  }
}
