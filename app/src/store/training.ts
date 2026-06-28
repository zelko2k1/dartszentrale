// Trainingsspiel-Logik — reine (pure) Engine für alle Modi aus TRAIN_MODES.
// Jeder Modus teilt sich ein gemeinsames TrainGame-Modell; die Spiel-spezifische
// Logik liegt in initData() / applyTurn() / standings() (Switch nach modeId).
import { TRAIN_MODES, CRICKET_TARGETS, CHECKOUTS } from '../data/constants';

export interface TrainPlayer { id: string; name: string; short: string; av: number; photo?: string; }

export interface TrainLog { round: number; playerId: string; text: string; }

// Spiel-spezifischer Datentopf — pro Modus werden nur die jeweils nötigen Felder genutzt.
export interface TrainData {
  // sequenzielle Solo-Spiele (1 Spieler)
  targetIdx?: number;
  hits?: number;
  throws?: number;
  made?: number;
  attempts?: number;
  best?: number;
  // pro-Spieler-Maps
  pos?: Record<string, number>;        // ATC: Anzahl erledigter Ziele
  darts?: Record<string, number>;      // ATC: geworfene Darts
  runs?: Record<string, number>;       // Baseball: Summe
  innings?: Record<string, number[]>;  // Baseball: Runs je Inning
  rounds?: Record<string, { val: number; hit: boolean }[]>; // Halve It: Score je Runde + Treffer-Flag
  score?: Record<string, number>;      // Bob's 27, Halve It, Elimination
  marks?: Record<string, Record<number, number>>; // Cricket
  points?: Record<string, number>;     // Cricket
  num?: Record<string, number>;        // Killer: eigene Zahl
  lives?: Record<string, number>;      // Killer
  isKiller?: Record<string, boolean>;  // Killer
}

export interface TrainGame {
  modeId: string;
  players: TrainPlayer[];
  turnIdx: number;   // welcher Spieler ist dran (Index in players)
  round: number;     // 1-basiert
  data: TrainData;
  log: TrainLog[];
  over: boolean;
  winnerIds: string[];
}

// ── Eingabe pro Aufnahme (vom Screen erzeugt) ──
export type TurnInput =
  | { kind: 'hits'; hits: number }                    // doubles, bobs27
  | { kind: 'made'; made: boolean; darts: number }    // checkout121
  | { kind: 'advance'; advance: number }              // atc
  | { kind: 'runs'; runs: number }                    // baseball
  | { kind: 'halve'; scored: number }                 // halveit (0 = verfehlt → halbieren)
  | { kind: 'marks'; marks: Record<number, number> }  // cricket
  | { kind: 'score'; score: number }                  // elimination
  | { kind: 'killer'; darts: (string | null)[] };     // killer: je Dart getroffene Spieler-Zahl oder null

// ── Sequenzen / Konstanten ──
export const ATC_SEQ = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,25];
export const DOUBLES_SEQ = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,25];
export const BOBS27_SEQ = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,25];
export const BASEBALL_INNINGS = 9;
export const KILLER_LIVES = 3;
export interface HalveTarget { label: string; hint: string; }
export const HALVEIT_TARGETS: HalveTarget[] = [
  { label: '15', hint: 'Alle Treffer auf die 15' },
  { label: '16', hint: 'Alle Treffer auf die 16' },
  { label: 'Doppel', hint: 'Nur Doppelfelder zählen' },
  { label: '17', hint: 'Alle Treffer auf die 17' },
  { label: '18', hint: 'Alle Treffer auf die 18' },
  { label: 'Triple', hint: 'Nur Triplefelder zählen' },
  { label: '19', hint: 'Alle Treffer auf die 19' },
  { label: '20', hint: 'Alle Treffer auf die 20' },
  { label: 'Bull', hint: 'Nur Bull / Bullseye zählt' },
];
export const HALVEIT_START = 40;
export const ELIM_TARGET = 301;

// Checkout-Leiter ab 121 aufwärts, nur Zahlen mit gültigem Finish (Bogey-Zahlen raus), max. 12 Stationen.
export const CHECKOUT121_SEQ: number[] = (() => {
  const out: number[] = [];
  for (let n = 121; n <= 170 && out.length < 12; n++) if (CHECKOUTS[n]) out.push(n);
  return out;
})();

// ── Meta pro Modus ──
export interface TrainMeta { solo: boolean; versus: boolean; minPlayers: number; maxPlayers: number; }
export function trainMeta(modeId: string): TrainMeta {
  const m = TRAIN_MODES.find((x) => x.id === modeId);
  const solo = !!m?.solo, versus = !!m?.versus;
  return { solo, versus, minPlayers: solo ? 1 : 2, maxPlayers: versus ? 8 : 1 };
}

// ── Initialisierung ──
export function initData(modeId: string, players: TrainPlayer[]): TrainData {
  const ids = players.map((p) => p.id);
  const zero = (): Record<string, number> => Object.fromEntries(ids.map((id) => [id, 0]));
  switch (modeId) {
    case 'doubles': return { targetIdx: 0, hits: 0, throws: 0 };
    case 'bobs27': return { targetIdx: 0, score: Object.fromEntries(ids.map((id) => [id, 27])) };
    case 'checkout121': return { targetIdx: 0, made: 0, attempts: 0, best: 0 };
    case 'atc': return { pos: zero(), darts: zero() };
    case 'baseball': return { runs: zero(), innings: Object.fromEntries(ids.map((id) => [id, []])) };
    case 'halveit': return { score: Object.fromEntries(ids.map((id) => [id, HALVEIT_START])), rounds: Object.fromEntries(ids.map((id) => [id, []])) };
    case 'cricket': return {
      marks: Object.fromEntries(ids.map((id) => [id, Object.fromEntries(CRICKET_TARGETS.map((n) => [n, 0]))])),
      points: zero(),
    };
    case 'elimination': return { score: zero() };
    case 'killer': {
      const num: Record<string, number> = {};
      ids.forEach((id, i) => { num[id] = 20 - i; }); // 20,19,18,… eindeutige Zahlen
      return { num, lives: Object.fromEntries(ids.map((id) => [id, KILLER_LIVES])), isKiller: Object.fromEntries(ids.map((id) => [id, false])) };
    }
    default: return {};
  }
}

export function newTrainGame(modeId: string, players: TrainPlayer[]): TrainGame {
  return { modeId, players, turnIdx: 0, round: 1, data: initData(modeId, players), log: [], over: false, winnerIds: [] };
}

// ── aktuelle Sequenz-Position / aktuelles Ziel (für Anzeige) ──
export function currentTarget(g: TrainGame): { label: string; value: number; hint?: string } | null {
  const cur = g.players[g.turnIdx];
  switch (g.modeId) {
    case 'doubles': { const v = DOUBLES_SEQ[g.round - 1]; return v ? { label: v === 25 ? 'Bull' : `D${v}`, value: v } : null; }
    case 'bobs27': { const v = BOBS27_SEQ[g.round - 1]; return v ? { label: v === 25 ? 'Bull' : `D${v}`, value: v } : null; }
    case 'checkout121': { const v = CHECKOUT121_SEQ[g.round - 1]; return v ? { label: String(v), value: v, hint: CHECKOUTS[v] } : null; }
    case 'atc': { const pos = g.data.pos?.[cur.id] ?? 0; const v = ATC_SEQ[pos]; return v ? { label: v === 25 ? 'Bull' : String(v), value: v } : null; }
    case 'baseball': return { label: `Inning ${g.round}`, value: g.round };
    case 'halveit': { const t = HALVEIT_TARGETS[g.round - 1]; return t ? { label: t.label, value: g.round, hint: t.hint } : null; }
    default: return null;
  }
}

function clampHits(h: number) { return Math.max(0, Math.min(3, Math.round(h))); }

// ── Aufnahme anwenden → neues (unveränderliches) Spiel ──
export function applyTurn(g: TrainGame, input: TurnInput): TrainGame {
  if (g.over) return g;
  const n = g.players.length;
  const cur = g.players[g.turnIdx];
  const data: TrainData = JSON.parse(JSON.stringify(g.data));
  const log = [...g.log];
  let over = false; let winnerIds: string[] = [];

  const pushLog = (text: string) => log.push({ round: g.round, playerId: cur.id, text });

  switch (g.modeId) {
    case 'doubles': {
      if (input.kind !== 'hits') break;
      const hits = clampHits(input.hits);
      const v = DOUBLES_SEQ[g.round - 1];
      data.hits = (data.hits || 0) + hits;
      data.throws = (data.throws || 0) + 3;
      pushLog(`${v === 25 ? 'Bull' : 'D' + v} · ${hits}/3 Treffer`);
      break;
    }
    case 'bobs27': {
      if (input.kind !== 'hits') break;
      const hits = clampHits(input.hits);
      const v = BOBS27_SEQ[g.round - 1];
      const sc = data.score!;
      const delta = hits > 0 ? hits * 2 * v : -2 * v;
      sc[cur.id] = sc[cur.id] + delta;
      pushLog(`${v === 25 ? 'Bull' : 'D' + v} · ${hits > 0 ? hits + ' Treffer ' : 'verfehlt '}${delta >= 0 ? '+' : ''}${delta} → ${sc[cur.id]}`);
      if (sc[cur.id] <= 0) { over = true; winnerIds = [cur.id]; }
      break;
    }
    case 'checkout121': {
      if (input.kind !== 'made') break;
      const v = CHECKOUT121_SEQ[g.round - 1];
      data.attempts = (data.attempts || 0) + 1;
      if (input.made) { data.made = (data.made || 0) + 1; data.best = Math.max(data.best || 0, v); pushLog(`${v} · geschafft (${input.darts} Darts)`); }
      else pushLog(`${v} · verfehlt`);
      break;
    }
    case 'atc': {
      if (input.kind !== 'advance') break;
      const adv = clampHits(input.advance);
      const pos = data.pos!; const darts = data.darts!;
      pos[cur.id] = Math.min(ATC_SEQ.length, pos[cur.id] + adv);
      darts[cur.id] = (darts[cur.id] || 0) + 3;
      pushLog(`+${adv} Ziel${adv === 1 ? '' : 'e'} → ${pos[cur.id]}/${ATC_SEQ.length}`);
      if (pos[cur.id] >= ATC_SEQ.length) { over = true; winnerIds = [cur.id]; }
      break;
    }
    case 'baseball': {
      if (input.kind !== 'runs') break;
      const runs = Math.max(0, Math.min(9, Math.round(input.runs)));
      data.runs![cur.id] += runs;
      data.innings![cur.id].push(runs);
      pushLog(`Inning ${g.round} · ${runs} Run${runs === 1 ? '' : 's'}`);
      break;
    }
    case 'halveit': {
      if (input.kind !== 'halve') break;
      const sc = data.score!;
      if (input.scored > 0) { sc[cur.id] += input.scored; pushLog(`+${input.scored} → ${sc[cur.id]}`); }
      else { const before = sc[cur.id]; sc[cur.id] = Math.floor(before / 2); pushLog(`verfehlt · ${before} halbiert → ${sc[cur.id]}`); }
      data.rounds![cur.id].push({ val: sc[cur.id], hit: input.scored > 0 });
      break;
    }
    case 'cricket': {
      if (input.kind !== 'marks') break;
      const myMarks = data.marks![cur.id];
      const pts = data.points!;
      let added = 0; const parts: string[] = [];
      for (const num of CRICKET_TARGETS) {
        const m = input.marks[num] || 0; if (m <= 0) continue;
        added += m;
        let mk = myMarks[num];
        for (let i = 0; i < m; i++) {
          if (mk < 3) mk++; // schließen
          else {
            // bereits geschlossen → Punkte, falls mind. ein Gegner offen
            const open = g.players.some((p) => p.id !== cur.id && (data.marks![p.id][num] < 3));
            if (open) pts[cur.id] += num;
          }
        }
        myMarks[num] = mk;
        parts.push(`${num === 25 ? 'Bull' : num}×${m}`);
      }
      pushLog(`${parts.join(' ') || 'keine Treffer'}${added ? '' : ''}`);
      // Sieg-/Ende-Prüfung
      const allClosed = (pid: string) => CRICKET_TARGETS.every((num) => data.marks![pid][num] >= 3);
      if (n === 1) { if (allClosed(cur.id)) { over = true; winnerIds = [cur.id]; } }
      else if (allClosed(cur.id) && pts[cur.id] >= Math.max(...g.players.map((p) => pts[p.id]))) { over = true; winnerIds = [cur.id]; }
      break;
    }
    case 'elimination': {
      if (input.kind !== 'score') break;
      const sc = data.score!;
      const next = sc[cur.id] + input.score;
      if (next > ELIM_TARGET) { pushLog(`${input.score} · überworfen (${next}) → bleibt ${sc[cur.id]}`); }
      else {
        sc[cur.id] = next;
        let knocked = '';
        if (next === ELIM_TARGET) { over = true; winnerIds = [cur.id]; }
        else {
          for (const p of g.players) {
            if (p.id !== cur.id && sc[p.id] === next && next > 0) { sc[p.id] = 0; knocked += ` ${p.short}↩`; }
          }
        }
        pushLog(`+${input.score} → ${next}${knocked ? ' · wirft zurück:' + knocked : ''}`);
      }
      break;
    }
    case 'killer': {
      if (input.kind !== 'killer') break;
      const lives = data.lives!; const isK = data.isKiller!;
      const events: string[] = [];
      for (const target of input.darts) {
        if (target == null) continue;
        if (target === cur.id) { if (!isK[cur.id]) { isK[cur.id] = true; events.push('wird Killer'); } }
        else {
          const opp = g.players.find((p) => p.id === target);
          if (opp && isK[cur.id] && lives[opp.id] > 0) {
            lives[opp.id]--; events.push(`−1 Leben ${opp.short}`);
            if (lives[opp.id] <= 0) events.push(`${opp.short} ausgeschieden`);
          }
        }
      }
      pushLog(events.length ? events.join(' · ') : 'kein Treffer');
      const alive = g.players.filter((p) => lives[p.id] > 0);
      if (alive.length <= 1) { over = true; winnerIds = alive.map((p) => p.id); }
      break;
    }
    default: break;
  }

  // Solo-Sequenzspiele: Ende, wenn die Sequenz durch ist
  if (!over) {
    if (g.modeId === 'doubles' && g.round >= DOUBLES_SEQ.length) { over = true; winnerIds = [cur.id]; }
    if (g.modeId === 'bobs27' && g.round >= BOBS27_SEQ.length) { over = true; winnerIds = [cur.id]; }
    if (g.modeId === 'checkout121' && g.round >= CHECKOUT121_SEQ.length) { over = true; winnerIds = [cur.id]; }
    if (g.modeId === 'atc' && n === 1 && (data.pos![cur.id] >= ATC_SEQ.length)) { over = true; winnerIds = [cur.id]; }
    if ((g.modeId === 'baseball' || g.modeId === 'halveit')) {
      const lastTargetRound = g.modeId === 'baseball' ? BASEBALL_INNINGS : HALVEIT_TARGETS.length;
      // Ende, wenn die letzte Runde vom letzten Spieler gespielt wurde
      if (g.round >= lastTargetRound && g.turnIdx === n - 1) {
        over = true;
        const metric = g.modeId === 'baseball' ? data.runs! : data.score!;
        const best = Math.max(...g.players.map((p) => metric[p.id]));
        winnerIds = g.players.filter((p) => metric[p.id] === best).map((p) => p.id);
      }
    }
  }

  // Zugwechsel
  let turnIdx = g.turnIdx; let round = g.round;
  if (!over) {
    turnIdx = (g.turnIdx + 1) % n;
    if (turnIdx === 0) round = g.round + 1;
  }

  return { ...g, data, log, over, winnerIds, turnIdx, round };
}

// ── Anzeige-Standings ──
export interface StandRow {
  player: TrainPlayer; primary: string; secondary?: string; sub?: string;
  done: boolean; eliminated: boolean; rank?: number;
}
export function standings(g: TrainGame): StandRow[] {
  const d = g.data;
  const rows: StandRow[] = g.players.map((p) => {
    switch (g.modeId) {
      case 'doubles': {
        const q = d.throws ? Math.round(((d.hits || 0) / d.throws) * 100) : 0;
        return { player: p, primary: `${q}%`, secondary: `${d.hits || 0}/${d.throws || 0}`, sub: 'Doppelquote', done: g.over, eliminated: false };
      }
      case 'bobs27': { const s = d.score![p.id]; return { player: p, primary: String(s), sub: s <= 0 ? 'ausgeschieden' : 'Punkte', done: g.over, eliminated: s <= 0 }; }
      case 'checkout121': {
        const q = d.attempts ? Math.round(((d.made || 0) / d.attempts) * 100) : 0;
        return { player: p, primary: `${q}%`, secondary: `HF ${d.best || 0}`, sub: `${d.made || 0}/${d.attempts || 0} Finishes`, done: g.over, eliminated: false };
      }
      case 'atc': { const pos = d.pos![p.id]; return { player: p, primary: `${pos}/${ATC_SEQ.length}`, secondary: `${d.darts![p.id]} Darts`, sub: pos >= ATC_SEQ.length ? 'fertig' : `Ziel ${ATC_SEQ[Math.min(pos, ATC_SEQ.length - 1)] === 25 ? 'Bull' : ATC_SEQ[Math.min(pos, ATC_SEQ.length - 1)]}`, done: pos >= ATC_SEQ.length, eliminated: false }; }
      case 'baseball': return { player: p, primary: String(d.runs![p.id]), sub: 'Runs', done: g.over, eliminated: false };
      case 'halveit': return { player: p, primary: String(d.score![p.id]), sub: 'Punkte', done: g.over, eliminated: false };
      case 'cricket': {
        const closed = CRICKET_TARGETS.filter((num) => d.marks![p.id][num] >= 3).length;
        return { player: p, primary: String(d.points![p.id]), secondary: `${closed}/${CRICKET_TARGETS.length} zu`, sub: 'Punkte', done: g.over, eliminated: false };
      }
      case 'elimination': return { player: p, primary: String(d.score![p.id]), sub: `Ziel ${ELIM_TARGET}`, done: g.over, eliminated: false };
      case 'killer': {
        const lv = d.lives![p.id];
        return { player: p, primary: '♥'.repeat(lv) || '—', secondary: `Zahl ${d.num![p.id]}`, sub: lv <= 0 ? 'ausgeschieden' : (d.isKiller![p.id] ? 'Killer' : 'nicht scharf'), done: false, eliminated: lv <= 0 };
      }
      default: return { player: p, primary: '—', done: false, eliminated: false };
    }
  });
  return rows;
}

// Sortierte Rangliste für das Sieg-Overlay
export function leaderboard(g: TrainGame): StandRow[] {
  const rows = standings(g);
  const num = (r: StandRow) => parseFloat(r.primary) || 0;
  const higherIsBetter = !['atc'].includes(g.modeId); // ATC: weniger Darts / weiter = ranking unterschiedlich
  const sorted = [...rows];
  if (g.modeId === 'atc') {
    sorted.sort((a, b) => (parseInt(b.primary) - parseInt(a.primary)) || ((a.secondary && b.secondary) ? (parseInt(a.secondary) - parseInt(b.secondary)) : 0));
  } else if (g.modeId === 'killer') {
    sorted.sort((a, b) => (g.data.lives![b.player.id]) - (g.data.lives![a.player.id]));
  } else {
    sorted.sort((a, b) => higherIsBetter ? num(b) - num(a) : num(a) - num(b));
  }
  sorted.forEach((r, i) => { r.rank = i + 1; });
  return sorted;
}

export function trainModeName(modeId: string): string {
  return TRAIN_MODES.find((m) => m.id === modeId)?.name || modeId;
}
