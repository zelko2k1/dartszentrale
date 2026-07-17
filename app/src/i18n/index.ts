// ═══════ i18n — schlanke eigene Lösung ohne Bibliothek ═══════
// de.ts ist die Quelle der Wahrheit; Dict = deren (geweitete) Form. en.ts MUSS Dict erfüllen —
// fehlt ein Schlüssel oder ist einer zu viel, schlägt der TypeScript-Build fehl. So kann keine
// Übersetzung vergessen werden. Sprache ist GERÄTELOKAL (eigener localStorage-Key, kein Server-Sync):
// jedes Gerät (PC/Tablet/Board) wählt selbst — wie Eingabe-Modus & Hell/Dunkel.
//
// Verwendung in Komponenten:   const tr = useT();  →  tr.dashboard.quickCreate
// Außerhalb von React (format.ts, Store): dict() — liefert das aktuelle Sprachpaket.
import { useSyncExternalStore } from 'react';
import { de } from './de';
import { en } from './en';

export type Dict = typeof de;
export type Lang = 'de' | 'en';

export const LANG_LABELS: Record<Lang, string> = { de: 'Deutsch', en: 'English' };

const LS_LANG = 'darts_lang'; // gerätelokal, bewusst NICHT in club_config
const DICTS: Record<Lang, Dict> = { de, en };

/** Browser-Sprache: Deutsch → 'de', jede andere → 'en'. Fällt bei fehlendem navigator auf 'de'. */
function detectBrowserLang(): Lang {
  try {
    const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
    return langs.some((l) => l?.toLowerCase().startsWith('de')) ? 'de' : 'en';
  } catch { return 'de'; }
}

function readInitial(): Lang {
  try {
    const saved = localStorage.getItem(LS_LANG);
    if (saved === 'de' || saved === 'en') return saved; // ausdrückliche Nutzerwahl hat Vorrang
  } catch { /* localStorage gesperrt → Browser-Sprache entscheidet */ }
  return detectBrowserLang(); // beim Erststart: Browser Deutsch → DE, sonst EN
}

let current: Lang = readInitial();
const listeners = new Set<() => void>();

export function getLang(): Lang { return current; }

export function setLang(l: Lang): void {
  if (l === current) return;
  current = l;
  try { localStorage.setItem(LS_LANG, l); } catch { /* ignore */ }
  listeners.forEach((fn) => fn());
}

/** Aktuelles Sprachpaket für Nicht-React-Code (kein Re-Render — Aufrufer lebt mit dem Momentwert). */
export function dict(): Dict { return DICTS[current]; }

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** React-Hook: aktuelles Sprachpaket, re-rendert die Komponente beim Sprachwechsel. */
export function useT(): Dict {
  const lang = useSyncExternalStore(subscribe, getLang);
  return DICTS[lang];
}

/** React-Hook: aktuelle Sprache (für den Umschalter in den Einstellungen). */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang);
}
