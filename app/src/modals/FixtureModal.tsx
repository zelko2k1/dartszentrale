import { useStore } from '../store/useStore';
import { Modal, ModalTitle, FieldLabel, ModalFooter } from '../components/Modal';

export function FixtureModal() {
  const s = useStore();
  const m = s.fixtureModal;
  if (!m) return null;
  const league = s.leagues.find((l) => l.id === m.leagueId);
  const teams = league?.teams || [];
  const canSave = !!m.homeId && !!m.awayId && m.homeId !== m.awayId;

  const chip = (id: string, name: string, selected: boolean, disabled: boolean, onClick: () => void) => (
    <button key={id} onClick={disabled ? undefined : onClick} disabled={disabled} style={{
      background: selected ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'var(--btn)', border: `1.5px solid ${selected ? 'var(--accent)' : 'var(--border-2)'}`,
      color: disabled ? 'var(--text-5)' : selected ? 'var(--success)' : 'var(--text-2)', padding: '8px 13px', borderRadius: 999,
      fontSize: 13, fontWeight: 700, cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit', opacity: disabled ? 0.5 : 1,
    }}>{name}</button>
  );

  const numInput: React.CSSProperties = { width: 80, boxSizing: 'border-box', textAlign: 'center', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 12, padding: 14, color: 'var(--text)', fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-num)' };

  return (
    <Modal onClose={() => s.closeFixtureModal()} width={500} z={63} style={{ maxHeight: '88vh', overflow: 'auto' }}>
      <ModalTitle>{m.mode === 'edit' ? 'Begegnung bearbeiten' : 'Neue Begegnung'}</ModalTitle>

      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-3)', fontWeight: 700, marginBottom: 8 }}>Heim</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {teams.map((t) => chip(t.id, t.name, m.homeId === t.id, m.awayId === t.id, () => s.setFixtureField('homeId', t.id)))}
      </div>

      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-3)', fontWeight: 700, marginBottom: 8 }}>Gast</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
        {teams.map((t) => chip(t.id, t.name, m.awayId === t.id, m.homeId === t.id, () => s.setFixtureField('awayId', t.id)))}
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <FieldLabel>Datum</FieldLabel>
          <input className="dh-input" type="date" value={m.date} onChange={(e) => s.setFixtureField('date', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 11, padding: '12px 14px', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }} />
        </div>
        <div style={{ width: 130 }}>
          <FieldLabel>Uhrzeit</FieldLabel>
          <input className="dh-input" type="time" value={m.time} onChange={(e) => s.setFixtureField('time', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 11, padding: '12px 14px', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }} />
        </div>
      </div>

      <FieldLabel>Ort</FieldLabel>
      <input className="dh-input" value={m.loc} onChange={(e) => s.setFixtureField('loc', e.target.value)} placeholder="z. B. Vereinsheim, Gaststätte …" style={{ width: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 11, padding: '12px 14px', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', marginBottom: 18 }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 16px', background: 'var(--btn)', borderRadius: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{m.played ? 'Ergebnis eingetragen' : 'Noch nicht gespielt'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>Ergebnis manuell eintragen &amp; in der Tabelle werten.</div>
        </div>
        <button onClick={() => s.setFixtureField('played', !m.played)} style={{ position: 'relative', width: 44, height: 24, borderRadius: 999, background: m.played ? 'var(--accent)' : 'var(--border-2)', border: 'none', cursor: 'pointer', flexShrink: 0, padding: 0 }}>
          <span style={{ position: 'absolute', top: 2, left: 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'transform .15s', transform: m.played ? 'translateX(20px)' : 'translateX(0)' }} />
        </button>
      </div>

      {m.played && (
        <>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-3)', fontWeight: 700, marginBottom: 2 }}>Ergebnis (Punkte)</label>
          <div style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 8 }}>Gewonnene Spiele je Mannschaft (Heim : Gast) — zählt für Tabellenpunkte und Differenz.</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 6 }}>
            <input className="dh-input" value={m.hs} onChange={(e) => s.setFixtureField('hs', e.target.value)} inputMode="numeric" placeholder="0" style={numInput} />
            <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-4)' }}>:</span>
            <input className="dh-input" value={m.as} onChange={(e) => s.setFixtureField('as', e.target.value)} inputMode="numeric" placeholder="0" style={numInput} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 22, fontSize: 11, color: 'var(--text-5)', fontWeight: 600 }}>
            <span style={{ width: 80, textAlign: 'center' }}>Heim</span><span style={{ width: 8 }} /><span style={{ width: 80, textAlign: 'center' }}>Gast</span>
          </div>
        </>
      )}

      <ModalFooter
        onDelete={m.mode === 'edit' ? () => s.deleteFixture(m.id!) : undefined}
        onCancel={() => s.closeFixtureModal()}
        onSave={() => s.saveFixtureModal()}
        saveDisabled={!canSave}
      />
    </Modal>
  );
}
