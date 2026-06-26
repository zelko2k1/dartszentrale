// LocalProvider — bildet das aktuelle localStorage-Verhalten hinter der DataProvider-Schnittstelle ab.
import type { DataProvider, Snapshot, CollectionName, AuthUser, ProviderRecord } from './provider';
import type { Settings } from './types';
import { STORAGE_KEYS } from './storageKeys';

const COLL_KEY: Record<CollectionName, string> = {
  players: STORAGE_KEYS.players,
  teams: STORAGE_KEYS.teams,
  accounts: STORAGE_KEYS.users,
  leagues: STORAGE_KEYS.leagues,
  events: STORAGE_KEYS.events,
  matches: STORAGE_KEYS.matches,
  seasons: STORAGE_KEYS.seasons,
  season_snapshots: STORAGE_KEYS.seasonSnapshots,
};

function read<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw == null ? fallback : (JSON.parse(raw) as T); } catch { return fallback; }
}
function write(key: string, val: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ }
}

export class LocalProvider implements DataProvider {
  readonly mode = 'local' as const;
  readonly authRequired = false;

  async loadAll(): Promise<Snapshot> {
    const settings = read<Partial<Settings> | null>(STORAGE_KEYS.settings, null);
    return {
      players: read(STORAGE_KEYS.players, []),
      teams: read(STORAGE_KEYS.teams, []),
      accounts: read(STORAGE_KEYS.users, []),
      leagues: read(STORAGE_KEYS.leagues, []),
      events: read(STORAGE_KEYS.events, []),
      matches: read(STORAGE_KEYS.matches, []),
      seasons: read(STORAGE_KEYS.seasons, []),
      seasonSnapshots: read(STORAGE_KEYS.seasonSnapshots, []),
      settings,
      trainingPlays: read(STORAGE_KEYS.trainplays, {}),
      clubName: settings?.clubName,
      clubLogo: settings?.clubLogo ?? null,
    };
  }

  async createRecord(coll: CollectionName, record: ProviderRecord): Promise<ProviderRecord> {
    const key = COLL_KEY[coll];
    const arr = read<ProviderRecord[]>(key, []);
    arr.push(record);
    write(key, arr);
    return record;
  }

  async updateRecord(coll: CollectionName, id: string, patch: ProviderRecord): Promise<ProviderRecord> {
    const key = COLL_KEY[coll];
    const arr = read<ProviderRecord[]>(key, []);
    let updated: ProviderRecord = patch;
    const next = arr.map((r) => (r.id === id ? (updated = { ...r, ...patch }) : r));
    write(key, next);
    return updated;
  }

  async deleteRecord(coll: CollectionName, id: string): Promise<void> {
    const key = COLL_KEY[coll];
    const arr = read<ProviderRecord[]>(key, []);
    write(key, arr.filter((r) => r.id !== id));
  }

  // Profilfotos gibt es nur im Vereinsmodus (PocketBase-File-Feld).
  async uploadPhoto(): Promise<void> { throw new Error('Profilfotos gibt es nur im Vereinsmodus.'); }
  async clearPhoto(): Promise<void> { /* lokal nichts zu tun */ }

  async saveSettings(settings: Settings): Promise<void> { write(STORAGE_KEYS.settings, settings); }
  async saveTrainingPlays(plays: Record<string, number>): Promise<void> { write(STORAGE_KEYS.trainplays, plays); }

  // Lokal: keine echte Anmeldung — voller Zugriff.
  async login(): Promise<AuthUser> { return { id: 'local', name: 'Lokal', role: 'admin', active: true }; }
  async logout(): Promise<void> { /* noop */ }
  currentUser(): AuthUser | null { return null; }
  async setPassword(): Promise<void> { /* lokaler Modus hat keine Anmeldung/Passwörter */ }
  subscribe(): () => void { return () => {}; }
}
