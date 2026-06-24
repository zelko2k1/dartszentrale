import { useEffect, useState, type ReactNode } from 'react';
import { useStore } from '../store/useStore';
import { perm } from '../store/selectors';
import { FONTS } from '../data/constants';
import type { Settings as SettingsType } from '../data/types';
import { IconUsers, IconChevronRight, IconTarget } from '../lib/icons';
import { comboFromEvent, isValidCombo, formatCombo } from '../lib/shortcut';

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
      style={{ width: 44, textAlign: 'center', background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontFamily: "'JetBrains Mono',monospace", fontSize: 17, fontWeight: 700, padding: 0, margin: 0 }}
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
      {warn && <span style={{ fontSize: 11, color: '#E0594B', fontWeight: 600 }}>Nur Strg + Alt + Buchstabe/Ziffer</span>}
      <button onClick={() => { setRecording((r) => !r); setWarn(false); }} style={{ minWidth: 140, fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 800, color: recording ? accent : 'var(--text-2)', background: 'var(--btn)', border: `1px solid ${recording ? accent : 'var(--border-2)'}`, borderRadius: 8, padding: '8px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
        {recording ? 'Strg + Alt + Taste …' : formatCombo(value)}
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

export function Settings() {
  const s = useStore();
  const cfg = s.settings;
  const set = s.setSetting;
  const p = perm(cfg, s.accounts, s.session);
  const accent = cfg.accent;
  const isVerein = cfg.appMode === 'verein';
  const [logoErr, setLogoErr] = useState('');
  const [dataMsg, setDataMsg] = useState('');
  const [pbUrlDraft, setPbUrlDraft] = useState(cfg.pbUrl || '');
  const [pbMsg, setPbMsg] = useState('');

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
      a.download = `dartshub-backup-${new Date().toISOString().slice(0, 10)}.json`;
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
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: 'var(--text-4)', fontWeight: 700 }}>%</span>
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

  return (
    <div style={{ padding: '28px 32px', maxWidth: 920, margin: '0 auto' }}>
      <div style={{ marginBottom: 4, fontSize: 12, color: 'var(--text-4)', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }}>Counter</div>
      <h1 style={{ margin: '0 0 6px', fontSize: 27, fontWeight: 800, letterSpacing: '-.02em' }}>Einstellungen</h1>
      <p style={{ margin: '0 0 26px', fontSize: 14, color: 'var(--text-3)' }}>Zentrale Einstellungen – wird automatisch gespeichert</p>

      {p.manageClub && (
        <Section title="App-Modus">
          <Row label="Nutzungsart" sub="Lokal: Dashboard, Counter, Training, Spieler, Statistiken. Verein: zusätzlich Ligen, Mannschaften & Turniere.">
            {seg('appMode', [{ label: 'Lokal', val: 'local' }, { label: 'Verein', val: 'verein' }], '10px 18px')}
          </Row>
        </Section>
      )}

      {p.manageClub && isVerein && (
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
            <input className="dh-input" type="text" value={cfg.clubName} onChange={(e) => set('clubName', e.target.value)} placeholder="z. B. SV Adler Niederrhein" style={{ width: 260, maxWidth: '100%', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '10px 12px', color: 'var(--text)', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, outline: 'none' }} />
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
        </Section>
      )}

      {p.manageUsers && (
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
      )}

      <Section title="Eingabe & Tasten">
        <Row label="Eingabe-Modus" sub="Tablet zeigt das Tastenfeld · Desktop nutzt nur die Tastatur">
          {seg('device', [{ label: 'Tablet', val: 'tablet' }, { label: 'Desktop', val: 'desktop' }])}
        </Row>
        <Row label="Funktionstasten F1–F8" sub="Frei belegbare Quick-Scores — als Tastatur-Tasten (Desktop) und als Quick-Score-Buttons (Tablet). F9 = Restscore übernehmen, F10–F12 = Checkout mit 1–3 Darts (nur Desktop)." top>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, width: '100%', maxWidth: 340 }}>
            {cfg.fkeys.map((v, i) => (
              <label key={i} style={{ display: 'flex', flexDirection: 'column', gap: 3, background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '7px 10px', cursor: 'text' }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: accent, letterSpacing: '.05em' }}>F{i + 1}</span>
                <input type="number" min={0} max={180} value={v} onChange={(e) => s.setFKey(i, e.target.value)} style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontFamily: "'JetBrains Mono',monospace", fontSize: 16, fontWeight: 700, padding: 0, margin: 0 }} />
              </label>
            ))}
          </div>
        </Row>
        <Row label="Neues Spiel — Tastenkürzel" sub="Global. Startet jederzeit ein neues Spiel (mit Spielerauswahl); läuft gerade ein Spiel, wird vorher nachgefragt. Nur Strg + Alt + Buchstabe/Ziffer.">
          <ShortcutRecorder value={cfg.newGameKey || 'ctrl+alt+n'} accent={accent} fallback="ctrl+alt+n" onChange={(combo) => set('newGameKey', combo)} />
        </Row>
        <Row label="Schnellstart 501 · Double Out · Best of 5" sub="Global. Startet sofort ein 501-Spiel (Double Out, Best of 5) mit den zuletzt gewählten Spielern.">
          <ShortcutRecorder value={cfg.quickBo5Key || 'ctrl+alt+5'} accent={accent} fallback="ctrl+alt+5" onChange={(combo) => set('quickBo5Key', combo)} />
        </Row>
        <Row label="Schnellstart 501 · Double Out · Best of 3" sub="Global. Startet sofort ein 501-Spiel (Double Out, Best of 3) mit den zuletzt gewählten Spielern.">
          <ShortcutRecorder value={cfg.quickBo3Key || 'ctrl+alt+3'} accent={accent} fallback="ctrl+alt+3" onChange={(combo) => set('quickBo3Key', combo)} />
        </Row>
      </Section>

      <Section title="Darstellung">
        <Row label="Modus" sub="Dunkles oder helles Erscheinungsbild">
          {seg('mode', [{ label: 'Dunkel', val: 'dark' }, { label: 'Hell', val: 'light' }])}
        </Row>
        <Row label={`Akzentfarbe (${cfg.mode === 'light' ? 'Hell' : 'Dunkel'})`} sub="Buttons & Highlights. Wird je Modus (Hell/Dunkel) separat gespeichert.">{colorPicker('accent', false)}</Row>
        <Row label={`Score-Farbe (${cfg.mode === 'light' ? 'Hell' : 'Dunkel'})`} sub="Restpunktzahl des aktiven Spielers · „Standard“ folgt dem Akzent · je Modus separat">{colorPicker('scoreColor', true)}</Row>
        <Row label={`Leg-Anzeige-Farbe (${cfg.mode === 'light' ? 'Hell' : 'Dunkel'})`} sub="Leg-Punkte & Satz-Badge · „Standard“ folgt dem Akzent · je Modus separat">{colorPicker('legColor', true)}</Row>
        <Row label="Hintergrund" sub="Farbton der gesamten Oberfläche">
          {seg('theme', cfg.mode === 'light'
            ? [{ label: 'Mint', val: 'midnight' }, { label: 'Sand', val: 'charcoal' }, { label: 'Nebel', val: 'slate' }]
            : [{ label: 'Mitternacht', val: 'midnight' }, { label: 'Anthrazit', val: 'charcoal' }, { label: 'Schiefer', val: 'slate' }], '10px 14px')}
        </Row>
        <Row label="Schriftart" sub="Wirkt im gesamten Counter">
          {seg('font', (Object.keys(FONTS) as (keyof typeof FONTS)[]).map((f) => ({ label: f, val: f as SettingsType['font'], fam: FONTS[f] })))}
        </Row>
        <Row label="Score-Bereich" sub="Anteil des Restscores am Spielbrett">{stepper('scoreArea', 35, 80)}</Row>
        <Row label="Score-Schriftgröße" sub="Größe der Restpunktzahl">{stepper('scoreScale', 70, 140)}</Row>
        <Row label="Statistik-Schriftgröße" sub="Text in der Werte-Box (Ø, First 9, …)">{stepper('statsSize', 70, 150)}</Row>
        <Row label="Spielername-Größe" sub="Kopfzeile mit Name, Avatar & „am Wurf“">{stepper('headerSize', 70, 150)}</Row>
        <Row label="Eingabefeld-Größe" sub="Höhe von Quick-Score & Tastenfeld (nur Tablet)">{stepper('deckSize', 70, 140)}</Row>
        <Row label="Leg-Anzeige-Größe" sub="Punkte & Satz-Badge neben dem Spielernamen">{stepper('legSize', 60, 180)}</Row>
      </Section>

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

      <Section title="Daten">
        <Row label="Sicherung & Wiederherstellung" sub="Alle Daten (Spieler, Spiele, Termine, Einstellungen) als Datei sichern oder zurückspielen. Die Daten liegen sonst nur in diesem Browser.">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button className="dh-btn" onClick={doExport} style={{ background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', padding: '11px 18px', borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Exportieren</button>
            <label className="dh-btn" style={{ display: 'inline-flex', alignItems: 'center', background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', padding: '11px 18px', borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Importieren
              <input type="file" accept="application/json,.json" onChange={onImportFile} style={{ display: 'none' }} />
            </label>
          </div>
        </Row>
        {dataMsg && <div style={{ fontSize: 12, color: 'var(--text-4)', padding: '2px 2px 6px' }}>{dataMsg}</div>}
      </Section>

      {p.play && (
        <button className="dh-primary" onClick={() => s.go('counter')} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: 'var(--accent)', border: 'none', color: 'var(--accent-fg)', padding: '13px 22px', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 8px 24px color-mix(in srgb, var(--accent) 24%, transparent)' }}>
          <IconTarget size={18} sw={2.2} />
          Zum Darts Counter
        </button>
      )}
    </div>
  );
}
