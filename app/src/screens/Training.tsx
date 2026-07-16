import { useStore } from '../store/useStore';
import { TRAIN_MODES, MODE_RULES, type TrainMode } from '../data/constants';
import { useT, type Dict } from '../i18n';

function tagText(m: TrainMode, tr: Dict) {
  if (m.solo && m.versus) return tr.trainingScr.tagSoloMulti;
  if (m.versus) return tr.trainingScr.tagMulti;
  return tr.trainingScr.tagSolo;
}

function Grid({ modes }: { modes: TrainMode[] }) {
  const openRules = useStore((s) => s.openRules);
  const openTrainSetup = useStore((s) => s.openTrainSetup);
  const tr = useT();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 28 }}>
      {modes.map((m) => (
        <div key={m.id} className="dh-hover-border" onClick={() => openTrainSetup(m.id)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20, cursor: 'pointer', position: 'relative' }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, background: `color-mix(in srgb, ${m.color} 16%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={m.color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={m.icon} /></svg>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{m.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 3, lineHeight: 1.4, minHeight: 34 }}>{m.desc}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--hairline)' }}>
            <span style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 600, whiteSpace: 'nowrap' }}>{tagText(m, tr)}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={(e) => { e.stopPropagation(); openRules(m.id); }} title={tr.trainingScr.rules} className="dh-btn" style={{ width: 24, height: 24, borderRadius: 7, background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontFamily: 'var(--font-num)', fontSize: 13, fontWeight: 800 }}>?</button>
              <span style={{ fontFamily: 'var(--font-num)', fontSize: 13, fontWeight: 800, color: m.color }}>{m.metric}</span>
            </div>
          </div>
        </div>
      ))}
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
      <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', margin: '4px 0 14px' }}>{tr.trainingScr.soloSection}</div>
      <Grid modes={training} />
      <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', margin: '4px 0 14px' }}>{tr.trainingScr.multiSection}</div>
      <Grid modes={party} />
    </div>
  );
}

export function RulesModal() {
  const s = useStore();
  const tr = useT();
  const id = s.rulesMode;
  if (!id) return null;
  const mode = TRAIN_MODES.find((m) => m.id === id);
  const rules = MODE_RULES[id];
  if (!mode || !rules) return null;
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) s.closeRules(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(8,10,12,.78)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 62, padding: 24 }}>
      <div className="dh-pop" style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 20, padding: 28, width: 480, maxWidth: '92vw', boxShadow: '0 30px 70px rgba(0,0,0,.55)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 13, background: `color-mix(in srgb, ${mode.color} 16%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={mode.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={mode.icon} /></svg>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>{tr.trainingScr.rulesTitle}</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{mode.name}</div>
          </div>
        </div>
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: mode.color, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 5 }}>{tr.trainingScr.goal}</div>
          <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>{rules.goal}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 24 }}>
          {rules.lines.map((ln, i) => (
            <div key={i} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: mode.color, marginTop: 7, flexShrink: 0 }} />
              <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>{ln}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button className="dh-btn" onClick={() => s.closeRules()} style={{ background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', padding: '12px 20px', borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{tr.trainingScr.close}</button>
        </div>
      </div>
    </div>
  );
}
