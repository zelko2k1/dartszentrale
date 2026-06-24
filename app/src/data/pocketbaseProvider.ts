// PocketBaseProvider — Vereinsmodus (Skelett für Phase 1/2).
// Auth + generisches CRUD sind bereits real umgesetzt; loadAll/Mapping der normalisierten
// Liga-Daten und user_prefs sind als TODO markiert (werden festgezurrt, sobald PocketBase + Schema stehen).
import PocketBase from 'pocketbase';
import type { DataProvider, Snapshot, CollectionName, AuthUser, ProviderRecord } from './provider';
import type { Settings, Role } from './types';

const PB_COLLECTION: Record<CollectionName, string> = {
  players: 'players',
  teams: 'teams',
  accounts: 'users',
  leagues: 'leagues',
  events: 'events',
  matches: 'matches',
};

function toAuthUser(m: ProviderRecord | null): AuthUser | null {
  if (!m) return null;
  return { id: String(m.id), name: String(m.name ?? ''), role: ((m.role as Role) ?? 'viewer') };
}

export class PocketBaseProvider implements DataProvider {
  readonly mode = 'verein' as const;
  readonly authRequired = true;
  private pb: PocketBase;

  constructor(url: string) { this.pb = new PocketBase(url); }

  async loadAll(): Promise<Snapshot> {
    const [players, teams, accounts, events, matches] = await Promise.all([
      this.pb.collection('players').getFullList(),
      this.pb.collection('teams').getFullList(),
      this.pb.collection('users').getFullList(),
      this.pb.collection('events').getFullList(),
      this.pb.collection('matches').getFullList(),
    ]);
    let clubName: string | undefined;
    let clubLogo: string | null = null;
    try {
      const cfg = await this.pb.collection('club_config').getFirstListItem('');
      clubName = cfg.clubName as string | undefined;
      clubLogo = (cfg.clubLogo as string | null) ?? null;
    } catch { /* noch keine club_config */ }

    const as = <T>(v: unknown): T => v as T;
    return {
      players: as<Snapshot['players']>(players),
      teams: as<Snapshot['teams']>(teams),
      accounts: as<Snapshot['accounts']>(accounts),
      // TODO Phase 2: aus leagues + league_teams + fixtures zusammensetzen (normalisiert)
      leagues: [],
      events: as<Snapshot['events']>(events),
      matches: as<Snapshot['matches']>(matches),
      // TODO Phase 2: user_prefs des angemeldeten Nutzers laden
      settings: null,
      trainingPlays: {},
      clubName,
      clubLogo,
    };
  }

  async createRecord(coll: CollectionName, record: ProviderRecord): Promise<ProviderRecord> {
    return (await this.pb.collection(PB_COLLECTION[coll]).create(record)) as unknown as ProviderRecord;
  }
  async updateRecord(coll: CollectionName, id: string, patch: ProviderRecord): Promise<ProviderRecord> {
    return (await this.pb.collection(PB_COLLECTION[coll]).update(id, patch)) as unknown as ProviderRecord;
  }
  async deleteRecord(coll: CollectionName, id: string): Promise<void> {
    await this.pb.collection(PB_COLLECTION[coll]).delete(id);
  }

  async saveSettings(settings: Settings): Promise<void> { void settings; /* TODO Phase 2: user_prefs upsert */ }
  async saveTrainingPlays(plays: Record<string, number>): Promise<void> { void plays; /* TODO Phase 2 */ }

  async login(email: string, password: string): Promise<AuthUser> {
    const auth = await this.pb.collection('users').authWithPassword(email, password);
    return toAuthUser(auth.record as unknown as ProviderRecord)!;
  }
  async logout(): Promise<void> { this.pb.authStore.clear(); }
  currentUser(): AuthUser | null { return toAuthUser(this.pb.authStore.record as unknown as ProviderRecord | null); }

  subscribe(onChange: () => void): () => void {
    const colls = ['players', 'teams', 'users', 'leagues', 'league_teams', 'fixtures', 'events', 'matches'];
    const unsubs: Array<Promise<() => void>> = colls.map((c) => this.pb.collection(c).subscribe('*', () => onChange()));
    return () => { unsubs.forEach((p) => { void p.then((fn) => fn()).catch(() => {}); }); };
  }
}
