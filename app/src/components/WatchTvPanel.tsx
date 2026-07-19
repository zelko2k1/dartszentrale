// Admin-Panel für den login-freien Zuschauer-TV (Plan docs/plan-remote.md, Phase 4).
// Kill-Switch (Default AUS), geheimer Watch-Link + QR, Token rotieren. Nur für Admins gerendert;
// der Server (watch_hooks.pb.js) erzwingt die Admin-Rechte zusätzlich.
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { qrSvg } from '../lib/qrcode';

const ACCENT = 'var(--accent)';

export function WatchTvPanel() {
  const provider = useStore((s) => s.provider);
  const [enabled, setEnabled] = useState(false);
  const [token, setToken] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    provider.watchGetConfig()
      .then((c) => { if (alive) { setEnabled(c.enabled); setToken(c.token); setLoaded(true); } })
      .catch((e) => { if (alive) { setErr(e instanceof Error ? e.message : 'Fehler'); setLoaded(true); } });
    return () => { alive = false; };
  }, [provider]);

  const url = useMemo(() => {
    if (!token) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/#/watch/${token}`;
  }, [token]);
  // Als data-URI im <img> (kein HTML-Injection-Sink — gleiche sichere Praxis wie beim 2FA-QR).
  const qrUri = useMemo(() => (url ? 'data:image/svg+xml;utf8,' + encodeURIComponent(qrSvg(url, { moduleSize: 4, margin: 2, dark: '#0b0d0f', light: '#ffffff' })) : ''), [url]);

  async function toggle() {
    setBusy(true); setErr('');
    try { const c = await provider.watchSetEnabled(!enabled); setEnabled(c.enabled); setToken(c.token); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Fehler'); }
    finally { setBusy(false); }
  }
  async function rotate() {
    setBusy(true); setErr(''); setCopied(false);
    try { const c = await provider.watchRotate(); setEnabled(c.enabled); setToken(c.token); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Fehler'); }
    finally { setBusy(false); }
  }
  function copy() {
    if (!url) return;
    try { void navigator.clipboard?.writeText(url); setCopied(true); } catch { /* ignore */ }
  }

  const card: React.CSSProperties = { border: '1px solid var(--border-2)', borderRadius: 14, padding: 16, marginTop: 12, background: 'var(--surface-2, var(--surface))' };
  const btn: React.CSSProperties = { background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.6 : 1 };

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>Öffentlicher Zuschauer-TV</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5, marginTop: 2 }}>
            Login-freier Link für einen Zuschauer-Bildschirm (z. B. Nebenraum). Zeigt nur Boardname + Spielstand.
            Im Internet standardmäßig aus — bewusst einschalten. Der Link folgt automatisch dem laufenden Spiel.
          </div>
        </div>
        <button onClick={toggle} disabled={busy || !loaded} role="switch" aria-checked={enabled}
          style={{ flexShrink: 0, width: 46, height: 26, borderRadius: 999, background: enabled ? ACCENT : 'var(--surface-3)', border: '1px solid var(--border-2)', position: 'relative', cursor: busy ? 'default' : 'pointer', padding: 0 }}>
          <span style={{ position: 'absolute', top: 2, left: enabled ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff' }} />
        </button>
      </div>

      {err && <div style={{ color: '#E0594B', fontWeight: 700, fontSize: 12, marginTop: 10 }}>{err}</div>}

      {enabled && url && (
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
          <img src={qrUri} alt="QR-Code für den Zuschauer-Link" style={{ width: 120, height: 120, background: '#fff', borderRadius: 8, padding: 6, boxSizing: 'border-box', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>Zuschauer-Link</div>
            <div style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all', color: 'var(--text-2)', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 8, padding: '8px 10px' }}>{url}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button style={btn} onClick={copy}>{copied ? '✓ Kopiert' : 'Link kopieren'}</button>
              <button style={btn} onClick={rotate}>Neu generieren</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
