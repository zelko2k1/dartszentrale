import { useStore } from '../store/useStore';
import { TRAIN_MODES, type TrainMode } from '../data/constants';
import { TRAIN_BEST } from '../store/training';
import { useT, type Dict } from '../i18n';

function tagText(m: TrainMode, tr: Dict) {
  if (m.solo && m.versus) return tr.trainingScr.tagSoloMulti;
  if (m.versus) return tr.trainingScr.tagMulti;
  return tr.trainingScr.tagSolo;
}

// Bester Wert aller Spieler für einen Modus (oder null) — als „Rekord" auf der Kachel.
function overallBest(modeId: string, players: { trainingBests?: Record<string, { value: number }> }[]): number | null {
  const bm = TRAIN_BEST[modeId]; if (!bm) return null;
  let best: number | null = null;
  for (const p of players) {
    const v = p.trainingBests?.[modeId]?.value; if (v == null) continue;
    best = best == null ? v : (bm.kind === 'min' ? Math.min(best, v) : Math.max(best, v));
  }
  return best;
}

function Grid({ modes }: { modes: TrainMode[] }) {
  const openRules = useStore((s) => s.openRules);
  const openTrainSetup = useStore((s) => s.openTrainSetup);
  const players = useStore((s) => s.players);
  const tr = useT();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 28 }}>
      {modes.map((m) => (
        <div key={m.id} className="dh-hover-border" role="button" tabIndex={0} onClick={() => openTrainSetup(m.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTrainSetup(m.id); } }} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 20, cursor: 'pointer', position: 'relative' }}>
          <div style={{ width: 46, height: 46, borderRadius: 'var(--radius-md)', background: `color-mix(in srgb, ${m.color} 16%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={m.color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={m.icon} /></svg>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{m.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 3, lineHeight: 1.4, minHeight: 34 }}>{m.desc}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--hairline)' }}>
            <span style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 600, whiteSpace: 'nowrap' }}>{tagText(m, tr)}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={(e) => { e.stopPropagation(); openRules(m.id); }} title={tr.trainingScr.rules} className="dh-btn" style={{ minWidth: 44, minHeight: 44, borderRadius: 'var(--radius-xs)', background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontFamily: 'var(--font-num)', fontSize: 13, fontWeight: 800 }}>?</button>
              {(() => { const bv = overallBest(m.id, players); const bm = TRAIN_BEST[m.id]; return (
                <span style={{ fontFamily: 'var(--font-num)', fontSize: 13, fontWeight: 800, color: m.color }}>{m.metric}{bv != null && bm ? ` ${bm.format(bv)}` : ''}</span>
              ); })()}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TournamentTile() {
  const openTournamentSetup = useStore((s) => s.openTournamentSetup);
  const openTournamentList = useStore((s) => s.openTournamentList);
  const tournaments = useStore((s) => s.tournaments);
  const tr = useT();
  const t = tr.tournament;
  const ACCENT = 'var(--gold)';
  const running = tournaments.filter((x) => x.status === 'running');
  return (
    <div className="dh-hover-border" role="button" tabIndex={0} onClick={() => openTournamentSetup()} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTournamentSetup(); } }} style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${ACCENT} 12%, var(--surface)), var(--surface))`, border: `1px solid color-mix(in srgb, ${ACCENT} 40%, var(--border))`, borderRadius: 'var(--radius-lg)', padding: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 18, marginBottom: 28 }}>
      <div style={{ width: 52, height: 52, borderRadius: 'var(--radius-lg)', background: `color-mix(in srgb, ${ACCENT} 18%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9a6 6 0 0 0 12 0M6 9V4h12v5M9 21h6M12 15v6M4 4h2M18 4h2" /></svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 800 }}>{t.tileName}</div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-4)', marginTop: 3, lineHeight: 1.4 }}>{t.tileDesc}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {tournaments.length > 0 && (
          <button onClick={(e) => { e.stopPropagation(); openTournamentList(); }} style={{ background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text-2)', padding: '9px 14px', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{t.listTitle}{running.length > 0 ? ` · ${running.length} ${t.statusLive}` : ''}</button>
        )}
        <div style={{ background: ACCENT, color: 'var(--accent-fg)', padding: '9px 16px', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap' }}>{t.newTournament}</div>
      </div>
    </div>
  );
}

export function Training() {
  const tr = useT();
  const training = TRAIN_MODES.filter((m) => m.cat === 'training');
  const party = TRAIN_MODES.filter((m) => m.cat === 'party');
  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 6, fontSize: 12, color: 'var(--text-4)', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }}>{tr.trainingScr.kicker}</div>
      <h1 style={{ margin: '0 0 22px', fontSize: 27, fontWeight: 800, letterSpacing: '-.02em' }}>{tr.nav.training}</h1>
      <TournamentTile />
      <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', margin: '4px 0 14px' }}>{tr.trainingScr.soloSection}</div>
      <Grid modes={training} />
      <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', margin: '4px 0 14px' }}>{tr.trainingScr.multiSection}</div>
      <Grid modes={party} />
    </div>
  );
}
