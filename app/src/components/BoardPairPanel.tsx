// Koppel-Panel für die Einstellungen (Plan docs/plan-remote.md) — ersetzt das frühere Floating-Badge.
// Zeigt QR + Kopplungscode dieses Boards, damit ein Handy koppeln kann (QR scannen ODER Code manuell
// unter #/remote eingeben). Rendert nur, wenn dieses Gerät gerade eine Live-Session hostet (Board/Kiosk).
import { useMemo } from 'react';
import { qrSvg } from '../lib/qrcode';
import { useLiveHostStore } from '../lib/liveHost';
import { useT } from '../i18n';

export function BoardPairPanel() {
  const tr = useT();
  const sessionId = useLiveHostStore((s) => s.sessionId);
  const code = useLiveHostStore((s) => s.code);

  const url = useMemo(() => {
    if (!sessionId) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/#/remote/${sessionId}?code=${code ?? ''}`;
  }, [sessionId, code]);
  // Als data-URI im img-Tag (kein HTML-Injection-Sink — gleiche sichere Praxis wie beim 2FA-QR).
  // Schreibweise ohne spitze Klammern mit Absicht: der Design-Detektor durchsucht auch Kommentare
  // und würde ein Tag im Prosatext als leeres Bild melden.
  const qrUri = useMemo(() => (url ? 'data:image/svg+xml;utf8,' + encodeURIComponent(qrSvg(url, { moduleSize: 4, margin: 2, dark: '#0b0d0f', light: '#ffffff' })) : ''), [url]);

  if (!sessionId || !code) return null;

  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap', background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-lg)', padding: 16, marginBottom: 20 }}>
      <img src={qrUri} alt={tr.pairPanel.qrAlt} style={{ width: 132, height: 132, background: '#fff', borderRadius: 'var(--radius-sm)', padding: 6, boxSizing: 'border-box', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontWeight: 800, fontSize: 'var(--fs-lead)' }}>{tr.pairPanel.title}</div>
        <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-3)', lineHeight: 1.5, marginTop: 2, marginBottom: 10 }}>
          {tr.pairPanel.hintScan} <b>{typeof window !== 'undefined' ? window.location.host : ''}/#/remote</b> {tr.pairPanel.hintOpen}
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-md)', padding: '8px 14px' }}>
          <span style={{ fontSize: 'var(--fs-badge)', color: 'var(--text-4)', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>{tr.pairPanel.codeLabel}</span>
          <span style={{ fontFamily: 'monospace', fontSize: 'var(--fs-heading)', fontWeight: 800, letterSpacing: '.2em', color: 'var(--text)' }}>{code}</span>
        </div>
      </div>
    </div>
  );
}
