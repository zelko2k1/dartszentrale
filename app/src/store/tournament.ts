// Round-Robin-X01-Turnier („jeder gegen jeden") — reiner, framework-freier Kern.
// Bewusst wie counter.ts/training.ts als pure Funktionen über einem serialisierbaren Zustand gehalten,
// damit alles Node-testbar ist und 1:1 über den Server (eine tournaments-Collection) synchronisiert werden kann.
// Die Datentypen (Tournament, TournamentMatch, …) liegen wie League/Match in data/types.ts.
// Jede Partie wird auf der Counter-Engine gespielt (Rückverweis { tournamentId, matchId }); die
// Highlights/Statistiken je Partie werden dort aus counter.ts abgeleitet und hier als Ergebnis verbucht.
import type {
  Tournament, TournamentConfig, TournamentParticipant, TournamentMatch, TournamentMatchResult,
} from '../data/types';

export const TOURNAMENT_START_OPTS = [301, 501, 701, 1001];
export const TOURNAMENT_MIN_PLAYERS = 3;
export const TOURNAMENT_MAX_PLAYERS = 8;

const BYE = '__BYE__';

/** Höchstzahl gleichzeitig spielbarer Partien = ⌊n/2⌋ (so viele Boards machen maximal Sinn). */
export function maxBoards(playerCount: number): number {
  return Math.max(1, Math.floor(playerCount / 2));
}

/**
 * Round-Robin-Paarungen nach der Kreismethode (jeder gegen jeden, ausgewogene Runden).
 * Bei ungerader Teilnehmerzahl wird ein Freilos ergänzt und dessen Paarungen verworfen
 * (der jeweilige Spieler pausiert diese Runde). Rückgabe: Array von Runden, je Runde
 * eine Liste von [homeId, awayId].
 */
export function roundRobinPairings(ids: string[]): [string, string][][] {
  const arr = ids.slice();
  if (arr.length % 2 === 1) arr.push(BYE);
  const m = arr.length;
  const fixed = arr[0];
  let rot = arr.slice(1);
  const rounds: [string, string][][] = [];
  for (let r = 0; r < m - 1; r++) {
    const line = [fixed, ...rot];
    const round: [string, string][] = [];
    for (let i = 0; i < m / 2; i++) {
      const a = line[i];
      const b = line[m - 1 - i];
      if (a !== BYE && b !== BYE) {
        // Heim/Auswärts pro Runde alternieren → über das Turnier ausgewogeneres „wer wirft an".
        if (i % 2 === 0) round.push([a, b]);
        else round.push([b, a]);
      }
    }
    // Rotation im Uhrzeigersinn, erster Platz bleibt fix.
    rot = [rot[rot.length - 1], ...rot.slice(0, rot.length - 1)];
    rounds.push(round);
  }
  return rounds;
}

/** Erzeugt die flache Partien-Liste (mit Rundennummer, stabile Ids m0,m1,…) aus den Teilnehmern. */
export function generateSchedule(participantIds: string[]): TournamentMatch[] {
  const rounds = roundRobinPairings(participantIds);
  const matches: TournamentMatch[] = [];
  let idx = 0;
  rounds.forEach((round, r) => {
    round.forEach(([homeId, awayId]) => {
      matches.push({ id: `m${idx}`, round: r + 1, homeId, awayId, status: 'pending' });
      idx++;
    });
  });
  return matches;
}

function clampBoardCount(boardCount: number, playerCount: number): number {
  const max = maxBoards(playerCount);
  if (!Number.isFinite(boardCount) || boardCount < 1) return 1;
  return Math.min(Math.round(boardCount), max);
}

export function newTournament(
  id: string,
  name: string,
  config: TournamentConfig,
  participants: TournamentParticipant[],
  boardCount: number,
  createdAt: string,
): Tournament {
  return {
    id,
    name,
    createdAt,
    config,
    boardCount: clampBoardCount(boardCount, participants.length),
    participants,
    matches: generateSchedule(participants.map((p) => p.id)),
    status: 'running',
  };
}

export function matchById(t: Tournament, matchId: string): TournamentMatch | undefined {
  return t.matches.find((m) => m.id === matchId);
}

export function participantById(t: Tournament, id: string): TournamentParticipant | undefined {
  return t.participants.find((p) => p.id === id);
}

function recomputeStatus(matches: TournamentMatch[]): Tournament["status"] {
  return matches.every((m) => m.status === 'done') ? 'done' : 'running';
}

/**
 * Wendet ein serialisierbares Ziel (status/board/result) auf eine Partie an — für die reconnect-sichere
 * Nachholung von Turnier-Schreibvorgängen (s. flushPendingSync im Store). Idempotent und robust:
 *  • Ein bereits erledigtes Ergebnis („done") wird NIE durch einen veralteten live/pending-Stand überschrieben.
 *  • „pending" räumt die Board-Zuweisung immer ab (auch wenn target.board nach JSON-Roundtrip fehlt).
 */
export function mergeMatchTarget(m: TournamentMatch, target: Partial<TournamentMatch>): TournamentMatch {
  if (m.status === 'done' && target.status !== 'done') return m;
  const merged = { ...m, ...target };
  if (target.status === 'pending') merged.board = undefined;
  return merged;
}

/** Setzt eine Partie auf „live" mit Board-Nummer (unveränderlich → neues Objekt). */
export function setMatchLive(t: Tournament, matchId: string, board: number): Tournament {
  const matches = t.matches.map((m) => (m.id === matchId ? { ...m, status: 'live' as const, board } : m));
  return { ...t, matches, status: recomputeStatus(matches) };
}

/** Verbucht das Ergebnis einer Partie (→ „done") und aktualisiert den Turnierstatus. */
export function setMatchResult(t: Tournament, matchId: string, result: TournamentMatchResult): Tournament {
  const matches = t.matches.map((m) => (m.id === matchId ? { ...m, status: 'done' as const, result } : m));
  return { ...t, matches, status: recomputeStatus(matches) };
}

export interface BoardAssignment { board: number; matchId: string; }

/**
 * Greedy-Board-Zuteilung: füllt freie Boards mit der jeweils nächsten spielbaren Partie
 * (in Spielplan-Reihenfolge), deren beide Spieler gerade nicht live spielen. Verhindert
 * damit automatisch Doppelbelegungen und ermöglicht echtes Parallel-Spiel auf mehreren
 * Boards. Rückgabe: welche Partie auf welchem Board jetzt starten soll (ohne Mutation).
 */
export function assignBoards(t: Tournament): BoardAssignment[] {
  const liveBoards = new Set<number>();
  const busy = new Set<string>();
  for (const m of t.matches) {
    if (m.status === 'live') {
      if (m.board != null) liveBoards.add(m.board);
      busy.add(m.homeId);
      busy.add(m.awayId);
    }
  }
  const freeBoards: number[] = [];
  for (let b = 1; b <= t.boardCount; b++) if (!liveBoards.has(b)) freeBoards.push(b);

  const out: BoardAssignment[] = [];
  const pending = t.matches
    .filter((m) => m.status === 'pending')
    .sort((a, b) => a.round - b.round); // stabil: innerhalb einer Runde bleibt die Erzeugungsreihenfolge
  for (const m of pending) {
    if (!freeBoards.length) break;
    if (busy.has(m.homeId) || busy.has(m.awayId)) continue;
    const board = freeBoards.shift() as number;
    out.push({ board, matchId: m.id });
    busy.add(m.homeId);
    busy.add(m.awayId);
  }
  return out;
}

/**
 * Nächste Partie für EIN Board (für das Board-Overlay). Bevorzugt die reguläre Greedy-Zuteilung
 * (nächste spielbare `pending`-Partie auf diesem Board). Findet sich keine, aber es hängt eine
 * `live`-Partie auf GENAU diesem Board fest (das Board ist gerade nicht am Spielen → das Spiel ging
 * z. B. durch einen WLAN-Abbruch beim Anstoßen verloren), wird diese zum erneuten Starten angeboten
 * (`stuck: true`). So heilt sich ein festgefahrenes Board nach Reconnect selbst. null = nichts zu tun.
 */
export function boardMatch(t: Tournament, boardNumber: number): { matchId: string; stuck: boolean } | null {
  const a = assignBoards(t).find((x) => x.board === boardNumber);
  if (a) return { matchId: a.matchId, stuck: false };
  const live = t.matches.find((m) => m.status === 'live' && m.board === boardNumber);
  if (live) return { matchId: live.id, stuck: true };
  return null;
}

export interface TournamentStandingRow {
  rank: number;
  id: string;
  name: string;
  played: number;
  wins: number;
  losses: number;
  legsFor: number;
  legsAgainst: number;
  legDiff: number;
  points: number; // 2 je Sieg (klassisch); Rangfolge richtet sich aber nach Siegen
}

/**
 * Abschluss-/Live-Tabelle: Siege zuerst („wer die meisten Siege hat"), dann Leg-Differenz,
 * dann gewonnene Legs, dann Name. Nur erledigte Partien zählen.
 */
export function standings(t: Tournament): TournamentStandingRow[] {
  const table: Record<string, TournamentStandingRow> = {};
  t.participants.forEach((p) => {
    table[p.id] = {
      rank: 0, id: p.id, name: p.name, played: 0, wins: 0, losses: 0,
      legsFor: 0, legsAgainst: 0, legDiff: 0, points: 0,
    };
  });
  for (const m of t.matches) {
    if (m.status !== 'done' || !m.result) continue;
    const h = table[m.homeId];
    const a = table[m.awayId];
    if (!h || !a) continue;
    const hl = m.result.homeLegs;
    const al = m.result.awayLegs;
    h.played++; a.played++;
    h.legsFor += hl; h.legsAgainst += al;
    a.legsFor += al; a.legsAgainst += hl;
    if (m.result.winnerId === m.homeId) { h.wins++; a.losses++; h.points += 2; }
    else { a.wins++; h.losses++; a.points += 2; }
  }
  const rows = Object.keys(table).map((k) => {
    const r = table[k];
    r.legDiff = r.legsFor - r.legsAgainst;
    return r;
  });
  rows.sort((x, y) =>
    (y.wins - x.wins) ||
    (y.legDiff - x.legDiff) ||
    (y.legsFor - x.legsFor) ||
    x.name.localeCompare(y.name));
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}

export type HighlightKind = '180' | 'shortLeg' | 'highFinish';
export interface TournamentHighlight {
  matchId: string;
  round: number;
  participantId: string;
  name: string;
  kind: HighlightKind;
  value: number; // 180 → Anzahl 180er dieser Partie; shortLeg → Dartzahl; highFinish → Ausmache
}

/** Sammelt die Highlights aller erledigten Partien (180er, Short Legs, High Finishes ≥100). */
export function highlights(t: Tournament): TournamentHighlight[] {
  const out: TournamentHighlight[] = [];
  for (const m of t.matches) {
    if (m.status !== 'done' || !m.result) continue;
    for (const p of t.participants) {
      const st = m.result.stats[p.id];
      if (!st) continue;
      if (st.c180 > 0) out.push({ matchId: m.id, round: m.round, participantId: p.id, name: p.name, kind: '180', value: st.c180 });
      for (const darts of st.shortLegDarts || []) {
        out.push({ matchId: m.id, round: m.round, participantId: p.id, name: p.name, kind: 'shortLeg', value: darts });
      }
      if (st.highFinish >= 100) out.push({ matchId: m.id, round: m.round, participantId: p.id, name: p.name, kind: 'highFinish', value: st.highFinish });
    }
  }
  return out;
}

export function isTournamentOver(t: Tournament): boolean {
  return t.status === 'done';
}

/** Fortschritt (erledigte / gesamte Partien) für Anzeige. */
export function tournamentProgress(t: Tournament): { done: number; total: number } {
  return { done: t.matches.filter((m) => m.status === 'done').length, total: t.matches.length };
}
