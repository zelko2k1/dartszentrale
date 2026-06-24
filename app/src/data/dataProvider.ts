// Factory: liefert je nach Modus den passenden DataProvider.
// Noch nicht im Store verdrahtet — wird in Phase 1 genutzt.
import type { DataProvider } from './provider';
import { LocalProvider } from './localProvider';
import { PocketBaseProvider } from './pocketbaseProvider';

export function createProvider(mode: 'local' | 'verein', pbUrl?: string): DataProvider {
  if (mode === 'verein') {
    // Laufzeit-URL aus den App-Einstellungen hat Vorrang (so kann jeder Verein/Rechner auf
    // seine eigene Instanz zeigen, ohne neu zu bauen); VITE_PB_URL dient nur als Build-Default.
    const url = (pbUrl && pbUrl.trim()) || import.meta.env.VITE_PB_URL;
    if (url) return new PocketBaseProvider(url);
    // Kein Backend konfiguriert (z. B. Dev ohne PocketBase) → lokal als Fallback.
  }
  return new LocalProvider();
}

export type { DataProvider } from './provider';
