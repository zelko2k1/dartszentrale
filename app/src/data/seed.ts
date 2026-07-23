// Seed-Daten — 1:1 aus dem ursprünglichen HTML-Prototyp (componentDidMount / seedLeagues / seedEvents)
import type { Player, Team, Account, League, EventItem, Season, Settings } from './types';
import { uid, iso, firstName, lastName } from '../lib/format';

// Stabile Seed-Saison-ID, damit Seed-Ligen/-Teams/-Termine zuverlässig auf dieselbe Saison zeigen.
export const SEED_SEASON_ID = 'season_seed_2025_26';
export function seedSeasons(): Season[] {
  return [{ id: SEED_SEASON_ID, name: '2025/26', status: 'active' }];
}

export const DEFAULT_SETTINGS: Settings = {
  device: 'tablet',
  startScore: 501,
  bestOf: 5,
  bestOfSets: 3,
  unit: 'legs',
  doubleOut: true,
  outMode: 'double',
  doubleIn: false,
  accent: '#2BD377',
  mode: 'dark',
  theme: 'midnight',
  font: 'Inter',
  scoreScale: 100,
  scoreArea: 58,
  statsSize: 100,
  headerSize: 100,
  deckSize: 100,
  legSize: 100,
  boardScale: 100,
  boardMatchWindow: 1,
  counterView: 'big',
  sheetOpen: true,
  historyOpen: true,
  statsOpen: true,
  autoBackup: false,
  backupTime: '20:00',
  legColor: null,
  scoreColor: null,
  accentDark: '#2BD377',
  accentLight: '#19A463',
  scoreColorDark: null,
  scoreColorLight: null,
  legColorDark: null,
  legColorLight: null,
  showCheckout: true,
  showQuick: true,
  showHistory: true,
  showStats: true,
  shortLegHint: true,
  highFinishHint: true,
  matchStatsOpen: false,
  fkeys: [180, 140, 100, 95, 85, 60, 45, 40],
  newGameKey: 'ctrl+alt+n',
  quickBo5Key: 'ctrl+alt+5',
  quickBo3Key: 'ctrl+alt+3',
  paletteKey: 'alt+k',
  undoKey: 'alt+u',
  abortKey: 'alt+x',
  appMode: 'verein',
  remoteEnabled: true,
  pbUrl: '',
  clubName: '',
  clubLogo: null,
  loginLogoSize: 88,
  impressum: '',
  datenschutz: '',
  dashRange: 'month',
  nameOrder: 'first',
  kiosk: false,
  boardName: '',
};

export function seedPlayers(): Player[] {
  return [
    { id: 'p_seed1', name: 'Spieler 1', short: 'S1', avi: 6, locked: true },
    { id: 'p_seed2', name: 'Spieler 2', short: 'S2', avi: 7, locked: true },
  ];
}

// Standard-Spieler „Spieler 1/2" existieren NUR lokal (per withDefaultPlayers eingefügt), auch im
// Vereinsmodus – sie sind kein PocketBase-Datensatz. Server-Schreibvorgänge für sie überspringen,
// sonst läuft z. B. das Speichern eines Trainings-Bestwerts in einen 404 („Datensatz nicht gefunden").
export const isSeedPlayer = (id: string): boolean => id === 'p_seed1' || id === 'p_seed2';

// Garantiert, dass die zwei Standard-Spieler ("Spieler 1/2", locked = nicht löschbar) immer vorhanden
// sind – in BEIDEN Modi (lokal & Verein). Fehlende werden vorangestellt; vorhandene werden als locked markiert.
export function withDefaultPlayers(players: Player[]): Player[] {
  const defaults = seedPlayers();
  const have = new Set(players.map((p) => p.id));
  const missing = defaults.filter((d) => !have.has(d.id));
  const normalized = players.map((p) => (p.id === 'p_seed1' || p.id === 'p_seed2') ? { ...p, locked: true } : p);
  return [...missing, ...normalized];
}

export function seedTeams(players: Player[]): Team[] {
  return [
    {
      id: uid(),
      name: '1. Mannschaft',
      league: 'Verbandsliga Nord',
      memberIds: players.map((p) => p.id),
      captainId: players[0] ? players[0].id : null,
      seasonId: SEED_SEASON_ID,
    },
    {
      id: uid(),
      name: '2. Mannschaft',
      league: '',
      memberIds: [],
      captainId: null,
      seasonId: SEED_SEASON_ID,
    },
  ];
}

export function seedAccounts(players: Player[]): Account[] {
  const lp = players;
  return [
    { id: uid(), first: 'Markus', last: 'Krüger', name: 'Markus Krüger', email: 'vorstand@sv-adler.de', role: 'admin', playerId: null, active: true, avi: 0, last_login: 'vor 2 Std.', position: '1. Vorsitzender' },
    { id: uid(), first: lp[0] ? firstName(lp[0].name) : 'Kapitän', last: lp[0] ? lastName(lp[0].name) : '', name: lp[0] ? lp[0].name : 'Kapitän', email: 'kapitaen@sv-adler.de', role: 'captain', playerId: lp[0] ? lp[0].id : null, active: true, avi: 2, last_login: 'Gestern', position: 'Mannschaftsführer' },
    { id: uid(), first: lp[1] ? firstName(lp[1].name) : 'Spieler', last: lp[1] ? lastName(lp[1].name) : '', name: lp[1] ? lp[1].name : 'Spieler', email: 'spieler2@sv-adler.de', role: 'player', playerId: lp[1] ? lp[1].id : null, active: true, avi: 1, last_login: 'vor 4 Tagen', position: '' },
    { id: uid(), first: 'Jens', last: 'Hofer', name: 'Jens Hofer', email: 'j.hofer@web.de', role: 'player', playerId: null, active: true, avi: 4, last_login: '—', position: '' },
    { id: uid(), first: 'Petra', last: 'Lang', name: 'Petra Lang', email: 'schriftfuehrung@sv-adler.de', role: 'viewer', playerId: null, active: true, avi: 5, last_login: 'vor 1 Woche', position: 'Schriftführerin' },
    { id: uid(), first: 'Tobias', last: 'Reiter', name: 'Tobias Reiter', email: 't.reiter@gmx.de', role: 'player', playerId: null, active: false, avi: 3, last_login: 'vor 2 Monaten', position: 'Kassenwart' },
  ];
}

export function seedLeagues(): League[] {
  const t = (name: string, own?: boolean) => ({ id: uid(), name, own: !!own });
  const adler = t('SV Adler I', true), falken = t('DC Falken'), phoenix = t('DC Phoenix'),
    bulls = t('Bulls Eye Krefeld'), rhein = t('DSC Rheinpfeil'), steel = t('Steel Kings');
  const teams = [adler, falken, phoenix, bulls, rhein, steel];
  const fx = (home: typeof adler, away: typeof adler, hs: number, as: number, off: number, played: boolean) =>
    ({ id: uid(), homeId: home.id, awayId: away.id, date: iso(off), played: !!played, hs: (played ? hs : '') as number | '', as: (played ? as : '') as number | '' });
  const fixtures = [
    fx(adler, rhein, 6, 2, -28, true),
    fx(bulls, falken, 5, 3, -27, true),
    fx(adler, bulls, 5, 3, -21, true),
    fx(phoenix, adler, 5, 3, -14, true),
    fx(falken, steel, 6, 2, -13, true),
    fx(adler, steel, 6, 2, -7, true),
    fx(falken, adler, 4, 4, -6, true),
    fx(phoenix, falken, 6, 2, -6, true),
    fx(adler, falken, 0, 0, 5, false),
    fx(rhein, phoenix, 0, 0, 6, false),
  ];
  return [{ id: uid(), name: 'Verbandsliga Nord', season: '2025/26', seasonId: SEED_SEASON_ID, teams, fixtures }];
}

export function seedEvents(): EventItem[] {
  // Kein Demo-Kalender beim Erststart: eine frische Installation soll einen leeren Kalender zeigen
  // (weder lokale noch Vereins-Beispieltermine). Termine legt der Verein selbst an bzw. importiert sie.
  return [];
}
