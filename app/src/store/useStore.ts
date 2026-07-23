import { create } from 'zustand';
import type {
  Player, Team, Account, League, Fixture, EventItem, Match, Season, SeasonSnapshot, Settings, Screen,
  GamePlayer, Throw, Role, MatchPlayerStat, LineupPosition, FixtureLineup, LineupSegment, TeamKind, TrainingBest,
} from '../data/types';
import { AVATARS, DEVICE_LOCAL_SETTING_KEYS, DEVICE_UI_KEYS, LEAGUE_FORMAT_PRESETS } from '../data/constants';
import { uid, firstName, lastName, initials } from '../lib/format';
import { downscaleSquare } from '../lib/image';
import {
  scores as cScores, progress as cProgress, currentPlayer as cCurrentPlayer,
  matchOver as cMatchOver, average as cAverage, countAtLeast,
  finishStats as cFinishStats, shortLegs as cShortLegs, shortLegDarts as cShortLegDarts, first9Match as cFirst9Match,
  checkoutCelebration as cCheckoutCelebration, minCheckoutDarts as cMinCheckoutDarts,
  type CounterSlice,
} from './counter';
import {
  DEFAULT_SETTINGS, seedPlayers, seedTeams, seedAccounts, seedLeagues, seedEvents, seedSeasons, withDefaultPlayers, isSeedPlayer,
} from '../data/seed';
import { activeSeason as pickActiveSeason, computeStandings, aggregateFor, inSeason } from './selectors';
import {
  newTrainGame, applyTurn as tApplyTurn, trainMeta,
  TRAIN_BEST, isBetterBest, trainCelebration,
  type TrainGame, type TrainPlayer, type TurnInput,
} from './training';
import { createProvider, type DataProvider } from '../data/dataProvider';
import type { ProviderRecord } from '../data/provider';
import { mergeSchedule, deriveOwnTeams, seasonKey, type ParsedSchedule, type ImportCounts } from '../lib/scheduleImport';
import { mergeNuliga, type NuligaCounts, type NuligaConflict } from '../lib/nuligaImport';
import { applyPwaUpdate, checkForUpdate as checkPwaUpdate } from '../lib/pwaUpdate';
import { parseLiveRoute } from '../lib/deepLink';
import { dict } from '../i18n';

const LS = {
  settings: 'darts_settings',
  players: 'darts_players',
  matches: 'darts_matches',
  training: 'darts_training',
  trainplays: 'darts_trainplays',
  live: 'darts_live',
  events: 'darts_events',
  teams: 'darts_teams',
  users: 'darts_users',
  session: 'darts_session',
  leagues: 'darts_leagues',
  seasons: 'darts_seasons',
  seasonSnapshots: 'darts_season_snapshots',
  pburl: 'darts_pburl',
  device: 'darts_device', // gerätelokale Konfiguration (Board-/Kiosk-Modus, Board-Bezeichnung)
  devui: 'darts_devui', // gerätelokale UI-Vorlieben (Eingabe-Modus, Hell/Dunkel, Größen) – Mischbetrieb PC/Tablet
  setupDefaults: 'darts_setup_defaults', // gerätelokale Spieltyp-Voreinstellung (Startpunkte/Format/Out) – bleibt bis zur nächsten Änderung
  lastBackup: 'darts_last_backup', // Zeitstempel des letzten automatischen Backups (für Nachhol-Logik + Statusanzeige)
};

// Ligen nach manueller Reihenfolge (`order`) sortieren; ohne `order` (Altdaten) ans Ende, in
// ursprünglicher Reihenfolge (stabiler Sort). Wird beim Laden aus Storage und aus dem Server-Snapshot
// angewandt, damit die per Drag & Drop gesetzte Anordnung überall gleich erscheint.
function sortLeaguesByOrder(leagues: League[]): League[] {
  if (!Array.isArray(leagues)) return leagues;
  return leagues.slice().sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));
}

// Die aktuell im Ligen-Screen ausgewählte Liga. WICHTIG: `selectedLeague` ist ein Index in die
// SAISON-GEFILTERTE Anzeige (inSeason) — NICHT in st.leagues. Enthält st.leagues Ligen mehrerer Saisons
// (z. B. eine archivierte Vorsaison mit eigenen Ligen), weichen beide Indizes ab. Deshalb hier immer über
// dieselbe gefilterte Liste auflösen, die auch der Screen zeigt, statt direkt st.leagues[selectedLeague].
function currentLeague(st: AppState): League | null {
  const list = inSeason(st.leagues, st.viewSeasonId);
  if (!list.length) return null;
  return list[Math.max(0, Math.min(list.length - 1, st.selectedLeague))] || null;
}

// Nächstes Datum einer Terminserie (wöchentlich / 14-tägig / monatlich). 'none' → unverändert.
// Rechnet rein mit lokalen Datumsteilen (kein toISOString → keine UTC-Verschiebung um einen Tag).
function addRepeat(iso: string, repeat: EventRepeat): string {
  const [y, mo, dd] = iso.split('-').map(Number);
  const d = new Date(y, mo - 1, dd);
  if (repeat === 'weekly') d.setDate(d.getDate() + 7);
  else if (repeat === 'biweekly') d.setDate(d.getDate() + 14);
  else if (repeat === 'monthly') d.setMonth(d.getMonth() + 1);
  else return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Spieltyp-Felder, die als Voreinstellung gerätelokal erhalten bleiben (Spieler/Gäste/Liga NICHT).
const SETUP_DEFAULT_KEYS = ['startScore', 'unit', 'bestOf', 'bestOfSets', 'outMode', 'doubleIn', 'doubleOut'] as const;

// Tastenkürzel auf gültige Werte bringen + die früheren Strg+Alt-Standards auf die neuen Alt-Standards heben.
// Wird in init UND nach jedem Server-Snapshot angewandt (club_config-Werte würden die Migration sonst überschreiben).
function normalizeShortcuts(s: Settings) {
  const re = /^(ctrl\+)?alt\+[a-z0-9]$/;
  if (!re.test(s.newGameKey || '')) s.newGameKey = 'alt+n';
  if (!re.test(s.quickBo5Key || '')) s.quickBo5Key = 'alt+5';
  if (!re.test(s.quickBo3Key || '')) s.quickBo3Key = 'alt+3';
  if (!re.test(s.paletteKey || '')) s.paletteKey = 'alt+k';
  if (!re.test(s.undoKey || '')) s.undoKey = 'alt+z';
  if (!re.test(s.abortKey || '')) s.abortKey = 'alt+x';
  if (s.newGameKey === 'ctrl+alt+n') s.newGameKey = 'alt+n';
  if (s.quickBo5Key === 'ctrl+alt+5') s.quickBo5Key = 'alt+5';
  if (s.quickBo3Key === 'ctrl+alt+3') s.quickBo3Key = 'alt+3';
}

// Schreibt die gerätelokalen UI-Vorlieben (DEVICE_UI_KEYS) in den eigenen localStorage-Key – diese Settings
// gelten NUR auf diesem Gerät und werden bewusst nicht ins vereinsweite club_config synchronisiert.
function writeDevUi(settings: Settings) {
  const blob: Partial<Settings> = {};
  for (const k of DEVICE_UI_KEYS) (blob as Record<string, unknown>)[k] = settings[k];
  write(LS.devui, blob);
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch { return fallback; }
}
function write(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ }
}

// Spieltyp-Voreinstellung gerätelokal sichern (nur die SETUP_DEFAULT_KEYS, keine Spieler/Gäste).
function writeSetupDefaults(setup: SetupState) {
  const blob: Record<string, unknown> = {};
  for (const k of SETUP_DEFAULT_KEYS) blob[k] = (setup as unknown as Record<string, unknown>)[k];
  write(LS.setupDefaults, blob);
}

// ── Modal-Typen ──
export interface PlayerModalState { mode: 'add' | 'edit'; id: string | null; first: string; last: string; short: string; avi: number; }
export interface TeamModalState { mode: 'add' | 'edit'; id: string | null; name: string; league: string; memberIds: string[]; captainId: string | null; viceCaptainIds: string[]; kind: TeamKind; }
export interface UserModalState { mode: 'add' | 'edit'; id: string | null; first: string; last: string; email: string; role: Role; playerId: string | null; active: boolean; avi: number; position: string; password: string; isBoard: boolean; boardNumber: number | null; teamIds: string[]; }
export interface LeagueModalState { mode: 'add' | 'edit'; id: string | null; name: string; season: string; teams: { id: string; name: string; own: boolean }[]; singlesCount: number; doublesCount: number; format: LineupSegment[] | null; kind: TeamKind; nuligaUrl: string; }
export interface LineupModalState {
  leagueId: string; fixtureId: string;
  ownTeamName: string; oppName: string; ownIsHome: boolean;
  rosterIds: string[];                 // Kader-Spieler zur Auswahl (Player.id)
  positions: LineupPosition[];         // frei konfigurierbar, geordnet
  substitutes: string[];               // geordnet → E1, E2, …
  boardLive: boolean;                  // „An Boards senden": zeigt die Begegnung sofort an den Boards (unabh. Datum)
}
export interface ResultRow { id: string; kind: 'single' | 'double'; label: string; playerNames: string[]; won: 'own' | 'opp' | null; ownLegs: string; oppLegs: string; auto: boolean; }
export interface ResultModalState {
  leagueId: string; fixtureId: string;
  ownTeamName: string; oppName: string; ownIsHome: boolean;
  rows: ResultRow[];
}

// Geordnete Format-Segmente einer Liga (Fallback: einfache Einzel/Doppel-Zähler bzw. 4+2).
// Nicht gesetzte/0-Zähler (z. B. Altdaten oder frisch ergänzte Spalten) → Standard 4 Einzel + 2 Doppel.
export function leagueSegments(lg: Pick<League, 'format' | 'singlesCount' | 'doublesCount'>): LineupSegment[] {
  if (lg.format && lg.format.length) return lg.format;
  const s = lg.singlesCount && lg.singlesCount > 0 ? lg.singlesCount : 4;
  const d = lg.doublesCount && lg.doublesCount > 0 ? lg.doublesCount : 2;
  return [{ kind: 'singles', count: s }, { kind: 'doubles', count: d }];
}
const segTotal = (segs: LineupSegment[], kind: LineupSegment['kind']) =>
  segs.filter((s) => s.kind === kind).reduce((a, b) => a + b.count, 0);
export interface FixtureModalState { mode: 'add' | 'edit'; id: string | null; leagueId: string; homeId: string | null; awayId: string | null; date: string; time: string; loc: string; played: boolean; hs: string; as: string; }
// nuLiga-Abruf/-Review einer Liga: Ladephase → Ergebnis (Zähler + Konfliktliste) oder Fehler.
export interface NuligaSyncState {
  leagueId: string;
  leagueName: string;
  phase: 'loading' | 'done' | 'error';
  error?: string;
  championship?: string;
  fetchedAt?: string;
  total?: number;                        // von nuLiga gelieferte Begegnungen
  counts?: NuligaCounts;
  conflicts?: NuligaConflict[];          // offene Heimspiel-Abweichungen zur Klärung
}
// Freundschaftsspiel anlegen: eigene Mannschaft vs. frei wählbarer Gegner (aus allen Saisons/Ligen suchbar).
export interface FriendlyModalState { ownTeam: string; opponent: string; homeIsOwn: boolean; date: string; time: string; loc: string; }
export type EventRepeat = 'none' | 'weekly' | 'biweekly' | 'monthly';
export interface EventModalState { mode: 'add' | 'edit'; id: string | null; scope: 'local' | 'verein'; title: string; date: string; time: string; type: string; loc: string; repeat: EventRepeat; until: string; seriesId: string | null; }

export interface SetupState {
  mode: 'single' | 'teams'; startScore: number; bestOf: number; bestOfSets: number;
  unit: 'legs' | 'sets'; doubleOut: boolean; outMode: 'single' | 'double' | 'master'; doubleIn: boolean; p1: number; p2: number; teamA: number; teamB: number;
  p1Guest?: string; p2Guest?: string; // Gast-Namen (überschreiben die Spielerwahl, wenn gesetzt)
  freePlay?: boolean;                  // Freies Spiel → wird nicht als Match gespeichert
  link?: { leagueId: string; fixtureId: string; positionId: string } | null; // Board-Spiel → Liga-Position
}
// Auswahl der Fernbedienung fürs Startmenü (Spieler-IDs + Format) → Board startet ein Spiel damit.
export interface RemoteStartSelection {
  p1Id?: string; p2Id?: string;
  startScore?: number; outMode?: 'single' | 'double' | 'master'; doubleIn?: boolean;
  unit?: 'legs' | 'sets'; bestOf?: number; bestOfSets?: number;
}
// auto = selbst-ausblendende Feier (z. B. Short Leg) statt blockierendem Modal mit „Verstanden"-Knopf.
export interface HintState { title: string; body: string; auto?: boolean; }
export interface TrainSetupState { modeId: string; count: number; picks: number[]; }
export type NewAction = { kind: 'setup' } | { kind: 'preset'; preset: Partial<SetupState> };

export interface AppState {
  // navigation / session
  screen: Screen;
  selectedPlayerId: string | null;
  session: string | null;
  loginForm: { email: string; pw: string; code: string; mfaStep: boolean; err: string };
  now: number;

  // Datenquelle (lokal = localStorage, verein = PocketBase wenn VITE_PB_URL gesetzt)
  provider: DataProvider;
  // true, wenn ein echtes PocketBase-Backend aktiv ist (Login/Schreiben gehen an den Server)
  pbMode: boolean;
  // Erst-Start: noch keine Lokal/Verein-Wahl getroffen → Auswahl-Screen zeigen.
  needsModeChoice: boolean;
  // Board-Modus für diese Sitzung entsperrt (z. B. Kapitän hat sich zum Ändern angemeldet);
  // nicht persistiert → nach Neuladen ist das Board wieder gesperrt, sofern settings.kiosk gilt.
  kioskUnlocked: boolean;
  // letzte fehlgeschlagene Server-Synchronisation (für eine kleine Hinweisleiste); null = ok
  syncError: string | null;

  // collections
  settings: Settings;
  players: Player[];
  teams: Team[];
  accounts: Account[];
  leagues: League[];
  events: EventItem[];
  matches: Match[];
  // Saisons + aktive/angezeigte Saison. activeSeasonId = laufende Saison (neue Datensätze hängen hier).
  // viewSeasonId = aktuell betrachtete Saison (Umschalter); ≠ active → Lesemodus (Soft-Archiv).
  seasons: Season[];
  seasonSnapshots: SeasonSnapshot[];
  activeSeasonId: string | null;
  viewSeasonId: string | null;

  selectedLeague: number;
  selectedTeam: number;

  // modals
  playerModal: PlayerModalState | null;
  teamModal: TeamModalState | null;
  userModal: UserModalState | null;
  leagueModal: LeagueModalState | null;
  lineupModal: LineupModalState | null;
  resultModal: ResultModalState | null;
  fixtureModal: FixtureModalState | null;
  friendlyModal: FriendlyModalState | null;
  eventModal: EventModalState | null;
  importOpen: boolean;
  nuligaSync: NuligaSyncState | null;

  // counter (game) state
  gamePlayers: GamePlayer[];
  allThrows: Throw[];
  input: string;
  startOffset: number;
  pendingStart: boolean;
  bullMode: boolean;
  spinPick: number | null;
  nextGameDismissed: string | null; // Kiosk: positionId des „Nächstes Spiel"-Overlays, das per „Später" weggeklickt wurde
  boardForceShow: boolean;          // Kiosk: „Jetzt anzeigen" am Board → zeigt die zugeordnete Begegnung auch außerhalb des Datumsfensters
  abortConfirm: boolean;
  matchSaved: boolean;
  freePlay: boolean;        // laufendes Spiel ist „Freies Spiel" → kein Speichern
  gameLink: { leagueId: string; fixtureId: string; positionId: string } | null; // Liga-Position des laufenden Spiels
  gameMode: 'single' | 'teams';
  setup: SetupState;
  hint: HintState | null;
  // Nach einem Checkout OHNE bekannte Dartzahl (nicht via F10–F12): fragt, mit welchem Dart (1/2/3) das
  // Leg beendet wurde. Blockiert Feier/Sieg-Overlay, bis geantwortet ist. playerId = wer ausgemacht hat;
  // score = die Ausmache; minDarts = kleinste mögliche Dartzahl (canCheckout) → Optionen darunter sind gesperrt.
  finishPrompt: { playerId: string | number; score: number; minDarts: number } | null;

  // PWA-Update (manueller Fluss): neue Version liegt bereit / Status des manuellen Checks
  updateReady: boolean;
  updateStatus: 'idle' | 'checking' | 'current';

  // training
  rulesMode: string | null;
  trainSetup: TrainSetupState | null;
  trainGame: TrainGame | null;
  trainUndo: TrainGame[];
  trainingPlays: Record<string, number>;
  // TrainPlayer-IDs, die im gerade beendeten Spiel einen neuen persönlichen Bestwert erzielt haben (Sieg-Overlay-Badge).
  trainBestFlash: string[];

  // counter: "enter remaining score" box (F9)
  restEntry: boolean;
  // counter: confirm before discarding a running game for a new one
  newConfirm: boolean;
  pendingNew: NewAction;

  // actions
  init: () => void;
  go: (screen: Screen) => void;
  openPlayer: (id: string) => void;

  // login
  setLoginField: (key: 'email' | 'pw' | 'code', val: string) => void;
  login: (id: string) => void;
  loginEmail: () => void;
  logout: () => void;

  // Server-Sync (Verein)
  reloadFromProvider: () => void;
  clearSyncError: () => void;

  // Saison-Umschalter (Soft-Archiv): betrachtete Saison wechseln.
  setViewSeason: (seasonId: string) => void;
  // Aktuelle (aktive) Saison als JSON-Bundle herunterladen (Wegsicherung, nicht-destruktiv).
  exportSeason: (seasonId?: string) => void;
  // Saison abschließen: Snapshot einfrieren + Bundle herunterladen + archivieren + Nachfolge-Saison anlegen.
  closeSeason: () => void;
  // Ligen & Mannschaften der aktiven Saison samt Daten löschen (für frischen Re-Import nach CSV-Fehler).
  resetSeasonData: () => void;
  // Neue-Saison-Assistent: Mannschaften und/oder Liga-Strukturen (ohne Ergebnisse) aus einer früheren Saison
  // in die aktive Saison klonen.
  carryOverSeason: (opts: { fromSeasonId: string; teams: boolean; leagues: boolean }) => void;
  // Phase 4: archivierte Saison auslagern (Bundle herunterladen + Spiele aus der DB entfernen, offloaded=true).
  offloadSeason: (seasonId: string) => void;
  // Phase 4: ausgelagerte Saison aus einem Bundle wieder einlesen (Spiele/fehlende Datensätze, offloaded=false).
  reimportSeason: (bundle: unknown) => { matches: number; restored: number } | null;

  // settings
  setSetting: <K extends keyof Settings>(key: K, val: Settings[K]) => void;
  chooseMode: (mode: 'local' | 'verein') => void;
  setFKey: (i: number, val: string) => void;
  // Board-/Kiosk-Modus (gerätelokal). kioskUnlocked = laufzeit-Entsperrung (nicht persistiert).
  setDeviceSetting: (key: 'kiosk' | 'boardName' | 'nameOrder', val: boolean | string) => void;
  kioskExitLogin: (email: string, pw: string) => Promise<boolean>;
  relockKiosk: () => void;
  // PocketBase-Serveradresse (gerätelokal); leerer String = lokaler Modus
  setPbUrl: (url: string) => void;

  // Daten-Backup
  exportData: () => string;
  importData: (json: string) => boolean;
  lastBackupAt: string | null;   // ISO-Zeit des letzten automatischen Backups (serve-dist.mjs)
  backupMsg: string | null;      // Statuszeile fürs Auto-Backup (Erfolg/Fehler)
  runBackup: () => Promise<void>; // Daten-Export an den lokalen Server posten → Datei in backup/

  // player modal
  openAddPlayer: () => void;
  openEditPlayer: (id: string) => void;
  closePlayerModal: () => void;
  setPlayerField: (key: 'first' | 'last' | 'short', val: string) => void;
  cyclePlayerAvi: (dir: number) => void;
  savePlayerModal: () => void;
  deletePlayer: (id: string) => void;

  // team modal
  selectTeam: (i: number) => void;
  openAddTeam: () => void;
  openEditTeam: () => void;
  closeTeamModal: () => void;
  setTeamField: (key: 'name' | 'league', val: string) => void;
  setTeamKind: (kind: TeamKind) => void;
  toggleTeamMember: (pid: string) => void;
  setTeamCaptain: (pid: string) => void;
  toggleTeamViceCaptain: (pid: string) => void;
  saveTeamModal: () => void;
  deleteTeam: (id: string) => void;

  // user modal
  openAddUser: () => void;
  openAddUserForPlayer: (playerId: string) => void;
  openEditUser: (id: string) => void;
  closeUserModal: () => void;
  setUserField: (key: keyof UserModalState, val: string | boolean | null) => void;
  toggleUserTeam: (teamId: string) => void;
  cycleUserAvi: (dir: number) => void;
  saveUserModal: () => void;
  deleteUser: (id: string) => void;
  toggleUserActive: (id: string) => void;
  // Eigenes Passwort ändern (jeder angemeldete Nutzer). Liefert true bei Erfolg.
  changeOwnPassword: (newPassword: string) => Promise<boolean>;
  // 2FA-Verwaltung (Admin): IDs der Konten mit aktivem 2FA (für die Benutzerliste) + Zurücksetzen.
  twoFAUserIds: string[];
  loadTwoFAAdminList: () => void;
  resetUserTwoFA: (userId: string) => Promise<boolean>;
  // Board-Rechner-Konten nach festem Schema anlegen (Board 1…count, gemeinsames Passwort). Nur Vereinsmodus/Admin.
  createBoardAccounts: (count: number, password: string) => void;
  // Profilfoto für Spieler/Benutzerkonto setzen/entfernen (nur Vereinsmodus, PocketBase-File-Feld).
  uploadPhoto: (kind: 'player' | 'account', id: string, file: File) => Promise<void>;
  clearPhoto: (kind: 'player' | 'account', id: string) => Promise<void>;

  // league modal
  selectLeague: (i: number) => void;
  reorderLeagues: (orderedVisibleIds: string[]) => void;
  openAddLeague: () => void;
  openEditLeague: () => void;
  closeLeagueModal: () => void;
  setLeagueField: (key: 'name' | 'season' | 'kind' | 'nuligaUrl', val: string) => void;
  setLeagueCount: (key: 'singlesCount' | 'doublesCount', val: number) => void;
  setLeagueFormatPreset: (key: string) => void;
  addLeagueTeam: () => void;
  setLeagueTeamName: (id: string, val: string) => void;
  toggleLeagueTeamOwn: (id: string) => void;
  removeLeagueTeam: (id: string) => void;
  saveLeagueModal: () => void;
  deleteLeague: (id: string) => void;

  // lineup modal (frei konfigurierbare Aufstellung pro Begegnung)
  openLineup: (fixtureId: string) => void;
  // Shortcut aus der Mannschafts-Ansicht: wählt die passende Liga und öffnet das Aufstellungs-Modal direkt.
  openLineupAt: (leagueIndex: number, fixtureId: string) => void;
  closeLineup: () => void;
  toggleLineupBoardLive: () => void;
  addLineupPosition: (kind: 'single' | 'double') => void;
  removeLineupPosition: (id: string) => void;
  moveLineupPosition: (id: string, dir: -1 | 1) => void;
  setLineupPositionPlayer: (id: string, pos: number, playerId: string) => void;
  setLineupPositionBoard: (id: string, board: string) => void;
  toggleSubstitute: (playerId: string) => void;
  moveSubstitute: (playerId: string, dir: -1 | 1) => void;
  saveLineup: () => void;

  // result modal (Brett-für-Brett-Ergebniserfassung / Spielbericht)
  openResult: (fixtureId: string) => void;
  closeResult: () => void;
  setResultWon: (id: string, won: 'own' | 'opp') => void;
  setResultLeg: (id: string, side: 'own' | 'opp', val: string) => void;
  saveResult: () => void;

  // Spielplan-Import (CSV)
  openImport: () => void;
  closeImport: () => void;
  importSchedule: (parsed: ParsedSchedule) => ImportCounts;

  // nuLiga-Import (Vereinsmodus, Admin) — server-seitiger Abruf + Merge in die Liga
  importNuliga: (leagueId: string) => Promise<void>;
  closeNuligaSync: () => void;
  resolveNuligaConflict: (leagueId: string, fixtureId: string, accept: boolean) => void;

  // fixture modal
  openAddFixture: () => void;
  openEditFixture: (id: string) => void;
  closeFixtureModal: () => void;
  setFixtureField: (key: keyof FixtureModalState, val: string | boolean) => void;
  saveFixtureModal: () => void;
  deleteFixture: (id: string) => void;

  // Freundschaftsspiel
  openFriendly: () => void;
  closeFriendly: () => void;
  setFriendlyField: (key: keyof FriendlyModalState, val: string | boolean) => void;
  saveFriendly: () => void;

  // event modal
  openAddEvent: (iso?: string) => void;
  openEditEvent: (id: string) => void;
  closeEventModal: () => void;
  setEventField: (key: keyof EventModalState, val: string) => void;
  saveEventModal: () => void;
  deleteEvent: (id: string) => void;
  deleteEventSeries: (seriesId: string) => void;
  pruneEvents: (cutoffIso: string) => number;

  // training
  openRules: (modeId: string) => void;
  closeRules: () => void;
  openTrainSetup: (modeId: string) => void;
  setTrainCount: (n: number) => void;
  setTrainPick: (slot: number, playerIdx: number) => void;
  startTrain: () => void;
  trainApply: (input: TurnInput) => void;
  trainUndoTurn: () => void;
  trainRematch: () => void;
  trainExit: () => void;

  // counter
  goSetup: (preset?: Partial<SetupState>) => void;
  setSetup: <K extends keyof SetupState>(key: K, val: SetupState[K]) => void;
  startGame: () => void;
  quickStart: (preset?: Partial<SetupState>) => void;
  startBoardGame: (leagueId: string, fixtureId: string, positionId: string, ownPlayerId: string, oppName: string, starterIdx?: number) => void;
  dismissNextGame: (positionId: string) => void;
  showBoardNow: () => void;
  chooseStarter: (idx: number) => void;
  openBullOff: () => void;
  closeBullOff: () => void;
  rematch: () => void;
  endGameTo: (target: 'dashboard' | 'setup') => void;
  abortGame: () => void;
  confirmAbort: () => void;
  cancelAbort: () => void;
  apply: (score: number, darts?: number) => void;
  pressDigit: (d: string) => void;
  pressClear: () => void;
  pressDel: () => void;
  pressEnter: () => void;
  quick: (n: number) => void;
  openRestEntry: () => void;
  closeRestEntry: () => void;
  submitRestEntry: (remStr: string) => void;
  undo: () => void;
  newMatch: () => void;
  requestNew: (action: NewAction) => void;
  runNew: (action: NewAction) => void;
  startPreset: (preset: Partial<SetupState>) => void;
  startRemoteGame: (sel: RemoteStartSelection) => void;
  confirmNew: () => void;
  cancelNew: () => void;
  showHint: (hint: HintState) => void;
  closeHint: () => void;
  resolveFinish: (dart: number) => void;
  cancelFinish: () => void;
  applyUpdate: () => void;
  checkForUpdate: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  screen: 'dashboard',
  selectedPlayerId: null,
  session: null,
  twoFAUserIds: [],
  loginForm: { email: '', pw: '', code: '', mfaStep: false, err: '' },
  now: Date.now(),

  provider: createProvider('local'),
  pbMode: false,
  lastBackupAt: null,
  backupMsg: null,
  needsModeChoice: false,
  kioskUnlocked: false,
  syncError: null,
  settings: DEFAULT_SETTINGS,
  players: [],
  teams: [],
  accounts: [],
  leagues: [],
  events: [],
  matches: [],
  seasons: [],
  seasonSnapshots: [],
  activeSeasonId: null,
  viewSeasonId: null,

  selectedLeague: 0,
  selectedTeam: 0,

  playerModal: null,
  teamModal: null,
  userModal: null,
  leagueModal: null,
  lineupModal: null,
  resultModal: null,
  fixtureModal: null,
  friendlyModal: null,
  eventModal: null,
  importOpen: false,
  nuligaSync: null,

  gamePlayers: [
    { id: 1, name: 'Lukas Brandt', short: 'LB', av: 0 },
    { id: 2, name: 'Sven Möller', short: 'SM', av: 3 },
  ],
  allThrows: [],
  input: '',
  startOffset: 0,
  pendingStart: false,
  bullMode: false,
  spinPick: null,
  nextGameDismissed: null,
  boardForceShow: false,
  abortConfirm: false,
  matchSaved: false,
  freePlay: false,
  gameLink: null,
  gameMode: 'single',
  setup: { mode: 'single', startScore: 501, bestOf: 5, bestOfSets: 3, unit: 'legs', doubleOut: true, outMode: 'double', doubleIn: false, p1: 0, p2: 1, teamA: 0, teamB: 1, p1Guest: '', p2Guest: '', freePlay: false, link: null },
  hint: null,
  finishPrompt: null,
  updateReady: false,
  updateStatus: 'idle',

  rulesMode: null,
  trainSetup: null,
  trainGame: null,
  trainUndo: [],
  trainingPlays: {},
  trainBestFlash: [],
  restEntry: false,
  newConfirm: false,
  pendingNew: { kind: 'setup' },

  init() {
    const detected: 'local' | 'verein' = 'verein';
    const savedSettings = read<Partial<Settings> | null>(LS.settings, null);
    const firstRun = !savedSettings; // frisches Gerät (noch nichts gespeichert) → Lokal/Verein-Auswahl zeigen
    const settings: Settings = { ...DEFAULT_SETTINGS, ...(savedSettings || {}) };
    // migrate older saves that only had doubleOut
    if (savedSettings && savedSettings.outMode === undefined) settings.outMode = settings.doubleOut === false ? 'single' : 'double';
    // migrate single colours → per-mode (start both modes from the previously chosen colour)
    if (savedSettings) {
      if (savedSettings.accentDark === undefined) settings.accentDark = settings.accent;
      if (savedSettings.accentLight === undefined) settings.accentLight = settings.accent;
      if (savedSettings.scoreColorDark === undefined) settings.scoreColorDark = settings.scoreColor ?? null;
      if (savedSettings.scoreColorLight === undefined) settings.scoreColorLight = settings.scoreColor ?? null;
      if (savedSettings.legColorDark === undefined) settings.legColorDark = settings.legColor ?? null;
      if (savedSettings.legColorLight === undefined) settings.legColorLight = settings.legColor ?? null;
    }
    // Gerätelokale UI-Vorlieben (Eingabe-Modus, Hell/Dunkel, Größen) über die zentralen Settings legen –
    // jedes Gerät behält seine eigenen Werte. VOR der Farb-Ableitung, da settings.mode hier einfließt.
    const devui = read<Partial<Settings>>(LS.devui, {});
    const devuiRec = devui as unknown as Record<string, unknown>;
    const settingsRec = settings as unknown as Record<string, unknown>;
    for (const k of DEVICE_UI_KEYS) { const v = devuiRec[k as string]; if (v !== undefined) settingsRec[k as string] = v; }
    // sync live colours to the active mode
    settings.accent = (settings.mode === 'light' ? settings.accentLight : settings.accentDark) || settings.accent;
    settings.scoreColor = settings.mode === 'light' ? settings.scoreColorLight : settings.scoreColorDark;
    settings.legColor = settings.mode === 'light' ? settings.legColorLight : settings.legColorDark;
    // shortcuts must be Strg+Alt+<letter/digit> — reset any legacy/invalid value
    // Kürzel = Alt + Buchstabe/Ziffer (optional Strg). Standard Alt+N / Alt+5 / Alt+3; alte Strg+Alt-Standards migrieren.
    normalizeShortcuts(settings);
    // Fernbedienung per QR/Deep-Link (#/remote) funktioniert ausschließlich im Vereinsmodus. Das koppelnde
    // Handy soll deshalb nicht erst „Lokal/Verein?" gefragt werden — direkt Vereinsmodus annehmen und den
    // Auswahl-Screen überspringen (der Vereins-Login bleibt als Sicherheitsschritt bestehen). Nur laufzeit-
    // wirksam (nicht persistiert): ein reiner Fernbedienungs-Aufruf verändert die Geräteeinstellung nicht.
    const remoteEntry = parseLiveRoute()?.mode === 'remote';
    // Erst-Start: neutral im Local-Mode hochfahren und den Auswahl-Screen zeigen (s. needsModeChoice).
    // Bestehende Geräte ohne explizite Wahl behalten ihr bisheriges Verhalten (detected).
    if (remoteEntry) settings.appMode = 'verein';
    else if (firstRun) settings.appMode = 'local';
    else if (savedSettings.appModeManual !== true) settings.appMode = detected;
    settings.appModeDetected = detected;
    const showModeChoice = firstRun && !remoteEntry;

    // PocketBase-URL ist GERÄTE-LOKAL (eigener Key, nicht serverseitig) — jeder Rechner/Verein
    // trägt seine eigene Instanz ein. Hat Vorrang vor dem Build-Default VITE_PB_URL.
    const pbUrl = read<string>(LS.pburl, '');
    settings.pbUrl = pbUrl;

    // Board-/Kiosk-Konfiguration + Namens-Sortierung sind GERÄTE-LOKAL (jeder Rechner/Nutzer für sich).
    const dev = read<{ kiosk?: boolean; boardName?: string; nameOrder?: 'first' | 'last' }>(LS.device, {});
    settings.kiosk = !!dev.kiosk;
    settings.boardName = dev.boardName || '';
    settings.nameOrder = dev.nameOrder || settings.nameOrder || 'first';

    // Spieltyp-Voreinstellung (gerätelokal) wiederherstellen → bleibt über Neuladen erhalten, bis sie geändert wird.
    const savedSetup = read<Record<string, unknown>>(LS.setupDefaults, {});
    const setupPatch: Record<string, unknown> = {};
    for (const k of SETUP_DEFAULT_KEYS) if (savedSetup[k] !== undefined) setupPatch[k] = savedSetup[k];
    if (Object.keys(setupPatch).length) set((st) => ({ setup: { ...st.setup, ...(setupPatch as Partial<SetupState>) } }));

    // Datenquelle wählen. provider.mode === 'verein' nur, wenn eine URL vorliegt (Einstellung
    // oder VITE_PB_URL); sonst Fallback auf LocalProvider → lokaler & Demo-Pfad unverändert.
    const provider = createProvider(settings.appMode, pbUrl);
    if (provider.mode === 'verein') {
      // Echter PocketBase-Pfad: Daten vom Server, echte Auth, Schreiben & Realtime.
      // Persistente Anmeldung NUR für Board-Konten (Kiosk-Rechner sollen nach einem Neustart weiter
      // eingeloggt sein). Alle anderen Konten (Admin/Kapitän/Spieler) werden beim App-Start NICHT
      // wiederhergestellt — ein Admin-Login soll auf einem geteilten Board-PC nicht „hängen bleiben".
      // Ebenso eine Session eines zwischenzeitlich deaktivierten Kontos verwerfen.
      const restored = provider.currentUser();
      const keepSession = !!restored && restored.active && restored.isBoard;
      if (restored && !keepSession) { void provider.logout(); }
      const session = keepSession ? restored.id : null;
      set({ settings, provider, pbMode: true, session, needsModeChoice: showModeChoice });
      // Öffentliche Vereins-Infos (Name, Logo, Impressum, Datenschutz) unabhängig vom Login laden,
      // damit die Login-Seite sie auch beim allerersten Aufruf (noch nicht angemeldet) zeigt. Für
      // angemeldete Nutzer setzt applySnapshot dieselben Werte autoritativ nach (kein Konflikt).
      void provider.loadPublicConfig().then((pub) => {
        if (!pub) return;
        set((st) => {
          const next = { ...st.settings };
          if (pub.clubName !== undefined) next.clubName = pub.clubName;
          if (pub.clubLogo !== undefined) next.clubLogo = pub.clubLogo;
          if (pub.loginLogoSize !== undefined) next.loginLogoSize = pub.loginLogoSize;
          if (pub.impressum !== undefined) next.impressum = pub.impressum;
          if (pub.datenschutz !== undefined) next.datenschutz = pub.datenschutz;
          return { settings: next };
        });
      }).catch(() => { /* Freigabe fehlt → Login-Seite nutzt den lokalen Cache */ });
      void applySnapshot(get, set);
      // Realtime: bei serverseitigen Änderungen neu laden (entprellt) → mehrere Geräte bleiben synchron.
      provider.subscribe(() => scheduleReload(get, set));
      return;
    }

    let players = read<Player[]>(LS.players, []);
    if (!Array.isArray(players) || players.length === 0) {
      players = seedPlayers();
      write(LS.players, players);
    }
    players = withDefaultPlayers(players); // Standard-Spieler 1/2 immer vorhanden + locked
    write(LS.players, players);

    let teams = read<Team[]>(LS.teams, []);
    if (!Array.isArray(teams) || teams.length === 0) { teams = seedTeams(players); write(LS.teams, teams); }

    let accounts = read<Account[]>(LS.users, []);
    if (!Array.isArray(accounts) || accounts.length === 0) { accounts = seedAccounts(players); write(LS.users, accounts); }

    let leagues = sortLeaguesByOrder(read<League[]>(LS.leagues, []));
    if (!Array.isArray(leagues) || leagues.length === 0) { leagues = seedLeagues(); write(LS.leagues, leagues); }

    let events = read<EventItem[]>(LS.events, []);
    if (!Array.isArray(events) || events.length === 0) { events = seedEvents(); write(LS.events, events); }

    let matches = read<Match[]>(LS.matches, []);
    const session = read<string | null>(LS.session, null);
    const trainingPlays = read<Record<string, number>>(LS.trainplays, {});

    // Saisons: mindestens eine aktive Saison sicherstellen, dann Altbestand (ohne seasonId / ohne Match-playerId) migrieren.
    let seasons = read<Season[]>(LS.seasons, []);
    if (!Array.isArray(seasons) || seasons.length === 0) { seasons = seedSeasons(); write(LS.seasons, seasons); }
    const activeSeasonId = (pickActiveSeason(seasons) || seasons[0]).id;
    const mig = migrateSeasonData({ leagues, teams, events, matches }, activeSeasonId, players);
    if (mig.lc) { leagues = mig.leagues; write(LS.leagues, leagues); }
    if (mig.tc) { teams = mig.teams; write(LS.teams, teams); }
    if (mig.ec) { events = mig.events; write(LS.events, events); }
    if (mig.mc) { matches = mig.matches; write(LS.matches, matches); }
    const seasonSnapshots = read<SeasonSnapshot[]>(LS.seasonSnapshots, []);

    set({ settings, provider, pbMode: false, players, teams, accounts, leagues, events, matches, seasons, seasonSnapshots, activeSeasonId, viewSeasonId: activeSeasonId, session, trainingPlays, lastBackupAt: read<string | null>(LS.lastBackup, null), needsModeChoice: showModeChoice });
  },

  reloadFromProvider() { void applySnapshot(get, set); },
  clearSyncError() { set({ syncError: null }); },

  // Betrachtete Saison wechseln (nur Lese-/Filteransicht; ändert nicht die aktive Saison).
  setViewSeason(seasonId) {
    set((st) => st.seasons.some((s) => s.id === seasonId) ? { viewSeasonId: seasonId, selectedLeague: 0, selectedTeam: 0 } : {});
  },

  // Saison als JSON-Bundle herunterladen (Wegsicherung) — ändert nichts.
  exportSeason(seasonId) {
    const st = get();
    const season = st.seasons.find((s) => s.id === (seasonId || st.activeSeasonId));
    if (!season) return;
    const snapshot = buildSeasonSnapshot(season, st);
    downloadJson(bundleFilename(season), buildSeasonBundle(season, snapshot, st));
  },

  // Saison abschließen: Snapshot einfrieren + Bundle herunterladen + archivieren + Nachfolge-Saison anlegen.
  // Daten bleiben in der DB (Soft-Archiv, read-only); die Wegsicherung ist die heruntergeladene Datei.
  closeSeason() {
    const st = get();
    const active = st.seasons.find((s) => s.id === st.activeSeasonId);
    if (!active || active.status !== 'active') return;
    const snapshot = buildSeasonSnapshot(active, st);
    // Wegsicherung sofort herunterladen (vor jeder späteren Auslagerung).
    downloadJson(bundleFilename(active), buildSeasonBundle(active, snapshot, st));
    const today = new Date().toISOString().slice(0, 10);
    const archived: Season = { ...active, status: 'archived', endDate: active.endDate || today };
    const newSeason: Season = { id: uid(), name: nextSeasonName(active.name), status: 'active', startDate: today };
    const seasons = st.seasons.map((s) => s.id === active.id ? archived : s).concat(newSeason);
    const seasonSnapshots = [...st.seasonSnapshots, snapshot];
    persist(st, set, LS.seasonSnapshots, seasonSnapshots, (p) => p.createRecord('season_snapshots', snapshot as unknown as ProviderRecord));
    persist(st, set, LS.seasons, seasons, (p) => Promise.all([
      p.updateRecord('seasons', archived.id, { status: 'archived', endDate: archived.endDate } as unknown as ProviderRecord),
      p.createRecord('seasons', newSeason as unknown as ProviderRecord),
    ]));
    // Termine der abgeschlossenen Saison: automatische Liga/Pokal-Termine (fixtureId) löschen; eigene
    // (manuelle) Termine in die neue Saison mitnehmen, damit sie sichtbar bleiben (bis manuell gelöscht).
    const closing = st.events.filter((e) => (e.seasonId ?? active.id) === active.id);
    const delEvents = closing.filter((e) => e.fixtureId);
    const moveEvents = closing.filter((e) => !e.fixtureId).map((e) => ({ ...e, seasonId: newSeason.id }));
    const delIds = new Set(delEvents.map((e) => e.id));
    const moveById = new Map(moveEvents.map((e) => [e.id, e]));
    const events = st.events.filter((e) => !delIds.has(e.id)).map((e) => moveById.get(e.id) || e);
    if (st.provider.mode === 'verein') {
      delEvents.forEach((e) => void st.provider.deleteRecord('events', e.id).catch((err) => { console.error('[sync]', err); set({ syncError: dict().storeMsg.errEventDelete }); }));
      moveEvents.forEach((e) => void st.provider.updateRecord('events', e.id, e as unknown as ProviderRecord).catch((err) => { console.error('[sync]', err); set({ syncError: dict().storeMsg.errEventMove }); }));
    } else if (delEvents.length || moveEvents.length) {
      write(LS.events, events);
    }
    set({ seasons, seasonSnapshots, events, activeSeasonId: newSeason.id, viewSeasonId: newSeason.id, selectedLeague: 0, selectedTeam: 0 });
  },

  // Ligen & Mannschaften der AKTIVEN Saison samt Daten löschen (inkl. der automatisch angelegten
  // Spieltag-Termine). Für den Fall, dass die importierte CSV einen Fehler hatte → löschen, CSV
  // korrigieren, neu importieren. Gespielte Spiele/Statistiken, Spieler und andere Saisons bleiben unberührt.
  resetSeasonData() {
    const st = get();
    const asid = st.activeSeasonId ?? undefined;
    const inActive = <T extends { seasonId?: string }>(x: T) => (x.seasonId ?? asid) === asid;
    const delLeagues = st.leagues.filter(inActive);
    const delTeams = st.teams.filter(inActive);
    const fixIds = new Set(delLeagues.flatMap((l) => l.fixtures.map((f) => f.id)));
    const delEvents = st.events.filter((e) => e.fixtureId && fixIds.has(e.fixtureId));
    if (!delLeagues.length && !delTeams.length && !delEvents.length) return;

    const leagues = st.leagues.filter((l) => !inActive(l));
    const teams = st.teams.filter((t) => !inActive(t));
    const delEventIds = new Set(delEvents.map((e) => e.id));
    const events = st.events.filter((e) => !delEventIds.has(e.id));

    if (st.provider.mode === 'verein') {
      delLeagues.forEach((l) => void st.provider.deleteRecord('leagues', l.id).catch((e) => { console.error('[sync]', e); set({ syncError: dict().storeMsg.errLeagueDelete }); }));
      delTeams.forEach((t) => void st.provider.deleteRecord('teams', t.id).catch((e) => { console.error('[sync]', e); set({ syncError: dict().storeMsg.errTeamDelete }); }));
      delEvents.forEach((e) => void st.provider.deleteRecord('events', e.id).catch((err) => { console.error('[sync]', err); set({ syncError: dict().storeMsg.errEventDelete }); }));
    } else {
      write(LS.leagues, leagues);
      write(LS.teams, teams);
      write(LS.events, events);
    }
    set({ leagues, teams, events, selectedLeague: 0, selectedTeam: 0 });
  },

  // Vorsaison in die aktive Saison übernehmen: Mannschaften (mit Kader/Kapitän) und/oder Liga-Strukturen
  // (Teilnehmer + Format, OHNE Begegnungen/Ergebnisse) klonen. Spieler sind saisonübergreifend (keine Klone).
  carryOverSeason({ fromSeasonId, teams: doTeams, leagues: doLeagues }) {
    const st = get();
    const asid = st.activeSeasonId;
    const activeSeasonObj = st.seasons.find((s) => s.id === asid);
    if (!asid || !activeSeasonObj || !fromSeasonId || fromSeasonId === asid) return;
    const newTeams: Team[] = doTeams
      ? st.teams.filter((t) => t.seasonId === fromSeasonId).map((t) => ({ ...t, id: uid(), seasonId: asid }))
      : [];
    const newLeagues: League[] = doLeagues
      ? st.leagues.filter((l) => l.seasonId === fromSeasonId).map((l) => ({
          ...l, id: uid(), seasonId: asid, season: activeSeasonObj.name,
          teams: l.teams.map((team) => ({ ...team, id: uid() })), // interne Team-IDs neu; Begegnungen werden geleert
          fixtures: [],
        }))
      : [];
    if (!newTeams.length && !newLeagues.length) return;
    const teams = [...st.teams, ...newTeams];
    const leagues = [...st.leagues, ...newLeagues];
    if (newTeams.length) persist(st, set, LS.teams, teams, (p) => Promise.all(newTeams.map((t) => p.createRecord('teams', t as unknown as ProviderRecord))));
    if (newLeagues.length) persist(st, set, LS.leagues, leagues, (p) => Promise.all(newLeagues.map((l) => p.createRecord('leagues', l as unknown as ProviderRecord))));
    set({ teams, leagues, selectedLeague: 0, selectedTeam: 0 });
  },

  // Archivierte Saison auslagern: zuerst eine frische Sicherung herunterladen, dann die (schweren) Spiele dieser
  // Saison aus der DB entfernen und offloaded=true setzen. Tabellen/Kader/Termine bleiben; Einzelstatistik kommt
  // danach aus dem Snapshot. Per Re-Import vollständig wiederherstellbar.
  offloadSeason(seasonId) {
    const st = get();
    const season = st.seasons.find((s) => s.id === seasonId);
    if (!season || season.status !== 'archived' || season.offloaded) return;
    // Sicherung erzwingen (Snapshot bevorzugt aus dem eingefrorenen Stand des Abschlusses).
    const snapshot = st.seasonSnapshots.find((sn) => sn.seasonId === seasonId) || buildSeasonSnapshot(season, st);
    downloadJson(bundleFilename(season), buildSeasonBundle(season, snapshot, st));
    const purge = st.matches.filter((m) => m.seasonId === seasonId);
    if (!purge.length && season.offloaded) return;
    const matches = st.matches.filter((m) => m.seasonId !== seasonId);
    const seasons = st.seasons.map((s) => s.id === seasonId ? { ...s, offloaded: true } : s);
    if (purge.length) persist(st, set, LS.matches, matches, (p) => Promise.all(purge.map((m) => p.deleteRecord('matches', m.id))));
    persist(st, set, LS.seasons, seasons, (p) => p.updateRecord('seasons', seasonId, { offloaded: true } as unknown as ProviderRecord));
    set({ matches, seasons });
  },

  // Ausgelagerte Saison aus einem Bundle wieder einlesen: fehlende Spiele/Ligen/Teams/Termine (nach id) anlegen,
  // offloaded=false setzen. Idempotent — bereits vorhandene Datensätze werden übersprungen.
  reimportSeason(bundle) {
    const b = bundle as { season?: Season; matches?: Match[]; leagues?: League[]; teams?: Team[]; events?: EventItem[] } | null;
    if (!b || !b.season || !b.season.id) return null;
    const st = get();
    const sid = b.season.id;
    const missing = <T extends { id: string }>(incoming: T[] | undefined, cur: T[]): T[] => {
      const have = new Set(cur.map((x) => x.id));
      return (incoming || []).filter((x) => x && x.id && !have.has(x.id));
    };
    const addMatches = missing(b.matches, st.matches);
    const addLeagues = missing(b.leagues, st.leagues);
    const addTeams = missing(b.teams, st.teams);
    const addEvents = missing(b.events, st.events);
    const matches = [...st.matches, ...addMatches];
    const leagues = [...st.leagues, ...addLeagues];
    const teams = [...st.teams, ...addTeams];
    const events = [...st.events, ...addEvents];
    // Saison ggf. wieder eintragen (falls auch der Season-Datensatz fehlte) + offloaded zurücksetzen.
    let seasons = st.seasons;
    if (!seasons.some((s) => s.id === sid)) seasons = [...seasons, { ...b.season, offloaded: false }];
    else seasons = seasons.map((s) => s.id === sid ? { ...s, offloaded: false } : s);
    if (addMatches.length) persist(st, set, LS.matches, matches, (p) => Promise.all(addMatches.map((m) => p.createRecord('matches', m as unknown as ProviderRecord))));
    if (addLeagues.length) persist(st, set, LS.leagues, leagues, (p) => Promise.all(addLeagues.map((l) => p.createRecord('leagues', l as unknown as ProviderRecord))));
    if (addTeams.length) persist(st, set, LS.teams, teams, (p) => Promise.all(addTeams.map((t) => p.createRecord('teams', t as unknown as ProviderRecord))));
    if (addEvents.length) persist(st, set, LS.events, events, (p) => Promise.all(addEvents.map((e) => p.createRecord('events', e as unknown as ProviderRecord))));
    persist(st, set, LS.seasons, seasons, (p) => p.updateRecord('seasons', sid, { offloaded: false } as unknown as ProviderRecord));
    set({ matches, leagues, teams, events, seasons });
    return { matches: addMatches.length, restored: addLeagues.length + addTeams.length + addEvents.length };
  },

  go(screen) { set({ screen }); },
  openPlayer(id) { set({ selectedPlayerId: id, screen: 'playerDetail' }); },

  setLoginField(key, val) {
    // Ändert der Nutzer E-Mail/Passwort, startet der Login-Flow neu (2FA-Schritt zurücksetzen).
    set((st) => ({ loginForm: { ...st.loginForm, [key]: val, err: '', ...(key === 'code' ? {} : { mfaStep: false, code: '' }) } }));
  },
  // Schnellanmeldung per Konto-Klick — nur im lokalen Demo-Modus (kein Passwort).
  login(id) {
    if (get().pbMode) return; // im echten Vereinsmodus ist Passwort-Login Pflicht
    const acc = get().accounts.find((a) => a.id === id);
    if (!acc || !acc.active) return;
    write(LS.session, id);
    set({ session: id, screen: 'dashboard', loginForm: { email: '', pw: '', code: '', mfaStep: false, err: '' } });
  },
  loginEmail() {
    const st = get();
    const email = st.loginForm.email.trim();
    if (st.pbMode) {
      // Echte Anmeldung über /api/login (serverseitiges 2FA). Bei aktivem 2FA kommt zuerst
      // { ok:false, mfaRequired } — dann blendet die Login-Seite das Code-Feld ein und ruft
      // loginEmail() erneut auf, diesmal mit dem 6-stelligen Code (oder Backup-Code).
      const code = st.loginForm.mfaStep ? st.loginForm.code.trim() : undefined;
      void st.provider.login(email, st.loginForm.pw, code).then((res) => {
        if (!res.ok) {
          // 2FA erforderlich: Code-Feld einblenden. `error` gesetzt = voriger Code war falsch/gesperrt.
          set((s) => ({ loginForm: { ...s.loginForm, mfaStep: true, err: res.error || '' } }));
          return;
        }
        const user = res.user;
        if (!user.active) { // Zusatzabsicherung (Server blockt inaktive bereits).
          void st.provider.logout();
          set((s) => ({ session: null, loginForm: { ...s.loginForm, err: dict().storeMsg.accountDeactivated } }));
          return;
        }
        set({ session: user.id, screen: 'dashboard', loginForm: { email: '', pw: '', code: '', mfaStep: false, err: '' } });
        void applySnapshot(get, set); // Daten + persönliche Einstellungen des Nutzers nachladen
      }).catch((e: unknown) => {
        // Echter Auth-Fehler: server-seitige Meldung (deutsch) anzeigen, sonst generisch.
        const msg = (e as { response?: { message?: string } })?.response?.message;
        set((s) => ({ loginForm: { ...s.loginForm, err: msg || dict().storeMsg.loginFailed } }));
      });
      return;
    }
    // Lokaler Demo-Modus: Konto per E-Mail finden (Passwort beliebig).
    const acc = st.accounts.find((a) => a.email.toLowerCase() === email.toLowerCase() && a.active);
    if (!acc) { set((s) => ({ loginForm: { ...s.loginForm, err: dict().storeMsg.noActiveAccount } })); return; }
    get().login(acc.id);
  },
  logout() {
    if (get().pbMode) { void get().provider.logout(); set({ session: null }); return; }
    write(LS.session, null); set({ session: null });
  },

  setSetting(key, val) {
    set((st) => {
      // Im Vereinsmodus sind die Oberflächen-/Counter-Einstellungen vereinsweit zentral und nur vom
      // Admin änderbar. Gerätelokale Schlüssel (Verbindung, Modus, Geräteart, Dashboard-Ansicht) bleiben frei.
      if (st.provider.mode === 'verein' && !DEVICE_LOCAL_SETTING_KEYS.includes(key)) {
        const isAdmin = st.accounts.find((a) => a.id === st.session)?.role === 'admin';
        if (!isAdmin) return {};
      }
      const settings = { ...st.settings, [key]: val } as Settings;
      if (key === 'appMode') settings.appModeManual = true;
      // colours are stored per light/dark mode; keep the live values + per-mode copies in sync
      const light = st.settings.mode === 'light';
      if (key === 'accent') { if (light) settings.accentLight = val as string; else settings.accentDark = val as string; }
      else if (key === 'scoreColor') { if (light) settings.scoreColorLight = val as string | null; else settings.scoreColorDark = val as string | null; }
      else if (key === 'legColor') { if (light) settings.legColorLight = val as string | null; else settings.legColorDark = val as string | null; }
      else if (key === 'mode') {
        const m = val as 'dark' | 'light';
        settings.accent = (m === 'light' ? settings.accentLight : settings.accentDark) || settings.accent;
        settings.scoreColor = m === 'light' ? settings.scoreColorLight : settings.scoreColorDark;
        settings.legColor = m === 'light' ? settings.legColorLight : settings.legColorDark;
      }
      // Gerätelokale UI-Keys (Eingabe-Modus, Hell/Dunkel, Größen) bleiben auf DIESEM Gerät: eigener
      // localStorage-Key statt vereinsweitem Server-Sync (Mischbetrieb PC/Tablet/Board).
      if (DEVICE_UI_KEYS.includes(key)) writeDevUi(settings);
      if (!(st.provider.mode === 'verein' && DEVICE_LOCAL_SETTING_KEYS.includes(key))) persistSettings(st, set, settings);
      const patch: Partial<AppState> = { settings };
      if (key === 'appMode' && val === 'local' && ['leagues', 'teams', 'users'].includes(st.screen)) patch.screen = 'dashboard';
      return patch;
    });
  },
  chooseMode(mode) {
    // Erst-Start-Wahl festschreiben: setSetting setzt appModeManual=true und persistiert (Local-Mode → LS.settings).
    get().setSetting('appMode', mode);
    set({ needsModeChoice: false });
    // Vereinsmodus braucht den Provider-/Auth-Aufbau aus init() → einmalig neu laden. Lokal ist schon aktiv.
    if (mode === 'verein') location.reload();
  },
  setFKey(i, val) {
    set((st) => {
      const n = Math.max(0, Math.min(180, parseInt(val, 10) || 0));
      const fkeys = [...(st.settings.fkeys || [])];
      fkeys[i] = n;
      const settings = { ...st.settings, fkeys };
      persistSettings(st, set, settings);
      return { settings };
    });
  },
  // Gerätelokale PocketBase-Adresse setzen — bewusst NICHT über persistSettings (kein Server-Sync),
  // sondern eigener localStorage-Key. Der Provider-Wechsel erfolgt beim nächsten Laden (init()).
  setPbUrl(url) {
    const clean = (url || '').trim();
    write(LS.pburl, clean);
    set((st) => ({ settings: { ...st.settings, pbUrl: clean } }));
  },

  // ── Gerätelokale Einstellungen (eigener localStorage-Key, kein Server-Sync): Board-/Kiosk + Namens-Sortierung ──
  setDeviceSetting(key, val) {
    set((st) => {
      const settings = { ...st.settings, [key]: val } as Settings;
      write(LS.device, { kiosk: !!settings.kiosk, boardName: settings.boardName || '', nameOrder: settings.nameOrder || 'first' });
      // Beim Aktivieren direkt ins Counter-Setup; beim Deaktivieren Entsperrung zurücksetzen.
      const patch: Partial<AppState> = { settings };
      if (key === 'kiosk') { patch.kioskUnlocked = false; if (val) patch.screen = 'setup'; }
      return patch;
    });
  },
  // Board-Modus für diese Sitzung entsperren — nur Admin/Kapitän (manageTeams) dürfen das.
  // Meldet den angegebenen Account an (ersetzt das Board-Konto) und gibt die volle App frei.
  async kioskExitLogin(email, pw) {
    const st = get();
    // Nur Admin/Kapitän dürfen den Board-Modus verlassen.
    if (!st.pbMode) {
      // Lokaler/Demo-Pfad: keine echte Anmeldung → Rolle aus der lokalen Kontoliste prüfen (E-Mails hier
      // immer sichtbar), Passwort beliebig.
      const acc = st.accounts.find((a) => a.email.trim().toLowerCase() === email.trim().toLowerCase());
      if (!acc || !acc.active || (acc.role !== 'admin' && acc.role !== 'captain')) return false;
      write(LS.session, acc.id);
      set({ session: acc.id, kioskUnlocked: true, screen: 'dashboard' });
      return true;
    }
    // Server-Pfad: NICHT auf die vorab geladene E-Mail verlassen — ein Board-Konto sieht fremde E-Mails nur
    // bei emailVisibility=true (bei manuell angelegten Admins default aus), sonst wäre acc leer und der Login
    // scheiterte grundlos. Der Provider meldet an, prüft die Rolle am echten Record und stellt die
    // Board-Sitzung bei Ablehnung/Fehler wieder her.
    const user = await st.provider.kioskExitAuth(email.trim(), pw, ['admin', 'captain']);
    if (!user) return false;
    set({ session: user.id, kioskUnlocked: true, screen: 'dashboard' });
    void applySnapshot(get, set);
    return true;
  },
  // „Zurück zum Board": Kapitäns-/Admin-Sitzung beenden → der Board-Rechner meldet sich wieder mit seinem Board-Konto an.
  relockKiosk() { get().logout(); set({ kioskUnlocked: false, screen: 'setup', nextGameDismissed: null, boardForceShow: false }); },

  // ── Daten-Backup (Export/Import aller gespeicherten Daten) ──
  exportData() {
    const data: Record<string, unknown> = {};
    (Object.keys(LS) as (keyof typeof LS)[]).forEach((k) => {
      if (k === 'live') return; // laufendes Spiel nicht sichern
      const raw = localStorage.getItem(LS[k]);
      if (raw != null) { try { data[LS[k]] = JSON.parse(raw); } catch { /* überspringen */ } }
    });
    return JSON.stringify({ app: 'dartszentrale', version: 1, exportedAt: new Date().toISOString(), data }, null, 2);
  },
  importData(json) {
    try {
      const parsed = JSON.parse(json);
      const data = (parsed && typeof parsed === 'object' && 'data' in parsed ? parsed.data : parsed) as Record<string, unknown> | null;
      if (!data || typeof data !== 'object') return false;
      let any = false;
      Object.entries(data).forEach(([k, v]) => {
        if (k.startsWith('darts_') && k !== LS.live) { localStorage.setItem(k, JSON.stringify(v)); any = true; }
      });
      return any;
    } catch { return false; }
  },
  async runBackup() {
    // Auto-Backup nur im Lokalmodus (im Verein liegen die Daten auf dem Server). Postet den vollen
    // localStorage-Export an serve-dist.mjs, der ihn als Datei in backup/ ablegt. Ohne serve-dist
    // (z. B. vite dev/nginx) schlägt der Aufruf fehl → nur Statusmeldung, keine Datei.
    if (get().pbMode) return;
    try {
      const res = await fetch('/admin/backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: get().exportData() });
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      if (res.ok && (data as { ok?: boolean }).ok) {
        const at = (data as { at?: string }).at || new Date().toISOString();
        write(LS.lastBackup, at);
        set({ lastBackupAt: at, backupMsg: `Gesichert: ${(data as { file?: string }).file || 'backup'}` });
      } else {
        set({ backupMsg: dict().storeMsg.backupFailed((data as { error?: string }).error || res.status) });
      }
    } catch {
      set({ backupMsg: dict().storeMsg.backupNotPossible });
    }
  },

  // ── player modal ──
  openAddPlayer() { set({ playerModal: { mode: 'add', id: null, first: '', last: '', short: '', avi: 0 } }); },
  openEditPlayer(id) {
    const p = get().players.find((x) => x.id === id); if (!p) return;
    set({ playerModal: { mode: 'edit', id: p.id, first: firstName(p.name), last: lastName(p.name), short: p.short, avi: p.avi } });
  },
  closePlayerModal() { set({ playerModal: null }); },
  setPlayerField(key, val) { set((st) => st.playerModal ? { playerModal: { ...st.playerModal, [key]: key === 'short' ? val.slice(0, 3) : val } } : {}); },
  cyclePlayerAvi(dir) { set((st) => { if (!st.playerModal) return {}; const n = AVATARS.length; return { playerModal: { ...st.playerModal, avi: ((st.playerModal.avi + dir) % n + n) % n } }; }); },
  savePlayerModal() {
    const m = get().playerModal; if (!m) return;
    const name = `${m.first.trim()} ${m.last.trim()}`.trim(); if (!name) return;
    const short = (m.short.trim() || initials(name)).toUpperCase().slice(0, 3);
    set((st) => {
      let players: Player[];
      if (m.mode === 'add') {
        const rec: Player = { id: uid(), name, short, avi: m.avi };
        players = [...st.players, rec];
        persist(st, set, LS.players, players, (p) => p.createRecord('players', rec as unknown as ProviderRecord));
      } else {
        const rec: Player = { id: m.id!, name, short, avi: m.avi };
        players = st.players.map((p) => p.id === m.id ? { ...p, ...rec } : p);
        // Seed-Spieler existieren nur lokal → keinen Server-Datensatz aktualisieren (sonst 404).
        if (isSeedPlayer(m.id!)) write(LS.players, players);
        else persist(st, set, LS.players, players, (p) => p.updateRecord('players', m.id!, rec as unknown as ProviderRecord));
      }
      return { players, playerModal: null };
    });
  },
  deletePlayer(id) {
    set((st) => {
      // Standard-Spieler (Seed) sind geschützt — nur bearbeitbar, nicht löschbar
      if (st.players.find((p) => p.id === id)?.locked) return {};
      const players = st.players.filter((p) => p.id !== id);
      const teams = st.teams.map((t) => ({ ...t, memberIds: t.memberIds.filter((mid) => mid !== id), captainId: t.captainId === id ? null : t.captainId }));
      persist(st, set, LS.players, players, (p) => p.deleteRecord('players', id));
      // betroffene Mannschaften (Mitglied/Kapitän entfernt) serverseitig nachziehen
      if (st.provider.mode === 'verein') {
        st.teams.forEach((t) => {
          if (!t.memberIds.includes(id) && t.captainId !== id) return;
          const nt = teams.find((x) => x.id === t.id)!;
          void st.provider.updateRecord('teams', nt.id, nt as unknown as ProviderRecord).catch((e) => { console.error('[sync]', e); set({ syncError: dict().storeMsg.errTeamUpdate }); });
        });
      } else {
        write(LS.teams, teams);
      }
      return { players, teams, playerModal: null };
    });
  },

  // ── team modal ──
  selectTeam(i) { set({ selectedTeam: i }); },
  openAddTeam() { set({ teamModal: { mode: 'add', id: null, name: '', league: '', memberIds: [], captainId: null, viceCaptainIds: [], kind: 'league' } }); },
  openEditTeam() {
    const st = get(); const t = st.teams[Math.max(0, Math.min(st.teams.length - 1, st.selectedTeam))]; if (!t) return;
    set({ teamModal: { mode: 'edit', id: t.id, name: t.name, league: t.league || '', memberIds: [...t.memberIds], captainId: t.captainId, viceCaptainIds: [...(t.viceCaptainIds || [])], kind: t.kind === 'cup' ? 'cup' : 'league' } });
  },
  closeTeamModal() { set({ teamModal: null }); },
  setTeamField(key, val) { set((st) => st.teamModal ? { teamModal: { ...st.teamModal, [key]: val } } : {}); },
  setTeamKind(kind) { set((st) => st.teamModal ? { teamModal: { ...st.teamModal, kind } } : {}); },
  toggleTeamMember(pid) {
    set((st) => {
      if (!st.teamModal) return {};
      const has = st.teamModal.memberIds.includes(pid);
      const memberIds = has ? st.teamModal.memberIds.filter((x) => x !== pid) : [...st.teamModal.memberIds, pid];
      let captainId = st.teamModal.captainId;
      if (has && captainId === pid) captainId = null;
      // Beim Entfernen auch aus der Vertretungsliste nehmen.
      const viceCaptainIds = has ? st.teamModal.viceCaptainIds.filter((x) => x !== pid) : st.teamModal.viceCaptainIds;
      return { teamModal: { ...st.teamModal, memberIds, captainId, viceCaptainIds } };
    });
  },
  setTeamCaptain(pid) {
    set((st) => {
      if (!st.teamModal) return {};
      const captainId = st.teamModal.captainId === pid ? null : pid;
      // Kapitän kann nicht gleichzeitig Vertretung sein.
      const viceCaptainIds = st.teamModal.viceCaptainIds.filter((x) => x !== captainId);
      return { teamModal: { ...st.teamModal, captainId, viceCaptainIds } };
    });
  },
  toggleTeamViceCaptain(pid) {
    set((st) => {
      if (!st.teamModal) return {};
      if (pid === st.teamModal.captainId) return {}; // Kapitän nicht als Vertretung
      const cur = st.teamModal.viceCaptainIds;
      if (cur.includes(pid)) return { teamModal: { ...st.teamModal, viceCaptainIds: cur.filter((x) => x !== pid) } };
      if (cur.length >= 2) return {}; // max. 2 Ersatzkapitäne
      return { teamModal: { ...st.teamModal, viceCaptainIds: [...cur, pid] } };
    });
  },
  saveTeamModal() {
    const m = get().teamModal; if (!m) return;
    const name = m.name.trim(); if (!name) return;
    // Sicherheitsnetz: (Name, Art) eindeutig – im Modal bereits blockiert, hier gegen Doppelanlage geschützt.
    const norm = (x: string) => x.replace(/\s+/g, ' ').trim().toLowerCase();
    const dupKind: TeamKind = m.kind;
    if (get().teams.some((t) => t.id !== m.id && norm(t.name) === norm(name) && (t.kind === 'cup' ? 'cup' : 'league') === dupKind)) return;
    set((st) => {
      const captainId = m.captainId && m.memberIds.includes(m.captainId) ? m.captainId : null;
      const viceCaptainIds = m.viceCaptainIds.filter((id) => m.memberIds.includes(id) && id !== captainId).slice(0, 2);
      const existingTeam = st.teams.find((t) => t.id === m.id);
      const rec: Team = { id: m.id || uid(), name, league: m.league.trim(), memberIds: m.memberIds, captainId, viceCaptainIds, kind: m.kind, seasonId: existingTeam?.seasonId ?? st.activeSeasonId ?? undefined };
      let teams: Team[]; let selectedTeam = st.selectedTeam;
      if (m.mode === 'add') { teams = [...st.teams, rec]; selectedTeam = teams.length - 1; }
      else teams = st.teams.map((t) => t.id === m.id ? rec : t);
      persist(st, set, LS.teams, teams, (p) => m.mode === 'add'
        ? p.createRecord('teams', rec as unknown as ProviderRecord)
        : p.updateRecord('teams', rec.id, rec as unknown as ProviderRecord));
      return { teams, teamModal: null, selectedTeam };
    });
  },
  deleteTeam(id) {
    set((st) => {
      const teams = st.teams.filter((t) => t.id !== id);
      persist(st, set, LS.teams, teams, (p) => p.deleteRecord('teams', id));
      return { teams, teamModal: null, selectedTeam: Math.max(0, Math.min(teams.length - 1, st.selectedTeam)) };
    });
  },

  // ── user modal ──
  openAddUser() { set({ userModal: { mode: 'add', id: null, first: '', last: '', email: '', role: 'player', playerId: null, active: true, avi: 0, position: '', password: '', isBoard: false, boardNumber: null, teamIds: [] } }); },
  // Neues Benutzerkonto direkt aus einem Spieler vorbefüllen (Vor-/Nachname, Avatar, Verknüpfung).
  // Nur sinnvoll im Vereinsmodus; E-Mail/Passwort/Rolle ergänzt der Admin im Modal.
  openAddUserForPlayer(playerId) {
    const pl = get().players.find((x) => x.id === playerId); if (!pl) return;
    // Mannschaftszuordnung im Benutzer-Dialog bezieht sich nur auf die AKTIVE Saison (archivierte Kader unangetastet).
    const asid = get().activeSeasonId;
    const teamIds = get().teams.filter((t) => t.memberIds.includes(pl.id) && (t.seasonId == null || t.seasonId === asid)).map((t) => t.id);
    set({ userModal: { mode: 'add', id: null, first: firstName(pl.name), last: lastName(pl.name), email: '', role: 'player', playerId: pl.id, active: true, avi: pl.avi ?? 0, position: '', password: '', isBoard: false, boardNumber: null, teamIds } });
  },
  openEditUser(id) {
    const a = get().accounts.find((x) => x.id === id); if (!a) return;
    const asid = get().activeSeasonId;
    const teamIds = a.playerId ? get().teams.filter((t) => t.memberIds.includes(a.playerId!) && (t.seasonId == null || t.seasonId === asid)).map((t) => t.id) : [];
    set({ userModal: { mode: 'edit', id: a.id, first: a.first, last: a.last, email: a.email, role: a.role, playerId: a.playerId, active: a.active, avi: a.avi, position: a.position || '', password: '', isBoard: !!a.isBoard, boardNumber: a.boardNumber ?? null, teamIds } });
  },
  closeUserModal() { set({ userModal: null }); },
  setUserField(key, val) {
    set((st) => {
      if (!st.userModal) return {};
      const next = { ...st.userModal, [key]: val } as UserModalState;
      // Beim (Ent-)Verknüpfen eines Spielers die Mannschaftsauswahl auf dessen aktuelle Zugehörigkeit zurücksetzen.
      if (key === 'playerId') {
        const pid = val as string | null;
        const asid = st.activeSeasonId;
        next.teamIds = pid ? st.teams.filter((t) => t.memberIds.includes(pid) && (t.seasonId == null || t.seasonId === asid)).map((t) => t.id) : [];
      }
      return { userModal: next };
    });
  },
  toggleUserTeam(teamId) {
    set((st) => {
      if (!st.userModal) return {};
      const cur = st.userModal.teamIds;
      const teamIds = cur.includes(teamId) ? cur.filter((x) => x !== teamId) : [...cur, teamId];
      return { userModal: { ...st.userModal, teamIds } };
    });
  },
  cycleUserAvi(dir) { set((st) => { if (!st.userModal) return {}; const n = AVATARS.length; return { userModal: { ...st.userModal, avi: ((st.userModal.avi + dir) % n + n) % n } }; }); },
  saveUserModal() {
    const m = get().userModal; if (!m) return;
    const first = m.first.trim(), last = m.last.trim();
    const name = `${first} ${last}`.trim(); const email = m.email.trim();
    if (!name || !email) return;
    set((st) => {
      let accounts: Account[];
      // Board-Konten werden NIE mit einem Spieler verknüpft und behalten IMMER die Rolle 'board'.
      const playerId = m.isBoard ? null : m.playerId;
      const role: Role = m.isBoard ? 'board' : m.role;
      if (m.mode === 'add') {
        const rec: Account = { id: uid(), first, last, name, email, role, playerId, active: m.active, avi: m.avi, position: m.position.trim(), last_login: '—', isBoard: m.isBoard, boardNumber: m.boardNumber ?? undefined };
        accounts = [...st.accounts, rec];
        const body = { ...rec, password: m.password } as unknown as ProviderRecord;
        persist(st, set, LS.users, accounts, (p) => p.createRecord('accounts', body));
      } else {
        const fields = { first, last, name, email, role, playerId, active: m.active, avi: m.avi, position: m.position.trim() };
        accounts = st.accounts.map((a) => a.id === m.id ? { ...a, ...fields } : a);
        const body: ProviderRecord = { id: m.id!, ...fields };
        // Passwort NICHT über updateRecord (PB verlangt dort oldPassword/Superuser), sondern über den
        // privilegierten Endpunkt setPassword (Admin darf fremde Konten zurücksetzen).
        const pw = m.password;
        persist(st, set, LS.users, accounts, async (p) => {
          await p.updateRecord('accounts', m.id!, body);
          if (pw) await p.setPassword(m.id!, pw);
        });
      }

      // Mannschaftszuordnung des verknüpften Spielers autoritativ angleichen (nur Rolle Spieler/Kapitän):
      // m.teamIds ist die VOLLSTÄNDIGE Zugehörigkeit → Spieler wird aus nicht gewählten Mannschaften entfernt.
      // Bei Kapitän-Rolle wird er Kapitän jeder gewählten Mannschaft (verdrängt einen bisherigen Kapitän).
      let teams = st.teams;
      if (!m.isBoard && playerId && (role === 'player' || role === 'captain')) {
        const sel = new Set(m.teamIds);
        const asid = st.activeSeasonId;
        teams = st.teams.map((t) => {
          // Nur Mannschaften der aktiven Saison angleichen — archivierte Kader bleiben unangetastet.
          if (t.seasonId != null && t.seasonId !== asid) return t;
          const inSel = sel.has(t.id);
          const wasMember = t.memberIds.includes(playerId);
          if (!inSel && !wasMember) return t; // unbeteiligt → unverändert
          const memberIds = inSel
            ? (wasMember ? t.memberIds : [...t.memberIds, playerId])
            : t.memberIds.filter((x) => x !== playerId);
          let captainId = t.captainId;
          if (inSel && role === 'captain') captainId = playerId;
          else if (captainId === playerId) captainId = null; // abgewählt oder zu 'player' zurückgestuft
          let viceCaptainIds = t.viceCaptainIds;
          if (viceCaptainIds && (!inSel || captainId === playerId)) viceCaptainIds = viceCaptainIds.filter((x) => x !== playerId);
          return { ...t, memberIds, captainId, viceCaptainIds };
        });
        const changed = teams.filter((t) => !st.teams.includes(t));
        if (changed.length) {
          persist(st, set, LS.teams, teams, (p) => Promise.all(changed.map((t) => p.updateRecord('teams', t.id, t as unknown as ProviderRecord))));
        }
      }
      return { accounts, teams, userModal: null };
    });
  },
  deleteUser(id) {
    set((st) => {
      const accounts = st.accounts.filter((a) => a.id !== id);
      persist(st, set, LS.users, accounts, (p) => p.deleteRecord('accounts', id));
      return { accounts, userModal: null };
    });
  },
  async changeOwnPassword(newPassword) {
    const st = get();
    if (st.provider.mode !== 'verein') { set({ syncError: dict().storeMsg.pwVereinOnly }); return false; }
    if (!st.session) { set({ syncError: dict().storeMsg.notLoggedIn }); return false; }
    if (!newPassword || newPassword.length < 8) { set({ syncError: dict().storeMsg.pwMin8 }); return false; }
    try {
      await st.provider.setPassword(st.session, newPassword);
      // setPassword erneuert den tokenKey → die aktuelle Sitzung würde sonst ungültig. Nahtlos neu anmelden.
      const me = st.accounts.find((a) => a.id === st.session);
      if (me?.email) { try { await st.provider.login(me.email, newPassword); } catch { /* nicht kritisch – ggf. neu anmelden */ } }
      return true;
    } catch (e) { console.error('[pw]', e); set({ syncError: dict().storeMsg.pwChangeFailed }); return false; }
  },
  loadTwoFAAdminList() {
    const st = get();
    if (st.provider.mode !== 'verein') { set({ twoFAUserIds: [] }); return; }
    // Nur Admins dürfen die Liste abrufen (Endpunkt ist admin-gated); für andere Rollen gar nicht erst versuchen.
    if (st.accounts.find((a) => a.id === st.session)?.role !== 'admin') { set({ twoFAUserIds: [] }); return; }
    void st.provider.twoFactorAdminList().then((ids) => set({ twoFAUserIds: ids })).catch(() => { /* Endpunkt fehlt (Altinstanz) → Spalte bleibt leer */ });
  },
  async resetUserTwoFA(userId) {
    const st = get();
    if (st.provider.mode !== 'verein') return false;
    try {
      await st.provider.twoFactorAdminReset(userId);
      set((s) => ({ twoFAUserIds: s.twoFAUserIds.filter((id) => id !== userId) }));
      return true;
    } catch (e) { console.error('[2fa-reset]', e); set({ syncError: dict().storeMsg.twoFAResetFailed }); return false; }
  },
  toggleUserActive(id) {
    set((st) => {
      const accounts = st.accounts.map((a) => a.id === id ? { ...a, active: !a.active } : a);
      const next = accounts.find((a) => a.id === id);
      persist(st, set, LS.users, accounts, (p) => p.updateRecord('accounts', id, { active: !!next?.active } as ProviderRecord));
      return { accounts };
    });
  },
  async createBoardAccounts(count, password) {
    const st = get();
    if (st.provider.mode !== 'verein') { set({ syncError: dict().storeMsg.boardsVereinOnly }); return; }
    const n = Math.max(1, Math.min(32, count | 0));
    const have = new Set(st.accounts.filter((a) => a.isBoard && a.boardNumber != null).map((a) => a.boardNumber));
    let created = 0;
    for (let i = 1; i <= n; i++) {
      if (have.has(i)) continue;
      const body = {
        email: `board${i}@board.local`, password,
        name: `Board ${i}`, first: 'Board', last: String(i), role: 'board', playerId: null,
        position: 'Board-Rechner', active: true, avi: i % 8, isBoard: true, boardNumber: i, last_login: '—',
      };
      try { await st.provider.createRecord('accounts', body as unknown as ProviderRecord); created++; }
      catch (e) { console.error('[board]', e); set({ syncError: `Board ${i} konnte nicht angelegt werden (evtl. E-Mail schon vergeben).` }); }
    }
    if (created > 0) void applySnapshot(get, set);
  },
  async uploadPhoto(kind, id, file) {
    const st = get();
    if (st.provider.mode !== 'verein') { set({ syncError: dict().storeMsg.photosVereinOnly }); return; }
    const coll = kind === 'player' ? 'players' : 'accounts';
    try {
      const blob = await downscaleSquare(file, 256); // klein halten: zentriertes 256er-Quadrat
      await st.provider.uploadPhoto(coll, id, blob);
      await applySnapshot(get, set);
    } catch (e) { console.error('[photo]', e); set({ syncError: dict().storeMsg.errPhotoSave }); }
  },
  async clearPhoto(kind, id) {
    const st = get();
    if (st.provider.mode !== 'verein') return;
    const coll = kind === 'player' ? 'players' : 'accounts';
    try { await st.provider.clearPhoto(coll, id); await applySnapshot(get, set); }
    catch (e) { console.error('[photo]', e); set({ syncError: dict().storeMsg.errPhotoRemove }); }
  },

  // ── league modal ──
  selectLeague(i) { set({ selectedLeague: i }); },
  // Ligen per Drag & Drop umsortieren. `orderedVisibleIds` = neue Reihenfolge der aktuell sichtbaren
  // (Saison-gefilterten) Ligen. Die sichtbaren Ligen werden in dieser Reihenfolge an ihre bisherigen
  // Plätze in st.leagues gesetzt (nicht sichtbare bleiben unberührt); anschließend bekommt jede Liga
  // ihren globalen Index als `order` → nach Reload/Snapshot reproduziert das Sortieren dieselbe Anordnung.
  // Vereinsweit persistiert (nur geänderte Datensätze), damit alle Geräte dieselbe Reihenfolge sehen.
  reorderLeagues(orderedVisibleIds) {
    const st = get();
    const visible = new Set(orderedVisibleIds);
    const ordered = orderedVisibleIds.map((id) => st.leagues.find((l) => l.id === id)).filter(Boolean) as League[];
    if (ordered.length !== orderedVisibleIds.length) return; // unbekannte id → Abbruch
    let vi = 0;
    const rebuilt = st.leagues.map((l) => (visible.has(l.id) ? ordered[vi++] : l));
    const changed: League[] = [];
    const leagues = rebuilt.map((l, i) => {
      if (l.order === i) return l;
      const nl: League = { ...l, order: i };
      changed.push(nl);
      return nl;
    });
    if (!changed.length) return;
    // Auswahl an die aktuell markierte Liga heften (Index bezieht sich auf die sichtbare Liste).
    const selId = currentLeague(st)?.id;
    const selectedLeague = selId ? Math.max(0, orderedVisibleIds.indexOf(selId)) : st.selectedLeague;
    set({ leagues, selectedLeague });
    persist(st, set, LS.leagues, leagues, (p) => Promise.all(changed.map((l) => p.updateRecord('leagues', l.id, l as unknown as ProviderRecord))));
  },
  openAddLeague() { set({ leagueModal: { mode: 'add', id: null, name: '', season: '2025/26', teams: [], singlesCount: 4, doublesCount: 2, format: null, kind: 'league', nuligaUrl: '' } }); },
  openEditLeague() {
    const st = get(); const lg = currentLeague(st); if (!lg) return;
    set({ leagueModal: { mode: 'edit', id: lg.id, name: lg.name, season: lg.season || '', teams: lg.teams.map((t) => ({ ...t })), singlesCount: lg.singlesCount ?? 4, doublesCount: lg.doublesCount ?? 2, format: lg.format ? lg.format.map((s) => ({ ...s })) : null, kind: lg.kind === 'cup' ? 'cup' : 'league', nuligaUrl: lg.nuligaUrl || '' } });
  },
  closeLeagueModal() { set({ leagueModal: null }); },
  setLeagueField(key, val) { set((st) => st.leagueModal ? { leagueModal: { ...st.leagueModal, [key]: val } } : {}); },
  setLeagueCount(key, val) { set((st) => st.leagueModal ? { leagueModal: { ...st.leagueModal, [key]: Math.max(0, Math.min(12, val | 0)) } } : {}); },
  setLeagueFormatPreset(key) {
    set((st) => {
      if (!st.leagueModal) return {};
      if (key === 'custom') return { leagueModal: { ...st.leagueModal, format: null } };
      const preset = LEAGUE_FORMAT_PRESETS.find((p) => p.key === key);
      return preset ? { leagueModal: { ...st.leagueModal, format: preset.segments.map((s) => ({ ...s })) } } : {};
    });
  },
  addLeagueTeam() { set((st) => st.leagueModal ? { leagueModal: { ...st.leagueModal, teams: [...st.leagueModal.teams, { id: uid(), name: '', own: false }] } } : {}); },
  setLeagueTeamName(id, val) { set((st) => st.leagueModal ? { leagueModal: { ...st.leagueModal, teams: st.leagueModal.teams.map((t) => t.id === id ? { ...t, name: val } : t) } } : {}); },
  toggleLeagueTeamOwn(id) { set((st) => st.leagueModal ? { leagueModal: { ...st.leagueModal, teams: st.leagueModal.teams.map((t) => t.id === id ? { ...t, own: !t.own } : t) } } : {}); },
  removeLeagueTeam(id) { set((st) => st.leagueModal ? { leagueModal: { ...st.leagueModal, teams: st.leagueModal.teams.filter((t) => t.id !== id) } } : {}); },
  saveLeagueModal() {
    const m = get().leagueModal; if (!m) return;
    const name = m.name.trim(); if (!name) return;
    const teams = m.teams.map((t) => ({ id: t.id, name: t.name.trim(), own: !!t.own })).filter((t) => t.name);
    set((st) => {
      const existing = st.leagues.find((l) => l.id === m.id);
      // Format: bevorzugt geordnete Segmente (Preset); sonst einfache Einzel/Doppel-Zähler.
      const segs = m.format && m.format.length ? m.format : [{ kind: 'singles' as const, count: m.singlesCount }, { kind: 'doubles' as const, count: m.doublesCount }];
      const rec: League = { id: m.id || uid(), name, season: m.season.trim(), seasonId: existing?.seasonId ?? st.activeSeasonId ?? undefined, teams, fixtures: existing ? existing.fixtures : [], format: m.format && m.format.length ? m.format : undefined, singlesCount: segTotal(segs, 'singles'), doublesCount: segTotal(segs, 'doubles'), kind: m.kind, nuligaUrl: m.nuligaUrl.trim() || undefined };
      let leagues: League[]; let selectedLeague = st.selectedLeague;
      // Auswahl ist ein Index in die SAISON-GEFILTERTE Anzeige: die neue Liga über ihre id in dieser Liste finden.
      if (m.mode === 'add') { leagues = [...st.leagues, rec]; selectedLeague = Math.max(0, inSeason(leagues, st.viewSeasonId).findIndex((l) => l.id === rec.id)); }
      else leagues = st.leagues.map((l) => l.id === m.id ? rec : l);
      persist(st, set, LS.leagues, leagues, (p) => m.mode === 'add'
        ? p.createRecord('leagues', rec as unknown as ProviderRecord)
        : p.updateRecord('leagues', rec.id, rec as unknown as ProviderRecord));
      return { leagues, leagueModal: null, selectedLeague };
    });
  },
  deleteLeague(id) {
    set((st) => {
      const removed = st.leagues.find((l) => l.id === id);
      const fixIds = new Set((removed?.fixtures || []).map((f) => f.id));
      const leagues = st.leagues.filter((l) => l.id !== id);
      persist(st, set, LS.leagues, leagues, (p) => p.deleteRecord('leagues', id));
      // Verknüpfte Spieltag-Termine dieser Liga ebenfalls aus dem Kalender entfernen (keine Waisen).
      const orphans = st.events.filter((e) => e.fixtureId && fixIds.has(e.fixtureId));
      let events = st.events;
      if (orphans.length) {
        const orphanIds = new Set(orphans.map((e) => e.id));
        events = st.events.filter((e) => !orphanIds.has(e.id));
        persist(st, set, LS.events, events, (p) => Promise.all(orphans.map((e) => p.deleteRecord('events', e.id))));
      }
      return { leagues, events, leagueModal: null, selectedLeague: Math.max(0, Math.min(inSeason(leagues, st.viewSeasonId).length - 1, st.selectedLeague)) };
    });
  },

  // ── Freundschaftsspiel (eigene Mannschaft vs. frei wählbarer Gegner; eigener „Freundschaft"-Wettbewerb) ──
  openFriendly() {
    const st = get();
    const asid = st.activeSeasonId ?? undefined;
    const inAct = <T extends { seasonId?: string }>(x: T) => (x.seasonId ?? asid) === asid;
    const ownNames = st.teams.filter(inAct).map((t) => t.name);
    const fallback = st.leagues.filter(inAct).flatMap((l) => l.teams.filter((t) => t.own).map((t) => t.name));
    const first = ownNames[0] || fallback[0] || '';
    const d = new Date(); d.setDate(d.getDate() + 7);
    set({ friendlyModal: { ownTeam: first, opponent: '', homeIsOwn: true, date: d.toISOString().slice(0, 10), time: '', loc: '' } });
  },
  closeFriendly() { set({ friendlyModal: null }); },
  setFriendlyField(key, val) { set((st) => st.friendlyModal ? { friendlyModal: { ...st.friendlyModal, [key]: val } as FriendlyModalState } : {}); },
  saveFriendly() {
    const m = get().friendlyModal; if (!m) return;
    const own = m.ownTeam.trim(); const opp = m.opponent.trim();
    if (!own || !opp) return;
    set((st) => {
      const asid = st.activeSeasonId ?? undefined;
      const inAct = (l: League) => (l.seasonId ?? asid) === asid;
      let league = st.leagues.find((l) => l.kind === 'friendly' && inAct(l)) || null;
      const seasonLabel = st.seasons.find((x) => x.id === asid)?.name || '';
      const findTeam = (name: string, isOwn: boolean) =>
        league?.teams.find((t) => t.name.toLowerCase() === name.toLowerCase() && !!t.own === isOwn) || { id: uid(), name, own: isOwn };
      const ownT = findTeam(own, true);
      const oppT = findTeam(opp, false);
      const homeId = m.homeIsOwn ? ownT.id : oppT.id;
      const awayId = m.homeIsOwn ? oppT.id : ownT.id;
      const fx: Fixture = { id: uid(), homeId, awayId, date: m.date, time: m.time.trim() || undefined, loc: m.loc.trim() || undefined, played: false, hs: '', as: '' };
      let isNew = false;
      if (league) {
        const teams = [...league.teams];
        if (!teams.some((t) => t.id === ownT.id)) teams.push(ownT);
        if (!teams.some((t) => t.id === oppT.id)) teams.push(oppT);
        league = { ...league, teams, fixtures: [...league.fixtures, fx] };
      } else {
        isNew = true;
        league = { id: uid(), name: 'Freundschaftsspiele', season: seasonLabel, seasonId: asid, kind: 'friendly', teams: [ownT, oppT], fixtures: [fx] };
      }
      const lg = league;
      const leagues = isNew ? [...st.leagues, lg] : st.leagues.map((l) => l.id === lg.id ? lg : l);
      persist(st, set, LS.leagues, leagues, (p) => isNew
        ? p.createRecord('leagues', lg as unknown as ProviderRecord)
        : p.updateRecord('leagues', lg.id, lg as unknown as ProviderRecord));
      // Kalender-Termin (Typ „Freundschaft") erzeugen.
      const ev = fixtureEvent(lg, fx);
      const events = [...st.events, ev];
      persist(st, set, LS.events, events, (p) => p.createRecord('events', ev as unknown as ProviderRecord));
      // die neue Freundschaft im Ligen-Screen auswählen.
      const view = inSeason(leagues, st.viewSeasonId);
      const selIdx = view.findIndex((l) => l.id === lg.id);
      return { leagues, events, friendlyModal: null, selectedLeague: selIdx >= 0 ? selIdx : st.selectedLeague };
    });
  },

  // ── Mannschaftsaufstellung (frei konfigurierbar pro Begegnung, nur eigene Mannschaft) ──
  openLineup(fixtureId) {
    const st = get();
    const lg = currentLeague(st); if (!lg) return;
    const fx = lg.fixtures.find((f) => f.id === fixtureId); if (!fx) return;
    const norm = (x: string) => (x || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const home = lg.teams.find((t) => t.id === fx.homeId) || null;
    const away = lg.teams.find((t) => t.id === fx.awayId) || null;
    const ownTeam = (home && home.own) ? home : (away && away.own) ? away : null;
    if (!ownTeam) return; // Aufstellung gibt es nur für eigene Begegnungen
    const ownIsHome = !!(home && home.own);
    const opp = ownIsHome ? away : home;
    // Kader der eigenen Mannschaft über Namensabgleich; Fallback: alle Spieler.
    const team = st.teams.find((t) => norm(t.name) === norm(ownTeam.name));
    let rosterIds = team ? team.memberIds.slice() : [];
    if (rosterIds.length === 0) rosterIds = st.players.map((p) => p.id);
    const ex = fx.lineup;
    let positions: LineupPosition[];
    if (ex?.positions?.length) {
      positions = ex.positions.map((p) => ({ id: p.id || uid(), kind: p.kind, playerIds: p.kind === 'double' ? [p.playerIds[0] || '', p.playerIds[1] || ''] : [p.playerIds[0] || ''], board: p.board || '', result: p.result }));
    } else {
      // Noch keine Aufstellung → aus dem Liga-Format als Vorlage vorbelegen (frei editierbar).
      positions = [];
      for (const seg of leagueSegments(lg)) {
        for (let k = 0; k < seg.count; k++) {
          positions.push({ id: uid(), kind: seg.kind === 'doubles' ? 'double' : 'single', playerIds: seg.kind === 'doubles' ? ['', ''] : [''], board: '' });
        }
      }
    }
    const substitutes = (ex?.substitutes || []).filter((id) => rosterIds.includes(id));
    set({ lineupModal: { leagueId: lg.id, fixtureId, ownTeamName: ownTeam.name, oppName: opp ? opp.name : '—', ownIsHome, rosterIds, positions, substitutes, boardLive: !!fx.boardLive } });
  },
  openLineupAt(leagueIndex, fixtureId) {
    const i = Math.max(0, Math.min(get().leagues.length - 1, leagueIndex));
    set({ selectedLeague: i });
    get().openLineup(fixtureId); // liest selectedLeague (gerade gesetzt) und öffnet das Modal
  },
  closeLineup() { set({ lineupModal: null }); },
  toggleLineupBoardLive() { set((st) => st.lineupModal ? { lineupModal: { ...st.lineupModal, boardLive: !st.lineupModal.boardLive } } : {}); },
  addLineupPosition(kind) {
    set((st) => st.lineupModal ? { lineupModal: { ...st.lineupModal, positions: [...st.lineupModal.positions, { id: uid(), kind, playerIds: kind === 'double' ? ['', ''] : [''], board: '' }] } } : {});
  },
  removeLineupPosition(id) {
    set((st) => st.lineupModal ? { lineupModal: { ...st.lineupModal, positions: st.lineupModal.positions.filter((p) => p.id !== id) } } : {});
  },
  moveLineupPosition(id, dir) {
    set((st) => {
      const m = st.lineupModal; if (!m) return {};
      const arr = m.positions.slice();
      const i = arr.findIndex((p) => p.id === id); const j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return {};
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { lineupModal: { ...m, positions: arr } };
    });
  },
  setLineupPositionPlayer(id, pos, playerId) {
    set((st) => {
      const m = st.lineupModal; if (!m) return {};
      // Ein Spieler darf MEHRERE Spiele bestreiten (z. B. ein Einzel UND ein Doppel) – daher NICHT
      // aus anderen Positionen entfernen. Einzige Grenzen: nicht zweimal derselbe Spieler im selben
      // Doppel, und beim Aufstellen wird er aus der Ersatzliste genommen.
      const positions = m.positions.map((p) => ({ ...p, playerIds: p.playerIds.slice() }));
      const substitutes = playerId ? m.substitutes.filter((x) => x !== playerId) : m.substitutes.slice();
      const target = positions.find((p) => p.id === id);
      if (target) {
        if (playerId) target.playerIds = target.playerIds.map((x, i) => (i !== pos && x === playerId ? '' : x));
        target.playerIds[pos] = playerId;
      }
      return { lineupModal: { ...m, positions, substitutes } };
    });
  },
  setLineupPositionBoard(id, board) {
    set((st) => st.lineupModal ? { lineupModal: { ...st.lineupModal, positions: st.lineupModal.positions.map((p) => p.id === id ? { ...p, board } : p) } } : {});
  },
  toggleSubstitute(playerId) {
    set((st) => {
      const m = st.lineupModal; if (!m) return {};
      if (m.substitutes.includes(playerId)) {
        return { lineupModal: { ...m, substitutes: m.substitutes.filter((id) => id !== playerId) } };
      }
      // Als Ersatz markieren → aus allen Positionen entfernen, hinten an die Ersatzliste (E…) anhängen.
      const positions = m.positions.map((p) => ({ ...p, playerIds: p.playerIds.map((id) => id === playerId ? '' : id) }));
      return { lineupModal: { ...m, positions, substitutes: [...m.substitutes, playerId] } };
    });
  },
  moveSubstitute(playerId, dir) {
    set((st) => {
      const m = st.lineupModal; if (!m) return {};
      const arr = m.substitutes.slice();
      const i = arr.indexOf(playerId); const j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return {};
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { lineupModal: { ...m, substitutes: arr } };
    });
  },
  saveLineup() {
    const m = get().lineupModal; if (!m) return;
    const positions: LineupPosition[] = m.positions.map((p) => ({ id: p.id, kind: p.kind, playerIds: p.playerIds.filter(Boolean), board: (p.board || '').trim() || undefined, ...(p.result ? { result: p.result } : {}) }));
    const lineup: FixtureLineup = { positions, substitutes: m.substitutes.slice() };
    set((st) => {
      let changed: League | null = null;
      const leagues = st.leagues.map((l) => {
        if (l.id !== m.leagueId) return l;
        changed = { ...l, fixtures: l.fixtures.map((f) => f.id === m.fixtureId ? { ...f, lineup, boardLive: m.boardLive } : f) };
        return changed;
      });
      if (changed) persist(st, set, LS.leagues, leagues, (p) => p.updateRecord('leagues', changed!.id, changed! as unknown as ProviderRecord));
      return { leagues, lineupModal: null };
    });
  },

  // ── Brett-für-Brett-Ergebniserfassung (Spielbericht) ──
  openResult(fixtureId) {
    const st = get();
    const lg = currentLeague(st); if (!lg) return;
    const fx = lg.fixtures.find((f) => f.id === fixtureId); if (!fx || !fx.lineup?.positions?.length) return;
    const home = lg.teams.find((t) => t.id === fx.homeId) || null;
    const away = lg.teams.find((t) => t.id === fx.awayId) || null;
    const ownIsHome = !!(home && home.own);
    const ownTeam = ownIsHome ? home : (away && away.own ? away : null);
    if (!ownTeam) return;
    const opp = ownIsHome ? away : home;
    const nameById = (id: string) => st.players.find((p) => p.id === id)?.name || '';
    // Neuestes am Board gespieltes (verknüpftes) Match je Position → für die Auto-Vorbefüllung.
    const linkedMatch = (positionId: string): Match | null => {
      const ms = st.matches.filter((mm) => mm.fixtureId === fixtureId && mm.positionId === positionId && (mm.perPlayer?.length || 0) >= 2);
      if (!ms.length) return null;
      return ms.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
    };
    let sNo = 0, dNo = 0;
    const rows: ResultRow[] = fx.lineup.positions.map((p) => {
      const label = p.kind === 'single' ? `Einzel ${++sNo}` : `Doppel ${++dNo}`;
      const names = p.playerIds.map(nameById).filter(Boolean);
      if (p.result) {
        return { id: p.id, kind: p.kind, label, playerNames: names, won: p.result.won, ownLegs: p.result.ownLegs != null ? String(p.result.ownLegs) : '', oppLegs: p.result.oppLegs != null ? String(p.result.oppLegs) : '', auto: false };
      }
      // Noch nicht bestätigt → aus dem verknüpften Board-Match vorbefüllen (Slot 0 = eigene Seite).
      const mt = linkedMatch(p.id);
      if (mt) {
        const own = mt.perPlayer[0], opp = mt.perPlayer[1];
        return { id: p.id, kind: p.kind, label, playerNames: names, won: mt.winnerName === own.name ? 'own' : 'opp', ownLegs: String(own.legsWon ?? ''), oppLegs: String(opp.legsWon ?? ''), auto: true };
      }
      return { id: p.id, kind: p.kind, label, playerNames: names, won: null, ownLegs: '', oppLegs: '', auto: false };
    });
    set({ resultModal: { leagueId: lg.id, fixtureId, ownTeamName: ownTeam.name, oppName: opp ? opp.name : '—', ownIsHome, rows } });
  },
  closeResult() { set({ resultModal: null }); },
  setResultWon(id, won) {
    set((st) => st.resultModal ? { resultModal: { ...st.resultModal, rows: st.resultModal.rows.map((r) => r.id === id ? { ...r, won: r.won === won ? null : won, auto: false } : r) } } : {});
  },
  setResultLeg(id, side, val) {
    const v = val.replace(/[^0-9]/g, '').slice(0, 2);
    set((st) => st.resultModal ? { resultModal: { ...st.resultModal, rows: st.resultModal.rows.map((r) => {
      if (r.id !== id) return r;
      const ownLegs = side === 'own' ? v : r.ownLegs;
      const oppLegs = side === 'opp' ? v : r.oppLegs;
      // Brett-Punkt automatisch aus den Legs ableiten: mehr Legs = Sieg dieser Seite (= 1 Punkt fürs Team).
      // So ergibt sich aus den Leg-Eingaben der Endstand und daraus die Tabellenpunkte – ohne extra Klick.
      const o = parseInt(ownLegs, 10); const p = parseInt(oppLegs, 10);
      let won = r.won;
      if (!isNaN(o) && !isNaN(p) && o !== p) won = o > p ? 'own' : 'opp';
      else if (ownLegs === '' && oppLegs === '') won = null; // beide geleert → Brett wieder offen
      return { ...r, ownLegs, oppLegs, won, auto: false };
    }) } } : {});
  },
  saveResult() {
    const m = get().resultModal; if (!m) return;
    const ownWins = m.rows.filter((r) => r.won === 'own').length;
    const oppWins = m.rows.filter((r) => r.won === 'opp').length;
    const played = ownWins + oppWins > 0;
    const hsVal = m.ownIsHome ? ownWins : oppWins;       // gewonnene Spiele (Bretter) → Punkte + Differenz
    const asVal = m.ownIsHome ? oppWins : ownWins;
    set((st) => {
      let changed: League | null = null;
      const leagues = st.leagues.map((l) => {
        if (l.id !== m.leagueId) return l;
        const fixtures = l.fixtures.map((f) => {
          if (f.id !== m.fixtureId || !f.lineup) return f;
          const positions = f.lineup.positions.map((p) => {
            const row = m.rows.find((r) => r.id === p.id);
            if (!row || !row.won) { const { result: _omit, ...rest } = p; void _omit; return rest; }
            return { ...p, result: { won: row.won } };
          });
          // Ergebnis stammt vom Board-Counter → autoritativ ('counter'). Eine evtl. offene nuLiga-Abweichung
          // gilt damit als (neu) entschieden und wird entfernt; ein späterer nuLiga-Abruf erkennt sie ggf. neu.
          const nf: Fixture = { ...f, lineup: { ...f.lineup, positions }, played, hs: played ? hsVal : ('' as const), as: played ? asVal : ('' as const), resultSource: played ? 'counter' : undefined };
          if (nf.nuligaConflict) delete nf.nuligaConflict;
          return nf;
        });
        changed = { ...l, fixtures };
        return changed;
      });
      if (changed) persist(st, set, LS.leagues, leagues, (p) => p.updateRecord('leagues', changed!.id, changed! as unknown as ProviderRecord));
      return { leagues, resultModal: null };
    });
  },

  // ── Spielplan-Import (CSV) ──
  openImport() { set({ importOpen: true }); },
  closeImport() { set({ importOpen: false }); },
  importSchedule(parsed) {
    const st = get();
    // Saison-Abgleich tolerant: „2025/26", „2025/2026", „Saison 2025/26" gelten als dieselbe Saison →
    // Re-Import trifft die bestehende Saison, statt eine zweite anzulegen (und dabei manuelle Termine zu
    // archivieren). Siehe seasonKey in lib/scheduleImport.ts.
    const nrm = seasonKey;

    // ── 1) Saison(en) aus der CSV erkennen: bestehende per Name finden, fehlende anlegen. ──
    const seasons: Season[] = st.seasons.map((x) => ({ ...x }));
    const seasonByName = new Map(seasons.map((se) => [nrm(se.name), se]));
    const seasonNew = new Set<string>();      // neu angelegte Saisons → createRecord
    const seasonChanged = new Set<string>();  // neue oder statusgeänderte Saisons → Persistenz
    // Nur „echte" Saison-Werte („—" = keine Saison-Spalte in der CSV → ignorieren, keine Junk-Saison anlegen).
    const realNames = [...new Set(parsed.groups.map((g) => g.season))].filter((n) => n && n !== '—');
    for (const name of realNames) {
      if (!seasonByName.has(nrm(name))) {
        const se: Season = { id: uid(), name, status: 'archived' }; // finaler Status unten
        seasons.push(se); seasonByName.set(nrm(name), se); seasonNew.add(se.id); seasonChanged.add(se.id);
      }
    }
    // Primär-Saison: die CSV-Saison mit den meisten Wettbewerben; fehlt eine Saison-Spalte → aktive Saison beibehalten.
    const cnt = new Map<string, number>();
    parsed.groups.forEach((g) => cnt.set(nrm(g.season), (cnt.get(nrm(g.season)) || 0) + 1));
    const primaryName = realNames.slice().sort((a, b) => (cnt.get(nrm(b)) || 0) - (cnt.get(nrm(a)) || 0))[0];
    const primary = primaryName ? seasonByName.get(nrm(primaryName))! : (st.seasons.find((s) => s.id === st.activeSeasonId) || seasons[0]);
    if (!primary) return { leaguesNew: 0, leaguesExisting: 0, teamsNew: 0, ownTeamsNew: 0, fixturesNew: 0, resultsSet: 0, eventsNew: 0, skipped: parsed.skipped };
    // Aktive Saison auf die (Primär-)CSV-Saison umstellen (nur wenn eine echte CSV-Saison erkannt wurde);
    // jede andere bisher aktive → archiviert (bleibt erhalten).
    if (primaryName) {
      for (const se of seasons) {
        if (se.id === primary.id) { if (se.status !== 'active') { se.status = 'active'; seasonChanged.add(se.id); } }
        else if (se.status === 'active') { se.status = 'archived'; seasonChanged.add(se.id); }
      }
    }
    const activeSeasonId = primary.id;
    const targetIds = new Set([primary.id, ...realNames.map((n) => seasonByName.get(nrm(n))!.id)]);
    const seasonIdFor = (seasonText: string) => (seasonByName.get(nrm(seasonText)) || primary).id;

    // ── 2) Merge: Basis = bestehende Ligen/Teams/Termine der Ziel-Saison(en); alles andere unberührt. ──
    const inTarget = <T extends { seasonId?: string }>(x: T) => targetIds.has(x.seasonId ?? activeSeasonId);
    const otherLeagues = st.leagues.filter((l) => !inTarget(l));
    const otherTeams = st.teams.filter((t) => !inTarget(t));
    const otherEvents = st.events.filter((e) => !inTarget(e));
    const baseLeagues = st.leagues.filter(inTarget);
    const baseTeams = st.teams.filter(inTarget);
    const baseEvents = st.events.filter(inTarget);

    const merged = mergeSchedule(baseLeagues, parsed);
    const touched = merged.touched; const counts = merged.counts;
    // Jede gemergte Liga der passenden CSV-Saison zuordnen (Liga-Saison-Text → aufgelöste seasonId).
    const seasonLeagues = merged.leagues.map((l) => (l.seasonId && targetIds.has(l.seasonId)) ? l : { ...l, seasonId: seasonIdFor(l.season) });
    const leagues = [...otherLeagues, ...seasonLeagues];
    // Eigene Mannschaften ableiten (Kader leer); deriveOwnTeams setzt Art + Saison der Quell-Liga. Dedup gegen Ziel-Saison.
    const newTeams = deriveOwnTeams(seasonLeagues, baseTeams);
    counts.ownTeamsNew = newTeams.length;
    const teams = newTeams.length ? [...otherTeams, ...baseTeams, ...newTeams] : st.teams;
    // Kalender-Termine für eigene Begegnungen ableiten – verknüpft per fixtureId, idempotent.
    const evByFixture = new Map(baseEvents.filter((e) => e.fixtureId).map((e) => [e.fixtureId as string, e]));
    const newEvents: EventItem[] = []; const updatedEvents: EventItem[] = [];
    for (const lg of seasonLeagues) {
      for (const fx of lg.fixtures) {
        if (!isOwnFixture(lg, fx)) continue;
        const prev = evByFixture.get(fx.id);
        const ev0 = fixtureEvent(lg, fx, prev);
        const ev = ev0.seasonId ? ev0 : { ...ev0, seasonId: lg.seasonId };
        if (!prev) newEvents.push(ev);
        else if (prev.date !== ev.date || prev.title !== ev.title) updatedEvents.push(ev);
      }
    }
    counts.eventsNew = newEvents.length;
    const updById = new Map(updatedEvents.map((e) => [e.id, e]));
    const events = (newEvents.length || updatedEvents.length)
      ? [...otherEvents, ...baseEvents.map((e) => updById.get(e.id) || e), ...newEvents]
      : st.events;

    const changedSeasonRecs = seasons.filter((se) => seasonChanged.has(se.id));
    if (st.provider.mode === 'verein') {
      // Saisons zuerst (Status/Neuanlage), damit Ligen/Teams gültige seasonId-Referenzen haben.
      changedSeasonRecs.forEach((se) => {
        const op = seasonNew.has(se.id)
          ? st.provider.createRecord('seasons', se as unknown as ProviderRecord)
          : st.provider.updateRecord('seasons', se.id, se as unknown as ProviderRecord);
        void op.catch((e) => { console.error('[sync]', e); set({ syncError: dict().storeMsg.errSeasonSave }); });
      });
      // Pro betroffener Liga anlegen/aktualisieren (PocketBase speichert teams/fixtures als JSON).
      touched.forEach(({ id, isNew }) => {
        const rec = leagues.find((l) => l.id === id);
        if (!rec) return;
        const op = isNew
          ? st.provider.createRecord('leagues', rec as unknown as ProviderRecord)
          : st.provider.updateRecord('leagues', id, rec as unknown as ProviderRecord);
        void op.catch((e) => { console.error('[sync]', e); set({ syncError: dict().storeMsg.errImportSave }); });
      });
      newTeams.forEach((t) => {
        void st.provider.createRecord('teams', t as unknown as ProviderRecord)
          .catch((e) => { console.error('[sync]', e); set({ syncError: dict().storeMsg.errTeamCreate }); });
      });
      newEvents.forEach((e) => {
        void st.provider.createRecord('events', e as unknown as ProviderRecord)
          .catch((err) => { console.error('[sync]', err); set({ syncError: dict().storeMsg.errEventCreate }); });
      });
      updatedEvents.forEach((e) => {
        void st.provider.updateRecord('events', e.id, e as unknown as ProviderRecord)
          .catch((err) => { console.error('[sync]', err); set({ syncError: dict().storeMsg.errEventUpdate }); });
      });
    } else {
      if (changedSeasonRecs.length) write(LS.seasons, seasons);
      write(LS.leagues, leagues);
      if (newTeams.length) write(LS.teams, teams);
      if (newEvents.length || updatedEvents.length) write(LS.events, events);
    }
    // Auf die importierte Saison umschalten (aktiv + angezeigt), damit die Ligen direkt bearbeitbar sind.
    set({ seasons, activeSeasonId, viewSeasonId: activeSeasonId, leagues, teams, events, selectedLeague: 0 });
    return counts;
  },

  // ── nuLiga-Import ──
  async importNuliga(leagueId) {
    const st0 = get();
    const lg0 = st0.leagues.find((l) => l.id === leagueId);
    if (!lg0) return;
    if (st0.provider.mode !== 'verein') {
      set({ nuligaSync: { leagueId, leagueName: lg0.name, phase: 'error', error: dict().storeMsg.nuligaVereinOnly } });
      return;
    }
    const url = (lg0.nuligaUrl || '').trim();
    if (!url) {
      set({ nuligaSync: { leagueId, leagueName: lg0.name, phase: 'error', error: dict().storeMsg.nuligaNoUrl } });
      return;
    }
    set({ nuligaSync: { leagueId, leagueName: lg0.name, phase: 'loading' } });
    let resp;
    try {
      resp = await st0.provider.fetchNuliga(url);
    } catch (e) {
      const msg = (e && typeof e === 'object' && 'message' in e && (e as { message?: unknown }).message)
        ? String((e as { message: unknown }).message) : dict().storeMsg.nuligaFetchFailed;
      set({ nuligaSync: { leagueId, leagueName: lg0.name, phase: 'error', error: msg } });
      return;
    }
    const nowIso = new Date().toISOString();
    const st = get();
    const res = mergeNuliga(st.leagues, leagueId, resp.fixtures || [], nowIso);
    if (!res.league) { set({ nuligaSync: { leagueId, leagueName: lg0.name, phase: 'error', error: 'Liga nicht gefunden.' } }); return; }
    const leagues = st.leagues.map((l) => l.id === leagueId ? res.league : l);
    // Kalender-Termine der eigenen Begegnungen dieser Liga idempotent nachziehen (neu/aktualisiert).
    const evByFixture = new Map(st.events.filter((e) => e.fixtureId).map((e) => [e.fixtureId as string, e]));
    const newEvents: EventItem[] = []; const updatedEvents: EventItem[] = [];
    for (const fx of res.league.fixtures) {
      if (!isOwnFixture(res.league, fx)) continue;
      const prev = evByFixture.get(fx.id);
      const ev = fixtureEvent(res.league, fx, prev);
      if (!prev) newEvents.push(ev);
      else if (prev.date !== ev.date || prev.title !== ev.title) updatedEvents.push(ev);
    }
    const updById = new Map(updatedEvents.map((e) => [e.id, e]));
    const events = (newEvents.length || updatedEvents.length)
      ? [...st.events.map((e) => updById.get(e.id) || e), ...newEvents]
      : st.events;
    if (res.changed) {
      void st.provider.updateRecord('leagues', leagueId, res.league as unknown as ProviderRecord)
        .catch((err) => { console.error('[sync]', err); set({ syncError: dict().storeMsg.errNuligaSave }); });
      newEvents.forEach((e) => void st.provider.createRecord('events', e as unknown as ProviderRecord)
        .catch((err) => { console.error('[sync]', err); set({ syncError: dict().storeMsg.errEventCreate }); }));
      updatedEvents.forEach((e) => void st.provider.updateRecord('events', e.id, e as unknown as ProviderRecord)
        .catch((err) => { console.error('[sync]', err); set({ syncError: dict().storeMsg.errEventUpdate }); }));
    }
    set({
      leagues, events,
      nuligaSync: {
        leagueId, leagueName: lg0.name, phase: 'done',
        championship: resp.championship, fetchedAt: nowIso,
        total: (resp.fixtures || []).length, counts: res.counts, conflicts: res.conflicts,
      },
    });
  },
  closeNuligaSync() { set({ nuligaSync: null }); },
  resolveNuligaConflict(leagueId, fixtureId, accept) {
    set((st) => {
      const leagues = st.leagues.map((l) => {
        if (l.id !== leagueId) return l;
        const fixtures = l.fixtures.map((f) => {
          if (f.id !== fixtureId || !f.nuligaConflict) return f;
          const nf: Fixture = { ...f };
          if (accept) { nf.hs = f.nuligaConflict.hs; nf.as = f.nuligaConflict.as; nf.played = true; nf.resultSource = 'nuliga'; }
          delete nf.nuligaConflict;
          return nf;
        });
        return { ...l, fixtures };
      });
      const updated = leagues.find((l) => l.id === leagueId);
      if (!updated) return {};
      if (st.provider.mode === 'verein') {
        void st.provider.updateRecord('leagues', updated.id, updated as unknown as ProviderRecord)
          .catch((e) => { console.error('[sync]', e); set({ syncError: dict().storeMsg.errConflictSave }); });
      } else {
        write(LS.leagues, leagues);
      }
      // Aufgelösten Konflikt aus der offenen Review-Liste entfernen.
      const sync = st.nuligaSync && st.nuligaSync.conflicts
        ? { ...st.nuligaSync, conflicts: st.nuligaSync.conflicts.filter((c) => c.fixtureId !== fixtureId) }
        : st.nuligaSync;
      return { leagues, nuligaSync: sync };
    });
  },

  // ── fixture modal ──
  openAddFixture() {
    const st = get(); const lg = currentLeague(st); if (!lg) return;
    const ts = lg.teams || [];
    const own = ts.find((t) => t.own) || ts[0] || null;
    const other = ts.find((t) => own && t.id !== own.id) || null;
    const d = new Date(); d.setDate(d.getDate() + 7);
    set({ fixtureModal: { mode: 'add', id: null, leagueId: lg.id, homeId: own ? own.id : null, awayId: other ? other.id : null, date: d.toISOString().slice(0, 10), time: '', loc: '', played: false, hs: '', as: '' } });
  },
  openEditFixture(id) {
    const st = get(); const lg = currentLeague(st); if (!lg) return;
    const f = lg.fixtures.find((x) => x.id === id); if (!f) return;
    set({ fixtureModal: { mode: 'edit', id: f.id, leagueId: lg.id, homeId: f.homeId, awayId: f.awayId, date: f.date || '', time: f.time || '', loc: f.loc || '', played: !!f.played, hs: f.hs === '' ? '' : String(f.hs), as: f.as === '' ? '' : String(f.as) } });
  },
  closeFixtureModal() { set({ fixtureModal: null }); },
  setFixtureField(key, val) { set((st) => st.fixtureModal ? { fixtureModal: { ...st.fixtureModal, [key]: val } as FixtureModalState } : {}); },
  saveFixtureModal() {
    const m = get().fixtureModal; if (!m) return;
    if (!m.homeId || !m.awayId || m.homeId === m.awayId) return;
    set((st) => {
      let changed: League | null = null;
      let rec: Fixture | null = null;
      const leagues = st.leagues.map((l) => {
        if (l.id !== m.leagueId) return l;
        const prev = l.fixtures.find((f) => f.id === m.id);
        rec = { id: m.id || uid(), homeId: m.homeId!, awayId: m.awayId!, date: m.date, time: m.time.trim() || undefined, loc: m.loc.trim() || undefined, played: m.played, hs: m.played ? (parseInt(m.hs, 10) || 0) : '', as: m.played ? (parseInt(m.as, 10) || 0) : '' };
        // Manuelle Eingabe/Überschreibung → autoritativ ('manual'). Ein evtl. nuLiga-Konflikt gilt als
        // aufgelöst (rec ist frisch, kopiert nuligaConflict nicht).
        if (m.played) rec.resultSource = 'manual';
        if (prev?.lineup) rec.lineup = prev.lineup; // Aufstellung beim Bearbeiten erhalten
        const fixtures = m.mode === 'add' ? [...l.fixtures, rec] : l.fixtures.map((f) => f.id === m.id ? rec! : f);
        changed = { ...l, fixtures };
        return changed;
      });
      if (changed) persist(st, set, LS.leagues, leagues, (p) => p.updateRecord('leagues', changed!.id, changed! as unknown as ProviderRecord));
      // Kalender-Termin (Ligaspiel) automatisch pflegen – nur für Begegnungen der eigenen Mannschaft.
      let events = st.events;
      if (changed && rec) {
        const lg: League = changed; const fx: Fixture = rec;
        const prevEv = st.events.find((e) => e.fixtureId === fx.id) || null;
        if (isOwnFixture(lg, fx)) {
          const ev = fixtureEvent(lg, fx, prevEv || undefined);
          events = prevEv ? st.events.map((e) => e.id === ev.id ? ev : e) : [...st.events, ev];
          persist(st, set, LS.events, events, (p) => prevEv
            ? p.updateRecord('events', ev.id, ev as unknown as ProviderRecord)
            : p.createRecord('events', ev as unknown as ProviderRecord));
        } else if (prevEv) { // Begegnung betrifft nicht mehr die eigene Mannschaft → Termin entfernen
          events = st.events.filter((e) => e.id !== prevEv.id);
          persist(st, set, LS.events, events, (p) => p.deleteRecord('events', prevEv.id));
        }
      }
      return { leagues, events, fixtureModal: null };
    });
  },
  deleteFixture(id) {
    set((st) => {
      const m = st.fixtureModal;
      let changed: League | null = null;
      const leagues = st.leagues.map((l) => {
        if (!(m && l.id === m.leagueId)) return l;
        changed = { ...l, fixtures: l.fixtures.filter((f) => f.id !== id) };
        return changed;
      });
      if (changed) persist(st, set, LS.leagues, leagues, (p) => p.updateRecord('leagues', changed!.id, changed! as unknown as ProviderRecord));
      // Automatisch erzeugten Kalender-Termin der Begegnung ebenfalls entfernen.
      const linkedEv = st.events.find((e) => e.fixtureId === id) || null;
      let events = st.events;
      if (linkedEv) {
        events = st.events.filter((e) => e.id !== linkedEv.id);
        persist(st, set, LS.events, events, (p) => p.deleteRecord('events', linkedEv.id));
      }
      return { leagues, events, fixtureModal: null };
    });
  },

  // ── event modal ──
  openAddEvent(isoDate) {
    const scope = get().settings.appMode === 'local' ? 'local' : 'verein';
    set({ eventModal: { mode: 'add', id: null, scope, title: '', date: isoDate || new Date().toISOString().slice(0, 10), time: '19:00', type: 'training', loc: '', repeat: 'none', until: '', seriesId: null } });
  },
  openEditEvent(id) {
    const e = get().events.find((x) => x.id === id); if (!e) return;
    set({ eventModal: { mode: 'edit', id: e.id, scope: e.scope, title: e.title, date: e.date, time: e.time, type: e.type, loc: e.loc, repeat: 'none', until: '', seriesId: e.seriesId ?? null } });
  },
  closeEventModal() { set({ eventModal: null }); },
  setEventField(key, val) { set((st) => st.eventModal ? { eventModal: { ...st.eventModal, [key]: val } as EventModalState } : {}); },
  saveEventModal() {
    const m = get().eventModal; if (!m) return;
    const title = m.title.trim(); if (!title) return;
    set((st) => {
      const seasonId = (st.events.find((e) => e.id === m.id)?.seasonId) ?? st.activeSeasonId ?? undefined;
      // Serientermin: beim Anlegen mit Wiederholung + Enddatum eine ganze Serie erzeugen (verknüpft per seriesId).
      if (m.mode === 'add' && m.repeat !== 'none' && m.until && m.until >= m.date) {
        const seriesId = uid();
        const recs: EventItem[] = [];
        let cur = m.date; let guard = 0;
        while (cur <= m.until && guard < 300) { // Deckel gegen Ausreißer (z. B. ~6 Jahre wöchentlich)
          recs.push({ id: uid(), scope: m.scope, title, date: cur, time: m.time, type: m.type, loc: m.loc.trim(), seasonId, seriesId });
          cur = addRepeat(cur, m.repeat); guard++;
        }
        const events = [...st.events, ...recs];
        if (st.provider.mode === 'verein') recs.forEach((r) => void st.provider.createRecord('events', r as unknown as ProviderRecord).catch((e) => { console.error('[sync]', e); set({ syncError: dict().storeMsg.errSeriesSave }); }));
        else write(LS.events, events);
        return { events, eventModal: null };
      }
      const rec: EventItem = { id: m.id || uid(), scope: m.scope, title, date: m.date, time: m.time, type: m.type, loc: m.loc.trim(), seasonId, ...(m.seriesId ? { seriesId: m.seriesId } : {}) };
      const events = m.mode === 'add' ? [...st.events, rec] : st.events.map((e) => e.id === m.id ? rec : e);
      persist(st, set, LS.events, events, (p) => m.mode === 'add'
        ? p.createRecord('events', rec as unknown as ProviderRecord)
        : p.updateRecord('events', rec.id, rec as unknown as ProviderRecord));
      return { events, eventModal: null };
    });
  },
  // Ganze Terminserie löschen (alle Termine mit derselben seriesId).
  deleteEventSeries(seriesId) {
    set((st) => {
      const del = st.events.filter((e) => e.seriesId === seriesId);
      if (!del.length) return { eventModal: null };
      const events = st.events.filter((e) => e.seriesId !== seriesId);
      if (st.provider.mode === 'verein') del.forEach((e) => void st.provider.deleteRecord('events', e.id).catch((err) => { console.error('[sync]', err); set({ syncError: dict().storeMsg.errSeriesDelete }); }));
      else write(LS.events, events);
      return { events, eventModal: null };
    });
  },
  // Alte Termine im Batch löschen: alle mit Datum VOR cutoffIso (über alle Saisons). Gibt die Anzahl zurück.
  pruneEvents(cutoffIso) {
    const st = get();
    const del = st.events.filter((e) => e.date && e.date < cutoffIso);
    if (!del.length) return 0;
    const events = st.events.filter((e) => !(e.date && e.date < cutoffIso));
    if (st.provider.mode === 'verein') del.forEach((e) => void st.provider.deleteRecord('events', e.id).catch((err) => { console.error('[sync]', err); set({ syncError: dict().storeMsg.errEventDelete }); }));
    else write(LS.events, events);
    set({ events });
    return del.length;
  },
  deleteEvent(id) {
    set((st) => {
      const events = st.events.filter((e) => e.id !== id);
      persist(st, set, LS.events, events, (p) => p.deleteRecord('events', id));
      return { events, eventModal: null };
    });
  },

  openRules(modeId) { set({ rulesMode: modeId }); },
  closeRules() { set({ rulesMode: null }); },

  // ── Trainingsspiele ──
  openTrainSetup(modeId) {
    const meta = trainMeta(modeId);
    const pool = get().players;
    const count = meta.minPlayers;
    // Standard-Auswahl: erste verschiedene Spieler
    const picks: number[] = [];
    for (let i = 0; i < meta.maxPlayers && i < pool.length; i++) picks.push(i);
    while (picks.length < meta.maxPlayers) picks.push(0);
    set({ trainSetup: { modeId, count, picks }, screen: 'trainSetup' });
  },
  setTrainCount(n) {
    set((st) => {
      if (!st.trainSetup) return {};
      const meta = trainMeta(st.trainSetup.modeId);
      const count = Math.max(meta.minPlayers, Math.min(meta.maxPlayers, n));
      return { trainSetup: { ...st.trainSetup, count } };
    });
  },
  setTrainPick(slot, playerIdx) {
    set((st) => {
      if (!st.trainSetup) return {};
      const picks = [...st.trainSetup.picks];
      picks[slot] = playerIdx;
      return { trainSetup: { ...st.trainSetup, picks } };
    });
  },
  startTrain() {
    const st = get(); const su = st.trainSetup; if (!su) return;
    const pool = st.players; if (!pool.length) return;
    const meta = trainMeta(su.modeId);
    const count = Math.max(meta.minPlayers, Math.min(meta.maxPlayers, su.count));
    const players: TrainPlayer[] = [];
    const used = new Set<string>();
    for (let i = 0; i < count; i++) {
      const idx = Math.max(0, Math.min(pool.length - 1, su.picks[i] ?? i));
      let p = pool[idx];
      // Doppelte vermeiden (Mehrspieler): nächsten freien Spieler nehmen
      if (count > 1 && used.has(p.id)) { p = pool.find((q) => !used.has(q.id)) || p; }
      used.add(p.id);
      players.push({ id: `t${i}_${p.id}`, pid: p.id, name: p.name, short: p.short, av: p.avi, photo: p.photo });
    }
    const trainingPlays = { ...st.trainingPlays, [su.modeId]: (st.trainingPlays[su.modeId] || 0) + 1 };
    if (st.provider.mode === 'verein') void st.provider.saveTrainingPlays(trainingPlays).catch((e) => { console.error('[sync]', e); });
    else write(LS.trainplays, trainingPlays);
    set({ trainGame: newTrainGame(su.modeId, players), trainUndo: [], trainingPlays, trainBestFlash: [], screen: 'trainGame' });
  },
  trainApply(input) {
    const st = get(); const g = st.trainGame; if (!g || g.over) return;
    const next = tApplyTurn(g, input);
    set({ trainGame: next, trainUndo: [...st.trainUndo, g].slice(-50) });
    // Spielende → persönliche Bestwerte verbuchen (Badge im Sieg-Overlay). Sonst laufende Feier einblenden.
    if (next.over) recordTrainingResult(get, set, next);
    else { const cel = trainCelebration(g, next, input); if (cel) get().showHint({ ...cel, auto: true }); }
  },
  trainUndoTurn() {
    set((st) => {
      if (!st.trainUndo.length) return {};
      const prev = st.trainUndo[st.trainUndo.length - 1];
      return { trainGame: prev, trainUndo: st.trainUndo.slice(0, -1) };
    });
  },
  trainRematch() {
    const g = get().trainGame; if (!g) return;
    set({ trainGame: newTrainGame(g.modeId, g.players), trainUndo: [], trainBestFlash: [], hint: null });
  },
  trainExit() { set({ trainGame: null, trainUndo: [], trainSetup: null, trainBestFlash: [], hint: null, screen: 'training' }); },

  // ── counter ──
  goSetup(preset) { set((st) => ({ screen: 'setup', setup: { ...st.setup, ...(preset || {}) } })); },
  setSetup(key, val) {
    set((st) => {
      const setup = { ...st.setup, [key]: val } as SetupState;
      if (key === 'p1' && setup.p1 === setup.p2) setup.p2 = st.setup.p1;
      if (key === 'p2' && setup.p2 === setup.p1) setup.p1 = st.setup.p2;
      if (key === 'outMode') setup.doubleOut = setup.outMode !== 'single'; // keep doubleOut in sync
      return { setup };
    });
    // Spieltyp-Voreinstellung gerätelokal sichern, sobald sich eine davon ändert (Spieler/Gäste lösen das nicht aus).
    if ((SETUP_DEFAULT_KEYS as readonly string[]).includes(key as string)) writeSetupDefaults(get().setup);
  },
  startGame() {
    const st = get(); const su = st.setup;
    const pool = st.players;
    if (!pool.length) return;
    const clamp = (i: number) => Math.max(0, Math.min(pool.length - 1, i || 0));
    const i1 = clamp(su.p1);
    let i2 = clamp(su.p2);
    if (i2 === i1 && pool.length > 1) i2 = (i1 + 1) % pool.length;
    const a = pool[i1], b = pool[i2];
    // Gast-Name (falls eingetippt) überschreibt die Spielerwahl für diesen Slot.
    const mk = (id: number, guest: string | undefined, fb: Player): GamePlayer => {
      const g = (guest || '').trim();
      return g ? { id, name: g, short: initials(g) || g.slice(0, 2).toUpperCase(), av: 0 } : { id, name: fb.name, short: fb.short, av: fb.avi, photo: fb.photo };
    };
    const gamePlayers: GamePlayer[] = [mk(1, su.p1Guest, a), mk(2, su.p2Guest, b)];
    const settings = { ...st.settings, startScore: su.startScore, bestOf: su.bestOf, bestOfSets: su.bestOfSets, unit: su.unit, doubleOut: su.doubleOut, outMode: su.outMode, doubleIn: su.doubleIn };
    persistSettings(st, set, settings);
    try { localStorage.removeItem(LS.live); } catch { /* ignore */ }
    set({ gamePlayers, gameMode: su.mode, allThrows: [], input: '', screen: 'counter', settings, startOffset: 0, pendingStart: true, bullMode: false, spinPick: null, matchSaved: false, freePlay: !!su.freePlay, gameLink: su.link || null, hint: null, finishPrompt: null, abortConfirm: false });
  },
  quickStart(preset) {
    // Schnellstart = normales, gewertetes Spiel: Gast-Namen, Freies-Spiel & Liga-Verknüpfung zurücksetzen.
    set((st) => ({ setup: { ...st.setup, mode: 'single', p1: 0, p2: 1, p1Guest: '', p2Guest: '', freePlay: false, link: null, ...(preset || {}) } }));
    get().startGame();
  },
  // Fernbedienungs-Startmenü: Spieler (per ID) + Format kommen vom Handy → hier auf die Board-Aufstellung
  // abbilden und starten. Nur gültige Werte übernehmen (der Rest bleibt beim aktuellen Setup-Standard).
  startRemoteGame(sel) {
    const pool = get().players;
    const idxOf = (id: string | undefined, fb: number) => { const i = id ? pool.findIndex((p) => p.id === id) : -1; return i >= 0 ? i : fb; };
    const p1 = idxOf(sel.p1Id, 0);
    let p2 = idxOf(sel.p2Id, 1);
    if (p2 === p1 && pool.length > 1) p2 = p1 === 0 ? 1 : 0; // nie zweimal denselben Spieler
    const preset: Partial<SetupState> = { mode: 'single', p1, p2, p1Guest: '', p2Guest: '', freePlay: false, link: null };
    if ([301, 501, 701, 1001].includes(Number(sel.startScore))) preset.startScore = Number(sel.startScore);
    if (sel.outMode === 'single' || sel.outMode === 'double' || sel.outMode === 'master') { preset.outMode = sel.outMode; preset.doubleOut = sel.outMode !== 'single'; }
    if (typeof sel.doubleIn === 'boolean') preset.doubleIn = sel.doubleIn;
    if (sel.unit === 'legs' || sel.unit === 'sets') preset.unit = sel.unit;
    if (Number.isFinite(Number(sel.bestOf)) && Number(sel.bestOf) > 0) preset.bestOf = Number(sel.bestOf);
    if (Number.isFinite(Number(sel.bestOfSets)) && Number(sel.bestOfSets) > 0) preset.bestOfSets = Number(sel.bestOfSets);
    set((st) => ({ setup: { ...st.setup, ...preset } }));
    get().startGame();
  },
  // Startet ein konkretes Ligaspiel vom Board: eigener Spieler als Slot 0, Gegner als Gast, mit Positions-Verknüpfung.
  startBoardGame(leagueId, fixtureId, positionId, ownPlayerId, oppName, starterIdx) {
    const st = get();
    const idx = st.players.findIndex((p) => p.id === ownPlayerId);
    set((s) => ({ setup: { ...s.setup, mode: 'single', p1: idx < 0 ? 0 : idx, p1Guest: '', p2Guest: (oppName || 'Gast'), freePlay: false, link: { leagueId, fixtureId, positionId } } }));
    get().startGame();
    // Anwurf schon im „Nächstes Spiel"-Overlay festgelegt (Spieler/Ausbullen) → Starter direkt setzen,
    // damit das normale WhoStarts-Overlay nicht kurz aufblitzt. Ohne Angabe bleibt es beim WhoStarts-Flow.
    if (typeof starterIdx === 'number') get().chooseStarter(starterIdx);
  },
  dismissNextGame(positionId) { set({ nextGameDismissed: positionId }); },
  showBoardNow() { set({ boardForceShow: true, nextGameDismissed: null }); },
  chooseStarter(idx) { set({ startOffset: idx, pendingStart: false, bullMode: false, spinPick: null }); },
  openBullOff() { set({ bullMode: true }); },
  closeBullOff() { set({ bullMode: false }); },
  rematch() { try { localStorage.removeItem(LS.live); } catch { /* ignore */ } set({ allThrows: [], input: '', matchSaved: false, pendingStart: true, bullMode: false, spinPick: null }); },
  endGameTo(target) {
    try { localStorage.removeItem(LS.live); } catch { /* ignore */ }
    set({ allThrows: [], input: '', matchSaved: false, pendingStart: false, bullMode: false, spinPick: null, abortConfirm: false, hint: null, finishPrompt: null });
    if (target === 'setup') get().goSetup();
    else set({ screen: 'dashboard' });
  },
  abortGame() { set({ abortConfirm: true }); },
  confirmAbort() { try { localStorage.removeItem(LS.live); } catch { /* ignore */ } set({ abortConfirm: false, allThrows: [], input: '', matchSaved: false, screen: 'dashboard', hint: null, finishPrompt: null }); },
  cancelAbort() { set({ abortConfirm: false }); },
  apply(score, darts) {
    const st = get();
    const slice: CounterSlice = { gamePlayers: st.gamePlayers, allThrows: st.allThrows, startOffset: st.startOffset, settings: st.settings };
    if (cMatchOver(slice)) return;
    const cp = cCurrentPlayer(slice); if (!cp) return;
    const ns = cScores(slice)[cp.id] - score;
    let bust = false, checkout = false;
    const mode = st.settings.outMode || (st.settings.doubleOut === false ? 'single' : 'double');
    if (ns < 0 || (ns === 1 && mode !== 'single')) bust = true;
    else if (ns === 0) checkout = true;
    const leg = st.allThrows.filter((t) => t.checkout).length + 1;
    const usedDarts = (checkout && darts) ? darts : 3;
    const t: Throw = { playerId: cp.id, score: bust ? 0 : score, raw: score, bust, checkout, leg, darts: usedDarts };
    const allThrows = [...st.allThrows, t];
    set({ allThrows, input: '' });
    // Checkout OHNE explizite Dartzahl (also NICHT via F10–F12): erst den Finish-Dart abfragen, dann
    // Feier/Sieg-Overlay – die exakte Dartzahl entscheidet über Short Leg & Statistik. ABER nur fragen,
    // wenn ein Finish mit <3 Darts überhaupt möglich war (canCheckout, wie bei F10–F12). z. B. 141 geht
    // nur mit 3 Darts → keine Frage, es bleibt bei 3. Der Abschluss läuft danach über completeCheckout().
    if (checkout && !darts) {
      const minDarts = cMinCheckoutDarts(st.settings, score);
      if (minDarts < 3) { set({ finishPrompt: { playerId: cp.id, score, minDarts } }); persistLive(get); return; }
    }
    completeCheckout(get, set, checkout ? cp.id : null);
  },
  resolveFinish(dart) {
    const st = get();
    if (!st.finishPrompt) return;
    const pid = st.finishPrompt.playerId;
    const d = Math.max(1, Math.min(3, Math.round(dart)));
    if (d < st.finishPrompt.minDarts) return; // unmögliche Dartzahl ignorieren (z. B. 100 mit 1 Dart)
    // die noch offene Checkout-Aufnahme dieses Spielers auf die gewählte Dartzahl setzen
    const allThrows = st.allThrows.slice();
    for (let i = allThrows.length - 1; i >= 0; i--) {
      if (allThrows[i].playerId === pid && allThrows[i].checkout) { allThrows[i] = { ...allThrows[i], darts: d }; break; }
    }
    set({ allThrows, finishPrompt: null });
    completeCheckout(get, set, pid);
  },
  cancelFinish() {
    // Fehleingabe: Abfrage schließen und die Checkout-Aufnahme zurücknehmen (Spieler ist wieder am Wurf).
    if (!get().finishPrompt) return;
    set({ finishPrompt: null });
    get().undo();
  },
  pressDigit(d) { set((st) => { const n = st.input + d; return { input: n.length <= 3 ? n : st.input }; }); },
  pressClear() { set({ input: '' }); },
  pressDel() { set((st) => ({ input: st.input.slice(0, -1) })); },
  pressEnter() {
    const v = Number(get().input);
    if (get().input !== '' && !isNaN(v) && v >= 0 && v <= 180) get().apply(v);
    else set({ input: '' });
  },
  quick(n) { get().apply(n); },
  openRestEntry() {
    const st = get();
    const slice: CounterSlice = { gamePlayers: st.gamePlayers, allThrows: st.allThrows, startOffset: st.startOffset, settings: st.settings };
    if (cMatchOver(slice) || st.pendingStart) return;
    set({ restEntry: true });
  },
  closeRestEntry() { set({ restEntry: false }); },
  submitRestEntry(remStr) {
    const st = get();
    const slice: CounterSlice = { gamePlayers: st.gamePlayers, allThrows: st.allThrows, startOffset: st.startOffset, settings: st.settings };
    if (cMatchOver(slice)) { set({ restEntry: false }); return; }
    const cp = cCurrentPlayer(slice); if (!cp) { set({ restEntry: false }); return; }
    const curRem = cScores(slice)[cp.id];
    const entered = parseInt(remStr, 10);
    if (isNaN(entered) || entered < 0 || entered > curRem) return; // invalid → keep box open
    const scored = curRem - entered;
    if (scored < 0 || scored > 180) return;
    set({ restEntry: false });
    get().apply(scored); // records the actual scored value so it counts toward the average
  },
  undo() {
    const st = get();
    if (!st.allThrows.length) return;
    const base = { gamePlayers: st.gamePlayers, startOffset: st.startOffset, settings: st.settings };
    const wasOver = cMatchOver({ ...base, allThrows: st.allThrows });
    const allThrows = st.allThrows.slice(0, -1);
    const nowOver = cMatchOver({ ...base, allThrows });
    // Wird ein beendendes Checkout zurückgenommen, war der zuletzt gespeicherte Match dessen
    // Resultat → entfernen, damit ein neu zu Ende gespieltes Leg wieder gespeichert werden kann
    // (sonst bliebe das alte Ergebnis dauerhaft bestehen und ein Resave würde geblockt/dupliziert).
    if (st.matchSaved && wasOver && !nowOver) {
      const saved = st.matches[st.matches.length - 1];
      const matches = st.matches.slice(0, -1);
      set({ allThrows, input: '', matchSaved: false, matches });
      if (saved) persist(st, set, LS.matches, matches, (p) => p.deleteRecord('matches', saved.id));
      persistLive(get);
      return;
    }
    set({ allThrows, input: '' });
    persistLive(get);
  },
  newMatch() { get().requestNew({ kind: 'setup' }); },
  requestNew(action) {
    const st = get();
    const slice: CounterSlice = { gamePlayers: st.gamePlayers, allThrows: st.allThrows, startOffset: st.startOffset, settings: st.settings };
    // a running (non-finished) game gets a confirmation before being discarded
    if (st.allThrows.length > 0 && !cMatchOver(slice)) { set({ newConfirm: true, pendingNew: action }); return; }
    get().runNew(action);
  },
  runNew(action) {
    try { localStorage.removeItem(LS.live); } catch { /* ignore */ }
    set({ allThrows: [], input: '', matchSaved: false, pendingStart: false, bullMode: false, spinPick: null, restEntry: false, abortConfirm: false, newConfirm: false, hint: null, finishPrompt: null });
    if (action.kind === 'preset') get().startPreset(action.preset);
    else get().goSetup(); // back to player selection; "Spiel starten" then asks who begins
  },
  startPreset(preset) {
    set((st) => ({ setup: { ...st.setup, ...preset } })); // keep current players, apply the format
    get().startGame();
  },
  confirmNew() { get().runNew(get().pendingNew); },
  cancelNew() { set({ newConfirm: false }); },
  showHint(hint) { set({ hint }); },
  closeHint() { set({ hint: null }); },
  applyUpdate() { void applyPwaUpdate(); },
  checkForUpdate() {
    if (get().updateStatus === 'checking') return;
    set({ updateStatus: 'checking' });
    void checkPwaUpdate().then((ready) => {
      // ready → Banner/Button erscheint (updateReady); sonst kurzes „Aktuell"-Feedback
      set({ updateReady: ready || get().updateReady, updateStatus: ready ? 'idle' : 'current' });
    });
  },
}));

// ── Persistenz-Routing: lokal → localStorage (volle Liste), verein → PocketBase (pro Datensatz) ──
type SetFn = (p: Partial<AppState>) => void;

function persist(st: AppState, set: SetFn, lsKey: string, fullArray: unknown, verein: (p: DataProvider) => Promise<unknown>) {
  if (st.provider.mode === 'verein') {
    void verein(st.provider).catch((e) => { console.error('[sync]', e); set({ syncError: dict().storeMsg.errChangeSave }); });
  } else {
    write(lsKey, fullArray);
  }
}
// Persönliche Trainings-Bestwerte am Spieler-Datensatz verbuchen (nach Spielende). Aktualisiert je Spieler
// den Bestwert seiner Modus-Kennzahl (falls verbessert), persistiert die geänderten Spieler und markiert die
// Verbesserer (TrainPlayer-IDs) für das Sieg-Overlay. Modi ohne TRAIN_BEST-Eintrag (z. B. Cricket) → übersprungen.
function recordTrainingResult(get: () => AppState, set: SetFn, g: TrainGame) {
  const meta = TRAIN_BEST[g.modeId];
  if (!meta) { set({ trainBestFlash: [] }); return; }
  const st = get();
  const today = new Date().toISOString().slice(0, 10);
  const flash: string[] = [];
  const nextBest = new Map<string, TrainingBest>(); // pid → neuer Bestwert
  for (const tp of g.players) {
    const raw = meta.value(g, tp.id);
    if (raw == null) continue;
    const player = st.players.find((p) => p.id === tp.pid);
    const prev = player?.trainingBests?.[g.modeId]?.value;
    if (meta.kind === 'wins') {
      // Siege immer akkumulieren (kein „Rekord"-Badge), aber nur bei tatsächlichem Sieg fortschreiben.
      if (raw > 0) nextBest.set(tp.pid, { value: (prev || 0) + 1, date: today });
    } else if (isBetterBest(meta.kind, raw, prev)) {
      nextBest.set(tp.pid, { value: raw, date: today });
      flash.push(tp.id); // echter neuer Bestwert → im Overlay feiern
    }
  }
  if (nextBest.size === 0) { set({ trainBestFlash: flash }); return; }
  const players = st.players.map((p) => {
    const nb = nextBest.get(p.id);
    return nb ? { ...p, trainingBests: { ...(p.trainingBests || {}), [g.modeId]: nb } } : p;
  });
  set({ players, trainBestFlash: flash });
  if (st.provider.mode === 'verein') {
    for (const pid of nextBest.keys()) {
      if (isSeedPlayer(pid)) continue; // lokale Standard-Spieler haben keinen Server-Datensatz → nicht syncen
      const updated = players.find((p) => p.id === pid)!;
      void st.provider.updateRecord('players', pid, { trainingBests: updated.trainingBests } as unknown as ProviderRecord)
        .catch((e) => { console.error('[sync]', e); set({ syncError: dict().storeMsg.errChangeSave }); });
    }
  } else {
    write(LS.players, players);
  }
}
function persistSettings(st: AppState, set: SetFn, settings: Settings) {
  if (st.provider.mode === 'verein') {
    // pbUrl ist gerätelokal → nicht zum Server synchronisieren (sonst würde sie geräteübergreifend verteilt).
    const serverSettings: Settings = { ...settings };
    delete (serverSettings as Partial<Settings>).pbUrl;
    void st.provider.saveSettings(serverSettings).catch((e) => { console.error('[sync]', e); set({ syncError: dict().storeMsg.errSettingsSave }); });
  } else {
    write(LS.settings, settings);
  }
}

// Begegnung der EIGENEN Mannschaft? (Heim oder Gast ist das eigene Team) – nur solche kommen in den Kalender.
function isOwnFixture(league: League, fx: Fixture): boolean {
  const teams = league.teams || [];
  return !!(teams.find((t) => t.id === fx.homeId)?.own || teams.find((t) => t.id === fx.awayId)?.own);
}
// Kalender-Termin (Ligaspiel) zu einer Begegnung bauen. prev erhält vom Nutzer gepflegte Uhrzeit/Ort.
function fixtureEvent(league: League, fx: Fixture, prev?: EventItem): EventItem {
  const teams = league.teams || [];
  const hn = teams.find((t) => t.id === fx.homeId)?.name || 'Heim';
  const an = teams.find((t) => t.id === fx.awayId)?.name || 'Gast';
  const ownIsHome = !!teams.find((t) => t.id === fx.homeId)?.own;
  return {
    id: prev?.id || uid(),
    scope: 'verein',
    title: `${hn} – ${an}`,
    date: fx.date,
    time: fx.time || prev?.time || '',
    type: league.kind === 'friendly' ? 'freundschaft' : league.kind === 'cup' ? 'pokal' : 'ligaspiel',
    loc: fx.loc || prev?.loc || (ownIsHome ? dict().teams.home : dict().teams.away),
    seasonId: league.seasonId ?? prev?.seasonId,
    fixtureId: fx.id,
  };
}

// Saison-Backfill für den lokalen Modus: bestehenden Ligen/Teams/Terminen/Matches ohne seasonId die aktive
// Saison zuweisen und Match-Spielerstatistiken per Name→Player.id ergänzen (robuste Mehrjahres-Statistik).
// Liefert die (ggf. unveränderten) Arrays + Änderungs-Flags, damit nur bei echten Änderungen geschrieben wird.
function migrateSeasonData(
  data: { leagues: League[]; teams: Team[]; events: EventItem[]; matches: Match[] },
  activeSeasonId: string,
  players: Player[],
) {
  const byName = new Map(players.map((p) => [p.name, p.id]));
  let lc = false, tc = false, ec = false, mc = false;
  const leagues = data.leagues.map((l) => l.seasonId ? l : (lc = true, { ...l, seasonId: activeSeasonId }));
  const teams = data.teams.map((t) => t.seasonId ? t : (tc = true, { ...t, seasonId: activeSeasonId }));
  const events = data.events.map((e) => e.seasonId ? e : (ec = true, { ...e, seasonId: activeSeasonId }));
  const matches = data.matches.map((m) => {
    let ppChanged = false;
    const perPlayer = m.perPlayer.map((pp) =>
      (pp.playerId === undefined && byName.has(pp.name)) ? (ppChanged = true, { ...pp, playerId: byName.get(pp.name) }) : pp);
    const needSeason = !m.seasonId;
    if (!needSeason && !ppChanged) return m;
    mc = true;
    return { ...m, ...(needSeason ? { seasonId: activeSeasonId } : {}), perPlayer };
  });
  return { leagues, teams, events, matches, lc, tc, ec, mc };
}

// ── Saison-Abschluss (Phase 2): Snapshot, Export-Bundle, Nachfolge-Name ──
// Nächster Saison-Name: "2025/26" → "2026/27"; "2025" → "2026"; sonst Anhängsel.
function nextSeasonName(name: string): string {
  const m = name.match(/^(\d{4})\s*\/\s*(\d{2,4})$/);
  if (m) { const y = parseInt(m[1], 10) + 1; return `${y}/${String((y + 1) % 100).padStart(2, '0')}`; }
  const y4 = name.match(/^(\d{4})$/);
  if (y4) return String(parseInt(y4[1], 10) + 1);
  return `${name} (neu)`;
}

// Browser-Download eines JSON-Objekts (Export-Bundle / Wegsicherung).
function downloadJson(filename: string, data: unknown): void {
  try {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) { console.error('[export]', e); }
}

const ofSeason = <T extends { seasonId?: string }>(items: T[], sid: string, asid: string | null): T[] =>
  items.filter((x) => (x.seasonId ?? asid) === sid);

// Eingefrorenen Abschluss-Stand einer Saison aus dem aktuellen Datenbestand berechnen.
function buildSeasonSnapshot(season: Season, st: AppState): SeasonSnapshot {
  const sid = season.id; const asid = st.activeSeasonId;
  const sLeagues = ofSeason(st.leagues, sid, asid);
  const sTeams = ofSeason(st.teams, sid, asid);
  const sMatches = ofSeason(st.matches, sid, asid);
  const standings = sLeagues.map((l) => ({ leagueId: l.id, leagueName: l.name, kind: (l.kind === 'cup' ? 'cup' : 'league') as TeamKind, rows: computeStandings(l) }));
  const playerStats = st.players.map((p) => {
    const a = aggregateFor(p, sMatches);
    return { playerId: p.id, name: p.name, games: a.games, wins: a.wins, losses: a.losses, avg: a.avg, c180: a.c180, c140: a.c140, c100: a.c100, c60: a.c60, high: a.high, shortLegs: a.shortLegs };
  }).filter((x) => x.games > 0);
  const teamRosters = sTeams.map((t) => ({ teamId: t.id, name: t.name, kind: (t.kind === 'cup' ? 'cup' : 'league') as TeamKind, captainId: t.captainId, memberIds: t.memberIds }));
  return {
    id: uid(), seasonId: sid, seasonName: season.name, standings, playerStats, teamRosters,
    meta: { generatedAt: new Date().toISOString(), matchCount: sMatches.length, teamCount: sTeams.length, leagueCount: sLeagues.length },
  };
}

// Vollständiges Export-Bundle einer Saison (Wegsicherung + spätere Re-Import-Grundlage).
function buildSeasonBundle(season: Season, snapshot: SeasonSnapshot, st: AppState) {
  const sid = season.id; const asid = st.activeSeasonId;
  return {
    format: 'dartszentrale-season-bundle', version: 1, exportedAt: new Date().toISOString(),
    season, snapshot,
    leagues: ofSeason(st.leagues, sid, asid),
    teams: ofSeason(st.teams, sid, asid),
    events: ofSeason(st.events, sid, asid),
    matches: ofSeason(st.matches, sid, asid),
  };
}

function bundleFilename(season: Season): string {
  const safe = season.name.replace(/[^\dA-Za-z]+/g, '-');
  return `dartszentrale-saison-${safe}-${new Date().toISOString().slice(0, 10)}.json`;
}

// Lädt den kompletten Datenbestand vom Provider und übernimmt ihn in den Store (inkl. persönlicher Einstellungen).
async function applySnapshot(get: () => AppState, set: SetFn) {
  try {
    const snap = await get().provider.loadAll();
    // Realtime-Schutz: Wird das eigene Konto deaktiviert oder gelöscht (z. B. durch einen Admin
    // auf einem anderen Gerät), liefert die users-Subscription sofort ein Event → hier abfangen
    // und den Nutzer umgehend abmelden, statt erst beim nächsten App-Start.
    const sessionId = get().session;
    if (sessionId) {
      const me = snap.accounts.find((a) => a.id === sessionId);
      if (!me || me.active === false) {
        void get().provider.logout();
        set({ session: null, screen: 'dashboard', loginForm: { email: '', pw: '', code: '', mfaStep: false, err: dict().storeMsg.accountDeactivatedNow } });
        return;
      }
    }
    const cur = get().settings;
    const merged: Settings = { ...cur, ...(snap.settings || {}) };
    // Gerätelokale Keys (Verbindung, Eingabe-Modus, Hell/Dunkel, Größen, Namens-Sortierung …) NIE vom
    // Server übernehmen – sie gehören diesem Gerät (Mischbetrieb PC/Tablet/Board).
    const curRec = cur as unknown as Record<string, unknown>;
    const mergedRec = merged as unknown as Record<string, unknown>;
    for (const k of DEVICE_LOCAL_SETTING_KEYS) mergedRec[k as string] = curRec[k as string];
    merged.appMode = 'verein';
    // Live-Farben passend zum (gerätelokalen) Hell/Dunkel-Modus ableiten.
    const lightMode = merged.mode === 'light';
    merged.accent = (lightMode ? merged.accentLight : merged.accentDark) || merged.accent;
    merged.scoreColor = lightMode ? merged.scoreColorLight : merged.scoreColorDark;
    merged.legColor = lightMode ? merged.legColorLight : merged.legColorDark;
    normalizeShortcuts(merged); // club_config könnte noch die alten Strg+Alt-Standards tragen → hier heben
    if (snap.clubName !== undefined) merged.clubName = snap.clubName;
    if (snap.clubLogo !== undefined) merged.clubLogo = snap.clubLogo;
    if (snap.impressum !== undefined) merged.impressum = snap.impressum;
    if (snap.datenschutz !== undefined) merged.datenschutz = snap.datenschutz;
    // Saisons (server-seitig per provision.mjs angelegt/backfilled). Aktive Saison bestimmen; die betrachtete
    // Saison über einen Reload hinweg beibehalten, solange sie noch existiert (sonst auf aktive zurückfallen).
    const seasons = snap.seasons || [];
    const activeSeasonId = seasons.length ? (pickActiveSeason(seasons) || seasons[0]).id : null;
    const prevView = get().viewSeasonId;
    const viewSeasonId = (prevView && seasons.some((s) => s.id === prevView)) ? prevView : activeSeasonId;
    set({
      settings: merged,
      players: withDefaultPlayers(snap.players), teams: snap.teams, accounts: snap.accounts,
      leagues: sortLeaguesByOrder(snap.leagues), events: snap.events, matches: snap.matches,
      seasons, seasonSnapshots: snap.seasonSnapshots || [], activeSeasonId, viewSeasonId,
      trainingPlays: snap.trainingPlays, syncError: null,
    });
  } catch (e) {
    console.error('[load]', e);
    set({ syncError: dict().storeMsg.errLoad });
  }
}
let _reloadTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleReload(get: () => AppState, set: SetFn) {
  if (_reloadTimer) clearTimeout(_reloadTimer);
  _reloadTimer = setTimeout(() => { _reloadTimer = null; void applySnapshot(get, set); }, 300);
}

// ── Live-Persistenz & Match-Speicherung ──
function persistLive(get: () => AppState) {
  const st = get();
  try { localStorage.setItem(LS.live, JSON.stringify({ players: st.gamePlayers, allThrows: st.allThrows, startOffset: st.startOffset, matchSaved: st.matchSaved })); } catch { /* ignore */ }
}
// Abschluss nach einem (fertig erfassten) Checkout: Match speichern (→ Sieg-Overlay) oder Live-Feier
// zeigen. Aus apply() (F10–F12, Dart bekannt) und aus resolveFinish() (nach der Finish-Dart-Abfrage).
function completeCheckout(get: () => AppState, set: (p: Partial<AppState>) => void, checkoutPid: string | number | null) {
  const st = get();
  const slice: CounterSlice = { gamePlayers: st.gamePlayers, allThrows: st.allThrows, startOffset: st.startOffset, settings: st.settings };
  if (cMatchOver(slice) && !st.matchSaved) { saveMatch(get, set); return; }
  persistLive(get);
  if (checkoutPid == null) return;
  const cel = cCheckoutCelebration(slice, checkoutPid);
  if (!cel) return;
  const name = st.gamePlayers.find((p) => p.id === checkoutPid)?.name || '';
  const c = dict().counter;
  if (cel.highFinish && cel.shortLeg) get().showHint({ title: c.highFinishTitle, body: c.hfShortLegBody(name, cel.score, cel.darts), auto: true });
  else if (cel.highFinish) get().showHint({ title: c.highFinishTitle, body: c.highFinishBody(name, cel.score), auto: true });
  else get().showHint({ title: c.shortLegTitle, body: c.shortLegBody(name, cel.darts), auto: true });
}
function saveMatch(get: () => AppState, set: (p: Partial<AppState>) => void) {
  const st = get();
  // Freies Spiel: nichts speichern, nur den laufenden Spielstand verwerfen und als „erledigt" markieren.
  if (st.freePlay) {
    try { localStorage.removeItem(LS.live); } catch { /* ignore */ }
    set({ matchSaved: true });
    return;
  }
  const slice: CounterSlice = { gamePlayers: st.gamePlayers, allThrows: st.allThrows, startOffset: st.startOffset, settings: st.settings };
  const prog = cProgress(slice);
  const w = cMatchOver(slice) ? prog.winnerId : null;
  const winnerName = st.gamePlayers.find((p) => p.id === w)?.name || '';
  // Spieler-ID über den Namen auflösen (gamePlayer.id ist nur der Slot 1/2). Gäste-Namen ohne echten
  // Spieler bleiben ohne playerId → Statistik fällt für sie auf den Namen zurück.
  const byName = new Map(st.players.map((pl) => [pl.name, pl.id]));
  const winnerId = winnerName && byName.has(winnerName) ? byName.get(winnerName) : undefined;
  const perPlayer: MatchPlayerStat[] = st.gamePlayers.map((p) => {
    const fs = cFinishStats(slice, p.id);
    return {
      name: p.name, short: p.short, av: p.av,
      legsWon: prog.legsSet[p.id] || 0, setsWon: prog.setsWon[p.id] || 0,
      avg3: cAverage(slice, p.id), c180: countAtLeast(slice, p.id, 180, true), c140: countAtLeast(slice, p.id, 140),
      c100: countAtLeast(slice, p.id, 100), c60: countAtLeast(slice, p.id, 60),
      highFinish: fs.hf, co: fs.co, f9: cFirst9Match(slice, p.id),
      darts: st.allThrows.filter((t) => t.playerId === p.id).reduce((a, t) => a + (t.darts ?? 3), 0),
      shortLegs: cShortLegs(slice, p.id),
      ...((): { shortLegDarts?: number[] } => { const sld = cShortLegDarts(slice, p.id); return sld.length ? { shortLegDarts: sld } : {}; })(),
      ...(byName.has(p.name) ? { playerId: byName.get(p.name) } : {}),
    };
  });
  const unit = st.settings.unit;
  const scoreLine = st.gamePlayers.map((p) => unit === 'sets' ? (prog.setsWon[p.id] || 0) : (prog.legsSet[p.id] || 0)).join(':');
  const match: Match = {
    id: uid(), date: new Date().toISOString(), startScore: st.settings.startScore,
    doubleOut: st.settings.doubleOut, doubleIn: st.settings.doubleIn, unit, mode: st.gameMode,
    bestOf: st.settings.bestOf, bestOfSets: st.settings.bestOfSets,
    gameLabel: `X01 ${st.settings.startScore} · Bo${st.settings.bestOf}`, winnerName, ...(winnerId ? { winnerId } : {}), scoreLine, perPlayer,
    // #4: Ersteller stempeln (Vereinsmodus: muss == auth.id sein, sonst lehnt die API ab).
    ...(st.session ? { createdBy: st.session } : {}),
    ...(st.activeSeasonId ? { seasonId: st.activeSeasonId } : {}),
    ...(st.gameLink ? { leagueId: st.gameLink.leagueId, fixtureId: st.gameLink.fixtureId, positionId: st.gameLink.positionId } : {}),
  };
  const matches = [...st.matches, match];
  persist(st, set, LS.matches, matches, (p) => p.createRecord('matches', match as unknown as ProviderRecord));
  try { localStorage.removeItem(LS.live); } catch { /* ignore */ }
  set({ matches, matchSaved: true });
}

export { firstName, lastName };
