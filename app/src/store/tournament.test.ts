import { describe, it, expect } from 'vitest';
import {
  roundRobinPairings, generateSchedule, newTournament, assignBoards,
  setMatchLive, setMatchResult, standings, highlights, isTournamentOver,
  tournamentProgress, maxBoards, matchById,
} from './tournament';
import type { TournamentParticipant, TournamentConfig, TournamentPlayerStat } from '../data/types';

function parts(n: number): TournamentParticipant[] {
  return Array.from({ length: n }, (_, i) => {
    const name = String.fromCharCode(65 + i); // A, B, C, …
    return { id: `p${i}`, pid: `pid${i}`, name, short: name, av: 0 };
  });
}
const CFG: TournamentConfig = { startScore: 501, outMode: 'double', doubleIn: false, bestOf: 3 };
function make(n: number, boards = 1) {
  return newTournament('t1', 'Test', CFG, parts(n), boards, '2026-07-23T10:00:00Z');
}
function stat(over: Partial<TournamentPlayerStat> = {}): TournamentPlayerStat {
  return { legsWon: 0, avg3: 60, c180: 0, c140: 0, c100: 0, highFinish: 0, co: 0, shortLegDarts: [], ...over };
}
/** Findet die (einzige) Partie zwischen zwei Teilnehmern, unabhängig von Heim/Auswärts. */
function find(t: ReturnType<typeof make>, a: string, b: string) {
  return t.matches.find((m) => (m.homeId === a && m.awayId === b) || (m.homeId === b && m.awayId === a))!;
}
/** Spielt die Partie winner-vs-loser: `wLegs`:`lLegs` zugunsten von `winner`. */
function play(t: ReturnType<typeof make>, winner: string, loser: string, wLegs: number, lLegs: number) {
  const m = find(t, winner, loser);
  const homeWins = m.homeId === winner;
  return setMatchResult(t, m.id, {
    homeLegs: homeWins ? wLegs : lLegs,
    awayLegs: homeWins ? lLegs : wLegs,
    winnerId: winner,
    stats: {},
  });
}

describe('roundRobinPairings', () => {
  it('erzeugt jede Paarung genau einmal (gerade Zahl, 4 Spieler)', () => {
    const rounds = roundRobinPairings(['p0', 'p1', 'p2', 'p3']);
    expect(rounds).toHaveLength(3); // n-1 Runden
    rounds.forEach((r) => expect(r).toHaveLength(2)); // n/2 Partien je Runde
    const pairs = rounds.flat().map(([a, b]) => [a, b].sort().join('-')).sort();
    expect(pairs).toEqual(['p0-p1', 'p0-p2', 'p0-p3', 'p1-p2', 'p1-p3', 'p2-p3']);
  });

  it('erzeugt jede Paarung genau einmal (ungerade Zahl, 5 Spieler, Freilos)', () => {
    const rounds = roundRobinPairings(['p0', 'p1', 'p2', 'p3', 'p4']);
    expect(rounds).toHaveLength(5); // n Runden bei ungerade
    rounds.forEach((r) => expect(r).toHaveLength(2)); // je Runde pausiert einer → 2 Partien
    const pairs = rounds.flat().map(([a, b]) => [a, b].sort().join('-'));
    expect(new Set(pairs).size).toBe(10); // C(5,2) = 10, alle verschieden
  });

  it('kein Spieler spielt gegen sich selbst und keiner zweimal pro Runde', () => {
    for (const n of [3, 4, 5, 6, 7, 8]) {
      const ids = parts(n).map((p) => p.id);
      const rounds = roundRobinPairings(ids);
      rounds.forEach((round) => {
        const seen = new Set<string>();
        round.forEach(([a, b]) => {
          expect(a).not.toBe(b);
          expect(seen.has(a)).toBe(false);
          expect(seen.has(b)).toBe(false);
          seen.add(a); seen.add(b);
        });
      });
      // Gesamtzahl Partien = C(n,2)
      expect(rounds.flat()).toHaveLength((n * (n - 1)) / 2);
    }
  });
});

describe('generateSchedule / newTournament', () => {
  it('flache Partienliste mit stabilen Ids und Rundennummern', () => {
    const ms = generateSchedule(['p0', 'p1', 'p2', 'p3']);
    expect(ms).toHaveLength(6);
    expect(ms[0].id).toBe('m0');
    expect(ms.every((m) => m.status === 'pending')).toBe(true);
    expect(Math.max(...ms.map((m) => m.round))).toBe(3);
  });

  it('boardCount wird auf ⌊n/2⌋ begrenzt', () => {
    expect(maxBoards(4)).toBe(2);
    expect(maxBoards(3)).toBe(1);
    expect(make(4, 9).boardCount).toBe(2);
    expect(make(8, 9).boardCount).toBe(4);
    expect(make(4, 0).boardCount).toBe(1);
  });
});

describe('assignBoards', () => {
  it('füllt mehrere Boards mit parallelen Partien (4 Spieler, 2 Boards)', () => {
    const t = make(4, 2);
    const a = assignBoards(t);
    expect(a).toHaveLength(2);
    expect(a.map((x) => x.board).sort()).toEqual([1, 2]);
    // die beiden zugeteilten Partien teilen keinen Spieler
    const [m1, m2] = a.map((x) => matchById(t, x.matchId)!);
    const players = new Set([m1.homeId, m1.awayId, m2.homeId, m2.awayId]);
    expect(players.size).toBe(4);
  });

  it('belegt kein Board doppelt und überspringt Partien mit belegten Spielern', () => {
    let t = make(4, 2);
    const first = assignBoards(t)[0];
    t = setMatchLive(t, first.matchId, first.board);
    const next = assignBoards(t);
    // Board 1 ist belegt → höchstens Board 2, und nur mit freien Spielern
    expect(next.every((x) => x.board !== first.board)).toBe(true);
    const live = matchById(t, first.matchId)!;
    next.forEach((x) => {
      const m = matchById(t, x.matchId)!;
      expect([m.homeId, m.awayId]).not.toContain(live.homeId);
      expect([m.homeId, m.awayId]).not.toContain(live.awayId);
    });
  });

  it('mit nur 1 Board läuft immer nur eine Partie', () => {
    let t = make(6, 1);
    const a = assignBoards(t);
    expect(a).toHaveLength(1);
    t = setMatchLive(t, a[0].matchId, a[0].board);
    expect(assignBoards(t)).toHaveLength(0);
  });

  it('gibt keine Zuteilung, wenn alle Boards belegt sind', () => {
    let t = make(4, 2);
    for (const x of assignBoards(t)) t = setMatchLive(t, x.matchId, x.board);
    expect(assignBoards(t)).toHaveLength(0);
  });
});

describe('setMatchResult / status', () => {
  it('verbucht Ergebnis und beendet das Turnier, wenn alle Partien erledigt', () => {
    let t = make(3); // 3 Partien
    expect(t.status).toBe('running');
    for (const m of t.matches) t = setMatchResult(t, m.id, { homeLegs: 2, awayLegs: 0, winnerId: m.homeId, stats: {} });
    expect(isTournamentOver(t)).toBe(true);
    expect(tournamentProgress(t)).toEqual({ done: 3, total: 3 });
  });
});

describe('standings', () => {
  it('rangiert nach Siegen, dann Leg-Differenz', () => {
    // 3 Spieler A,B,C. A schlägt B (2:0) und C (2:1); B schlägt C (2:0).
    let t = make(3);
    t = play(t, 'p0', 'p1', 2, 0); // A schlägt B
    t = play(t, 'p0', 'p2', 2, 1); // A schlägt C
    t = play(t, 'p1', 'p2', 2, 0); // B schlägt C
    const s = standings(t);
    expect(s[0].id).toBe('p0'); // A: 2 Siege
    expect(s[0].wins).toBe(2);
    expect(s[1].id).toBe('p1'); // B: 1 Sieg
    expect(s[2].id).toBe('p2'); // C: 0 Siege
    expect(s[0].points).toBe(4); // 2 je Sieg
    expect(s[0].rank).toBe(1);
  });

  it('Leg-Differenz bricht Gleichstand bei Siegen', () => {
    // Ringschluss: jeder 1 Sieg, Leg-Differenz entscheidet.
    let t = make(3);
    t = play(t, 'p0', 'p1', 2, 0); // A schlägt B klar
    t = play(t, 'p1', 'p2', 2, 1); // B schlägt C knapp
    t = play(t, 'p2', 'p0', 2, 1); // C schlägt A knapp
    const s = standings(t);
    // Alle 1 Sieg, 1 Niederlage → Leg-Differenz entscheidet. A: +2-2+1-2 … prüfen wir konkret:
    expect(s.every((r) => r.wins === 1)).toBe(true);
    expect(s[0].legDiff).toBeGreaterThanOrEqual(s[1].legDiff);
    expect(s[1].legDiff).toBeGreaterThanOrEqual(s[2].legDiff);
  });
});

describe('highlights', () => {
  it('sammelt 180er, Short Legs und High Finishes', () => {
    let t = make(3);
    const m = t.matches[0];
    t = setMatchResult(t, m.id, {
      homeLegs: 2, awayLegs: 1, winnerId: m.homeId,
      stats: {
        [m.homeId]: stat({ c180: 2, highFinish: 121, shortLegDarts: [15] }),
        [m.awayId]: stat({ c180: 0, highFinish: 40, shortLegDarts: [18] }),
      },
    });
    const hs = highlights(t);
    expect(hs.some((h) => h.kind === '180' && h.participantId === m.homeId && h.value === 2)).toBe(true);
    expect(hs.some((h) => h.kind === 'highFinish' && h.value === 121)).toBe(true);
    expect(hs.some((h) => h.kind === 'shortLeg' && h.value === 15)).toBe(true);
    expect(hs.some((h) => h.kind === 'shortLeg' && h.value === 18)).toBe(true);
    // 40er ist kein High Finish (<100)
    expect(hs.some((h) => h.kind === 'highFinish' && h.value === 40)).toBe(false);
  });
});
