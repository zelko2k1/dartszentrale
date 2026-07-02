// pwaUpdate.ts
// Manueller PWA-Update-Fluss (registerType: 'prompt'): ein neuer Service-Worker wartet, bis der
// Nutzer bewusst „Aktualisieren" klickt. Prüfung nur beim Start + manuell (kein Hintergrund-Polling).
// Bewusst so gewählt, weil Board-Rechner während eines Ligatags durchgehend Spiele laufen lassen –
// ein automatischer Reload darf niemals mitten in eine Partie platzen.

import { registerSW } from 'virtual:pwa-register';

type Listener = (ready: boolean) => void;

let updateSW: ((reload?: boolean) => Promise<void>) | null = null;
let registration: ServiceWorkerRegistration | undefined;
let needRefresh = false;
const listeners = new Set<Listener>();

const notify = () => { for (const l of listeners) l(needRefresh); };

/** Einmalig beim App-Start aufrufen (nur im Production-Build sinnvoll). */
export function initPwaUpdate(onReady: (ready: boolean) => void): void {
  listeners.add(onReady);
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() { needRefresh = true; notify(); },
    onRegisteredSW(_swUrl, reg) { registration = reg; },
  });
}

/** Ob gerade eine neue Version bereitliegt. */
export function isUpdateReady(): boolean { return needRefresh; }

/** Neuen Worker übernehmen lassen und die Seite neu laden. Nur nach bewusstem Klick aufrufen. */
export async function applyPwaUpdate(): Promise<void> {
  if (updateSW) await updateSW(true);
  else window.location.reload();
}

/**
 * Manuell auf eine neue Version prüfen. Löst `onNeedRefresh` aus, falls eine gefunden wird.
 * Gibt `true` zurück, wenn nach der Prüfung eine Version bereitliegt.
 */
export async function checkForUpdate(): Promise<boolean> {
  try {
    if (registration) {
      await registration.update();
      // onNeedRefresh feuert asynchron nach der Installation → kurz warten, dann Stand melden.
      await new Promise((r) => setTimeout(r, 1500));
    }
  } catch { /* offline o. Ä. → einfach „kein Update" */ }
  return needRefresh;
}
