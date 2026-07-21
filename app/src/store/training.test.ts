import { describe, it, expect } from 'vitest';
import { newTrainGame, applyTurn, TRAIN_BEST, isBetterBest, trainCelebration, ATC_SEQ, type TrainPlayer } from './training';

function tp(slot: number, pid: string, name = pid): TrainPlayer {
  return { id: `t${slot}_${pid}`, pid, name, short: name.slice(0, 2).toUpperCase(), av: 0 };
}

describe('isBetterBest', () => {
  it('max: higher is better; first value always counts', () => {
    expect(isBetterBest('max', 50, undefined)).toBe(true);
    expect(isBetterBest('max', 60, 50)).toBe(true);
    expect(isBetterBest('max', 40, 50)).toBe(false);
  });
  it('min: lower is better; first value always counts', () => {
    expect(isBetterBest('min', 30, undefined)).toBe(true);
    expect(isBetterBest('min', 20, 30)).toBe(true);
    expect(isBetterBest('min', 40, 30)).toBe(false);
  });
  it('wins: only an actual win (1) counts — never a "first best" from 0', () => {
    expect(isBetterBest('wins', 0, undefined)).toBe(false);
    expect(isBetterBest('wins', 1, undefined)).toBe(true);
    expect(isBetterBest('wins', 1, 3)).toBe(false); // akkumuliert wird separat; 1 vs 3 ist kein „besser"
  });
});

describe('TRAIN_BEST value', () => {
  it('doubles: hit rate over all thrown darts', () => {
    let g = newTrainGame('doubles', [tp(0, 'p1')]);
    g = applyTurn(g, { kind: 'hits', hits: 3 }); // 3/3
    g = applyTurn(g, { kind: 'hits', hits: 0 }); // 3/6
    expect(TRAIN_BEST.doubles.value(g, g.players[0].id)).toBe(50);
    expect(TRAIN_BEST.doubles.format(50)).toBe('50%');
  });

  it('atc: darts only count once the ladder is completed (min)', () => {
    let g = newTrainGame('atc', [tp(0, 'p1')]);
    const id = g.players[0].id;
    expect(TRAIN_BEST.atc.value(g, id)).toBeNull(); // noch nicht durch
    for (let i = 0; i < ATC_SEQ.length && !g.over; i++) g = applyTurn(g, { kind: 'advance', advance: 3 });
    expect(g.over).toBe(true);
    expect(TRAIN_BEST.atc.value(g, id)).toBe(ATC_SEQ.length); // 21 Ziele / 3 pro Aufnahme → 21 Darts
    expect(TRAIN_BEST.atc.kind).toBe('min');
  });

  it('halveit / bobs27: score is read per player', () => {
    let g = newTrainGame('bobs27', [tp(0, 'p1')]);
    g = applyTurn(g, { kind: 'hits', hits: 1 }); // Runde 1 = Doppel 1: +2
    expect(TRAIN_BEST.bobs27.value(g, g.players[0].id)).toBe(29);
  });

  it('elimination/killer are win-counters (0 for a loss this game)', () => {
    const g = newTrainGame('killer', [tp(0, 'p1'), tp(1, 'p2')]);
    // frisches Spiel, niemand hat gewonnen → 0
    expect(TRAIN_BEST.killer.value(g, g.players[0].id)).toBe(0);
    expect(TRAIN_BEST.killer.kind).toBe('wins');
  });
});

describe('trainCelebration', () => {
  it('doubles 3/3 celebrates, 2/3 does not', () => {
    const g = newTrainGame('doubles', [tp(0, 'p1', 'Ann')]);
    const hit3 = applyTurn(g, { kind: 'hits', hits: 3 });
    expect(trainCelebration(g, hit3, { kind: 'hits', hits: 3 })).not.toBeNull();
    const hit2 = applyTurn(g, { kind: 'hits', hits: 2 });
    expect(trainCelebration(g, hit2, { kind: 'hits', hits: 2 })).toBeNull();
  });

  it('checkout121 celebrates a 1-dart finish only', () => {
    const g = newTrainGame('checkout121', [tp(0, 'p1')]);
    const one = applyTurn(g, { kind: 'made', made: true, darts: 1 });
    expect(trainCelebration(g, one, { kind: 'made', made: true, darts: 1 })).not.toBeNull();
    const three = applyTurn(g, { kind: 'made', made: true, darts: 3 });
    expect(trainCelebration(g, three, { kind: 'made', made: true, darts: 3 })).toBeNull();
  });

  it('baseball celebrates 3+ runs (home run)', () => {
    const g = newTrainGame('baseball', [tp(0, 'p1')]);
    const hr = applyTurn(g, { kind: 'runs', runs: 3 });
    expect(trainCelebration(g, hr, { kind: 'runs', runs: 3 })).not.toBeNull();
    const two = applyTurn(g, { kind: 'runs', runs: 2 });
    expect(trainCelebration(g, two, { kind: 'runs', runs: 2 })).toBeNull();
  });

  it('killer celebrates when a player becomes armed', () => {
    const players = [tp(0, 'p1', 'Ann'), tp(1, 'p2', 'Bo')];
    const g = newTrainGame('killer', players);
    const cur = g.players[g.turnIdx];
    const armed = applyTurn(g, { kind: 'killer', darts: [cur.id, null, null] });
    expect(armed.data.isKiller![cur.id]).toBe(true);
    expect(trainCelebration(g, armed, { kind: 'killer', darts: [cur.id, null, null] })).not.toBeNull();
  });
});
