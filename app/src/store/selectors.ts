import type { Account, League, LeagueTeam, Settings, Player, Team, EventItem, Match, Fixture, TeamKind, Season, LineupPosition } from '../data/types';
import { FONTS, THEMES_DARK, THEMES_LIGHT, activeSkin } from '../data/constants';
import { parseIso } from '../lib/format';

// ── Saison-Helfer ──
// Aktive Saison (genau eine), sonst die erste vorhandene, sonst null.
export function activeSeason(seasons: Season[]): Season | null {
  return seasons.find((s) => s.status === 'active') || seasons[0] || null;
}
// Datensätze auf eine Saison eingrenzen. seasonId = null → kein Filter (z. B. wenn noch keine Saisons existieren).
export function inSeason<T extends { seasonId?: string }>(items: T[], seasonId: string | null): T[] {
  if (!seasonId) return items;
  return items.filter((x) => x.seasonId === seasonId);
}

export interface Perm {
  admin: boolean; manageUsers: boolean; manageClub: boolean; managePlayers: boolean;
  manageTeams: boolean; manageLeagues: boolean; manageEvents: boolean; play: boolean; role: string | null;
}

export function currentUser(accounts: Account[], session: string | null): Account | null {
  return accounts.find((a) => a.id === session) || null;
}

export function perm(settings: Settings, accounts: Account[], session: string | null): Perm {
  if (settings.appMode === 'local') {
    return { admin: true, manageUsers: true, manageClub: true, managePlayers: true, manageTeams: true, manageLeagues: true, manageEvents: true, play: true, role: 'local' };
  }
  const u = currentUser(accounts, session);
  const r = u ? u.role : null;
  const admin = r === 'admin';
  const staff = r === 'admin' || r === 'captain';
  const player = r === 'admin' || r === 'captain' || r === 'player';
  // 'board' darf spielen (Matches anlegen/lesen), aber nichts verwalten.
  const play = player || r === 'board';
  return { admin, manageUsers: admin, manageClub: admin, managePlayers: staff, manageTeams: staff, manageLeagues: staff, manageEvents: staff, play, role: r };
}

export interface StandingRow {
  id: string; name: string; own: boolean;
  sp: number; s: number; u: number; n: number; lf: number; la: number; pts: number;
}

export function computeStandings(league: League | null): StandingRow[] {
  if (!league) return [];
  const table: Record<string, StandingRow> = {};
  (league.teams || []).forEach((t: LeagueTeam) => { table[t.id] = { id: t.id, name: t.name, own: t.own, sp: 0, s: 0, u: 0, n: 0, lf: 0, la: 0, pts: 0 }; });
  (league.fixtures || []).forEach((f) => {
    if (!f.played) return;
    const h = table[f.homeId], a = table[f.awayId];
    if (!h || !a) return;
    const hs = +f.hs || 0, as = +f.as || 0;                 // Punkte (gewonnene Spiele) → Pkt + Differenz
    h.sp++; a.sp++; h.lf += hs; h.la += as; a.lf += as; a.la += hs;
    if (hs > as) { h.s++; a.n++; h.pts += 2; }
    else if (hs < as) { a.s++; h.n++; a.pts += 2; }
    else { h.u++; a.u++; h.pts++; a.pts++; }
  });
  return Object.keys(table).map((k) => table[k]).sort((x, y) =>
    (y.pts - x.pts) || ((y.lf - y.la) - (x.lf - x.la)) || (y.lf - x.lf) || x.name.localeCompare(y.name));
}

// ── Spieler-Aggregation aus gespeicherten Matches ──
export interface PlayerGame { date: string; opp: string; won: boolean; avg: number; f9: number | null; co: number | null; c180: number; c100: number; darts: number; score: string; }
export interface PlayerRecords { bestAvg: number; best180: number; best100: number; bestCo: number | null; bestF9: number | null; longestWinStreak: number; }
export interface PlayerAggregate {
  games: number; wins: number; losses: number; avg: number; darts: number;
  c180: number; c140: number; c100: number; c60: number; high: number; shortLegs: number;
  shortLegDarts: number[];               // Dart-Zahlen aller Short Legs (für niedrigsten Wert + Verteilung 9–19)
  co: number | null; f9: number | null; // Ø Checkout-% / First-9; null, wenn kein Match diese Werte trägt (Alt-Matches)
  history: PlayerGame[];                 // ALLE Partien, chronologisch (alt→neu) – für Verlauf & Rekorde
  records: PlayerRecords;                // Bestwerte über alle betrachteten Partien
  recent: { opp: string; won: boolean; avg: number; score: string; date: string }[]; // letzte 6 (neueste zuerst)
}

// Aggregiert die gespeicherten Matches eines Spielers. Abgleich robust über playerId (Fallback: Name),
// damit Umbenennungen/Namensgleichheit die Statistik nicht verfälschen.
export function aggregateFor(player: { id: string; name: string }, matches: Match[]): PlayerAggregate {
  const records: PlayerRecords = { bestAvg: 0, best180: 0, best100: 0, bestCo: null, bestF9: null, longestWinStreak: 0 };
  const out: PlayerAggregate = { games: 0, wins: 0, losses: 0, avg: 0, darts: 0, c180: 0, c140: 0, c100: 0, c60: 0, high: 0, shortLegs: 0, shortLegDarts: [], co: null, f9: null, history: [], records, recent: [] };
  // Lebenszeit-Ø & First-9: nach geworfenen Darts GEWICHTET statt „Mittel der Match-Mittel". Da avg3 eine
  // echte Punkte/Darts-Rate ist (siehe counter.average), ergibt Σ(avg3·darts)/Σdarts exakt den Gesamt-Ø.
  // Fallback auf ungewichtetes Mittel für Alt-Matches ohne darts-Feld. co (Checkout-Quote) bleibt einfaches
  // Mittel: ohne gespeicherte Chancen/Treffer nicht sauber gewichtbar.
  let avgW = 0, avgWD = 0, avgSum = 0, avgN = 0;
  let f9W = 0, f9WD = 0, f9Sum = 0, f9N = 0;
  let coSum = 0, coN = 0;
  matches.forEach((m) => {
    const mine = m.perPlayer.find((p) => (p.playerId ? p.playerId === player.id : p.name === player.name));
    if (!mine) return;
    out.games++;
    const won = m.winnerId ? m.winnerId === player.id : m.winnerName === player.name;
    if (won) out.wins++; else out.losses++;
    out.c180 += mine.c180 || 0; out.c140 += mine.c140 || 0; out.c100 += mine.c100 || 0; out.c60 += mine.c60 || 0;
    out.shortLegs += mine.shortLegs || 0;
    if (mine.shortLegDarts && mine.shortLegDarts.length) out.shortLegDarts.push(...mine.shortLegDarts);
    out.high = Math.max(out.high, mine.highFinish || 0);
    const d = mine.darts || 0;
    out.darts += d;
    if (mine.avg3) { avgSum += mine.avg3; avgN++; if (d > 0) { avgW += mine.avg3 * d; avgWD += d; } }
    if (typeof mine.f9 === 'number') { f9Sum += mine.f9; f9N++; if (d > 0) { f9W += mine.f9 * d; f9WD += d; } }
    if (typeof mine.co === 'number') { coSum += mine.co; coN++; }
    const opp = m.perPlayer.find((p) => p !== mine);
    out.history.push({ date: m.date, opp: opp ? opp.name : '—', won, avg: mine.avg3 || 0, f9: typeof mine.f9 === 'number' ? mine.f9 : null, co: typeof mine.co === 'number' ? mine.co : null, c180: mine.c180 || 0, c100: mine.c100 || 0, darts: mine.darts || 0, score: m.scoreLine });
  });
  out.avg = avgWD ? avgW / avgWD : (avgN ? avgSum / avgN : 0);
  out.f9 = f9WD ? f9W / f9WD : (f9N ? f9Sum / f9N : null);
  out.co = coN ? Math.round(coSum / coN) : null;
  out.history.sort((a, b) => a.date.localeCompare(b.date)); // chronologisch (alt→neu)
  // Rekorde + längste Siegesserie aus der chronologischen Historie.
  let streak = 0;
  out.history.forEach((g) => {
    if (g.avg > records.bestAvg) records.bestAvg = g.avg;
    if (g.c180 > records.best180) records.best180 = g.c180;
    if (g.c100 > records.best100) records.best100 = g.c100;
    if (g.co != null && (records.bestCo == null || g.co > records.bestCo)) records.bestCo = g.co;
    if (g.f9 != null && (records.bestF9 == null || g.f9 > records.bestF9)) records.bestF9 = g.f9;
    if (g.won) { streak++; if (streak > records.longestWinStreak) records.longestWinStreak = streak; } else streak = 0;
  });
  out.recent = out.history.slice(-6).reverse().map((g) => ({ opp: g.opp, won: g.won, avg: g.avg, score: g.score, date: g.date }));
  return out;
}

// ── Kopf-an-Kopf: Bilanz je Gegner aus der (bereits aggregierten) Historie ──
export interface H2HRow { opp: string; games: number; wins: number; losses: number; avg: number; }
export function headToHead(history: PlayerGame[]): H2HRow[] {
  const map = new Map<string, { games: number; wins: number; aW: number; aWD: number; aSum: number; aN: number }>();
  for (const g of history) {
    if (!g.opp || g.opp === '—') continue; // Gastspiele/ohne Gegnername nicht werten
    const e = map.get(g.opp) || { games: 0, wins: 0, aW: 0, aWD: 0, aSum: 0, aN: 0 };
    e.games++; if (g.won) e.wins++;
    if (g.avg) { e.aSum += g.avg; e.aN++; if (g.darts > 0) { e.aW += g.avg * g.darts; e.aWD += g.darts; } }
    map.set(g.opp, e);
  }
  return [...map.entries()]
    .map(([opp, e]) => ({ opp, games: e.games, wins: e.wins, losses: e.games - e.wins, avg: e.aWD ? e.aW / e.aWD : (e.aN ? e.aSum / e.aN : 0) }))
    .sort((a, b) => b.games - a.games || b.wins - a.wins || a.opp.localeCompare(b.opp));
}

// ── Dashboard-Kennzahlen ──
export interface DashboardMetrics {
  playerCount: number; teamCount: number; teamAvg: number | null; tablePos: number | null; leagueName: string | null;
}
export function dashboardMetrics(players: Player[], teams: Team[], leagues: League[], matches: Match[]): DashboardMetrics {
  const playerCount = players.length;
  const teamCount = teams.length;
  // Team Ø 3-Dart: Mittel der gewerteten Spieler
  const avgs: number[] = [];
  players.forEach((p) => { const a = aggregateFor(p, matches); if (a.avg) avgs.push(a.avg); });
  const teamAvg = avgs.length ? avgs.reduce((x, y) => x + y, 0) / avgs.length : null;
  // Tabellenplatz aus erster Liga (eigenes Team)
  let tablePos: number | null = null; let leagueName: string | null = null;
  const lg = leagues[0] || null;
  if (lg) {
    leagueName = lg.name;
    const st = computeStandings(lg);
    const idx = st.findIndex((r) => r.own);
    if (idx >= 0) tablePos = idx + 1;
  }
  return { playerCount, teamCount, teamAvg, tablePos, leagueName };
}

// ── "Letzte Ergebnisse": gespielte Begegnungen der eigenen Mannschaft ──
export interface ResultRow { opp: string; leagueName: string; hs: number; as: number; outcome: 'S' | 'U' | 'N'; date: string; }
export function recentResults(leagues: League[], limit = 4): ResultRow[] {
  const rows: ResultRow[] = [];
  for (const lg of leagues) {
    const own = lg.teams.find((t) => t.own);
    if (!own) continue;
    lg.fixtures.filter((f) => f.played && (f.homeId === own.id || f.awayId === own.id)).forEach((f) => {
      const ownIsHome = f.homeId === own.id;
      const oppTeam = lg.teams.find((t) => t.id === (ownIsHome ? f.awayId : f.homeId));
      const myLegs = ownIsHome ? (+f.hs || 0) : (+f.as || 0);
      const oppLegs = ownIsHome ? (+f.as || 0) : (+f.hs || 0);
      const outcome: 'S' | 'U' | 'N' = myLegs > oppLegs ? 'S' : myLegs < oppLegs ? 'N' : 'U';
      rows.push({ opp: oppTeam ? oppTeam.name : '—', leagueName: lg.name, hs: myLegs, as: oppLegs, outcome, date: f.date });
    });
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}

// ── Termine gefiltert nach scope + range ──
export function upcomingEvents(events: EventItem[], scope: 'local' | 'verein', range: 'week' | 'month' | 'all', limit = 4): EventItem[] {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  if (range === 'week') horizon.setDate(horizon.getDate() + 7);
  else if (range === 'month') horizon.setMonth(horizon.getMonth() + 1);
  else horizon.setFullYear(horizon.getFullYear() + 5);
  return events
    .filter((e) => e.scope === scope)
    .filter((e) => { const d = parseIso(e.date); return d >= today && d <= horizon; })
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .slice(0, limit);
}

// ── Kader & Aufstellung aus Team.memberIds ──
export function teamRoster(team: Team, players: Player[]): Player[] {
  return team.memberIds.map((id) => players.find((p) => p.id === id)).filter((p): p is Player => !!p);
}

// ── Board-Anzeige (Kiosk): welches Spiel ist diesem Board (Board-Nummer) zugeordnet? ──
export interface BoardGame { positionId: string; label: string; kind: 'single' | 'double'; players: Player[]; result?: LineupPosition['result']; }
export interface BoardAssignment {
  leagueId: string; fixtureId: string;
  leagueName: string; ownTeamName: string; oppName: string; ownIsHome: boolean; date: string; games: BoardGame[];
  boardLive: boolean;  // manuell „an die Boards gesendet" (Fixture.boardLive) → überschreibt das Datumsfenster
  inWindow: boolean;   // Begegnung liegt im Anzeigefenster (±windowDays um heute) ODER ist boardLive
}
// Eine Aufstellungsposition zählt zu Board N, wenn ihr board-Feld (Freitext-Nummer) zur Nummer passt.
const boardOf = (raw?: string): number | null => { const n = parseInt((raw || '').replace(/[^0-9]/g, ''), 10); return isNaN(n) ? null : n; };
// Sucht über alle Ligen die für dieses Board (Nummer) passende Begegnung (heute/nächste bevorzugt) und liefert
// die diesem Board zugewiesenen Einzel/Doppel mit den eigenen Spielern. null = keine Nummer / keine Zuordnung.
export function boardAssignment(leagues: League[], players: Player[], boardNumber: number | null | undefined, todayIsoStr: string, windowDays = 1): BoardAssignment | null {
  if (boardNumber == null) return null;
  const pById = (id: string) => players.find((p) => p.id === id);

  const cands: { lg: League; fx: Fixture; live: boolean; inWin: boolean; future: number; diff: number }[] = [];
  for (const lg of leagues) {
    for (const fx of lg.fixtures || []) {
      const own = lg.teams.find((t) => (t.id === fx.homeId || t.id === fx.awayId) && t.own);
      if (!own || !fx.lineup?.positions?.length) continue;
      if (!fx.lineup.positions.some((p) => boardOf(p.board) === boardNumber && p.playerIds.length)) continue;
      const d = fx.date || '';
      const diff = d ? Math.abs((+parseIso(d) - +parseIso(todayIsoStr)) / 86400000) : 9999;
      const live = !!fx.boardLive;
      // Im Fenster, wenn manuell gesendet (live), ohne Datum (nicht filterbar) oder |Tagesabstand| <= windowDays.
      const inWin = live || !d || diff <= windowDays;
      cands.push({ lg, fx, live, inWin, future: d >= todayIsoStr ? 0 : 1, diff });
    }
  }
  if (!cands.length) return null;
  // Priorität: manuell gesendet → im Fenster → kommend → nächstgelegen.
  cands.sort((a, b) =>
    (a.live === b.live ? 0 : a.live ? -1 : 1) ||
    (a.inWin === b.inWin ? 0 : a.inWin ? -1 : 1) ||
    (a.future - b.future) ||
    (a.diff - b.diff),
  );
  const { lg, fx } = cands[0];
  const boardLive = !!fx.boardLive;
  const inWindow = boardLive || !fx.date || (Math.abs((+parseIso(fx.date) - +parseIso(todayIsoStr)) / 86400000) <= windowDays);
  const home = lg.teams.find((t) => t.id === fx.homeId) || null;
  const away = lg.teams.find((t) => t.id === fx.awayId) || null;
  const ownIsHome = !!(home && home.own);
  const own = ownIsHome ? home : away;
  const opp = ownIsHome ? away : home;

  let sNo = 0, dNo = 0;
  const games: BoardGame[] = [];
  for (const p of fx.lineup!.positions) {
    const label = p.kind === 'single' ? `Einzel ${++sNo}` : `Doppel ${++dNo}`;
    if (boardOf(p.board) === boardNumber && p.playerIds.length) {
      games.push({ positionId: p.id, label, kind: p.kind, players: p.playerIds.map(pById).filter((x): x is Player => !!x), result: p.result });
    }
  }
  return { leagueId: lg.id, fixtureId: fx.id, leagueName: lg.name, ownTeamName: own ? own.name : '—', oppName: opp ? opp.name : '—', ownIsHome, date: fx.date || '', games, boardLive, inWindow };
}

// ── Nächster Spieltag der eigenen Mannschaft (Shortcut „Aufstellen" aus der Mannschafts-Ansicht) ──
export interface NextFixtureRef {
  leagueIndex: number; leagueId: string; fixtureId: string;
  date: string; oppName: string; ownTeamName: string; ownIsHome: boolean; hasLineup: boolean;
}
// Sucht über alle Wettbewerbe die nächste OFFENE Begegnung der eigenen Mannschaft (kommende bevorzugt, sonst nächste).
// teamName grenzt auf eine bestimmte Mannschaft ein (Name der own-Mannschaft); kind grenzt auf die Wettbewerbsart
// ein (Liga/Pokal), damit eine Pokalmannschaft nur Pokal-Begegnungen findet. null = keine offene Begegnung.
export function nextOwnFixture(leagues: League[], todayIsoStr: string, teamName?: string, kind?: TeamKind): NextFixtureRef | null {
  const norm = (x: string) => (x || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const compKind = (lg: League): TeamKind => (lg.kind === 'cup' ? 'cup' : 'league');
  const want = teamName ? norm(teamName) : null;
  const cands: { idx: number; lg: League; fx: Fixture; own: LeagueTeam; bucket: number; diff: number }[] = [];
  leagues.forEach((lg, idx) => {
    if (kind && compKind(lg) !== kind) return; // nur Wettbewerbe der passenden Art (Liga vs. Pokal)
    for (const fx of lg.fixtures || []) {
      const own = lg.teams.find((t) => (t.id === fx.homeId || t.id === fx.awayId) && t.own);
      if (!own || fx.played) continue; // nur noch offene Spieltage aufstellen
      if (want && norm(own.name) !== want) continue;
      const d = fx.date || '';
      const future = d >= todayIsoStr;
      const diff = d ? Math.abs((+parseIso(d) - +parseIso(todayIsoStr)) / 86400000) : 9999;
      cands.push({ idx, lg, fx, own, bucket: future ? 0 : 1, diff });
    }
  });
  if (!cands.length) return null;
  cands.sort((a, b) => a.bucket - b.bucket || a.diff - b.diff);
  const c = cands[0];
  const home = c.lg.teams.find((t) => t.id === c.fx.homeId) || null;
  const ownIsHome = !!(home && home.own);
  const opp = ownIsHome ? c.lg.teams.find((t) => t.id === c.fx.awayId) || null : home;
  return {
    leagueIndex: c.idx, leagueId: c.lg.id, fixtureId: c.fx.id, date: c.fx.date || '',
    oppName: opp ? opp.name : '—', ownTeamName: c.own.name, ownIsHome, hasLineup: !!c.fx.lineup?.positions?.length,
  };
}

// ── Theme-Helfer ──
export function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

// ── Farb-Mathematik ───────────────────────────────────────────────────────────
// Der Akzent ist frei wählbar (10 Presets + Skins), also müssen alle davon abgeleiteten
// Rollen — Schrift auf der Akzentfläche, Fokus-Ring, Kontur — GERECHNET werden statt
// geraten. Grundlage ist die echte WCAG-Relativluminanz (nicht die alte YIQ-Helligkeit,
// die z. B. beim Standard-Akzent #2BD377 weiße Schrift mit 1,97:1 wählte).
const srgbToLin = (c: number): number => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
function relLuminance(hex: string): number {
  const [r, g, b] = hexRgb(hex);
  return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);
}
/** WCAG-Kontrastverhältnis zweier Hex-Farben (1…21). */
export function contrastRatio(a: string, b: string): number {
  const l1 = relLuminance(a), l2 = relLuminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// OKLCH ↔ sRGB — nur für das Nachführen der Lightness bei erhaltenem Farbton.
const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
const linToSrgb = (c: number): number => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
function oklchToHex(L: number, C: number, hDeg: number): string {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h), b2 = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b2) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b2) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b2) ** 3;
  return '#' + [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ].map((v) => Math.round(clamp01(linToSrgb(v)) * 255).toString(16).padStart(2, '0')).join('');
}
function hexToOklch(hex: string): [number, number, number] {
  const [r, g, b] = hexRgb(hex).map(srgbToLin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  let h = (Math.atan2(B, A) * 180) / Math.PI;
  if (h < 0) h += 360;
  return [L, Math.hypot(A, B), h];
}

// Die extremste Fläche je Modus über ALLE Themes (inkl. Skins): dunkel die tiefste
// Sidebar von theme01, hell das weiße --surface. Wer gegen die besteht, besteht überall.
const CANVAS_REF: Record<'dark' | 'light', string> = { dark: '#02060d', light: '#ffffff' };
// Ungünstigste Fläche je Modus, auf der eine AKZENT-TÖNUNG liegen kann.
//
// Eine Tönung liegt farblich zwischen Fläche und Akzent. Für helle Schrift auf dunklem Grund ist
// deshalb die HELLSTE Fläche der harte Fall (dort wird die Tönung am hellsten), für dunkle
// Schrift die DUNKELSTE. Ich hatte das zuerst andersherum und deshalb gegen die dunkelste
// Sidebar gerechnet — die Board-Badges fielen prompt durch (4,29:1).
// Werte aus tokens.css ermittelt: dunkel theme02 --btn, hell theme03 --surface-3.
const NAV_BASE: Record<'dark' | 'light', string> = { dark: '#31231a', light: '#ebe3d9' };
const RING_MIN = 3.2;   // WCAG 1.4.11 verlangt 3:1 für Bedienelemente; etwas Puffer
const FILL_MIN = 1.5;   // darunter verschwindet die Akzentfläche in der Fläche dahinter

const INK_DARK = '#06160d';
const INK_LIGHT = '#ffffff';
/**
 * Schrift auf einer Akzentfläche: nimmt den besseren von zwei Inks statt einen
 * Helligkeits-Schwellwert zu raten. Damit ist jeder denkbare Akzent AA-fest.
 */
export function accentFg(accent: string): string {
  return contrastRatio(accent, INK_DARK) >= contrastRatio(accent, INK_LIGHT) ? INK_DARK : INK_LIGHT;
}
/**
 * Fokus-Ring aus dem Akzent: bleibt der Akzent, solange er gegen die Fläche
 * mindestens 3,2:1 schafft. Sonst wandert nur die OKLCH-Lightness, bis er es tut —
 * Farbton und Sättigung bleiben, der Ring gehört sichtbar zum Theme.
 * (Im Hellmodus scheitern 8 der 10 Presets ungefiltert, u. a. der Standard-Grünton.)
 */
export function accentRing(accent: string, mode: 'dark' | 'light'): string {
  const ref = CANVAS_REF[mode];
  if (contrastRatio(accent, ref) >= RING_MIN) return accent;
  const [L, C, h] = hexToOklch(accent);
  const dir = mode === 'light' ? -1 : 1;
  for (let i = 1; i <= 900; i++) {
    const cand = oklchToHex(clamp01(L + dir * i * 0.001), C, h);
    if (contrastRatio(cand, ref) >= RING_MIN) return cand;
  }
  return mode === 'light' ? '#000000' : '#ffffff';
}
/** Mischt zwei Hex-Farben linear in sRGB (wie CSS color-mix in srgb). */
function mixHex(a: string, b: string, ratioA: number): string {
  const [ar, ag, ab] = hexRgb(a), [br, bg, bb] = hexRgb(b);
  const m = (x: number, y: number) => Math.round(x * ratioA + y * (1 - ratioA));
  return '#' + [m(ar, br), m(ag, bg), m(ab, bb)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/**
 * Der Akzent als SCHRIFT auf einer hellen Akzent-Tönung (aktiver Navigationseintrag).
 *
 * `--nav-active` ist `color-mix(accent 14–16 %, transparent)` — im Hellmodus also fast weiß.
 * Der rohe Akzent darauf ergab beim Standard-Grün 1,77:1; axe hat das im Browser gefunden,
 * die Token-Prüfung nicht: hier steht Akzent auf einer LAUFZEIT-Mischung desselben Akzents,
 * eine Paarung, die in keiner Token-Matrix vorkommt.
 *
 * Wie beim Fokus-Ring wandert nur die OKLCH-Lightness, bis 4,5:1 stehen — Farbton bleibt,
 * der aktive Eintrag bleibt erkennbar „in Akzentfarbe".
 */
export function accentText(accent: string, mode: 'dark' | 'light'): string {
  // Gegen die TÖNUNG rechnen, nicht gegen die Fläche darunter: --nav-active mischt den Akzent
  // mit 16 % in den Untergrund, und diese Mischung drückt den Kontrast noch einmal.
  // Als Untergrund die UNGÜNSTIGSTE Seitenleiste des Modus (theme03 „Salbei" ist warmes
  // Elfenbein statt Weiß und damit der harte Fall) — wer dort besteht, besteht überall.
  const ref = mixHex(accent, NAV_BASE[mode], 0.16);
  if (contrastRatio(accent, ref) >= 4.5) return accent;
  const [L, C, h] = hexToOklch(accent);
  const dir = mode === 'light' ? -1 : 1;
  for (let i = 1; i <= 900; i++) {
    const cand = oklchToHex(clamp01(L + dir * i * 0.001), C, h);
    if (contrastRatio(cand, ref) >= 4.5) return cand;
  }
  return mode === 'light' ? '#000000' : '#ffffff';
}
/**
 * Hauchdünne Kontur für Akzentflächen, die sonst mit dem Untergrund verschmelzen —
 * betrifft genau die entarteten Fälle (Akzent Weiß im Hellmodus, Schwarz im Dunkelmodus).
 * Alle anderen Akzente bekommen `transparent`, bleiben also unverändert randlos.
 */
export function accentEdge(accent: string, mode: 'dark' | 'light'): string {
  return contrastRatio(accent, CANVAS_REF[mode]) >= FILL_MIN ? 'transparent' : accentRing(accent, mode);
}
// Effektiver Hell/Dunkel-Modus: ein aktives Skin erzwingt seinen Modus, sonst die eigene Einstellung.
export function effectiveMode(settings: Pick<Settings, 'mode' | 'skin'>): 'dark' | 'light' {
  const sk = activeSkin(settings);
  return sk ? sk.mode : (settings.mode === 'light' ? 'light' : 'dark');
}
// Live-Farben (accent/scoreColor/legColor) für den aktiven Modus. Ein Skin überschreibt den Akzent fest und
// neutralisiert Score-/Leg-Overrides (Theme-Look). Ohne Skin: die pro-Modus gespeicherten Werte (classic).
export function deriveLiveColors(settings: Settings): { accent: string; scoreColor: string | null; legColor: string | null } {
  const sk = activeSkin(settings);
  if (sk) return { accent: sk.accent, scoreColor: null, legColor: null };
  const light = settings.mode === 'light';
  return {
    accent: (light ? settings.accentLight : settings.accentDark) || settings.accent,
    scoreColor: light ? settings.scoreColorLight : settings.scoreColorDark,
    legColor: light ? settings.legColorLight : settings.legColorDark,
  };
}
export function rootBg(settings: Settings): string {
  const sk = activeSkin(settings);
  if (sk) return sk.bg;
  const set = settings.mode === 'light' ? THEMES_LIGHT : THEMES_DARK;
  return set[settings.theme] || set.midnight;
}
export function fontFam(settings: Settings): string {
  const sk = activeSkin(settings);
  return FONTS[sk ? sk.font : settings.font] || FONTS.Inter;
}
