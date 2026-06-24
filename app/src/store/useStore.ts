import { create } from 'zustand';
import type {
  Player, Team, Account, League, Fixture, EventItem, Match, Settings, Screen,
  GamePlayer, Throw, Role, MatchPlayerStat,
} from '../data/types';
import { AVATARS } from '../data/constants';
import { uid, firstName, lastName } from '../lib/format';
import {
  scores as cScores, progress as cProgress, currentPlayer as cCurrentPlayer,
  matchOver as cMatchOver, average as cAverage, countAtLeast,
  type CounterSlice,
} from './counter';
import {
  DEFAULT_SETTINGS, seedPlayers, seedTeams, seedAccounts, seedLeagues, seedEvents,
} from '../data/seed';
import {
  newTrainGame, applyTurn as tApplyTurn, trainMeta,
  type TrainGame, type TrainPlayer, type TurnInput,
} from './training';
import { createProvider, type DataProvider } from '../data/dataProvider';

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
};

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
export interface PlayerModalState { mode: 'add' | 'edit'; id: string | null; name: string; short: string; avi: number; }
export interface TeamModalState { mode: 'add' | 'edit'; id: string | null; name: string; league: string; memberIds: string[]; captainId: string | null; }
export interface UserModalState { mode: 'add' | 'edit'; id: string | null; first: string; last: string; email: string; role: Role; playerId: string | null; active: boolean; avi: number; position: string; }
export interface LeagueModalState { mode: 'add' | 'edit'; id: string | null; name: string; season: string; teams: { id: string; name: string; own: boolean }[]; }
export interface FixtureModalState { mode: 'add' | 'edit'; id: string | null; leagueId: string; homeId: string | null; awayId: string | null; date: string; played: boolean; hs: string; as: string; }
export interface EventModalState { mode: 'add' | 'edit'; id: string | null; scope: 'local' | 'verein'; title: string; date: string; time: string; type: string; loc: string; }

export interface SetupState {
  mode: 'single' | 'teams'; startScore: number; bestOf: number; bestOfSets: number;
  unit: 'legs' | 'sets'; doubleOut: boolean; outMode: 'single' | 'double' | 'master'; doubleIn: boolean; p1: number; p2: number; teamA: number; teamB: number;
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
  fixtureModal: FixtureModalState | null;
  eventModal: EventModalState | null;

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

  // settings
  setSetting: <K extends keyof Settings>(key: K, val: Settings[K]) => void;
  setFKey: (i: number, val: string) => void;

  // Daten-Backup
  exportData: () => string;
  importData: (json: string) => boolean;

  // player modal
  openAddPlayer: () => void;
  openEditPlayer: (id: string) => void;
  closePlayerModal: () => void;
  setPlayerField: (key: 'name' | 'short', val: string) => void;
  cyclePlayerAvi: (dir: number) => void;
  savePlayerModal: () => void;
  deletePlayer: (id: string) => void;

  // team modal
  selectTeam: (i: number) => void;
  openAddTeam: () => void;
  openEditTeam: () => void;
  closeTeamModal: () => void;
  setTeamField: (key: 'name' | 'league', val: string) => void;
  toggleTeamMember: (pid: string) => void;
  setTeamCaptain: (pid: string) => void;
  saveTeamModal: () => void;
  deleteTeam: (id: string) => void;

  // user modal
  openAddUser: () => void;
  openEditUser: (id: string) => void;
  closeUserModal: () => void;
  setUserField: (key: keyof UserModalState, val: string | boolean | null) => void;
  cycleUserAvi: (dir: number) => void;
  saveUserModal: () => void;
  deleteUser: (id: string) => void;
  toggleUserActive: (id: string) => void;

  // league modal
  selectLeague: (i: number) => void;
  openAddLeague: () => void;
  openEditLeague: () => void;
  closeLeagueModal: () => void;
  setLeagueField: (key: 'name' | 'season', val: string) => void;
  addLeagueTeam: () => void;
  setLeagueTeamName: (id: string, val: string) => void;
  toggleLeagueTeamOwn: (id: string) => void;
  removeLeagueTeam: (id: string) => void;
  saveLeagueModal: () => void;
  deleteLeague: (id: string) => void;

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
  fixtureModal: null,
  eventModal: null,

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
  gameMode: 'single',
  setup: { mode: 'single', startScore: 501, bestOf: 5, bestOfSets: 3, unit: 'legs', doubleOut: true, outMode: 'double', doubleIn: false, p1: 0, p2: 1, teamA: 0, teamB: 1 },
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

    // Datenquelle wählen. provider.mode === 'verein' nur, wenn auch VITE_PB_URL gesetzt ist
    // (sonst Fallback auf LocalProvider) → lokaler & Vereins-Demo-Pfad bleiben unverändert.
    const provider = createProvider(settings.appMode);
    if (provider.mode === 'verein') {
      // Aktiver PocketBase-Pfad (Phase 2: Auth-Flow + Schreiben + Liga-/Prefs-Mapping).
      set({ settings, provider, session: provider.currentUser()?.id ?? null });
      void provider.loadAll().then((snap) => set({
        players: snap.players, teams: snap.teams, accounts: snap.accounts,
        leagues: snap.leagues, events: snap.events, matches: snap.matches,
        trainingPlays: snap.trainingPlays,
      })).catch(() => { /* Phase 2: Auth/Fehlerbehandlung */ });
      return;
    }

    let players = read<Player[]>(LS.players, []);
    if (!Array.isArray(players) || players.length === 0) {
      players = seedPlayers();
      write(LS.players, players);
    }
    players = players.map((p) => (p.id === 'p_seed1' || p.id === 'p_seed2') ? { ...p, locked: true } : p);

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

    set({ settings, provider, players, teams, accounts, leagues, events, matches, session, trainingPlays });
  },

  go(screen) { set({ screen }); },
  openPlayer(id) { set({ selectedPlayerId: id, screen: 'playerDetail' }); },

  setLoginField(key, val) { set((st) => ({ loginForm: { ...st.loginForm, [key]: val, err: '' } })); },
  login(id) {
    const acc = get().accounts.find((a) => a.id === id);
    if (!acc || !acc.active) return;
    write(LS.session, id);
    set({ session: id, screen: 'dashboard', loginForm: { email: '', pw: '', err: '' } });
  },
  loginEmail() {
    const email = get().loginForm.email.trim().toLowerCase();
    const acc = get().accounts.find((a) => a.email.toLowerCase() === email && a.active);
    if (!acc) { set((st) => ({ loginForm: { ...st.loginForm, err: 'Kein aktives Konto mit dieser E-Mail.' } })); return; }
    get().login(acc.id);
  },
  logout() { write(LS.session, null); set({ session: null }); },

  setSetting(key, val) {
    set((st) => {
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
      write(LS.settings, settings);
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
      write(LS.settings, settings);
      return { settings };
    });
  },

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
  openAddPlayer() { set({ playerModal: { mode: 'add', id: null, name: '', short: '', avi: 0 } }); },
  openEditPlayer(id) {
    const p = get().players.find((x) => x.id === id); if (!p) return;
    set({ playerModal: { mode: 'edit', id: p.id, name: p.name, short: p.short, avi: p.avi } });
  },
  closePlayerModal() { set({ playerModal: null }); },
  setPlayerField(key, val) { set((st) => st.playerModal ? { playerModal: { ...st.playerModal, [key]: key === 'short' ? val.slice(0, 3) : val } } : {}); },
  cyclePlayerAvi(dir) { set((st) => { if (!st.playerModal) return {}; const n = AVATARS.length; return { playerModal: { ...st.playerModal, avi: ((st.playerModal.avi + dir) % n + n) % n } }; }); },
  savePlayerModal() {
    const m = get().playerModal; if (!m) return;
    const name = m.name.trim(); if (!name) return;
    const short = (m.short.trim() || name.slice(0, 2)).toUpperCase().slice(0, 3);
    set((st) => {
      let players: Player[];
      if (m.mode === 'add') players = [...st.players, { id: uid(), name, short, avi: m.avi }];
      else players = st.players.map((p) => p.id === m.id ? { ...p, name, short, avi: m.avi } : p);
      write(LS.players, players);
      return { players, playerModal: null };
    });
  },
  deletePlayer(id) {
    set((st) => {
      // Standard-Spieler (Seed) sind geschützt — nur bearbeitbar, nicht löschbar
      if (st.players.find((p) => p.id === id)?.locked) return {};
      const players = st.players.filter((p) => p.id !== id);
      const teams = st.teams.map((t) => ({ ...t, memberIds: t.memberIds.filter((mid) => mid !== id), captainId: t.captainId === id ? null : t.captainId }));
      write(LS.players, players); write(LS.teams, teams);
      return { players, teams, playerModal: null };
    });
  },

  // ── team modal ──
  selectTeam(i) { set({ selectedTeam: i }); },
  openAddTeam() { set({ teamModal: { mode: 'add', id: null, name: '', league: '', memberIds: [], captainId: null } }); },
  openEditTeam() {
    const st = get(); const t = st.teams[Math.max(0, Math.min(st.teams.length - 1, st.selectedTeam))]; if (!t) return;
    set({ teamModal: { mode: 'edit', id: t.id, name: t.name, league: t.league || '', memberIds: [...t.memberIds], captainId: t.captainId } });
  },
  closeTeamModal() { set({ teamModal: null }); },
  setTeamField(key, val) { set((st) => st.teamModal ? { teamModal: { ...st.teamModal, [key]: val } } : {}); },
  toggleTeamMember(pid) {
    set((st) => {
      if (!st.teamModal) return {};
      const has = st.teamModal.memberIds.includes(pid);
      const memberIds = has ? st.teamModal.memberIds.filter((x) => x !== pid) : [...st.teamModal.memberIds, pid];
      let captainId = st.teamModal.captainId;
      if (has && captainId === pid) captainId = null;
      return { teamModal: { ...st.teamModal, memberIds, captainId } };
    });
  },
  setTeamCaptain(pid) { set((st) => st.teamModal ? { teamModal: { ...st.teamModal, captainId: st.teamModal.captainId === pid ? null : pid } } : {}); },
  saveTeamModal() {
    const m = get().teamModal; if (!m) return;
    const name = m.name.trim(); if (!name) return;
    set((st) => {
      const rec: Team = { id: m.id || uid(), name, league: m.league.trim(), memberIds: m.memberIds, captainId: m.captainId && m.memberIds.includes(m.captainId) ? m.captainId : null };
      let teams: Team[]; let selectedTeam = st.selectedTeam;
      if (m.mode === 'add') { teams = [...st.teams, rec]; selectedTeam = teams.length - 1; }
      else teams = st.teams.map((t) => t.id === m.id ? rec : t);
      write(LS.teams, teams);
      return { teams, teamModal: null, selectedTeam };
    });
  },
  deleteTeam(id) {
    set((st) => {
      const teams = st.teams.filter((t) => t.id !== id);
      write(LS.teams, teams);
      return { teams, teamModal: null, selectedTeam: Math.max(0, Math.min(teams.length - 1, st.selectedTeam)) };
    });
  },

  // ── user modal ──
  openAddUser() { set({ userModal: { mode: 'add', id: null, first: '', last: '', email: '', role: 'player', playerId: null, active: true, avi: 0, position: '' } }); },
  openEditUser(id) {
    const a = get().accounts.find((x) => x.id === id); if (!a) return;
    set({ userModal: { mode: 'edit', id: a.id, first: a.first, last: a.last, email: a.email, role: a.role, playerId: a.playerId, active: a.active, avi: a.avi, position: a.position || '' } });
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
      if (m.mode === 'add') accounts = [...st.accounts, { id: uid(), first, last, name, email, role: m.role, playerId: m.playerId, active: m.active, avi: m.avi, position: m.position.trim(), last_login: '—' }];
      else accounts = st.accounts.map((a) => a.id === m.id ? { ...a, first, last, name, email, role: m.role, playerId: m.playerId, active: m.active, avi: m.avi, position: m.position.trim() } : a);
      write(LS.users, accounts);
      return { accounts, userModal: null };
    });
  },
  deleteUser(id) {
    set((st) => {
      const accounts = st.accounts.filter((a) => a.id !== id);
      write(LS.users, accounts);
      return { accounts, userModal: null };
    });
  },
  toggleUserActive(id) {
    set((st) => {
      const accounts = st.accounts.map((a) => a.id === id ? { ...a, active: !a.active } : a);
      write(LS.users, accounts);
      return { accounts };
    });
  },

  // ── league modal ──
  selectLeague(i) { set({ selectedLeague: i }); },
  openAddLeague() { set({ leagueModal: { mode: 'add', id: null, name: '', season: '2025/26', teams: [] } }); },
  openEditLeague() {
    const st = get(); const lg = st.leagues[Math.max(0, Math.min(st.leagues.length - 1, st.selectedLeague))]; if (!lg) return;
    set({ leagueModal: { mode: 'edit', id: lg.id, name: lg.name, season: lg.season || '', teams: lg.teams.map((t) => ({ ...t })) } });
  },
  closeLeagueModal() { set({ leagueModal: null }); },
  setLeagueField(key, val) { set((st) => st.leagueModal ? { leagueModal: { ...st.leagueModal, [key]: val } } : {}); },
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
      const rec: League = { id: m.id || uid(), name, season: m.season.trim(), teams, fixtures: existing ? existing.fixtures : [] };
      let leagues: League[]; let selectedLeague = st.selectedLeague;
      if (m.mode === 'add') { leagues = [...st.leagues, rec]; selectedLeague = leagues.length - 1; }
      else leagues = st.leagues.map((l) => l.id === m.id ? rec : l);
      write(LS.leagues, leagues);
      return { leagues, leagueModal: null, selectedLeague };
    });
  },
  deleteLeague(id) {
    set((st) => {
      const leagues = st.leagues.filter((l) => l.id !== id);
      write(LS.leagues, leagues);
      return { leagues, leagueModal: null, selectedLeague: Math.max(0, Math.min(leagues.length - 1, st.selectedLeague)) };
    });
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
      const leagues = st.leagues.map((l) => {
        if (l.id !== m.leagueId) return l;
        const rec: Fixture = { id: m.id || uid(), homeId: m.homeId!, awayId: m.awayId!, date: m.date, played: m.played, hs: m.played ? (parseInt(m.hs, 10) || 0) : '', as: m.played ? (parseInt(m.as, 10) || 0) : '' };
        const fixtures = m.mode === 'add' ? [...l.fixtures, rec] : l.fixtures.map((f) => f.id === m.id ? rec : f);
        return { ...l, fixtures };
      });
      write(LS.leagues, leagues);
      return { leagues, fixtureModal: null };
    });
  },
  deleteFixture(id) {
    set((st) => {
      const m = st.fixtureModal;
      const leagues = st.leagues.map((l) => (m && l.id === m.leagueId) ? { ...l, fixtures: l.fixtures.filter((f) => f.id !== id) } : l);
      write(LS.leagues, leagues);
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
      write(LS.events, events);
      return { events, eventModal: null };
    });
  },
  deleteEvent(id) {
    set((st) => {
      const events = st.events.filter((e) => e.id !== id);
      write(LS.events, events);
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
      players.push({ id: `t${i}_${p.id}`, name: p.name, short: p.short, av: p.avi });
    }
    const trainingPlays = { ...st.trainingPlays, [su.modeId]: (st.trainingPlays[su.modeId] || 0) + 1 };
    write(LS.trainplays, trainingPlays);
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
    const gamePlayers: GamePlayer[] = [
      { id: 1, name: a.name, short: a.short, av: a.avi },
      { id: 2, name: b.name, short: b.short, av: b.avi },
    ];
    const settings = { ...st.settings, startScore: su.startScore, bestOf: su.bestOf, bestOfSets: su.bestOfSets, unit: su.unit, doubleOut: su.doubleOut, outMode: su.outMode, doubleIn: su.doubleIn };
    write(LS.settings, settings);
    try { localStorage.removeItem(LS.live); } catch { /* ignore */ }
    set({ gamePlayers, gameMode: su.mode, allThrows: [], input: '', screen: 'counter', settings, startOffset: 0, pendingStart: true, bullMode: false, spinPick: null, matchSaved: false, hint: null, abortConfirm: false });
  },
  quickStart(preset) {
    set((st) => ({ setup: { ...st.setup, mode: 'single', p1: 0, p2: 1, ...(preset || {}) } }));
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

// ── Live-Persistenz & Match-Speicherung ──
function persistLive(get: () => AppState) {
  const st = get();
  try { localStorage.setItem(LS.live, JSON.stringify({ players: st.gamePlayers, allThrows: st.allThrows, startOffset: st.startOffset, matchSaved: st.matchSaved })); } catch { /* ignore */ }
}
function saveMatch(get: () => AppState, set: (p: Partial<AppState>) => void) {
  const st = get();
  const slice: CounterSlice = { gamePlayers: st.gamePlayers, allThrows: st.allThrows, startOffset: st.startOffset, settings: st.settings };
  const prog = cProgress(slice);
  const w = cMatchOver(slice) ? prog.winnerId : null;
  const winnerName = st.gamePlayers.find((p) => p.id === w)?.name || '';
  const perPlayer: MatchPlayerStat[] = st.gamePlayers.map((p) => ({
    name: p.name, short: p.short, av: p.av,
    legsWon: prog.legsSet[p.id] || 0, setsWon: prog.setsWon[p.id] || 0,
    avg3: cAverage(slice, p.id), c180: countAtLeast(slice, p.id, 180, true), c140: countAtLeast(slice, p.id, 140),
    c100: countAtLeast(slice, p.id, 100), c60: countAtLeast(slice, p.id, 60),
    highFinish: 0, darts: st.allThrows.filter((t) => t.playerId === p.id).length * 3,
  }));
  const unit = st.settings.unit;
  const scoreLine = st.gamePlayers.map((p) => unit === 'sets' ? (prog.setsWon[p.id] || 0) : (prog.legsSet[p.id] || 0)).join(':');
  const match: Match = {
    id: 'm' + uid(), date: new Date().toISOString(), startScore: st.settings.startScore,
    doubleOut: st.settings.doubleOut, doubleIn: st.settings.doubleIn, unit, mode: st.gameMode,
    bestOf: st.settings.bestOf, bestOfSets: st.settings.bestOfSets,
    gameLabel: `X01 ${st.settings.startScore} · Bo${st.settings.bestOf}`, winnerName, scoreLine, perPlayer,
  };
  const matches = [...st.matches, match];
  write(LS.matches, matches);
  try { localStorage.removeItem(LS.live); } catch { /* ignore */ }
  set({ matches, matchSaved: true });
}

export { firstName, lastName };
