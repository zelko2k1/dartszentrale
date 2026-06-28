// Konstanten — 1:1 aus DartsHub.dc.html
import type { Role, Settings, LineupSegment, TeamKind } from './types';

// Mannschafts-Arten: Liga vs. Pokal. Icon wird in der UI über die Art gewählt (IconShield / IconTrophy).
export const TEAM_KINDS: Record<TeamKind, { label: string; short: string; color: string }> = {
  league:   { label: 'Liga-Mannschaft',  short: 'Liga',         color: '#19A463' },
  cup:      { label: 'Pokalmannschaft',  short: 'Pokal',        color: '#F2B829' },
  friendly: { label: 'Freundschaft',     short: 'Freundschaft', color: '#2BD3C0' },
};
// Robuster Zugriff inkl. Altdaten ohne kind-Feld → Standard 'league'.
export const teamKind = (t: { kind?: TeamKind }): TeamKind => (t.kind === 'cup' ? 'cup' : t.kind === 'friendly' ? 'friendly' : 'league');

// Spielformat-Vorlagen laut Wettkampfordnung. Reihenfolge der Segmente = realer Spielablauf.
export const LEAGUE_FORMAT_PRESETS: Record<string, { label: string; short: string; segments: LineupSegment[] }> = {
  BZ: { label: 'Bezirksliga', short: '8 Einzel + 4 Doppel', segments: [{ kind: 'singles', count: 8 }, { kind: 'doubles', count: 4 }] },
  BL: { label: 'Bayernliga', short: '8 Einzel + 4 Doppel', segments: [{ kind: 'singles', count: 8 }, { kind: 'doubles', count: 4 }] },
  LL: { label: 'Landesliga', short: '6 Einzel · 3 Doppel · 6 Einzel', segments: [{ kind: 'singles', count: 6 }, { kind: 'doubles', count: 3 }, { kind: 'singles', count: 6 }] },
};

// Einstellungen, die NICHT vereinsweit zentral gelten, sondern an Gerät/Login gebunden bleiben:
// Verbindung (pbUrl), Betriebsmodus & Geräteart (hardwareabhängig) sowie der Dashboard-Zeitraum
// (reiner Ansichtsfilter, den jeder frei umschalten darf). Alles andere wird in club_config zentral
// gepflegt, damit alle Board-Rechner identisch aussehen/verhalten.
export const DEVICE_LOCAL_SETTING_KEYS: (keyof Settings)[] = [
  'pbUrl', 'appMode', 'appModeManual', 'appModeDetected', 'device', 'dashRange',
  'kiosk', 'boardName', 'nameOrder',
  // Geräteklassen-Mischbetrieb (PC ↔ Tablet): Eingabe-Modus, Hell/Dunkel & alle Größen pro Gerät.
  'mode', 'scoreArea', 'scoreScale', 'statsSize', 'headerSize', 'deckSize', 'legSize',
];

// Gerätelokale UI-Vorlieben mit eigener localStorage-Persistenz (LS.devui) – jedes Gerät (PC/Tablet/Board)
// für sich, unabhängig von den vereinsweiten club_config-Settings. (pbUrl/appMode haben eigene Keys; kiosk/
// boardName/nameOrder liegen in LS.device – siehe useStore.)
export const DEVICE_UI_KEYS: (keyof Settings)[] = [
  'device', 'dashRange', 'mode', 'scoreArea', 'scoreScale', 'statsSize', 'headerSize', 'deckSize', 'legSize',
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
export const ROLES: Record<Role, RoleDef> = {
  admin:   { label: 'Administrator', short: 'Admin',      desc: 'Voller Zugriff: Verein, Benutzer & Einstellungen', color: '#E0594B', bg: 'rgba(224,89,75,.13)', bd: 'rgba(224,89,75,.4)' },
  captain: { label: 'Kapitän',       short: 'Kapitän',    desc: 'Aufstellung & Kader der eigenen Mannschaft',        color: '#F2B829', bg: 'rgba(242,184,41,.13)', bd: 'rgba(242,184,41,.4)' },
  player:  { label: 'Spieler',       short: 'Spieler',    desc: 'Eigene Statistik, Termine & Spiele',                color: '#19A463', bg: 'rgba(25,164,99,.13)',  bd: 'rgba(25,164,99,.4)' },
  viewer:  { label: 'Betrachter',    short: 'Betrachter', desc: 'Nur Lesezugriff auf Spielpläne & Tabellen',         color: '#3B9EFF', bg: 'rgba(59,158,255,.13)', bd: 'rgba(59,158,255,.4)' },
  board:   { label: 'Board-Rechner', short: 'Board',      desc: 'Maschinen-Konto: nur spielen, nichts verwalten',    color: '#7a828c', bg: 'rgba(122,130,140,.13)', bd: 'rgba(122,130,140,.4)' },
};
// Von Hand vergebbare Rollen. 'board' fehlt bewusst: die Board-Rolle wird ausschließlich an
// Board-Rechner-Konten (isBoard) gekoppelt und kann nicht frei zugewiesen werden.
export const ROLE_ORDER: Role[] = ['admin', 'captain', 'player', 'viewer'];

export interface EventTypeDef { label: string; color: string; icon: string; }
export const EVENT_TYPES: Record<string, EventTypeDef> = {
  training:    { label: 'Training',    color: '#3B9EFF', icon: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8a4 4 0 100 8 4 4 0 000-8zM12 11.5a.5.5 0 100 1 .5.5 0 000-1z' },
  ligaspiel:   { label: 'Ligaspiel',   color: '#19A463', icon: 'M17 20v-1.5a4 4 0 00-4-4H7a4 4 0 00-4 4V20M10 10.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7M21 20v-1.5a4 4 0 00-3-3.85M15.5 3.65a3.5 3.5 0 010 6.8' },
  verein:      { label: 'Verein',      color: '#2BD3C0', icon: 'M3 21h18M5 21V8l7-4 7 4v13M9 21v-5h6v5' },
  competition: { label: 'Competition', color: '#EC5CA8', icon: 'M5 21V4M5 4h12l-2.5 4L17 12H5' },
  pokal:       { label: 'Pokal',       color: '#F2B829', icon: 'M8 21h8M12 17v4M6 4h12v5a6 6 0 01-12 0zM6 7H3.5v.5A3 3 0 006 10.4M18 7h2.5v.5A3 3 0 0118 10.4' },
  sonstiges:   { label: 'Sonstiges',   color: '#9B6DFF', icon: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7.5v5l3.2 1.9' },
  spieltag:    { label: 'Ligaspiel',   color: '#19A463', icon: 'M17 20v-1.5a4 4 0 00-4-4H7a4 4 0 00-4 4V20M10 10.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7M21 20v-1.5a4 4 0 00-3-3.85M15.5 3.65a3.5 3.5 0 010 6.8' },
  spiel:       { label: 'Competition', color: '#EC5CA8', icon: 'M5 21V4M5 4h12l-2.5 4L17 12H5' },
  freundschaft:{ label: 'Freundschaft', color: '#2BD3C0', icon: 'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z' },
};
export const EVENT_TYPE_ALL = ['training', 'ligaspiel', 'verein', 'freundschaft', 'competition', 'pokal', 'sonstiges'];

export interface TrainMode {
  id: string; name: string; desc: string; icon: string; color: string;
  cat: string; solo: boolean; versus: boolean; metric: string; ready: boolean;
}
export const TRAIN_MODES: TrainMode[] = [
  { id: 'doubles', name: 'Doppel-Training', desc: 'Doppelfelder treffen, Quote tracken', icon: 'M12 4a8 8 0 100 16 8 8 0 000-16zM12 9a3 3 0 100 6 3 3 0 000-6z', color: '#F2B829', cat: 'training', solo: true, versus: false, metric: 'Quote', ready: true },
  { id: 'atc', name: 'Around the Clock', desc: '1 bis 20 und Bull der Reihe nach', icon: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2', color: '#3B9EFF', cat: 'training', solo: true, versus: true, metric: 'Darts', ready: true },
  { id: 'bobs27', name: "Bob's 27", desc: 'Doppel-Routine, Start mit 27 Punkten', icon: 'M5 5h14v14H5zM9 9h.01M15 15h.01M12 12h.01', color: '#9B6DFF', cat: 'training', solo: true, versus: false, metric: 'Bestwert', ready: true },
  { id: 'checkout121', name: '121 Checkout', desc: 'Finishes ab 121 üben', icon: 'M5 21V4M5 4h11l-2 4 2 4H5', color: '#EC5CA8', cat: 'training', solo: true, versus: false, metric: 'Bestwert', ready: true },
  { id: 'cricket', name: 'Cricket', desc: '15–20 & Bull schließen, Punkte sammeln', icon: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8a4 4 0 100 8 4 4 0 000-8z', color: '#19A463', cat: 'party', solo: true, versus: true, metric: 'MPR', ready: true },
  { id: 'baseball', name: 'Baseball', desc: '9 Innings · Treffer zählen als Runs', icon: 'M5 5a14 14 0 0114 14M5 11a8 8 0 018 8M5 17a2 2 0 012 2', color: '#2BD3C0', cat: 'party', solo: true, versus: true, metric: 'Runs', ready: true },
  { id: 'halveit', name: 'Halve It', desc: 'Verfehlst du das Ziel, halbiert sich dein Score', icon: 'M12 3v18M5 8h7M5 16h7', color: '#FF8A3D', cat: 'party', solo: true, versus: true, metric: 'Bestwert', ready: true },
  { id: 'elimination', name: 'Elimination', desc: 'Triff den Gegner-Punktestand, wirf ihn zurück', icon: 'M6 18L18 6M8 6H6v2M16 18h2v-2', color: '#E0594B', cat: 'party', solo: false, versus: true, metric: 'Siege', ready: true },
  { id: 'killer', name: 'Killer', desc: 'Werde Killer und nimm Gegnern die Leben', icon: 'M12 2l3 6 6 .9-4.5 4.2L18 20l-6-3.2L6 20l1.5-6.9L3 8.9 9 8z', color: '#9B6DFF', cat: 'party', solo: false, versus: true, metric: 'Siege', ready: true },
];

export interface ModeRule { goal: string; lines: string[]; }
export const MODE_RULES: Record<string, ModeRule> = {
  cricket: { goal: 'Schließe alle Felder 15–20 und Bull und führe nach Punkten.', lines: ['Jedes Feld brauchst du 3× (Single=1, Double=2, Triple=3 Marks).', 'Ist ein Feld bei dir geschlossen und beim Gegner noch offen, bringen weitere Treffer Punkte.', 'Gewonnen: alle Felder geschlossen UND mindestens so viele Punkte wie der beste Gegner.', 'Solo: schließe alle Felder mit möglichst wenig Darts (MPR).'] },
  atc: { goal: 'Triff die Zahlen 1 bis 20 und das Bull der Reihe nach.', lines: ['Pro Aufnahme hast du 3 Darts.', 'Triffst du die aktuelle Zahl, rückst du zum nächsten Ziel.', 'Solo: schaffe alle Ziele mit möglichst wenig Darts.', 'Mehrspieler: wer zuerst durch ist, gewinnt.'] },
  doubles: { goal: 'Triff der Reihe nach jedes Doppel von D1 bis Bull.', lines: ['Pro Doppel hast du 3 Darts.', 'Für jeden Dart tippst du Treffer oder Daneben.', 'Am Ende zählt deine Doppelquote (Treffer ÷ Würfe).', 'Ideal zum gezielten Finish-Training.'] },
  bobs27: { goal: 'Starte mit 27 Punkten und arbeite dich durch alle Doppel.', lines: ['Pro Doppel 3 Darts. Jeder Treffer bringt +2× die Zahl.', 'Triffst du in einer Aufnahme keinen, verlierst du 2× die Zahl.', 'Fällt dein Score auf 0 oder darunter, bist du raus.', 'Ziel: möglichst hoher Endstand – ein echter Klassiker.'] },
  checkout121: { goal: 'Spiele Finishes ab 121 aufwärts aus.', lines: ['Pro Finish hast du 3 Darts (eine Aufnahme).', 'Tippe Geschafft oder Verfehlt.', 'Es zählen Trefferquote und höchstes ausgespieltes Finish.', 'Perfekt, um Doppel und Finish-Wege zu trainieren.'] },
  elimination: { goal: 'Erreiche als Erster genau das Ziel (301).', lines: ['Reihum trägt jeder seine Aufnahme ein.', 'Triffst du exakt den Punktestand eines Gegners, fällt dieser zurück auf 0.', 'Wer 301 zuerst erreicht, gewinnt.', 'Taktik: Gegner kurz vor dem Ziel zurückwerfen.'] },
  baseball: { goal: '9 Innings – sammle in jedem Inning Runs.', lines: ['Inning N = die Zahl N. Pro Inning 3 Darts.', 'Single = 1 Run, Double = 2, Triple = 3.', 'Die Runs aller 9 Innings werden addiert.', 'Wer am Ende die meisten Runs hat, gewinnt.'] },
  halveit: { goal: 'Triff das vorgegebene Ziel – sonst halbiert sich dein Score.', lines: ['Jede Runde gilt ein Ziel (Zahl, Doppel, Triple oder Bull).', 'Triffst du, zählen die erzielten Punkte dazu.', 'Verfehlst du das Ziel in der ganzen Aufnahme, wird dein Score HALBIERT.', 'Nach allen Runden gewinnt der höchste Score.'] },
  killer: { goal: 'Werde Killer und nimm den Gegnern alle Leben.', lines: ['Jeder hat eine eigene Zahl und 3 Leben.', 'Triff zuerst deine eigene Zahl, um Killer zu werden.', 'Als Killer nimmst du pro Treffer auf gegnerische Zahlen ein Leben.', 'Wer als Letzter Leben übrig hat, gewinnt.'] },
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
