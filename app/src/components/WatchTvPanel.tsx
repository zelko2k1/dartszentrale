// Admin-Panel für den login-freien Zuschauer-TV (Plan docs/plan-remote.md, Phase 4).
// Kill-Switch (Default AUS), geheimer Watch-Link + QR, Token rotieren. Nur für Admins gerendert;
// der Server (watch_hooks.pb.js) erzwingt die Admin-Rechte zusätzlich.
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { qrSvg } from '../lib/qrcode';
import { useT, dict } from '../i18n';

const ACCENT = 'var(--accent)';

export function WatchTvPanel() {
  const provider = useStore((s) => s.provider);
  const [enabled, setEnabled] = useState(false);
  const [token, setToken] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);
  const tr = useT();

  useEffect(() => {
    let alive = true;
    provider.watchGetConfig()
      .then((c) => { if (alive) { setEnabled(c.enabled); setToken(c.token); setLoaded(true); } })
      .catch((e) => { if (alive) { setErr(e instanceof Error ? e.message : dict().watch.errLoad); setLoaded(true); } });
    return () => { alive = false; };
  }, [provider]);

  const url = useMemo(() => {
    if (!token) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/#/watch/${token}`;
  }, [token]);
  // Als data-URI im img-Tag (kein HTML-Injection-Sink — gleiche sichere Praxis wie beim 2FA-QR).
  // Schreibweise ohne spitze Klammern mit Absicht: der Design-Detektor durchsucht auch Kommentare
  // und würde ein Tag im Prosatext als leeres Bild melden.
  const qrUri = useMemo(() => (url ? 'data:image/svg+xml;utf8,' + encodeURIComponent(qrSvg(url, { moduleSize: 4, margin: 2, dark: '#0b0d0f', light: '#ffffff' })) : ''), [url]);

  async function toggle() {
    setBusy(true); setErr('');
    try { const c = await provider.watchSetEnabled(!enabled); setEnabled(c.enabled); setToken(c.token); }
    catch (e) { setErr(e instanceof Error ? e.message : tr.watch.errSave); }
    finally { setBusy(false); }
  }
  async function rotate() {
    setBusy(true); setErr(''); setCopied(false);
    try { const c = await provider.watchRotate(); setEnabled(c.enabled); setToken(c.token); }
    catch (e) { setErr(e instanceof Error ? e.message : tr.watch.errSave); }
    finally { setBusy(false); }
  }
  function copy() {
    if (!url) return;
    try { void navigator.clipboard?.writeText(url); setCopied(true); } catch { /* ignore */ }
  }

  const card: React.CSSProperties = { border: '1px solid var(--border-2)', borderRadius: 'var(--radius-lg)', padding: 16, marginTop: 12, background: 'var(--surface-2, var(--surface))' };
  const btn: React.CSSProperties = { background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', padding: '9px 14px', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-sub)', fontWeight: 700, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.6 : 1 };

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 'var(--fs-lead)' }}>{tr.watch.panelTitle}</div>
          <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-3)', lineHeight: 1.5, marginTop: 2 }}>
            {tr.watch.panelBody}
          </div>
        </div>
        <button onClick={toggle} disabled={busy || !loaded} role="switch" aria-checked={enabled} aria-label={tr.watch.enableLabel}
          style={{ flexShrink: 0, width: 46, height: 26, borderRadius: 'var(--radius-pill)', background: enabled ? ACCENT : 'var(--surface-3)', border: '1px solid var(--border-2)', position: 'relative', cursor: busy ? 'default' : 'pointer', opacity: busy || !loaded ? 0.5 : 1, padding: 0 }}>
          <span style={{ position: 'absolute', top: 2, left: enabled ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff' }} />
        </button>
      </div>

      {err && <div style={{ color: 'var(--danger)', fontWeight: 700, fontSize: 'var(--fs-meta)', marginTop: 10 }}>{err}</div>}

      {enabled && url && (
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
          <img src={qrUri} alt={tr.watch.qrAlt} style={{ width: 120, height: 120, background: '#fff', borderRadius: 'var(--radius-sm)', padding: 6, boxSizing: 'border-box', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-3)', marginBottom: 4 }}>{tr.watch.linkLabel}</div>
            <div style={{ fontFamily: 'monospace', fontSize: 'var(--fs-meta)', wordBreak: 'break-all', color: 'var(--text-2)', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)', padding: '8px 10px' }}>{url}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button style={btn} onClick={copy}>{copied ? tr.watch.copied : tr.watch.copyLink}</button>
              <button style={btn} onClick={rotate} aria-describedby="dz-watch-rotate-hint">{tr.watch.regenerate}</button>
            </div>
            {/* Die Folge steht sichtbar dabei, nicht im title: das Panel wird am Tablet bedient,
                wo es kein Hover gibt — und ein neuer Link macht jeden geteilten Link ungültig. */}
            <div id="dz-watch-rotate-hint" style={{ fontSize: 'var(--fs-badge)', color: 'var(--text-4)', lineHeight: 1.45, marginTop: 8 }}>{tr.watch.regenerateHint}</div>
          </div>
        </div>
      )}
    </div>
  );
}
