import { useStore } from '../store/useStore';
import { Avatar } from '../components/Avatar';
import { maxBoards, TOURNAMENT_START_OPTS, TOURNAMENT_MIN_PLAYERS, TOURNAMENT_MAX_PLAYERS } from '../store/tournament';
import { useIsPhone } from '../lib/useIsPhone';
import { useT } from '../i18n';

const ACCENT = '#F2B829'; // Turnier-Akzent (wie eine Trainings-Kachel)

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 0', flexWrap: 'wrap', borderTop: '1px solid var(--hairline)' }}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{children}</div>
    </div>
  );
}

export function TournamentSetup() {
  const s = useStore();
  const tr = useT();
  const su = s.tournamentSetup;
  const players = s.players;
  const isPhone = useIsPhone();
  if (!su) return null;

  const t = tr.tournament;
  const countOpts: number[] = [];
  for (let i = TOURNAMENT_MIN_PLAYERS; i <= TOURNAMENT_MAX_PLAYERS; i++) countOpts.push(i);
  const boardOpts: number[] = [];
  for (let i = 1; i <= maxBoards(su.count); i++) boardOpts.push(i);
  const bestOfOpts = [1, 3, 5, 7];
  const enoughPlayers = players.length >= TOURNAMENT_MIN_PLAYERS;

  const seg = (active: boolean, label: string, onClick: () => void, key?: string | number) => (
    <button key={key ?? label} onClick={onClick} style={{ background: active ? ACCENT : 'var(--btn)', color: active ? '#06160d' : 'var(--text-2)', border: `1px solid ${active ? ACCENT : 'var(--border-2)'}`, fontWeight: active ? 800 : 600, padding: '9px 14px', minWidth: 44, borderRadius: 10, fontSize: 14, cursor: 'pointer', fontFamily: 'var(--font-num)' }}>{label}</button>
  );

  const slots = Array.from({ length: su.count }, (_, i) => i);

  return (
    <div style={{ padding: isPhone ? '18px 14px' : '28px 32px', maxWidth: 980, margin: '0 auto' }}>
      <button onClick={() => s.go('training')} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--surface-3)', border: '1px solid var(--border-2)', color: 'var(--text-2)', padding: '8px 13px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 18 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        {tr.nav.training}
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22 }}>
        <div style={{ width: 54, height: 54, borderRadius: 15, background: `color-mix(in srgb, ${ACCENT} 16%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9a6 6 0 0 0 12 0M6 9V4h12v5M9 21h6M12 15v6M4 4h2M18 4h2" /></svg>
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }}>{tr.trainingScr.setupKicker}</div>
          <h1 style={{ margin: '2px 0 0', fontSize: 26, fontWeight: 800, letterSpacing: '-.02em' }}>{t.setupTitle}</h1>
        </div>
      </div>

      {!enoughPlayers && (
        <div style={{ background: 'color-mix(in srgb, #E0594B 12%, transparent)', border: '1px solid color-mix(in srgb, #E0594B 40%, transparent)', color: 'var(--text)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 14 }}>{t.tooFewPlayers}</div>
      )}

      {/* Name + Optionen */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '8px 22px', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 0', flexWrap: 'wrap' }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{t.nameLabel}</div>
          <input value={su.name} onChange={(e) => s.setTournamentSetup({ name: e.target.value })} placeholder={t.namePlaceholder}
            style={{ flex: '1 1 240px', maxWidth: 320, background: 'var(--btn)', color: 'var(--text)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '10px 13px', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
        </div>
        <Row label={t.playersLabel}>{countOpts.map((n) => seg(su.count === n, String(n), () => s.setTournamentSetup({ count: n }), n))}</Row>
        <Row label={t.startScoreLabel}>{TOURNAMENT_START_OPTS.map((n) => seg(su.config.startScore === n, String(n), () => s.setTournamentSetup({ config: { ...su.config, startScore: n } }), n))}</Row>
        <Row label={t.outModeLabel}>
          {seg(su.config.outMode === 'single', t.outSingle, () => s.setTournamentSetup({ config: { ...su.config, outMode: 'single' } }))}
          {seg(su.config.outMode === 'double', t.outDouble, () => s.setTournamentSetup({ config: { ...su.config, outMode: 'double' } }))}
          {seg(su.config.outMode === 'master', t.outMaster, () => s.setTournamentSetup({ config: { ...su.config, outMode: 'master' } }))}
        </Row>
        <Row label={t.doubleInLabel}>{seg(su.config.doubleIn, su.config.doubleIn ? 'An' : 'Aus', () => s.setTournamentSetup({ config: { ...su.config, doubleIn: !su.config.doubleIn } }))}</Row>
        <Row label={t.bestOfLabel}>{bestOfOpts.map((n) => seg(su.config.bestOf === n, t.bestOfValue(n), () => s.setTournamentSetup({ config: { ...su.config, bestOf: n } }), n))}</Row>
        <Row label={t.boardsLabel}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 12, color: 'var(--text-4)', marginRight: 4 }}>{t.boardsHint(su.boardCount)}</span>
            {boardOpts.map((n) => seg(su.boardCount === n, String(n), () => s.setTournamentSetup({ boardCount: n }), n))}
          </div>
        </Row>
      </div>

      {/* Teilnehmer */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '8px 22px', marginBottom: 22 }}>
        <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', padding: '16px 0 12px' }}>{t.playersLabel}</div>
        <div style={{ display: 'grid', gridTemplateColumns: isPhone ? '1fr' : 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, paddingBottom: 18, borderTop: '1px solid var(--hairline)', paddingTop: 16 }}>
          {slots.map((i) => {
            const sel = players[su.picks[i]] || players[0];
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 12 }}>
                {sel ? <Avatar photo={sel.photo} short={sel.short} avi={sel.avi} size={38} /> : <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--btn)', flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{tr.trainingScr.playerN(i + 1)}</div>
                  <select value={su.picks[i]} onChange={(e) => s.setTournamentPick(i, Number(e.target.value))} style={{ width: '100%', background: 'transparent', color: 'var(--text)', border: 'none', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', outline: 'none', padding: 0 }}>
                    {players.map((p, idx) => <option key={p.id} value={idx} style={{ background: 'var(--surface)' }}>{p.name}</option>)}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => s.createTournament()} disabled={!enoughPlayers} style={{ display: 'flex', alignItems: 'center', gap: 10, background: enoughPlayers ? ACCENT : 'var(--btn)', border: 'none', color: enoughPlayers ? '#06160d' : 'var(--text-4)', padding: '14px 30px', borderRadius: 13, fontSize: 16, fontWeight: 800, cursor: enoughPlayers ? 'pointer' : 'not-allowed', fontFamily: 'inherit', boxShadow: enoughPlayers ? `0 8px 24px color-mix(in srgb, ${ACCENT} 28%, transparent)` : 'none' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4" /></svg>
          {t.create}
        </button>
      </div>
    </div>
  );
}
