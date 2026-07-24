// Datenschicht-Abstraktion (Phase-1-Vorbereitung).
// Zwei Implementierungen: LocalProvider (localStorage, synchron) und PocketBaseProvider (API, async).
// Noch NICHT in den Store eingebunden — rein additiv, ändert das bestehende Verhalten nicht.
import type { Player, Team, Account, League, EventItem, Match, Season, SeasonSnapshot, Tournament, Settings, Role } from './types';
import type { NuligaResponse } from '../lib/nuligaImport';

export type CollectionName = 'players' | 'teams' | 'accounts' | 'leagues' | 'events' | 'matches' | 'seasons' | 'season_snapshots' | 'tournaments';

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
  tournaments: Tournament[];
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

export interface AuthUser { id: string; name: string; role: Role; active: boolean; isBoard: boolean; }

/** Ergebnis eines Login-Versuchs: erfolgreich, oder 2FA-Code erforderlich (kein Token vergeben). */
export type LoginResult =
  | { ok: true; user: AuthUser }
  | { ok: false; mfaRequired: true; error?: string };

/** Status der 2-Faktor-Authentifizierung des eingeloggten Nutzers. */
export interface TwoFactorStatus { enabled: boolean; pending: boolean; }
/** Rückgabe von /api/2fa/setup: Base32-Secret + fertige otpauth://-URI für den QR-Code. */
export interface TwoFactorSetup { secret: string; otpauthUri: string; account: string; }

// ── Remote & Live (Handy als Eingabe + Live-Mitverfolgen) — Plan docs/plan-remote.md ──
/** Kompakter, gerenderter Spielstand — Quelle für Remote-Handy UND Zuschauer (ohne eigene Spiellogik). */
export interface LiveViewState {
  phase: 'idle' | 'whoBegins' | 'playing' | 'bust' | 'won';
  format?: { startScore: number; unit: string; bestOf: number; bestOfSets?: number; doubleOut: boolean };
  // avg3/c180/hf: Live-Statistik je Spieler für die Zuschauer-/TV-Ansicht (3-Dart-Schnitt, 180er, High Finish).
  players: { name: string; short?: string; score: number; legs: number; sets: number; avg3?: number; c180?: number; hf?: number }[];
  currentIdx: number;
  input: string;                                  // aktueller Tipp-Puffer (Live-Feedback aufs Handy)
  checkout: string[];                             // Checkout-Vorschlag des aktuellen Spielers
  lastThrow?: { player: number; value: number } | null;
  winner?: string | null;                         // bei phase="won"
  finish?: { minDarts: number } | null;           // Finish-Dart-Abfrage offen → Handy zeigt 1/2/3
  // Persistentes Highlight des zuletzt abgeschlossenen Legs (Shortleg/High Finish) für die TV-Ansicht.
  // Bleibt stehen, bis das nächste Leg ausgemacht wird. Match-Ende zeigt die TV-Ansicht über phase="won".
  highlight?: { player: string; darts: number; score: number; highFinish: boolean; shortLeg: boolean } | null;
}
/** Eine Live-Session (ein Board). remoteUser = aktuell gekoppeltes Handy, pendingRemote = Übernahme-Anfrage. */
export interface LiveSession {
  id: string;
  host: string;
  boardName: string;
  code: string;
  remoteUser: string;
  pendingRemote: string;
  status: 'idle' | 'active' | 'ended';
  state: LiveViewState | null;
  lastAppliedSeq: number;
}
/** Ein Befehl aus dem Postfach (vom Remote erzeugt, vom Host abgespielt). */
export interface LiveCommand {
  id: string;
  session: string;
  seq: number;
  type: string;
  payload: unknown;
  createdBy: string;
}

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
  // Einen frischen Datensatz vom Server lesen (für Read-Modify-Write bei nebenläufigen Schreibern,
  // z. B. mehrere Board-PCs, die dasselbe Turnier aktualisieren). Lokal: aus dem localStorage-Array.
  getRecord(coll: CollectionName, id: string): Promise<ProviderRecord | null>;

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

  // ── 2FA-Verwaltung durch Admins (fremde Konten); Lokal: leer/no-op ──
  /** Nur Admin: IDs aller Konten mit aktivem 2FA (für die Spalte in der Benutzerliste). */
  twoFactorAdminList(): Promise<string[]>;
  /** Nur Admin: setzt 2FA eines Kontos zurück (löscht den Datensatz). Der Nutzer muss danach neu einrichten. */
  twoFactorAdminReset(userId: string): Promise<{ wasEnabled: boolean }>;
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

  // ── nuLiga-Import (Verein, nur Admin); Lokal: nicht verfügbar ──
  /** Ruft die nuLiga-Gruppenseite server-seitig ab (/api/nuliga/fetch) und liefert die geparsten
   *  Begegnungen. Merge/Vorrang/Konflikte macht der Aufrufer (lib/nuligaImport.ts). */
  fetchNuliga(url: string): Promise<NuligaResponse>;

  // ── Realtime (Verein optional); Lokal: gibt eine leere Unsubscribe-Funktion zurück ──
  subscribe(onChange: () => void): () => void;

  // ── Remote & Live (Verein optional); Lokal: nicht verfügbar ──
  /** Ob dieser Provider Remote/Live unterstützt (nur Vereins-/Server-Modus). */
  readonly liveSupported: boolean;
  /** Host: Session anlegen und ersten View-State veröffentlichen. Liefert die Session-ID. */
  livePublish(input: { boardName: string; code: string; state: LiveViewState }): Promise<string>;
  /** Host: aktuellen View-State schreiben (Aufrufer debounced); heartbeat=true erneuert das Lebenszeichen. */
  liveUpdateState(sessionId: string, state: LiveViewState, heartbeat?: boolean): Promise<void>;
  /** Host: Befehl bestätigen — lastAppliedSeq + neuen View-State schreiben. */
  liveAck(sessionId: string, lastAppliedSeq: number, state: LiveViewState): Promise<void>;
  /** Host: Session beenden (status=ended). */
  liveEnd(sessionId: string): Promise<void>;
  /** Host: Realtime-Abo auf eingehende Befehle der eigenen Session. */
  liveConsume(sessionId: string, onCmd: (cmd: LiveCommand) => void): () => void;
  /** Host: verarbeiteten Befehl löschen. */
  liveDeleteCommand(commandId: string): Promise<void>;
  /** Remote/Zuschauer: eine Session live beobachten (null = gelöscht). */
  liveWatch(sessionId: string, onChange: (s: LiveSession | null) => void): () => void;
  /** Zuschauer: aktive Sessions auflisten (für die Auswahl). */
  liveListActive(): Promise<LiveSession[]>;
  /** Zuschauer: Änderungen an der Session-Liste abonnieren. */
  liveSubscribeList(onChange: () => void): () => void;
  /** Remote: koppeln (Code prüfen). claimed=sofort gekoppelt, pending=Übernahme angefragt. */
  liveClaim(sessionId: string, code: string): Promise<{ claimed: boolean; pending: boolean }>;
  /** Remote: koppeln NUR über den Code (manuelle Eingabe ohne QR) — findet die Session, liefert ihre ID. */
  liveClaimByCode(code: string): Promise<{ claimed: boolean; pending: boolean; sessionId: string }>;
  /** Remote: aktive Session-ID zu einem Code finden (read-only, ohne zu koppeln); '' = keine. Für die
   *  QR-Selbstheilung, wenn die im QR eingebettete ID nach einem Board-Neuladen veraltet ist. */
  liveFindByCode(code: string): Promise<string>;
  /** Remote (aktueller): Übernahme durch ein anderes Handy bestätigen. */
  liveClaimApprove(sessionId: string): Promise<void>;
  /** Remote (aktueller): Übernahme ablehnen. */
  liveClaimDeny(sessionId: string): Promise<void>;
  /** Remote: eigenen Schreiber-/Anfrage-Platz freigeben. */
  liveRelease(sessionId: string): Promise<void>;
  /** Remote: Befehl senden (monoton steigende seq). */
  liveSend(sessionId: string, seq: number, type: string, payload: unknown): Promise<void>;

  // ── Öffentlicher Zuschauer-TV (login-frei, verein-/abendweit); Lokal: nicht verfügbar ──
  /** Admin: Kanal-Konfig lesen (Kill-Switch + geheimer Token; legt Default an, falls fehlt). */
  watchGetConfig(): Promise<{ enabled: boolean; token: string }>;
  /** Admin: öffentliches Zuschauen ein-/ausschalten (echter Kill-Switch). */
  watchSetEnabled(enabled: boolean): Promise<{ enabled: boolean; token: string }>;
  /** Admin: neuen Token erzeugen — alte Links werden sofort ungültig. */
  watchRotate(): Promise<{ enabled: boolean; token: string }>;
  /** Öffentlich (ohne Login): aktive Boards zu einem Watch-Token — nur Boardname + Spielstand. */
  watchPublic(token: string): Promise<{ boards: { boardName: string; state: LiveViewState | null }[] }>;
}
