// Factory: liefert je nach Modus den passenden DataProvider.
// Noch nicht im Store verdrahtet — wird in Phase 1 genutzt.
import type { DataProvider } from './provider';
import { LocalProvider } from './localProvider';
import { PocketBaseProvider } from './pocketbaseProvider';

export function createProvider(mode: 'local' | 'verein', pbUrl?: string): DataProvider {
  if (mode === 'verein') {
    // Priorität: 1) Laufzeit-URL aus den App-Einstellungen (Board zeigt auf beliebige Instanz),
    // 2) VITE_PB_URL (Build-Default beim Modell „Frontend getrennt vom Backend", z. B. Cloud/Caddy),
    // 3) SAME-ORIGIN (`location.origin`) — für das Single-Binary-Modell, in dem PocketBase das
    //    Frontend selbst aus pb_public/ ausliefert; dann liegt die API auf derselben Origin und es
    //    muss KEINE URL eingebacken werden (kein Rebuild bei IP-Wechsel, kein CORS).
    const sameOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = (pbUrl && pbUrl.trim()) || import.meta.env.VITE_PB_URL || sameOrigin;
    if (url) return new PocketBaseProvider(url);
  }
  return new LocalProvider();
}

export type { DataProvider } from './provider';
