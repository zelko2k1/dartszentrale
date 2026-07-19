// Host-Seite von „Remote & Live" (Plan docs/plan-remote.md, Phase 2).
// Bewusst NICHT im großen useStore verdrahtet: der Host-UI-State (Session-ID + Kopplungscode für QR)
// liegt in einem isolierten Mini-Store, die Projektion/Abspiel-Logik in reinen Funktionen.
import { create } from 'zustand';
import { useStore } from '../store/useStore';
import type { LiveCommand } from '../data/provider';

// Reine Projektion liegt in liveProjection.ts (Node-testbar) — hier nur re-exportiert.
export { projectLiveState } from './liveProjection';

type MainState = ReturnType<typeof useStore.getState>;

// ── Host-UI-State (nur was Board/Counter für das QR-Badge brauchen) ──
export const useLiveHostStore = create<{ sessionId: string | null; code: string | null }>(() => ({
  sessionId: null,
  code: null,
}));

// Kurzer, gut ablesbarer Kopplungscode (ohne verwechselbare Zeichen 0/O/1/I).
export function genPairCode(len = 6): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const out: string[] = [];
  const buf = new Uint32Array(len);
  (globalThis.crypto || (globalThis as unknown as { msCrypto: Crypto }).msCrypto).getRandomValues(buf);
  for (let i = 0; i < len; i++) out.push(alphabet[buf[i] % alphabet.length]);
  return out.join('');
}

// ── Befehl abspielen: 1:1 auf bestehende Store-Aktionen (keine neue Spiellogik) ──
export function applyRemoteCommand(cmd: LiveCommand): void {
  const st = useStore.getState();
  const p = (cmd.payload ?? {}) as Record<string, unknown>;
  const num = (v: unknown, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
  switch (cmd.type) {
    case 'digit': st.pressDigit(String(p.d ?? '')); break;
    case 'enter': st.pressEnter(); break;
    case 'del': st.pressDel(); break;
    case 'clear': st.pressClear(); break;
    case 'quick': st.quick(num(p.v)); break;
    case 'apply': st.apply(num(p.score), p.darts != null ? num(p.darts, 3) : undefined); break;
    case 'checkout': st.apply(num(p.rem), num(p.darts, 3)); break;
    case 'restOpen': st.openRestEntry(); break;
    case 'restClose': st.closeRestEntry(); break;
    case 'restSubmit': st.submitRestEntry(String(p.rem ?? '')); break;
    case 'undo': st.undo(); break;
    case 'starter':
      if (p.mode === 'bull') st.openBullOff();
      else if (p.mode === 'draw') st.spinStarter();
      else st.chooseStarter(num(p.idx));
      break;
    case 'nav': if (typeof p.to === 'string') st.go(p.to as MainState['screen']); break;
    case 'newGame': st.newMatch(); break;
    case 'startPreset': st.startPreset((p.preset ?? {}) as Parameters<MainState['startPreset']>[0]); break;
    case 'confirmNew': st.confirmNew(); break;
    case 'cancelNew': st.cancelNew(); break;
    case 'endGame': st.endGameTo(p.to === 'setup' ? 'setup' : 'dashboard'); break;
    case 'rematch': st.rematch(); break;
    case 'abort': st.abortGame(); break;
    case 'confirmAbort': st.confirmAbort(); break;
    case 'cancelAbort': st.cancelAbort(); break;
    default: /* unbekannter Befehl → ignorieren */ break;
  }
}
