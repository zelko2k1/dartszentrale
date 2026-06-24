import type { Account, League, LeagueTeam, Settings, Player, Team, EventItem, Match } from '../data/types';
import { FONTS, THEMES_DARK, THEMES_LIGHT } from '../data/constants';
import { parseIso } from '../lib/format';

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
  return { admin, manageUsers: admin, manageClub: admin, managePlayers: staff, manageTeams: staff, manageLeagues: staff, manageEvents: staff, play: player, role: r };
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
    const hs = +f.hs || 0, as = +f.as || 0;
    h.sp++; a.sp++; h.lf += hs; h.la += as; a.lf += as; a.la += hs;
    if (hs > as) { h.s++; a.n++; h.pts += 2; }
    else if (hs < as) { a.s++; h.n++; a.pts += 2; }
    else { h.u++; a.u++; h.pts++; a.pts++; }
  });
  return Object.keys(table).map((k) => table[k]).sort((x, y) =>
    (y.pts - x.pts) || ((y.lf - y.la) - (x.lf - x.la)) || (y.lf - x.lf) || x.name.localeCompare(y.name));
}

// ── Spieler-Aggregation aus gespeicherten Matches ──
export interface PlayerAggregate {
  games: number; wins: number; losses: number; avg: number;
  c180: number; c140: number; c100: number; c60: number; high: number;
  recent: { opp: string; won: boolean; avg: number; score: string; date: string }[];
}

export function aggregateFor(name: string, matches: Match[]): PlayerAggregate {
  const out: PlayerAggregate = { games: 0, wins: 0, losses: 0, avg: 0, c180: 0, c140: 0, c100: 0, c60: 0, high: 0, recent: [] };
  let avgSum = 0, avgN = 0;
  matches.forEach((m) => {
    const mine = m.perPlayer.find((p) => p.name === name);
    if (!mine) return;
    out.games++;
    const won = m.winnerName === name;
    if (won) out.wins++; else out.losses++;
    out.c180 += mine.c180 || 0; out.c140 += mine.c140 || 0; out.c100 += mine.c100 || 0; out.c60 += mine.c60 || 0;
    out.high = Math.max(out.high, mine.highFinish || 0);
    if (mine.avg3) { avgSum += mine.avg3; avgN++; }
    const opp = m.perPlayer.find((p) => p.name !== name);
    out.recent.push({ opp: opp ? opp.name : '—', won, avg: mine.avg3 || 0, score: m.scoreLine, date: m.date });
  });
  out.avg = avgN ? avgSum / avgN : 0;
  out.recent = out.recent.slice(-6).reverse();
  return out;
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
  players.forEach((p) => { const a = aggregateFor(p.name, matches); if (a.avg) avgs.push(a.avg); });
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

// ── "Nächster Spieltag": nächste offene Begegnung der eigenen Mannschaft ──
export interface NextMatchDay {
  date: string; home: LeagueTeam; away: LeagueTeam; ownIsHome: boolean; leagueName: string;
}
export function nextMatchDay(leagues: League[]): NextMatchDay | null {
  for (const lg of leagues) {
    const own = lg.teams.find((t) => t.own);
    if (!own) continue;
    const open = lg.fixtures
      .filter((f) => !f.played && (f.homeId === own.id || f.awayId === own.id))
      .sort((a, b) => a.date.localeCompare(b.date));
    if (open.length) {
      const f = open[0];
      const home = lg.teams.find((t) => t.id === f.homeId)!;
      const away = lg.teams.find((t) => t.id === f.awayId)!;
      return { date: f.date, home, away, ownIsHome: f.homeId === own.id, leagueName: lg.name };
    }
  }
  return null;
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

// ── Theme-Helfer ──
export function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}
export function accentFg(accent: string): string {
  const [r, g, b] = hexRgb(accent);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? '#06160d' : '#fff';
}
export function rootBg(settings: Settings): string {
  const set = settings.mode === 'light' ? THEMES_LIGHT : THEMES_DARK;
  return set[settings.theme] || set.midnight;
}
export function fontFam(settings: Settings): string {
  return FONTS[settings.font] || FONTS.Inter;
}
