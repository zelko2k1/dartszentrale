import { useStore } from '../store/useStore';
import { avatar, ROLES, ROLE_ORDER } from '../data/constants';
import { Modal, ModalTitle, FieldLabel, ModalFooter } from '../components/Modal';
import { initials } from '../lib/format';
import type { Role } from '../data/types';

export function UserModal() {
  const s = useStore();
  const m = s.userModal;
  if (!m) return null;
  const a = avatar(m.avi);
  const preview = (initials(`${m.first} ${m.last}`.trim()) || '?').toUpperCase();
  const canSave = `${m.first}${m.last}`.trim().length > 0 && m.email.trim().length > 0;
  const players = s.players;
  const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 11, padding: '12px 14px', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' };

  return (
    <Modal onClose={() => s.closeUserModal()} width={540} z={63} style={{ maxHeight: '88vh', overflow: 'auto' }}>
      <ModalTitle>{m.mode === 'edit' ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}</ModalTitle>

      <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 20 }}>
        <div style={{ width: 58, height: 58, borderRadius: 15, background: a.bg, color: a.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 19, flexShrink: 0 }}>{preview}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="dh-btn" onClick={() => s.cycleUserAvi(-1)} style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}>‹</button>
          <button className="dh-btn" onClick={() => s.cycleUserAvi(1)} style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}>›</button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-4)', lineHeight: 1.4 }}>Avatar-Farbe<br />wählen</div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
        <div style={{ flex: 1 }}>
          <FieldLabel>Vorname</FieldLabel>
          <input className="dh-input" value={m.first} onChange={(e) => s.setUserField('first', e.target.value)} placeholder="z. B. Markus" style={inputStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <FieldLabel>Nachname</FieldLabel>
          <input className="dh-input" value={m.last} onChange={(e) => s.setUserField('last', e.target.value)} placeholder="z. B. Krüger" style={inputStyle} />
        </div>
      </div>

      <FieldLabel>E-Mail</FieldLabel>
      <input className="dh-input" type="email" value={m.email} onChange={(e) => s.setUserField('email', e.target.value)} placeholder="name@verein.de" style={{ ...inputStyle, marginBottom: 18 }} />

      <FieldLabel note="(optional)">Position im Verein</FieldLabel>
      <input className="dh-input" value={m.position} onChange={(e) => s.setUserField('position', e.target.value)} placeholder="z. B. 1. Vorsitzender, Kassenwart, Trainer" style={{ ...inputStyle, marginBottom: 18 }} />

      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-3)', fontWeight: 700, marginBottom: 8 }}>Rolle &amp; Rechte</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {ROLE_ORDER.map((role) => {
          const r = ROLES[role]; const on = m.role === role;
          return (
            <button key={role} onClick={() => s.setUserField('role', role as Role)} style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', background: on ? r.bg : 'var(--btn)', border: `1px solid ${on ? r.bd : 'var(--border-2)'}`, borderRadius: 11, padding: '11px 13px', cursor: 'pointer', fontFamily: 'inherit' }}>
              <span style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${on ? r.color : 'var(--border-strong)'}`, background: on ? r.color : 'transparent', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: r.color }}>{r.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-4)' }}>{r.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-3)', fontWeight: 700, marginBottom: 10 }}>Mit Spieler verknüpfen <span style={{ color: 'var(--text-5)', fontWeight: 500 }}>(optional)</span></label>
      {players.length === 0 && <div style={{ background: 'var(--btn)', border: '1px dashed var(--border-strong)', borderRadius: 12, padding: 18, textAlign: 'center', color: 'var(--text-4)', fontSize: 13, marginBottom: 20 }}>Noch keine Spieler in der Liste.</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
        {players.map((p) => {
          const av = avatar(p.avi); const on = m.playerId === p.id;
          return (
            <button key={p.id} onClick={() => s.setUserField('playerId', on ? null : p.id)} style={{ display: 'flex', alignItems: 'center', gap: 9, background: on ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'var(--btn)', border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border-2)'}`, borderRadius: 999, padding: '6px 13px 6px 7px', cursor: 'pointer', fontFamily: 'inherit' }}>
              <span style={{ width: 26, height: 26, borderRadius: '50%', background: av.bg, color: av.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 10 }}>{p.short}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{p.name}</span>
              {on && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 16px', background: 'var(--btn)', borderRadius: 12, marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{m.active ? 'Konto aktiv' : 'Konto inaktiv'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>Deaktivierte Konten können sich nicht anmelden.</div>
        </div>
        <button onClick={() => s.setUserField('active', !m.active)} style={{ position: 'relative', width: 44, height: 24, borderRadius: 999, background: m.active ? 'var(--accent)' : 'var(--border-2)', border: 'none', cursor: 'pointer', flexShrink: 0, padding: 0 }}>
          <span style={{ position: 'absolute', top: 2, left: 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'transform .15s', transform: m.active ? 'translateX(20px)' : 'translateX(0)' }} />
        </button>
      </div>

      <ModalFooter
        onDelete={m.mode === 'edit' ? () => s.deleteUser(m.id!) : undefined}
        onCancel={() => s.closeUserModal()}
        onSave={() => s.saveUserModal()}
        saveDisabled={!canSave}
      />
    </Modal>
  );
}
