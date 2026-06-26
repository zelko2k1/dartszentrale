import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { perm } from '../store/selectors';
import { formatCombo } from '../lib/shortcut';
import { SearchInput } from './SearchInput';

interface Cmd { label: string; hint?: string; run: () => void; }

// Befehls-Palette (Strg+K): tippen → springen. Im Kiosk auf die erlaubten Ziele beschränkt.
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore();
  const accent = s.settings.accent;
  const p = perm(s.settings, s.accounts, s.session);
  const isVerein = s.settings.appMode === 'verein';
  const me = s.accounts.find((a) => a.id === s.session) || null;
  const kiosk = isVerein && !!s.session && !!me?.isBoard && me?.boardNumber != null && !s.kioskUnlocked;
  const gameActive = s.allThrows.length > 0;
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const cmds = useMemo<Cmd[]>(() => {
    const go = (screen: Parameters<typeof s.go>[0]) => () => { s.go(screen); onClose(); };
    if (kiosk) {
      return [
        { label: 'Spiel', hint: 'Alt+S', run: () => { s.go('setup'); onClose(); } },
        { label: 'Training', hint: 'Alt+T', run: go('training') },
        { label: 'Einstellungen', hint: 'Alt+E', run: go('settings') },
      ];
    }
    const list: (Cmd | false)[] = [
      { label: 'Dashboard', run: go('dashboard') },
      p.play && { label: 'Neues Spiel', hint: formatCombo(s.settings.newGameKey || 'alt+n'), run: () => { s.requestNew({ kind: 'setup' }); onClose(); } },
      p.play && gameActive && { label: 'Laufendes Spiel', run: go('counter') },
      p.play && { label: 'Schnellstart 501 · Bo5', hint: formatCombo(s.settings.quickBo5Key || 'alt+5'), run: () => { s.requestNew({ kind: 'preset', preset: { startScore: 501, unit: 'legs', bestOf: 5, outMode: 'double', doubleOut: true, doubleIn: false } }); onClose(); } },
      p.play && { label: 'Schnellstart 501 · Bo3', hint: formatCombo(s.settings.quickBo3Key || 'alt+3'), run: () => { s.requestNew({ kind: 'preset', preset: { startScore: 501, unit: 'legs', bestOf: 3, outMode: 'double', doubleOut: true, doubleIn: false } }); onClose(); } },
      p.play && { label: 'Trainingsspiele', run: go('training') },
      { label: 'Kalender', run: go('calendar') },
      isVerein && { label: 'Ligen', run: go('leagues') },
      isVerein && { label: 'Mannschaften', run: go('teams') },
      { label: 'Spieler', run: go('players') },
      { label: 'Statistiken', run: go('stats') },
      isVerein && p.manageUsers && { label: 'Benutzer', run: go('users') },
      { label: 'Einstellungen', run: go('settings') },
    ];
    return list.filter(Boolean) as Cmd[];
  }, [kiosk, isVerein, p.play, p.manageUsers, gameActive, s, onClose]);

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? cmds.filter((c) => c.label.toLowerCase().includes(needle)) : cmds;
  }, [cmds, q]);

  // Beim Öffnen zurücksetzen + Fokus ins Suchfeld.
  useEffect(() => { if (open) { setQ(''); setHi(0); setTimeout(() => inputRef.current?.focus(), 0); } }, [open]);

  if (!open) return null;
  const cur = Math.min(hi, Math.max(0, items.length - 1));

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setHi(Math.min(cur + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(Math.max(cur - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); items[cur]?.run(); }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(8,10,12,.72)', backdropFilter: 'blur(4px)', zIndex: 120, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '14vh' }}>
      <div onClick={(e) => e.stopPropagation()} onKeyDown={onKey} style={{ width: 'min(560px, 92vw)', background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,.5)', overflow: 'hidden' }}>
        <div style={{ padding: 12, borderBottom: '1px solid var(--hairline)' }}>
          <SearchInput value={q} onChange={(v) => { setQ(v); setHi(0); }} placeholder="Springen zu … (↑/↓ · Enter)" width="100%" inputRef={inputRef} />
        </div>
        <div style={{ maxHeight: 320, overflowY: 'auto', padding: 6 }}>
          {items.map((c, i) => {
            const isHi = i === cur;
            return (
              <button key={c.label} ref={isHi ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}
                onClick={c.run} onMouseMove={() => setHi(i)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%', textAlign: 'left', padding: '11px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, background: isHi ? `color-mix(in srgb, ${accent} 16%, transparent)` : 'transparent', color: isHi ? 'var(--text)' : 'var(--text-2)' }}>
                <span>{c.label}</span>
                {c.hint && <span style={{ fontFamily: 'var(--font-num)', fontSize: 11, fontWeight: 700, color: 'var(--text-4)' }}>{c.hint}</span>}
              </button>
            );
          })}
          {!items.length && <div style={{ padding: '14px 12px', fontSize: 13, color: 'var(--text-4)' }}>Kein Treffer.</div>}
        </div>
        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--hairline)', fontSize: 11, color: 'var(--text-4)', display: 'flex', gap: 14, fontFamily: 'var(--font-num)' }}>
          <span>↑↓ wählen</span><span>↵ öffnen</span><span>Esc schließen</span>
        </div>
      </div>
    </div>
  );
}
