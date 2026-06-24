import { useStore } from '../store/useStore';
import { avatar } from '../data/constants';
import { aggregateFor, teamRoster, perm } from '../store/selectors';
import { initials, lastName } from '../lib/format';
import { IconPlus, IconEdit } from '../lib/icons';
import { useIsPhone } from '../lib/useIsPhone';
import type { Player } from '../data/types';

export function Teams() {
  const s = useStore();
  const accent = s.settings.accent;
  const isPhone = useIsPhone();
  const p = perm(s.settings, s.accounts, s.session);
  const canManage = p.manageTeams;
  const teams = s.teams;
  const selIdx = Math.max(0, Math.min(teams.length - 1, s.selectedTeam));
  const sel = teams[selIdx] || null;
  const members: Player[] = sel ? teamRoster(sel, s.players) : [];
  const captain = sel ? s.players.find((x) => x.id === sel.captainId) || null : null;

  const teamMeta = sel ? ((sel.league ? sel.league + ' · ' : '') + members.length + ' Spieler' + (captain ? ' · Kapitän: ' + captain.name : '')) : 'Lege eine Mannschaft an';

  const single = (i: number) => {
    const pl = members[i]; const a = pl ? avatar(pl.avi) : null;
    return { slot: 'Einzel ' + (i + 1), name: pl ? pl.name : 'Noch offen', short: pl ? pl.short : '', filled: !!pl, avBg: pl ? a!.bg : 'var(--border)', avFg: pl ? a!.fg : 'var(--text-4)', nameColor: pl ? 'var(--text)' : 'var(--text-4)', border: pl ? 'var(--border-2)' : 'var(--border-strong)', bg: pl ? 'var(--btn)' : 'transparent' };
  };
  const dbl = (no: number, ai: number, bi: number) => {
    const pa = members[ai], pb = members[bi]; const filled = !!(pa && pb); const a = pa ? avatar(pa.avi) : null;
    return { slot: 'Doppel ' + no, name: filled ? (lastName(pa.name) + ' / ' + lastName(pb.name)) : 'Noch offen', short: pa ? pa.short : '', filled, avBg: pa ? a!.bg : 'var(--border)', avFg: pa ? a!.fg : 'var(--text-4)', nameColor: filled ? 'var(--text)' : 'var(--text-4)', border: filled ? 'var(--border-2)' : 'var(--border-strong)', bg: filled ? 'var(--btn)' : 'transparent' };
  };
  const lineup = [single(0), single(1), single(2), single(3), dbl(1, 0, 1), dbl(2, 2, 3)];

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 27, fontWeight: 800, letterSpacing: '-.02em' }}>Mannschaften</h1>
        {canManage && (
          <button className="dh-primary" onClick={() => s.openAddTeam()} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent)', border: 'none', color: 'var(--accent-fg)', padding: '11px 18px', borderRadius: 11, fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
            <IconPlus size={17} />
            Mannschaft
          </button>
        )}
      </div>

      {teams.length === 0 && (
        <div style={{ background: 'var(--surface)', border: '1px dashed var(--border-strong)', borderRadius: 16, padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Noch keine Mannschaft</div>
          <div style={{ fontSize: 13, color: 'var(--text-4)' }}>Lege oben deine erste Mannschaft an — der Kader wird aus deiner Spielerliste gebildet.</div>
        </div>
      )}

      {teams.length > 0 && sel && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
            {teams.map((t, i) => {
              const active = i === selIdx;
              return (
                <button key={t.id} onClick={() => s.selectTeam(i)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, background: active ? 'var(--btn)' : 'transparent', border: `1.5px solid ${active ? accent : 'var(--border)'}`, borderRadius: 12, padding: '10px 16px', cursor: 'pointer', fontFamily: 'inherit', minWidth: 120 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: active ? 'var(--text)' : 'var(--text-3)' }}>{t.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 600 }}>{t.memberIds.length} Spieler</span>
                </button>
              );
            })}
          </div>

          <div style={{ background: 'linear-gradient(135deg,#13241b,var(--surface) 70%)', border: '1px solid #234032', borderRadius: 18, padding: 24, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ width: 68, height: 68, borderRadius: 18, background: 'linear-gradient(135deg,#19A463,#0f6b40)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 22, color: '#fff' }}>{initials(sel.name).toUpperCase() || 'TM'}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 21, fontWeight: 800 }}>{sel.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 3 }}>{teamMeta}</div>
            </div>
            {canManage && (
              <button className="dh-btn" onClick={() => s.openEditTeam()} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', padding: '10px 15px', borderRadius: 11, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                <IconEdit size={15} />
                Bearbeiten
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isPhone ? 'minmax(0, 1fr)' : '1.4fr 1fr', gap: 18, alignItems: 'start' }}>
            {/* roster */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', minWidth: 0 }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>Kader</div>
              {members.length === 0 && <div style={{ padding: '24px 20px', fontSize: 13, color: 'var(--text-4)' }}>Kein Spieler im Kader.</div>}
              {members.map((m) => {
                const a = avatar(m.avi); const agg = aggregateFor(m.name, s.matches);
                const isCaptain = sel.captainId === m.id;
                return (
                  <div key={m.id} className="dh-row" onClick={() => s.openPlayer(m.id)} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 20px', borderBottom: '1px solid var(--hairline)', cursor: 'pointer' }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: a.bg, color: a.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{m.short}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>{m.name}</span>
                        {isCaptain && <span style={{ fontSize: 10, fontWeight: 800, color: '#F2B829', background: 'rgba(242,184,41,.12)', padding: '2px 6px', borderRadius: 5, letterSpacing: '.04em' }}>C</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-4)' }}>{agg.games ? `${agg.games} ${agg.games === 1 ? 'Spiel' : 'Spiele'}` : 'Kaderspieler'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 16, fontWeight: 800 }}>{agg.avg ? agg.avg.toFixed(1) : '–'}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 600, textTransform: 'uppercase' }}>Ø 3-Dart</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* lineup */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 22px', minWidth: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>Aufstellung · Fr 19. Sep</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {lineup.map((l) => (
                  <div key={l.slot} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', border: `1px dashed ${l.border}`, borderRadius: 10, background: l.bg }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-4)', width: 54, textTransform: 'uppercase', letterSpacing: '.04em' }}>{l.slot}</span>
                    {l.filled && <div style={{ width: 28, height: 28, borderRadius: 8, background: l.avBg, color: l.avFg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11 }}>{l.short}</div>}
                    <span style={{ fontSize: 13, fontWeight: 600, color: l.nameColor }}>{l.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
