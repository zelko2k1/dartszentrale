import { useStore } from '../store/useStore';
import { avatar } from '../data/constants';
import { Modal, ModalTitle, FieldLabel, ModalFooter } from '../components/Modal';

export function TeamModal() {
  const s = useStore();
  const m = s.teamModal;
  if (!m) return null;
  const canSave = m.name.trim().length > 0;
  const players = s.players;

  return (
    <Modal onClose={() => s.closeTeamModal()} width={520} z={61} style={{ maxHeight: '88vh', overflow: 'auto' }}>
      <ModalTitle>{m.mode === 'edit' ? 'Mannschaft bearbeiten' : 'Neue Mannschaft'}</ModalTitle>

      <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
        <div style={{ flex: 1.4 }}>
          <FieldLabel>Mannschaftsname</FieldLabel>
          <input className="dh-input" value={m.name} onChange={(e) => s.setTeamField('name', e.target.value)} placeholder="z. B. 1. Mannschaft" style={{ width: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 11, padding: '12px 14px', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }} />
        </div>
        <div style={{ flex: 1 }}>
          <FieldLabel note="(optional)">Liga</FieldLabel>
          <input className="dh-input" value={m.league} onChange={(e) => s.setTeamField('league', e.target.value)} placeholder="z. B. Verbandsliga Nord" style={{ width: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 11, padding: '12px 14px', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <label style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>Kader aus Spielerliste</label>
        <span style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 600 }}>{m.memberIds.length} ausgewählt</span>
      </div>

      {players.length === 0 && (
        <div style={{ background: 'var(--btn)', border: '1px dashed var(--border-strong)', borderRadius: 12, padding: 24, textAlign: 'center', color: 'var(--text-4)', fontSize: 13, marginBottom: 18 }}>Lege zuerst Spieler unter „Spieler" an.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 22 }}>
        {players.map((p) => {
          const a = avatar(p.avi); const on = m.memberIds.includes(p.id); const isCap = m.captainId === p.id;
          return (
            <div key={p.id} onClick={() => s.toggleTeamMember(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: `1px solid ${on ? 'var(--accent)' : 'var(--border-2)'}`, background: on ? 'color-mix(in srgb, var(--accent) 9%, transparent)' : 'var(--btn)', borderRadius: 11, cursor: 'pointer' }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${on ? 'var(--accent)' : 'var(--border-strong)'}`, background: on ? 'var(--accent)' : 'transparent', color: 'var(--accent-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {on && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
              </div>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: a.bg, color: a.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>{p.short}</div>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{p.name}</span>
              {on && (
                <button onClick={(e) => { e.stopPropagation(); s.setTeamCaptain(p.id); }} title="Als Kapitän festlegen" style={{ display: 'flex', alignItems: 'center', gap: 5, background: isCap ? 'rgba(242,184,41,.14)' : 'var(--btn)', border: `1px solid ${isCap ? 'rgba(242,184,41,.5)' : 'var(--border-2)'}`, color: isCap ? '#F2B829' : 'var(--text-4)', padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '.03em' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 6.5L21 9l-5 4.5L17.5 21 12 17.3 6.5 21 8 13.5 3 9l6.6-.5z" /></svg>
                  Kapitän
                </button>
              )}
            </div>
          );
        })}
      </div>

      <ModalFooter
        onDelete={m.mode === 'edit' ? () => s.deleteTeam(m.id!) : undefined}
        onCancel={() => s.closeTeamModal()}
        onSave={() => s.saveTeamModal()}
        saveDisabled={!canSave}
      />
    </Modal>
  );
}
