import { useStore } from '../store/useStore';
import { EVENT_TYPES, TRAIN_MODES, avatar, type TrainMode } from '../data/constants';
import {
  dashboardMetrics, nextMatchDay, recentResults, aggregateFor, perm,
} from '../store/selectors';
import { longDate, timeNow, greeting as greetFn, initials } from '../lib/format';
import { IconTarget, IconCalendarSmall } from '../lib/icons';
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
  const isVerein = s.settings.appMode === 'verein';
  const p = perm(s.settings, s.accounts, s.session);
  const accent = s.settings.accent;
  const range = s.settings.dashRange || 'month';
  const isPhone = useIsPhone();

  // ── Termine ──
  const scope = isVerein ? 'verein' : 'local';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let limit: Date | null = null;
  if (range === 'week') { const dow = (today.getDay() + 6) % 7; limit = new Date(today); limit.setDate(today.getDate() + (6 - dow)); limit.setHours(23, 59, 59, 999); }
  else if (range === 'month') { limit = new Date(today.getFullYear(), today.getMonth() + 1, 0); limit.setHours(23, 59, 59, 999); }

  const events = s.events
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

  const metrics = dashboardMetrics(s.players, s.teams, s.leagues, s.matches);
  const next = nextMatchDay(s.leagues);
  const results = recentResults(s.leagues, 4);
  const top = s.players
    .map((pl) => ({ pl, agg: aggregateFor(pl.name, s.matches) }))
    .sort((a, b) => b.agg.avg - a.agg.avg)
    .slice(0, 5);

  const greeting = isVerein ? `${greetFn(now)}, Verein` : greetFn(now);

  const statCards = [
    { label: 'Spieler', value: String(metrics.playerCount), delta: 'in der Spielerliste', icon: '👥', iconBg: 'rgba(59,158,255,.12)' },
    { label: 'Mannschaften', value: String(metrics.teamCount), delta: metrics.teamCount === 1 ? '1 Kader' : metrics.teamCount + ' Kader', icon: '🛡', iconBg: 'rgba(25,164,99,.12)' },
    { label: 'Team Ø 3-Dart', value: metrics.teamAvg ? metrics.teamAvg.toFixed(1) : '–', delta: 'Noch keine Spiele', icon: '🎯', iconBg: 'rgba(242,184,41,.12)' },
    { label: 'Tabellenplatz', value: metrics.tablePos ? metrics.tablePos + '.' : '–', delta: metrics.leagueName || 'Keine Liga', icon: '🏆', iconBg: 'rgba(224,89,75,.12)' },
  ];

  const badgeBg = (own: boolean) => own ? 'linear-gradient(135deg,#19A463,#0f6b40)' : 'var(--border)';
  const badgeFg = (own: boolean) => own ? '#fff' : 'var(--text-2)';

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1240, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 26, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }}>{longDate(now).toUpperCase()}</div>
            <span style={{ fontSize: 12, color: 'var(--border-strong)' }}>·</span>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '.05em' }}>{timeNow(now)}</div>
          </div>
          <h1 style={{ margin: 0, fontSize: 27, fontWeight: 800, letterSpacing: '-.02em' }}>{greeting}</h1>
        </div>
        {p.play && (
          <button className="dh-primary" onClick={() => s.goSetup()} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--accent)', border: 'none', color: 'var(--accent-fg)', padding: '13px 22px', borderRadius: 13, fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 8px 24px color-mix(in srgb, var(--accent) 28%, transparent)', whiteSpace: 'nowrap' }}>
            <IconTarget size={18} sw={2.2} />
            Darts Counter
          </button>
        )}
      </div>

      {/* TERMINE */}
      {s.events.some((e) => e.scope === scope) && (
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
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 800, lineHeight: 1.05, letterSpacing: '-.02em' }}>{ev.day}</span>
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

      {/* stat cards */}
      {isVerein && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginBottom: 18 }}>
          {statCards.map((c) => (
            <div key={c.label} className="dh-hover-border" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>{c.label}</span>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: c.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{c.icon}</div>
              </div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 30, fontWeight: 800, marginTop: 12, letterSpacing: '-.02em' }}>{c.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, marginTop: 3 }}>{c.delta}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isPhone ? 'minmax(0, 1fr)' : '1.6fr 1fr', gap: 18 }}>
        {/* left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {next && (
            <div style={{ background: 'linear-gradient(135deg,#13241b,var(--surface) 60%)', border: '1px solid #234032', borderRadius: 16, padding: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>Nächster Spieltag</span>
                <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>{new Date(next.date + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                  <div style={{ width: 54, height: 54, borderRadius: 14, background: badgeBg(next.home.own), color: badgeFg(next.home.own), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18 }}>{initials(next.home.name).slice(0, 3)}</div>
                  <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{next.home.name}</span>
                </div>
                <div style={{ textAlign: 'center', padding: '0 18px' }}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: 'var(--text-4)', fontWeight: 700 }}>{next.ownIsHome ? 'Heim' : 'Auswärts'}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-4)', margin: '2px 0' }}>VS</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{next.leagueName}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                  <div style={{ width: 54, height: 54, borderRadius: 14, background: badgeBg(next.away.own), color: badgeFg(next.away.own), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18 }}>{initials(next.away.name).slice(0, 3)}</div>
                  <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{next.away.name}</span>
                </div>
              </div>
              <button className="dh-btn" onClick={() => s.go('leagues')} style={{ width: '100%', marginTop: 20, background: 'color-mix(in srgb, var(--accent) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)', color: 'var(--accent)', padding: 11, borderRadius: 11, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Zur Liga →</button>
            </div>
          )}

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 22px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>Letzte Ergebnisse</div>
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
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 18, fontWeight: 800, color: scoreColor }}>{r.hs}:{r.as}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: scoreColor, width: 24, textAlign: 'center' }}>{r.outcome}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 22px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>Top-Spieler · Ø 3-Dart</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {top.map((row, idx) => {
                const a = avatar(row.pl.avi);
                return (
                  <div key={row.pl.id} className="dh-row" onClick={() => s.openPlayer(row.pl.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 6px', cursor: 'pointer', borderRadius: 9 }}>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 800, color: idx === 0 && row.agg.avg ? '#F2B829' : 'var(--text-4)', width: 18 }}>{idx + 1}</span>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: a.bg, color: a.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 }}>{row.pl.short}</div>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{row.pl.name}</span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{row.agg.avg ? row.agg.avg.toFixed(1) : '–'}</span>
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

// ── Lokales Dashboard (ohne Vereins-Details) ──
function LocalDashboard() {
  const s = useStore();
  const now = new Date();
  const accent = s.settings.accent;
  const isPhone = useIsPhone();

  // Termine: nur die nächsten vier anstehenden (lokal)
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const events = s.events
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
  const recent = [...s.matches].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  const top = s.players.map((pl) => ({ pl, agg: aggregateFor(pl.name, s.matches) })).sort((a, b) => b.agg.avg - a.agg.avg).slice(0, 5);

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
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '.05em' }}>{timeNow(now)}</div>
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
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 800, lineHeight: 1.05, letterSpacing: '-.02em' }}>{ev.day}</span>
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
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 17, fontWeight: 800, color: accent }}>{m.scoreLine}</span>
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
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 800, color: 'var(--text-3)' }}>×{n}</span>
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
                const a = avatar(row.pl.avi);
                return (
                  <div key={row.pl.id} className="dh-row" onClick={() => s.openPlayer(row.pl.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 6px', cursor: 'pointer', borderRadius: 9 }}>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 800, color: idx === 0 && row.agg.avg ? '#F2B829' : 'var(--text-4)', width: 18 }}>{idx + 1}</span>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: a.bg, color: a.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 }}>{row.pl.short}</div>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{row.pl.name}</span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{row.agg.avg ? row.agg.avg.toFixed(1) : '–'}</span>
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
