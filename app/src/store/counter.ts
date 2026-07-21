import type { GamePlayer, Throw, Settings } from '../data/types';
import { CHECKOUTS } from '../data/constants';

export interface CounterSlice {
  gamePlayers: GamePlayer[];
  allThrows: Throw[];
  startOffset: number;
  settings: Settings;
}

export function checkoutCount(t: Throw[]) { return t.filter((x) => x.checkout).length; }
export function currentLeg(s: CounterSlice) { return checkoutCount(s.allThrows) + 1; }
export function legThrows(s: CounterSlice) { const cl = currentLeg(s); return s.allThrows.filter((t) => t.leg === cl); }

export function scores(s: CounterSlice): Record<string | number, number> {
  const out: Record<string | number, number> = {};
  const start = s.settings.startScore;
  s.gamePlayers.forEach((p) => { out[p.id] = start; });
  legThrows(s).forEach((t) => { if (!t.bust) out[t.playerId] -= t.score; });
  return out;
}

export function starterIdx(s: CounterSlice) { return ((s.startOffset || 0) + currentLeg(s) - 1) % s.gamePlayers.length; }
export function currentIdx(s: CounterSlice) { return (starterIdx(s) + legThrows(s).length) % s.gamePlayers.length; }
export function currentPlayer(s: CounterSlice) { return s.gamePlayers[currentIdx(s)]; }

export interface Progress {
  sets: boolean; setsWon: Record<string | number, number>; legsSet: Record<string | number, number>;
  legsToWinSet: number; setsToWin: number; over: boolean; winnerId: string | number | null;
}
export function progress(s: CounterSlice): Progress {
  const cfg = s.settings;
  const sets = cfg.unit === 'sets';
  const legsToWinSet = Math.max(1, Math.ceil((cfg.bestOf || 5) / 2));
  const setsToWin = Math.max(1, Math.ceil((cfg.bestOfSets || 3) / 2));
  const players = s.gamePlayers;
  const setsWon: Record<string | number, number> = {}, legsSet: Record<string | number, number> = {};
  players.forEach((p) => { setsWon[p.id] = 0; legsSet[p.id] = 0; });
  let over = false, winnerId: string | number | null = null;
  const cos = s.allThrows.filter((t) => t.checkout);
  for (const t of cos) {
    if (over) break;
    legsSet[t.playerId] = (legsSet[t.playerId] || 0) + 1;
    if (sets) {
      if (legsSet[t.playerId] >= legsToWinSet) {
        setsWon[t.playerId]++;
        players.forEach((p) => { legsSet[p.id] = 0; });
        if (setsWon[t.playerId] >= setsToWin) { over = true; winnerId = t.playerId; }
      }
    } else if (legsSet[t.playerId] >= legsToWinSet) { over = true; winnerId = t.playerId; }
  }
  return { sets, setsWon, legsSet, legsToWinSet, setsToWin, over, winnerId };
}
export function matchOver(s: CounterSlice) { return progress(s).over; }
export function winner(s: CounterSlice) { const id = progress(s).winnerId; return s.gamePlayers.find((p) => p.id === id) || null; }

export function average(s: CounterSlice, pid: string | number) {
  const ts = s.allThrows.filter((t) => t.playerId === pid);
  if (!ts.length) return 0;
  return ts.reduce((a, t) => a + (t.bust ? 0 : t.score), 0) / ts.length;
}
export function first9(s: CounterSlice, pid: string | number) {
  // Erste 9 Darts (3 Aufnahmen) des AKTUELLEN Legs – nicht des gesamten Matches.
  const ts = legThrows(s).filter((t) => t.playerId === pid).slice(0, 3);
  if (!ts.length) return 0;
  return ts.reduce((a, t) => a + (t.bust ? 0 : t.score), 0) / ts.length;
}
export function first9Match(s: CounterSlice, pid: string | number) {
  // Match-weiter First-9-Schnitt: Ø der ersten 3 Aufnahmen JE Leg, über alle Legs gemittelt (für die Statistik).
  const byLeg: Record<number, Throw[]> = {};
  s.allThrows.filter((t) => t.playerId === pid).forEach((t) => { (byLeg[t.leg] = byLeg[t.leg] || []).push(t); });
  const perLeg: number[] = [];
  for (const leg of Object.keys(byLeg)) {
    const ts = byLeg[+leg].slice(0, 3);
    if (ts.length) perLeg.push(ts.reduce((a, t) => a + (t.bust ? 0 : t.score), 0) / ts.length);
  }
  return perLeg.length ? perLeg.reduce((a, b) => a + b, 0) / perLeg.length : 0;
}
export function countAtLeast(s: CounterSlice, pid: string | number, n: number, exact?: boolean) {
  return s.allThrows.filter((t) => t.playerId === pid && !t.bust && (exact ? t.raw === n : t.raw >= n)).length;
}
export function lastThrow(s: CounterSlice, pid: string | number) {
  const ts = legThrows(s).filter((t) => t.playerId === pid);
  return ts.length ? ts[ts.length - 1] : null;
}
/** Checkout-Quote (% der ausspielbaren Aufnahmen, die gecheckt wurden) und High Finish */
export function finishStats(s: CounterSlice, pid: string | number): { co: number; hf: number } {
  const start = s.settings.startScore;
  const byLeg: Record<number, Throw[]> = {};
  s.allThrows.filter((t) => t.playerId === pid).forEach((t) => { (byLeg[t.leg] = byLeg[t.leg] || []).push(t); });
  let chances = 0, hits = 0, hf = 0;
  for (const leg of Object.keys(byLeg)) {
    let rem = start;
    for (const t of byLeg[+leg]) {
      const before = rem;
      if (before <= 170 && canCheckout(s.settings, before, 3).ok) chances++;
      if (t.checkout) { hits++; if (t.raw > hf) hf = t.raw; }
      if (!t.bust) rem -= t.score;
    }
  }
  return { co: chances ? Math.round((hits / chances) * 100) : 0, hf };
}

/** Short Legs = vom Spieler GEWONNENE Legs, die er mit ≤ maxDarts eigenen Darts ausgemacht hat (Liga-Highlight). */
export function shortLegs(s: CounterSlice, pid: string | number, maxDarts = 19): number {
  const byLeg: Record<number, Throw[]> = {};
  s.allThrows.filter((t) => t.playerId === pid).forEach((t) => { (byLeg[t.leg] = byLeg[t.leg] || []).push(t); });
  let count = 0;
  for (const leg of Object.keys(byLeg)) {
    const ts = byLeg[+leg];
    if (!ts.some((t) => t.checkout)) continue; // nur gewonnene Legs zählen
    const darts = ts.reduce((a, t) => a + (t.darts || 3), 0);
    if (darts <= maxDarts) count++;
  }
  return count;
}

/** Dart-Zahlen der vom Spieler GEWONNENEN Short Legs (≤ maxDarts eigene Darts) – für die Verteilung 9–19. */
export function shortLegDarts(s: CounterSlice, pid: string | number, maxDarts = 19): number[] {
  const byLeg: Record<number, Throw[]> = {};
  s.allThrows.filter((t) => t.playerId === pid).forEach((t) => { (byLeg[t.leg] = byLeg[t.leg] || []).push(t); });
  const out: number[] = [];
  for (const leg of Object.keys(byLeg)) {
    const ts = byLeg[+leg];
    if (!ts.some((t) => t.checkout)) continue; // nur gewonnene Legs
    const darts = ts.reduce((a, t) => a + (t.darts || 3), 0);
    if (darts <= maxDarts) out.push(darts);
  }
  return out;
}

/** Bestes Short Leg im Match: die NIEDRIGSTE Dartzahl einer gewonnenen Aufnahme ≤ maxDarts (über alle
 *  Legs von Best-of-N hinweg). 0 = kein Short Leg. Niedriger = besser → für die „SL"-Anzeige im Counter. */
export function bestShortLeg(s: CounterSlice, pid: string | number, maxDarts = 19): number {
  const d = shortLegDarts(s, pid, maxDarts);
  return d.length ? Math.min(...d) : 0;
}

/** Live-Feier nach einem Checkout: High Finish (Ausmache ≥100) und/oder Short Leg (≤19 eigene Darts).
 *  Rein aus dem Slice NACH der Aufnahme abgeleitet (letzte Aufnahme des Spielers muss ein Checkout sein).
 *  Feiert nur, solange das Match weiterläuft (beim entscheidenden Leg hat das Sieg-Overlay Vorrang) und
 *  nur, wenn der jeweilige Schalter nicht ausgeschaltet ist (undefined = an). null = keine Feier. */
export interface CheckoutCelebration { highFinish: boolean; shortLeg: boolean; score: number; darts: number; }

/** Reine Auszeichnung der letzten Aufnahme, wenn sie ein Checkout war: High Finish (Ausmache ≥100)
 *  und/oder Short Leg (≤19 eigene Darts). OHNE Schalter, OHNE matchOver – die Fakten des Wurfs (auch beim
 *  entscheidenden Leg). Fürs Sieg-Overlay, das die Ausmache zeigt. null = kein Checkout bzw. weder/noch. */
export function checkoutAchievement(s: CounterSlice, pid: string | number): CheckoutCelebration | null {
  const mine = s.allThrows.filter((t) => t.playerId === pid);
  const last = mine[mine.length - 1];
  if (!last || !last.checkout) return null;
  const darts = s.allThrows.filter((t) => t.playerId === pid && t.leg === last.leg).reduce((a, t) => a + (t.darts || 3), 0);
  const highFinish = last.raw >= 100;
  const shortLeg = darts <= 19;
  if (!highFinish && !shortLeg) return null;
  return { highFinish, shortLeg, score: last.raw, darts };
}

/** Live-Feier WÄHREND des Matches: nur solange es weiterläuft (beim entscheidenden Leg hat das
 *  Sieg-Overlay Vorrang) und nur, was der jeweilige Schalter erlaubt (undefined = an). null = keine Feier. */
export function checkoutCelebration(s: CounterSlice, pid: string | number): CheckoutCelebration | null {
  if (matchOver(s)) return null;
  const a = checkoutAchievement(s, pid);
  if (!a) return null;
  const highFinish = a.highFinish && s.settings.highFinishHint !== false;
  const shortLeg = a.shortLeg && s.settings.shortLegHint !== false;
  if (!highFinish && !shortLeg) return null;
  return { highFinish, shortLeg, score: a.score, darts: a.darts };
}

/** Ø Darts der Schluss-Aufnahme je gewonnenem Leg (Checkout). NIEDRIGER = besser (cleaner gefinisht).
 *  0 = (noch) kein Checkout → in der Anzeige als „–" behandeln. Nutzt die per Finish-Dart-Abfrage
 *  erfasste Dartzahl der Checkout-Aufnahme (Fallback 3, wenn unbekannt). */
export function avgCheckoutDarts(s: CounterSlice, pid: string | number): number {
  const cos = s.allThrows.filter((t) => t.playerId === pid && t.checkout);
  if (!cos.length) return 0;
  return cos.reduce((a, t) => a + (t.darts || 3), 0) / cos.length;
}

/** Gesamtzahl geworfener Darts im Match (Fallback 3 je Aufnahme ohne erfasste Dartzahl). */
export function totalDarts(s: CounterSlice, pid: string | number): number {
  return s.allThrows.filter((t) => t.playerId === pid).reduce((a, t) => a + (t.darts || 3), 0);
}

export interface ScoreRow { round: number; scored: string | number; rest: number; bust: boolean; checkout: boolean; }
export function scoreList(s: CounterSlice, pid: string | number): ScoreRow[] {
  let rest = s.settings.startScore; const rows: ScoreRow[] = [];
  legThrows(s).filter((t) => t.playerId === pid).forEach((t, i) => {
    if (!t.bust) rest -= t.score;
    rows.push({ round: i + 1, scored: t.bust ? 'BUST' : t.raw, rest, bust: t.bust, checkout: t.checkout });
  });
  return rows;
}

export function outMode(settings: Settings): 'single' | 'double' | 'master' {
  return settings.outMode || (settings.doubleOut === false ? 'single' : 'double');
}

export interface CheckoutResult { ok: boolean; reason: string; max: number; }
/** Kleinste Dartzahl (1–3), mit der `score` unter den aktuellen Regeln ausgemacht werden kann:
 *  z. B. 141 → 3, 100 → 2, 40 → 1. Basis für die Finish-Dart-Abfrage (Optionen darunter sind gesperrt,
 *  und wenn nur 3 möglich ist, wird gar nicht gefragt). */
export function minCheckoutDarts(settings: Settings, score: number): number {
  return canCheckout(settings, score, 1).ok ? 1 : canCheckout(settings, score, 2).ok ? 2 : 3;
}
export function canCheckout(settings: Settings, rem: number, darts: number): CheckoutResult {
  const mode = outMode(settings);
  if (rem <= 0) return { ok: false, reason: 'empty', max: 0 };
  if (mode !== 'single' && rem === 1) return { ok: false, reason: 'one', max: 0 };
  const singles: number[] = [];
  for (let i = 1; i <= 20; i++) { singles.push(i, i * 2, i * 3); }
  singles.push(25, 50);
  const doubles = [2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,50];
  const trebles: number[] = []; for (let i = 1; i <= 20; i++) trebles.push(i * 3);
  // valid FINAL dart: any field (single), a double/bull, or — for master — also a treble
  const finishers = mode === 'single' ? singles.slice() : mode === 'master' ? [...doubles, ...trebles] : doubles;
  const finSet = new Set(finishers); const sglSet = new Set(singles);
  const max = Math.max(...finishers) + (darts - 1) * Math.max(...singles);
  if (rem > max) return { ok: false, reason: 'high', max };
  // Mit d Darts ist auch jedes Finish mit WENIGER Darts möglich (Fehlwürfe = 0 Punkte davor) —
  // sonst wäre z. B. Rest 2 mit 3 Darts (Miss, Miss, D1) fälschlich "unmöglich".
  let ok = finSet.has(rem);
  if (!ok && darts >= 2) { for (const a of sglSet) { if (finSet.has(rem - a)) { ok = true; break; } } }
  if (!ok && darts >= 3) { for (const a of singles) { for (const b of singles) { if (finSet.has(rem - a - b)) { ok = true; break; } } if (ok) break; } }
  return { ok, reason: ok ? '' : 'impossible', max };
}

/** Checkout-Vorschlag für aktiven Spieler (≤170, ausspielbar). Master nutzt die Double-Out-Wege (auch gültig). */
export function checkoutSuggestion(settings: Settings, rem: number): string | null {
  if (outMode(settings) === 'single') return null;
  if (rem > 170 || rem < 2) return null;
  return CHECKOUTS[rem] || null;
}
