// Hilfsfunktionen für Datum/Zeit/IDs

// 15-stellige Kleinbuchstaben-/Ziffern-ID — kompatibel mit dem PocketBase-Standard-ID-Format,
// damit clientseitig erzeugte IDs direkt an PocketBase übergeben werden können (Relationen bleiben gültig).
const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
export function uid(): string {
  let s = '';
  for (let i = 0; i < 15; i++) s += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)];
  return s;
}

/** YYYY-MM-DD, off Tage von heute */
export function iso(off: number): string {
  const d = new Date();
  d.setDate(d.getDate() + off);
  return d.toISOString().slice(0, 10);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const WD_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const WD_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MON_LONG = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MON_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

export function parseIso(d: string): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, (m || 1) - 1, day || 1);
}

/** "MONTAG, 22. JUNI" (Dashboard-Kopf) */
export function longDate(date: Date = new Date()): string {
  return `${WD_LONG[date.getDay()]}, ${date.getDate()}. ${MON_LONG[date.getMonth()]}`;
}

export function timeNow(date: Date = new Date()): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function greeting(date: Date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return 'Gute Nacht';
  if (h < 11) return 'Guten Morgen';
  if (h < 17) return 'Guten Tag';
  if (h < 22) return 'Guten Abend';
  return 'Gute Nacht';
}

/** Datums-Badge: { mon: "JUN", day: "24", wd: "Mi" } */
export function dateBadge(isoStr: string): { mon: string; day: string; wd: string } {
  const d = parseIso(isoStr);
  return { mon: MON_SHORT[d.getMonth()].toUpperCase(), day: String(d.getDate()), wd: WD_SHORT[d.getDay()] };
}

/** "Sa., 27. Juni" */
export function shortLong(isoStr: string): string {
  const d = parseIso(isoStr);
  return `${WD_SHORT[d.getDay()]}., ${d.getDate()}. ${MON_LONG[d.getMonth()]}`;
}

/** "FR 19. SEP" — Aufstellungs-Kopf */
export function lineupDate(isoStr: string): string {
  const d = parseIso(isoStr);
  return `${WD_SHORT[d.getDay()].toUpperCase()} ${d.getDate()}. ${MON_SHORT[d.getMonth()].toUpperCase()}`;
}

export { WD_SHORT, WD_LONG, MON_SHORT, MON_LONG };

export function firstName(name: string): string {
  return (name || '').trim().split(/\s+/)[0] || name;
}
export function lastName(name: string): string {
  return (name || '').trim().split(/\s+/).slice(1).join(' ');
}
export function initials(name: string): string {
  const parts = (name || '').trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
