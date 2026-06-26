import { useStore } from '../store/useStore';
import { aggregateFor } from '../store/selectors';
import { Avatar } from '../components/Avatar';
import { IconBack } from '../lib/icons';
import { useIsPhone } from '../lib/useIsPhone';

export function PlayerDetail() {
  const s = useStore();
  const player = s.players.find((p) => p.id === s.selectedPlayerId) || s.players[0];
  if (!player) { return <div style={{ padding: '28px 32px' }}>Kein Spieler ausgewählt.</div>; }
  const agg = aggregateFor(player.name, s.matches);
  const isPhone = useIsPhone();

  const stats: { value: string; label: string; color: string }[] = [
    { value: agg.avg ? agg.avg.toFixed(1) : '–', label: 'Ø 3-Dart', color: '#2BD377' },
    { value: agg.games ? Math.round(agg.wins / agg.games * 100) + '%' : '–', label: 'Siegquote', color: '#F2B829' },
    { value: String(agg.games), label: 'Spiele (X01)', color: 'var(--text)' },
    { value: String(agg.wins), label: 'Siege', color: '#19A463' },
    { value: String(agg.losses), label: 'Niederlagen', color: '#E0594B' },
    { value: agg.high ? String(agg.high) : '–', label: 'High Finish', color: 'var(--text)' },
  ];
  const scoring: { value: string; label: string; color: string }[] = [
    { value: String(agg.c60), label: '60+', color: '#3B9EFF' },
    { value: String(agg.c100), label: '100+', color: '#19A463' },
    { value: String(agg.c140), label: '140+', color: '#F2B829' },
    { value: String(agg.c180), label: '180', color: '#E0594B' },
    { value: String(agg.shortLegs), label: 'Short Legs (≤19)', color: '#2bd3c0' },
  ];

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1080, margin: '0 auto' }}>
      <button onClick={() => s.go('players')} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 18, padding: 0 }}>
        <IconBack size={15} />
        Alle Spieler
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
        <Avatar photo={player.photo} short={player.short} avi={player.avi} size={78} />
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-.02em' }}>{player.name}</h1>
          <div style={{ fontSize: 14, color: 'var(--text-3)', marginTop: 4 }}>Spielerprofil · {agg.games} {agg.games === 1 ? 'Spiel' : 'Spiele'}</div>
        </div>
        <div style={{ textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 22px' }}>
          <div style={{ fontFamily: 'var(--font-num)', fontSize: 32, fontWeight: 800, color: '#2BD377' }}>{agg.avg ? agg.avg.toFixed(1) : '–'}</div>
          <div style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 600, textTransform: 'uppercase' }}>Saison-Ø</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        {stats.map((st2) => (
          <div key={st2.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 15 }}>
            <div style={{ fontFamily: 'var(--font-num)', fontSize: 22, fontWeight: 800, color: st2.color }}>{st2.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 600, marginTop: 4 }}>{st2.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 20px', marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>Aufnahmen · Scoring</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
          {scoring.map((st2) => (
            <div key={st2.label} style={{ background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 13 }}>
              <span style={{ width: 8, height: 36, borderRadius: 4, background: st2.color, flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-num)', fontSize: 24, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{st2.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 700, marginTop: 5 }}>{st2.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isPhone ? 'minmax(0, 1fr)' : '1.4fr 1fr', gap: 18, alignItems: 'start' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>Form · letzte Spiele · Ø 3-Dart</span>
          </div>
          {agg.recent.length === 0 ? (
            <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-4)', fontSize: 13, border: '1px dashed var(--border-2)', borderRadius: 12 }}>Noch keine gespielten Partien.</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 140 }}>
              {agg.recent.slice().reverse().map((f, i, arr) => {
                const vals = arr.map((x) => x.avg); const mx = Math.max(...vals, 1); const mn = Math.min(...vals) - 4;
                const h = Math.round(((f.avg - mn) / (mx - mn || 1)) * 100);
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, height: '100%', justifyContent: 'flex-end' }}>
                    <span style={{ fontFamily: 'var(--font-num)', fontSize: 10, color: 'var(--text-4)', fontWeight: 700 }}>{f.avg ? f.avg.toFixed(0) : '0'}</span>
                    <div style={{ width: '100%', height: `${h}%`, borderRadius: '6px 6px 0 0', background: i === arr.length - 1 ? s.settings.accent : 'linear-gradient(180deg,#2a6e4a,#1c4a32)' }} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 22px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>Letzte Partien</div>
          {agg.recent.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-4)', padding: '8px 4px' }}>Noch keine Partien.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {agg.recent.map((g, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px', borderBottom: '1px solid var(--hairline)' }}>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: g.won ? 'rgba(25,164,99,.18)' : 'rgba(224,89,75,.18)', color: g.won ? 'var(--success)' : 'var(--danger-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>{g.won ? 'S' : 'N'}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>vs. {g.opp}</span>
                  <span style={{ fontFamily: 'var(--font-num)', fontSize: 13, color: 'var(--text-3)' }}>Ø {g.avg ? g.avg.toFixed(1) : '–'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
