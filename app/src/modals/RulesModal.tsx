import { useStore } from '../store/useStore';
import { TRAIN_MODES, MODE_RULES } from '../data/constants';
import { useT } from '../i18n';
import { SectionHeading } from '../components/ui';

// Regel-Erklärung eines Trainingsmodus. Eigenes Modul (nicht in Training.tsx), damit der statische
// Import aus Modals.tsx den lazy geladenen Training-Screen NICHT in den Haupt-Chunk zieht.
export function RulesModal() {
  const s = useStore();
  const tr = useT();
  const id = s.rulesMode;
  if (!id) return null;
  const mode = TRAIN_MODES.find((m) => m.id === id);
  const rules = MODE_RULES[id];
  if (!mode || !rules) return null;
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) s.closeRules(); }} style={{ position: 'fixed', inset: 0, background: 'var(--scrim)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 62, padding: 24 }}>
      <div className="dh-pop" style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-xl)', padding: 28, width: 480, maxWidth: '92vw', boxShadow: 'var(--shadow-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', background: `color-mix(in srgb, ${mode.color} 16%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={mode.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={mode.icon} /></svg>
          </div>
          <div>
            <SectionHeading level={3}>{tr.trainingScr.rulesTitle}</SectionHeading>
            <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 800 }}>{mode.name}</div>
          </div>
        </div>
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 'var(--fs-badge)', color: mode.color, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 5 }}>{tr.trainingScr.goal}</div>
          <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text)', lineHeight: 1.5 }}>{rules.goal}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 24 }}>
          {rules.lines.map((ln, i) => (
            <div key={i} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: mode.color, marginTop: 7, flexShrink: 0 }} />
              <div style={{ fontSize: 'var(--fs-sub)', color: 'var(--text-2)', lineHeight: 1.5 }}>{ln}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button className="dh-btn" onClick={() => s.closeRules()} style={{ background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', padding: '12px 20px', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-body)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{tr.trainingScr.close}</button>
        </div>
      </div>
    </div>
  );
}
