// Reine View-Projektion für „Remote & Live" (Plan docs/plan-remote.md, Phase 2).
// Bewusst OHNE Wert-Import des Stores → in Node testbar. Baut die kompakte LiveViewState aus dem
// Spielzustand, ausschließlich über die counter.ts-Funktionen (Anzeige 1:1 identisch mit dem Board).
import { scores, currentIdx, progress, matchOver, winner, checkoutSuggestion, average, countAtLeast, finishStats } from '../store/counter';
import type { GamePlayer, Throw, Settings, Screen } from '../data/types';
import type { LiveViewState } from '../data/provider';

export interface ProjectableState {
  gamePlayers: GamePlayer[];
  allThrows: Throw[];
  startOffset: number;
  settings: Settings;
  screen: Screen;
  input: string;
  pendingStart: boolean;
  finishPrompt?: { playerId: string | number; score: number; minDarts: number } | null;
}

export function projectLiveState(st: ProjectableState): LiveViewState {
  const slice = { gamePlayers: st.gamePlayers, allThrows: st.allThrows, startOffset: st.startOffset, settings: st.settings };
  const hasGame = st.screen === 'counter' && st.gamePlayers.length > 0;
  if (!hasGame) {
    return {
      phase: 'idle',
      players: st.gamePlayers.map((p) => ({ name: p.name, short: p.short, score: st.settings.startScore, legs: 0, sets: 0 })),
      currentIdx: 0, input: '', checkout: [], winner: null,
    };
  }
  const sc = scores(slice);
  const prog = progress(slice);
  const curIdx = currentIdx(slice);
  const over = matchOver(slice);
  const players = st.gamePlayers.map((p) => {
    const fs = finishStats(slice, p.id);
    return {
      name: p.name, short: p.short,
      score: sc[p.id] ?? st.settings.startScore,
      legs: prog.legsSet[p.id] ?? 0,
      sets: prog.setsWon[p.id] ?? 0,
      // Live-Statistik für die TV-Ansicht (identisch zum Counter): 3-Dart-Schnitt, 180er, High Finish.
      avg3: Math.round(average(slice, p.id) * 10) / 10,
      c180: countAtLeast(slice, p.id, 180, true),
      hf: fs.hf,
    };
  });
  // Persistentes Highlight: das ZULETZT ausgemachte Leg (über die ganze Wurf-Historie), damit die TV-Ansicht
  // Shortleg/High Finish zuverlässig zeigt – auch wenn der 1,5-s-Poll den Moment des Checkouts verpasst.
  const lastCo = [...st.allThrows].reverse().find((t) => t.checkout);
  let highlight: LiveViewState['highlight'] = null;
  if (lastCo) {
    const legDarts = st.allThrows.filter((t) => t.playerId === lastCo.playerId && t.leg === lastCo.leg).reduce((a, t) => a + (t.darts || 3), 0);
    const highFinish = lastCo.raw >= 100;
    const shortLeg = legDarts <= 19;
    if (highFinish || shortLeg) {
      const nm = st.gamePlayers.find((p) => p.id === lastCo.playerId)?.name ?? '';
      highlight = { player: nm, darts: legDarts, score: lastCo.raw, highFinish, shortLeg };
    }
  }
  const curId = st.gamePlayers[curIdx]?.id;
  const curRem = curId != null ? (sc[curId] ?? st.settings.startScore) : st.settings.startScore;
  const co = !over ? checkoutSuggestion(st.settings, curRem) : null;
  const w = over ? winner(slice) : null;
  const phase: LiveViewState['phase'] = over ? 'won' : st.pendingStart ? 'whoBegins' : 'playing';
  return {
    phase,
    format: { startScore: st.settings.startScore, unit: st.settings.unit, bestOf: st.settings.bestOf, bestOfSets: st.settings.bestOfSets, doubleOut: st.settings.doubleOut },
    players,
    currentIdx: curIdx,
    input: st.input,
    checkout: co ? co.split(/\s+/).filter(Boolean) : [],
    lastThrow: null,
    winner: w?.name ?? null,
    finish: st.finishPrompt ? { minDarts: st.finishPrompt.minDarts } : null,
    highlight,
  };
}
