import { describe, it, expect } from 'vitest';
import { contrastRatio, accentFg, accentRing, accentEdge } from './selectors';

// Die zehn wählbaren Akzente aus den Einstellungen + die vier Skin-Akzente.
const ACCENTS = ['#FFFFFF', '#000000', '#2BD377', '#19A463', '#3B9EFF', '#F2B829', '#E0594B', '#9b6dff', '#2bd3c0', '#FF8A3D'];
const SKIN_ACCENTS: [string, 'dark' | 'light'][] = [
  ['#33C6E8', 'dark'], ['#2FBFA8', 'dark'], ['#4E8C7A', 'light'], ['#26478F', 'light'],
];
// Extremste Fläche je Modus über alle Themes — dieselbe Referenz wie in selectors.ts.
const CANVAS = { dark: '#02060d', light: '#ffffff' } as const;

describe('contrastRatio', () => {
  it('liefert die bekannten Eckwerte', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
  });
  it('ist symmetrisch', () => {
    expect(contrastRatio('#2BD377', '#14181c')).toBeCloseTo(contrastRatio('#14181c', '#2BD377'), 10);
  });
});

describe('accentFg', () => {
  it('hält AA auf JEDER wählbaren Akzentfläche', () => {
    for (const a of [...ACCENTS, ...SKIN_ACCENTS.map(([c]) => c)]) {
      expect(contrastRatio(a, accentFg(a)), `Akzent ${a}`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('wählt für den Standard-Akzent die dunkle Tinte', () => {
    // Regression: die alte YIQ-Formel nahm hier Weiß → 1,97:1.
    expect(accentFg('#2BD377')).toBe('#06160d');
    expect(contrastRatio('#2BD377', accentFg('#2BD377'))).toBeGreaterThan(9);
  });
  it('nimmt die jeweils bessere der beiden Tinten', () => {
    expect(accentFg('#000000')).toBe('#ffffff');
    expect(accentFg('#FFFFFF')).toBe('#06160d');
  });
});

describe('accentRing', () => {
  it('bleibt gegen jede Fläche sichtbar (WCAG 1.4.11: 3:1)', () => {
    for (const mode of ['dark', 'light'] as const) {
      for (const a of ACCENTS) {
        expect(contrastRatio(accentRing(a, mode), CANVAS[mode]), `${a} / ${mode}`).toBeGreaterThanOrEqual(3);
      }
    }
    for (const [a, mode] of SKIN_ACCENTS) {
      expect(contrastRatio(accentRing(a, mode), CANVAS[mode]), `Skin ${a}`).toBeGreaterThanOrEqual(3);
    }
  });
  it('lässt tragfähige Akzente unangetastet', () => {
    expect(accentRing('#2BD377', 'dark')).toBe('#2BD377');
    expect(accentRing('#000000', 'light')).toBe('#000000');
  });
  it('zieht nur nach, wo der Akzent in der Fläche verschwindet', () => {
    // Regression: Weiß auf hellem Papier ergab einen Ring mit 1,00:1.
    expect(accentRing('#FFFFFF', 'light')).not.toBe('#FFFFFF');
    expect(accentRing('#000000', 'dark')).not.toBe('#000000');
  });
});

describe('accentEdge', () => {
  it('bleibt für gewöhnliche Akzente unsichtbar', () => {
    for (const a of ['#2BD377', '#3B9EFF', '#E0594B', '#9b6dff', '#FF8A3D']) {
      expect(accentEdge(a, 'dark')).toBe('transparent');
      expect(accentEdge(a, 'light')).toBe('transparent');
    }
  });
  it('greift genau dort, wo die Akzentfläche mit dem Untergrund verschmilzt', () => {
    expect(accentEdge('#FFFFFF', 'light')).not.toBe('transparent');
    expect(accentEdge('#000000', 'dark')).not.toBe('transparent');
  });
});
