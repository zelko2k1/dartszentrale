// Datenmodell — siehe DATA_MODEL.md

export type Role = 'admin' | 'captain' | 'player' | 'viewer';
export type AppMode = 'local' | 'verein';

export interface Player {
  id: string;
  name: string;
  short: string;       // max 3
  avi: number;         // Avatar-Farbindex
  locked?: boolean;    // Seed-Spieler
}

export interface Team {
  id: string;
  name: string;
  league?: string;     // Freitext
  memberIds: string[]; // → Player.id
  captainId: string | null;
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
}

export interface LeagueTeam {
  id: string;
  name: string;
  own: boolean;
}

export interface Fixture {
  id: string;
  homeId: string;
  awayId: string;
  date: string;        // YYYY-MM-DD
  played: boolean;
  hs: number | '';
  as: number | '';
}

export interface League {
  id: string;
  name: string;
  season: string;
  teams: LeagueTeam[];
  fixtures: Fixture[];
}

export interface EventItem {
  id: string;
  scope: 'local' | 'verein';
  title: string;
  date: string;        // YYYY-MM-DD
  time: string;
  type: string;        // EVENT_TYPES key
  loc: string;
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
  font: 'Inter' | 'Archivo' | 'Rubik' | 'Oswald';
  scoreScale: number;
  scoreArea: number;
  statsSize: number;
  headerSize: number;
  deckSize: number;
  legSize: number;
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
  dashRange?: 'week' | 'month' | 'all';
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
}
