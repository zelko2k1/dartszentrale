import { describe, it, expect } from 'vitest';
import { seedPlayers, withDefaultPlayers, isSeedPlayer } from './seed';
import type { Player } from './types';

describe('isSeedPlayer', () => {
  it('erkennt die beiden lokalen Standard-Spieler', () => {
    expect(isSeedPlayer('p_seed1')).toBe(true);
    expect(isSeedPlayer('p_seed2')).toBe(true);
  });
  it('echte (Server-)Spieler-IDs sind keine Seed-Spieler', () => {
    expect(isSeedPlayer('abc123def456ghi')).toBe(false);
    expect(isSeedPlayer('')).toBe(false);
  });
  it('deckt alle von seedPlayers() erzeugten IDs ab', () => {
    // Schützt die isSeedPlayer-Sync-Ausnahme: kämen neue Seed-Spieler dazu, müssten sie hier erfasst sein.
    for (const p of seedPlayers()) expect(isSeedPlayer(p.id)).toBe(true);
  });
});

describe('withDefaultPlayers', () => {
  it('stellt beide Standard-Spieler voran, wenn sie fehlen', () => {
    const real: Player[] = [{ id: 'srv1', name: 'Max Real', short: 'MR', avi: 1 }];
    const out = withDefaultPlayers(real);
    expect(out.map((p) => p.id)).toEqual(['p_seed1', 'p_seed2', 'srv1']);
  });
  it('dupliziert vorhandene Seed-Spieler nicht und markiert sie als locked', () => {
    const withSeed: Player[] = [{ id: 'p_seed1', name: 'Spieler 1', short: 'S1', avi: 6 }];
    const out = withDefaultPlayers(withSeed);
    expect(out.filter((p) => p.id === 'p_seed1')).toHaveLength(1);
    expect(out.find((p) => p.id === 'p_seed1')?.locked).toBe(true);
  });
});
