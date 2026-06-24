// Datenschicht-Abstraktion (Phase-1-Vorbereitung).
// Zwei Implementierungen: LocalProvider (localStorage, synchron) und PocketBaseProvider (API, async).
// Noch NICHT in den Store eingebunden — rein additiv, ändert das bestehende Verhalten nicht.
import type { Player, Team, Account, League, EventItem, Match, Settings, Role } from './types';

export type CollectionName = 'players' | 'teams' | 'accounts' | 'leagues' | 'events' | 'matches';

/** Vollständiger Datenbestand, wie ihn der Store beim Start lädt. */
export interface Snapshot {
  players: Player[];
  teams: Team[];
  accounts: Account[];
  leagues: League[];
  events: EventItem[];
  matches: Match[];
  settings: Partial<Settings> | null;
  trainingPlays: Record<string, number>;
  clubName?: string;
  clubLogo?: string | null;
}

export interface AuthUser { id: string; name: string; role: Role; active: boolean; }

export type ProviderRecord = Record<string, unknown>;

export interface DataProvider {
  readonly mode: 'local' | 'verein';
  /** Verein: Login erforderlich; Lokal: false. */
  readonly authRequired: boolean;

  /** Initialer Vollabruf aller Collections. */
  loadAll(): Promise<Snapshot>;

  // ── pro Datensatz (Mutationen) ──
  createRecord(coll: CollectionName, record: ProviderRecord): Promise<ProviderRecord>;
  updateRecord(coll: CollectionName, id: string, patch: ProviderRecord): Promise<ProviderRecord>;
  deleteRecord(coll: CollectionName, id: string): Promise<void>;

  // ── Einstellungen / persönliche Werte ──
  saveSettings(settings: Settings): Promise<void>;
  saveTrainingPlays(plays: Record<string, number>): Promise<void>;

  // ── Auth (Verein); Lokal: kein-op ──
  login(email: string, password: string): Promise<AuthUser>;
  logout(): Promise<void>;
  currentUser(): AuthUser | null;

  // ── Realtime (Verein optional); Lokal: gibt eine leere Unsubscribe-Funktion zurück ──
  subscribe(onChange: () => void): () => void;
}
