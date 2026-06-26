import { useStore } from '../store/useStore';
import { TRAIN_MODES, MODE_RULES } from '../data/constants';
import { Avatar } from '../components/Avatar';
import { trainMeta } from '../store/training';
import { useIsPhone } from '../lib/useIsPhone';

export function TrainingSetup() {
  const s = useStore();
  const su = s.trainSetup;
  const accent = s.settings.accent;
  const players = s.players;
  const isPhone = useIsPhone();
  if (!su) return null;

  const mode = TRAIN_MODES.find((m) => m.id === su.modeId);
  const rules = MODE_RULES[su.modeId];
  const meta = trainMeta(su.modeId);
  if (!mode) return null;

  const canChooseCount = meta.maxPlayers > meta.minPlayers;
  const countOpts: number[] = [];
  for (let i = meta.minPlayers; i <= meta.maxPlayers; i++) countOpts.push(i);

  const seg = (active: boolean, label: string, onClick: () => void) => (
    <button key={label} onClick={onClick} style={{ background: active ? accent : 'var(--btn)', color: active ? 'var(--accent-fg)' : 'var(--text-2)', border: `1px solid ${active ? accent : 'var(--border-2)'}`, fontWeight: active ? 800 : 600, padding: '9px 0', minWidth: 44, borderRadius: 10, fontSize: 14, cursor: 'pointer', fontFamily: 'var(--font-num)' }}>{label}</button>
  );

  const slots = Array.from({ length: su.count }, (_, i) => i);

  return (
    <div style={{ padding: isPhone ? '18px 14px' : '28px 32px', maxWidth: 980, margin: '0 auto' }}>
      <button onClick={() => s.go('training')} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--surface-3)', border: '1px solid var(--border-2)', color: 'var(--text-2)', padding: '8px 13px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 18 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        Trainingsspiele
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22 }}>
        <div style={{ width: 54, height: 54, borderRadius: 15, background: `color-mix(in srgb, ${mode.color} 16%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={mode.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={mode.icon} /></svg>
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }}>Training einrichten</div>
          <h1 style={{ margin: '2px 0 0', fontSize: 26, fontWeight: 800, letterSpacing: '-.02em' }}>{mode.name}</h1>
        </div>
      </div>

      {rules && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 22px', marginBottom: 18 }}>
          <div style={{ fontSize: 11, color: mode.color, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 6 }}>Ziel</div>
          <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5, marginBottom: 12 }}>{rules.goal}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rules.lines.map((ln, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: mode.color, marginTop: 7, flexShrink: 0 }} />
                <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>{ln}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '8px 22px', marginBottom: 18 }}>
        {canChooseCount ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 0', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Anzahl Spieler</div>
              <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>{meta.minPlayers}–{meta.maxPlayers} Spieler möglich</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {countOpts.map((n) => seg(su.count === n, String(n), () => s.setTrainCount(n)))}
            </div>
          </div>
        ) : (
          <div style={{ padding: '16px 0', fontSize: 14, fontWeight: 600 }}>{meta.maxPlayers === 1 ? 'Solo-Training' : `${su.count} Spieler`}</div>
        )}
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '8px 22px', marginBottom: 22 }}>
        <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', padding: '16px 0 12px' }}>Teilnehmer</div>
        <div style={{ display: 'grid', gridTemplateColumns: isPhone ? '1fr' : 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, paddingBottom: 18, borderTop: '1px solid var(--hairline)', paddingTop: 16 }}>
          {slots.map((i) => {
            const sel = players[su.picks[i]] || players[0];
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 12 }}>
                {sel
                  ? <Avatar photo={sel.photo} short={sel.short} avi={sel.avi} size={38} />
                  : <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--btn)', flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Spieler {i + 1}</div>
                  <select value={su.picks[i]} onChange={(e) => s.setTrainPick(i, Number(e.target.value))} style={{ width: '100%', background: 'transparent', color: 'var(--text)', border: 'none', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', outline: 'none', padding: 0 }}>
                    {players.map((p, idx) => <option key={p.id} value={idx} style={{ background: 'var(--surface)' }}>{p.name}</option>)}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => s.startTrain()} style={{ display: 'flex', alignItems: 'center', gap: 10, background: mode.color, border: 'none', color: '#06160d', padding: '14px 30px', borderRadius: 13, fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: `0 8px 24px color-mix(in srgb, ${mode.color} 28%, transparent)` }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4" /></svg>
          Training starten
        </button>
      </div>
    </div>
  );
}
