import { useStore } from '../store/useStore';
import { Avatar } from './Avatar';
import { boardAssignment } from '../store/selectors';
import { todayIso, shortLong } from '../lib/format';

// Zeigt im Board-/Kiosk-Modus, welches Ligaspiel diesem Board (settings.boardName) zugeordnet ist:
// eigener Spieler / eigenes Doppel gegen die Gastmannschaft.
export function BoardPanel() {
  const s = useStore();
  const me = s.accounts.find((a) => a.id === s.session) || null;
  const boardNumber = me?.isBoard ? (me.boardNumber ?? null) : null;
  const boardName = boardNumber != null ? `Board ${boardNumber}` : '';
  const windowDays = s.settings.boardMatchWindow ?? 1;
  const assignment = boardAssignment(s.leagues, s.players, boardNumber, todayIso(), windowDays);
  const visible = !!assignment && assignment.games.length > 0 && (assignment.inWindow || s.boardForceShow);

  if (boardNumber == null) return null; // nur an einem Board-Konto angemeldet

  const wrap = (children: React.ReactNode) => (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '20px 32px 0' }}>{children}</div>
  );
  const boardBadge = <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)', padding: '3px 9px', borderRadius: 7 }}>{boardName}</span>;

  if (!assignment || assignment.games.length === 0) {
    return wrap(
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-4)', fontSize: 13 }}>
        {boardBadge}
        Kein Spiel für dieses Board eingetragen.
      </div>,
    );
  }

  // Zugeordnet, aber außerhalb des Anzeige-Zeitfensters (und nicht „an Boards gesendet"/„Jetzt anzeigen").
  if (!visible) {
    return wrap(
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', color: 'var(--text-4)', fontSize: 13 }}>
        {boardBadge}
        <span>Nächste Begegnung{assignment.date ? ` am ${shortLong(assignment.date)}` : ''} gegen {assignment.oppName} — außerhalb des Anzeige-Zeitfensters.</span>
        <button onClick={() => s.showBoardNow()} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 7, background: 'var(--accent)', border: 'none', color: 'var(--accent-fg)', padding: '7px 13px', borderRadius: 9, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4" /></svg>
          Jetzt anzeigen
        </button>
      </div>,
    );
  }

  const a = assignment;
  return wrap(
    <div style={{ background: 'linear-gradient(135deg,#13241b,var(--surface) 70%)', border: '1px solid #234032', borderRadius: 16, padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent-fg)', background: 'var(--accent)', padding: '4px 11px', borderRadius: 8 }}>{boardName}</span>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{a.ownTeamName}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', background: 'var(--btn)', border: '1px solid var(--border-2)', padding: '2px 8px', borderRadius: 6 }}>{a.ownIsHome ? 'Heim' : 'Auswärts'}</span>
        <span style={{ color: 'var(--text-5)', fontSize: 13 }}>gegen</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-2)' }}>{a.oppName}</span>
        {a.date && <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-4)', fontWeight: 600 }}>{shortLong(a.date)}</span>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {a.games.map((g) => {
          const ownPlayerId = g.players[0]?.id || '';
          return (
            <div key={g.positionId} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 12, padding: '12px 14px', flexWrap: 'wrap' }}>
              <span style={{ width: 64, flexShrink: 0, fontSize: 11, fontWeight: 800, color: g.kind === 'single' ? 'var(--text-3)' : 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{g.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                {g.players.map((pl) => (
                  <span key={pl.id} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Avatar photo={pl.photo} short={pl.short} avi={pl.avi} size={26} />
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{pl.name}</span>
                  </span>
                ))}
                <span style={{ fontSize: 12, color: 'var(--text-5)', fontWeight: 700, margin: '0 2px' }}>vs</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-3)' }}>{a.oppName}</span>
              </div>
              {ownPlayerId && (
                <button onClick={() => s.startBoardGame(a.leagueId, a.fixtureId, g.positionId, ownPlayerId, a.oppName)} title="Dieses Spiel jetzt am Board spielen – Ergebnis wird automatisch erfasst"
                  style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 7, background: 'var(--accent)', border: 'none', color: 'var(--accent-fg)', padding: '8px 14px', borderRadius: 9, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4" /></svg>
                  Spiel starten
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>,
  );
}
