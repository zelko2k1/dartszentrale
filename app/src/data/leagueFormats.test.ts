import { describe, it, expect } from 'vitest';
import { LEAGUE_FORMAT_PRESETS } from './constants';

// Kompakte Kurzschreibweise einer Vorlage, z. B. [{singles,8},{doubles,4}] -> "8E-4D".
const asText = (segs: { kind: string; count: number }[]) =>
  segs.map((s) => `${s.count}${s.kind === 'singles' ? 'E' : 'D'}`).join('-');

describe('LEAGUE_FORMAT_PRESETS', () => {
  it('enthält exakt die 8 gewünschten Vorlagen in Reihenfolge', () => {
    expect(LEAGUE_FORMAT_PRESETS.map((p) => asText(p.segments))).toEqual([
      '8E-8E',
      '8E-4D',
      '8E-2D-8E',
      '6E-3D-6E',
      '4E-4E-2D',
      '4E-2D-4E-2D',
      '4E-2D-4E-2D-4E',
      '4E-4E-2D-4E-4E',
    ]);
  });

  it('trägt keine Liga-Namen/Überschriften mehr (nur key + segments)', () => {
    for (const p of LEAGUE_FORMAT_PRESETS) {
      expect(Object.keys(p).sort()).toEqual(['key', 'segments']);
    }
  });

  it('hat eindeutige keys', () => {
    const keys = LEAGUE_FORMAT_PRESETS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
