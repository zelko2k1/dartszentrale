import { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { TEAM_KINDS, teamKind } from '../data/constants';
import { Avatar } from '../components/Avatar';
import { aggregateFor, teamRoster, perm, nextOwnFixture, inSeason } from '../store/selectors';
import { initials, shortLong, todayIso } from '../lib/format';
import { IconPlus, IconEdit } from '../lib/icons';
import { TeamKindIcon } from '../modals/TeamModal';
import { SearchInput } from '../components/SearchInput';
import { compareName, matchesQuery, nameParts } from '../lib/people';
import { useIsPhone } from '../lib/useIsPhone';
import type { Player } from '../data/types';

export function Teams() {
  const s = useStore();
  const accent = s.settings.accent;
  const isPhone = useIsPhone();
  const p = perm(s.settings, s.accounts, s.session);
  const readOnly = s.viewSeasonId != null && s.viewSeasonId !== s.activeSeasonId;
  const canManage = p.manageTeams && !readOnly;
  const teams = inSeason(s.teams, s.viewSeasonId);
  const order = s.settings.nameOrder ?? 'first';
  const [query, setQuery] = useState('');
  const selIdx = Math.max(0, Math.min(teams.length - 1, s.selectedTeam));
  const sel = teams[selIdx] || null;
  const members: Player[] = sel ? teamRoster(sel, s.players) : [];
  const captain = sel ? s.players.find((x) => x.id === sel.captainId) || null : null;
  const viceCaptains = sel ? (sel.viceCaptainIds || []).map((id) => s.players.find((x) => x.id === id)).filter((x): x is Player => !!x) : [];

  // Kader-Anzeige: nach Namen sortiert + durchsuchbar. Die Aufstellung unten nutzt
  // bewusst weiter die Original-Reihenfolge (members), damit Einzel/Doppel stabil bleiben.
  const roster = useMemo(() => {
    const sorted = [...members].sort((a, b) => compareName(nameParts(a.name), nameParts(b.name), order));
    return sorted.filter((m) => matchesQuery(query, m.name, m.short));
  }, [members, order, query]);

  const teamMeta = sel ? ((sel.league ? sel.league + ' · ' : '') + members.length + ' Spieler' + (captain ? ' · Kapitän: ' + captain.name : '') + (viceCaptains.length ? ' · Vertretung: ' + viceCaptains.map((v) => v.name).join(', ') : '')) : 'Lege eine Mannschaft an';

  // Kurzer Weg: nächster offener Spieltag dieser Mannschaft (über alle Ligen), zum direkten Aufstellen.
  const nextFx = useMemo(() => (sel ? nextOwnFixture(inSeason(s.leagues, s.viewSeasonId), todayIso(), sel.name, teamKind(sel)) : null), [sel, s.leagues, s.viewSeasonId]);

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
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: active ? 'var(--text)' : 'var(--text-3)' }}>
                    <span style={{ color: TEAM_KINDS[teamKind(t)].color, display: 'inline-flex' }} title={TEAM_KINDS[teamKind(t)].label}><TeamKindIcon kind={teamKind(t)} size={14} /></span>
                    {t.name}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 600 }}>{t.memberIds.length} Spieler</span>
                </button>
              );
            })}
          </div>

          <div style={{ background: 'linear-gradient(135deg,#13241b,var(--surface) 70%)', border: '1px solid #234032', borderRadius: 18, padding: 24, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ width: 68, height: 68, borderRadius: 18, background: 'linear-gradient(135deg,#19A463,#0f6b40)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 22, color: '#fff' }}>{initials(sel.name).toUpperCase() || 'TM'}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 800, color: TEAM_KINDS[teamKind(sel)].color, background: `color-mix(in srgb, ${TEAM_KINDS[teamKind(sel)].color} 14%, transparent)`, border: `1px solid color-mix(in srgb, ${TEAM_KINDS[teamKind(sel)].color} 42%, transparent)`, padding: '3px 9px 3px 7px', borderRadius: 7, letterSpacing: '.03em', textTransform: 'uppercase' }}>
                  <TeamKindIcon kind={teamKind(sel)} size={13} />{TEAM_KINDS[teamKind(sel)].short}
                </span>
              </div>
              <div style={{ fontSize: 21, fontWeight: 800, marginTop: 6 }}>{sel.name}</div>
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
              <div style={{ padding: '12px 16px 12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>Kader</span>
                {members.length > 0 && <SearchInput value={query} onChange={setQuery} placeholder="Im Kader suchen …" width={200} />}
              </div>
              {members.length === 0 && <div style={{ padding: '24px 20px', fontSize: 13, color: 'var(--text-4)' }}>Kein Spieler im Kader.</div>}
              {members.length > 0 && roster.length === 0 && <div style={{ padding: '24px 20px', fontSize: 13, color: 'var(--text-4)' }}>Kein Spieler passt zu „{query}".</div>}
              {roster.map((m) => {
                const agg = aggregateFor(m.name, s.matches);
                const isCaptain = sel.captainId === m.id;
                return (
                  <div key={m.id} className="dh-row" onClick={() => s.openPlayer(m.id)} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 20px', borderBottom: '1px solid var(--hairline)', cursor: 'pointer' }}>
                    <Avatar photo={m.photo} short={m.short} avi={m.avi} size={38} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>{m.name}</span>
                        {isCaptain && <span style={{ fontSize: 10, fontWeight: 800, color: '#F2B829', background: 'rgba(242,184,41,.12)', padding: '2px 6px', borderRadius: 5, letterSpacing: '.04em' }}>C</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-4)' }}>{agg.games ? `${agg.games} ${agg.games === 1 ? 'Spiel' : 'Spiele'}` : 'Kaderspieler'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'var(--font-num)', fontSize: 16, fontWeight: 800 }}>{agg.avg ? agg.avg.toFixed(1) : '–'}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 600, textTransform: 'uppercase' }}>Ø 3-Dart</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Aufstellung-Hinweis: Aufstellungen werden je Ligaspiel unter „Ligen" gesetzt, nicht hier. */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 22px', minWidth: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 12 }}>Aufstellung</div>

              {canManage && nextFx && (
                // Kurzer Weg: direkt den nächsten Spieltag aufstellen, ohne Umweg über die Ligen.
                <div style={{ background: 'var(--btn)', border: '1px solid color-mix(in srgb, var(--accent) 35%, var(--border-2))', borderRadius: 12, padding: 14, marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 6 }}>Nächster Spieltag</div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{nextFx.ownIsHome ? 'gegen' : 'bei'} {nextFx.oppName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 12 }}>{nextFx.date ? shortLong(nextFx.date) : 'Datum offen'} · {nextFx.ownIsHome ? 'Heim' : 'Auswärts'}</div>
                  <button onClick={() => s.openLineupAt(nextFx.leagueIndex, nextFx.fixtureId)} className="dh-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--accent)', border: 'none', color: 'var(--accent-fg)', padding: '10px 16px', borderRadius: 11, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {nextFx.hasLineup ? 'Aufstellung bearbeiten' : 'Jetzt aufstellen'}
                  </button>
                </div>
              )}

              <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.6, marginBottom: 16 }}>
                Aufstellungen werden <strong style={{ color: 'var(--text)' }}>pro Ligaspiel</strong> festgelegt — mit freier Reihenfolge der Einzel/Doppel, Board-Zuordnung und Ersatzspielern (E1, E2 …).
                {nextFx ? ' Alle Begegnungen findest du unter ' : ' Du findest sie unter '}<strong style={{ color: 'var(--text)' }}>Ligen → Begegnung → „Aufstellen"</strong>.
              </div>
              {canManage && (
                <button onClick={() => s.go('leagues')} className="dh-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', padding: '10px 16px', borderRadius: 11, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Zu den Ligen →
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
