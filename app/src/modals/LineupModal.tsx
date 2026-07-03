import { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { Avatar } from '../components/Avatar';
import { Modal, ModalTitle, ModalFooter } from '../components/Modal';
import { compareName, nameParts } from '../lib/people';
import { IconPlus, IconTrash } from '../lib/icons';
import type { Player } from '../data/types';

export function LineupModal() {
  const s = useStore();
  const m = s.lineupModal;
  const order = s.settings.nameOrder ?? 'first';

  const roster: Player[] = useMemo(() => {
    if (!m) return [];
    const list = m.rosterIds.map((id) => s.players.find((p) => p.id === id)).filter((p): p is Player => !!p);
    return list.sort((a, b) => compareName(nameParts(a.name), nameParts(b.name), order));
  }, [m, s.players, order]);

  if (!m) return null;
  const playerById = (id: string) => roster.find((p) => p.id === id);

  const selectStyle: React.CSSProperties = {
    flex: 1, minWidth: 0, boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)',
    borderRadius: 9, padding: '9px 10px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
  };
  const boardStyle: React.CSSProperties = {
    width: 80, flexShrink: 0, boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)',
    borderRadius: 9, padding: '9px 8px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
  };
  const iconBtn: React.CSSProperties = {
    width: 28, height: 28, flexShrink: 0, borderRadius: 7, background: 'var(--btn)', border: '1px solid var(--border-2)',
    color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
  };

  const PlayerSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={selectStyle}>
      <option value="">— Spieler —</option>
      {roster.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );

  // Positionen in Reihenfolge, fortlaufend je Art nummeriert.
  let sNo = 0, dNo = 0;
  const placed = new Set<string>();
  m.positions.forEach((p) => p.playerIds.forEach((id) => id && placed.add(id)));
  const availableForSub = roster.filter((p) => !placed.has(p.id) && !m.substitutes.includes(p.id));

  return (
    <Modal onClose={() => s.closeLineup()} width={600} z={64} style={{ maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <ModalTitle>Aufstellung</ModalTitle>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-3)', marginBottom: 16, flexWrap: 'wrap' }}>
        <strong style={{ color: 'var(--text)' }}>{m.ownTeamName}</strong>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)', padding: '2px 8px', borderRadius: 6 }}>{m.ownIsHome ? 'Heim' : 'Auswärts'}</span>
        <span style={{ color: 'var(--text-5)' }}>gegen</span>
        <strong style={{ color: 'var(--text-2)' }}>{m.oppName}</strong>
      </div>

      {roster.length === 0 && (
        <div style={{ background: 'var(--btn)', border: '1px dashed var(--border-strong)', borderRadius: 12, padding: 20, textAlign: 'center', color: 'var(--text-4)', fontSize: 13, marginBottom: 18 }}>
          Kein Kader gefunden. Lege zuerst die Mannschaft mit Spielern an („Mannschaften").
        </div>
      )}

      {/* Scrollbarer Bereich (Spiele + Ersatz) – Kopf & Speichern-Fuß bleiben fix. */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', margin: '0 -4px', padding: '2px 4px' }}>

      <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>Reihenfolge der Spiele</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        {m.positions.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-4)', padding: '8px 2px' }}>Noch keine Spiele – füge Einzel/Doppel hinzu.</div>}
        {m.positions.map((p, idx) => {
          const label = p.kind === 'single' ? `Einzel ${++sNo}` : `Doppel ${++dNo}`;
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <button onClick={() => s.moveLineupPosition(p.id, -1)} disabled={idx === 0} title="Nach oben" style={{ ...iconBtn, width: 22, height: 14, opacity: idx === 0 ? 0.35 : 1 }}>▲</button>
                <button onClick={() => s.moveLineupPosition(p.id, 1)} disabled={idx === m.positions.length - 1} title="Nach unten" style={{ ...iconBtn, width: 22, height: 14, opacity: idx === m.positions.length - 1 ? 0.35 : 1 }}>▼</button>
              </div>
              <span style={{ width: 62, flexShrink: 0, fontSize: 11, fontWeight: 800, color: p.kind === 'single' ? 'var(--text-3)' : 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.03em' }}>{label}</span>
              <PlayerSelect value={p.playerIds[0] || ''} onChange={(v) => s.setLineupPositionPlayer(p.id, 0, v)} />
              {p.kind === 'double' && <PlayerSelect value={p.playerIds[1] || ''} onChange={(v) => s.setLineupPositionPlayer(p.id, 1, v)} />}
              <input value={p.board || ''} onChange={(e) => s.setLineupPositionBoard(p.id, e.target.value.replace(/[^0-9]/g, '').slice(0, 2))} inputMode="numeric" placeholder="Nr." title="Board-Nummer (optional)" style={boardStyle} />
              <button onClick={() => s.removeLineupPosition(p.id)} title="Entfernen" style={iconBtn}><IconTrash size={14} /></button>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
        <button onClick={() => s.addLineupPosition('single')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--btn)', border: '1px dashed var(--border-strong)', color: 'var(--text-2)', padding: '8px 13px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}><IconPlus size={14} />Einzel</button>
        <button onClick={() => s.addLineupPosition('double')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--btn)', border: '1px dashed var(--border-strong)', color: 'var(--text-2)', padding: '8px 13px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}><IconPlus size={14} />Doppel</button>
      </div>

      {roster.length > 0 && (
        <>
          <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>Ersatzspieler (Reihenfolge E1, E2 …)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
            {m.substitutes.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-4)', padding: '4px 2px' }}>Keine Ersatzspieler.</div>}
            {m.substitutes.map((id, i) => {
              const p = playerById(id); if (!p) return null;
              return (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 28, flexShrink: 0, fontSize: 12, fontWeight: 800, color: 'var(--accent)' }}>E{i + 1}</span>
                  <Avatar photo={p.photo} short={p.short} avi={p.avi} size={26} circle />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{p.name}</span>
                  <button onClick={() => s.moveSubstitute(id, -1)} disabled={i === 0} title="Nach oben" style={{ ...iconBtn, opacity: i === 0 ? 0.35 : 1 }}>▲</button>
                  <button onClick={() => s.moveSubstitute(id, 1)} disabled={i === m.substitutes.length - 1} title="Nach unten" style={{ ...iconBtn, opacity: i === m.substitutes.length - 1 ? 0.35 : 1 }}>▼</button>
                  <button onClick={() => s.toggleSubstitute(id)} title="Aus Ersatz entfernen" style={iconBtn}><IconTrash size={14} /></button>
                </div>
              );
            })}
          </div>
          {availableForSub.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {availableForSub.map((p) => {
                return (
                  <button key={p.id} onClick={() => s.toggleSubstitute(p.id)} title="Als Ersatz hinzufügen"
                    style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 999, padding: '5px 12px 5px 6px', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <Avatar photo={p.photo} short={p.short} avi={p.avi} size={22} circle />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>{p.name}</span>
                    <IconPlus size={13} />
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      </div>

      {/* Fester Fuß mit Speichern – immer sichtbar, auch bei vielen Spielen/Ersatzspielern. */}
      <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 4 }}>
        <button
          onClick={() => s.toggleLineupBoardLive()}
          title="Zeigt diese Begegnung sofort an den zugeordneten Boards – unabhängig vom Datums-Anzeigefenster."
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, background: m.boardLive ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'var(--btn)', border: `1px solid ${m.boardLive ? 'var(--accent)' : 'var(--border-2)'}`, borderRadius: 11, padding: '10px 14px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', boxSizing: 'border-box' }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>Jetzt an die Boards senden</span>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--text-4)', lineHeight: 1.4 }}>Zeigt die Begegnung sofort an den zugeordneten Boards – unabhängig vom Anzeige-Zeitfenster. Wird beim Speichern übernommen.</span>
          </span>
          <span style={{ flexShrink: 0, width: 40, height: 22, borderRadius: 999, background: m.boardLive ? 'var(--accent)' : 'var(--surface-3)', border: '1px solid var(--border-2)', position: 'relative' }}>
            <span style={{ position: 'absolute', top: 2, left: m.boardLive ? 20 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff' }} />
          </span>
        </button>
        <ModalFooter onCancel={() => s.closeLineup()} onSave={() => s.saveLineup()} />
      </div>
    </Modal>
  );
}
