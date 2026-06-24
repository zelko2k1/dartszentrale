// User-configurable shortcut, restricted to Strg + Alt + <letter/digit>.
// Uses e.code (physical key) so it is layout-independent and AltGr-proof.

function keyName(e: KeyboardEvent): string | null {
  if (/^Key[A-Z]$/.test(e.code)) return e.code.slice(3).toLowerCase(); // KeyN -> n
  if (/^Digit[0-9]$/.test(e.code)) return e.code.slice(5);             // Digit5 -> 5
  if (/^Numpad[0-9]$/.test(e.code)) return e.code.slice(6);            // Numpad5 -> 5
  return null;
}

export function comboFromEvent(e: KeyboardEvent): string | null {
  const k = keyName(e);
  if (!k) return null;
  // On Windows (esp. German layouts) "Strg + Alt" == AltGr, which some browsers report
  // via the AltGraph modifier instead of ctrlKey+altKey. Treat AltGr as Strg+Alt.
  const altGr = typeof e.getModifierState === 'function' && e.getModifierState('AltGraph');
  const ctrl = e.ctrlKey || altGr;
  const alt = e.altKey || altGr;
  const parts: string[] = [];
  if (ctrl) parts.push('ctrl');
  if (alt) parts.push('alt');
  if (e.shiftKey) parts.push('shift');
  if (e.metaKey) parts.push('meta');
  parts.push(k);
  return parts.join('+');
}

// Only Strg + Alt + a single letter/digit is allowed.
export function isValidCombo(combo: string): boolean {
  return /^ctrl\+alt\+[a-z0-9]$/.test(combo);
}

const LABELS: Record<string, string> = { ctrl: 'Strg', alt: 'Alt', shift: 'Shift', meta: '⌘' };

export function formatCombo(combo: string): string {
  if (!combo) return '—';
  return combo.split('+').map((p) => LABELS[p] || p.toUpperCase()).join(' + ');
}
