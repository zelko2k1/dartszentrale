import { describe, it, expect } from 'vitest';
import { CHECKOUTS } from './constants';

// Every suggested checkout path must (a) add up to exactly the remaining score
// and (b) end on a double or the bull — otherwise the suggestion would be wrong
// on the board. This guards the whole table against typos.

function tokenValue(tok: string): number {
  if (tok === 'Bull') return 50;
  if (tok.startsWith('T')) return 3 * Number(tok.slice(1));
  if (tok.startsWith('D')) return 2 * Number(tok.slice(1));
  return Number(tok); // plain single (e.g. "20" or "25")
}
function isValidFinalDart(tok: string): boolean {
  return tok === 'Bull' || tok.startsWith('D');
}

describe('CHECKOUTS table', () => {
  const entries = Object.entries(CHECKOUTS).map(([rem, path]) => ({ rem: Number(rem), path }));

  it('is non-empty and covers 170 and 40', () => {
    expect(entries.length).toBeGreaterThan(80);
    expect(CHECKOUTS[170]).toBeTruthy();
    expect(CHECKOUTS[40]).toBeTruthy();
  });

  it('has no entries for the bogey numbers', () => {
    for (const bogey of [169, 168, 166, 165, 163, 162]) {
      expect(CHECKOUTS[bogey], `bogey ${bogey}`).toBeUndefined();
    }
  });

  it.each(Object.entries(CHECKOUTS))('path for %s sums up and ends on a double', (rem, path) => {
    const toks = path.split(/\s+/);
    expect(toks.length).toBeLessThanOrEqual(3);
    const sum = toks.reduce((a, t) => a + tokenValue(t), 0);
    expect(sum, `"${path}" should total ${rem}`).toBe(Number(rem));
    expect(isValidFinalDart(toks[toks.length - 1]), `"${path}" must end on a double or bull`).toBe(true);
    for (const t of toks) {
      const v = tokenValue(t);
      expect(Number.isFinite(v) && v > 0, `token "${t}" in "${path}"`).toBe(true);
      if (t.startsWith('T') || t.startsWith('D')) {
        const base = Number(t.slice(1));
        expect(base >= 1 && base <= 20, `segment ${t} out of range`).toBe(true);
      }
    }
  });
});
