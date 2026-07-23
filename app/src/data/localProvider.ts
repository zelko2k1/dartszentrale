// LocalProvider — bildet das aktuelle localStorage-Verhalten hinter der DataProvider-Schnittstelle ab.
import type { DataProvider, Snapshot, CollectionName, AuthUser, ProviderRecord, LoginResult, TwoFactorStatus, TwoFactorSetup, LiveSession } from './provider';
import type { Settings } from './types';
import { STORAGE_KEYS } from './storageKeys';
import { dict } from '../i18n';

const COLL_KEY: Record<CollectionName, string> = {
  players: STORAGE_KEYS.players,
  teams: STORAGE_KEYS.teams,
  accounts: STORAGE_KEYS.users,
  leagues: STORAGE_KEYS.leagues,
  events: STORAGE_KEYS.events,
  matches: STORAGE_KEYS.matches,
  seasons: STORAGE_KEYS.seasons,
  season_snapshots: STORAGE_KEYS.seasonSnapshots,
  tournaments: STORAGE_KEYS.tournaments,
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
      tournaments: read(STORAGE_KEYS.tournaments, []),
      settings,
      trainingPlays: read(STORAGE_KEYS.trainplays, {}),
      clubName: settings?.clubName,
      clubLogo: settings?.clubLogo ?? null,
      impressum: settings?.impressum,
      datenschutz: settings?.datenschutz,
    };
  }

  // Lokal gibt es keinen öffentlichen Server — die Login-Seite erscheint hier ohnehin nicht.
  async loadPublicConfig(): Promise<null> { return null; }

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

  async getRecord(coll: CollectionName, id: string): Promise<ProviderRecord | null> {
    return read<ProviderRecord[]>(COLL_KEY[coll], []).find((r) => r.id === id) || null;
  }

  // Profilfotos gibt es nur im Vereinsmodus (PocketBase-File-Feld).
  async uploadPhoto(): Promise<void> { throw new Error('Profilfotos gibt es nur im Vereinsmodus.'); }
  async clearPhoto(): Promise<void> { /* lokal nichts zu tun */ }

  async saveSettings(settings: Settings): Promise<void> { write(STORAGE_KEYS.settings, settings); }
  async saveTrainingPlays(plays: Record<string, number>): Promise<void> { write(STORAGE_KEYS.trainplays, plays); }

  // Lokal: keine echte Anmeldung — voller Zugriff.
  async login(): Promise<LoginResult> { return { ok: true, user: { id: 'local', name: 'Lokal', role: 'admin', active: true, isBoard: false } }; }
  // 2FA gibt es nur im Vereinsmodus (serverseitig). Lokal: aus / nicht verfügbar.
  async twoFactorStatus(): Promise<TwoFactorStatus> { return { enabled: false, pending: false }; }
  async twoFactorSetup(): Promise<TwoFactorSetup> { throw new Error('2-Faktor-Authentifizierung gibt es nur im Vereinsmodus.'); }
  async twoFactorEnable(): Promise<{ backupCodes: string[] }> { throw new Error('2-Faktor-Authentifizierung gibt es nur im Vereinsmodus.'); }
  async twoFactorDisable(): Promise<void> { /* lokal nichts zu tun */ }
  async twoFactorRegenerateBackup(): Promise<{ backupCodes: string[] }> { throw new Error('2-Faktor-Authentifizierung gibt es nur im Vereinsmodus.'); }
  async twoFactorAdminList(): Promise<string[]> { return []; }
  async twoFactorAdminReset(): Promise<{ wasEnabled: boolean }> { return { wasEnabled: false }; }
  // Lokal gibt es keine echte Anmeldung — der Kiosk-Ausstieg wird im Store vor dem Provider abgehandelt.
  async kioskExitAuth(): Promise<AuthUser | null> { return { id: 'local', name: 'Lokal', role: 'admin', active: true, isBoard: false }; }
  async logout(): Promise<void> { /* noop */ }
  currentUser(): AuthUser | null { return null; }
  async setPassword(): Promise<void> { /* lokaler Modus hat keine Anmeldung/Passwörter */ }
  async fetchNuliga(): Promise<never> { throw new Error(dict().storeMsg.nuligaVereinOnly); }
  subscribe(): () => void { return () => {}; }

  // Remote & Live gibt es nur im Vereinsmodus (gemeinsamer Server als Kanal). Lokal: aus / no-op.
  readonly liveSupported = false;
  async livePublish(): Promise<string> { throw new Error('Remote/Live gibt es nur im Vereinsmodus.'); }
  async liveUpdateState(): Promise<void> { /* noop */ }
  async liveAck(): Promise<void> { /* noop */ }
  async liveEnd(): Promise<void> { /* noop */ }
  liveConsume(): () => void { return () => {}; }
  async liveDeleteCommand(): Promise<void> { /* noop */ }
  liveWatch(_id: string, onChange: (s: LiveSession | null) => void): () => void { onChange(null); return () => {}; }
  async liveListActive(): Promise<LiveSession[]> { return []; }
  liveSubscribeList(): () => void { return () => {}; }
  async liveClaim(): Promise<{ claimed: boolean; pending: boolean }> { throw new Error('Remote/Live gibt es nur im Vereinsmodus.'); }
  async liveClaimByCode(): Promise<{ claimed: boolean; pending: boolean; sessionId: string }> { throw new Error('Remote/Live gibt es nur im Vereinsmodus.'); }
  async liveFindByCode(): Promise<string> { return ''; }
  async liveClaimApprove(): Promise<void> { /* noop */ }
  async liveClaimDeny(): Promise<void> { /* noop */ }
  async liveRelease(): Promise<void> { /* noop */ }
  async liveSend(): Promise<void> { throw new Error('Remote/Live gibt es nur im Vereinsmodus.'); }
  async watchGetConfig(): Promise<{ enabled: boolean; token: string }> { throw new Error('Remote/Live gibt es nur im Vereinsmodus.'); }
  async watchSetEnabled(): Promise<{ enabled: boolean; token: string }> { throw new Error('Remote/Live gibt es nur im Vereinsmodus.'); }
  async watchRotate(): Promise<{ enabled: boolean; token: string }> { throw new Error('Remote/Live gibt es nur im Vereinsmodus.'); }
  async watchPublic(): Promise<{ boards: { boardName: string; state: null }[] }> { return { boards: [] }; }
}
