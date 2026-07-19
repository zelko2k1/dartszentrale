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
});
