import { useEffect, useState, type ReactNode, type CSSProperties } from 'react';
import { useStore } from '../store/useStore';
import { perm } from '../store/selectors';
import { FONTS, DEVICE_LOCAL_SETTING_KEYS } from '../data/constants';
import type { Settings as SettingsType } from '../data/types';
import { IconUsers, IconChevronRight } from '../lib/icons';
import { comboFromEvent, isValidCombo, formatCombo } from '../lib/shortcut';
import { suggestBoardScale } from '../lib/displayScale';
import { qrSvg } from '../lib/qrcode';
import type { TwoFactorStatus, TwoFactorSetup } from '../data/provider';

const ACCENTS = ['#FFFFFF', '#000000', '#2BD377', '#19A463', '#3B9EFF', '#F2B829', '#E0594B', '#9b6dff', '#2bd3c0', '#FF8A3D'];
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];

// number field that accepts manual entry but snaps to 5% steps on commit
function PercentField({ value, min, max, onCommit }: { value: number; min: number; max: number; onCommit: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => { setText(String(value)); }, [value]);
  const commit = () => {
    const raw = parseInt(text, 10);
    if (isNaN(raw)) { setText(String(value)); return; }
    const snapped = Math.max(min, Math.min(max, Math.round(raw / 5) * 5));
    onCommit(snapped);
    setText(String(snapped));
  };
  return (
    <input
      type="text" inputMode="numeric" value={text}
      onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      title={`${min}–${max} % · in 5er-Schritten`}
      style={{ width: 44, textAlign: 'center', background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontFamily: 'var(--font-num)', fontSize: 17, fontWeight: 700, padding: 0, margin: 0 }}
    />
  );
}

// records a keyboard shortcut — only Strg + Alt + <letter/digit> is accepted
function ShortcutRecorder({ value, accent, fallback, onChange }: { value: string; accent: string; fallback: string; onChange: (combo: string) => void }) {
  const [recording, setRecording] = useState(false);
  const [warn, setWarn] = useState(false);
  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.key === 'Escape') { setRecording(false); setWarn(false); return; }
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return; // still holding modifiers
      const combo = comboFromEvent(e);
      if (!combo || !isValidCombo(combo)) { setWarn(true); return; } // must be Strg+Alt+Buchstabe/Ziffer
      onChange(combo); setRecording(false); setWarn(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [recording, onChange]);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      {warn && <span style={{ fontSize: 11, color: '#E0594B', fontWeight: 600 }}>Alt + Buchstabe/Ziffer (optional Strg)</span>}
      <button onClick={() => { setRecording((r) => !r); setWarn(false); }} style={{ minWidth: 140, fontFamily: 'var(--font-num)', fontSize: 13, fontWeight: 800, color: recording ? accent : 'var(--text-2)', background: 'var(--btn)', border: `1px solid ${recording ? accent : 'var(--border-2)'}`, borderRadius: 8, padding: '8px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
        {recording ? 'Alt + Taste …' : formatCombo(value)}
      </button>
      <button onClick={() => { onChange(fallback); setRecording(false); setWarn(false); }} title={`Auf ${formatCombo(fallback)} zurücksetzen`} className="dh-btn" style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text-3)', cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↺</button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '8px 22px', marginBottom: 18 }}>
      <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', padding: '16px 0 10px' }}>{title}</div>
      {children}
    </div>
  );
}
function Row({ label, sub, children, top }: { label: string; sub?: string; children: ReactNode; top?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: top ? 'flex-start' : 'center', justifyContent: 'space-between', gap: 20, padding: '14px 0', borderTop: '1px solid var(--hairline)', flexWrap: 'wrap' }}>
      <div style={{ maxWidth: 340 }}><div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>{sub && <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>{sub}</div>}</div>
      <div style={{ minWidth: 0, maxWidth: '100%' }}>{children}</div>
    </div>
  );
}

// „App & Updates": prüft/installiert Datei-basierte Updates über den serve-dist-Endpunkt
// (/admin/update/*). Läuft lokal/LAN/Cloud über http. Wird die App anders ausgeliefert (z. B.
// Arcane/nginx → Endpunkt fehlt), zeigt der Panel einen Hinweis statt eines Installers.
const UPDATE_TOKEN_KEY = 'darts_update_token';
function UpdatePanel() {
  const accent = useStore((st) => st.settings.accent);
  const [token, setToken] = useState(() => { try { return localStorage.getItem(UPDATE_TOKEN_KEY) || ''; } catch { return ''; } });
  const [phase, setPhase] = useState<'checking' | 'ok' | 'available' | 'needToken' | 'unavailable' | 'installing'>('checking');
  const [info, setInfo] = useState<{ current: string | null; available: string | null; dir: string | null }>({ current: null, available: null, dir: null });
  const [error, setError] = useState('');

  const authHeaders = (): Record<string, string> => (token ? { 'X-Update-Token': token } : {});
  const check = async () => {
    setPhase('checking'); setError('');
    try {
      const r = await fetch('/admin/update/status', { headers: authHeaders(), cache: 'no-store' });
      if (r.status === 403) { setPhase('needToken'); return; }
      const j = await r.json();
      setInfo({ current: j.current, available: j.available, dir: j.updatesDir });
      setPhase(j.hasUpdate ? 'available' : 'ok');
    } catch { setPhase('unavailable'); }
  };
  const install = async () => {
    setPhase('installing'); setError('');
    try {
      const r = await fetch('/admin/update/install', { method: 'POST', headers: authHeaders() });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) { window.location.reload(); return; }
      setError(j.error || `Fehler (${r.status})`); setPhase('available');
    } catch (e) { setError(String((e as Error).message || e)); setPhase('available'); }
  };
  const saveToken = () => { try { localStorage.setItem(UPDATE_TOKEN_KEY, token.trim()); } catch { /* ignore */ } void check(); };
  useEffect(() => { void check(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const btn = (primary?: boolean): CSSProperties => ({ background: primary ? accent : 'var(--btn)', color: primary ? 'var(--accent-fg)' : 'var(--text)', border: primary ? 'none' : '1px solid var(--border-2)', padding: '11px 18px', borderRadius: 11, fontSize: 14, fontWeight: primary ? 800 : 700, cursor: 'pointer', fontFamily: 'inherit' });
  const field: CSSProperties = { width: 220, maxWidth: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '10px 12px', color: 'var(--text)', fontFamily: 'var(--font-num)', fontSize: 14, outline: 'none' };

  return (
    <Section title="App & Updates">
      <Row label="Installierte Version" sub="Version dieser App auf dem Board.">
        <span style={{ fontFamily: 'var(--font-num)', fontSize: 14, fontWeight: 700, color: 'var(--text-2)' }}>{__APP_VERSION__}</span>
      </Row>
      {phase === 'unavailable' ? (
        <Row label="Updates" sub="Auf diesem Board keine automatische Installation möglich.">
          <span style={{ fontSize: 13, color: 'var(--text-4)', maxWidth: 320, textAlign: 'right' }}>Kein Update-Server erkannt — Updates laufen hier über einen Server-Redeploy bzw. das Update-Skript.</span>
        </Row>
      ) : phase === 'needToken' ? (
        <Row label="Update-Freigabe" sub="Dieses Gerät darf Updates nur mit Freigabe-Token auslösen (direkt am Board ist kein Token nötig).">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Update-Token" style={field} />
            <button className="dh-btn" onClick={saveToken} style={btn()}>Speichern &amp; prüfen</button>
          </div>
        </Row>
      ) : (
        <>
          <Row label="Updates" sub={info.dir ? `Update-Paket (.tar.gz) hier ablegen: ${info.dir}` : 'Prüft, ob ein Update bereitliegt.'}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {phase === 'available' && <span style={{ fontSize: 13, color: accent, fontWeight: 700 }}>Version {info.available} verfügbar</span>}
              {phase === 'ok' && <span style={{ fontSize: 13, color: 'var(--text-4)' }}>Aktuell</span>}
              {phase === 'available'
                ? <button className="dh-btn" onClick={install} style={btn(true)}>Installieren</button>
                : <button className="dh-btn" onClick={check} disabled={phase === 'checking' || phase === 'installing'} style={{ ...btn(), opacity: (phase === 'checking' || phase === 'installing') ? 0.6 : 1 }}>{phase === 'checking' ? 'Suche…' : phase === 'installing' ? 'Installiere…' : 'Nach Updates suchen'}</button>}
            </div>
          </Row>
          {phase === 'installing' && <div style={{ fontSize: 12, color: 'var(--text-4)', padding: '2px 2px 6px' }}>Installiere Update … die Seite lädt gleich neu.</div>}
          {error && <div style={{ fontSize: 12, color: '#E0594B', padding: '2px 2px 6px' }}>{error}</div>}
        </>
      )}
    </Section>
  );
}

// Self-Service: der angemeldete Nutzer setzt sein eigenes Passwort (über den privilegierten setPassword-Endpunkt).
function PasswordChange() {
  const change = useStore((st) => st.changeOwnPassword);
  const accent = useStore((st) => st.settings.accent);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const field: CSSProperties = { width: 210, maxWidth: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '10px 12px', color: 'var(--text)', fontFamily: 'inherit', fontSize: 14, outline: 'none' };
  const submit = async () => {
    setMsg(null);
    if (pw.length < 8) { setMsg({ ok: false, text: 'Mindestens 8 Zeichen.' }); return; }
    if (pw !== pw2) { setMsg({ ok: false, text: 'Passwörter stimmen nicht überein.' }); return; }
    setBusy(true);
    const ok = await change(pw);
    setBusy(false);
    if (ok) { setPw(''); setPw2(''); setMsg({ ok: true, text: '✓ Passwort geändert.' }); }
    else setMsg({ ok: false, text: 'Konnte nicht geändert werden.' });
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
      <input type="password" autoComplete="new-password" value={pw} onChange={(e) => { setPw(e.target.value); setMsg(null); }} placeholder="Neues Passwort" style={field} />
      <input type="password" autoComplete="new-password" value={pw2} onChange={(e) => { setPw2(e.target.value); setMsg(null); }} placeholder="Wiederholen" style={field} />
      <button onClick={submit} disabled={busy || !pw || !pw2} style={{ background: accent, color: 'var(--accent-fg)', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 800, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit', opacity: busy || !pw || !pw2 ? 0.6 : 1 }}>{busy ? 'Speichern …' : 'Passwort ändern'}</button>
      {msg && <span style={{ fontSize: 12, fontWeight: 600, color: msg.ok ? 'var(--success)' : '#E0594B' }}>{msg.text}</span>}
    </div>
  );
}

// Backup-Codes als Textdatei herunterladen (einmalige Anzeige → sicher speichern).
function downloadBackupCodes(codes: string[], account: string) {
  const body = [
    'DartsZentrale — 2FA Backup-Codes',
    `Konto: ${account}`,
    '',
    'Jeder Code ist EINMALIG beim Login statt des Authenticator-Codes nutzbar.',
    'Sicher aufbewahren, nicht weitergeben.',
    '',
    ...codes.map((c, i) => `${String(i + 1).padStart(2, '0')}.  ${c}`),
  ].join('\n');
  const url = URL.createObjectURL(new Blob([body], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = 'dartszentrale-backup-codes.txt';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Self-Service 2-Faktor-Authentifizierung (TOTP). Nutzt die serverseitigen Endpunkte über den Provider.
function TwoFactorSettings() {
  const provider = useStore((st) => st.provider);
  const accent = useStore((st) => st.settings.accent);
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [phase, setPhase] = useState<'idle' | 'setup' | 'backup' | 'disable' | 'regen'>('idle');
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [code, setCode] = useState('');       // Enrollment-Bestätigung
  const [reauth, setReauth] = useState('');   // Code ODER Passwort für disable/regenerate
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  const loadStatus = () => { void provider.twoFactorStatus().then(setStatus).catch(() => setStatus({ enabled: false, pending: false })); };
  useEffect(loadStatus, [provider]);

  const errText = (e: unknown) => (e as { response?: { message?: string } })?.response?.message || 'Aktion fehlgeschlagen. Bitte erneut versuchen.';
  const reauthArg = () => (/^\d{6}$|^\d{8}$/.test(reauth.trim()) ? { code: reauth.trim() } : { password: reauth });
  const reset = () => { setPhase('idle'); setSetup(null); setCode(''); setReauth(''); setBackupCodes(null); setErr(''); setBusy(false); };

  const field: CSSProperties = { width: 210, maxWidth: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '10px 12px', color: 'var(--text)', fontFamily: 'var(--font-num, monospace)', fontSize: 15, letterSpacing: '.12em', outline: 'none' };
  const btn = (primary?: boolean): CSSProperties => ({ background: primary ? accent : 'var(--btn)', color: primary ? 'var(--accent-fg)' : 'var(--text)', border: primary ? 'none' : '1px solid var(--border-2)', padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: primary ? 800 : 700, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.6 : 1 });

  const beginSetup = async () => {
    setBusy(true); setErr('');
    try { const s = await provider.twoFactorSetup(); setSetup(s); setPhase('setup'); }
    catch (e) { setErr(errText(e)); }
    finally { setBusy(false); }
  };
  const confirmSetup = async () => {
    setBusy(true); setErr('');
    try { const r = await provider.twoFactorEnable(code.trim()); setBackupCodes(r.backupCodes); setPhase('backup'); setCode(''); loadStatus(); }
    catch (e) { setErr(errText(e)); }
    finally { setBusy(false); }
  };
  const doDisable = async () => {
    setBusy(true); setErr('');
    try { await provider.twoFactorDisable(reauthArg()); reset(); loadStatus(); }
    catch (e) { setErr(errText(e)); setBusy(false); }
  };
  const doRegen = async () => {
    setBusy(true); setErr('');
    try { const r = await provider.twoFactorRegenerateBackup(reauthArg()); setBackupCodes(r.backupCodes); setReauth(''); setPhase('backup'); loadStatus(); }
    catch (e) { setErr(errText(e)); }
    finally { setBusy(false); }
  };

  const errBox = err ? <div style={{ fontSize: 12, color: '#E0594B', fontWeight: 600, marginTop: 8 }}>{err}</div> : null;

  // Backup-Codes-Ansicht (nach Aktivierung oder Neu-Erzeugung) — nur EINMALIG sichtbar.
  if (phase === 'backup' && backupCodes) {
    const acct = setup?.account || '';
    return (
      <div style={{ maxWidth: 420 }}>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 10 }}><b>Backup-Codes</b> — jeder Code ist einmal beim Login statt des App-Codes nutzbar. Jetzt sicher speichern; sie werden <b>nicht erneut angezeigt</b>.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 12, padding: 14 }}>
          {backupCodes.map((c) => <span key={c} style={{ fontFamily: 'var(--font-num, monospace)', fontSize: 15, letterSpacing: '.1em', textAlign: 'center' }}>{c}</span>)}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button style={btn()} onClick={() => { void navigator.clipboard?.writeText(backupCodes.join('\n')).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}>{copied ? '✓ Kopiert' : 'Kopieren'}</button>
          <button style={btn()} onClick={() => downloadBackupCodes(backupCodes, acct)}>Herunterladen</button>
          <button style={btn(true)} onClick={reset}>Fertig</button>
        </div>
      </div>
    );
  }

  // Einrichtungs-Assistent (QR + Secret + Bestätigungscode).
  if (phase === 'setup' && setup) {
    const svg = qrSvg(setup.otpauthUri, { moduleSize: 4, margin: 2 });
    const dataUri = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    return (
      <div style={{ maxWidth: 420 }}>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>1. Scanne den QR-Code mit einer Authenticator-App (Google Authenticator, Microsoft, 2FAS, Authy …).</div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <img src={dataUri} alt="QR-Code für die Authenticator-App" width={168} height={168} style={{ background: '#fff', borderRadius: 10, padding: 8 }} />
          <div style={{ minWidth: 160 }}>
            <div style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 700, marginBottom: 4 }}>Oder manuell eingeben:</div>
            <div style={{ fontFamily: 'var(--font-num, monospace)', fontSize: 13, wordBreak: 'break-all', color: 'var(--text-2)', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 8, padding: '8px 10px' }}>{setup.secret}</div>
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', margin: '16px 0 8px' }}>2. Gib den aktuellen 6-stelligen Code zur Bestätigung ein:</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="text" inputMode="numeric" autoComplete="one-time-code" value={code} placeholder="123456" onChange={(e) => { setCode(e.target.value.replace(/\s/g, '')); setErr(''); }} onKeyDown={(e) => { if (e.key === 'Enter' && code.trim()) void confirmSetup(); }} style={field} />
          <button style={btn(true)} disabled={busy || code.trim().length < 6} onClick={() => void confirmSetup()}>{busy ? 'Prüfe …' : 'Aktivieren'}</button>
          <button style={btn()} disabled={busy} onClick={reset}>Abbrechen</button>
        </div>
        {errBox}
      </div>
    );
  }

  // Re-Auth-Eingabe für Deaktivieren / Neu-Erzeugen.
  if (phase === 'disable' || phase === 'regen') {
    const isDisable = phase === 'disable';
    return (
      <div style={{ maxWidth: 420, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
        <div style={{ fontSize: 13, color: 'var(--text-2)', alignSelf: 'stretch' }}>{isDisable ? '2FA deaktivieren' : 'Neue Backup-Codes'} — bitte mit einem aktuellen Code (oder Backup-Code) oder deinem Passwort bestätigen.</div>
        <input type="password" autoComplete="off" value={reauth} placeholder="Code oder Passwort" onChange={(e) => { setReauth(e.target.value); setErr(''); }} onKeyDown={(e) => { if (e.key === 'Enter' && reauth) void (isDisable ? doDisable() : doRegen()); }} style={{ ...field, fontFamily: 'inherit', letterSpacing: 0, width: 240 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={btn()} disabled={busy} onClick={reset}>Abbrechen</button>
          <button style={btn(true)} disabled={busy || !reauth} onClick={() => void (isDisable ? doDisable() : doRegen())}>{busy ? 'Bitte warten …' : (isDisable ? 'Deaktivieren' : 'Neu erzeugen')}</button>
        </div>
        {errBox}
      </div>
    );
  }

  // Ruhezustand: Status + Aktionen.
  if (!status) return <span style={{ fontSize: 13, color: 'var(--text-4)' }}>Lädt …</span>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: status.enabled ? 'var(--success)' : 'var(--text-4)' }}>{status.enabled ? '● Aktiv' : '○ Nicht aktiv'}</span>
      {status.enabled ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button style={btn()} onClick={() => { setErr(''); setPhase('regen'); }}>Backup-Codes neu</button>
          <button style={btn()} onClick={() => { setErr(''); setPhase('disable'); }}>Deaktivieren</button>
        </div>
      ) : (
        <button style={btn(true)} disabled={busy} onClick={() => void beginSetup()}>{busy ? 'Bitte warten …' : '2FA einrichten'}</button>
      )}
      {errBox}
    </div>
  );
}

// „Geräte hinzufügen": zeigt die Server-Adresse als QR-Code (Tablets/Handys scannen) — nutzt den
// vendored QR-Encoder aus der 2FA-Arbeit. Board-PCs legen die Adresse als Lesezeichen/Kiosk an.
function JoinDevicesPanel() {
  const [url, setUrl] = useState(() => {
    try { return localStorage.getItem('darts_join_url') || window.location.origin; } catch { return window.location.origin; }
  });
  const [copied, setCopied] = useState(false);
  const setAndSave = (v: string) => { setUrl(v); try { localStorage.setItem('darts_join_url', v); } catch { /* ignore */ } };
  const isLocalOnly = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(url.trim());
  const valid = /^https?:\/\/.+/i.test(url.trim());
  const dataUri = valid ? 'data:image/svg+xml;utf8,' + encodeURIComponent(qrSvg(url.trim(), { moduleSize: 5, margin: 2 })) : '';
  const field: CSSProperties = { width: 280, maxWidth: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '10px 12px', color: 'var(--text)', fontFamily: 'var(--font-num, monospace)', fontSize: 13, outline: 'none' };
  const btn: CSSProperties = { background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };
  return (
    <Section title="Geräte hinzufügen">
      <Row label="Beitritts-Adresse" sub="So kommen weitere Geräte auf denselben Server: Tablet/Handy scannt den QR-Code, ein Board-PC legt die Adresse als Lesezeichen (Kiosk) an. Danach am Gerät mit dem jeweiligen Board-Konto anmelden." top>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
          {valid && <img src={dataUri} width={184} height={184} alt="QR-Code zum Beitreten" style={{ background: '#fff', borderRadius: 10, padding: 8 }} />}
          <input value={url} onChange={(e) => setAndSave(e.target.value)} placeholder="http://192.168.0.10:8090" style={field} />
          <button style={btn} onClick={() => { void navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}>{copied ? '✓ Kopiert' : 'Adresse kopieren'}</button>
          {isLocalOnly && (
            <div style={{ fontSize: 12, color: '#E0594B', fontWeight: 600, maxWidth: 320, textAlign: 'right' }}>
              Das ist die lokale Adresse dieses Rechners — andere Geräte erreichen sie nicht. Trage hier die Netzwerk-Adresse des Servers ein (z. B. http://192.168.0.10:8090); sie wird beim Serverstart angezeigt.
            </div>
          )}
        </div>
      </Row>
    </Section>
  );
}

export function Settings({ kiosk = false }: { kiosk?: boolean } = {}) {
  const s = useStore();
  const cfg = s.settings;
  const set = s.setSetting;
  const p = perm(cfg, s.accounts, s.session);
  const accent = cfg.accent;
  const isVerein = cfg.appMode === 'verein';
  // Im Vereinsmodus legt der Admin die Einstellungen zentral fest; alle anderen sehen sie nur (read-only).
  const canEdit = !isVerein || p.admin;
  const [logoErr, setLogoErr] = useState('');
  const [dataMsg, setDataMsg] = useState('');
  const [pbUrlDraft, setPbUrlDraft] = useState(cfg.pbUrl || '');
  const [pbMsg, setPbMsg] = useState('');
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [carrySource, setCarrySource] = useState('');
  const [carryTeams, setCarryTeams] = useState(true);
  const [carryLeagues, setCarryLeagues] = useState(true);
  const [offloadConfirm, setOffloadConfirm] = useState<string | null>(null);
  const [seasonMsg, setSeasonMsg] = useState('');
  const [activeKey, setActiveKey] = useState<string>('eingabe');

  const savePbUrl = () => {
    const v = pbUrlDraft.trim().replace(/\/+$/, ''); // trailing slash entfernen
    if (v && !/^https?:\/\//i.test(v)) { setPbMsg('Adresse muss mit http:// oder https:// beginnen.'); return; }
    s.setPbUrl(v);
    setPbMsg(v ? 'Gespeichert – verbinde neu …' : 'Server entfernt – wechsle in den lokalen Modus …');
    setTimeout(() => window.location.reload(), 600); // init() baut den Provider mit der neuen URL neu auf
  };

  const doExport = () => {
    try {
      const blob = new Blob([s.exportData()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      setDataMsg('Backup heruntergeladen.');
    } catch { setDataMsg('Export fehlgeschlagen.'); }
  };
  const onImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setDataMsg('');
    if (!file) return;
    if (!window.confirm('Bestehende Daten werden durch das Backup ersetzt. Fortfahren?')) return;
    const reader = new FileReader();
    reader.onerror = () => setDataMsg('Datei konnte nicht gelesen werden.');
    reader.onload = () => {
      if (s.importData(String(reader.result))) {
        setDataMsg('Import erfolgreich – wird neu geladen…');
        setTimeout(() => window.location.reload(), 600);
      } else setDataMsg('Ungültige Backup-Datei.');
    };
    reader.readAsText(file);
  };

  // validate, then read + (for raster) downscale an uploaded logo to a small data-URL
  const onLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setLogoErr('');
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) { setLogoErr('Nur PNG, JPG, SVG oder WebP erlaubt.'); return; }
    if (file.size > 2 * 1024 * 1024) { setLogoErr('Datei zu groß (max. 2 MB).'); return; }
    const reader = new FileReader();
    reader.onerror = () => setLogoErr('Datei konnte nicht gelesen werden.');
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (file.type === 'image/svg+xml') { // SVG bleibt vektoriell, nicht rastern
        try { set('clubLogo', dataUrl); } catch { setLogoErr('Konnte nicht gespeichert werden.'); }
        return;
      }
      const img = new Image();
      img.onerror = () => setLogoErr('Bild konnte nicht verarbeitet werden.');
      img.onload = () => {
        const max = 256;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
        try { set('clubLogo', canvas.toDataURL('image/png')); } catch { setLogoErr('Konnte nicht gespeichert werden.'); }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const seg = <K extends keyof SettingsType>(key: K, opts: { label: string; val: SettingsType[K]; fam?: string }[], pad = '10px 16px') => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      {opts.map((o) => {
        const on = cfg[key] === o.val;
        return (
          <button key={String(o.val)} onClick={() => set(key, o.val)} style={{ background: on ? accent : 'var(--btn)', color: on ? 'var(--accent-fg)' : 'var(--text-2)', border: `1px solid ${on ? accent : 'var(--border-2)'}`, fontWeight: on ? 800 : 600, padding: pad, borderRadius: 10, fontSize: o.fam ? 14 : 13, cursor: 'pointer', fontFamily: o.fam || 'inherit', whiteSpace: 'nowrap' }}>{o.label}</button>
        );
      })}
    </div>
  );

  const stepper = <K extends keyof SettingsType>(key: K, min: number, max: number) => {
    const val = cfg[key] as number;
    const clamp = (n: number) => Math.max(min, Math.min(max, n));
    const btn: React.CSSProperties = { width: 40, height: 40, borderRadius: 10, background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', fontSize: 22, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' };
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button className="dh-btn" onClick={() => set(key, clamp(val - 5) as SettingsType[K])} style={btn}>−</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 9, padding: '0 9px', height: 40 }}>
          <PercentField value={val} min={min} max={max} onCommit={(n) => set(key, n as SettingsType[K])} />
          <span style={{ fontFamily: 'var(--font-num)', fontSize: 13, color: 'var(--text-4)', fontWeight: 700 }}>%</span>
        </div>
        <button className="dh-btn" onClick={() => set(key, clamp(val + 5) as SettingsType[K])} style={btn}>+</button>
      </div>
    );
  };

  const colorPicker = (key: 'accent' | 'legColor' | 'scoreColor', allowAuto: boolean) => {
    const cur = (key === 'accent' ? accent : cfg[key]) as string | null;
    const ring = (active: boolean, c: string): React.CSSProperties => ({ width: 34, height: 34, borderRadius: '50%', background: c, border: `2px solid ${active ? 'var(--text)' : 'var(--border-2)'}`, boxShadow: `0 0 0 2px var(--surface), 0 0 0 3px ${active ? c : 'transparent'}`, cursor: 'pointer', flexShrink: 0 });
    return (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', justifyContent: 'flex-end', overflowX: 'auto', maxWidth: '100%', paddingBottom: 2 }}>
        {allowAuto && (
          <button onClick={() => set(key, null as SettingsType[typeof key])} title="Standard (Akzentfarbe)" style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--btn)', border: `2px solid ${cur == null ? 'var(--text-3)' : 'var(--border-2)'}`, color: 'var(--text-3)', fontSize: 9, fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}>STD</button>
        )}
        {ACCENTS.map((c) => {
          const on = (cur || '').toLowerCase() === c.toLowerCase();
          return <button key={c} onClick={() => set(key, c as SettingsType[typeof key])} style={ring(on, c)} />;
        })}
        <label title="Eigene Farbe wählen" style={{ position: 'relative', width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', cursor: 'pointer', boxShadow: '0 0 0 2px var(--surface), 0 0 0 3px var(--border-2)', background: 'conic-gradient(from 90deg, #ff2d55, #ffcc00, #34c759, #00c7be, #007aff, #af52de, #ff2d55)', flexShrink: 0 }}>
          <input type="color" value={cur || accent} onChange={(e) => set(key, e.target.value as SettingsType[typeof key])} style={{ position: 'absolute', top: -8, left: -8, width: 50, height: 50, border: 'none', padding: 0, margin: 0, background: 'none', cursor: 'pointer', opacity: 0 }} />
        </label>
      </div>
    );
  };

  const toggles: { key: 'showCheckout' | 'showQuick' | 'showHistory' | 'showStats'; label: string; sub: string }[] = [
    { key: 'showCheckout', label: 'Checkout-Vorschlag', sub: 'Zeigt mögliche Finish-Wege unter dem Restscore' },
    { key: 'showQuick', label: 'Quick-Scores', sub: 'Quick-Score-Buttons (Tablet) bzw. die F1–F8-Leiste (Desktop)' },
    { key: 'showHistory', label: 'Wurf-Verlauf', sub: 'Liste der bisherigen Aufnahmen' },
    { key: 'showStats', label: 'Statistik-Box', sub: 'Ø 3-Dart, First 9, Letzter, 180·140+, CO % und High Finish (HF)' },
  ];

  // Read-only-Dimmen für zentrale (vereinsweite) Einstellungen, wenn der Benutzer nicht bearbeiten darf.
  const dim = (node: ReactNode) => canEdit ? node : <div style={{ pointerEvents: 'none', opacity: 0.55, userSelect: 'none' }}>{node}</div>;
  // Pro-Zeile-Variante: gerätelokale Keys (Eingabe-Modus, Hell/Dunkel, Größen) bleiben IMMER bedienbar –
  // jedes Gerät (PC/Tablet/Board) stellt sie selbst ein; nur die vereinsweiten Zeilen werden read-only gedimmt.
  const ed = (key: keyof SettingsType, node: ReactNode) =>
    (canEdit || DEVICE_LOCAL_SETTING_KEYS.includes(key)) ? node : dim(node);

  const modusNode = (
    <Section title="App-Modus">
      <Row label="Nutzungsart" sub="Lokal: Dashboard, Counter, Training, Spieler, Statistiken. Verein: zusätzlich Ligen, Mannschaften & Turniere.">
        {seg('appMode', [{ label: 'Lokal', val: 'local' }, { label: 'Verein', val: 'verein' }], '10px 18px')}
      </Row>
    </Section>
  );

  const vereinNode = (
    <Section title="Verein">
      <Row label="Vereins-Server (PocketBase)" sub="Adresse deiner PocketBase-Instanz, z. B. https://db.deinverein.de. Wird nur auf diesem Gerät gespeichert – nach dem Speichern verbindet sich die App neu." top>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <input className="dh-input" type="url" inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false} value={pbUrlDraft} onChange={(e) => { setPbUrlDraft(e.target.value); setPbMsg(''); }} placeholder="https://db.deinverein.de" style={{ width: 260, maxWidth: '100%', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '10px 12px', color: 'var(--text)', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, outline: 'none' }} />
            <button onClick={savePbUrl} style={{ background: accent, color: 'var(--accent-fg)', border: `1px solid ${accent}`, padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>Speichern &amp; verbinden</button>
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: s.pbMode ? accent : 'var(--text-4)' }}>
            {s.pbMode ? `✓ Verbunden mit ${cfg.pbUrl || 'Server'}` : (cfg.pbUrl ? '⚠ Nicht verbunden – Adresse prüfen' : 'Kein Server – läuft im lokalen Modus')}
          </span>
          {pbMsg && <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>{pbMsg}</span>}
        </div>
      </Row>
      <Row label="Vereinsname" sub="Wird in der Hauptansicht neben dem Logo angezeigt.">
        <input className="dh-input" type="text" value={cfg.clubName} onChange={(e) => set('clubName', e.target.value)} placeholder="z. B. Dartverein Musterstadt" style={{ width: 260, maxWidth: '100%', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '10px 12px', color: 'var(--text)', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, outline: 'none' }} />
      </Row>
      <Row label="Vereinslogo" sub="Erscheint in der Hauptansicht oben links. PNG, JPG, SVG oder WebP · max. 2 MB · wird automatisch verkleinert.">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <div style={{ width: 44, height: 44, borderRadius: 11, background: 'var(--btn)', border: '1px solid var(--border-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, color: 'var(--text-4)' }}>
              {cfg.clubLogo ? <img src={cfg.clubLogo} alt="Vereinslogo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <IconUsers size={20} />}
            </div>
            <label className="dh-btn" style={{ background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              {cfg.clubLogo ? 'Logo ändern' : 'Logo wählen'}
              <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={onLogoFile} style={{ display: 'none' }} />
            </label>
            {cfg.clubLogo && <button onClick={() => { set('clubLogo', null); setLogoErr(''); }} style={{ background: 'transparent', border: '1px solid var(--border-2)', color: 'var(--text-3)', padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Entfernen</button>}
          </div>
          {logoErr && <span style={{ fontSize: 12, color: '#E0594B', fontWeight: 600 }}>{logoErr}</span>}
        </div>
      </Row>
      <Row label="Logo-Größe auf der Startseite" sub="Größe des Logos auf der Anmeldeseite (in Pixel). Das kleine Logo in der App-Kopfzeile bleibt unverändert." top>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
          <div style={{ width: 88, height: 88, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {cfg.clubLogo
              ? <img src={cfg.clubLogo} alt="Vorschau" style={{ width: Math.min(88, cfg.loginLogoSize ?? 88), height: Math.min(88, cfg.loginLogoSize ?? 88), borderRadius: Math.round((cfg.loginLogoSize ?? 88) * 0.2), objectFit: 'contain' }} />
              : <IconUsers size={Math.min(88, cfg.loginLogoSize ?? 88)} />}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input type="range" min={48} max={160} step={4} value={cfg.loginLogoSize ?? 88} onChange={(e) => set('loginLogoSize', Number(e.target.value))} style={{ width: 200, accentColor: accent, cursor: 'pointer' }} />
            <span style={{ fontFamily: 'var(--font-num)', fontSize: 14, fontWeight: 700, color: 'var(--text-2)', minWidth: 52, textAlign: 'right' }}>{cfg.loginLogoSize ?? 88} px</span>
          </div>
        </div>
      </Row>
    </Section>
  );

  // Rechtstexte für den Internet-Betrieb (Impressum §5 DDG, Datenschutz Art. 13 DSGVO). Zentral,
  // nur Admin. Werden auf der Login-Seite ohne Anmeldung verlinkt (siehe screens/Login.tsx).
  const legalArea: CSSProperties = { width: '100%', minHeight: 160, boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '11px 13px', color: 'var(--text)', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.55, outline: 'none', resize: 'vertical' };
  const rechtlichesNode = (
    <Section title="Rechtliches">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 12, padding: '12px 16px', margin: '4px 0 6px', fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>
        <span>Wird die App öffentlich im Internet betrieben, sind in Deutschland ein <b>Impressum</b> (§ 5 DDG) und eine <b>Datenschutzerklärung</b> (Art. 13 DSGVO) Pflicht. Verantwortlich ist der Betreiber (Verein). Beide Texte erscheinen als Links auf der Anmelde­seite und sind dort ohne Anmeldung erreichbar. Im lokalen/LAN-Betrieb kannst du sie leer lassen.</span>
      </div>
      <Row label="Impressum" sub="Anbieterkennzeichnung nach § 5 DDG: Name/Verein, Anschrift, Vertretungsberechtigte(r), Kontakt (E-Mail), ggf. Registereintrag." top>
        <textarea value={cfg.impressum ?? ''} onChange={(e) => set('impressum', e.target.value)} placeholder={'z. B.\nDartverein Musterstadt e. V.\nMusterstraße 1, 12345 Musterstadt\nVertreten durch: Max Mustermann (1. Vorsitzender)\nE-Mail: vorstand@musterverein.de\nVereinsregister: Amtsgericht Musterstadt, VR 1234'} style={{ ...legalArea, width: 420, maxWidth: '100%' }} />
      </Row>
      <Row label="Datenschutzerklärung" sub="Informationen nach Art. 13 DSGVO: Verantwortlicher, verarbeitete Daten (Namen, Spielstatistiken …), Zweck, Speicherdauer und Betroffenenrechte." top>
        <textarea value={cfg.datenschutz ?? ''} onChange={(e) => set('datenschutz', e.target.value)} placeholder={'Kurzfassung oder Volltext deiner Datenschutzerklärung …'} style={{ ...legalArea, width: 420, maxWidth: '100%' }} />
      </Row>
    </Section>
  );

  const benutzerNode = (
    <Section title="Benutzer & Rechte">
      <button className="dh-row" onClick={() => s.go('users')} style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: '16px 0', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text)' }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--btn)', border: '1px solid var(--border-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--text-2)' }}><IconUsers size={20} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Benutzer verwalten</div>
          <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>Vereinskonten, Rollen &amp; Verknüpfung mit Spielern verwalten</div>
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 700, flexShrink: 0 }}>{s.accounts.length} Konten</span>
        <IconChevronRight size={18} style={{ flexShrink: 0, color: 'var(--text-4)' }} />
      </button>
    </Section>
  );

  const eingabeNode = (
    <Section title="Eingabe & Tasten">
      <Row label="Eingabe-Modus" sub="Tablet zeigt das Tastenfeld · Desktop nutzt nur die Tastatur · gilt nur für dieses Gerät">
        {ed('device', seg('device', [{ label: 'Tablet', val: 'tablet' }, { label: 'Desktop', val: 'desktop' }]))}
      </Row>
      {kiosk ? (
        // Am Board nur als Info: Tastenkürzel legt der Verein zentral fest. Auf einem Desktop-Board jederzeit per Tastatur nutzbar.
        <Row label="Tastenkürzel" sub="Legt der Verein zentral fest. Am Board-PC im Eingabe-Modus Desktop direkt per Tastatur nutzbar." top>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
            {([['Neues Spiel', cfg.newGameKey || 'alt+n'], ['Schnellstart Bo5', cfg.quickBo5Key || 'alt+5'], ['Schnellstart Bo3', cfg.quickBo3Key || 'alt+3']] as const).map(([label, combo]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{label}</span>
                <kbd style={{ fontFamily: 'var(--font-num)', fontSize: 12.5, fontWeight: 700, color: accent, background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 8, padding: '4px 10px' }}>{formatCombo(combo)}</kbd>
              </div>
            ))}
          </div>
        </Row>
      ) : (
        <>
          <Row label="Funktionstasten F1–F8" sub="Frei belegbare Quick-Scores — als Tastatur-Tasten (Desktop) und als Quick-Score-Buttons (Tablet). F9 = Restscore übernehmen, F10–F12 = Checkout mit 1–3 Darts (nur Desktop)." top>
            {ed('fkeys', (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, width: '100%', maxWidth: 340 }}>
                {cfg.fkeys.map((v, i) => (
                  <label key={i} style={{ display: 'flex', flexDirection: 'column', gap: 3, background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '7px 10px', cursor: 'text' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: accent, letterSpacing: '.05em' }}>F{i + 1}</span>
                    <input type="number" min={0} max={180} value={v} onChange={(e) => s.setFKey(i, e.target.value)} style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontFamily: 'var(--font-num)', fontSize: 16, fontWeight: 700, padding: 0, margin: 0 }} />
                  </label>
                ))}
              </div>
            ))}
          </Row>
          <Row label="Neues Spiel — Tastenkürzel" sub="Global. Startet jederzeit ein neues Spiel (mit Spielerauswahl); läuft gerade ein Spiel, wird vorher nachgefragt. Alt + Buchstabe/Ziffer (optional zusätzlich Strg).">
            {ed('newGameKey', <ShortcutRecorder value={cfg.newGameKey || 'alt+n'} accent={accent} fallback="alt+n" onChange={(combo) => set('newGameKey', combo)} />)}
          </Row>
          <Row label="Schnellstart 501 · Double Out · Best of 5" sub="Global. Startet sofort ein 501-Spiel (Double Out, Best of 5) mit den zuletzt gewählten Spielern.">
            {ed('quickBo5Key', <ShortcutRecorder value={cfg.quickBo5Key || 'alt+5'} accent={accent} fallback="alt+5" onChange={(combo) => set('quickBo5Key', combo)} />)}
          </Row>
          <Row label="Schnellstart 501 · Double Out · Best of 3" sub="Global. Startet sofort ein 501-Spiel (Double Out, Best of 3) mit den zuletzt gewählten Spielern.">
            {ed('quickBo3Key', <ShortcutRecorder value={cfg.quickBo3Key || 'alt+3'} accent={accent} fallback="alt+3" onChange={(combo) => set('quickBo3Key', combo)} />)}
          </Row>
        </>
      )}
    </Section>
  );

  const darstellungNode = (
    <Section title="Darstellung">
      <Row label="Modus" sub="Dunkles oder helles Erscheinungsbild · gilt nur für dieses Gerät">
        {ed('mode', seg('mode', [{ label: 'Dunkel', val: 'dark' }, { label: 'Hell', val: 'light' }]))}
      </Row>
      <Row label="Counter-Ansicht" sub="„Große Zahl“ = riesiger Restscore (fernlesbar). „Aufschrieb“ = zusätzlich der volle Score-Sheet im n01-Stil (Score/Rest je Aufnahme, Dart-Zähler, Ton-Markierung) darunter · gilt nur für dieses Gerät · nicht am Handy">
        {ed('counterView', seg('counterView', [{ label: 'Große Zahl', val: 'big' }, { label: 'Aufschrieb', val: 'sheet' }]))}
      </Row>
      <Row label={`Akzentfarbe (${cfg.mode === 'light' ? 'Hell' : 'Dunkel'})`} sub="Buttons & Highlights. Wird je Modus (Hell/Dunkel) separat gespeichert.">{ed('accent', colorPicker('accent', false))}</Row>
      <Row label={`Score-Farbe (${cfg.mode === 'light' ? 'Hell' : 'Dunkel'})`} sub="Restpunktzahl des aktiven Spielers · „Standard“ folgt dem Akzent · je Modus separat">{ed('scoreColor', colorPicker('scoreColor', true))}</Row>
      <Row label={`Leg-Anzeige-Farbe (${cfg.mode === 'light' ? 'Hell' : 'Dunkel'})`} sub="Leg-Punkte & Satz-Badge · „Standard“ folgt dem Akzent · je Modus separat">{ed('legColor', colorPicker('legColor', true))}</Row>
      <Row label="Hintergrund" sub="Farbton der gesamten Oberfläche">
        {ed('theme', seg('theme', cfg.mode === 'light'
          ? [{ label: 'Mint', val: 'midnight' }, { label: 'Sand', val: 'charcoal' }, { label: 'Nebel', val: 'slate' }]
          : [{ label: 'Mitternacht', val: 'midnight' }, { label: 'Anthrazit', val: 'charcoal' }, { label: 'Schiefer', val: 'slate' }], '10px 14px'))}
      </Row>
      <Row label="Schriftart" sub="Wirkt im gesamten Counter">
        {ed('font', seg('font', (Object.keys(FONTS) as (keyof typeof FONTS)[]).map((f) => ({ label: f, val: f as SettingsType['font'], fam: FONTS[f] }))))}
      </Row>
      <Row label="Board-Gesamtgröße" sub="Vergrößert am Board-Monitor die gesamte Anzeige für große Leseabstände (Counter & Training). Der Restscore bleibt gleich groß · nur Desktop/Board · pro Gerät">
        {ed('boardScale', (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              className="dh-btn"
              onClick={() => set('boardScale', suggestBoardScale())}
              title="Startwert aus Bildschirm-Eigenschaften vorschlagen"
              style={{ height: 40, padding: '0 14px', borderRadius: 10, background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text-2)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Auto
            </button>
            {stepper('boardScale', 100, 250)}
          </div>
        ))}
      </Row>
      <Row label="Score-Bereich" sub="Anteil des Restscores am Spielbrett · pro Gerät">{ed('scoreArea', stepper('scoreArea', 35, 80))}</Row>
      <Row label="Score-Schriftgröße" sub="Größe der Restpunktzahl · pro Gerät">{ed('scoreScale', stepper('scoreScale', 70, 140))}</Row>
      <Row label="Statistik-Schriftgröße" sub="Text in der Werte-Box (Ø, First 9, …) · pro Gerät">{ed('statsSize', stepper('statsSize', 70, 150))}</Row>
      <Row label="Spielername-Größe" sub="Kopfzeile mit Name, Avatar & „am Wurf“ · pro Gerät">{ed('headerSize', stepper('headerSize', 70, 150))}</Row>
      <Row label="Eingabefeld-Größe" sub="Höhe von Quick-Score & Tastenfeld (nur Tablet) · pro Gerät">{ed('deckSize', stepper('deckSize', 70, 140))}</Row>
      <Row label="Leg-Anzeige-Größe" sub="Punkte & Satz-Badge neben dem Spielernamen · pro Gerät">{ed('legSize', stepper('legSize', 60, 180))}</Row>
    </Section>
  );

  const hilfenNode = (
    <Section title="Hilfen & Anzeige">
      {toggles.map((t) => {
        const on = cfg[t.key];
        return (
          <Row key={t.key} label={t.label} sub={t.sub}>
            <button onClick={() => set(t.key, !on)} style={{ position: 'relative', width: 46, height: 26, borderRadius: 999, background: on ? accent : 'var(--btn)', border: on ? 'none' : '1px solid var(--border-2)', cursor: 'pointer', flexShrink: 0, transition: 'background .15s ease', padding: 0 }}>
              <span style={{ position: 'absolute', top: 2, left: on ? 22 : 2, width: 22, height: 22, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.4)', transition: 'left .15s ease' }} />
            </button>
          </Row>
        );
      })}
    </Section>
  );

  const datenNode = (
    <Section title="Backup">
      <Row label="Sichern & Wiederherstellen" sub="Alle Daten (Spieler, Spiele, Termine, Einstellungen) als Datei sichern oder zurückspielen. Die Daten liegen sonst nur in diesem Browser.">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button className="dh-btn" onClick={doExport} style={{ background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', padding: '11px 18px', borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Exportieren</button>
          <label className="dh-btn" style={{ display: 'inline-flex', alignItems: 'center', background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', padding: '11px 18px', borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Importieren
            <input type="file" accept="application/json,.json" onChange={onImportFile} style={{ display: 'none' }} />
          </label>
        </div>
      </Row>
      {dataMsg && <div style={{ fontSize: 12, color: 'var(--text-4)', padding: '2px 2px 6px' }}>{dataMsg}</div>}
      {cfg.appMode !== 'verein' && (
        <>
          <Row label="Automatisches Backup" sub="Sichert bei jedem Start und täglich zur Uhrzeit automatisch in den festen Ordner backup/ neben der App. Funktioniert nur, wenn die App über serve-dist.mjs läuft (lokaler/Board-Betrieb). Der Ordner ist nicht wählbar.">
            <button onClick={() => set('autoBackup', !cfg.autoBackup)} role="switch" aria-checked={!!cfg.autoBackup}
              style={{ flexShrink: 0, width: 46, height: 26, borderRadius: 999, background: cfg.autoBackup ? accent : 'var(--surface-3)', border: '1px solid var(--border-2)', position: 'relative', cursor: 'pointer', padding: 0 }}>
              <span style={{ position: 'absolute', top: 2, left: cfg.autoBackup ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff' }} />
            </button>
          </Row>
          {cfg.autoBackup && (
            <Row label="Uhrzeit" sub="Tageszeit fürs tägliche Backup. War die App zu dem Zeitpunkt aus, wird beim nächsten Start nachgeholt.">
              <input type="time" value={cfg.backupTime || '20:00'} onChange={(e) => set('backupTime', e.target.value)}
                style={{ background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '9px 12px', color: 'var(--text)', fontFamily: 'var(--font-num)', fontSize: 15, fontWeight: 700, outline: 'none' }} />
            </Row>
          )}
          {cfg.autoBackup && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-4)', padding: '2px 2px 6px' }}>
              <span>{s.lastBackupAt ? `Zuletzt gesichert: ${new Date(s.lastBackupAt).toLocaleString()}` : 'Noch kein automatisches Backup.'}{s.backupMsg ? ` · ${s.backupMsg}` : ''}</span>
              <button className="dh-btn" onClick={() => void s.runBackup()} style={{ marginLeft: 'auto', background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', padding: '7px 13px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Jetzt sichern</button>
            </div>
          )}
        </>
      )}
    </Section>
  );

  const appNode = <UpdatePanel />;

  const listenNode = (
    // Namens-Sortierung: persönliche Anzeige-Vorliebe → gerätelokal, jeder darf sie ändern (außerhalb read-only).
    <Section title="Listen">
      <Row label="Namens-Sortierung" sub="Reihenfolge der Spieler-, Benutzer- & Kaderlisten. Gilt nur auf diesem Gerät.">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {([['first', 'Vorname Nachname'], ['last', 'Nachname Vorname']] as const).map(([val, label]) => {
            const on = (cfg.nameOrder ?? 'first') === val;
            return (
              <button key={val} onClick={() => s.setDeviceSetting('nameOrder', val)} style={{ background: on ? accent : 'var(--btn)', color: on ? 'var(--accent-fg)' : 'var(--text-2)', border: `1px solid ${on ? accent : 'var(--border-2)'}`, fontWeight: on ? 800 : 600, padding: '10px 16px', borderRadius: 10, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{label}</button>
            );
          })}
        </div>
      </Row>
    </Section>
  );

  const boardNode = (
    // Board-Rechner laufen über nummerierte Board-Konten: Anmeldung als „Board N" → automatisch im Kiosk.
    <Section title="Board-Rechner">
      <Row label="Board-Konten" sub="Jeder Brett-Rechner meldet sich mit seinem eigenen Board-Konto (Board 1…N) an und startet damit automatisch im gesperrten Kiosk. Konten anlegen unter Benutzer → Board-Konten.">
        <button onClick={() => s.go('users')} className="dh-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', padding: '10px 16px', borderRadius: 11, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Zu den Benutzern →</button>
      </Row>
      <Row label="Spiele am Board anzeigen" sub="Wie viele Tage um den Spieltag ein Board die zugeordnete Begegnung automatisch zeigt. Manuell überschreibbar in der Aufstellung (an die Boards senden) oder direkt am Board (jetzt anzeigen). Vereinsweit.">
        {ed('boardMatchWindow', seg('boardMatchWindow', [{ label: 'Nur Spieltag', val: 0 }, { label: '±1 Tag', val: 1 }, { label: '±2 Tage', val: 2 }, { label: '±3 Tage', val: 3 }], '9px 14px'))}
      </Row>
    </Section>
  );

  // „Mein Konto": jeder angemeldete Nutzer kann sein eigenes Passwort ändern (nicht für Board-Maschinenkonten).
  const kontoNode = (
    <Section title="Mein Konto">
      <Row label="Passwort ändern" sub="Neues Passwort für deinen eigenen Login. Mindestens 8 Zeichen; bestehende Sitzungen werden danach abgemeldet." top>
        <PasswordChange />
      </Row>
      <Row label="2-Faktor-Authentifizierung" sub="Zusätzlicher Schutz beim Login per Authenticator-App (TOTP). Optional. Mit Backup-Codes für den Notfall." top>
        <TwoFactorSettings />
      </Row>
    </Section>
  );

  const activeSeasonObj = s.seasons.find((x) => x.id === s.activeSeasonId) || null;
  const archivedSeasons = s.seasons.filter((x) => x.status === 'archived');
  // Übernahme-Assistent: nur sinnvoll, wenn die aktive Saison noch leer ist und es eine Vorsaison zum Klonen gibt.
  const activeSeasonTeams = s.teams.filter((t) => (t.seasonId ?? s.activeSeasonId) === s.activeSeasonId);
  const activeSeasonLeagues = s.leagues.filter((l) => (l.seasonId ?? s.activeSeasonId) === s.activeSeasonId);
  const activeIsEmpty = activeSeasonTeams.length === 0 && activeSeasonLeagues.length === 0;
  const otherSeasons = s.seasons.filter((x) => x.id !== s.activeSeasonId);
  const carrySrc = carrySource || otherSeasons[0]?.id || '';
  const onReimportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ''; setSeasonMsg('');
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const res = s.reimportSeason(JSON.parse(String(reader.result)));
        setSeasonMsg(res ? `Wieder eingelesen: ${res.matches} Spiele${res.restored ? `, ${res.restored} weitere Datensätze` : ''}.` : 'Ungültiges Bundle.');
      } catch { setSeasonMsg('Datei konnte nicht gelesen werden (kein gültiges JSON).'); }
    };
    reader.readAsText(f);
  };
  const saisonNode = (
    <Section title="Saison">
      <Row label="Aktive Saison" sub="Neue Ligen, Mannschaften, Termine und Spiele werden dieser Saison zugeordnet.">
        <span style={{ fontSize: 14, fontWeight: 800, color: accent }}>{activeSeasonObj ? activeSeasonObj.name : '—'}</span>
      </Row>
      <Row label="Saison-Daten sichern" sub="Lädt die komplette aktive Saison (Ligen, Mannschaften, Termine, Spiele + Abschluss-Stand) als JSON-Datei herunter. Ändert nichts.">
        <button className="dh-btn" onClick={() => s.exportSeason()} style={{ background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Exportieren</button>
      </Row>
      <Row label="Saison abschließen" sub="Friert Tabellen & Statistiken als Schnappschuss ein, lädt eine Sicherung herunter, archiviert die Saison (read-only) und legt automatisch eine neue, leere Folgesaison an.">
        {!closeConfirm ? (
          <button onClick={() => setCloseConfirm(true)} style={{ background: 'transparent', border: '1px solid rgba(242,184,41,.5)', color: '#F2B829', padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Abschließen …</button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, textAlign: 'right', maxWidth: 320 }}>
              „{activeSeasonObj ? activeSeasonObj.name : ''}" wird archiviert (bleibt read-only sichtbar) und eine neue Saison gestartet. Eine Sicherungsdatei wird heruntergeladen.
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setCloseConfirm(false)} style={{ background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text-3)', padding: '9px 14px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
              <button onClick={() => { s.closeSeason(); setCloseConfirm(false); }} style={{ background: '#F2B829', border: 'none', color: '#1a1206', padding: '9px 16px', borderRadius: 9, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Jetzt abschließen</button>
            </div>
          </div>
        )}
      </Row>
      {activeIsEmpty && otherSeasons.length > 0 && (
        <Row label="Vorsaison übernehmen" sub="Übernimmt Mannschaften und/oder Liga-Strukturen (Teilnehmer & Format, OHNE Begegnungen/Ergebnisse) aus einer früheren Saison in die aktuelle. Den neuen Spielplan danach über Ligen → Import einlesen.">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
            <select value={carrySrc} onChange={(e) => setCarrySource(e.target.value)} style={{ background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '8px 12px', color: 'var(--text)', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>
              {otherSeasons.map((se) => <option key={se.id} value={se.id}>aus Saison {se.name}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-2)', cursor: 'pointer' }}>
              <input type="checkbox" checked={carryTeams} onChange={(e) => setCarryTeams(e.target.checked)} /> Mannschaften (mit Kader &amp; Kapitän)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-2)', cursor: 'pointer' }}>
              <input type="checkbox" checked={carryLeagues} onChange={(e) => setCarryLeagues(e.target.checked)} /> Liga-Struktur (ohne Ergebnisse)
            </label>
            <button onClick={() => s.carryOverSeason({ fromSeasonId: carrySrc, teams: carryTeams, leagues: carryLeagues })} disabled={!carrySrc || (!carryTeams && !carryLeagues)} style={{ background: 'var(--accent)', border: 'none', color: 'var(--accent-fg)', padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: (!carrySrc || (!carryTeams && !carryLeagues)) ? 'not-allowed' : 'pointer', opacity: (!carrySrc || (!carryTeams && !carryLeagues)) ? 0.5 : 1, fontFamily: 'inherit' }}>Übernehmen</button>
          </div>
        </Row>
      )}
      {archivedSeasons.length > 0 && (
        <Row label="Archivierte Saisons" sub="Lesemodus über den Saison-Umschalter links. Auslagern entfernt die Spiele aus der Datenbank (lädt vorher eine Sicherung herunter) und gibt Platz frei; Re-Import liest ein Bundle wieder ein.">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
            {archivedSeasons.map((se) => (
              <div key={se.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>{se.name}</span>
                {se.offloaded && <span style={{ fontSize: 10, fontWeight: 800, color: '#F2B829', background: 'rgba(242,184,41,.14)', border: '1px solid rgba(242,184,41,.4)', padding: '2px 7px', borderRadius: 6 }}>AUSGELAGERT</span>}
                <button className="dh-btn" onClick={() => s.exportSeason(se.id)} style={{ background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text-3)', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Export</button>
                {se.offloaded ? (
                  <label className="dh-btn" style={{ background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Re-Import
                    <input type="file" accept="application/json,.json" onChange={onReimportFile} style={{ display: 'none' }} />
                  </label>
                ) : offloadConfirm === se.id ? (
                  <span style={{ display: 'inline-flex', gap: 6 }}>
                    <button onClick={() => setOffloadConfirm(null)} style={{ background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text-3)', padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
                    <button onClick={() => { s.offloadSeason(se.id); setOffloadConfirm(null); setSeasonMsg(`„${se.name}" ausgelagert – Sicherung wurde heruntergeladen.`); }} style={{ background: '#E0594B', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Auslagern bestätigen</button>
                  </span>
                ) : (
                  <button onClick={() => { setOffloadConfirm(se.id); setSeasonMsg(''); }} style={{ background: 'transparent', border: '1px solid rgba(224,89,75,.5)', color: '#E0594B', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Auslagern</button>
                )}
              </div>
            ))}
            {seasonMsg && <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>{seasonMsg}</span>}
          </div>
        </Row>
      )}
    </Section>
  );

  // Rubriken als Buttons. Verein/Benutzer/Board nur im Vereinsmodus; sonst bleibt nur die Nutzungsart + Counter-Rubriken.
  const categories: { key: string; label: string; show: boolean; node: ReactNode }[] = [
    { key: 'modus', label: 'Nutzungsart', show: p.manageClub, node: dim(modusNode) },
    { key: 'verein', label: 'Verein', show: isVerein && p.manageClub, node: vereinNode },
    { key: 'saison', label: 'Saison', show: isVerein && p.manageClub, node: saisonNode },
    { key: 'rechtliches', label: 'Rechtliches', show: isVerein && p.manageClub, node: rechtlichesNode },
    { key: 'benutzer', label: 'Benutzer & Rechte', show: isVerein && p.manageUsers, node: benutzerNode },
    { key: 'board', label: 'Board-Rechner', show: isVerein && p.manageUsers, node: boardNode },
    { key: 'geraete', label: 'Geräte', show: isVerein && p.manageUsers, node: <JoinDevicesPanel /> },
    { key: 'konto', label: 'Mein Konto', show: isVerein && !!s.session && !s.accounts.find((a) => a.id === s.session)?.isBoard, node: kontoNode },
    { key: 'eingabe', label: 'Eingabe & Tasten', show: true, node: eingabeNode },
    { key: 'darstellung', label: 'Darstellung', show: true, node: darstellungNode },
    { key: 'hilfen', label: 'Hilfen & Anzeige', show: true, node: dim(hilfenNode) },
    { key: 'listen', label: 'Listen', show: true, node: listenNode },
    { key: 'daten', label: 'Backup', show: true, node: dim(datenNode) },
    { key: 'app', label: 'App & Updates', show: true, node: appNode },
  ];
  // Im Kiosk nur die gerätenahen Counter-Rubriken (kein Admin/Daten) – als eigener Board-Tab.
  // 'app' ist dabei, damit der Board-Betreuer Version prüfen & Updates anstoßen kann.
  const KIOSK_KEYS = ['eingabe', 'darstellung', 'hilfen', 'listen', 'app'];
  const shown = categories.filter((c) => c.show && (!kiosk || KIOSK_KEYS.includes(c.key)));
  const active = shown.find((c) => c.key === activeKey) || shown[0];

  return (
    <div style={{ padding: '28px 32px', maxWidth: 920, margin: '0 auto' }}>
      <div style={{ marginBottom: 4, fontSize: 12, color: 'var(--text-4)', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }}>Counter</div>
      <h1 style={{ margin: '0 0 6px', fontSize: 27, fontWeight: 800, letterSpacing: '-.02em' }}>Einstellungen</h1>
      <p style={{ margin: '0 0 22px', fontSize: 14, color: 'var(--text-3)' }}>{canEdit ? 'Zentrale Einstellungen – wird automatisch gespeichert' : 'Diese Einstellungen legt die Vereinsverwaltung zentral fest.'}</p>

      {!canEdit && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 12, padding: '12px 16px', marginBottom: 18, fontSize: 13, color: 'var(--text-3)' }}>
          <IconUsers size={17} />
          <span>Oberfläche &amp; Counter-Optionen sind vereinsweit einheitlich und können nur von einem Administrator geändert werden.</span>
        </div>
      )}

      {/* Rubrik-Navigation */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {shown.map((c) => {
          const on = active?.key === c.key;
          return (
            <button key={c.key} onClick={() => setActiveKey(c.key)} style={{ background: on ? accent : 'var(--surface)', color: on ? 'var(--accent-fg)' : 'var(--text-2)', border: `1px solid ${on ? accent : 'var(--border-2)'}`, fontWeight: on ? 800 : 600, padding: '9px 16px', borderRadius: 999, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{c.label}</button>
          );
        })}
      </div>

      {active?.node}
    </div>
  );
}
