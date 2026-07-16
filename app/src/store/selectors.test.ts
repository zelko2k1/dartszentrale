import { describe, it, expect } from 'vitest';
import { computeStandings } from './selectors';
import type { League, LeagueTeam, Fixture } from '../data/types';

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
