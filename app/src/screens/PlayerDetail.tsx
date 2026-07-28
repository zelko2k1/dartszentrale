import { useState, type CSSProperties } from 'react';
import { useStore } from '../store/useStore';
import { aggregateFor, inSeason, headToHead } from '../store/selectors';
import { Avatar } from '../components/Avatar';
import { IconBack } from '../lib/icons';
import { useIsPhone } from '../lib/useIsPhone';
import { useT } from '../i18n';

export function PlayerDetail() {
  const s = useStore();
  const tr = useT();
  const isPhone = useIsPhone(); // Hooks vor dem early return aufrufen (rules-of-hooks)
  const [seasonId, setSeasonId] = useState<string>('all'); // 'all' = alle Saisons (Lebenszeit)
  const [slOpen, setSlOpen] = useState(false);             // Short-Leg-Verteilung ein-/ausgeklappt
  const [startFilter, setStartFilter] = useState<'all' | number>('all'); // Spieltyp (Startpunktzahl)
  const [compFilter, setCompFilter] = useState<'all' | 'league' | 'free'>('all'); // Liga vs. frei
  const [formMetric, setFormMetric] = useState<'avg' | 'co' | 'f9' | 'c180'>('avg'); // Formkurve: Kennzahl
  const player = s.players.find((p) => p.id === s.selectedPlayerId) || s.players[0];
  if (!player) { return <div style={{ padding: '28px 32px' }}>{tr.playerDetail.noneSelected}</div>; }
  // Filter: Saison → Spieltyp (Startpunktzahl) → Wettbewerb (Liga = mit leagueId, Frei = ohne).
  let filtered = seasonId === 'all' ? s.matches : inSeason(s.matches, seasonId);
  if (startFilter !== 'all') filtered = filtered.filter((m) => m.startScore === startFilter);
  if (compFilter === 'league') filtered = filtered.filter((m) => !!m.leagueId);
  else if (compFilter === 'free') filtered = filtered.filter((m) => !m.leagueId);
  const agg = aggregateFor(player, filtered);
  const h2h = headToHead(agg.history);
  const selStyle: CSSProperties = { background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-md)', padding: '8px 12px', color: 'var(--text)', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', outline: 'none' };
  // Formkurve-Kennzahlen (nur die, die Werte tragen): Ø immer; CO/F9 nur wenn vorhanden; 180 immer.
  const metricOpts = ([['avg', 'Ø'], ['co', 'CO'], ['f9', 'F9'], ['c180', '180']] as const)
    .filter(([k]) => k === 'avg' || k === 'c180' || agg.history.some((g) => g[k as 'co' | 'f9'] != null));
  const metricVal = (g: typeof agg.history[number]) => formMetric === 'avg' ? g.avg : formMetric === 'c180' ? g.c180 : (g[formMetric] ?? 0);
  const rec = agg.records;
  const records: { value: string; label: string; color: string }[] = [
    { value: rec.bestAvg ? rec.bestAvg.toFixed(1) : '–', label: tr.playerDetail.recBestAvg, color: 'var(--cat-6)' },
    { value: rec.bestF9 != null ? rec.bestF9.toFixed(1) : '–', label: tr.playerDetail.recBestF9, color: 'var(--cat-3)' },
    { value: rec.bestCo != null ? rec.bestCo + '%' : '–', label: tr.playerDetail.recBestCo, color: 'var(--cat-1)' },
    { value: rec.best180 ? String(rec.best180) : '–', label: tr.playerDetail.recMost180, color: 'var(--cat-8)' },
    { value: rec.best100 ? String(rec.best100) : '–', label: tr.playerDetail.recMost100, color: 'var(--cat-6)' },
    { value: rec.longestWinStreak ? String(rec.longestWinStreak) : '–', label: tr.playerDetail.recWinStreak, color: 'var(--cat-4)' },
  ];

  const stats: { value: string; label: string; color: string }[] = [
    { value: agg.avg ? agg.avg.toFixed(1) : '–', label: tr.common.avg3, color: 'var(--cat-6)' },
    { value: agg.f9 != null ? agg.f9.toFixed(1) : '–', label: tr.playerDetail.first9, color: 'var(--cat-3)' },
    { value: agg.games ? Math.round(agg.wins / agg.games * 100) + '%' : '–', label: tr.playerDetail.winRate, color: 'var(--cat-4)' },
    { value: String(agg.games), label: tr.playerDetail.gamesX01, color: 'var(--text)' },
    { value: String(agg.wins), label: tr.common.wins, color: 'var(--cat-6)' },
    { value: String(agg.losses), label: tr.common.losses, color: 'var(--cat-8)' },
    { value: agg.co != null ? agg.co + '%' : '–', label: tr.playerDetail.checkoutRate, color: 'var(--cat-1)' },
    { value: agg.high ? String(agg.high) : '–', label: tr.dashboard.highFinish, color: 'var(--text)' },
    { value: agg.darts ? String(agg.darts) : '–', label: tr.playerDetail.dartsThrown, color: 'var(--text)' },
  ];
  const scoring: { value: string; label: string; color: string }[] = [
    { value: String(agg.c60), label: '60+', color: 'var(--cat-1)' },
    { value: String(agg.c100), label: '100+', color: 'var(--cat-6)' },
    { value: String(agg.c140), label: '140+', color: 'var(--cat-4)' },
    { value: String(agg.c180), label: '180', color: 'var(--cat-8)' },
  ];
  // Short Legs: niedrigster Wert (bestes) für die Übersicht + Verteilung nach Darts (9–19) für die Aufklappung.
  const slDarts = agg.shortLegDarts;
  const slMin = slDarts.length ? Math.min(...slDarts) : null;
  const slBuckets = new Map<number, number>();
  slDarts.forEach((d) => slBuckets.set(d, (slBuckets.get(d) || 0) + 1));
  const slSorted = [...slBuckets.entries()].sort((a, b) => b[0] - a[0]); // absteigend 19→9 (bestes zuletzt/rechts)

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1080, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <button onClick={() => s.go('players')} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
          <IconBack size={15} />
          {tr.playerDetail.allPlayers}
        </button>
        {/* Filter: Spieltyp (immer) · Wettbewerb + Saison nur im Vereinsmodus. */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <select value={String(startFilter)} onChange={(e) => setStartFilter(e.target.value === 'all' ? 'all' : +e.target.value)} title={tr.playerDetail.gameTypeFilter} style={selStyle}>
            <option value="all">{tr.playerDetail.gameTypeFilter}: {tr.playerDetail.filterAll}</option>
            {[301, 501, 701, 1001].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          {s.settings.appMode === 'verein' && (
            <select value={compFilter} onChange={(e) => setCompFilter(e.target.value as 'all' | 'league' | 'free')} title={tr.playerDetail.compFilter} style={selStyle}>
              <option value="all">{tr.playerDetail.compFilter}: {tr.playerDetail.filterAll}</option>
              <option value="league">{tr.playerDetail.compLeague}</option>
              <option value="free">{tr.playerDetail.compFree}</option>
            </select>
          )}
          {s.settings.appMode === 'verein' && s.seasons.length > 0 && (
            <select value={seasonId} onChange={(e) => setSeasonId(e.target.value)} title={tr.playerDetail.statsPeriod} style={selStyle}>
              <option value="all">{tr.playerDetail.allSeasons}</option>
              {s.seasons.map((se) => <option key={se.id} value={se.id}>{se.name}</option>)}
            </select>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
        <Avatar photo={player.photo} short={player.short} avi={player.avi} size={78} />
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-.02em' }}>{player.name}</h1>
          <div style={{ fontSize: 14, color: 'var(--text-3)', marginTop: 4 }}>{tr.playerDetail.profile} · {tr.common.gamesCount(agg.games)}</div>
        </div>
        <div style={{ textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 22px' }}>
          <div style={{ fontFamily: 'var(--font-num)', fontSize: 32, fontWeight: 800, color: 'var(--success)' }}>{agg.avg ? agg.avg.toFixed(1) : '–'}</div>
          <div style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 600, textTransform: 'uppercase' }}>{seasonId === 'all' ? tr.playerDetail.totalAvg : (s.seasons.find((x) => x.id === seasonId)?.name || tr.playerDetail.seasonAvg)}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        {stats.map((st2) => (
          <div key={st2.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 15 }}>
            <div style={{ fontFamily: 'var(--font-num)', fontSize: 22, fontWeight: 800, color: st2.color }}>{st2.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 600, marginTop: 4 }}>{st2.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '18px 20px', marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>{tr.playerDetail.scoringTitle}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
          {scoring.map((st2) => (
            <div key={st2.label} style={{ background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-md)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 13 }}>
              <span style={{ width: 8, height: 36, borderRadius: 'var(--radius-xs)', background: st2.color, flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-num)', fontSize: 24, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{st2.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 700, marginTop: 5 }}>{st2.label}</div>
              </div>
            </div>
          ))}
          {/* Short Legs: Übersicht = niedrigster Wert (bestes), Klick → Verteilung 9–19 */}
          <button onClick={() => setSlOpen((v) => !v)} title={tr.playerDetail.showSlDist}
            style={{ background: 'var(--btn)', border: `1px solid ${slOpen ? 'var(--cat-3)' : 'var(--border-2)'}`, borderRadius: 'var(--radius-md)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 13, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
            <span style={{ width: 8, height: 36, borderRadius: 'var(--radius-xs)', background: 'var(--cat-3)', flexShrink: 0 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-num)', fontSize: 24, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>
                {slMin != null ? slMin : '–'}
                {slMin != null && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', marginLeft: 4 }}>{tr.playerDetail.darts}</span>}
              </div>
              {/* Nur das BESTE Short Leg (Dartzahl) – keine Anzahl mehr (verwirrend). Die Verteilung darunter zeigt die Aufschlüsselung. */}
              <div style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 700, marginTop: 5 }}>
                {tr.playerDetail.bestShortLeg}
              </div>
            </div>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-4)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transform: slOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><path d="M6 9l6 6 6-6" /></svg>
          </button>
        </div>
        {slOpen && (
          <div style={{ marginTop: 16, borderTop: '1px solid var(--hairline)', paddingTop: 16 }}>
            {slSorted.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--text-4)', lineHeight: 1.5 }}>
                {agg.shortLegs ? tr.playerDetail.slNoDetail : tr.playerDetail.slNone}
                {tr.playerDetail.slFromNow}
              </div>
            ) : (
              <>
                <div style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 12 }}>{tr.playerDetail.slDistTitle}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {slSorted.map(([darts, cnt]) => {
                    const best = darts === slMin;
                    return (
                      <div key={darts} style={{ display: 'flex', alignItems: 'baseline', gap: 6, background: best ? 'color-mix(in srgb, var(--cat-3) 14%, transparent)' : 'var(--btn)', border: `1px solid ${best ? 'var(--cat-3)' : 'var(--border-2)'}`, borderRadius: 'var(--radius-md)', padding: '8px 12px' }}>
                        <span style={{ fontFamily: 'var(--font-num)', fontSize: 18, fontWeight: 800, color: best ? 'var(--cat-3)' : 'var(--text)' }}>{darts}</span>
                        <span style={{ fontSize: 10.5, color: 'var(--text-4)', fontWeight: 700 }}>{tr.playerDetail.darts}</span>
                        <span style={{ fontFamily: 'var(--font-num)', fontSize: 13, fontWeight: 800, color: 'var(--text-3)', marginLeft: 4 }}>{cnt}×</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '18px 20px', marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>{tr.playerDetail.recordsTitle}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          {records.map((r) => (
            <div key={r.label} style={{ background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-md)', padding: '14px 16px' }}>
              <div style={{ fontFamily: 'var(--font-num)', fontSize: 24, fontWeight: 800, color: r.color, lineHeight: 1 }}>{r.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 700, marginTop: 5 }}>{r.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isPhone ? 'minmax(0, 1fr)' : '1.4fr 1fr', gap: 18, alignItems: 'start' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>{tr.playerDetail.formTitle}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {metricOpts.map(([k, lbl]) => {
                const on = formMetric === k;
                return <button key={k} onClick={() => setFormMetric(k)} style={{ background: on ? 'var(--accent)' : 'var(--btn)', color: on ? 'var(--accent-fg)' : 'var(--text-3)', border: `1px solid ${on ? 'var(--accent)' : 'var(--border-2)'}`, borderRadius: 'var(--radius-sm)', padding: '4px 9px', fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-num)' }}>{lbl}</button>;
              })}
            </div>
          </div>
          {agg.history.length === 0 ? (
            <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-4)', fontSize: 13, border: '1px dashed var(--border-2)', borderRadius: 'var(--radius-md)' }}>{tr.playerDetail.nonePlayed}</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: agg.history.length > 14 ? 3 : 8, height: 140 }}>
              {agg.history.slice(-24).map((f, i, arr) => {
                const vals = arr.map(metricVal);
                const zoom = formMetric === 'avg' || formMetric === 'f9';
                const mn = zoom ? Math.min(...vals) - 4 : 0;
                const mx = Math.max(...vals, mn + 1);
                const v = metricVal(f);
                const h = Math.round(((v - mn) / (mx - mn || 1)) * 100);
                return (
                  <div key={i} title={`${v.toFixed(zoom ? 1 : 0)} · ${f.won ? tr.common.winLetter : tr.common.lossLetter} vs. ${f.opp}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, height: '100%', justifyContent: 'flex-end' }}>
                    {arr.length <= 14 && <span style={{ fontFamily: 'var(--font-num)', fontSize: 10, color: 'var(--text-4)', fontWeight: 700 }}>{v.toFixed(0)}</span>}
                    <div style={{ width: '100%', height: `${Math.max(h, 2)}%`, borderRadius: '4px 4px 0 0', background: i === arr.length - 1 ? s.settings.accent : (f.won ? 'linear-gradient(180deg,#2a6e4a,#1c4a32)' : 'linear-gradient(180deg,#6e2a2a,#4a1c1c)') }} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 22px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>{tr.playerDetail.recentGames}</div>
          {agg.recent.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-4)', padding: '8px 4px' }}>{tr.playerDetail.noRecent}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {agg.recent.map((g, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px', borderBottom: '1px solid var(--hairline)' }}>
                  <span style={{ width: 22, height: 22, borderRadius: 'var(--radius-xs)', background: g.won ? 'color-mix(in srgb, var(--success) 18%, transparent)' : 'color-mix(in srgb, var(--danger) 18%, transparent)', color: g.won ? 'var(--success)' : 'var(--danger-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>{g.won ? tr.common.winLetter : tr.common.lossLetter}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>vs. {g.opp}</span>
                  <span style={{ fontFamily: 'var(--font-num)', fontSize: 13, color: 'var(--text-3)' }}>Ø {g.avg ? g.avg.toFixed(1) : '–'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Kopf-an-Kopf: Bilanz gegen benannte Gegner (Gastspiele ohne Namen bleiben außen vor). */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '18px 20px', marginTop: 20 }}>
        <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>{tr.playerDetail.h2hTitle}</div>
        {h2h.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-4)', padding: '8px 4px' }}>{tr.playerDetail.h2hEmpty}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {h2h.slice(0, 10).map((r) => (
              <div key={r.opp} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px', borderBottom: '1px solid var(--hairline)' }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.opp}</span>
                <span style={{ fontFamily: 'var(--font-num)', fontSize: 13, fontWeight: 800 }}>
                  <span style={{ color: 'var(--success)' }}>{r.wins}</span>
                  <span style={{ color: 'var(--text-4)' }}>–</span>
                  <span style={{ color: 'var(--danger-soft)' }}>{r.losses}</span>
                </span>
                <span style={{ fontFamily: 'var(--font-num)', fontSize: 12, color: 'var(--text-3)', width: 66, textAlign: 'right' }}>Ø {r.avg ? r.avg.toFixed(1) : '–'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
