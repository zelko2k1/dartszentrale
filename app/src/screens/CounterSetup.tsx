import { useStore } from '../store/useStore';
import { avatar } from '../data/constants';
import { IconTarget } from '../lib/icons';
import { useIsPhone } from '../lib/useIsPhone';

const START_OPTS = [301, 501, 701, 1001];
const LEG_OPTS = [1, 3, 5, 7, 9, 11];
const SET_OPTS = [3, 5];

export function CounterSetup() {
  const s = useStore();
  const su = s.setup;
  const accent = s.settings.accent;
  const players = s.players;
  const sets = su.unit === 'sets';
  const isPhone = useIsPhone();

  const seg = (active: boolean, label: string, onClick: () => void, mono?: boolean, key?: React.Key) => (
    <button key={key} onClick={onClick} style={{ background: active ? accent : 'var(--btn)', color: active ? 'var(--accent-fg)' : 'var(--text-2)', border: `1px solid ${active ? accent : 'var(--border-2)'}`, fontWeight: active ? 800 : 600, padding: '10px 18px', borderRadius: 10, fontSize: mono ? 14 : 13, cursor: 'pointer', fontFamily: mono ? "'JetBrains Mono',monospace" : 'inherit' }}>{label}</button>
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
    const sel = players[su[idx]] || players[0];
    const otherIdx = idx === 'p1' ? su.p2 : su.p1;
    const av = sel ? avatar(sel.avi) : { bg: 'var(--btn)', fg: 'var(--text)' };
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px', background: highlight ? 'color-mix(in srgb, var(--accent) 9%, transparent)' : 'rgba(255,255,255,.03)', border: `1px solid ${highlight ? 'color-mix(in srgb, var(--accent) 40%, var(--border-2))' : 'var(--border-2)'}`, borderRadius: 12, marginBottom: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: av.bg, color: av.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14 }}>{sel?.short}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10, color: highlight ? 'var(--success)' : 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{slotLabel}</div>
            <div style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sel?.name}</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 230, overflowY: 'auto' }}>
          {players.map((p, i) => {
            const on = su[idx] === i; const disabled = i === otherIdx;
            const av2 = avatar(p.avi);
            return (
              <button key={p.id} onClick={() => !disabled && s.setSetup(idx, i)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', background: on ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'var(--btn)', border: `1px solid ${on ? 'var(--accent)' : 'var(--border-2)'}`, borderRadius: 10, cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit', textAlign: 'left', opacity: disabled ? 0.4 : 1 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: av2.bg, color: av2.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11, flexShrink: 0 }}>{p.short}</div>
                <div style={{ minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>{p.name}</div></div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const outLabel = su.outMode === 'master' ? 'Master Out' : su.outMode === 'single' ? 'Single Out' : 'Double Out';
  const summary = `${su.startScore} · ${outLabel}${su.doubleIn ? ' · Double In' : ''} · Best of ${sets ? su.bestOfSets + ' Sätze' : su.bestOf + ' Legs'}`;

  return (
    <div style={{ padding: isPhone ? '18px 14px' : '28px 32px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 6, fontSize: 12, color: 'var(--text-4)', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }}>Darts Counter</div>
      <h1 style={{ margin: '0 0 24px', fontSize: 27, fontWeight: 800, letterSpacing: '-.02em' }}>Neues Spiel</h1>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '8px 22px', marginBottom: 18 }}>
        <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', padding: '16px 0 12px' }}>Schnellstart</div>
        <div style={{ display: 'grid', gridTemplateColumns: isPhone ? '1fr' : '1fr 1fr', gap: 12, paddingBottom: 18 }}>
          {[{ name: '501 · Double Out · Best of 5', bestOf: 5 }, { name: '501 · Double Out · Best of 3', bestOf: 3 }].map((g) => (
            <button key={g.name} className="dh-hover-border" onClick={() => s.quickStart({ startScore: 501, doubleOut: true, outMode: 'double', doubleIn: false, unit: 'legs', bestOf: g.bestOf })} style={{ display: 'flex', alignItems: 'center', gap: 13, background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 12, padding: '14px 16px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'color-mix(in srgb, var(--accent) 14%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--accent)' }}><IconTarget size={18} sw={2.2} /></div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{g.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>{players[0]?.name} vs {players[1]?.name}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '8px 22px', marginBottom: 18 }}>
        <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', padding: '16px 0 10px' }}>Spieltyp</div>
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
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '8px 22px', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0 12px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>Teilnehmer</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isPhone ? '1fr' : '1fr 48px 1fr', gap: 14, alignItems: 'start', paddingBottom: 18, borderTop: '1px solid var(--hairline)', paddingTop: 16 }}>
          {slot('p1', true, 'Spieler 1')}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 64 }}><span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 16, fontWeight: 800, color: 'var(--text-4)' }}>VS</span></div>
          {slot('p2', false, 'Spieler 2')}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: "'JetBrains Mono',monospace" }}>{summary}</div>
        <button className="dh-primary" onClick={() => s.startGame()} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--accent)', border: 'none', color: 'var(--accent-fg)', padding: '14px 28px', borderRadius: 13, fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 8px 24px color-mix(in srgb, var(--accent) 28%, transparent)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4" /></svg>
          Spiel starten
        </button>
      </div>
    </div>
  );
}
