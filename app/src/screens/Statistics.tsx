import { useStore } from '../store/useStore';
import { aggregateFor, inSeason } from '../store/selectors';
import { Avatar } from '../components/Avatar';

const COLS = '26px 1fr 54px 48px 34px 30px 30px 44px 46px 46px 40px 40px 46px 44px';

type Stat = { id: string; name: string; short: string; photo?: string; avi: number; games: number; wins: number; losses: number; avg: number; c180: number; c140: number; c100: number; c60: number; high: number; shortLegs: number; co: number | null; f9: number | null };

export function Statistics() {
  const s = useStore();
  // Bestenliste je betrachteter Saison (Soft-Archiv): nur Matches dieser Saison aggregieren.
  // Ausgelagerte Saison (Phase 4): Spiele sind weg → Werte aus dem eingefrorenen Snapshot.
  const seasonMatches = inSeason(s.matches, s.viewSeasonId);
  const viewSeason = s.seasons.find((x) => x.id === s.viewSeasonId);
  const snap = viewSeason?.offloaded ? s.seasonSnapshots.find((sn) => sn.seasonId === s.viewSeasonId) : null;
  const stats: Stat[] = snap
    ? snap.playerStats.map((ps) => {
        const pl = s.players.find((x) => x.id === ps.playerId) || s.players.find((x) => x.name === ps.name);
        return { id: ps.playerId || ps.name, name: ps.name, short: pl?.short || ps.name.slice(0, 2).toUpperCase(), photo: pl?.photo, avi: pl?.avi ?? 0, games: ps.games, wins: ps.wins, losses: ps.losses, avg: ps.avg, c180: ps.c180, c140: ps.c140, c100: ps.c100, c60: ps.c60, high: ps.high, shortLegs: ps.shortLegs, co: null, f9: null };
      })
    : s.players.map((p) => {
        const a = aggregateFor(p, seasonMatches);
        return { id: p.id, name: p.name, short: p.short, photo: p.photo, avi: p.avi, games: a.games, wins: a.wins, losses: a.losses, avg: a.avg, c180: a.c180, c140: a.c140, c100: a.c100, c60: a.c60, high: a.high, shortLegs: a.shortLegs, co: a.co, f9: a.f9 };
      });
  const rows = stats
    .sort((a, b) => b.avg - a.avg)
    .map((agg, idx) => ({
      id: agg.id, rank: idx + 1, name: agg.name, short: agg.short, photo: agg.photo, avi: agg.avi,
      avg: agg.avg ? agg.avg.toFixed(1) : '0.0', f9: agg.f9 != null ? agg.f9.toFixed(1) : '–', sp: String(agg.games), sw: String(agg.wins), sn: String(agg.losses),
      checkout: agg.co != null ? agg.co + '%' : '–',
      s60: String(agg.c60), s100: String(agg.c100), s140: String(agg.c140), s180: String(agg.c180), shortLegs: String(agg.shortLegs), highFinish: agg.high ? String(agg.high) : '0',
      rankColor: idx === 0 && agg.games ? '#F2B829' : idx < 3 && agg.games ? 'var(--success)' : 'var(--text-4)',
      rowBg: idx === 0 && agg.games ? 'rgba(242,184,41,.05)' : 'transparent',
    }));

  // Bestenliste als CSV herunterladen (Semikolon-getrennt + BOM → öffnet sauber in Excel).
  const exportCsv = () => {
    const head = ['#', 'Spieler', 'Ø 3-Dart', 'First 9', 'Sp', 'S', 'N', '60+', '100+', '140+', '180', 'Short Legs', 'Checkout-%', 'High Finish'];
    const body = rows.map((l) => [l.rank, l.name, l.avg, l.f9, l.sp, l.sw, l.sn, l.s60, l.s100, l.s140, l.s180, l.shortLegs, l.checkout, l.highFinish]);
    const esc = (c: string | number) => { const v = String(c); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    const csv = [head, ...body].map((r) => r.map(esc).join(';')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `statistik-${(viewSeason?.name || 'bestenliste').replace(/[^0-9a-zA-Z]+/g, '-')}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: '0 0 6px', fontSize: 27, fontWeight: 800, letterSpacing: '-.02em' }}>Statistiken · Bestenliste</h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-4)' }}>Sp / S / N zählen nur X01-Einzelspiele (1 gegen 1).</p>
        </div>
        {rows.length > 0 && (
          <button onClick={exportCsv} className="dh-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', padding: '10px 16px', borderRadius: 11, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>CSV exportieren</button>
        )}
      </div>
      {snap && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'rgba(242,184,41,.1)', border: '1px solid rgba(242,184,41,.35)', borderRadius: 11, padding: '10px 14px', marginBottom: 18, fontSize: 13, color: 'var(--text-2)' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#F2B829', background: 'var(--btn)', border: '1px solid var(--border-2)', padding: '2px 8px', borderRadius: 6 }}>AUSGELAGERT</span>
          Detaildaten ausgelagert — Werte stammen aus dem eingefrorenen Schnappschuss dieser Saison.
        </div>
      )}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflowX: 'auto', overflowY: 'hidden', minWidth: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 4, padding: '14px 18px', borderBottom: '1px solid var(--border)', fontSize: 10, color: 'var(--text-4)', fontWeight: 700, letterSpacing: '.02em', textTransform: 'uppercase', minWidth: 730 }}>
          <span>#</span><span>Spieler</span><span style={{ textAlign: 'right' }}>Ø 3-D.</span><span style={{ textAlign: 'right' }} title="First 9 (Ø erste 3 Aufnahmen je Leg)">F9</span><span style={{ textAlign: 'right' }}>Sp</span><span style={{ textAlign: 'right' }}>S</span><span style={{ textAlign: 'right' }}>N</span><span style={{ textAlign: 'right' }}>60+</span><span style={{ textAlign: 'right' }}>100+</span><span style={{ textAlign: 'right' }}>140+</span><span style={{ textAlign: 'right' }}>180</span><span style={{ textAlign: 'right' }} title="Short Legs (≤19 Darts)">SL</span><span style={{ textAlign: 'right' }}>CO</span><span style={{ textAlign: 'right' }}>HF</span>
        </div>
        {rows.map((l) => (
          <div key={l.id} className="dh-row" onClick={() => s.openPlayer(l.id)} style={{ display: 'grid', gridTemplateColumns: COLS, gap: 4, padding: '13px 18px', borderBottom: '1px solid var(--hairline)', alignItems: 'center', cursor: 'pointer', background: l.rowBg, minWidth: 730 }}>
            <span style={{ fontFamily: 'var(--font-num)', fontSize: 14, fontWeight: 800, color: l.rankColor }}>{l.rank}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <Avatar photo={l.photo} short={l.short} avi={l.avi} size={30} />
              <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.name}</span>
            </div>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-num)', fontSize: 15, fontWeight: 800, color: '#2BD377' }}>{l.avg}</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-num)', fontSize: 13, color: '#2bd3c0' }}>{l.f9}</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-num)', fontSize: 13, color: 'var(--text-3)' }}>{l.sp}</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-num)', fontSize: 13, fontWeight: 700, color: '#19A463' }}>{l.sw}</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-num)', fontSize: 13, fontWeight: 700, color: '#E0594B' }}>{l.sn}</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-num)', fontSize: 13, color: '#3B9EFF' }}>{l.s60}</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-num)', fontSize: 13, color: '#19A463' }}>{l.s100}</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-num)', fontSize: 13, color: '#F2B829' }}>{l.s140}</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-num)', fontSize: 13, color: '#E0594B' }}>{l.s180}</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-num)', fontSize: 13, color: '#2bd3c0' }}>{l.shortLegs}</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-num)', fontSize: 13, color: 'var(--text)' }}>{l.checkout}</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-num)', fontSize: 13, color: 'var(--text)' }}>{l.highFinish}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
