import { useMemo, useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Avatar } from '../components/Avatar';
import { SearchInput } from '../components/SearchInput';
import { IconTarget } from '../lib/icons';
import { formatCombo, comboFromEvent } from '../lib/shortcut';
import { useIsPhone } from '../lib/useIsPhone';

const START_OPTS = [301, 501, 701, 1001];
const LEG_OPTS = [1, 3, 5, 7, 9, 11];
const SET_OPTS = [3, 5];
// Spieltyp-Box ein-/ausklappen. Alt+S ist bereits für den Kiosk-Tab „Spiel" belegt → Alt+P (sPieltyp).
const TYPE_KEY = 'alt+p';

export function CounterSetup() {
  const s = useStore();
  const su = s.setup;
  const cfg = s.settings;
  const accent = s.settings.accent;
  // Standard-Spieler (locked = "Spieler 1/2") immer oben in der Auswahl für ein neues Spiel.
  const players = useMemo(() => {
    const def = s.players.filter((p) => p.locked);
    const rest = s.players.filter((p) => !p.locked);
    return [...def, ...rest];
  }, [s.players]);
  const sets = su.unit === 'sets';
  const isPhone = useIsPhone();
  // Suchbegriff je Slot, damit man bei großen Kadern nicht durch die ganze Liste scrollen muss.
  const [pQuery, setPQuery] = useState<{ p1: string; p2: string }>({ p1: '', p2: '' });
  // Tastatur-First: hervorgehobene Position (Cursor) in der gefilterten Liste je Slot (↑/↓), Enter übernimmt.
  const [hi, setHi] = useState<{ p1: number; p2: number }>({ p1: 0, p2: 0 });
  const searchRefs = { p1: useRef<HTMLInputElement>(null), p2: useRef<HTMLInputElement>(null) };
  const startRef = useRef<HTMLButtonElement>(null);
  // Spieltyp standardmäßig eingeklappt (weniger Scrollen) – per Klick oder Alt+P aufklappen.
  const [typeOpen, setTypeOpen] = useState(false);
  // Beim Öffnen direkt ins Spieler-1-Suchfeld springen (sofern vorhanden) – kein Tab-Marathon.
  useEffect(() => { searchRefs.p1.current?.focus(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Alt+P klappt die Spieltyp-Box auf/zu (tastatur-first, kein Maus-Scrollen am Board nötig).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (comboFromEvent(e) === TYPE_KEY) { e.preventDefault(); setTypeOpen((v) => !v); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Liste eines Slots gefiltert + mit ORIGINAL-Index (su[idx] zeigt in `players`).
  const filteredFor = (idx: 'p1' | 'p2') => {
    const q = pQuery[idx].trim().toLowerCase();
    return players.map((p, i) => ({ p, i })).filter(({ p }) => !q || p.name.toLowerCase().includes(q));
  };
  // Tastatursteuerung im Suchfeld: ↑/↓ bewegt den Cursor, Enter übernimmt & springt weiter, Strg+Enter startet.
  const onSearchKey = (idx: 'p1' | 'p2') => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); s.startGame(); return; }
    const list = filteredFor(idx);
    if (!list.length) return;
    const cur = Math.min(hi[idx], list.length - 1);
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => ({ ...h, [idx]: Math.min(cur + 1, list.length - 1) })); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => ({ ...h, [idx]: Math.max(cur - 1, 0) })); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = list[cur];
      const other = idx === 'p1' ? su.p2 : su.p1;
      if (pick.i !== other) s.setSetup(idx, pick.i);
      if (idx === 'p1') searchRefs.p2.current?.focus(); else startRef.current?.focus();
    }
  };

  const seg = (active: boolean, label: string, onClick: () => void, mono?: boolean, key?: React.Key) => (
    <button key={key} onClick={onClick} style={{ background: active ? accent : 'var(--btn)', color: active ? 'var(--accent-fg)' : 'var(--text-2)', border: `1px solid ${active ? accent : 'var(--border-2)'}`, fontWeight: active ? 800 : 600, padding: '10px 18px', borderRadius: 10, fontSize: mono ? 14 : 13, cursor: 'pointer', fontFamily: mono ? 'var(--font-num)' : 'inherit' }}>{label}</button>
  );
  const toggle = (on: boolean, onClick: () => void) => (
    <button onClick={onClick} style={{ position: 'relative', width: 46, height: 26, borderRadius: 999, background: on ? accent : 'var(--btn)', border: on ? 'none' : '1px solid var(--border-2)', cursor: 'pointer', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 22 : 2, width: 22, height: 22, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.4)', transition: 'left .15s ease' }} />
    </button>
  );
  const row = (label: React.ReactNode, sub: string | null, right: React.ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, padding: '14px 0', borderTop: '1px solid var(--hairline)', flexWrap: 'wrap' }}>
      <div><div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>{sub && <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>{sub}</div>}</div>
      <div style={{ minWidth: 0, maxWidth: '100%' }}>{right}</div>
    </div>
  );

  const slot = (idx: 'p1' | 'p2', highlight: boolean, slotLabel: string) => {
    const guestKey = idx === 'p1' ? 'p1Guest' : 'p2Guest';
    const guest = (su[guestKey] || '').trim();
    const selPlayer = players[su[idx]] || players[0];
    const otherIdx = idx === 'p1' ? su.p2 : su.p1;
    // Gefilterte Liste, aber mit ORIGINAL-Index (su[idx] speichert den Index in `players`).
    const q = pQuery[idx].trim().toLowerCase();
    const filtered = players
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => !q || p.name.toLowerCase().includes(q));
    const headName = guest || selPlayer?.name || '';
    const headShort = guest ? (guest.slice(0, 2).toUpperCase()) : (selPlayer?.short || '');
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px', background: highlight ? 'color-mix(in srgb, var(--accent) 9%, transparent)' : 'rgba(255,255,255,.03)', border: `1px solid ${highlight ? 'color-mix(in srgb, var(--accent) 40%, var(--border-2))' : 'var(--border-2)'}`, borderRadius: 12, marginBottom: 10 }}>
          {!guest && selPlayer
            ? <Avatar photo={selPlayer.photo} short={headShort} avi={selPlayer.avi} size={40} />
            : <div style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--btn)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>{headShort}</div>}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10, color: highlight ? 'var(--success)' : 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{slotLabel}{guest && ' · Gast'}</div>
            <div style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{headName}</div>
          </div>
        </div>
        <input value={su[guestKey] || ''} onChange={(e) => s.setSetup(guestKey, e.target.value)} placeholder="oder Gastname eingeben …" style={{ width: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: `1px solid ${guest ? 'var(--accent)' : 'var(--border-2)'}`, borderRadius: 10, padding: '9px 11px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', marginBottom: 8 }} />
        {players.length > 6 && !guest && (
          <div style={{ marginBottom: 8 }}>
            <SearchInput value={pQuery[idx]} onChange={(v) => { setPQuery((cur) => ({ ...cur, [idx]: v })); setHi((h) => ({ ...h, [idx]: 0 })); }} placeholder="Spieler suchen … (↑/↓ · Enter)" width="100%" inputRef={searchRefs[idx]} onKeyDown={onSearchKey(idx)} />
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 200, overflowY: 'auto', opacity: guest ? 0.4 : 1, pointerEvents: guest ? 'none' : 'auto' }}>
          {filtered.map(({ p, i }, pos) => {
            const on = su[idx] === i; const disabled = i === otherIdx;
            const isHi = !guest && pos === Math.min(hi[idx], filtered.length - 1);
            return (
              <button key={p.id} ref={isHi ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined} onClick={() => !disabled && s.setSetup(idx, i)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', background: on ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'var(--btn)', border: `1px solid ${on ? 'var(--accent)' : 'var(--border-2)'}`, borderRadius: 10, cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit', textAlign: 'left', opacity: disabled ? 0.4 : 1, boxShadow: isHi ? '0 0 0 2px var(--accent)' : 'none' }}>
                <Avatar photo={p.photo} short={p.short} avi={p.avi} size={30} />
                <div style={{ minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>{p.name}</div></div>
              </button>
            );
          })}
          {!filtered.length && (
            <div style={{ fontSize: 13, color: 'var(--text-4)', padding: '10px 11px' }}>Kein Spieler gefunden.</div>
          )}
        </div>
      </div>
    );
  };

  const outLabel = su.outMode === 'master' ? 'Master Out' : su.outMode === 'single' ? 'Single Out' : 'Double Out';
  const summary = `${su.startScore} · ${outLabel}${su.doubleIn ? ' · Double In' : ''} · Best of ${sets ? su.bestOfSets + ' Sätze' : su.bestOf + ' Legs'}`;

  return (
    <div onKeyDown={(e) => { if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); s.startGame(); } }} style={{ padding: isPhone ? '18px 14px' : '28px 32px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 6, fontSize: 12, color: 'var(--text-4)', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }}>Darts Counter</div>
      <h1 style={{ margin: '0 0 24px', fontSize: 27, fontWeight: 800, letterSpacing: '-.02em' }}>Neues Spiel</h1>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '8px 22px', marginBottom: 18 }}>
        <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', padding: '16px 0 12px' }}>Schnellstart</div>
        <div style={{ display: 'grid', gridTemplateColumns: isPhone ? '1fr' : '1fr 1fr', gap: 12, paddingBottom: 18 }}>
          {[{ name: '501 · Double Out · Best of 5', bestOf: 5, combo: cfg.quickBo5Key || 'alt+5' }, { name: '501 · Double Out · Best of 3', bestOf: 3, combo: cfg.quickBo3Key || 'alt+3' }].map((g) => (
            <button key={g.name} className="dh-hover-border" onClick={() => s.quickStart({ startScore: 501, doubleOut: true, outMode: 'double', doubleIn: false, unit: 'legs', bestOf: g.bestOf })} title={`Schnellstart (${formatCombo(g.combo)})`} style={{ display: 'flex', alignItems: 'center', gap: 13, background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 12, padding: '14px 16px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'color-mix(in srgb, var(--accent) 14%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--accent)' }}><IconTarget size={18} sw={2.2} /></div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{g.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>{players[0]?.name} vs {players[1]?.name}</div>
              </div>
              <span style={{ flexShrink: 0, fontFamily: 'var(--font-num)', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', background: 'var(--surface-3)', border: '1px solid var(--border-2)', borderRadius: 6, padding: '3px 8px' }}>{formatCombo(g.combo)}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '8px 22px', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0 12px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>Teilnehmer</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isPhone ? '1fr' : '1fr 48px 1fr', gap: 14, alignItems: 'start', paddingBottom: 18, borderTop: '1px solid var(--hairline)', paddingTop: 16 }}>
          {slot('p1', true, 'Spieler 1')}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 64 }}><span style={{ fontFamily: 'var(--font-num)', fontSize: 16, fontWeight: 800, color: 'var(--text-4)' }}>VS</span></div>
          {slot('p2', false, 'Spieler 2')}
        </div>
        {row('Freies Spiel', 'Spaßspiel ohne Wertung – wird nicht gespeichert', toggle(!!su.freePlay, () => s.setSetup('freePlay', !su.freePlay)))}
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '8px 22px', marginBottom: 18 }}>
        {/* Spieltyp: eingeklappt nur ein Einzeiler mit der aktuellen Einstellung (weniger Scrollen) – Klick oder Alt+P klappt auf. */}
        <button onClick={() => setTypeOpen((v) => !v)} title={`Spieltyp anpassen (${formatCombo(TYPE_KEY)})`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '16px 0', textAlign: 'left' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>Spieltyp</div>
            {!typeOpen && <div style={{ fontSize: 13, color: 'var(--text-2)', fontFamily: 'var(--font-num)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{summary}</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--font-num)', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', background: 'var(--surface-3)', border: '1px solid var(--border-2)', borderRadius: 6, padding: '3px 8px' }}>{formatCombo(TYPE_KEY)}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" style={{ color: 'var(--text-3)', transform: typeOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s ease' }}><polyline points="6 9 12 15 18 9" /></svg>
          </div>
        </button>
        {typeOpen && (<>
          {row('Startpunktzahl', null, <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{START_OPTS.map((v) => seg(su.startScore === v, String(v), () => s.setSetup('startScore', v), true, v))}</div>)}
          {row('Format', 'Nach Legs oder nach Sätzen werten', <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{seg(su.unit === 'legs', 'Legs', () => s.setSetup('unit', 'legs'))}{seg(su.unit === 'sets', 'Sätze', () => s.setSetup('unit', 'sets'))}</div>)}
          {sets && row('Sätze', 'Best of … Sätze (max. 5)', (
            <select value={su.bestOfSets} onChange={(e) => s.setSetup('bestOfSets', Number(e.target.value))} style={{ background: 'var(--btn)', color: 'var(--text)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '10px 14px', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', minWidth: 185 }}>
              {SET_OPTS.map((n) => <option key={n} value={n}>Best of {n}</option>)}
            </select>
          ))}
          {row(sets ? 'Legs pro Satz' : 'Legs', sets ? 'Best of … Legs je Satz' : 'Best of … Legs', (
            <select value={su.bestOf} onChange={(e) => s.setSetup('bestOf', Number(e.target.value))} style={{ background: 'var(--btn)', color: 'var(--text)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '10px 14px', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', minWidth: 185 }}>
              {LEG_OPTS.map((n) => <option key={n} value={n}>Best of {n}</option>)}
            </select>
          ))}
          {row('Auscheck-Modus', 'Single = beliebiges Feld · Double = Doppel/Bull · Master = Doppel oder Triple', <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{seg(su.outMode === 'single', 'Single Out', () => s.setSetup('outMode', 'single'))}{seg(su.outMode === 'double', 'Double Out', () => s.setSetup('outMode', 'double'))}{seg(su.outMode === 'master', 'Master Out', () => s.setSetup('outMode', 'master'))}</div>)}
          {row('Double In', 'Leg muss mit einem Doppel eröffnet werden', toggle(su.doubleIn, () => s.setSetup('doubleIn', !su.doubleIn)))}
        </>)}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-num)' }}>{summary}</div>
          <div style={{ fontSize: 12, color: su.freePlay ? 'var(--text-4)' : 'var(--success)', fontWeight: 600, marginTop: 4 }}>{su.freePlay ? 'Freies Spiel – wird nicht gespeichert' : 'Wird für die gewählten Spieler gewertet'}</div>
        </div>
        <button ref={startRef} className="dh-primary" onClick={() => s.startGame()} title="Spiel starten (Strg+Enter)" style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--accent)', border: 'none', color: 'var(--accent-fg)', padding: '14px 28px', borderRadius: 13, fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 8px 24px color-mix(in srgb, var(--accent) 28%, transparent)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4" /></svg>
          Spiel starten
          <span style={{ fontFamily: 'var(--font-num)', fontSize: 11, fontWeight: 700, opacity: 0.8, background: 'rgba(0,0,0,.18)', borderRadius: 6, padding: '2px 7px', marginLeft: 2 }}>Strg+↵</span>
        </button>
      </div>
    </div>
  );
}
