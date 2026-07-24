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
  // Letzte Aufnahme + transientes Feier-Ereignis aus GENAU dieser Aufnahme (nicht aus der ganzen Historie),
  // damit der TV eine 180 / ein High Finish / ein Short Leg kurz feiert und danach von selbst zur Normalanzeige
  // zurückkehrt. `id` = Wurf-Index + Art → stabil pro Ereignis (der TV erkennt „neu"). Priorität 180 > HF > SL.
  const lastIdx = st.allThrows.length - 1;
  const lastT = lastIdx >= 0 ? st.allThrows[lastIdx] : null;
  let lastThrow: LiveViewState['lastThrow'] = null;
  let event: LiveViewState['event'] = null;
  if (lastT) {
    const pIdx = st.gamePlayers.findIndex((p) => p.id === lastT.playerId);
    const pName = st.gamePlayers[pIdx]?.name ?? '';
    lastThrow = { player: pIdx, value: lastT.raw, bust: !!lastT.bust };
    if (!lastT.bust) {
      if (lastT.raw === 180) {
        event = { id: `${lastIdx}:180`, kind: '180', player: pName, value: 180 };
      } else if (lastT.checkout) {
        const legDarts = st.allThrows.filter((t) => t.playerId === lastT.playerId && t.leg === lastT.leg).reduce((a, t) => a + (t.darts || 3), 0);
        if (lastT.raw >= 100) event = { id: `${lastIdx}:hf`, kind: 'highFinish', player: pName, value: lastT.raw };
        else if (legDarts <= 19) event = { id: `${lastIdx}:sl`, kind: 'shortLeg', player: pName, value: legDarts };
      }
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
    lastThrow,
    winner: w?.name ?? null,
    finish: st.finishPrompt ? { minDarts: st.finishPrompt.minDarts } : null,
    event,
  };
}
