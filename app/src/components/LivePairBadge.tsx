// QR + Kopplungscode am Board/Counter (Plan docs/plan-remote.md, Phase 2).
// Zeigt sich nur, wenn dieses Gerät gerade eine Live-Session hostet (useLiveHostStore gefüllt).
// Ein Handy scannt den QR (Deep-Link #/remote/<id>?code=<code>) und wird zur Fernbedienung.
import { useMemo, useState } from 'react';
import { qrSvg } from '../lib/qrcode';
import { useLiveHostStore } from '../lib/liveHost';

export function LivePairBadge({ corner = 'br' }: { corner?: 'br' | 'bl' | 'tr' | 'tl' }) {
  const sessionId = useLiveHostStore((s) => s.sessionId);
  const code = useLiveHostStore((s) => s.code);
  const [open, setOpen] = useState(false);

  const url = useMemo(() => {
    if (!sessionId) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/#/remote/${sessionId}?code=${code ?? ''}`;
  }, [sessionId, code]);
  // Als data-URI im <img> rendern (kein HTML-Injection-Sink — gleiche sichere Praxis wie beim 2FA-QR).
  const qrUri = useMemo(() => (url ? 'data:image/svg+xml;utf8,' + encodeURIComponent(qrSvg(url, { moduleSize: 4, margin: 2, dark: '#0b0d0f', light: '#ffffff' })) : ''), [url]);

  if (!sessionId || !code) return null;

  const pos: React.CSSProperties =
    corner === 'br' ? { bottom: 16, right: 16 } :
    corner === 'bl' ? { bottom: 16, left: 16 } :
    corner === 'tr' ? { top: 16, right: 16 } : { top: 16, left: 16 };

  return (
    <div style={{ position: 'fixed', zIndex: 40, ...pos }}>

      {open ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'var(--surface, #14181c)', border: '1px solid var(--border-2, #2a3138)', borderRadius: 14, padding: 14, boxShadow: '0 12px 30px rgba(0,0,0,.45)' }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-3, #9aa4ad)' }}>Handy koppeln</div>
          <img src={qrUri} alt="QR-Code zum Koppeln" style={{ width: 148, height: 148, background: '#fff', borderRadius: 8, padding: 6, boxSizing: 'border-box' }} />
          <div style={{ fontSize: 12, color: 'var(--text-3, #9aa4ad)' }}>oder Code eingeben:</div>
          <div style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 800, letterSpacing: '.18em', color: 'var(--text, #e9edf1)' }}>{code}</div>
          <button
            onClick={() => setOpen(false)}
            style={{ marginTop: 2, background: 'transparent', border: '1px solid var(--border-2, #2a3138)', color: 'var(--text-3, #9aa4ad)', borderRadius: 9, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Schließen
          </button>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          title="Handy als Fernbedienung koppeln"
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface, #14181c)', border: '1px solid var(--border-2, #2a3138)', color: 'var(--text-2, #c7ced4)', borderRadius: 11, padding: '9px 13px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 8px 22px rgba(0,0,0,.35)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></svg>
          Handy koppeln · <span style={{ fontFamily: 'monospace', letterSpacing: '.12em', color: 'var(--text, #e9edf1)' }}>{code}</span>
        </button>
      )}
    </div>
  );
}
