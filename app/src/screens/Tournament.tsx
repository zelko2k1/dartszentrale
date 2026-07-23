import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import {
  standings, highlights, assignBoards, tournamentProgress, participantById,
} from '../store/tournament';
import type { Tournament as TournamentT, TournamentMatch } from '../data/types';
import { useIsPhone } from '../lib/useIsPhone';
import { useT, type Dict } from '../i18n';

const ACCENT = '#F2B829';

export function Tournament() {
  const activeId = useStore((s) => s.activeTournamentId);
  const t = useStore((s) => s.tournaments.find((x) => x.id === activeId));
  if (!t) return <TournamentList />;
  return <TournamentDashboard t={t} />;
}

function BackToTraining() {
  const go = useStore((s) => s.go);
  const tr = useT();
  return (
    <button onClick={() => go('training')} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--surface-3)', border: '1px solid var(--border-2)', color: 'var(--text-2)', padding: '8px 13px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 18 }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
      {tr.nav.training}
    </button>
  );
}

function TournamentList() {
  const s = useStore();
  const tr = useT();
  const t = tr.tournament;
  const list = [...s.tournaments].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return (
    <div style={{ padding: '28px 32px', maxWidth: 900, margin: '0 auto' }}>
      <BackToTraining />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 27, fontWeight: 800, letterSpacing: '-.02em' }}>{t.listTitle}</h1>
        <button onClick={() => s.openTournamentSetup()} style={{ display: 'flex', alignItems: 'center', gap: 8, background: ACCENT, border: 'none', color: '#06160d', padding: '11px 18px', borderRadius: 11, fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          {t.newTournament}
        </button>
      </div>
      {list.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-4)', fontSize: 15 }}>{t.empty}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {list.map((tt) => {
            const pr = tournamentProgress(tt);
            return (
              <div key={tt.id} className="dh-hover-border" onClick={() => s.openTournament(tt.id)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, cursor: 'pointer', position: 'relative' }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{tt.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 4 }}>{tt.participants.length} · {t.progress(pr.done, pr.total)}</div>
                <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, color: tt.status === 'done' ? ACCENT : 'var(--text-3)' }}>
                  {tt.status === 'done' ? t.doneTitle : t.statusLive}
                </div>
                <button onClick={(e) => { e.stopPropagation(); if (confirm(t.deleteConfirm)) s.deleteTournament(tt.id); }} title={t.delete} style={{ position: 'absolute', top: 12, right: 12, width: 26, height: 26, borderRadius: 7, background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text-4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function statusChip(m: TournamentMatch, tr: Dict) {
  const t = tr.tournament;
  if (m.status === 'done') return { label: t.statusDone, color: 'var(--text-4)' };
  if (m.status === 'live') return { label: `${t.statusLive} · ${t.board(m.board || 0)}`, color: '#19A463' };
  return { label: t.statusPending, color: 'var(--text-4)' };
}

function TournamentDashboard({ t }: { t: TournamentT }) {
  const s = useStore();
  const tr = useT();
  const isPhone = useIsPhone();
  // Vereinsmodus: solange das Turnier läuft, regelmäßig frisch laden, damit Ergebnisse von den Board-PCs
  // zuverlässig ankommen (Fallback, falls die Realtime-Push-Aktualisierung mal nicht durchgreift).
  const reload = s.reloadFromProvider;
  const appMode = s.settings.appMode;
  const running = t.status === 'running';
  useEffect(() => {
    if (appMode !== 'verein' || !running) return;
    const id = setInterval(() => reload(), 4000);
    return () => clearInterval(id);
  }, [appMode, running, reload]);
  const tt = tr.tournament;
  const table = standings(t);
  const hls = highlights(t).slice().reverse();
  const pr = tournamentProgress(t);
  const nowPlayable = new Set(assignBoards(t).map((a) => a.matchId));
  const champion = t.status === 'done' && table.length ? table[0] : null;
  const nm = (id: string) => participantById(t, id)?.name || '?';

  // Spielplan nach Runden gruppieren
  const rounds: Record<number, TournamentMatch[]> = {};
  for (const m of t.matches) (rounds[m.round] = rounds[m.round] || []).push(m);
  const roundNums = Object.keys(rounds).map(Number).sort((a, b) => a - b);

  const th: React.CSSProperties = { fontSize: 11, color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', padding: '8px 6px', textAlign: 'center' };
  const td: React.CSSProperties = { fontSize: 14, padding: '9px 6px', textAlign: 'center', fontFamily: 'var(--font-num)', fontWeight: 700 };

  return (
    <div style={{ padding: isPhone ? '18px 14px' : '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <BackToTraining />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }}>{tt.tileName}</div>
          <h1 style={{ margin: '2px 0 0', fontSize: 26, fontWeight: 800, letterSpacing: '-.02em' }}>{t.name}</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-num)' }}>{tt.progress(pr.done, pr.total)}</span>
          <span style={{ fontSize: 12, color: 'var(--text-4)' }}>· {t.config.startScore} · {tt.bestOfValue(t.config.bestOf)} · {t.config.outMode === 'single' ? tt.outSingle : t.config.outMode === 'master' ? tt.outMaster : tt.outDouble}</span>
          <button onClick={() => { if (confirm(tt.deleteConfirm)) { s.deleteTournament(t.id); s.go('training'); } }} title={tt.delete} style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text-4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
          </button>
        </div>
      </div>

      {champion && (
        <div style={{ background: `color-mix(in srgb, ${ACCENT} 14%, transparent)`, border: `1px solid color-mix(in srgb, ${ACCENT} 45%, transparent)`, borderRadius: 14, padding: '16px 20px', marginBottom: 18, fontSize: 20, fontWeight: 800 }}>{tt.champion(champion.name)}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isPhone ? '1fr' : '1.15fr 1fr', gap: 18, alignItems: 'start' }}>
        {/* Spielplan */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '10px 18px 18px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', padding: '14px 0 6px' }}>{tt.schedule}</div>
          {roundNums.map((rn) => (
            <div key={rn} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 700, margin: '10px 0 6px' }}>{tt.round(rn)}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {rounds[rn].map((m) => {
                  const chip = statusChip(m, tr);
                  const done = m.status === 'done' && m.result;
                  const homeWin = done && m.result!.winnerId === m.homeId;
                  const awayWin = done && m.result!.winnerId === m.awayId;
                  const canStart = m.status === 'pending' && nowPlayable.has(m.id);
                  return (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'var(--btn)', border: `1px solid ${canStart ? `color-mix(in srgb, ${ACCENT} 45%, transparent)` : 'var(--border-2)'}`, borderRadius: 11 }}>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                        <span style={{ fontWeight: homeWin ? 800 : 600, color: awayWin ? 'var(--text-4)' : 'var(--text)' }}>{nm(m.homeId)}</span>
                        <span style={{ color: 'var(--text-4)', fontSize: 12 }}>{tt.vs}</span>
                        <span style={{ fontWeight: awayWin ? 800 : 600, color: homeWin ? 'var(--text-4)' : 'var(--text)' }}>{nm(m.awayId)}</span>
                      </div>
                      {done ? (
                        <span style={{ fontFamily: 'var(--font-num)', fontWeight: 800, fontSize: 15 }}>{m.result!.homeLegs}:{m.result!.awayLegs}</span>
                      ) : canStart ? (
                        <button onClick={() => s.startTournamentMatch(m.id, undefined, t.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: ACCENT, border: 'none', color: '#06160d', padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4" /></svg>
                          {tt.play}
                        </button>
                      ) : (
                        <span style={{ fontSize: 11, fontWeight: 700, color: chip.color }}>{chip.label}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Tabelle */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '10px 14px 16px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', padding: '14px 4px 6px' }}>{tt.standings}</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...th, textAlign: 'center', width: 26 }}>{tt.colRank}</th>
                    <th style={{ ...th, textAlign: 'left' }}>{tt.colPlayer}</th>
                    <th style={th}>{tt.colPlayed}</th>
                    <th style={th}>{tt.colWins}</th>
                    <th style={th}>{tt.colLosses}</th>
                    <th style={th}>{tt.colDiff}</th>
                    <th style={th}>{tt.colPoints}</th>
                  </tr>
                </thead>
                <tbody>
                  {table.map((r, i) => (
                    <tr key={r.id} style={{ borderTop: '1px solid var(--hairline)', background: i === 0 && pr.done > 0 ? `color-mix(in srgb, ${ACCENT} 10%, transparent)` : 'transparent' }}>
                      <td style={{ ...td, color: 'var(--text-4)' }}>{r.rank}</td>
                      <td style={{ ...td, textAlign: 'left', fontFamily: 'inherit' }}>{r.name}</td>
                      <td style={td}>{r.played}</td>
                      <td style={{ ...td, color: '#19A463' }}>{r.wins}</td>
                      <td style={{ ...td, color: 'var(--text-4)' }}>{r.losses}</td>
                      <td style={td}>{r.legDiff > 0 ? `+${r.legDiff}` : r.legDiff}</td>
                      <td style={{ ...td, fontWeight: 800 }}>{r.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pr.done === 0 && <div style={{ padding: '10px 4px 4px', fontSize: 12, color: 'var(--text-4)' }}>{tt.noResults}</div>}
          </div>

          {/* Highlights */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '10px 18px 16px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', padding: '14px 0 6px' }}>{tt.highlights}</div>
            {hls.length === 0 ? (
              <div style={{ padding: '6px 0', fontSize: 13, color: 'var(--text-4)' }}>{tt.noHighlights}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 260, overflowY: 'auto' }}>
                {hls.map((h, i) => {
                  const text = h.kind === '180' ? tt.hl180(h.name, h.value) : h.kind === 'shortLeg' ? tt.hlShortLeg(h.name, h.value) : tt.hlHighFinish(h.name, h.value);
                  const col = h.kind === '180' ? '#E0594B' : h.kind === 'highFinish' ? ACCENT : '#3B9EFF';
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: col, flexShrink: 0 }} />
                      <span style={{ color: 'var(--text-2)' }}>{text}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
