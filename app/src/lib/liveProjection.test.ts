import { describe, it, expect } from 'vitest';
import { projectLiveState, type ProjectableState } from './liveProjection';
import type { GamePlayer, Settings, Throw } from '../data/types';

function settings(over: Partial<Settings> = {}): Settings {
  return { startScore: 501, bestOf: 5, bestOfSets: 3, unit: 'legs', doubleOut: true, outMode: 'double', doubleIn: false, ...over } as Settings;
}
function player(id: string, name = id): GamePlayer {
  return { id, name, short: name.slice(0, 2).toUpperCase(), av: 0 };
}
function turn(playerId: string, raw: number, over: Partial<Throw> = {}): Throw {
  return { playerId, score: raw, raw, bust: false, checkout: false, leg: 1, darts: 3, ...over };
}
function state(over: Partial<ProjectableState> = {}): ProjectableState {
  return {
    gamePlayers: [player('a', 'Alice'), player('b', 'Bob')],
    allThrows: [], startOffset: 0, settings: settings(),
    screen: 'counter', input: '', pendingStart: false,
    ...over,
  };
}

describe('projectLiveState', () => {
  it('idle when no active game (not on counter screen)', () => {
    const v = projectLiveState(state({ screen: 'setup' }));
    expect(v.phase).toBe('idle');
    expect(v.players.map((p) => p.name)).toEqual(['Alice', 'Bob']);
    expect(v.checkout).toEqual([]);
  });

  it('whoBegins during starter selection', () => {
    const v = projectLiveState(state({ pendingStart: true }));
    expect(v.phase).toBe('whoBegins');
    expect(v.players.every((p) => p.score === 501)).toBe(true);
    expect(v.currentIdx).toBe(0);
  });

  it('playing: reflects rest-scores and whose turn after a throw', () => {
    const v = projectLiveState(state({ allThrows: [turn('a', 100)] }));
    expect(v.phase).toBe('playing');
    expect(v.players[0].score).toBe(401); // Alice 501-100
    expect(v.players[1].score).toBe(501); // Bob untouched
    expect(v.currentIdx).toBe(1);         // Bob to throw
    expect(v.checkout).toEqual([]);       // 401 → no finish
    expect(v.input).toBe('');
  });

  it('mirrors the input buffer live', () => {
    const v = projectLiveState(state({ input: '60' }));
    expect(v.input).toBe('60');
  });

  it('offers a checkout suggestion when the current player can finish', () => {
    // Zwei Würfe im Leg → wieder Alice dran; Alice steht auf 40 (finishbar).
    const v = projectLiveState(state({ allThrows: [turn('a', 461), turn('b', 100)] }));
    expect(v.currentIdx).toBe(0);
    expect(v.players[0].score).toBe(40);
    expect(v.checkout.length).toBeGreaterThan(0);
  });

  it('won: phase won with winner name (best of 5 legs, first to 3)', () => {
    const co = (pid: string, leg: number) => turn(pid, 40, { checkout: true, leg });
    const v = projectLiveState(state({ allThrows: [co('a', 1), co('b', 2), co('a', 3), co('a', 4)] }));
    expect(v.phase).toBe('won');
    expect(v.winner).toBe('Alice');
  });

  // Ein 9-Darter für Alice: 180, 180, 141-Checkout → Shortleg (9 Darts) + High Finish (141).
  const nineDarter = [
    turn('a', 180, { leg: 1 }),
    turn('a', 180, { leg: 1 }),
    turn('a', 141, { leg: 1, checkout: true }),
  ];

  it('exposes per-player live stats (avg3, 180er, high finish) for the TV view', () => {
    const v = projectLiveState(state({ allThrows: nineDarter }));
    const alice = v.players[0];
    expect(alice.c180).toBe(2);
    expect(alice.hf).toBe(141);            // höchste Ausmache
    expect(alice.avg3).toBeGreaterThan(150);
    expect(v.players[1].c180).toBe(0);
  });

  it('populates lastThrow (player index + value + bust)', () => {
    const v = projectLiveState(state({ allThrows: [turn('a', 100)] }));
    expect(v.lastThrow).toMatchObject({ player: 0, value: 100, bust: false });
  });

  it('emits a transient 180 event for a 180 on the last throw', () => {
    const v = projectLiveState(state({ allThrows: [turn('a', 180)] }));
    expect(v.event).toMatchObject({ kind: '180', player: 'Alice', value: 180 });
    expect(v.event!.id).toContain(':180');
  });

  it('emits a high-finish event on a ≥100 checkout (priority over short leg)', () => {
    const v = projectLiveState(state({ allThrows: nineDarter })); // …141-Checkout, 9 Darts
    expect(v.event).toMatchObject({ kind: 'highFinish', player: 'Alice', value: 141 });
  });

  it('emits a short-leg event on a low checkout that finishes a short leg', () => {
    const v = projectLiveState(state({ allThrows: [
      turn('a', 140, { leg: 1 }), turn('a', 140, { leg: 1 }), turn('a', 140, { leg: 1 }),
      turn('a', 81, { leg: 1, checkout: true }), // 501 in 12 Darts, Ausmache 81 (<100)
    ] }));
    expect(v.event).toMatchObject({ kind: 'shortLeg', player: 'Alice', value: 12 });
  });

  it('no event after a normal (non-notable) throw', () => {
    const v = projectLiveState(state({ allThrows: [turn('a', 60)] }));
    expect(v.event).toBeNull();
  });

  it('event id changes per throw so the TV can re-trigger the celebration', () => {
    const one = projectLiveState(state({ allThrows: [turn('a', 180)] })).event!.id;
    const two = projectLiveState(state({ allThrows: [turn('a', 180), turn('b', 180)] })).event!.id;
    expect(one).not.toBe(two);
  });
});
