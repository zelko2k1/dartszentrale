import { useStore } from '../store/useStore';
import { EVENT_TYPES, EVENT_TYPE_ALL } from '../data/constants';
import { Modal, ModalTitle, FieldLabel, ModalFooter } from '../components/Modal';

export function EventModal() {
  const s = useStore();
  const m = s.eventModal;
  if (!m) return null;
  const canSave = m.title.trim().length > 0;

  const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 11, padding: '12px 14px', color: 'var(--text)', fontFamily: 'inherit', fontWeight: 600, outline: 'none' };

  return (
    <Modal onClose={() => s.closeEventModal()} width={460} z={62}>
      <ModalTitle>{m.mode === 'edit' ? 'Termin bearbeiten' : 'Neuer Termin'}</ModalTitle>

      <FieldLabel>Titel</FieldLabel>
      <input className="dh-input" value={m.title} onChange={(e) => s.setEventField('title', e.target.value)} placeholder="z. B. Mannschaftstraining" style={{ ...inputStyle, fontSize: 15, marginBottom: 18 }} />

      <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
        <div style={{ flex: 1 }}>
          <FieldLabel>Datum</FieldLabel>
          <input className="dh-input" type="date" value={m.date} onChange={(e) => s.setEventField('date', e.target.value)} style={{ ...inputStyle, fontSize: 14 }} />
        </div>
        <div style={{ width: 120 }}>
          <FieldLabel>Uhrzeit</FieldLabel>
          <input className="dh-input" type="time" value={m.time} onChange={(e) => s.setEventField('time', e.target.value)} style={{ ...inputStyle, fontSize: 14 }} />
        </div>
      </div>

      <FieldLabel>Art</FieldLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
        {EVENT_TYPE_ALL.map((key) => {
          const t = EVENT_TYPES[key]; const on = m.type === key;
          return (
            <button key={key} onClick={() => s.setEventField('type', key)} style={{ display: 'flex', alignItems: 'center', gap: 7, background: on ? `color-mix(in srgb, ${t.color} 16%, transparent)` : 'var(--btn)', border: `1px solid ${on ? t.color : 'var(--border-2)'}`, color: on ? t.color : 'var(--text-2)', fontWeight: on ? 800 : 600, padding: '9px 13px', borderRadius: 10, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={t.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={t.icon} /></svg>{t.label}
            </button>
          );
        })}
      </div>

      <FieldLabel note="(optional)">Ort</FieldLabel>
      <input className="dh-input" value={m.loc} onChange={(e) => s.setEventField('loc', e.target.value)} placeholder="z. B. Vereinsheim" style={{ ...inputStyle, fontSize: 15, marginBottom: 18 }} />

      {m.mode === 'add' && (
        <>
          <FieldLabel note="(optional)">Wiederholung</FieldLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: m.repeat === 'none' ? 24 : 14 }}>
            {([['none', 'Keine'], ['weekly', 'Wöchentlich'], ['biweekly', '14-tägig'], ['monthly', 'Monatlich']] as const).map(([val, label]) => {
              const on = m.repeat === val;
              return (
                <button key={val} onClick={() => s.setEventField('repeat', val)} style={{ background: on ? 'color-mix(in srgb, var(--accent) 16%, transparent)' : 'var(--btn)', border: `1px solid ${on ? 'var(--accent)' : 'var(--border-2)'}`, color: on ? 'var(--accent)' : 'var(--text-2)', fontWeight: on ? 800 : 600, padding: '9px 13px', borderRadius: 10, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{label}</button>
              );
            })}
          </div>
          {m.repeat !== 'none' && (
            <div style={{ marginBottom: 24 }}>
              <FieldLabel>Wiederholen bis</FieldLabel>
              <input className="dh-input" type="date" value={m.until} min={m.date} onChange={(e) => s.setEventField('until', e.target.value)} style={{ ...inputStyle, fontSize: 14 }} />
              {(!m.until || m.until < m.date) && <div style={{ fontSize: 11.5, color: '#C9882E', marginTop: 6 }}>Enddatum nach dem Startdatum wählen, sonst wird nur ein einzelner Termin angelegt.</div>}
            </div>
          )}
        </>
      )}

      {m.mode === 'edit' && m.seriesId && (
        <button onClick={() => { if (window.confirm('Alle Termine dieser Serie wirklich löschen?')) s.deleteEventSeries(m.seriesId!); }} style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(224,89,75,.1)', border: '1px solid rgba(224,89,75,.4)', color: '#E0594B', padding: '10px 14px', borderRadius: 11, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 14 }}>Ganze Serie löschen</button>
      )}

      <ModalFooter
        onDelete={m.mode === 'edit' ? () => s.deleteEvent(m.id!) : undefined}
        onCancel={() => s.closeEventModal()}
        onSave={() => s.saveEventModal()}
        saveDisabled={!canSave}
      />
    </Modal>
  );
}
