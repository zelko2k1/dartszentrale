import { useStore } from '../store/useStore';
import { Modal, ModalTitle, FieldLabel, ModalFooter } from '../components/Modal';
import { useT } from '../i18n';

// Freundschaftsspiel anlegen: eigene Mannschaft + frei wählbarer Gegner (suchbar über alle Saisons/Ligen),
// Datum/Uhrzeit/Ort. Aufstellung & Ergebnis laufen danach über den „Freundschaftsspiele"-Wettbewerb.
export function FriendlyModal() {
  const s = useStore();
  const tr = useT();
  const m = s.friendlyModal;
  if (!m) return null;

  // Eigene Mannschaften: aus der Mannschaften-Liste + eigenen Liga-Teams, eindeutig nach Name.
  const ownNames = Array.from(new Set([
    ...s.teams.map((t) => t.name),
    ...s.leagues.flatMap((l) => l.teams.filter((t) => t.own).map((t) => t.name)),
  ].filter(Boolean)));
  const ownLower = new Set(ownNames.map((n) => n.toLowerCase()));
  // Gegner-Pool: alle Team-Namen über ALLE Ligen/Saisons, die nicht die eigene Mannschaft sind.
  const oppPool = Array.from(new Set(
    s.leagues.flatMap((l) => l.teams.filter((t) => !t.own).map((t) => t.name)).filter((n) => n && !ownLower.has(n.toLowerCase())),
  )).sort((a, b) => a.localeCompare(b, 'de'));
  const q = m.opponent.trim().toLowerCase();
  const matches = oppPool.filter((n) => !q || n.toLowerCase().includes(q)).slice(0, 60);
  const canSave = !!m.ownTeam.trim() && !!m.opponent.trim();

  const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 11, padding: '12px 14px', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' };

  return (
    <Modal onClose={() => s.closeFriendly()} width={520} z={63} style={{ maxHeight: '88vh', overflow: 'auto' }}>
      <ModalTitle>{tr.modals.friendlyTitle}</ModalTitle>

      <FieldLabel>{tr.modals.ownTeam}</FieldLabel>
      {ownNames.length > 1 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {ownNames.map((n) => {
            const on = m.ownTeam === n;
            return <button key={n} onClick={() => s.setFriendlyField('ownTeam', n)} style={{ background: on ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'var(--btn)', border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border-2)'}`, color: on ? 'var(--success)' : 'var(--text-2)', padding: '8px 13px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{n}</button>;
          })}
        </div>
      ) : (
        <input className="dh-input" value={m.ownTeam} onChange={(e) => s.setFriendlyField('ownTeam', e.target.value)} placeholder={tr.modals.ownTeamPh} style={{ ...inputStyle, marginBottom: 16 }} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '12px 16px', background: 'var(--btn)', borderRadius: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{m.homeIsOwn ? tr.modals.homeGame : tr.modals.awayGame}</div>
        <button onClick={() => s.setFriendlyField('homeIsOwn', !m.homeIsOwn)} style={{ position: 'relative', width: 44, height: 24, borderRadius: 999, background: m.homeIsOwn ? 'var(--accent)' : 'var(--border-2)', border: 'none', cursor: 'pointer', flexShrink: 0, padding: 0 }}>
          <span style={{ position: 'absolute', top: 2, left: 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'transform .15s', transform: m.homeIsOwn ? 'translateX(20px)' : 'translateX(0)' }} />
        </button>
      </div>

      <FieldLabel>{tr.modals.opponent}</FieldLabel>
      <input className="dh-input" value={m.opponent} onChange={(e) => s.setFriendlyField('opponent', e.target.value)} placeholder={tr.modals.opponentPh} style={{ ...inputStyle, marginBottom: 8 }} />
      {matches.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto', marginBottom: 16 }}>
          {matches.map((n) => {
            const on = m.opponent.trim().toLowerCase() === n.toLowerCase();
            return <button key={n} onClick={() => s.setFriendlyField('opponent', n)} style={{ textAlign: 'left', background: on ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'var(--btn)', border: `1px solid ${on ? 'var(--accent)' : 'var(--border-2)'}`, borderRadius: 10, padding: '9px 12px', fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit' }}>{n}</button>;
          })}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text-5)', marginBottom: 16 }}>{tr.modals.noKnownOpp}</div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <FieldLabel>{tr.modals.date}</FieldLabel>
          <input className="dh-input" type="date" value={m.date} onChange={(e) => s.setFriendlyField('date', e.target.value)} style={inputStyle} />
        </div>
        <div style={{ width: 130 }}>
          <FieldLabel>{tr.modals.time}</FieldLabel>
          <input className="dh-input" type="time" value={m.time} onChange={(e) => s.setFriendlyField('time', e.target.value)} style={inputStyle} />
        </div>
      </div>
      <FieldLabel>{tr.modals.place}</FieldLabel>
      <input className="dh-input" value={m.loc} onChange={(e) => s.setFriendlyField('loc', e.target.value)} placeholder={tr.modals.placePh} style={{ ...inputStyle, marginBottom: 18 }} />

      <ModalFooter onCancel={() => s.closeFriendly()} onSave={() => s.saveFriendly()} saveDisabled={!canSave} saveLabel={tr.modals.create} />
      <div style={{ fontSize: 11, color: 'var(--text-5)', marginTop: 10, lineHeight: 1.5 }}>
        {tr.modals.friendlyNote}
      </div>
    </Modal>
  );
}
