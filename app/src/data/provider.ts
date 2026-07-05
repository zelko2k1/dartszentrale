// Datenschicht-Abstraktion (Phase-1-Vorbereitung).
// Zwei Implementierungen: LocalProvider (localStorage, synchron) und PocketBaseProvider (API, async).
// Noch NICHT in den Store eingebunden — rein additiv, ändert das bestehende Verhalten nicht.
import type { Player, Team, Account, League, EventItem, Match, Season, SeasonSnapshot, Settings, Role } from './types';

export type CollectionName = 'players' | 'teams' | 'accounts' | 'leagues' | 'events' | 'matches' | 'seasons' | 'season_snapshots';

/** Vollständiger Datenbestand, wie ihn der Store beim Start lädt. */
export interface Snapshot {
  players: Player[];
  teams: Team[];
  accounts: Account[];
  leagues: League[];
  events: EventItem[];
  matches: Match[];
  seasons: Season[];
  seasonSnapshots: SeasonSnapshot[];
  settings: Partial<Settings> | null;
  trainingPlays: Record<string, number>;
  clubName?: string;
  clubLogo?: string | null;
  impressum?: string;
  datenschutz?: string;
}

/** Öffentlich (ohne Anmeldung) lesbare Vereins-Infos — für die Login-Seite im Internet-Betrieb. */
export interface PublicConfig {
  clubName?: string;
  clubLogo?: string | null;
  loginLogoSize?: number;
  impressum?: string;
  datenschutz?: string;
}

export interface AuthUser { id: string; name: string; role: Role; active: boolean; }

/** Ergebnis eines Login-Versuchs: erfolgreich, oder 2FA-Code erforderlich (kein Token vergeben). */
export type LoginResult =
  | { ok: true; user: AuthUser }
  | { ok: false; mfaRequired: true; error?: string };

/** Status der 2-Faktor-Authentifizierung des eingeloggten Nutzers. */
export interface TwoFactorStatus { enabled: boolean; pending: boolean; }
/** Rückgabe von /api/2fa/setup: Base32-Secret + fertige otpauth://-URI für den QR-Code. */
export interface TwoFactorSetup { secret: string; otpauthUri: string; account: string; }

export type ProviderRecord = Record<string, unknown>;

export interface DataProvider {
  readonly mode: 'local' | 'verein';
  /** Verein: Login erforderlich; Lokal: false. */
  readonly authRequired: boolean;

  /** Initialer Vollabruf aller Collections. */
  loadAll(): Promise<Snapshot>;

  /** Öffentliche Vereins-Infos ohne Anmeldung (Name, Logo, Impressum, Datenschutz) für die Login-Seite.
   *  Lokal / bei fehlender Freigabe: null. */
  loadPublicConfig(): Promise<PublicConfig | null>;

  // ── pro Datensatz (Mutationen) ──
  createRecord(coll: CollectionName, record: ProviderRecord): Promise<ProviderRecord>;
  updateRecord(coll: CollectionName, id: string, patch: ProviderRecord): Promise<ProviderRecord>;
  deleteRecord(coll: CollectionName, id: string): Promise<void>;

  // ── Profilfoto (nur 'players' | 'accounts'); PocketBase-File-Feld. Lokal: nicht unterstützt. ──
  uploadPhoto(coll: CollectionName, id: string, file: Blob): Promise<void>;
  clearPhoto(coll: CollectionName, id: string): Promise<void>;

  // ── Einstellungen / persönliche Werte ──
  saveSettings(settings: Settings): Promise<void>;
  saveTrainingPlays(plays: Record<string, number>): Promise<void>;

  // ── Auth (Verein); Lokal: kein-op ──
  /** Login über /api/login (serverseitiges 2FA). `code` = TOTP- oder Backup-Code (2. Schritt).
   *  Liefert `{ok:false, mfaRequired:true}`, wenn 2FA aktiv ist und (noch) kein/ein falscher Code kam. */
  login(email: string, password: string, code?: string): Promise<LoginResult>;
  logout(): Promise<void>;
  currentUser(): AuthUser | null;

  // ── 2-Faktor-Authentifizierung (Verein); Lokal: nicht verfügbar ──
  twoFactorStatus(): Promise<TwoFactorStatus>;
  /** Startet die Einrichtung: neues Secret + otpauth-URI (QR). Noch nicht aktiv. */
  twoFactorSetup(): Promise<TwoFactorSetup>;
  /** Bestätigt die Einrichtung mit einem TOTP-Code → aktiv; liefert die Backup-Codes (nur EINMALIG). */
  twoFactorEnable(code: string): Promise<{ backupCodes: string[] }>;
  /** Deaktiviert 2FA nach Re-Auth (TOTP-/Backup-Code ODER Passwort). */
  twoFactorDisable(auth: { code?: string; password?: string }): Promise<void>;
  /** Erzeugt neue Backup-Codes nach Re-Auth; entwertet die alten. Liefert die neuen (nur EINMALIG). */
  twoFactorRegenerateBackup(auth: { code?: string; password?: string }): Promise<{ backupCodes: string[] }>;
  /**
   * Login-Versuch für den Kiosk-Ausstieg: meldet den Nutzer an, gibt ihn aber nur zurück, wenn seine
   * Rolle in `allowedRoles` liegt und das Konto aktiv ist. Andernfalls (falsche Rolle/inaktiv oder
   * falsches Passwort) wird die zuvor bestehende (Board-)Sitzung wiederhergestellt und `null` geliefert.
   * Bewusst NICHT über die vorab geladene Kontoliste geprüft: ein Board-Konto sieht fremde E-Mails nur
   * bei `emailVisibility=true` — der authentifizierte Record selbst trägt Rolle/Status aber immer.
   */
  kioskExitAuth(email: string, password: string, allowedRoles: Role[]): Promise<AuthUser | null>;
  // Passwort setzen (privilegierter Endpunkt /api/set-password): Admin → jedes Konto, Nutzer → sein eigenes.
  setPassword(userId: string, newPassword: string): Promise<void>;

  // ── Realtime (Verein optional); Lokal: gibt eine leere Unsubscribe-Funktion zurück ──
  subscribe(onChange: () => void): () => void;
}
