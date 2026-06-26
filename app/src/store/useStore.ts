import { create } from 'zustand';
import type {
  Player, Team, Account, League, Fixture, EventItem, Match, Settings, Screen,
  GamePlayer, Throw, Role, MatchPlayerStat, LineupPosition, FixtureLineup, LineupSegment, TeamKind,
} from '../data/types';
import { AVATARS, DEVICE_LOCAL_SETTING_KEYS, DEVICE_UI_KEYS, LEAGUE_FORMAT_PRESETS } from '../data/constants';
import { uid, firstName, lastName, initials } from '../lib/format';
import { downscaleSquare } from '../lib/image';
import {
  scores as cScores, progress as cProgress, currentPlayer as cCurrentPlayer,
  matchOver as cMatchOver, average as cAverage, countAtLeast,
  finishStats as cFinishStats, shortLegs as cShortLegs,
  type CounterSlice,
} from './counter';
import {
  DEFAULT_SETTINGS, seedPlayers, seedTeams, seedAccounts, seedLeagues, seedEvents, withDefaultPlayers,
} from '../data/seed';
import {
  newTrainGame, applyTurn as tApplyTurn, trainMeta,
  type TrainGame, type TrainPlayer, type TurnInput,
} from './training';
import { createProvider, type DataProvider } from '../data/dataProvider';
import type { ProviderRecord } from '../data/provider';
import { mergeSchedule, deriveOwnTeams, deriveLeagueEvents, type ParsedSchedule, type ImportCounts } from '../lib/scheduleImport';

const LS = {
  settings: 'dartshub_settings',
  players: 'dartshub_players',
  matches: 'dartshub_matches',
  training: 'dartshub_training',
  trainplays: 'dartshub_trainplays',
  live: 'dartshub_live',
  events: 'dartshub_events',
  teams: 'dartshub_teams',
  users: 'dartshub_users',
  session: 'dartshub_session',
  leagues: 'dartshub_leagues',
  pburl: 'dartshub_pburl',
  device: 'dartshub_device', // gerätelokale Konfiguration (Board-/Kiosk-Modus, Board-Bezeichnung)
  devui: 'dartshub_devui', // gerätelokale UI-Vorlieben (Eingabe-Modus, Hell/Dunkel, Größen) – Mischbetrieb PC/Tablet
};

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

// ── Modal-Typen ──
export interface PlayerModalState { mode: 'add' | 'edit'; id: string | null; first: string; last: string; short: string; avi: number; }
export interface TeamModalState { mode: 'add' | 'edit'; id: string | null; name: string; league: string; memberIds: string[]; captainId: string | null; viceCaptainIds: string[]; kind: TeamKind; }
export interface UserModalState { mode: 'add' | 'edit'; id: string | null; first: string; last: string; email: string; role: Role; playerId: string | null; active: boolean; avi: number; position: string; password: string; isBoard: boolean; boardNumber: number | null; }
export interface LeagueModalState { mode: 'add' | 'edit'; id: string | null; name: string; season: string; teams: { id: string; name: string; own: boolean }[]; singlesCount: number; doublesCount: number; format: LineupSegment[] | null; kind: TeamKind; }
export interface LineupModalState {
  leagueId: string; fixtureId: string;
  ownTeamName: string; oppName: string; ownIsHome: boolean;
  rosterIds: string[];                 // Kader-Spieler zur Auswahl (Player.id)
  positions: LineupPosition[];         // frei konfigurierbar, geordnet
  substitutes: string[];               // geordnet → E1, E2, …
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
export interface FixtureModalState { mode: 'add' | 'edit'; id: string | null; leagueId: string; homeId: string | null; awayId: string | null; date: string; played: boolean; hs: string; as: string; }
export interface EventModalState { mode: 'add' | 'edit'; id: string | null; scope: 'local' | 'verein'; title: string; date: string; time: string; type: string; loc: string; }

export interface SetupState {
  mode: 'single' | 'teams'; startScore: number; bestOf: number; bestOfSets: number;
  unit: 'legs' | 'sets'; doubleOut: boolean; outMode: 'single' | 'double' | 'master'; doubleIn: boolean; p1: number; p2: number; teamA: number; teamB: number;
  p1Guest?: string; p2Guest?: string; // Gast-Namen (überschreiben die Spielerwahl, wenn gesetzt)
  freePlay?: boolean;                  // Freies Spiel → wird nicht als Match gespeichert
  link?: { leagueId: string; fixtureId: string; positionId: string } | null; // Board-Spiel → Liga-Position
}
export interface HintState { title: string; body: string; }
export interface TrainSetupState { modeId: string; count: number; picks: number[]; }
export type NewAction = { kind: 'setup' } | { kind: 'preset'; preset: Partial<SetupState> };

export interface AppState {
  // navigation / session
  screen: Screen;
  selectedPlayerId: string | null;
  session: string | null;
  loginForm: { email: string; pw: string; err: string };
  now: number;

  // Datenquelle (lokal = localStorage, verein = PocketBase wenn VITE_PB_URL gesetzt)
  provider: DataProvider;
  // true, wenn ein echtes PocketBase-Backend aktiv ist (Login/Schreiben gehen an den Server)
  pbMode: boolean;
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
  eventModal: EventModalState | null;
  importOpen: boolean;

  // counter (game) state
  gamePlayers: GamePlayer[];
  allThrows: Throw[];
  input: string;
  startOffset: number;
  pendingStart: boolean;
  bullMode: boolean;
  spinPick: number | null;
  abortConfirm: boolean;
  matchSaved: boolean;
  freePlay: boolean;        // laufendes Spiel ist „Freies Spiel" → kein Speichern
  gameLink: { leagueId: string; fixtureId: string; positionId: string } | null; // Liga-Position des laufenden Spiels
  gameMode: 'single' | 'teams';
  setup: SetupState;
  hint: HintState | null;

  // training
  rulesMode: string | null;
  trainSetup: TrainSetupState | null;
  trainGame: TrainGame | null;
  trainUndo: TrainGame[];
  trainingPlays: Record<string, number>;

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
  setLoginField: (key: 'email' | 'pw', val: string) => void;
  login: (id: string) => void;
  loginEmail: () => void;
  logout: () => void;

  // Server-Sync (Verein)
  reloadFromProvider: () => void;
  clearSyncError: () => void;

  // settings
  setSetting: <K extends keyof Settings>(key: K, val: Settings[K]) => void;
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
  cycleUserAvi: (dir: number) => void;
  saveUserModal: () => void;
  deleteUser: (id: string) => void;
  toggleUserActive: (id: string) => void;
  // Board-Rechner-Konten nach festem Schema anlegen (Board 1…count, gemeinsames Passwort). Nur Vereinsmodus/Admin.
  createBoardAccounts: (count: number, password: string) => void;
  // Profilfoto für Spieler/Benutzerkonto setzen/entfernen (nur Vereinsmodus, PocketBase-File-Feld).
  uploadPhoto: (kind: 'player' | 'account', id: string, file: File) => Promise<void>;
  clearPhoto: (kind: 'player' | 'account', id: string) => Promise<void>;

  // league modal
  selectLeague: (i: number) => void;
  openAddLeague: () => void;
  openEditLeague: () => void;
  closeLeagueModal: () => void;
  setLeagueField: (key: 'name' | 'season' | 'kind', val: string) => void;
  setLeagueCount: (key: 'singlesCount' | 'doublesCount', val: number) => void;
  setLeagueFormatPreset: (key: 'BL' | 'LL' | 'custom') => void;
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

  // fixture modal
  openAddFixture: () => void;
  openEditFixture: (id: string) => void;
  closeFixtureModal: () => void;
  setFixtureField: (key: keyof FixtureModalState, val: string | boolean) => void;
  saveFixtureModal: () => void;
  deleteFixture: (id: string) => void;

  // event modal
  openAddEvent: (iso?: string) => void;
  openEditEvent: (id: string) => void;
  closeEventModal: () => void;
  setEventField: (key: keyof EventModalState, val: string) => void;
  saveEventModal: () => void;
  deleteEvent: (id: string) => void;

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
  startBoardGame: (leagueId: string, fixtureId: string, positionId: string, ownPlayerId: string, oppName: string) => void;
  chooseStarter: (idx: number) => void;
  openBullOff: () => void;
  closeBullOff: () => void;
  spinStarter: () => void;
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
  confirmNew: () => void;
  cancelNew: () => void;
  showHint: (hint: HintState) => void;
  closeHint: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  screen: 'dashboard',
  selectedPlayerId: null,
  session: null,
  loginForm: { email: '', pw: '', err: '' },
  now: Date.now(),

  provider: createProvider('local'),
  pbMode: false,
  kioskUnlocked: false,
  syncError: null,
  settings: DEFAULT_SETTINGS,
  players: [],
  teams: [],
  accounts: [],
  leagues: [],
  events: [],
  matches: [],

  selectedLeague: 0,
  selectedTeam: 0,

  playerModal: null,
  teamModal: null,
  userModal: null,
  leagueModal: null,
  lineupModal: null,
  resultModal: null,
  fixtureModal: null,
  eventModal: null,
  importOpen: false,

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
  abortConfirm: false,
  matchSaved: false,
  freePlay: false,
  gameLink: null,
  gameMode: 'single',
  setup: { mode: 'single', startScore: 501, bestOf: 5, bestOfSets: 3, unit: 'legs', doubleOut: true, outMode: 'double', doubleIn: false, p1: 0, p2: 1, teamA: 0, teamB: 1, p1Guest: '', p2Guest: '', freePlay: false, link: null },
  hint: null,

  rulesMode: null,
  trainSetup: null,
  trainGame: null,
  trainUndo: [],
  trainingPlays: {},
  restEntry: false,
  newConfirm: false,
  pendingNew: { kind: 'setup' },

  init() {
    const detected: 'local' | 'verein' = 'verein';
    const savedSettings = read<Partial<Settings> | null>(LS.settings, null);
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
    const reCombo = /^ctrl\+alt\+[a-z0-9]$/;
    if (!reCombo.test(settings.newGameKey || '')) settings.newGameKey = 'ctrl+alt+n';
    if (!reCombo.test(settings.quickBo5Key || '')) settings.quickBo5Key = 'ctrl+alt+5';
    if (!reCombo.test(settings.quickBo3Key || '')) settings.quickBo3Key = 'ctrl+alt+3';
    if (!savedSettings || savedSettings.appModeManual !== true) settings.appMode = detected;
    settings.appModeDetected = detected;

    // PocketBase-URL ist GERÄTE-LOKAL (eigener Key, nicht serverseitig) — jeder Rechner/Verein
    // trägt seine eigene Instanz ein. Hat Vorrang vor dem Build-Default VITE_PB_URL.
    const pbUrl = read<string>(LS.pburl, '');
    settings.pbUrl = pbUrl;

    // Board-/Kiosk-Konfiguration + Namens-Sortierung sind GERÄTE-LOKAL (jeder Rechner/Nutzer für sich).
    const dev = read<{ kiosk?: boolean; boardName?: string; nameOrder?: 'first' | 'last' }>(LS.device, {});
    settings.kiosk = !!dev.kiosk;
    settings.boardName = dev.boardName || '';
    settings.nameOrder = dev.nameOrder || settings.nameOrder || 'first';

    // Datenquelle wählen. provider.mode === 'verein' nur, wenn eine URL vorliegt (Einstellung
    // oder VITE_PB_URL); sonst Fallback auf LocalProvider → lokaler & Demo-Pfad unverändert.
    const provider = createProvider(settings.appMode, pbUrl);
    if (provider.mode === 'verein') {
      // Echter PocketBase-Pfad: Daten vom Server, echte Auth, Schreiben & Realtime.
      // Eine wiederhergestellte Session eines zwischenzeitlich deaktivierten Kontos verwerfen.
      const restored = provider.currentUser();
      if (restored && !restored.active) { void provider.logout(); }
      const session = restored && restored.active ? restored.id : null;
      set({ settings, provider, pbMode: true, session });
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

    let leagues = read<League[]>(LS.leagues, []);
    if (!Array.isArray(leagues) || leagues.length === 0) { leagues = seedLeagues(); write(LS.leagues, leagues); }

    let events = read<EventItem[]>(LS.events, []);
    if (!Array.isArray(events) || events.length === 0) { events = seedEvents(); write(LS.events, events); }

    const matches = read<Match[]>(LS.matches, []);
    const session = read<string | null>(LS.session, null);
    const trainingPlays = read<Record<string, number>>(LS.trainplays, {});

    set({ settings, provider, pbMode: false, players, teams, accounts, leagues, events, matches, session, trainingPlays });
  },

  reloadFromProvider() { void applySnapshot(get, set); },
  clearSyncError() { set({ syncError: null }); },

  go(screen) { set({ screen }); },
  openPlayer(id) { set({ selectedPlayerId: id, screen: 'playerDetail' }); },

  setLoginField(key, val) { set((st) => ({ loginForm: { ...st.loginForm, [key]: val, err: '' } })); },
  // Schnellanmeldung per Konto-Klick — nur im lokalen Demo-Modus (kein Passwort).
  login(id) {
    if (get().pbMode) return; // im echten Vereinsmodus ist Passwort-Login Pflicht
    const acc = get().accounts.find((a) => a.id === id);
    if (!acc || !acc.active) return;
    write(LS.session, id);
    set({ session: id, screen: 'dashboard', loginForm: { email: '', pw: '', err: '' } });
  },
  loginEmail() {
    const st = get();
    const email = st.loginForm.email.trim();
    if (st.pbMode) {
      // Echte PocketBase-Anmeldung mit E-Mail + Passwort.
      void st.provider.login(email, st.loginForm.pw).then((user) => {
        // Deaktivierte Konten dürfen sich nicht anmelden (analog zum lokalen Modus).
        // Server-seitig ebenfalls per authRule "active = true" erzwungen; diese Prüfung
        // liefert die verständliche Meldung und greift auch bei Altinstanzen ohne Rule.
        if (!user.active) {
          void st.provider.logout();
          set((s) => ({ session: null, loginForm: { ...s.loginForm, err: 'Dieses Konto ist deaktiviert. Bitte wende dich an die Vereinsverwaltung.' } }));
          return;
        }
        set({ session: user.id, screen: 'dashboard', loginForm: { email: '', pw: '', err: '' } });
        void applySnapshot(get, set); // Daten + persönliche Einstellungen des Nutzers nachladen
      }).catch(() => {
        set((s) => ({ loginForm: { ...s.loginForm, err: 'Anmeldung fehlgeschlagen. E-Mail oder Passwort falsch.' } }));
      });
      return;
    }
    // Lokaler Demo-Modus: Konto per E-Mail finden (Passwort beliebig).
    const acc = st.accounts.find((a) => a.email.toLowerCase() === email.toLowerCase() && a.active);
    if (!acc) { set((s) => ({ loginForm: { ...s.loginForm, err: 'Kein aktives Konto mit dieser E-Mail.' } })); return; }
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
    // Rolle VORAB aus den geladenen Konten prüfen (kein Login-Versuch bei falscher Rolle), damit die
    // bestehende Board-Sitzung unangetastet bleibt. Nur Admin/Kapitän dürfen den Board-Modus verlassen.
    const acc = st.accounts.find((a) => a.email.trim().toLowerCase() === email.trim().toLowerCase());
    if (!acc || !acc.active || (acc.role !== 'admin' && acc.role !== 'captain')) return false;
    if (!st.pbMode) {
      // Lokaler/Demo-Pfad: Passwort beliebig.
      write(LS.session, acc.id);
      set({ session: acc.id, kioskUnlocked: true, screen: 'dashboard' });
      return true;
    }
    try {
      // Ein fehlgeschlagener authWithPassword lässt die aktuelle Sitzung im PB-Client unberührt.
      const user = await st.provider.login(email.trim(), pw);
      if (!user.active) return false;
      set({ session: user.id, kioskUnlocked: true, screen: 'dashboard' });
      void applySnapshot(get, set);
      return true;
    } catch {
      return false;
    }
  },
  // „Zurück zum Board": Kapitäns-/Admin-Sitzung beenden → der Board-Rechner meldet sich wieder mit seinem Board-Konto an.
  relockKiosk() { get().logout(); set({ kioskUnlocked: false, screen: 'setup' }); },

  // ── Daten-Backup (Export/Import aller gespeicherten Daten) ──
  exportData() {
    const data: Record<string, unknown> = {};
    (Object.keys(LS) as (keyof typeof LS)[]).forEach((k) => {
      if (k === 'live') return; // laufendes Spiel nicht sichern
      const raw = localStorage.getItem(LS[k]);
      if (raw != null) { try { data[LS[k]] = JSON.parse(raw); } catch { /* überspringen */ } }
    });
    return JSON.stringify({ app: 'dartshub', version: 1, exportedAt: new Date().toISOString(), data }, null, 2);
  },
  importData(json) {
    try {
      const parsed = JSON.parse(json);
      const data = (parsed && typeof parsed === 'object' && 'data' in parsed ? parsed.data : parsed) as Record<string, unknown> | null;
      if (!data || typeof data !== 'object') return false;
      let any = false;
      Object.entries(data).forEach(([k, v]) => {
        if (k.startsWith('dartshub_') && k !== LS.live) { localStorage.setItem(k, JSON.stringify(v)); any = true; }
      });
      return any;
    } catch { return false; }
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
        persist(st, set, LS.players, players, (p) => p.updateRecord('players', m.id!, rec as unknown as ProviderRecord));
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
          void st.provider.updateRecord('teams', nt.id, nt as unknown as ProviderRecord).catch((e) => { console.error('[sync]', e); set({ syncError: 'Mannschaft konnte nicht aktualisiert werden.' }); });
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
      const rec: Team = { id: m.id || uid(), name, league: m.league.trim(), memberIds: m.memberIds, captainId, viceCaptainIds, kind: m.kind };
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
  openAddUser() { set({ userModal: { mode: 'add', id: null, first: '', last: '', email: '', role: 'player', playerId: null, active: true, avi: 0, position: '', password: '', isBoard: false, boardNumber: null } }); },
  // Neues Benutzerkonto direkt aus einem Spieler vorbefüllen (Vor-/Nachname, Avatar, Verknüpfung).
  // Nur sinnvoll im Vereinsmodus; E-Mail/Passwort/Rolle ergänzt der Admin im Modal.
  openAddUserForPlayer(playerId) {
    const pl = get().players.find((x) => x.id === playerId); if (!pl) return;
    set({ userModal: { mode: 'add', id: null, first: firstName(pl.name), last: lastName(pl.name), email: '', role: 'player', playerId: pl.id, active: true, avi: pl.avi ?? 0, position: '', password: '', isBoard: false, boardNumber: null } });
  },
  openEditUser(id) {
    const a = get().accounts.find((x) => x.id === id); if (!a) return;
    set({ userModal: { mode: 'edit', id: a.id, first: a.first, last: a.last, email: a.email, role: a.role, playerId: a.playerId, active: a.active, avi: a.avi, position: a.position || '', password: '', isBoard: !!a.isBoard, boardNumber: a.boardNumber ?? null } });
  },
  closeUserModal() { set({ userModal: null }); },
  setUserField(key, val) { set((st) => st.userModal ? { userModal: { ...st.userModal, [key]: val } as UserModalState } : {}); },
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
        if (m.password) body.password = m.password;
        persist(st, set, LS.users, accounts, (p) => p.updateRecord('accounts', m.id!, body));
      }
      return { accounts, userModal: null };
    });
  },
  deleteUser(id) {
    set((st) => {
      const accounts = st.accounts.filter((a) => a.id !== id);
      persist(st, set, LS.users, accounts, (p) => p.deleteRecord('accounts', id));
      return { accounts, userModal: null };
    });
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
    if (st.provider.mode !== 'verein') { set({ syncError: 'Board-Konten gibt es nur im Vereinsmodus (mit Server).' }); return; }
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
    if (st.provider.mode !== 'verein') { set({ syncError: 'Profilfotos gibt es nur im Vereinsmodus.' }); return; }
    const coll = kind === 'player' ? 'players' : 'accounts';
    try {
      const blob = await downscaleSquare(file, 256); // klein halten: zentriertes 256er-Quadrat
      await st.provider.uploadPhoto(coll, id, blob);
      await applySnapshot(get, set);
    } catch (e) { console.error('[photo]', e); set({ syncError: 'Foto konnte nicht gespeichert werden.' }); }
  },
  async clearPhoto(kind, id) {
    const st = get();
    if (st.provider.mode !== 'verein') return;
    const coll = kind === 'player' ? 'players' : 'accounts';
    try { await st.provider.clearPhoto(coll, id); await applySnapshot(get, set); }
    catch (e) { console.error('[photo]', e); set({ syncError: 'Foto konnte nicht entfernt werden.' }); }
  },

  // ── league modal ──
  selectLeague(i) { set({ selectedLeague: i }); },
  openAddLeague() { set({ leagueModal: { mode: 'add', id: null, name: '', season: '2025/26', teams: [], singlesCount: 4, doublesCount: 2, format: null, kind: 'league' } }); },
  openEditLeague() {
    const st = get(); const lg = st.leagues[Math.max(0, Math.min(st.leagues.length - 1, st.selectedLeague))]; if (!lg) return;
    set({ leagueModal: { mode: 'edit', id: lg.id, name: lg.name, season: lg.season || '', teams: lg.teams.map((t) => ({ ...t })), singlesCount: lg.singlesCount ?? 4, doublesCount: lg.doublesCount ?? 2, format: lg.format ? lg.format.map((s) => ({ ...s })) : null, kind: lg.kind === 'cup' ? 'cup' : 'league' } });
  },
  closeLeagueModal() { set({ leagueModal: null }); },
  setLeagueField(key, val) { set((st) => st.leagueModal ? { leagueModal: { ...st.leagueModal, [key]: val } } : {}); },
  setLeagueCount(key, val) { set((st) => st.leagueModal ? { leagueModal: { ...st.leagueModal, [key]: Math.max(0, Math.min(12, val | 0)) } } : {}); },
  setLeagueFormatPreset(key) {
    set((st) => {
      if (!st.leagueModal) return {};
      if (key === 'custom') return { leagueModal: { ...st.leagueModal, format: null } };
      const preset = LEAGUE_FORMAT_PRESETS[key];
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
      const rec: League = { id: m.id || uid(), name, season: m.season.trim(), teams, fixtures: existing ? existing.fixtures : [], format: m.format && m.format.length ? m.format : undefined, singlesCount: segTotal(segs, 'singles'), doublesCount: segTotal(segs, 'doubles'), kind: m.kind };
      let leagues: League[]; let selectedLeague = st.selectedLeague;
      if (m.mode === 'add') { leagues = [...st.leagues, rec]; selectedLeague = leagues.length - 1; }
      else leagues = st.leagues.map((l) => l.id === m.id ? rec : l);
      persist(st, set, LS.leagues, leagues, (p) => m.mode === 'add'
        ? p.createRecord('leagues', rec as unknown as ProviderRecord)
        : p.updateRecord('leagues', rec.id, rec as unknown as ProviderRecord));
      return { leagues, leagueModal: null, selectedLeague };
    });
  },
  deleteLeague(id) {
    set((st) => {
      const leagues = st.leagues.filter((l) => l.id !== id);
      persist(st, set, LS.leagues, leagues, (p) => p.deleteRecord('leagues', id));
      return { leagues, leagueModal: null, selectedLeague: Math.max(0, Math.min(leagues.length - 1, st.selectedLeague)) };
    });
  },

  // ── Mannschaftsaufstellung (frei konfigurierbar pro Begegnung, nur eigene Mannschaft) ──
  openLineup(fixtureId) {
    const st = get();
    const lg = st.leagues[Math.max(0, Math.min(st.leagues.length - 1, st.selectedLeague))]; if (!lg) return;
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
    set({ lineupModal: { leagueId: lg.id, fixtureId, ownTeamName: ownTeam.name, oppName: opp ? opp.name : '—', ownIsHome, rosterIds, positions, substitutes } });
  },
  openLineupAt(leagueIndex, fixtureId) {
    const i = Math.max(0, Math.min(get().leagues.length - 1, leagueIndex));
    set({ selectedLeague: i });
    get().openLineup(fixtureId); // liest selectedLeague (gerade gesetzt) und öffnet das Modal
  },
  closeLineup() { set({ lineupModal: null }); },
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
        changed = { ...l, fixtures: l.fixtures.map((f) => f.id === m.fixtureId ? { ...f, lineup } : f) };
        return changed;
      });
      if (changed) persist(st, set, LS.leagues, leagues, (p) => p.updateRecord('leagues', changed!.id, changed! as unknown as ProviderRecord));
      return { leagues, lineupModal: null };
    });
  },

  // ── Brett-für-Brett-Ergebniserfassung (Spielbericht) ──
  openResult(fixtureId) {
    const st = get();
    const lg = st.leagues[Math.max(0, Math.min(st.leagues.length - 1, st.selectedLeague))]; if (!lg) return;
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
    set((st) => st.resultModal ? { resultModal: { ...st.resultModal, rows: st.resultModal.rows.map((r) => r.id === id ? { ...r, [side === 'own' ? 'ownLegs' : 'oppLegs']: v, auto: false } : r) } } : {});
  },
  saveResult() {
    const m = get().resultModal; if (!m) return;
    const ownWins = m.rows.filter((r) => r.won === 'own').length;
    const oppWins = m.rows.filter((r) => r.won === 'opp').length;
    const played = ownWins + oppWins > 0;
    const hsVal = m.ownIsHome ? ownWins : oppWins;
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
            const ol = parseInt(row.ownLegs, 10); const pl = parseInt(row.oppLegs, 10);
            return { ...p, result: { won: row.won, ...(isNaN(ol) ? {} : { ownLegs: ol }), ...(isNaN(pl) ? {} : { oppLegs: pl }) } };
          });
          return { ...f, lineup: { ...f.lineup, positions }, played, hs: played ? hsVal : ('' as const), as: played ? asVal : ('' as const) };
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
    const { leagues, touched, counts } = mergeSchedule(st.leagues, parsed);
    // Eigene Mannschaften zusätzlich im Mannschaften-Screen anlegen (Kader leer).
    const newTeams = deriveOwnTeams(leagues, st.teams);
    counts.ownTeamsNew = newTeams.length;
    const teams = newTeams.length ? [...st.teams, ...newTeams] : st.teams;
    // Kalender-Termine für eigene Begegnungen ableiten (idempotent gegen vorhandene).
    const newEvents = deriveLeagueEvents(parsed, st.events);
    counts.eventsNew = newEvents.length;
    const events = newEvents.length ? [...st.events, ...newEvents] : st.events;
    if (st.provider.mode === 'verein') {
      // Pro betroffener Liga anlegen/aktualisieren (PocketBase speichert teams/fixtures als JSON).
      touched.forEach(({ id, isNew }) => {
        const rec = leagues.find((l) => l.id === id);
        if (!rec) return;
        const op = isNew
          ? st.provider.createRecord('leagues', rec as unknown as ProviderRecord)
          : st.provider.updateRecord('leagues', id, rec as unknown as ProviderRecord);
        void op.catch((e) => { console.error('[sync]', e); set({ syncError: 'Import konnte nicht vollständig gespeichert werden.' }); });
      });
      newTeams.forEach((t) => {
        void st.provider.createRecord('teams', t as unknown as ProviderRecord)
          .catch((e) => { console.error('[sync]', e); set({ syncError: 'Mannschaft konnte nicht angelegt werden.' }); });
      });
      newEvents.forEach((e) => {
        void st.provider.createRecord('events', e as unknown as ProviderRecord)
          .catch((err) => { console.error('[sync]', err); set({ syncError: 'Termin konnte nicht angelegt werden.' }); });
      });
    } else {
      write(LS.leagues, leagues);
      if (newTeams.length) write(LS.teams, teams);
      if (newEvents.length) write(LS.events, events);
    }
    set({ leagues, teams, events, selectedLeague: 0 });
    return counts;
  },

  // ── fixture modal ──
  openAddFixture() {
    const st = get(); const lg = st.leagues[Math.max(0, Math.min(st.leagues.length - 1, st.selectedLeague))]; if (!lg) return;
    const ts = lg.teams || [];
    const own = ts.find((t) => t.own) || ts[0] || null;
    const other = ts.find((t) => own && t.id !== own.id) || null;
    const d = new Date(); d.setDate(d.getDate() + 7);
    set({ fixtureModal: { mode: 'add', id: null, leagueId: lg.id, homeId: own ? own.id : null, awayId: other ? other.id : null, date: d.toISOString().slice(0, 10), played: false, hs: '', as: '' } });
  },
  openEditFixture(id) {
    const st = get(); const lg = st.leagues[Math.max(0, Math.min(st.leagues.length - 1, st.selectedLeague))]; if (!lg) return;
    const f = lg.fixtures.find((x) => x.id === id); if (!f) return;
    set({ fixtureModal: { mode: 'edit', id: f.id, leagueId: lg.id, homeId: f.homeId, awayId: f.awayId, date: f.date || '', played: !!f.played, hs: f.hs === '' ? '' : String(f.hs), as: f.as === '' ? '' : String(f.as) } });
  },
  closeFixtureModal() { set({ fixtureModal: null }); },
  setFixtureField(key, val) { set((st) => st.fixtureModal ? { fixtureModal: { ...st.fixtureModal, [key]: val } as FixtureModalState } : {}); },
  saveFixtureModal() {
    const m = get().fixtureModal; if (!m) return;
    if (!m.homeId || !m.awayId || m.homeId === m.awayId) return;
    set((st) => {
      let changed: League | null = null;
      const leagues = st.leagues.map((l) => {
        if (l.id !== m.leagueId) return l;
        const rec: Fixture = { id: m.id || uid(), homeId: m.homeId!, awayId: m.awayId!, date: m.date, played: m.played, hs: m.played ? (parseInt(m.hs, 10) || 0) : '', as: m.played ? (parseInt(m.as, 10) || 0) : '' };
        const fixtures = m.mode === 'add' ? [...l.fixtures, rec] : l.fixtures.map((f) => f.id === m.id ? rec : f);
        changed = { ...l, fixtures };
        return changed;
      });
      if (changed) persist(st, set, LS.leagues, leagues, (p) => p.updateRecord('leagues', changed!.id, changed! as unknown as ProviderRecord));
      return { leagues, fixtureModal: null };
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
      return { leagues, fixtureModal: null };
    });
  },

  // ── event modal ──
  openAddEvent(isoDate) {
    const scope = get().settings.appMode === 'local' ? 'local' : 'verein';
    set({ eventModal: { mode: 'add', id: null, scope, title: '', date: isoDate || new Date().toISOString().slice(0, 10), time: '19:00', type: 'training', loc: '' } });
  },
  openEditEvent(id) {
    const e = get().events.find((x) => x.id === id); if (!e) return;
    set({ eventModal: { mode: 'edit', id: e.id, scope: e.scope, title: e.title, date: e.date, time: e.time, type: e.type, loc: e.loc } });
  },
  closeEventModal() { set({ eventModal: null }); },
  setEventField(key, val) { set((st) => st.eventModal ? { eventModal: { ...st.eventModal, [key]: val } as EventModalState } : {}); },
  saveEventModal() {
    const m = get().eventModal; if (!m) return;
    const title = m.title.trim(); if (!title) return;
    set((st) => {
      const rec: EventItem = { id: m.id || uid(), scope: m.scope, title, date: m.date, time: m.time, type: m.type, loc: m.loc.trim() };
      const events = m.mode === 'add' ? [...st.events, rec] : st.events.map((e) => e.id === m.id ? rec : e);
      persist(st, set, LS.events, events, (p) => m.mode === 'add'
        ? p.createRecord('events', rec as unknown as ProviderRecord)
        : p.updateRecord('events', rec.id, rec as unknown as ProviderRecord));
      return { events, eventModal: null };
    });
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
      players.push({ id: `t${i}_${p.id}`, name: p.name, short: p.short, av: p.avi, photo: p.photo });
    }
    const trainingPlays = { ...st.trainingPlays, [su.modeId]: (st.trainingPlays[su.modeId] || 0) + 1 };
    if (st.provider.mode === 'verein') void st.provider.saveTrainingPlays(trainingPlays).catch((e) => { console.error('[sync]', e); });
    else write(LS.trainplays, trainingPlays);
    set({ trainGame: newTrainGame(su.modeId, players), trainUndo: [], trainingPlays, screen: 'trainGame' });
  },
  trainApply(input) {
    const st = get(); const g = st.trainGame; if (!g || g.over) return;
    const next = tApplyTurn(g, input);
    set({ trainGame: next, trainUndo: [...st.trainUndo, g].slice(-50) });
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
    set({ trainGame: newTrainGame(g.modeId, g.players), trainUndo: [] });
  },
  trainExit() { set({ trainGame: null, trainUndo: [], trainSetup: null, screen: 'training' }); },

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
    set({ gamePlayers, gameMode: su.mode, allThrows: [], input: '', screen: 'counter', settings, startOffset: 0, pendingStart: true, bullMode: false, spinPick: null, matchSaved: false, freePlay: !!su.freePlay, gameLink: su.link || null, hint: null, abortConfirm: false });
  },
  quickStart(preset) {
    // Schnellstart = normales, gewertetes Spiel: Gast-Namen, Freies-Spiel & Liga-Verknüpfung zurücksetzen.
    set((st) => ({ setup: { ...st.setup, mode: 'single', p1: 0, p2: 1, p1Guest: '', p2Guest: '', freePlay: false, link: null, ...(preset || {}) } }));
    get().startGame();
  },
  // Startet ein konkretes Ligaspiel vom Board: eigener Spieler als Slot 0, Gegner als Gast, mit Positions-Verknüpfung.
  startBoardGame(leagueId, fixtureId, positionId, ownPlayerId, oppName) {
    const st = get();
    const idx = st.players.findIndex((p) => p.id === ownPlayerId);
    set((s) => ({ setup: { ...s.setup, mode: 'single', p1: idx < 0 ? 0 : idx, p1Guest: '', p2Guest: (oppName || 'Gast'), freePlay: false, link: { leagueId, fixtureId, positionId } } }));
    get().startGame();
  },
  chooseStarter(idx) { set({ startOffset: idx, pendingStart: false, bullMode: false, spinPick: null }); },
  openBullOff() { set({ bullMode: true }); },
  closeBullOff() { set({ bullMode: false }); },
  spinStarter() {
    const n = get().gamePlayers.length;
    const final = Math.floor(Math.random() * n);
    let ticks = 0; const total = 14 + final;
    const tick = () => {
      set({ spinPick: ticks % n }); ticks++;
      if (ticks <= total) { const delay = 60 + Math.pow(ticks / total, 2) * 220; setTimeout(tick, delay); }
      else { setTimeout(() => get().chooseStarter(final), 480); }
    };
    tick();
  },
  rematch() { try { localStorage.removeItem(LS.live); } catch { /* ignore */ } set({ allThrows: [], input: '', matchSaved: false, pendingStart: true, bullMode: false, spinPick: null }); },
  endGameTo(target) {
    try { localStorage.removeItem(LS.live); } catch { /* ignore */ }
    set({ allThrows: [], input: '', matchSaved: false, pendingStart: false, bullMode: false, spinPick: null, abortConfirm: false, hint: null });
    if (target === 'setup') get().goSetup();
    else set({ screen: 'dashboard' });
  },
  abortGame() { set({ abortConfirm: true }); },
  confirmAbort() { try { localStorage.removeItem(LS.live); } catch { /* ignore */ } set({ abortConfirm: false, allThrows: [], input: '', matchSaved: false, screen: 'dashboard' }); },
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
    const after: CounterSlice = { ...slice, allThrows };
    if (cMatchOver(after) && !st.matchSaved) saveMatch(get, set);
    else persistLive(get);
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
  undo() { set((st) => ({ allThrows: st.allThrows.slice(0, -1), input: '' })); persistLive(get); },
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
    set({ allThrows: [], input: '', matchSaved: false, pendingStart: false, bullMode: false, spinPick: null, restEntry: false, abortConfirm: false, newConfirm: false });
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
}));

// ── Persistenz-Routing: lokal → localStorage (volle Liste), verein → PocketBase (pro Datensatz) ──
type SetFn = (p: Partial<AppState>) => void;

function persist(st: AppState, set: SetFn, lsKey: string, fullArray: unknown, verein: (p: DataProvider) => Promise<unknown>) {
  if (st.provider.mode === 'verein') {
    void verein(st.provider).catch((e) => { console.error('[sync]', e); set({ syncError: 'Änderung konnte nicht gespeichert werden.' }); });
  } else {
    write(lsKey, fullArray);
  }
}
function persistSettings(st: AppState, set: SetFn, settings: Settings) {
  if (st.provider.mode === 'verein') {
    // pbUrl ist gerätelokal → nicht zum Server synchronisieren (sonst würde sie geräteübergreifend verteilt).
    const serverSettings: Settings = { ...settings };
    delete (serverSettings as Partial<Settings>).pbUrl;
    void st.provider.saveSettings(serverSettings).catch((e) => { console.error('[sync]', e); set({ syncError: 'Einstellungen konnten nicht gespeichert werden.' }); });
  } else {
    write(LS.settings, settings);
  }
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
        set({ session: null, screen: 'dashboard', loginForm: { email: '', pw: '', err: 'Dein Konto wurde deaktiviert. Bitte wende dich an die Vereinsverwaltung.' } });
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
    if (snap.clubName !== undefined) merged.clubName = snap.clubName;
    if (snap.clubLogo !== undefined) merged.clubLogo = snap.clubLogo;
    set({
      settings: merged,
      players: withDefaultPlayers(snap.players), teams: snap.teams, accounts: snap.accounts,
      leagues: snap.leagues, events: snap.events, matches: snap.matches,
      trainingPlays: snap.trainingPlays, syncError: null,
    });
  } catch (e) {
    console.error('[load]', e);
    set({ syncError: 'Daten konnten nicht vom Server geladen werden.' });
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
  const perPlayer: MatchPlayerStat[] = st.gamePlayers.map((p) => ({
    name: p.name, short: p.short, av: p.av,
    legsWon: prog.legsSet[p.id] || 0, setsWon: prog.setsWon[p.id] || 0,
    avg3: cAverage(slice, p.id), c180: countAtLeast(slice, p.id, 180, true), c140: countAtLeast(slice, p.id, 140),
    c100: countAtLeast(slice, p.id, 100), c60: countAtLeast(slice, p.id, 60),
    highFinish: cFinishStats(slice, p.id).hf, darts: st.allThrows.filter((t) => t.playerId === p.id).length * 3,
    shortLegs: cShortLegs(slice, p.id),
  }));
  const unit = st.settings.unit;
  const scoreLine = st.gamePlayers.map((p) => unit === 'sets' ? (prog.setsWon[p.id] || 0) : (prog.legsSet[p.id] || 0)).join(':');
  const match: Match = {
    id: uid(), date: new Date().toISOString(), startScore: st.settings.startScore,
    doubleOut: st.settings.doubleOut, doubleIn: st.settings.doubleIn, unit, mode: st.gameMode,
    bestOf: st.settings.bestOf, bestOfSets: st.settings.bestOfSets,
    gameLabel: `X01 ${st.settings.startScore} · Bo${st.settings.bestOf}`, winnerName, scoreLine, perPlayer,
    ...(st.gameLink ? { leagueId: st.gameLink.leagueId, fixtureId: st.gameLink.fixtureId, positionId: st.gameLink.positionId } : {}),
  };
  const matches = [...st.matches, match];
  persist(st, set, LS.matches, matches, (p) => p.createRecord('matches', match as unknown as ProviderRecord));
  try { localStorage.removeItem(LS.live); } catch { /* ignore */ }
  set({ matches, matchSaved: true });
}

export { firstName, lastName };
