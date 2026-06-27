import { useStore } from '../store/useStore';
import { Modal, ModalTitle, ModalFooter } from '../components/Modal';

// Brett-für-Brett-Ergebniserfassung (Spielbericht): pro Aufstellungs-Position Sieg/Niederlage (eigene
// Sicht) + optionale Legs. Das Gesamtergebnis (gewonnene Spiele) wird in die Begegnung übernommen.
export function ResultModal() {
  const s = useStore();
  const m = s.resultModal;
  if (!m) return null;

  const ownWins = m.rows.filter((r) => r.won === 'own').length;
  const oppWins = m.rows.filter((r) => r.won === 'opp').length;
  const open = m.rows.length - ownWins - oppWins;

  const legStyle: React.CSSProperties = {
    width: 38, textAlign: 'center', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)',
    borderRadius: 8, padding: '7px 4px', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font-num)',
  };
  const resBtn = (active: boolean, color: string, label: string, onClick: () => void) => (
    <button onClick={onClick} style={{ background: active ? color : 'var(--btn)', color: active ? '#fff' : 'var(--text-3)', border: `1px solid ${active ? color : 'var(--border-2)'}`, fontWeight: active ? 800 : 600, padding: '7px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{label}</button>
  );

  return (
    <Modal onClose={() => s.closeResult()} width={620} z={64} style={{ maxHeight: '88vh', overflow: 'auto' }}>
      <ModalTitle>Spielbericht / Ergebnis</ModalTitle>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <strong style={{ color: 'var(--text)' }}>{m.ownTeamName}</strong>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)', padding: '2px 8px', borderRadius: 6 }}>{m.ownIsHome ? 'Heim' : 'Auswärts'}</span>
        <span style={{ color: 'var(--text-5)' }}>gegen</span>
        <strong style={{ color: 'var(--text-2)' }}>{m.oppName}</strong>
      </div>

      {/* Live-Stand: gewonnene Spiele */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 14, padding: '14px 18px', marginBottom: 18 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-num)', fontSize: 30, fontWeight: 800, color: ownWins >= oppWins ? 'var(--success)' : 'var(--text)' }}>{ownWins}</div>
          <div style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 700, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.ownTeamName}</div>
        </div>
        <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-5)' }}>:</span>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-num)', fontSize: 30, fontWeight: 800, color: oppWins > ownWins ? 'var(--danger-soft)' : 'var(--text)' }}>{oppWins}</div>
          <div style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 700, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.oppName}</div>
        </div>
        {open > 0 && <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-5)' }}>· {open} offen</span>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
        {m.rows.map((r) => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', border: '1px solid var(--border-2)', borderRadius: 11, background: r.won ? 'transparent' : 'var(--btn)', flexWrap: 'wrap' }}>
            <span style={{ width: 60, flexShrink: 0, fontSize: 11, fontWeight: 800, color: r.kind === 'single' ? 'var(--text-3)' : 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.03em' }}>{r.label}</span>
            <span style={{ flex: 1, minWidth: 120, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7 }}>
              {r.playerNames.join(' / ') || <span style={{ color: 'var(--text-5)' }}>—</span>}
              {r.auto && <span title="Automatisch vom Board übernommen – bitte bestätigen" style={{ fontSize: 9, fontWeight: 800, color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)', padding: '1px 6px', borderRadius: 5, letterSpacing: '.04em' }}>AUTO</span>}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input value={r.ownLegs} onChange={(e) => s.setResultLeg(r.id, 'own', e.target.value)} placeholder="–" title="eigene Legs" style={legStyle} />
              <span style={{ color: 'var(--text-5)', fontWeight: 700 }}>:</span>
              <input value={r.oppLegs} onChange={(e) => s.setResultLeg(r.id, 'opp', e.target.value)} placeholder="–" title="gegnerische Legs" style={legStyle} />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {resBtn(r.won === 'own', 'var(--success)', 'Sieg', () => s.setResultWon(r.id, 'own'))}
              {resBtn(r.won === 'opp', '#E0594B', 'Niederlage', () => s.setResultWon(r.id, 'opp'))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-5)', lineHeight: 1.5, marginBottom: 16 }}>
        Trage pro Brett die Legs ein – der Brett-Punkt ergibt sich automatisch (mehr Legs = Sieg). Das Gesamtergebnis ({ownWins}:{oppWins}) wird als Begegnungsergebnis übernommen; daraus folgen die Tabellenpunkte (Sieg 2, Unentschieden 1). Sieg/Niederlage lässt sich bei Bedarf weiterhin manuell setzen.
      </div>

      <ModalFooter onCancel={() => s.closeResult()} onSave={() => s.saveResult()} saveLabel="Ergebnis speichern" />
    </Modal>
  );
}
