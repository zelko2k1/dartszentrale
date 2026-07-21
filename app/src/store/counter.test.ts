import { describe, it, expect } from 'vitest';
import type { CounterSlice } from './counter';
import { canCheckout, checkoutSuggestion, outMode, scores, progress, matchOver, winner, checkoutCelebration, checkoutAchievement, avgCheckoutDarts, minCheckoutDarts } from './counter';
import type { GamePlayer, Settings, Throw } from '../data/types';

// Minimal settings factory — only the fields the counter logic reads.
function settings(over: Partial<Settings> = {}): Settings {
  return {
    startScore: 501, bestOf: 5, bestOfSets: 3, unit: 'legs',
    doubleOut: true, outMode: 'double', doubleIn: false,
    ...over,
  } as Settings;
}
function player(id: string, name = id): GamePlayer {
  return { id, name, short: name.slice(0, 2).toUpperCase(), av: 0 };
}
function turn(playerId: string, raw: number, over: Partial<Throw> = {}): Throw {
  return { playerId, score: raw, raw, bust: false, checkout: false, leg: 1, darts: 3, ...over };
}
function slice(over: Partial<CounterSlice> = {}): CounterSlice {
  return {
    gamePlayers: [player('a', 'Alice'), player('b', 'Bob')],
    allThrows: [], startOffset: 0, settings: settings(),
    ...over,
  };
}

describe('canCheckout — double out', () => {
  const s = settings({ outMode: 'double' });

  it('accepts the classic finishes', () => {
    for (const rem of [170, 167, 164, 161, 160, 100, 40, 32, 2, 50]) {
      expect(canCheckout(s, rem, 3).ok, `rem=${rem}`).toBe(true);
    }
  });

  it('rejects the bogey numbers (not finishable with 3 darts)', () => {
    for (const rem of [169, 168, 166, 165, 163, 162]) {
      expect(canCheckout(s, rem, 3).ok, `rem=${rem}`).toBe(false);
    }
  });

  it('rejects remainder 1 (no double can leave or hit 1)', () => {
    expect(canCheckout(s, 1, 3).ok).toBe(false);
    expect(canCheckout(s, 1, 1).reason).toBe('one');
  });

  it('rejects anything above 170', () => {
    expect(canCheckout(s, 171, 3).ok).toBe(false);
    expect(canCheckout(s, 171, 3).reason).toBe('high');
  });

  it('with a single dart only doubles and bull finish', () => {
    expect(canCheckout(s, 40, 1).ok).toBe(true);   // D20
    expect(canCheckout(s, 50, 1).ok).toBe(true);   // Bull
    expect(canCheckout(s, 39, 1).ok).toBe(false);  // odd → no double
    expect(canCheckout(s, 60, 1).ok).toBe(false);  // T20 is not a double
  });

  it('with two darts: 110 = T20 + Bull works, 120 needs three', () => {
    expect(canCheckout(s, 110, 2).ok).toBe(true);
    expect(canCheckout(s, 111, 2).ok).toBe(false); // max 2-dart double-out finish is 110
  });
});

describe('canCheckout — single out', () => {
  const s = settings({ outMode: 'single' });
  it('remainder 1 is finishable (S1)', () => {
    expect(canCheckout(s, 1, 1).ok).toBe(true);
  });
  it('max with 3 darts is 180', () => {
    expect(canCheckout(s, 180, 3).ok).toBe(true);
    expect(canCheckout(s, 181, 3).ok).toBe(false);
  });
});

describe('canCheckout — master out', () => {
  const s = settings({ outMode: 'master' });
  it('trebles finish too', () => {
    expect(canCheckout(s, 60, 1).ok).toBe(true);   // T20
    expect(canCheckout(s, 57, 1).ok).toBe(true);   // T19
  });
  it('plain singles do not finish', () => {
    expect(canCheckout(s, 19, 1).ok).toBe(false);  // S19 is neither double nor treble
  });
  it('remainder 1 is not finishable', () => {
    expect(canCheckout(s, 1, 3).ok).toBe(false);
  });
});

describe('checkoutSuggestion', () => {
  it('returns a path for finishable scores and null otherwise', () => {
    const s = settings();
    expect(checkoutSuggestion(s, 170)).toBe('T20 T20 Bull');
    expect(checkoutSuggestion(s, 40)).toBeTruthy();
    expect(checkoutSuggestion(s, 171)).toBeNull(); // above 170
    expect(checkoutSuggestion(s, 1)).toBeNull();   // below 2
    expect(checkoutSuggestion(s, 169)).toBeNull(); // bogey number
  });
  it('is disabled in single-out mode', () => {
    expect(checkoutSuggestion(settings({ outMode: 'single' }), 170)).toBeNull();
  });
});

describe('outMode — legacy doubleOut fallback', () => {
  it('prefers explicit outMode, falls back to doubleOut flag', () => {
    expect(outMode(settings({ outMode: 'master' }))).toBe('master');
    expect(outMode(settings({ outMode: undefined as never, doubleOut: false }))).toBe('single');
    expect(outMode(settings({ outMode: undefined as never, doubleOut: true }))).toBe('double');
  });
});

describe('scores — remaining points per player', () => {
  it('subtracts scored turns, ignores busts', () => {
    const s = slice({
      allThrows: [
        turn('a', 60),
        turn('b', 100),
        turn('a', 0, { raw: 180, bust: true }), // bust: nothing is subtracted
      ],
    });
    const sc = scores(s);
    expect(sc['a']).toBe(441);
    expect(sc['b']).toBe(401);
  });
});

describe('progress — legs, sets and match end', () => {
  it('best of 5 legs: first to 3 checkouts wins', () => {
    const co = (pid: string, leg: number) => turn(pid, 40, { checkout: true, leg });
    const s = slice({
      settings: settings({ bestOf: 5, unit: 'legs' }),
      allThrows: [co('a', 1), co('b', 2), co('a', 3), co('a', 4)],
    });
    const p = progress(s);
    expect(p.legsToWinSet).toBe(3);
    expect(p.over).toBe(true);
    expect(p.winnerId).toBe('a');
    expect(matchOver(s)).toBe(true);
    expect(winner(s)?.name).toBe('Alice');
  });

  it('match is not over before the deciding leg', () => {
    const co = (pid: string, leg: number) => turn(pid, 40, { checkout: true, leg });
    const s = slice({
      settings: settings({ bestOf: 5, unit: 'legs' }),
      allThrows: [co('a', 1), co('b', 2), co('a', 3), co('b', 4)],
    });
    expect(progress(s).over).toBe(false);
    expect(winner(s)).toBeNull();
  });

  it('sets mode: legs reset after a set is won', () => {
    const co = (pid: string, leg: number) => turn(pid, 40, { checkout: true, leg });
    // best of 3 legs per set (2 to win), best of 3 sets (2 to win)
    const s = slice({
      settings: settings({ unit: 'sets', bestOf: 3, bestOfSets: 3 }),
      allThrows: [
        co('a', 1), co('a', 2),           // set 1 → Alice
        co('b', 3), co('b', 4),           // set 2 → Bob
        co('a', 5), co('b', 6), co('a', 7), // set 3 → Alice → match
      ],
    });
    const p = progress(s);
    expect(p.sets).toBe(true);
    expect(p.setsWon['a']).toBe(2);
    expect(p.setsWon['b']).toBe(1);
    expect(p.over).toBe(true);
    expect(p.winnerId).toBe('a');
  });
});

describe('bust rule (as applied by the store when a turn is entered)', () => {
  // The store marks a turn as bust when the new remainder would be negative,
  // or exactly 1 while a double/master finish is required.
  const bust = (mode: Settings['outMode'], rem: number, scored: number) => {
    const ns = rem - scored;
    return ns < 0 || (ns === 1 && mode !== 'single');
  };
  it('going below zero is always a bust', () => {
    expect(bust('double', 20, 21)).toBe(true);
    expect(bust('single', 20, 21)).toBe(true);
  });
  it('leaving exactly 1 busts in double and master out, not in single out', () => {
    expect(bust('double', 41, 40)).toBe(true);
    expect(bust('master', 41, 40)).toBe(true);
    expect(bust('single', 41, 40)).toBe(false);
  });
});

describe('checkoutCelebration — Short-Leg- & High-Finish-Feier', () => {
  // gewonnenes Leg für 'a' aus Aufnahmen bauen (letzte = Checkout); jede Aufnahme = 3 Darts.
  const leg = (raws: number[]) => raws.map((r, i) =>
    turn('a', r, i === raws.length - 1 ? { checkout: true } : {}));

  it('feiert ein Short Leg (≤19 Darts, Ausmache <100)', () => {
    const s = slice({ allThrows: leg([180, 180, 101, 40]) }); // 12 Darts, Ausmache 40
    expect(checkoutCelebration(s, 'a')).toEqual({ highFinish: false, shortLeg: true, score: 40, darts: 12 });
  });

  it('feiert einen High Finish (Ausmache ≥100, >19 Darts)', () => {
    const s = slice({ allThrows: leg([60, 60, 60, 60, 60, 60, 141]) }); // 21 Darts, Ausmache 141
    expect(checkoutCelebration(s, 'a')).toEqual({ highFinish: true, shortLeg: false, score: 141, darts: 21 });
  });

  it('feiert beides beim 141er als 9-Darter', () => {
    const s = slice({ allThrows: leg([180, 180, 141]) }); // 9 Darts, Ausmache 141
    expect(checkoutCelebration(s, 'a')).toEqual({ highFinish: true, shortLeg: true, score: 141, darts: 9 });
  });

  it('respektiert die Schalter (aus = unterdrückt)', () => {
    const both = leg([180, 180, 141]); // wäre beides
    expect(checkoutCelebration(slice({ allThrows: both, settings: settings({ shortLegHint: false, highFinishHint: false }) }), 'a')).toBeNull();
    expect(checkoutCelebration(slice({ allThrows: both, settings: settings({ highFinishHint: false }) }), 'a'))
      .toEqual({ highFinish: false, shortLeg: true, score: 141, darts: 9 });
    expect(checkoutCelebration(slice({ allThrows: both, settings: settings({ shortLegHint: false }) }), 'a'))
      .toEqual({ highFinish: true, shortLeg: false, score: 141, darts: 9 });
  });

  it('feiert NICHT beim entscheidenden Leg (Match vorbei → Sieg-Overlay hat Vorrang)', () => {
    const s = slice({ allThrows: leg([180, 180, 141]), settings: settings({ bestOf: 1 }) });
    expect(checkoutCelebration(s, 'a')).toBeNull();
  });

  it('feiert nicht, wenn die letzte Aufnahme kein Checkout ist', () => {
    expect(checkoutCelebration(slice({ allThrows: [turn('a', 180), turn('a', 60)] }), 'a')).toBeNull();
  });

  it('feiert nicht bei langem Leg mit kleiner Ausmache', () => {
    const s = slice({ allThrows: leg([80, 80, 80, 80, 80, 80, 21]) }); // 21 Darts, Ausmache 21 → weder noch
    expect(checkoutCelebration(s, 'a')).toBeNull();
  });
});

describe('checkoutAchievement — reine Auszeichnung fürs Sieg-Overlay', () => {
  const leg = (raws: number[]) => raws.map((r, i) =>
    turn('a', r, i === raws.length - 1 ? { checkout: true } : {}));

  it('liefert die Auszeichnung AUCH beim Match-Ende (anders als checkoutCelebration)', () => {
    const s = slice({ allThrows: leg([180, 180, 141]), settings: settings({ bestOf: 1 }) }); // Match vorbei
    expect(checkoutCelebration(s, 'a')).toBeNull();                                            // Live-Feier unterdrückt
    expect(checkoutAchievement(s, 'a')).toEqual({ highFinish: true, shortLeg: true, score: 141, darts: 9 });
  });

  it('ignoriert die Feier-Schalter (liefert die reinen Fakten – Gating macht der Aufrufer)', () => {
    const s = slice({ allThrows: leg([180, 180, 141]), settings: settings({ shortLegHint: false, highFinishHint: false }) });
    expect(checkoutAchievement(s, 'a')).toEqual({ highFinish: true, shortLeg: true, score: 141, darts: 9 });
  });

  it('null, wenn weder High Finish noch Short Leg', () => {
    expect(checkoutAchievement(slice({ allThrows: leg([80, 80, 80, 80, 80, 80, 21]) }), 'a')).toBeNull();
  });
});

describe('avgCheckoutDarts — Ø Darts je Checkout', () => {
  const co = (leg: number, darts: number) => turn('a', 40, { checkout: true, leg, darts });
  it('mittelt die Finish-Dartzahl der gewonnenen Legs', () => {
    const s = slice({ allThrows: [co(1, 1), co(2, 3), co(3, 2)] }); // (1+3+2)/3 = 2
    expect(avgCheckoutDarts(s, 'a')).toBeCloseTo(2, 5);
  });
  it('0, wenn (noch) kein Checkout', () => {
    expect(avgCheckoutDarts(slice({ allThrows: [turn('a', 60)] }), 'a')).toBe(0);
  });
});

describe('minCheckoutDarts — kleinste mögliche Finish-Dartzahl (Double Out)', () => {
  const s = settings({ outMode: 'double' });
  it('141 nur mit 3 Darts', () => { expect(minCheckoutDarts(s, 141)).toBe(3); });
  it('170 nur mit 3 Darts', () => { expect(minCheckoutDarts(s, 170)).toBe(3); });
  it('100 erst ab 2 Darts', () => { expect(minCheckoutDarts(s, 100)).toBe(2); });
  it('40 (D20) schon mit 1 Dart', () => { expect(minCheckoutDarts(s, 40)).toBe(1); });
  it('50 (Bull) schon mit 1 Dart', () => { expect(minCheckoutDarts(s, 50)).toBe(1); });
});
