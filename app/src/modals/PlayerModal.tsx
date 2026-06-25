import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Modal, ModalTitle, FieldLabel, ModalFooter } from '../components/Modal';
import { Avatar } from '../components/Avatar';
import { initials } from '../lib/format';
import { PHOTO_TYPES } from '../lib/image';

export function PlayerModal() {
  const s = useStore();
  const m = s.playerModal;
  const [confirmDel, setConfirmDel] = useState(false);
  const [photoErr, setPhotoErr] = useState('');
  if (!m) return null;
  const fullName = `${m.first} ${m.last}`.trim();
  const preview = (m.short.trim() || (fullName ? initials(fullName) : '?')).toUpperCase().slice(0, 3);
  const canSave = fullName.length > 0;
  const p = s.players.find((x) => x.id === m.id);
  const canDelete = m.mode === 'edit' && !p?.locked;
  const isVerein = s.settings.appMode === 'verein';
  const photo = p?.photo;
  const canPhoto = isVerein && m.mode === 'edit' && !!m.id; // Upload braucht den vorhandenen Datensatz (PocketBase)

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ''; setPhotoErr('');
    if (!f || !m.id) return;
    if (!PHOTO_TYPES.includes(f.type)) { setPhotoErr('Nur PNG, JPG oder WebP.'); return; }
    void s.uploadPhoto('player', m.id, f);
  };

  return (
    <Modal onClose={() => s.closePlayerModal()} width={440} z={60}>
      <ModalTitle>{m.mode === 'edit' ? 'Spieler bearbeiten' : 'Neuer Spieler'}</ModalTitle>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22 }}>
        <Avatar photo={photo} short={preview} avi={m.avi} size={64} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="dh-btn" onClick={() => s.cyclePlayerAvi(-1)} title="Farbe zurück" style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', fontSize: 17, cursor: 'pointer', fontFamily: 'inherit' }}>‹</button>
            <button className="dh-btn" onClick={() => s.cyclePlayerAvi(1)} title="Farbe weiter" style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', fontSize: 17, cursor: 'pointer', fontFamily: 'inherit' }}>›</button>
            <span style={{ fontSize: 12, color: 'var(--text-4)' }}>Farbe</span>
          </div>
          {canPhoto ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <label className="dh-btn" style={{ background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', padding: '7px 12px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {photo ? 'Foto ändern' : 'Foto wählen'}
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onPhoto} style={{ display: 'none' }} />
              </label>
              {photo && <button onClick={() => m.id && s.clearPhoto('player', m.id)} style={{ background: 'transparent', border: '1px solid var(--border-2)', color: 'var(--text-3)', padding: '7px 11px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Entfernen</button>}
            </div>
          ) : isVerein && m.mode === 'add' ? (
            <span style={{ fontSize: 11, color: 'var(--text-5)' }}>Foto nach dem Speichern hinzufügen</span>
          ) : null}
          {photoErr && <span style={{ fontSize: 11, color: '#E0594B', fontWeight: 600 }}>{photoErr}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <FieldLabel>Vorname</FieldLabel>
          <input className="dh-input" value={m.first} onChange={(e) => s.setPlayerField('first', e.target.value)} placeholder="z. B. Lukas" style={{ width: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 11, padding: '12px 14px', fontSize: 15, color: 'var(--text)', fontFamily: 'inherit' }} />
        </div>
        <div style={{ flex: 1 }}>
          <FieldLabel>Nachname</FieldLabel>
          <input className="dh-input" value={m.last} onChange={(e) => s.setPlayerField('last', e.target.value)} placeholder="z. B. Brandt" style={{ width: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 11, padding: '12px 14px', fontSize: 15, color: 'var(--text)', fontFamily: 'inherit' }} />
        </div>
      </div>
      <FieldLabel note="(max. 3 Zeichen, optional)">Kürzel</FieldLabel>
      <input className="dh-input" value={m.short} onChange={(e) => s.setPlayerField('short', e.target.value)} placeholder="autom. aus Name" maxLength={3} style={{ width: 140, boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 11, padding: '12px 14px', fontSize: 15, color: 'var(--text)', fontFamily: "'JetBrains Mono',monospace", textTransform: 'uppercase', marginBottom: 26 }} />
      {confirmDel ? (
        <div style={{ background: 'rgba(224,89,75,.08)', border: '1px solid rgba(224,89,75,.32)', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>„{fullName || 'Spieler'}" wirklich löschen?</div>
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
