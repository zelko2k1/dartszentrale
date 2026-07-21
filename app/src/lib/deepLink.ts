// Deep-Link-Einstieg für Remote & Live (Plan docs/plan-remote.md §7).
// Die App hat KEINEN Router — Navigation ist ein State-Enum. Für QR-Aufrufe erkennen wir hier den
// Einstieg direkt aus location.hash, VOR dem normalen Shell-Rendering:
//   #/remote/<sessionId>?code=<code>   → Handy wird zur Fernbedienung (per QR gescannt)
//   #/remote                           → Handy wird zur Fernbedienung, Code manuell eingeben
//   #/watch/<sessionId>                → Gerät verfolgt read-only mit
export type LiveRoute = { mode: 'remote' | 'watch'; sessionId: string; code: string };

export function parseLiveRoute(hash?: string): LiveRoute | null {
  const h = hash ?? (typeof window !== 'undefined' ? window.location.hash : '');
  // Session-ID ist optional (für die manuelle Code-Eingabe unter #/remote).
  const m = /^#\/(remote|watch)(?:\/([a-z0-9]+))?(?:\?(.*))?$/i.exec(h || '');
  if (!m) return null;
  const mode = m[1].toLowerCase() as 'remote' | 'watch';
  let code = '';
  if (m[3]) { try { code = new URLSearchParams(m[3]).get('code') || ''; } catch { /* ignore */ } }
  return { mode, sessionId: m[2] || '', code };
}

/** Deep-Link aus der Adresszeile entfernen (nach dem Einstieg), ohne die Seite neu zu laden. */
export function clearLiveRoute(): void {
  if (typeof window === 'undefined') return;
  try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch { /* ignore */ }
}
