import { useStore } from '../store/useStore';
import { aggregateFor } from '../store/selectors';
import { Avatar } from '../components/Avatar';

const COLS = '26px 1fr 54px 34px 30px 30px 44px 46px 46px 40px 40px 46px 44px';

export function Statistics() {
  const s = useStore();
  const rows = s.players
    .map((p) => ({ p, agg: aggregateFor(p.name, s.matches) }))
    .sort((a, b) => b.agg.avg - a.agg.avg)
    .map((row, idx) => {
      const agg = row.agg;
      return {
        id: row.p.id, rank: idx + 1, name: row.p.name, short: row.p.short, photo: row.p.photo, avi: row.p.avi,
        avg: agg.avg ? agg.avg.toFixed(1) : '0.0', sp: String(agg.games), sw: String(agg.wins), sn: String(agg.losses),
        checkout: agg.games ? Math.round(agg.wins / agg.games * 100) + '%' : '0%',
        s60: String(agg.c60), s100: String(agg.c100), s140: String(agg.c140), s180: String(agg.c180), shortLegs: String(agg.shortLegs), highFinish: agg.high ? String(agg.high) : '0',
        rankColor: idx === 0 && agg.games ? '#F2B829' : idx < 3 && agg.games ? 'var(--success)' : 'var(--text-4)',
        rowBg: idx === 0 && agg.games ? 'rgba(242,184,41,.05)' : 'transparent',
      };
    });

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1180, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 27, fontWeight: 800, letterSpacing: '-.02em' }}>Statistiken · Bestenliste</h1>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-4)' }}>Sp / S / N zählen nur X01-Einzelspiele (1 gegen 1).</p>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflowX: 'auto', overflowY: 'hidden', minWidth: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 4, padding: '14px 18px', borderBottom: '1px solid var(--border)', fontSize: 10, color: 'var(--text-4)', fontWeight: 700, letterSpacing: '.02em', textTransform: 'uppercase', minWidth: 680 }}>
          <span>#</span><span>Spieler</span><span style={{ textAlign: 'right' }}>Ø 3-D.</span><span style={{ textAlign: 'right' }}>Sp</span><span style={{ textAlign: 'right' }}>S</span><span style={{ textAlign: 'right' }}>N</span><span style={{ textAlign: 'right' }}>60+</span><span style={{ textAlign: 'right' }}>100+</span><span style={{ textAlign: 'right' }}>140+</span><span style={{ textAlign: 'right' }}>180</span><span style={{ textAlign: 'right' }} title="Short Legs (≤19 Darts)">SL</span><span style={{ textAlign: 'right' }}>CO</span><span style={{ textAlign: 'right' }}>HF</span>
        </div>
        {rows.map((l) => (
          <div key={l.id} className="dh-row" onClick={() => s.openPlayer(l.id)} style={{ display: 'grid', gridTemplateColumns: COLS, gap: 4, padding: '13px 18px', borderBottom: '1px solid var(--hairline)', alignItems: 'center', cursor: 'pointer', background: l.rowBg, minWidth: 680 }}>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 800, color: l.rankColor }}>{l.rank}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <Avatar photo={l.photo} short={l.short} avi={l.avi} size={30} />
              <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.name}</span>
            </div>
            <span style={{ textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", fontSize: 15, fontWeight: 800, color: '#2BD377' }}>{l.avg}</span>
            <span style={{ textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: 'var(--text-3)' }}>{l.sp}</span>
            <span style={{ textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: '#19A463' }}>{l.sw}</span>
            <span style={{ textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: '#E0594B' }}>{l.sn}</span>
            <span style={{ textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: '#3B9EFF' }}>{l.s60}</span>
            <span style={{ textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: '#19A463' }}>{l.s100}</span>
            <span style={{ textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: '#F2B829' }}>{l.s140}</span>
            <span style={{ textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: '#E0594B' }}>{l.s180}</span>
            <span style={{ textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: '#2bd3c0' }}>{l.shortLegs}</span>
            <span style={{ textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: 'var(--text)' }}>{l.checkout}</span>
            <span style={{ textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: 'var(--text)' }}>{l.highFinish}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
