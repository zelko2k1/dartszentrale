import { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { aggregateFor, perm } from '../store/selectors';
import { Avatar } from '../components/Avatar';
import { IconPlus, IconEdit, IconUserCheck } from '../lib/icons';
import { SearchInput } from '../components/SearchInput';
import { compareName, matchesQuery, nameParts } from '../lib/people';

export function Players() {
  const s = useStore();
  const p = perm(s.settings, s.accounts, s.session);
  const order = s.settings.nameOrder ?? 'first';
  const isVerein = s.settings.appMode === 'verein';
  const linkedPlayerIds = useMemo(() => new Set(s.accounts.map((a) => a.playerId).filter(Boolean) as string[]), [s.accounts]);
  const [query, setQuery] = useState('');

  const players = useMemo(() => {
    const sorted = [...s.players].sort((a, b) => compareName(nameParts(a.name), nameParts(b.name), order));
    return sorted.filter((pl) => matchesQuery(query, pl.name, pl.short));
  }, [s.players, order, query]);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 27, fontWeight: 800, letterSpacing: '-.02em' }}>Spieler</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <SearchInput value={query} onChange={setQuery} placeholder="Spieler suchen …" />
          {p.managePlayers && (
            <button className="dh-primary" onClick={() => s.openAddPlayer()} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent)', border: 'none', color: 'var(--accent-fg)', padding: '11px 18px', borderRadius: 11, fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
              <IconPlus size={17} />
              Spieler
            </button>
          )}
        </div>
      </div>

      {s.players.length === 0 && (
        <div style={{ background: 'var(--surface)', border: '1px dashed var(--border-strong)', borderRadius: 16, padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Noch keine Spieler</div>
          <div style={{ fontSize: 13, color: 'var(--text-4)' }}>Lege oben deinen ersten Spieler an.</div>
        </div>
      )}

      {s.players.length > 0 && players.length === 0 && (
        <div style={{ background: 'var(--surface)', border: '1px dashed var(--border-strong)', borderRadius: 16, padding: 36, textAlign: 'center', color: 'var(--text-4)', fontSize: 14 }}>
          Kein Spieler passt zu „{query}".
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {players.map((pl) => {
          const agg = aggregateFor(pl.name, s.matches);
          const linked = linkedPlayerIds.has(pl.id);
          return (
            <div key={pl.id} className="dh-hover-border" onClick={() => s.openPlayer(pl.id)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20, cursor: 'pointer', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                {isVerein && p.manageUsers && (
                  linked ? (
                    <span title="Hat bereits ein Benutzerkonto" style={{ width: 30, height: 30, borderRadius: 8, background: 'color-mix(in srgb, var(--success) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--success) 45%, transparent)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <IconUserCheck size={15} />
                    </span>
                  ) : (
                    <button onClick={(e) => { e.stopPropagation(); s.openAddUserForPlayer(pl.id); }} title="Als Benutzer anlegen" className="dh-btn" style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <IconUserCheck size={15} />
                    </button>
                  )
                )}
                {p.managePlayers && (
                  <button onClick={(e) => { e.stopPropagation(); s.openEditPlayer(pl.id); }} title="Bearbeiten" className="dh-btn" style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <IconEdit size={15} />
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 16, paddingRight: 64 }}>
                <Avatar photo={pl.photo} short={pl.short} avi={pl.avi} size={46} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pl.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-4)' }}>{agg.games} Spiele</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, background: 'var(--btn)', borderRadius: 10, padding: '9px 11px' }}>
                  <div style={{ fontFamily: 'var(--font-num)', fontSize: 17, fontWeight: 800 }}>{agg.avg ? agg.avg.toFixed(1) : '–'}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 600, textTransform: 'uppercase' }}>Ø 3-Dart</div>
                </div>
                <div style={{ flex: 1, background: 'var(--btn)', borderRadius: 10, padding: '9px 11px' }}>
                  <div style={{ fontFamily: 'var(--font-num)', fontSize: 17, fontWeight: 800, color: '#F2B829' }}>{agg.wins}</div>
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
