import { describe, it, expect } from 'vitest';
import { computeStandings, aggregateFor, headToHead } from './selectors';
import type { League, LeagueTeam, Fixture, Match, MatchPlayerStat } from '../data/types';

function team(id: string, name: string, own = false): LeagueTeam {
  return { id, name, own } as LeagueTeam;
}
function fixture(homeId: string, awayId: string, hs: number, as: number, played = true): Fixture {
  return { id: `${homeId}-${awayId}`, homeId, awayId, hs, as, played } as unknown as Fixture;
}
function league(teams: LeagueTeam[], fixtures: Fixture[]): League {
  return { id: 'lg', name: 'Test League', teams, fixtures } as unknown as League;
}

describe('computeStandings', () => {
  it('returns an empty table for a missing league', () => {
    expect(computeStandings(null)).toEqual([]);
  });

  it('awards 2 points for a win, 1 for a draw, 0 for a loss', () => {
    const lg = league(
      [team('a', 'Alpha', true), team('b', 'Beta'), team('c', 'Gamma')],
      [
        fixture('a', 'b', 9, 3),  // Alpha wins
        fixture('b', 'c', 6, 6),  // draw
      ],
    );
    const rows = computeStandings(lg);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId['a']).toMatchObject({ sp: 1, s: 1, u: 0, n: 0, pts: 2, lf: 9, la: 3 });
    expect(byId['b']).toMatchObject({ sp: 2, s: 0, u: 1, n: 1, pts: 1 });
    expect(byId['c']).toMatchObject({ sp: 1, s: 0, u: 1, n: 0, pts: 1 });
  });

  it('ignores unplayed fixtures and unknown team ids', () => {
    const lg = league(
      [team('a', 'Alpha'), team('b', 'Beta')],
      [
        fixture('a', 'b', 9, 3, false),      // not played yet
        fixture('a', 'ghost', 9, 0, true),   // opponent not in table
      ],
    );
    const rows = computeStandings(lg);
    for (const r of rows) expect(r).toMatchObject({ sp: 0, pts: 0 });
  });

  it('sorts by points, then leg difference, then legs for, then name', () => {
    const lg = league(
      [team('a', 'Zebra'), team('b', 'Anton'), team('c', 'Mitte'), team('d', 'Delta')],
      [
        // a and b both win once (2 pts each) but a has the better difference
        fixture('a', 'd', 10, 2),
        fixture('b', 'd', 8, 4),
        // c wins twice → most points, top of the table
        fixture('c', 'd', 7, 5),
        fixture('d', 'c', 5, 7),
      ],
    );
    const rows = computeStandings(lg);
    expect(rows.map((r) => r.id)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('breaks full ties alphabetically by name', () => {
    const lg = league([team('x', 'Berta'), team('y', 'Anton')], []);
    const rows = computeStandings(lg);
    expect(rows.map((r) => r.name)).toEqual(['Anton', 'Berta']);
  });

  it('keeps the own-team flag for highlighting', () => {
    const lg = league([team('a', 'Us', true), team('b', 'Them')], []);
    const rows = computeStandings(lg);
    expect(rows.find((r) => r.id === 'a')?.own).toBe(true);
  });
});

// ── Spieler-Aggregation: gewichtete Lebenszeit-Kennzahlen ──
function pstat(over: Partial<MatchPlayerStat>): MatchPlayerStat {
  return { name: 'X', legsWon: 0, avg3: 0, c180: 0, c60: 0, c100: 0, c140: 0, highFinish: 0, darts: 0, ...over } as MatchPlayerStat;
}
function match(date: string, mine: Partial<MatchPlayerStat>, opp: Partial<MatchPlayerStat> = {}): Match {
  return { date, scoreLine: '3-0', winnerName: 'Me', perPlayer: [pstat({ name: 'Me', ...mine }), pstat({ name: 'Opp', ...opp })] } as unknown as Match;
}

describe('aggregateFor', () => {
  const me = { id: 'p1', name: 'Me' };

  it('weights the lifetime average by darts thrown (not a mean of match means)', () => {
    const matches = [
      match('2026-01-01', { avg3: 60, darts: 90 }), // volle Partie
      match('2026-01-02', { avg3: 30, darts: 9 }),  // Mini-Partie (3 Aufnahmen)
    ];
    const agg = aggregateFor(me, matches);
    // gewichtet = (60·90 + 30·9) / 99 ≈ 57.27  —  Mittel-der-Mittel wäre 45
    expect(agg.avg).toBeCloseTo(57.27, 1);
    expect(agg.darts).toBe(99);
  });

  it('falls back to an unweighted mean for old matches without a darts field', () => {
    const matches = [
      match('2026-01-01', { avg3: 60, darts: 0 }),
      match('2026-01-02', { avg3: 40, darts: 0 }),
    ];
    const agg = aggregateFor(me, matches);
    expect(agg.avg).toBeCloseTo(50, 5);
    expect(agg.darts).toBe(0);
  });

  it('weights first-9 by darts and keeps checkout% as a simple mean', () => {
    const matches = [
      match('2026-01-01', { avg3: 50, darts: 100, f9: 60, co: 40 }),
      match('2026-01-02', { avg3: 50, darts: 10, f9: 30, co: 20 }),
    ];
    const agg = aggregateFor(me, matches);
    expect(agg.f9).toBeCloseTo(57.27, 1);  // (60·100 + 30·10)/110
    expect(agg.co).toBe(30);               // (40 + 20) / 2
  });
});

describe('headToHead', () => {
  const me = { id: 'p1', name: 'Me' };

  it('bundles the record per opponent, most games first', () => {
    const matches = [
      match('2026-01-01', { avg3: 60, darts: 90 }, { name: 'Anna' }),   // win vs Anna
      match('2026-01-02', { avg3: 40, darts: 90 }, { name: 'Anna' }),   // win vs Anna (winnerName='Me')
      { date: '2026-01-03', scoreLine: '1-3', winnerName: 'Bibi', perPlayer: [pstat({ name: 'Me', avg3: 50, darts: 90 }), pstat({ name: 'Bibi' })] } as unknown as Match,
    ];
    const rows = headToHead(aggregateFor(me, matches).history);
    expect(rows.map((r) => r.opp)).toEqual(['Anna', 'Bibi']); // Anna (2 Spiele) vor Bibi (1)
    expect(rows[0]).toMatchObject({ opp: 'Anna', games: 2, wins: 2, losses: 0 });
    expect(rows[0].avg).toBeCloseTo(50, 5);                    // (60·90 + 40·90)/180
    expect(rows[1]).toMatchObject({ opp: 'Bibi', games: 1, wins: 0, losses: 1 });
  });

  it('ignores guest games without an opponent name', () => {
    const matches = [match('2026-01-01', { avg3: 50, darts: 90 }, { name: '' })];
    expect(headToHead(aggregateFor(me, matches).history)).toEqual([]);
  });
});
