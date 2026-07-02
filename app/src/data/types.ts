// Datenmodell — siehe DATA_MODEL.md

// 'board' = Maschinen-Rolle der Board-Rechner (am stärksten eingeschränkt: nur spielen + lesen).
// Wird NIE von Hand vergeben (fehlt bewusst in ROLE_ORDER) und ist fest an isBoard gekoppelt.
export type Role = 'admin' | 'captain' | 'player' | 'viewer' | 'board';
export type AppMode = 'local' | 'verein';

// Saison — Klammer um Ligen, Mannschaften, Termine und Matches einer Spielzeit.
// status='active' = laufende Saison (genau eine); 'archived' = abgeschlossen, in der App nur lesbar.
export interface Season {
  id: string;
  name: string;             // z. B. "2025/26"
  status: 'active' | 'archived';
  startDate?: string;       // YYYY-MM-DD (optional)
  endDate?: string;         // YYYY-MM-DD (optional)
  // true = Detaildaten (Spiele) wurden ausgelagert (Phase 4) → in der App aus dem Snapshot angezeigt,
  // per Bundle wieder einlesbar. Tabellen/Kader bleiben in der DB.
  offloaded?: boolean;
}

// Eingefrorener Abschluss-Stand einer Saison (beim „Saison abschließen" erzeugt). Bleibt auch nach
// einem späteren Auslagern (Phase 4) in der DB, damit die App die History günstig anzeigen kann.
export interface SeasonSnapshotStandingRow {
  id: string; name: string; own: boolean;
  sp: number; s: number; u: number; n: number; lf: number; la: number; pts: number;
}
export interface SeasonSnapshotPlayerStat {
  playerId?: string; name: string;
  games: number; wins: number; losses: number; avg: number;
  c180: number; c140: number; c100: number; c60: number; high: number; shortLegs: number;
}
export interface SeasonSnapshot {
  id: string;
  seasonId: string;
  seasonName: string;
  standings: { leagueId: string; leagueName: string; kind: TeamKind; rows: SeasonSnapshotStandingRow[] }[];
  playerStats: SeasonSnapshotPlayerStat[];
  teamRosters: { teamId: string; name: string; kind: TeamKind; captainId: string | null; memberIds: string[] }[];
  meta: { generatedAt: string; matchCount: number; teamCount: number; leagueCount: number };
}

export interface Player {
  id: string;
  name: string;
  short: string;       // max 3
  avi: number;         // Avatar-Farbindex
  locked?: boolean;    // Seed-Spieler
  // Optionales Profilfoto (nur Vereinsmodus, PocketBase-File-Feld). Nach dem Laden eine fertige Bild-URL
  // (Thumbnail); fehlt → Anzeige fällt auf Farbe + Kürzel zurück. Siehe components/Avatar.tsx.
  photo?: string;
}

// Art der Mannschaft: 'league' = Liga-Mannschaft (Standard), 'cup' = Pokalmannschaft.
// Ein Spieler kann gleichzeitig in einer Liga- UND einer Pokalmannschaft stehen.
export type TeamKind = 'league' | 'cup' | 'friendly';

export interface Team {
  id: string;
  name: string;
  league?: string;     // Freitext
  memberIds: string[]; // → Player.id (unbegrenzt)
  captainId: string | null;
  viceCaptainIds?: string[]; // bis zu 2 Ersatzkapitäne (→ Player.id)
  kind?: TeamKind;     // fehlt = 'league' (Abwärtskompatibilität für Altdaten)
  seasonId?: string;   // → Season.id; fehlt = Altdaten (Backfill auf aktive Saison)
}

export interface Account {
  id: string;
  first: string;
  last: string;
  name: string;        // "first last"
  email: string;
  role: Role;
  playerId: string | null;
  position?: string;
  active: boolean;
  avi: number;
  last_login?: string;
  // Board-Rechner-Konto (Maschinen-Login): feste Nummer = Identität des Bretts, NIE mit einem Spieler verknüpft.
  isBoard?: boolean;
  boardNumber?: number;
  // Optionales Profilfoto (nur Vereinsmodus, PocketBase-File-Feld) — nach dem Laden eine fertige Bild-URL.
  photo?: string;
}

export interface LeagueTeam {
  id: string;
  name: string;
  own: boolean;
}

// Eine Position der frei konfigurierbaren Aufstellung. kind = Einzel/Doppel; playerIds: Einzel = 1 ID,
// Doppel = 2 IDs (→ Player.id). board = optionale Board-Bezeichnung (Bezug zum Kiosk-boardName).
export interface LineupPosition {
  id: string;
  kind: 'single' | 'double';
  playerIds: string[];
  board?: string;
  // Ergebnis dieses Spiels (Spielbericht): won = aus eigener Sicht gewonnen/verloren; Legs optional.
  result?: { won: 'own' | 'opp'; ownLegs?: number; oppLegs?: number };
}

// Aufstellung der EIGENEN Mannschaft für eine Begegnung: pro Spieltag frei zusammengestellt
// (beliebig viele Einzel/Doppel in beliebiger Reihenfolge). substitutes = geordnete Ersatzliste (E1, E2, …).
export interface FixtureLineup {
  positions: LineupPosition[];
  substitutes: string[];
}

export interface Fixture {
  id: string;
  homeId: string;
  awayId: string;
  date: string;        // YYYY-MM-DD
  time?: string;       // HH:MM ('' / fehlend = unbekannt)
  loc?: string;        // Spielort (Freitext)
  played: boolean;
  hs: number | '';     // Punkte (gewonnene Spiele) Heim → Mannschaftspunkte + Differenz
  as: number | '';     // Punkte Gast
  lineup?: FixtureLineup; // Aufstellung der eigenen Mannschaft (nur bei eigenen Begegnungen)
}

// Ein Block des Spielformats, z. B. 8 Einzel oder 4 Doppel. Die REIHENFOLGE der Segmente bildet
// den realen Ablauf ab (LL: 6 Einzel → 3 Doppel → 6 Einzel; BL: 8 Einzel → 4 Doppel).
export type LineupSegmentKind = 'singles' | 'doubles';
export interface LineupSegment { kind: LineupSegmentKind; count: number; }

export interface League {
  id: string;
  name: string;
  season: string;      // Freitext-Label (z. B. "2025/26"); für Anzeige/Altdaten
  seasonId?: string;   // → Season.id; maßgeblich für Saison-Filter
  teams: LeagueTeam[];
  fixtures: Fixture[];
  // Art des Wettbewerbs (fehlt = 'league'): trennt Liga- von Pokal-Begegnungen, damit eine
  // Pokalmannschaft beim Aufstellungs-Shortcut nur Pokal-Begegnungen findet. Siehe TeamKind.
  kind?: TeamKind;
  // Spielformat der Begegnungen (pro Liga konfigurierbar). Bevorzugt `format` (geordnete Blöcke);
  // singlesCount/doublesCount bleiben als einfache/ältere Variante erhalten (Fallback 4 Einzel + 2 Doppel).
  format?: LineupSegment[];
  singlesCount?: number;
  doublesCount?: number;
}

export interface EventItem {
  id: string;
  scope: 'local' | 'verein';
  title: string;
  date: string;        // YYYY-MM-DD
  time: string;
  type: string;        // EVENT_TYPES key
  loc: string;
  seasonId?: string;   // → Season.id; bei neuen Terminen = aktive Saison
  fixtureId?: string;  // → Fixture.id; gesetzt, wenn der Termin automatisch zu einer Begegnung gehört
}

export interface MatchPlayerStat {
  name: string;
  short: string;
  av: number;
  legsWon: number;
  setsWon: number;
  avg3: number;
  c180: number;
  c60: number;
  c100: number;
  c140: number;
  highFinish: number;
  darts: number;
  shortLegs?: number; // gewonnene Legs ≤19 Darts (Liga-Highlight); optional für Abwärtskompatibilität alter Matches
  playerId?: string;  // → Player.id; robuste, saisonübergreifende Statistik (Name allein ist mehrdeutig)
}

export interface Match {
  id: string;
  date: string;
  startScore: number;
  doubleOut?: boolean;
  doubleIn?: boolean;
  unit: 'legs' | 'sets';
  mode: 'single' | 'teams';
  bestOf: number;
  bestOfSets: number;
  gameLabel: string;
  winnerName: string;
  scoreLine: string;
  perPlayer: MatchPlayerStat[];
  // Optionale Verknüpfung zu einer Liga-Aufstellungsposition (Board-Spiel → Spielbericht).
  // Slot 0 (perPlayer[0]) ist dabei stets die eigene Seite.
  leagueId?: string;
  fixtureId?: string;
  positionId?: string;
  seasonId?: string;   // → Season.id; bei neuen Matches = aktive Saison
  createdBy?: string;  // → users.id des Erstellers (Vereinsmodus; serverseitige Owner-Bindung)
}

export interface Settings {
  device: 'tablet' | 'desktop';
  startScore: number;
  bestOf: number;
  bestOfSets: number;
  unit: 'legs' | 'sets';
  doubleOut: boolean;
  outMode: 'single' | 'double' | 'master';
  doubleIn: boolean;
  accent: string;
  mode: 'dark' | 'light';
  theme: 'midnight' | 'charcoal' | 'slate';
  font: 'Inter' | 'Archivo' | 'Rubik' | 'Oswald' | 'Space Grotesk';
  scoreScale: number;
  scoreArea: number;
  statsSize: number;
  headerSize: number;
  deckSize: number;
  legSize: number;
  boardScale: number;   // Board-Gesamtskalierung (%) – nur Desktop/Board, Default 100
  // Counter-Darstellung (gerätelokal): 'big' = große Restscore-Zahl (Standard), 'sheet' = voller
  // Aufschrieb im n01-Stil (beide Spieler, Dart-Zähler, Ton-Markierung) unter einer kompakten Score-Leiste.
  counterView?: 'big' | 'sheet';
  // live (effective) colours for the current mode …
  legColor: string | null;
  scoreColor: string | null;
  // … plus the per-mode stored values (dark/light)
  accentDark: string;
  accentLight: string;
  scoreColorDark: string | null;
  scoreColorLight: string | null;
  legColorDark: string | null;
  legColorLight: string | null;
  showCheckout: boolean;
  showQuick: boolean;
  showHistory: boolean;
  showStats: boolean;
  fkeys: number[];
  newGameKey: string;
  quickBo5Key: string;
  quickBo3Key: string;
  appMode: AppMode;
  appModeManual?: boolean;
  appModeDetected?: AppMode;
  // PocketBase-Serveradresse für den Vereinsmodus — GERÄTE-LOKAL (eigener localStorage-Key,
  // nicht serverseitig gespeichert), damit jeder Rechner/Verein auf seine eigene Instanz zeigen kann.
  pbUrl?: string;
  clubName: string;
  clubLogo: string | null;
  // Anzeigegröße des Logos auf der Anmelde-/Startseite in Pixel (zentral, vom Admin). Das kleine
  // Logo in der App-Kopfzeile/Seitenleiste bleibt davon unberührt. Fehlt = Standard (88).
  loginLogoSize?: number;
  // Rechtstexte für den öffentlichen (Internet-)Betrieb: Impressum (§5 DDG) und Datenschutzerklärung
  // (Art. 13 DSGVO). Zentral in club_config, vom Admin gepflegt, auf der Login-Seite ohne Anmeldung
  // erreichbar. Leer = kein Link (lokaler/LAN-Betrieb braucht i. d. R. keins).
  impressum?: string;
  datenschutz?: string;
  dashRange?: 'week' | 'month' | 'all';
  // Sortier-Reihenfolge der Personen-Listen (Spieler, Benutzer, Kader):
  // 'first' = Vorname Nachname, 'last' = Nachname Vorname.
  nameOrder?: 'first' | 'last';
  // Board-/Kiosk-Modus (GERÄTE-LOKAL): startet direkt im Counter, sperrt die Navigation.
  // boardName = Bezeichnung dieses Board-Rechners (z. B. "Board 3"), für die spätere Aufstellung.
  kiosk?: boolean;
  boardName?: string;
}

export type Screen =
  | 'dashboard' | 'counter' | 'training' | 'calendar' | 'leagues'
  | 'teams' | 'players' | 'playerDetail' | 'stats' | 'users' | 'settings' | 'setup'
  | 'trainSetup' | 'trainGame';

// Counter throw
export interface Throw {
  playerId: number | string;
  score: number;
  raw: number;
  bust: boolean;
  checkout: boolean;
  leg: number;
  darts: number;
}

export interface GamePlayer {
  id: number | string;
  name: string;
  short: string;
  av: number;
  photo?: string; // optionales Profilfoto (aus dem verknüpften Spieler durchgereicht); Gäste haben keins
}
