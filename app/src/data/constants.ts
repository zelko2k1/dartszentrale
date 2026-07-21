// Konstanten — 1:1 aus dem ursprünglichen HTML-Prototyp
// Alle ANZEIGE-Texte (label/short/desc/name/…) sind Getter, die live aus dem aktiven Sprachpaket
// (i18n) lesen — Struktur, Farben, Icons und IDs bleiben statisch. Konsumenten (ROLES[r].label usw.)
// brauchten dafür nicht angefasst zu werden; sie sehen die neue Sprache beim nächsten Re-Render.
import type { Role, Settings, LineupSegment, TeamKind } from './types';
import { dict } from '../i18n';

// Mannschafts-Arten: Liga vs. Pokal. Icon wird in der UI über die Art gewählt (IconShield / IconTrophy).
const teamKindDef = (k: TeamKind, color: string) => ({
  get label() { return dict().teamKinds[k].label; },
  get short() { return dict().teamKinds[k].short; },
  color,
});
export const TEAM_KINDS: Record<TeamKind, { label: string; short: string; color: string }> = {
  league:   teamKindDef('league', '#19A463'),
  cup:      teamKindDef('cup', '#F2B829'),
  friendly: teamKindDef('friendly', '#2BD3C0'),
};
// Robuster Zugriff inkl. Altdaten ohne kind-Feld → Standard 'league'.
export const teamKind = (t: { kind?: TeamKind }): TeamKind => (t.kind === 'cup' ? 'cup' : t.kind === 'friendly' ? 'friendly' : 'league');

// Spielformat-Vorlagen. Reihenfolge der Segmente = realer Spielablauf; die Anzeige (z. B. „8 Einzel · 4 Doppel")
// wird im LeagueModal aus den Segmenten generiert, damit keine festen Überschriften/Liga-Namen nötig sind.
export const LEAGUE_FORMAT_PRESETS: { key: string; segments: LineupSegment[] }[] = [
  { key: 's8s8', segments: [{ kind: 'singles', count: 8 }, { kind: 'singles', count: 8 }] },
  { key: 's8d4', segments: [{ kind: 'singles', count: 8 }, { kind: 'doubles', count: 4 }] },
  { key: 's8d2s8', segments: [{ kind: 'singles', count: 8 }, { kind: 'doubles', count: 2 }, { kind: 'singles', count: 8 }] },
  { key: 's6d3s6', segments: [{ kind: 'singles', count: 6 }, { kind: 'doubles', count: 3 }, { kind: 'singles', count: 6 }] },
  { key: 's4s4d2', segments: [{ kind: 'singles', count: 4 }, { kind: 'singles', count: 4 }, { kind: 'doubles', count: 2 }] },
  { key: 's4d2s4d2', segments: [{ kind: 'singles', count: 4 }, { kind: 'doubles', count: 2 }, { kind: 'singles', count: 4 }, { kind: 'doubles', count: 2 }] },
  { key: 's4d2s4d2s4', segments: [{ kind: 'singles', count: 4 }, { kind: 'doubles', count: 2 }, { kind: 'singles', count: 4 }, { kind: 'doubles', count: 2 }, { kind: 'singles', count: 4 }] },
  { key: 's4s4d2s4s4', segments: [{ kind: 'singles', count: 4 }, { kind: 'singles', count: 4 }, { kind: 'doubles', count: 2 }, { kind: 'singles', count: 4 }, { kind: 'singles', count: 4 }] },
];

// Einstellungen, die NICHT vereinsweit zentral gelten, sondern an Gerät/Login gebunden bleiben:
// Verbindung (pbUrl), Betriebsmodus & Geräteart (hardwareabhängig) sowie der Dashboard-Zeitraum
// (reiner Ansichtsfilter, den jeder frei umschalten darf). Alles andere wird in club_config zentral
// gepflegt, damit alle Board-Rechner identisch aussehen/verhalten.
export const DEVICE_LOCAL_SETTING_KEYS: (keyof Settings)[] = [
  'pbUrl', 'appMode', 'appModeManual', 'appModeDetected', 'device', 'dashRange',
  'kiosk', 'boardName', 'nameOrder',
  // Geräteklassen-Mischbetrieb (PC ↔ Tablet): Eingabe-Modus, Hell/Dunkel, alle Größen & die
  // Counter-Ansicht (Restscore vs. Aufschrieb) pro Gerät.
  'mode', 'scoreArea', 'scoreScale', 'statsSize', 'headerSize', 'deckSize', 'legSize', 'boardScale', 'counterView', 'sheetOpen', 'historyOpen', 'statsOpen', 'matchStatsOpen',
  // Auto-Backup ist pro Installation (dieses Gerät liefert die App via serve-dist aus) → gerätelokal.
  'autoBackup', 'backupTime',
];

// Gerätelokale UI-Vorlieben mit eigener localStorage-Persistenz (LS.devui) – jedes Gerät (PC/Tablet/Board)
// für sich, unabhängig von den vereinsweiten club_config-Settings. (pbUrl/appMode haben eigene Keys; kiosk/
// boardName/nameOrder liegen in LS.device – siehe useStore.)
export const DEVICE_UI_KEYS: (keyof Settings)[] = [
  'device', 'dashRange', 'mode', 'scoreArea', 'scoreScale', 'statsSize', 'headerSize', 'deckSize', 'legSize', 'boardScale', 'counterView', 'sheetOpen', 'historyOpen', 'statsOpen', 'matchStatsOpen',
];

export const AVATARS: { bg: string; fg: string }[] = [
  { bg: 'linear-gradient(135deg,#19A463,#0f6b40)', fg: '#fff' },
  { bg: 'linear-gradient(135deg,#3B9EFF,#1c5fb0)', fg: '#fff' },
  { bg: 'linear-gradient(135deg,#F2B829,#b8841a)', fg: '#1a1206' },
  { bg: 'linear-gradient(135deg,#E0594B,#9c3329)', fg: '#fff' },
  { bg: 'linear-gradient(135deg,#9b6dff,#5e3bb0)', fg: '#fff' },
  { bg: 'linear-gradient(135deg,#2bd3c0,#147c72)', fg: '#06160d' },
  { bg: 'linear-gradient(135deg,#7a828c,#4b525b)', fg: '#fff' },
  { bg: 'linear-gradient(135deg,#5f8aa3,#3a5b6e)', fg: '#fff' },
];

export function avatar(avi: number) {
  const n = AVATARS.length;
  return AVATARS[((avi % n) + n) % n];
}

export interface RoleDef { label: string; short: string; desc: string; color: string; bg: string; bd: string; }
const roleDef = (r: Role, color: string, bg: string, bd: string): RoleDef => ({
  get label() { return dict().roles[r].label; },
  get short() { return dict().roles[r].short; },
  get desc() { return dict().roles[r].desc; },
  color, bg, bd,
});
export const ROLES: Record<Role, RoleDef> = {
  admin:   roleDef('admin',   '#E0594B', 'rgba(224,89,75,.13)',   'rgba(224,89,75,.4)'),
  captain: roleDef('captain', '#F2B829', 'rgba(242,184,41,.13)',  'rgba(242,184,41,.4)'),
  player:  roleDef('player',  '#19A463', 'rgba(25,164,99,.13)',   'rgba(25,164,99,.4)'),
  viewer:  roleDef('viewer',  '#3B9EFF', 'rgba(59,158,255,.13)',  'rgba(59,158,255,.4)'),
  board:   roleDef('board',   '#7a828c', 'rgba(122,130,140,.13)', 'rgba(122,130,140,.4)'),
};
// Von Hand vergebbare Rollen. 'board' fehlt bewusst: die Board-Rolle wird ausschließlich an
// Board-Rechner-Konten (isBoard) gekoppelt und kann nicht frei zugewiesen werden.
export const ROLE_ORDER: Role[] = ['admin', 'captain', 'player', 'viewer'];

export interface EventTypeDef { label: string; color: string; icon: string; }
// labelKey: „spieltag"/„spiel" sind Alt-Aliasse und teilen sich das Label mit ligaspiel/competition.
const eventTypeDef = (labelKey: keyof ReturnType<typeof dict>['eventTypes'], color: string, icon: string): EventTypeDef => ({
  get label() { return dict().eventTypes[labelKey]; },
  color, icon,
});
export const EVENT_TYPES: Record<string, EventTypeDef> = {
  training:    eventTypeDef('training',    '#3B9EFF', 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8a4 4 0 100 8 4 4 0 000-8zM12 11.5a.5.5 0 100 1 .5.5 0 000-1z'),
  ligaspiel:   eventTypeDef('ligaspiel',   '#19A463', 'M17 20v-1.5a4 4 0 00-4-4H7a4 4 0 00-4 4V20M10 10.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7M21 20v-1.5a4 4 0 00-3-3.85M15.5 3.65a3.5 3.5 0 010 6.8'),
  verein:      eventTypeDef('verein',      '#2BD3C0', 'M3 21h18M5 21V8l7-4 7 4v13M9 21v-5h6v5'),
  competition: eventTypeDef('competition', '#EC5CA8', 'M5 21V4M5 4h12l-2.5 4L17 12H5'),
  pokal:       eventTypeDef('pokal',       '#F2B829', 'M8 21h8M12 17v4M6 4h12v5a6 6 0 01-12 0zM6 7H3.5v.5A3 3 0 006 10.4M18 7h2.5v.5A3 3 0 0118 10.4'),
  sonstiges:   eventTypeDef('sonstiges',   '#9B6DFF', 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7.5v5l3.2 1.9'),
  spieltag:    eventTypeDef('ligaspiel',   '#19A463', 'M17 20v-1.5a4 4 0 00-4-4H7a4 4 0 00-4 4V20M10 10.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7M21 20v-1.5a4 4 0 00-3-3.85M15.5 3.65a3.5 3.5 0 010 6.8'),
  spiel:       eventTypeDef('competition', '#EC5CA8', 'M5 21V4M5 4h12l-2.5 4L17 12H5'),
  freundschaft: eventTypeDef('freundschaft', '#2BD3C0', 'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z'),
};
export const EVENT_TYPE_ALL = ['training', 'ligaspiel', 'verein', 'freundschaft', 'competition', 'pokal', 'sonstiges'];

export interface TrainMode {
  id: string; name: string; desc: string; icon: string; color: string;
  cat: string; solo: boolean; versus: boolean; metric: string; ready: boolean;
}
// name/desc/metric kommen aus dem Sprachpaket; id muss dort als Schlüssel existieren.
const trainMode = (id: keyof ReturnType<typeof dict>['trainModes'], icon: string, color: string, cat: string, solo: boolean, versus: boolean, ready: boolean): TrainMode => ({
  id,
  get name() { return dict().trainModes[id].name; },
  get desc() { return dict().trainModes[id].desc; },
  get metric() { return dict().trainModes[id].metric; },
  icon, color, cat, solo, versus, ready,
});
export const TRAIN_MODES: TrainMode[] = [
  trainMode('doubles', 'M12 4a8 8 0 100 16 8 8 0 000-16zM12 9a3 3 0 100 6 3 3 0 000-6z', '#F2B829', 'training', true, false, true),
  trainMode('atc', 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2', '#3B9EFF', 'training', true, true, true),
  trainMode('bobs27', 'M5 5h14v14H5zM9 9h.01M15 15h.01M12 12h.01', '#9B6DFF', 'training', true, false, true),
  trainMode('checkout121', 'M5 21V4M5 4h11l-2 4 2 4H5', '#EC5CA8', 'training', true, false, true),
  trainMode('cricket', 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8a4 4 0 100 8 4 4 0 000-8z', '#19A463', 'party', true, true, true),
  trainMode('baseball', 'M5 5a14 14 0 0114 14M5 11a8 8 0 018 8M5 17a2 2 0 012 2', '#2BD3C0', 'party', true, true, true),
  trainMode('halveit', 'M12 3v18M5 8h7M5 16h7', '#FF8A3D', 'party', true, true, true),
  trainMode('elimination', 'M6 18L18 6M8 6H6v2M16 18h2v-2', '#E0594B', 'party', false, true, true),
  trainMode('killer', 'M12 2l3 6 6 .9-4.5 4.2L18 20l-6-3.2L6 20l1.5-6.9L3 8.9 9 8z', '#9B6DFF', 'party', false, true, true),
];

export interface ModeRule { goal: string; lines: string[]; }
// Regeln kommen komplett aus dem Sprachpaket (de.ts/en.ts → modeRules).
const modeRule = (id: keyof ReturnType<typeof dict>['modeRules']): ModeRule => ({
  get goal() { return dict().modeRules[id].goal; },
  get lines() { return dict().modeRules[id].lines; },
});
export const MODE_RULES: Record<string, ModeRule> = {
  cricket: modeRule('cricket'),
  atc: modeRule('atc'),
  doubles: modeRule('doubles'),
  bobs27: modeRule('bobs27'),
  checkout121: modeRule('checkout121'),
  elimination: modeRule('elimination'),
  baseball: modeRule('baseball'),
  halveit: modeRule('halveit'),
  killer: modeRule('killer'),
};

export const CRICKET_TARGETS = [20, 19, 18, 17, 16, 15, 25];
export const CHECKOUT_LADDER = [121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,158,160,161,164,167,170];

// Checkout-Vorschläge nach dem darts-uk.co.uk Finishing-Chart.
// Bogey-Zahlen (169,168,166,165,163,162,159) haben keinen Eintrag → kein Vorschlag.
// Schreibweise wie im Chart: einfache Felder als nackte Zahl, T = Triple, D = Double, Bull = 50, 25 = einfaches Bull.
export const CHECKOUTS: Record<number, string> = {
  // Three Dart Finishes
  170:'T20 T20 Bull',167:'T20 T19 Bull',164:'T20 T18 Bull',161:'T20 T17 Bull',160:'T20 T20 D20',
  158:'T20 T20 D19',157:'T20 T19 D20',156:'T20 T20 D18',155:'T20 T19 D19',154:'T20 T18 D20',
  153:'T20 T19 D18',152:'T20 T20 D16',151:'T20 T17 D20',150:'T20 T18 D18',149:'T20 T19 D16',
  148:'T20 T16 D20',147:'T20 T17 D18',146:'T20 T18 D16',145:'T20 T15 D20',144:'T20 T20 D12',
  143:'T20 T17 D16',142:'T20 T14 D20',141:'T20 T19 D12',140:'T20 T16 D16',139:'T19 T14 D20',
  138:'T20 T18 D12',137:'T20 T15 D16',136:'T20 T20 D8',135:'T20 T17 D12',134:'T20 T14 D16',
  133:'T20 T19 D8',132:'T20 T16 D12',131:'T20 T13 D16',130:'T20 20 Bull',129:'T19 T16 D12',
  128:'T18 T14 D16',127:'T20 T17 D8',126:'T19 T19 D6',125:'25 T20 D20',124:'T20 T16 D8',
  123:'T19 T16 D9',122:'T18 T20 D4',121:'T17 T10 D20',120:'T20 20 D20',119:'T19 T10 D16',
  118:'T20 18 D20',117:'T20 17 D20',116:'T20 16 D20',115:'T20 15 D20',114:'T20 14 D20',
  113:'T20 13 D20',112:'T20 12 D20',111:'T20 19 D16',110:'T20 18 D16',109:'T20 17 D16',
  108:'T20 16 D16',107:'T19 18 D16',106:'T20 14 D16',105:'T20 13 D16',104:'T18 18 D16',
  103:'T20 3 D20',102:'T20 10 D16',101:'T20 1 D20',99:'T19 10 D16',
  // Two Dart Finishes
  100:'T20 D20',98:'T20 D19',97:'T19 D20',96:'T20 D18',95:'T19 D19',94:'T18 D20',93:'T19 D18',
  92:'T20 D16',91:'T17 D20',90:'T20 D15',89:'T19 D16',88:'T16 D20',87:'T17 D18',86:'T18 D16',
  85:'T15 D20',84:'T20 D12',83:'T17 D16',82:'T14 D20',81:'T19 D12',80:'T20 D10',79:'T13 D20',
  78:'T18 D12',77:'T19 D10',76:'T20 D8',75:'T17 D12',74:'T14 D16',73:'T19 D8',72:'T16 D12',
  71:'T13 D16',70:'T10 D20',69:'T15 D12',68:'T20 D4',67:'T17 D8',66:'T10 D18',65:'T19 D4',
  64:'T16 D8',63:'T13 D12',62:'T10 D16',61:'T15 D8',60:'20 D20',59:'19 D20',58:'18 D20',
  57:'17 D20',56:'T16 D4',55:'15 D20',54:'14 D20',53:'13 D20',52:'12 D20',51:'11 D20',50:'Bull',
  49:'9 D20',48:'16 D16',47:'15 D16',46:'6 D20',45:'13 D16',44:'4 D20',43:'11 D16',
  42:'10 D16',41:'9 D16',40:'D20',39:'7 D16',38:'D19',37:'5 D16',36:'D18',35:'3 D16',
  34:'D17',33:'1 D16',32:'D16',31:'15 D8',30:'D15',29:'13 D8',28:'D14',27:'11 D8',
  26:'D13',25:'9 D8',24:'D12',23:'7 D8',22:'D11',21:'5 D8',20:'D10',19:'3 D8',18:'D9',
  17:'1 D8',16:'D8',15:'7 D4',14:'D7',13:'5 D4',12:'D6',11:'3 D4',10:'D5',9:'1 D4',
  8:'D4',7:'3 D2',6:'D3',5:'1 D2',4:'D2',3:'1 D1',2:'D1',
};

export const FONTS: Record<string, string> = {
  Inter: "'Inter',system-ui,sans-serif",
  Archivo: "'Archivo',system-ui,sans-serif",
  Rubik: "'Rubik',system-ui,sans-serif",
  Oswald: "'Oswald',system-ui,sans-serif",
  'Space Grotesk': "'Space Grotesk',system-ui,sans-serif",
};

export const THEMES_DARK: Record<string, string> = {
  midnight: 'radial-gradient(135% 95% at 50% -18%, #16271d 0%, #0c0e11 60%)',
  charcoal: 'radial-gradient(135% 95% at 50% -18%, #1b1e23 0%, #0a0b0d 60%)',
  slate:    'radial-gradient(135% 95% at 50% -18%, #16242f 0%, #0a0d12 60%)',
};
export const THEMES_LIGHT: Record<string, string> = {
  midnight: 'radial-gradient(135% 95% at 50% -18%, #ecf6ee 0%, #d8e6db 62%)',
  charcoal: 'radial-gradient(135% 95% at 50% -18%, #f7f5f0 0%, #e7e3d8 62%)',
  slate:    'radial-gradient(135% 95% at 50% -18%, #edf3f9 0%, #d9e2ea 62%)',
};
