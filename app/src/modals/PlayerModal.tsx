import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Modal, ModalTitle, FieldLabel, ModalFooter } from '../components/Modal';
import { Avatar } from '../components/Avatar';
import { initials } from '../lib/format';
import { PHOTO_TYPES } from '../lib/image';
import { useT } from '../i18n';

export function PlayerModal() {
  const s = useStore();
  const tr = useT();
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
    if (!PHOTO_TYPES.includes(f.type)) { setPhotoErr(tr.modals.onlyImages); return; }
    void s.uploadPhoto('player', m.id, f);
  };

  return (
    <Modal onClose={() => s.closePlayerModal()} width={440} z={60} label={m.mode === 'edit' ? tr.modals.playerEdit : tr.modals.playerNew}>
      <ModalTitle>{m.mode === 'edit' ? tr.modals.playerEdit : tr.modals.playerNew}</ModalTitle>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22 }}>
        <Avatar photo={photo} short={preview} avi={m.avi} size={64} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="dh-btn" onClick={() => s.cyclePlayerAvi(-1)} title={tr.modals.colorBack} aria-label={tr.modals.colorBack} style={{ minWidth: 44, minHeight: 44, borderRadius: 'var(--radius-md)', background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', fontSize: 'var(--fs-title)', cursor: 'pointer', fontFamily: 'inherit' }}>‹</button>
            <button className="dh-btn" onClick={() => s.cyclePlayerAvi(1)} title={tr.modals.colorFwd} aria-label={tr.modals.colorFwd} style={{ minWidth: 44, minHeight: 44, borderRadius: 'var(--radius-md)', background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', fontSize: 'var(--fs-title)', cursor: 'pointer', fontFamily: 'inherit' }}>›</button>
            <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-4)' }}>{tr.modals.color}</span>
          </div>
          {canPhoto ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <label className="dh-btn" style={{ background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', padding: '7px 12px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-meta)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {photo ? tr.modals.photoChange : tr.modals.photoChoose}
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onPhoto} style={{ display: 'none' }} />
              </label>
              {photo && <button onClick={() => m.id && s.clearPhoto('player', m.id)} style={{ background: 'transparent', border: '1px solid var(--border-2)', color: 'var(--text-3)', padding: '7px 11px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-meta)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{tr.modals.remove}</button>}
            </div>
          ) : isVerein && m.mode === 'add' ? (
            <span style={{ fontSize: 'var(--fs-badge)', color: 'var(--text-5)' }}>{tr.modals.photoAfterSave}</span>
          ) : null}
          {photoErr && <span style={{ fontSize: 'var(--fs-badge)', color: 'var(--danger)', fontWeight: 600 }}>{photoErr}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <FieldLabel>{tr.modals.firstName}</FieldLabel>
          <input className="dh-input" value={m.first} maxLength={40} onChange={(e) => s.setPlayerField('first', e.target.value)} aria-label={tr.modals.firstName} placeholder={tr.modals.firstPh} style={{ width: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-md)', padding: '12px 14px', fontSize: 'var(--fs-lead)', color: 'var(--text)', fontFamily: 'inherit' }} />
        </div>
        <div style={{ flex: 1 }}>
          <FieldLabel>{tr.modals.lastName}</FieldLabel>
          <input className="dh-input" value={m.last} maxLength={40} onChange={(e) => s.setPlayerField('last', e.target.value)} aria-label={tr.modals.lastName} placeholder={tr.modals.lastPh} style={{ width: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-md)', padding: '12px 14px', fontSize: 'var(--fs-lead)', color: 'var(--text)', fontFamily: 'inherit' }} />
        </div>
      </div>
      <FieldLabel note={tr.modals.shortNote}>{tr.modals.shortLabel}</FieldLabel>
      <input className="dh-input" value={m.short} onChange={(e) => s.setPlayerField('short', e.target.value)} aria-label={tr.modals.shortLabel} placeholder={tr.modals.shortPh} maxLength={3} style={{ width: 140, boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-md)', padding: '12px 14px', fontSize: 'var(--fs-lead)', color: 'var(--text)', fontFamily: 'var(--font-num)', textTransform: 'uppercase', marginBottom: 26 }} />
      {confirmDel ? (
        <div style={{ background: 'color-mix(in srgb, var(--danger) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 32%, transparent)', borderRadius: 'var(--radius-md)', padding: '14px 16px' }}>
          <div style={{ fontSize: 'var(--fs-body)', fontWeight: 700, marginBottom: 4 }}>{tr.modals.deleteConfirmTitle(fullName || tr.modals.playerFallback)}</div>
          <div style={{ fontSize: 'var(--fs-sub)', color: 'var(--text-3)', lineHeight: 1.5, marginBottom: 14 }}>
            {tr.modals.cannotUndo}{isVerein ? tr.modals.alsoRemovedFromTeams : ''}
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button className="dh-btn" onClick={() => setConfirmDel(false)} style={{ background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', padding: '11px 18px', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-body)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{tr.common.cancel}</button>
            <button onClick={() => s.deletePlayer(m.id!)} style={{ background: 'var(--danger)', border: 'none', color: '#fff', padding: '11px 20px', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-body)', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>{tr.common.delete}</button>
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
