import { useStore } from '../store/useStore';
import { EVENT_TYPES, TRAIN_MODES, ROLES, TEAM_KINDS, teamKind, type TrainMode } from '../data/constants';
import { Avatar } from '../components/Avatar';
import {
  dashboardMetrics, recentResults, aggregateFor, perm, currentUser, nextOwnFixture, computeStandings, inSeason,
} from '../store/selectors';
import { longDate, greeting as greetFn, shortLong, todayIso } from '../lib/format';
import { LiveClock } from '../components/LiveClock';
import { IconTarget, IconCalendarSmall, IconUsers, IconUserCheck, IconShield, IconTrophy, IconSettings, IconChevronRight, IconPlus } from '../lib/icons';
import { TeamKindIcon } from '../modals/TeamModal';
import { useIsPhone } from '../lib/useIsPhone';

export function Dashboard() {
  const isVerein = useStore((s) => s.settings.appMode === 'verein');
  return isVerein ? <VereinDashboard /> : <LocalDashboard />;
}

const MON3 = ['JAN', 'FEB', 'MRZ', 'APR', 'MAI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEZ'];
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

function VereinDashboard() {
  const s = useStore();
  const now = new Date();
  const p = perm(s.settings, s.accounts, s.session);
  const accent = s.settings.accent;
  const range = s.settings.dashRange || 'month';
  const isPhone = useIsPhone();
  const norm = (x: string) => x.replace(/\s+/g, ' ').trim().toLowerCase();

  // Dashboard ist die „Jetzt"-Übersicht → immer die AKTIVE Saison (unabhängig vom Saison-Umschalter).
  const dLeagues = inSeason(s.leagues, s.activeSeasonId);
  const dTeams = inSeason(s.teams, s.activeSeasonId);
  const dMatches = inSeason(s.matches, s.activeSeasonId);
  const dEvents = inSeason(s.events, s.activeSeasonId);

  // ── Wer ist angemeldet? Die Rolle bestimmt den Fokus des Dashboards. ──
  const u = currentUser(s.accounts, s.session);
  const isAdmin = p.admin;
  const canManage = p.manageTeams; // Admin/Kapitän dürfen aufstellen
  const myPlayerId = u?.playerId ?? null;
  const myPlayer = myPlayerId ? s.players.find((pl) => pl.id === myPlayerId) : null;
  const myTeams = myPlayerId
    ? dTeams.filter((t) => t.memberIds.includes(myPlayerId) || t.captainId === myPlayerId || (t.viceCaptainIds || []).includes(myPlayerId))
    : [];
  // Persönliche Sicht (Kapitän/Spieler mit eigener Mannschaft) vs. Vereinssicht (Admin / ohne Verknüpfung).
  const personalView = !isAdmin && myTeams.length > 0;
  const teamsView = personalView ? myTeams : dTeams;
  const namesView = new Set(teamsView.map((t) => norm(t.name)));

  // ── Termine (verein-scoped) ──
  const scope = 'verein';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let limit: Date | null = null;
  if (range === 'week') { const dow = (today.getDay() + 6) % 7; limit = new Date(today); limit.setDate(today.getDate() + (6 - dow)); limit.setHours(23, 59, 59, 999); }
  else if (range === 'month') { limit = new Date(today.getFullYear(), today.getMonth() + 1, 0); limit.setHours(23, 59, 59, 999); }

  const events = dEvents
    .filter((e) => e.scope === scope)
    .map((e) => ({ e, dt: new Date(e.date + 'T' + (e.time || '00:00')) }))
    .filter((x) => { const d = new Date(x.e.date + 'T00:00'); return d >= today && (!limit || d <= limit); })
    .sort((a, b) => +a.dt - +b.dt)
    .slice(0, 4)
    .map(({ e, dt }) => {
      const t = EVENT_TYPES[e.type] || { label: e.type, color: 'var(--text-3)', icon: 'M12 3a9 9 0 100 18 9 9 0 000-18z' };
      const dayDiff = Math.round((+new Date(e.date + 'T00:00') - +today) / 86400000);
      const rel = dayDiff === 0 ? 'Heute' : dayDiff === 1 ? 'Morgen' : WD[dt.getDay()];
      return {
        id: e.id, day: String(dt.getDate()), mon: MON3[dt.getMonth()], rel, title: e.title,
        color: t.color, typeLabel: t.label, icon: t.icon,
        typeBg: `color-mix(in srgb, ${t.color} 16%, transparent)`,
        meta: (e.time ? e.time + ' Uhr' : '') + (e.time && e.loc ? ' · ' : '') + (e.loc || ''),
      };
    });

  // ── Nächste Begegnungen je relevanter Mannschaft (Liga/Pokal über teamKind getrennt) ──
  const todayStr = todayIso();
  const upcoming = teamsView
    .map((t) => ({ team: t, fx: nextOwnFixture(dLeagues, todayStr, t.name, teamKind(t)) }))
    .filter((x) => x.fx)
    .sort((a, b) => (a.fx!.date || '').localeCompare(b.fx!.date || ''));

  // ── Tabellen je relevantem Wettbewerb ──
  const leaguesView = dLeagues
    .filter((lg) => lg.teams.some((t) => t.own && (!personalView || namesView.has(norm(t.name)))));

  const myAgg = myPlayer ? aggregateFor(myPlayer, dMatches) : null;
  const results = recentResults(leaguesView, 4);
  const metrics = dashboardMetrics(s.players, dTeams, dLeagues, dMatches);

  const roleLabel = p.role && (ROLES as Record<string, { label: string }>)[p.role] ? (ROLES as Record<string, { label: string }>)[p.role].label : 'Verein';
  const firstName = u?.first?.trim() || u?.name?.trim() || s.settings.clubName || 'Verein';
  const greeting = `${greetFn(now)}, ${firstName}`;
  const subtitle = u ? `${roleLabel}${s.settings.clubName ? ' · ' + s.settings.clubName : ''}` : (s.settings.clubName || 'Vereinsübersicht');

  const statCards: { label: string; value: string; delta: string; icon: string; iconBg: string; screen: Parameters<typeof s.go>[0] }[] = [
    { label: 'Spieler', value: String(metrics.playerCount), delta: 'verwalten →', icon: '👥', iconBg: 'rgba(59,158,255,.12)', screen: 'players' },
    { label: 'Mannschaften', value: String(metrics.teamCount), delta: 'verwalten →', icon: '🛡', iconBg: 'rgba(25,164,99,.12)', screen: 'teams' },
    { label: 'Wettbewerbe', value: String(leaguesView.length), delta: 'Liga & Pokal →', icon: '🏆', iconBg: 'rgba(242,184,41,.12)', screen: 'leagues' },
    { label: 'Konten', value: String(s.accounts.length), delta: 'Benutzer & Rechte →', icon: '🔑', iconBg: 'rgba(155,109,255,.12)', screen: 'users' },
  ];

  const cardStyle: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 22px' };
  const sectionTitle: React.CSSProperties = { fontSize: 12, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 };

  // ── Admin: Schnellanlage (direkt aus dem Dashboard anlegen) ──
  const quickCreate: { label: string; sub: string; color: string; icon: React.ReactNode; onClick: () => void }[] = [
    { label: 'Spieler', sub: 'Zur Spielerliste', color: '#3B9EFF', icon: <IconUserCheck size={20} />, onClick: () => s.openAddPlayer() },
    { label: 'Benutzer', sub: 'Konto & Rolle', color: '#9b6dff', icon: <IconUsers size={20} />, onClick: () => s.openAddUser() },
    { label: 'Mannschaft', sub: 'Kader anlegen', color: '#19A463', icon: <IconShield size={20} />, onClick: () => s.openAddTeam() },
    { label: 'Wettbewerb', sub: 'Liga oder Pokal', color: '#F2B829', icon: <IconTrophy size={20} />, onClick: () => s.openAddLeague() },
    { label: 'Termin', sub: 'Im Vereinskalender', color: '#2BD3C0', icon: <IconCalendarSmall size={20} sw={2} />, onClick: () => s.openAddEvent() },
  ];
  const QuickCreateCard = (
    <div style={cardStyle}>
      <div style={sectionTitle}>Schnellanlage</div>
      <div style={{ display: 'grid', gridTemplateColumns: isPhone ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {quickCreate.map((q) => (
          <button key={q.label} className="dh-hover-border" onClick={q.onClick} style={{ display: 'flex', alignItems: 'center', gap: 13, background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 12, padding: '14px 16px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: `color-mix(in srgb, ${q.color} 16%, transparent)`, color: q.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{q.icon}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconPlus size={13} style={{ color: 'var(--text-4)' }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{q.label}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>{q.sub}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  // ── Admin: Verwaltung (Sprung in die jeweiligen Bereiche) ──
  const adminLinks: { label: string; sub: string; icon: React.ReactNode; screen: Parameters<typeof s.go>[0] }[] = [
    { label: 'Spieler', sub: `${s.players.length} in der Liste`, icon: <IconUserCheck size={20} />, screen: 'players' },
    { label: 'Benutzer & Rechte', sub: `${s.accounts.length} Konten`, icon: <IconUsers size={20} />, screen: 'users' },
    { label: 'Mannschaften', sub: `${dTeams.length} Kader`, icon: <IconShield size={20} />, screen: 'teams' },
    { label: 'Ligen & Pokale', sub: `${dLeagues.length} Wettbewerbe`, icon: <IconTrophy size={20} />, screen: 'leagues' },
    { label: 'Einstellungen', sub: 'Verein, Board-Konten & mehr', icon: <IconSettings size={20} />, screen: 'settings' },
  ];
  const AdminLinksCard = (
    <div style={cardStyle}>
      <div style={sectionTitle}>Verwaltung</div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {adminLinks.map((l) => (
          <button key={l.label} className="dh-row" onClick={() => s.go(l.screen)} style={{ display: 'flex', alignItems: 'center', gap: 13, width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderRadius: 10, padding: '11px 6px', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text)' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--btn)', border: '1px solid var(--border-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--text-2)' }}>{l.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{l.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 1 }}>{l.sub}</div>
            </div>
            <IconChevronRight size={18} style={{ flexShrink: 0, color: 'var(--text-4)' }} />
          </button>
        ))}
      </div>
    </div>
  );

  const UpcomingCard = (
    <div style={cardStyle}>
      <div style={sectionTitle}>{personalView ? 'Deine nächsten Begegnungen' : 'Nächste Begegnungen'}</div>
      {upcoming.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-4)', padding: '6px 4px' }}>Keine anstehenden Begegnungen.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {upcoming.map(({ team, fx }) => {
          const k = teamKind(team); const kc = TEAM_KINDS[k].color;
          const d = fx!.date ? new Date(fx!.date + 'T00:00') : null;
          return (
            <div key={team.id + fx!.fixtureId} className="dh-hover-border" style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '11px 12px', border: '1px solid var(--border-2)', borderRadius: 12, background: 'var(--btn)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 46, flexShrink: 0, borderRight: `2px solid ${kc}`, paddingRight: 11 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-4)', letterSpacing: '.06em' }}>{d ? MON3[d.getMonth()] : '—'}</span>
                <span style={{ fontFamily: 'var(--font-num)', fontSize: 20, fontWeight: 800, lineHeight: 1.05 }}>{d ? d.getDate() : '–'}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: kc, display: 'inline-flex', flexShrink: 0 }} title={TEAM_KINDS[k].label}><TeamKindIcon kind={k} size={12} /></span>
                  <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{team.name}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {fx!.ownIsHome ? 'gegen ' : 'bei '}{fx!.oppName}{fx!.date ? ' · ' + shortLong(fx!.date) : ''}{fx!.hasLineup ? ' · aufgestellt' : ''}
                </div>
              </div>
              {canManage && (
                <button onClick={() => s.openLineupAt(fx!.leagueIndex, fx!.fixtureId)} className="dh-btn" style={{ flexShrink: 0, background: fx!.hasLineup ? 'var(--btn)' : 'color-mix(in srgb, var(--accent) 14%, transparent)', border: `1px solid ${fx!.hasLineup ? 'var(--border-2)' : 'color-mix(in srgb, var(--accent) 40%, transparent)'}`, color: fx!.hasLineup ? 'var(--text-2)' : 'var(--accent)', padding: '8px 13px', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{fx!.hasLineup ? 'Aufstellung' : 'Aufstellen'}</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const ResultsCard = (
    <div style={cardStyle}>
      <div style={sectionTitle}>Letzte Ergebnisse</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {results.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-4)', padding: '8px 6px' }}>Noch keine Ergebnisse.</div>}
        {results.map((r, i) => {
          const barColor = r.outcome === 'S' ? '#19A463' : r.outcome === 'U' ? '#F2B829' : '#E0594B';
          const scoreColor = r.outcome === 'S' ? 'var(--success)' : r.outcome === 'U' ? '#F2B829' : 'var(--danger-soft)';
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 6px', borderBottom: '1px solid var(--hairline)' }}>
              <div style={{ width: 5, height: 30, borderRadius: 3, background: barColor }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{r.opp}</div>
                <div style={{ fontSize: 12, color: 'var(--text-4)' }}>{r.leagueName}</div>
              </div>
              <span style={{ fontFamily: 'var(--font-num)', fontSize: 18, fontWeight: 800, color: scoreColor }}>{r.hs}:{r.as}</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: scoreColor, width: 24, textAlign: 'center' }}>{r.outcome}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const MyStatsCard = myAgg && myPlayer ? (
    <div style={cardStyle}>
      <div style={sectionTitle}>Meine Statistik · {myPlayer.name}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
        <span style={{ fontFamily: 'var(--font-num)', fontSize: 38, fontWeight: 800, letterSpacing: '-.02em', color: 'var(--text)' }}>{myAgg.avg ? myAgg.avg.toFixed(1) : '–'}</span>
        <span style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 700 }}>Ø 3-DART</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
        {[
          { v: String(myAgg.games), l: 'Spiele' },
          { v: `${myAgg.wins}–${myAgg.losses}`, l: 'S–N' },
          { v: String(myAgg.c180), l: '180er' },
          { v: String(myAgg.high || '–'), l: 'High Finish' },
          { v: String(myAgg.c140), l: '140+' },
          { v: String(myAgg.c100), l: '100+' },
        ].map((b) => (
          <div key={b.l} style={{ background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontFamily: 'var(--font-num)', fontSize: 18, fontWeight: 800 }}>{b.v}</div>
            <div style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 600, marginTop: 2 }}>{b.l}</div>
          </div>
        ))}
      </div>
      {myAgg.recent.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {myAgg.recent.slice(0, 4).map((g, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', borderBottom: '1px solid var(--hairline)' }}>
              <span style={{ width: 5, height: 26, borderRadius: 3, background: g.won ? '#19A463' : '#E0594B', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.opp || '—'}</span>
              <span style={{ fontFamily: 'var(--font-num)', fontSize: 13, color: 'var(--text-3)' }}>{g.avg ? g.avg.toFixed(1) : ''}</span>
              <span style={{ fontFamily: 'var(--font-num)', fontSize: 13, fontWeight: 800, color: g.won ? 'var(--success)' : 'var(--danger-soft)', width: 44, textAlign: 'right' }}>{g.score}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  ) : null;

  const TablesCard = leaguesView.length > 0 ? (
    <div style={cardStyle}>
      <div style={sectionTitle}>Tabellen je Wettbewerb</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {leaguesView.map((lg) => {
          const k = teamKind(lg); const kc = TEAM_KINDS[k].color;
          const rows = computeStandings(lg).slice(0, 8);
          return (
            <div key={lg.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                <span style={{ color: kc, display: 'inline-flex' }} title={TEAM_KINDS[k].label}><TeamKindIcon kind={k} size={13} /></span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{lg.name}</span>
                {lg.season && <span style={{ fontSize: 11, color: 'var(--text-4)' }}>· {lg.season}</span>}
              </div>
              {rows.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-4)', padding: '4px 2px' }}>Noch keine Mannschaften.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {rows.map((row, idx) => (
                    <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 6px', borderRadius: 7, background: row.own ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent' }}>
                      <span style={{ fontFamily: 'var(--font-num)', fontSize: 12, fontWeight: 800, color: 'var(--text-4)', width: 18, textAlign: 'right' }}>{idx + 1}</span>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: row.own ? 700 : 500, color: row.own ? 'var(--text)' : 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-4)', width: 30, textAlign: 'center' }}>{row.sp}</span>
                      <span style={{ fontFamily: 'var(--font-num)', fontSize: 13, fontWeight: 800, width: 28, textAlign: 'right' }}>{row.pts}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <button className="dh-hover-border" onClick={() => s.go('leagues')} style={{ width: '100%', marginTop: 14, background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text-2)', padding: 11, borderRadius: 11, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Zu den Ligen →</button>
    </div>
  ) : null;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1240, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 26, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }}>{longDate(now).toUpperCase()}</div>
            <span style={{ fontSize: 12, color: 'var(--border-strong)' }}>·</span>
            <LiveClock style={{ fontFamily: 'var(--font-num)', fontSize: 12, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '.05em' }} />
          </div>
          <h1 style={{ margin: 0, fontSize: 27, fontWeight: 800, letterSpacing: '-.02em' }}>{greeting}</h1>
          <div style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600, marginTop: 4 }}>{subtitle}</div>
        </div>
        {p.play && (
          <button className="dh-primary" onClick={() => s.goSetup()} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--accent)', border: 'none', color: 'var(--accent-fg)', padding: '13px 22px', borderRadius: 13, fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 8px 24px color-mix(in srgb, var(--accent) 28%, transparent)', whiteSpace: 'nowrap' }}>
            <IconTarget size={18} sw={2.2} />
            Darts Counter
          </button>
        )}
      </div>

      {/* TERMINE */}
      {dEvents.some((e) => e.scope === scope) && (
        <div style={{ marginBottom: 18, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-3)' }}>
              <IconCalendarSmall size={18} sw={2} />
              <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>Termine</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', gap: 2, background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 9, padding: 2 }}>
                {([['week', 'Woche'], ['month', 'Monat'], ['all', 'Alle']] as const).map(([key, label]) => {
                  const on = range === key;
                  return (
                    <button key={key} onClick={() => s.setSetting('dashRange', key)} style={{ background: on ? accent : 'transparent', color: on ? 'var(--accent-fg)' : 'var(--text-3)', fontWeight: on ? 800 : 600, border: 'none', padding: '6px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>{label}</button>
                  );
                })}
              </div>
              <button className="dh-hover-border" onClick={() => s.go('calendar')} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text-2)', padding: '9px 15px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Kalender öffnen →</button>
            </div>
          </div>
          {events.length === 0 && <div style={{ padding: 22, textAlign: 'center', fontSize: 13, color: 'var(--text-4)' }}>Keine Termine in diesem Zeitraum.</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '8px 18px' }}>
            {events.map((ev) => (
              <div key={ev.id} className="dh-hover-border dh-row" onClick={() => s.openEditEvent(ev.id)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 10px', borderRadius: 12, cursor: 'pointer', border: '1px solid transparent' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 50, flexShrink: 0, borderRight: `2px solid ${ev.color}`, paddingRight: 12 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-4)', letterSpacing: '.06em' }}>{ev.mon}</span>
                  <span style={{ fontFamily: 'var(--font-num)', fontSize: 22, fontWeight: 800, lineHeight: 1.05, letterSpacing: '-.02em' }}>{ev.day}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: ev.color }}>{ev.rel}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={ev.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d={ev.icon} /></svg>
                    <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title}</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>{ev.meta}</div>
                </div>
                <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 800, color: ev.color, background: ev.typeBg, padding: '4px 9px', borderRadius: 6, letterSpacing: '.03em', whiteSpace: 'nowrap' }}>{ev.typeLabel}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vereins-Kennzahlen nur für Admin */}
      {isAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginBottom: 18 }}>
          {statCards.map((c) => (
            <button key={c.label} className="dh-hover-border" onClick={() => s.go(c.screen)} style={{ textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 20px', cursor: 'pointer', fontFamily: 'inherit' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>{c.label}</span>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: c.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{c.icon}</div>
              </div>
              <div style={{ fontFamily: 'var(--font-num)', fontSize: 30, fontWeight: 800, marginTop: 12, letterSpacing: '-.02em', color: 'var(--text)' }}>{c.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 600, marginTop: 3 }}>{c.delta}</div>
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isPhone ? 'minmax(0, 1fr)' : '1.6fr 1fr', gap: 18 }}>
        {isAdmin ? (
          <>
            {/* Admin: Verwaltungs-Fokus statt Spiel-/Tabellen-Auswertung */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>{QuickCreateCard}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>{AdminLinksCard}</div>
          </>
        ) : (
          <>
            {/* linke Spalte */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {UpcomingCard}
              {ResultsCard}
            </div>
            {/* rechte Spalte */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {MyStatsCard}
              {TablesCard}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Lokales Dashboard (ohne Vereins-Details) ──
function LocalDashboard() {
  const s = useStore();
  const now = new Date();
  const accent = s.settings.accent;
  const isPhone = useIsPhone();
  // Auf die aktive Saison eingrenzen (lokal i. d. R. genau eine).
  const lMatches = inSeason(s.matches, s.activeSeasonId);
  const lEvents = inSeason(s.events, s.activeSeasonId);

  // Termine: nur die nächsten vier anstehenden (lokal)
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const events = lEvents
    .filter((e) => e.scope === 'local')
    .map((e) => ({ e, dt: new Date(e.date + 'T' + (e.time || '00:00')) }))
    .filter((x) => new Date(x.e.date + 'T00:00') >= today)
    .sort((a, b) => +a.dt - +b.dt)
    .slice(0, 4)
    .map(({ e, dt }) => {
      const t = EVENT_TYPES[e.type] || { label: e.type, color: 'var(--text-3)', icon: 'M12 3a9 9 0 100 18 9 9 0 000-18z' };
      const dayDiff = Math.round((+new Date(e.date + 'T00:00') - +today) / 86400000);
      const rel = dayDiff === 0 ? 'Heute' : dayDiff === 1 ? 'Morgen' : WD[dt.getDay()];
      return {
        id: e.id, day: String(dt.getDate()), mon: MON3[dt.getMonth()], rel, title: e.title,
        color: t.color, typeLabel: t.label, icon: t.icon,
        typeBg: `color-mix(in srgb, ${t.color} 16%, transparent)`,
        meta: (e.time ? e.time + ' Uhr' : '') + (e.time && e.loc ? ' · ' : '') + (e.loc || ''),
      };
    });

  // meistgespielte Trainingsspiele (mit Fallback, falls noch nichts gespielt)
  const playSorted = (Object.entries(s.trainingPlays) as [string, number][]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const FALLBACK = ['atc', 'cricket', 'bobs27', 'doubles'];
  const topTrainIds = [...playSorted.map(([id]) => id), ...FALLBACK.filter((id) => !playSorted.some(([p]) => p === id))];
  const quickTrain = topTrainIds.slice(0, 2).map((id) => TRAIN_MODES.find((m) => m.id === id)).filter((m): m is TrainMode => !!m);
  const trainStats = playSorted.slice(0, 5).map(([id, n]) => ({ mode: TRAIN_MODES.find((m) => m.id === id), n })).filter((x): x is { mode: TrainMode; n: number } => !!x.mode);

  // zuletzt gespielt + Bestenliste
  const recent = [...lMatches].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  const top = s.players.map((pl) => ({ pl, agg: aggregateFor(pl, lMatches) })).sort((a, b) => b.agg.avg - a.agg.avg).slice(0, 5);

  const startX01 = (bestOf: number) => s.quickStart({ startScore: 501, doubleOut: true, outMode: 'double', doubleIn: false, unit: 'legs', bestOf });
  const quickItems: { key: string; color: string; iconPath: string | null; title: string; sub: string; onClick: () => void }[] = [
    { key: 'x01-3', color: accent, iconPath: null, title: '501 · Double Out · Best of 3', sub: 'X01 Match', onClick: () => startX01(3) },
    { key: 'x01-5', color: accent, iconPath: null, title: '501 · Double Out · Best of 5', sub: 'X01 Match', onClick: () => startX01(5) },
    ...quickTrain.map((m) => ({ key: m.id, color: m.color, iconPath: m.icon, title: m.name, sub: 'Training', onClick: () => s.openTrainSetup(m.id) })),
  ];

  const cardStyle: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 22px' };
  const sectionTitle: React.CSSProperties = { fontSize: 12, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 };

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1240, margin: '0 auto' }}>
      {/* Kopf */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 26, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }}>{longDate(now).toUpperCase()}</div>
            <span style={{ fontSize: 12, color: 'var(--border-strong)' }}>·</span>
            <LiveClock style={{ fontFamily: 'var(--font-num)', fontSize: 12, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '.05em' }} />
          </div>
          <h1 style={{ margin: 0, fontSize: 27, fontWeight: 800, letterSpacing: '-.02em' }}>{greetFn(now)}</h1>
        </div>
        <button className="dh-primary" onClick={() => s.goSetup()} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--accent)', border: 'none', color: 'var(--accent-fg)', padding: '13px 22px', borderRadius: 13, fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 8px 24px color-mix(in srgb, var(--accent) 28%, transparent)', whiteSpace: 'nowrap' }}>
          <IconTarget size={18} sw={2.2} />
          Darts Counter
        </button>
      </div>

      {/* Schnellstart */}
      <div style={{ ...cardStyle, marginBottom: 18 }}>
        <div style={sectionTitle}>Schnellstart</div>
        <div style={{ display: 'grid', gridTemplateColumns: isPhone ? '1fr' : 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {quickItems.map((it) => (
            <button key={it.key} className="dh-hover-border" onClick={it.onClick} style={{ display: 'flex', alignItems: 'center', gap: 13, background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 12, padding: '14px 16px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: `color-mix(in srgb, ${it.color} 16%, transparent)`, color: it.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {it.iconPath
                  ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={it.iconPath} /></svg>
                  : <IconTarget size={20} sw={2.2} />}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>{it.sub}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isPhone ? 'minmax(0, 1fr)' : '1.4fr 1fr', gap: 18 }}>
        {/* linke Spalte */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Termine */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-3)' }}>
                <IconCalendarSmall size={18} sw={2} />
                <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>Nächste Termine</span>
              </div>
              <button className="dh-hover-border" onClick={() => s.go('calendar')} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text-2)', padding: '8px 13px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Kalender öffnen →</button>
            </div>
            {events.length === 0 && <div style={{ padding: '14px 6px', textAlign: 'center', fontSize: 13, color: 'var(--text-4)' }}>Keine anstehenden Termine.</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {events.map((ev) => (
                <div key={ev.id} className="dh-hover-border dh-row" onClick={() => s.openEditEvent(ev.id)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 10px', borderRadius: 12, cursor: 'pointer', border: '1px solid transparent' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 50, flexShrink: 0, borderRight: `2px solid ${ev.color}`, paddingRight: 12 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-4)', letterSpacing: '.06em' }}>{ev.mon}</span>
                    <span style={{ fontFamily: 'var(--font-num)', fontSize: 22, fontWeight: 800, lineHeight: 1.05, letterSpacing: '-.02em' }}>{ev.day}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: ev.color }}>{ev.rel}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={ev.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d={ev.icon} /></svg>
                      <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title}</div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>{ev.meta}</div>
                  </div>
                  <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 800, color: ev.color, background: ev.typeBg, padding: '4px 9px', borderRadius: 6, letterSpacing: '.03em', whiteSpace: 'nowrap' }}>{ev.typeLabel}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Zuletzt gespielt */}
          <div style={cardStyle}>
            <div style={sectionTitle}>Zuletzt gespielt</div>
            {recent.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-4)', padding: '8px 6px' }}>Noch keine Spiele gespielt.</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {recent.map((m) => {
                const dateStr = new Date(m.date).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
                return (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 6px', borderBottom: '1px solid var(--hairline)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.winnerName || '—'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-4)' }}>{m.gameLabel} · {dateStr}</div>
                    </div>
                    <span style={{ fontFamily: 'var(--font-num)', fontSize: 17, fontWeight: 800, color: accent }}>{m.scoreLine}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* rechte Spalte */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Trainings-Statistik */}
          <div style={cardStyle}>
            <div style={sectionTitle}>Trainings-Statistik</div>
            {trainStats.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-4)', padding: '4px 6px 12px' }}>Noch keine Trainingsspiele gespielt.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {trainStats.map(({ mode, n }) => (
                  <div key={mode.id} className="dh-row" onClick={() => s.openTrainSetup(mode.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 6px', cursor: 'pointer', borderRadius: 9 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: `color-mix(in srgb, ${mode.color} 16%, transparent)`, color: mode.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={mode.icon} /></svg>
                    </div>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{mode.name}</span>
                    <span style={{ fontFamily: 'var(--font-num)', fontSize: 14, fontWeight: 800, color: 'var(--text-3)' }}>×{n}</span>
                  </div>
                ))}
              </div>
            )}
            <button className="dh-hover-border" onClick={() => s.go('training')} style={{ width: '100%', marginTop: 12, background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text-2)', padding: 11, borderRadius: 11, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Alle Trainingsspiele →</button>
          </div>

          {/* Spieler-Bestenliste */}
          <div style={cardStyle}>
            <div style={sectionTitle}>Spieler-Bestenliste · Ø 3-Dart</div>
            {top.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-4)', padding: '8px 6px' }}>Keine Spieler angelegt.</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {top.map((row, idx) => {
                return (
                  <div key={row.pl.id} className="dh-row" onClick={() => s.openPlayer(row.pl.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 6px', cursor: 'pointer', borderRadius: 9 }}>
                    <span style={{ fontFamily: 'var(--font-num)', fontSize: 13, fontWeight: 800, color: idx === 0 && row.agg.avg ? '#F2B829' : 'var(--text-4)', width: 18 }}>{idx + 1}</span>
                    <Avatar photo={row.pl.photo} short={row.pl.short} avi={row.pl.avi} size={32} />
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{row.pl.name}</span>
                    <span style={{ fontFamily: 'var(--font-num)', fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{row.agg.avg ? row.agg.avg.toFixed(1) : '–'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
