import { useState } from 'react';
import { useStore } from '../store/useStore';
import { avatar } from '../data/constants';
import { Modal, ModalTitle, FieldLabel, ModalFooter } from '../components/Modal';
import { initials } from '../lib/format';

export function PlayerModal() {
  const s = useStore();
  const m = s.playerModal;
  const [confirmDel, setConfirmDel] = useState(false);
  if (!m) return null;
  const a = avatar(m.avi);
  const preview = (m.short.trim() || (m.name ? initials(m.name) : '?')).toUpperCase().slice(0, 3);
  const canSave = m.name.trim().length > 0;
  const p = useStore.getState().players.find((x) => x.id === m.id);
  const canDelete = m.mode === 'edit' && !p?.locked;
  const isVerein = s.settings.appMode === 'verein';

  return (
    <Modal onClose={() => s.closePlayerModal()} width={440} z={60}>
      <ModalTitle>{m.mode === 'edit' ? 'Spieler bearbeiten' : 'Neuer Spieler'}</ModalTitle>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 22 }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: a.bg, color: a.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 22, flexShrink: 0 }}>{preview}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="dh-btn" onClick={() => s.cyclePlayerAvi(-1)} title="Farbe zurück" style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', fontSize: 18, cursor: 'pointer', fontFamily: 'inherit' }}>‹</button>
          <button className="dh-btn" onClick={() => s.cyclePlayerAvi(1)} title="Farbe weiter" style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', fontSize: 18, cursor: 'pointer', fontFamily: 'inherit' }}>›</button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-4)', lineHeight: 1.4 }}>Avatar-Farbe<br />wählen</div>
      </div>
      <FieldLabel>Name</FieldLabel>
      <input className="dh-input" value={m.name} onChange={(e) => s.setPlayerField('name', e.target.value)} placeholder="z. B. Lukas Brandt" style={{ width: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 11, padding: '12px 14px', fontSize: 15, color: 'var(--text)', fontFamily: 'inherit', marginBottom: 16 }} />
      <FieldLabel note="(max. 3 Zeichen, optional)">Kürzel</FieldLabel>
      <input className="dh-input" value={m.short} onChange={(e) => s.setPlayerField('short', e.target.value)} placeholder="autom. aus Name" maxLength={3} style={{ width: 140, boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 11, padding: '12px 14px', fontSize: 15, color: 'var(--text)', fontFamily: "'JetBrains Mono',monospace", textTransform: 'uppercase', marginBottom: 26 }} />
      {confirmDel ? (
        <div style={{ background: 'rgba(224,89,75,.08)', border: '1px solid rgba(224,89,75,.32)', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>„{m.name.trim() || 'Spieler'}" wirklich löschen?</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5, marginBottom: 14 }}>
            Diese Aktion kann nicht rückgängig gemacht werden.{isVerein ? ' Der Spieler wird auch aus allen Mannschaften entfernt.' : ''}
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button className="dh-btn" onClick={() => setConfirmDel(false)} style={{ background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', padding: '11px 18px', borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
            <button onClick={() => s.deletePlayer(m.id!)} style={{ background: '#E0594B', border: 'none', color: '#fff', padding: '11px 20px', borderRadius: 11, fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Löschen</button>
          </div>
        </div>
      ) : (
        <ModalFooter
          onDelete={canDelete ? () => setConfirmDel(true) : undefined}
          onCancel={() => s.closePlayerModal()}
          onSave={() => s.savePlayerModal()}
          saveDisabled={!canSave}
        />
      )}
    </Modal>
  );
}
