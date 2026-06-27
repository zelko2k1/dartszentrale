import { useStore } from '../store/useStore';
import { computeStandings, perm, inSeason } from '../store/selectors';
import { initials } from '../lib/format';
import { IconPlus, IconUsersSmall } from '../lib/icons';
import { useIsPhone } from '../lib/useIsPhone';

const HF_MIN = 100; // High Finish gilt erst ab 100 als Liga-Highlight

function fmtDate(iso: string): { day: string; mon: string } {
  if (!iso) return { day: '', mon: '' };
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(+d)) return { day: iso, mon: '' };
  const s = d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
  const parts = s.split(' ');
  return { day: parts[0] || '', mon: parts[1] || '' };
}

export function Leagues() {
  const s = useStore();
  const accent = s.settings.accent;
  const p = perm(s.settings, s.accounts, s.session);
  // Archivierte Saison (betrachtet ≠ aktiv) → nur Lesezugriff: Bearbeiten-Aktionen ausblenden.
  const readOnly = s.viewSeasonId != null && s.viewSeasonId !== s.activeSeasonId;
  const canEdit = p.manageLeagues && !readOnly;
  const leagues = inSeason(s.leagues, s.viewSeasonId);
  const isPhone = useIsPhone();
  const selIdx = Math.max(0, Math.min(leagues.length - 1, s.selectedLeague));
  const sel = leagues[selIdx] || null;
  const standings = sel ? computeStandings(sel) : [];
  const teamNameById = (id: string) => { const t = sel?.teams.find((x) => x.id === id); return t ? t.name : '?'; };
  const fxSorted = sel ? sel.fixtures.slice().sort((a, b) => a.date.localeCompare(b.date)) : [];

  // Liga-Highlights je Begegnung: 180er + Short Legs (≤19) + High Finish (≥100) der EIGENEN Spieler aus den
  // verknüpften Board-Spielen. Match.perPlayer[0] ist stets die eigene Seite (Auto-Eintrag); nach Spielername.
  const highlightsFor = (fixtureId: string) => {
    const acc: Record<string, { c180: number; shortLegs: number; highFinish: number }> = {};
    for (const m of inSeason(s.matches, s.viewSeasonId)) {
      if (m.fixtureId !== fixtureId) continue;
      const own = m.perPlayer?.[0];
      if (!own) continue;
      const e = (acc[own.name] = acc[own.name] || { c180: 0, shortLegs: 0, highFinish: 0 });
      e.c180 += own.c180 || 0;
      e.shortLegs += own.shortLegs || 0;
      e.highFinish = Math.max(e.highFinish, own.highFinish || 0);
    }
    return Object.entries(acc)
      .map(([name, v]) => ({ name, ...v }))
      .filter((v) => v.c180 > 0 || v.shortLegs > 0 || v.highFinish >= HF_MIN)
      .sort((a, b) => (b.c180 + b.shortLegs) - (a.c180 + a.shortLegs));
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, marginBottom: 22 }}>
        <h1 style={{ margin: 0, fontSize: 27, fontWeight: 800, letterSpacing: '-.02em' }}>Ligen</h1>
        {canEdit && (
          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            <button className="dh-btn" onClick={() => s.openImport()} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', padding: '11px 16px', borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
              Import
            </button>
            <button className="dh-primary" onClick={() => s.openAddLeague()} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent)', border: 'none', color: 'var(--accent-fg)', padding: '11px 18px', borderRadius: 11, fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
              <IconPlus size={17} />
              Liga
            </button>
          </div>
        )}
      </div>

      {leagues.length === 0 && (
        <div style={{ background: 'var(--surface)', border: '1px dashed var(--border-strong)', borderRadius: 16, padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Noch keine Liga</div>
          <div style={{ fontSize: 13, color: 'var(--text-4)' }}>Lege eine Liga an, füge Mannschaften hinzu und trage die Ergebnisse ein.</div>
        </div>
      )}

      {leagues.length > 0 && sel && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
            {leagues.map((l, i) => {
              const active = i === selIdx;
              return (
                <button key={l.id} onClick={() => s.selectLeague(i)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, background: active ? 'var(--btn)' : 'transparent', border: `1.5px solid ${active ? accent : 'var(--border)'}`, borderRadius: 12, padding: '10px 16px', cursor: 'pointer', fontFamily: 'inherit', minWidth: 130 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: active ? 'var(--text)' : 'var(--text-3)' }}>{l.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 600 }}>{l.season}</span>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>{sel.name} · Saison {sel.season || '—'}</div>
            {canEdit && (
              <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
                <button className="dh-btn" onClick={() => s.openEditLeague()} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <IconUsersSmall size={15} />
                  Mannschaften
                </button>
                <button className="dh-btn" onClick={() => s.openAddFixture()} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <IconPlus size={15} />
                  Begegnung
                </button>
                <button className="dh-btn" onClick={() => { if (window.confirm(`Liga „${sel.name}" mit komplettem Spielplan und allen zugehörigen Spieltag-Terminen wirklich löschen? Das lässt sich nicht rückgängig machen.`)) s.deleteLeague(sel.id); }} title="Liga löschen" style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(224,89,75,.1)', border: '1px solid rgba(224,89,75,.4)', color: '#E0594B', padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" /></svg>
                  Löschen
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isPhone ? 'minmax(0, 1fr)' : '1.5fr 1fr', gap: 18, alignItems: 'start' }}>
            {/* standings */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflowX: 'auto', overflowY: 'hidden', minWidth: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '28px minmax(120px,1fr) 30px 30px 30px 30px 44px 40px', gap: 5, padding: '13px 18px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text-4)', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', minWidth: 440 }}>
                <span>#</span><span>Mannschaft</span><span style={{ textAlign: 'center' }}>Sp</span><span style={{ textAlign: 'center' }}>S</span><span style={{ textAlign: 'center' }}>U</span><span style={{ textAlign: 'center' }}>N</span><span style={{ textAlign: 'center' }}>Diff</span><span style={{ textAlign: 'right' }}>Pkt</span>
              </div>
              {standings.length === 0 && <div style={{ padding: '30px 18px', textAlign: 'center', fontSize: 13, color: 'var(--text-4)' }}>Noch keine Ergebnisse — trage eine Begegnung ein.</div>}
              {standings.map((t, i) => {
                const diff = t.lf - t.la;
                const posColor = i < 2 ? 'var(--success)' : (standings.length > 4 && i >= standings.length - 1) ? 'var(--danger-soft)' : 'var(--text-3)';
                return (
                  <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '28px minmax(120px,1fr) 30px 30px 30px 30px 44px 40px', gap: 5, padding: '12px 18px', borderBottom: '1px solid var(--hairline)', alignItems: 'center', background: t.own ? 'rgba(25,164,99,.08)' : 'transparent', minWidth: 440 }}>
                    <span style={{ fontFamily: 'var(--font-num)', fontSize: 14, fontWeight: 800, color: posColor }}>{i + 1}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: t.own ? 'linear-gradient(135deg,#19A463,#0f6b40)' : 'var(--btn)', color: t.own ? '#fff' : 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 10, flexShrink: 0 }}>{initials(t.name).slice(0, 3)}</div>
                      <span style={{ fontSize: 14, fontWeight: t.own ? 700 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</span>
                    </div>
                    <span style={{ textAlign: 'center', fontFamily: 'var(--font-num)', fontSize: 13, color: 'var(--text-3)' }}>{t.sp}</span>
                    <span style={{ textAlign: 'center', fontFamily: 'var(--font-num)', fontSize: 13, color: 'var(--success)' }}>{t.s}</span>
                    <span style={{ textAlign: 'center', fontFamily: 'var(--font-num)', fontSize: 13, color: 'var(--text-4)' }}>{t.u}</span>
                    <span style={{ textAlign: 'center', fontFamily: 'var(--font-num)', fontSize: 13, color: 'var(--danger-soft)' }}>{t.n}</span>
                    <span style={{ textAlign: 'center', fontFamily: 'var(--font-num)', fontSize: 13, color: 'var(--text-3)' }}>{diff > 0 ? '+' : ''}{diff}</span>
                    <span style={{ textAlign: 'right', fontFamily: 'var(--font-num)', fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{t.pts}</span>
                  </div>
                );
              })}
            </div>

            {/* fixtures */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 22px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>Begegnungen &amp; Ergebnisse</div>
              </div>
              {fxSorted.length === 0 && <div style={{ padding: '24px 4px', textAlign: 'center', fontSize: 13, color: 'var(--text-4)' }}>Noch keine Begegnungen angelegt.</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {fxSorted.map((f) => {
                  const played = !!f.played;
                  const { day, mon } = fmtDate(f.date);
                  const score = played ? `${f.hs}:${f.as}` : '–';
                  const isOwn = !!sel.teams.find((t) => (t.id === f.homeId || t.id === f.awayId) && t.own);
                  const hasLineup = !!(f.lineup && (f.lineup.positions?.some((e) => e.playerIds.length) || f.lineup.substitutes?.length));
                  const hl = isOwn ? highlightsFor(f.id) : [];
                  return (
                    <div key={f.id} style={{ border: '1px solid var(--border-2)', borderRadius: 12, overflow: 'hidden' }}>
                    <div className="dh-hover-border" onClick={() => canEdit && s.openEditFixture(f.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: canEdit ? 'pointer' : 'default', background: 'transparent' }}>
                      <div style={{ textAlign: 'center', width: 42, flexShrink: 0 }}>
                        <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase' }}>{mon}</div>
                        <div style={{ fontFamily: 'var(--font-num)', fontSize: 18, fontWeight: 800 }}>{day}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{teamNameById(f.homeId)} — {teamNameById(f.awayId)}</div>
                        <div style={{ fontSize: 11, color: played ? 'var(--text-4)' : 'var(--success)', fontWeight: 600, marginTop: 2 }}>{[played ? 'Beendet' : 'Geplant', f.time, f.loc].filter(Boolean).join(' · ')}</div>
                      </div>
                      {isOwn && canEdit && (
                        <button onClick={(e) => { e.stopPropagation(); s.openLineup(f.id); }} title="Aufstellung"
                          style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, background: hasLineup ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'var(--btn)', border: `1px solid ${hasLineup ? 'var(--accent)' : 'var(--border-2)'}`, color: hasLineup ? 'var(--accent)' : 'var(--text-3)', padding: '6px 10px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          <IconUsersSmall size={14} />
                          {hasLineup ? 'Aufstellung' : 'Aufstellen'}
                        </button>
                      )}
                      {isOwn && canEdit && hasLineup && (
                        <button onClick={(e) => { e.stopPropagation(); s.openResult(f.id); }} title="Ergebnis erfassen"
                          style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text-3)', padding: '6px 10px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                          Ergebnis
                        </button>
                      )}
                      <span style={{ fontFamily: 'var(--font-num)', fontSize: 15, fontWeight: 800, color: played ? 'var(--text)' : 'var(--text-4)' }}>{score}</span>
                    </div>
                    {hl.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 7, padding: '8px 14px 10px', borderTop: '1px solid var(--hairline)', background: 'color-mix(in srgb, var(--accent) 4%, transparent)' }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-4)', letterSpacing: '.06em', textTransform: 'uppercase' }}>Highlights</span>
                        {hl.map((h) => (
                          <span key={h.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 8, padding: '3px 9px', fontSize: 12, color: 'var(--text-2)' }}>
                            {h.name}
                            {h.c180 > 0 && <b style={{ color: '#E0594B', fontFamily: 'var(--font-num)' }}>{h.c180}×180</b>}
                            {h.shortLegs > 0 && <b style={{ color: '#2bd3c0', fontFamily: 'var(--font-num)' }} title="Short Legs ≤19 Darts">{h.shortLegs}× SL</b>}
                            {h.highFinish >= HF_MIN && <b style={{ color: '#F2B829', fontFamily: 'var(--font-num)' }} title="Highest Finish (≥100)">{h.highFinish} HF</b>}
                          </span>
                        ))}
                      </div>
                    )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
