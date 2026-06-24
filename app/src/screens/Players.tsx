import { useStore } from '../store/useStore';
import { avatar } from '../data/constants';
import { aggregateFor, perm } from '../store/selectors';
import { IconPlus, IconEdit } from '../lib/icons';

export function Players() {
  const s = useStore();
  const p = perm(s.settings, s.accounts, s.session);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 27, fontWeight: 800, letterSpacing: '-.02em' }}>Spieler</h1>
        {p.managePlayers && (
          <button className="dh-primary" onClick={() => s.openAddPlayer()} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent)', border: 'none', color: 'var(--accent-fg)', padding: '11px 18px', borderRadius: 11, fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
            <IconPlus size={17} />
            Spieler
          </button>
        )}
      </div>

      {s.players.length === 0 && (
        <div style={{ background: 'var(--surface)', border: '1px dashed var(--border-strong)', borderRadius: 16, padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Noch keine Spieler</div>
          <div style={{ fontSize: 13, color: 'var(--text-4)' }}>Lege oben deinen ersten Spieler an.</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {s.players.map((pl) => {
          const a = avatar(pl.avi); const agg = aggregateFor(pl.name, s.matches);
          return (
            <div key={pl.id} className="dh-hover-border" onClick={() => s.openPlayer(pl.id)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20, cursor: 'pointer', position: 'relative' }}>
              {p.managePlayers && (
                <button onClick={(e) => { e.stopPropagation(); s.openEditPlayer(pl.id); }} title="Bearbeiten" className="dh-btn" style={{ position: 'absolute', top: 14, right: 14, width: 30, height: 30, borderRadius: 8, background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <IconEdit size={15} />
                </button>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 16 }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: a.bg, color: a.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16 }}>{pl.short}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pl.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-4)' }}>{agg.games} Spiele</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, background: 'var(--btn)', borderRadius: 10, padding: '9px 11px' }}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 17, fontWeight: 800 }}>{agg.avg ? agg.avg.toFixed(1) : '–'}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 600, textTransform: 'uppercase' }}>Ø 3-Dart</div>
                </div>
                <div style={{ flex: 1, background: 'var(--btn)', borderRadius: 10, padding: '9px 11px' }}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 17, fontWeight: 800, color: '#F2B829' }}>{agg.wins}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 600, textTransform: 'uppercase' }}>Siege</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
