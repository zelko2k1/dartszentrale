// Koppel-Panel für die Einstellungen (Plan docs/plan-remote.md) — ersetzt das frühere Floating-Badge.
// Zeigt QR + Kopplungscode dieses Boards, damit ein Handy koppeln kann (QR scannen ODER Code manuell
// unter #/remote eingeben). Rendert nur, wenn dieses Gerät gerade eine Live-Session hostet (Board/Kiosk).
import { useMemo } from 'react';
import { qrSvg } from '../lib/qrcode';
import { useLiveHostStore } from '../lib/liveHost';

export function BoardPairPanel() {
  const sessionId = useLiveHostStore((s) => s.sessionId);
  const code = useLiveHostStore((s) => s.code);

  const url = useMemo(() => {
    if (!sessionId) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/#/remote/${sessionId}?code=${code ?? ''}`;
  }, [sessionId, code]);
  // Als data-URI im <img> (kein HTML-Injection-Sink — gleiche sichere Praxis wie beim 2FA-QR).
  const qrUri = useMemo(() => (url ? 'data:image/svg+xml;utf8,' + encodeURIComponent(qrSvg(url, { moduleSize: 4, margin: 2, dark: '#0b0d0f', light: '#ffffff' })) : ''), [url]);

  if (!sessionId || !code) return null;

  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap', background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 14, padding: 16, marginBottom: 20 }}>
      <img src={qrUri} alt="QR-Code zum Koppeln" style={{ width: 132, height: 132, background: '#fff', borderRadius: 8, padding: 6, boxSizing: 'border-box', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>Handy als Fernbedienung koppeln</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5, marginTop: 2, marginBottom: 10 }}>
          QR mit dem Handy scannen — oder am Handy <b>{typeof window !== 'undefined' ? window.location.host : ''}/#/remote</b> öffnen
          und den Code eingeben. Danach kann das Handy Eingabe und Navigation übernehmen.
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '8px 14px' }}>
          <span style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>Code</span>
          <span style={{ fontFamily: 'monospace', fontSize: 24, fontWeight: 800, letterSpacing: '.2em', color: 'var(--text)' }}>{code}</span>
        </div>
      </div>
    </div>
  );
}
