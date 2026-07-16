import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { Avatar } from './Avatar';
import { boardAssignment } from '../store/selectors';
import { todayIso, shortLong } from '../lib/format';
import { useT } from '../i18n';

// Kiosk-Präsentation vor einem Ligaspiel: erscheint automatisch (Vollbild, modal), sobald diesem Board
// das NÄCHSTE noch nicht gespielte Spiel zugeordnet ist. Die Spiele laufen nacheinander — eins beendet,
// dann erscheint (nach dem Spiel) das nächste. Zeigt die Begegnung groß (wie das Sieger-Overlay) und den
// Anwurf (Spieler/Ausbullen) in EINEM Overlay. Kein Zufall (im Ligaspiel nicht üblich), kein Rematch.
export function NextGameOverlay() {
  const s = useStore();
  const tr = useT();
  const rootRef = useRef<HTMLDivElement>(null);
  const me = s.accounts.find((a) => a.id === s.session) || null;
  const boardNumber = me?.isBoard ? (me.boardNumber ?? null) : null;
  const assignment = boardAssignment(s.leagues, s.players, boardNumber, todayIso(), s.settings.boardMatchWindow ?? 1);
  const visible = !!assignment && (assignment.inWindow || s.boardForceShow); // Datumsfenster bzw. manuell freigegeben
  const games = assignment?.games ?? [];

  // „Gespielt" = Ergebnis bestätigt ODER ein verknüpftes Board-Match existiert (fixtureId+positionId).
  const isPlayed = (positionId: string, result?: unknown) =>
    !!result || s.matches.some((m) => m.fixtureId === assignment?.fixtureId && m.positionId === positionId && (m.perPlayer?.length || 0) >= 2);
  const pending = assignment ? games.filter((g) => !isPlayed(g.positionId, g.result)) : [];
  const game = pending[0] || null; // immer nur das nächste offene Spiel
  const show = boardNumber != null && visible && !!game && s.nextGameDismissed !== game.positionId;

  // Ausbullen-Schritt an die positionId gebunden → bei Spielwechsel automatisch zurück (ohne Reset-Effect).
  const [bullFor, setBullFor] = useState<string | null>(null);
  const bull = !!game && bullFor === game.positionId;

  // Anwurf im Overlay festgelegt → Spiel direkt mit gesetztem Starter starten (0 = eigene Seite, 1 = Gast).
  const start = (starterIdx: number) => {
    if (!assignment || !game) return;
    s.startBoardGame(assignment.leagueId, assignment.fixtureId, game.positionId, game.players[0]?.id || '', assignment.oppName, starterIdx);
  };

  // Modaler Fokus: den Fokus vom darunterliegenden Suchfeld nehmen und Tasten abfangen (Capture-Phase),
  // sonst tippen 1/2/B ins Suchfeld statt das Overlay zu bedienen.
  useEffect(() => {
    if (!show) return;
    (document.activeElement as HTMLElement | null)?.blur?.();
    rootRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return; // Kiosk-Shortcuts (Alt+…) durchlassen
      e.preventDefault(); e.stopPropagation();
      const k = e.key;
      if (k === 'Escape') { if (bull) setBullFor(null); else s.dismissNextGame(game!.positionId); return; }
      if (k === '1') start(0);
      else if (k === '2') start(1);
      else if (!bull && k.toLowerCase() === 'b') setBullFor(game!.positionId);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [show, bull, game?.positionId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!show || !assignment || !game) return null;
  const a = assignment;
  const boardName = `Board ${boardNumber}`;
  const gi = games.findIndex((g) => g.positionId === game.positionId);
  const oppShort = (a.oppName.match(/\b\p{L}/gu) || []).join('').slice(0, 3).toUpperCase() || '?';
  const ownFirst = game.players.map((p) => p.name.split(' ')[0]).join(' & ');

  const kbd: React.CSSProperties = { fontFamily: 'var(--font-num)', fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,.65)', background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.16)', borderRadius: 6, padding: '2px 8px', marginLeft: 8 };
  const starterBtn: React.CSSProperties = { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.16)', borderRadius: 14, padding: '18px 12px', cursor: 'pointer', fontFamily: 'inherit' };

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      onKeyDown={(e) => {
        // Garantierter Esc-Pfad, wenn das (fokussierte) Overlay-Div die Taste bekommt. Escape ist idempotent
        // (dismiss/zurück), daher unkritisch, falls zusätzlich der window-Capture-Handler feuert.
        if (e.key === 'Escape' && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); if (bull) setBullFor(null); else s.dismissNextGame(game.positionId); }
      }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(8,10,12,.94)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80, padding: 24, outline: 'none' }}
    >
      <div style={{ width: 560, maxWidth: '94vw', textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: '#F2B829', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 8 }}>
          {tr.nextGame.title}{games.length > 1 ? tr.nextGame.ofCount(gi + 1, games.length) : ''}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent-fg)', background: 'var(--accent)', padding: '3px 10px', borderRadius: 7 }}>{boardName}</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{a.ownTeamName}</span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,.45)' }}>{tr.nextGame.vsWord}</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,.85)' }}>{a.oppName}</span>
          {a.date && <span style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', fontWeight: 600 }}>· {shortLong(a.date)}</span>}
        </div>

        {/* Begegnung groß */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, margin: '24px 0 8px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            {game.players.map((pl) => (
              <div key={pl.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <Avatar photo={pl.photo} short={pl.short} avi={pl.avi} size={game.players.length > 1 ? 46 : 64} circle />
                <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{pl.name}</div>
              </div>
            ))}
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{game.label}</div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'rgba(255,255,255,.45)', fontFamily: 'var(--font-num)' }}>vs</div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
            <Avatar short={oppShort} avi={0} size={64} circle />
            <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,.85)', lineHeight: 1.2 }}>{a.oppName}</div>
          </div>
        </div>

        {!bull ? (
          <>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,.6)', margin: '20px 0 14px' }}>{tr.counter.whoStarts}</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="dh-hover-border" onClick={() => start(0)} style={starterBtn}>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{ownFirst}</span>
                <kbd style={kbd}>1</kbd>
              </button>
              <button className="dh-hover-border" onClick={() => start(1)} style={starterBtn}>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{a.oppName}</span>
                <kbd style={kbd}>2</kbd>
              </button>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
              <button className="dh-hover-border" onClick={() => setBullFor(game.positionId)} style={{ ...starterBtn, flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#E0594B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#19A463' }} /></span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{tr.counter.bullOff}</span>
                <kbd style={kbd}>B</kbd>
              </button>
              <button className="dh-hover-border" onClick={() => s.dismissNextGame(game.positionId)} style={{ ...starterBtn, flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,.7)' }}>{tr.nextGame.later}</span>
                <kbd style={kbd}>Esc</kbd>
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: '20px 0 4px' }}>{tr.counter.bullOff}</div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,.6)', lineHeight: 1.5, marginBottom: 18 }}>{tr.counter.bullOffSub}</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="dh-hover-border" onClick={() => start(0)} style={starterBtn}>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{ownFirst}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,.5)' }}>{tr.nextGame.wasCloser}</span>
                <kbd style={kbd}>1</kbd>
              </button>
              <button className="dh-hover-border" onClick={() => start(1)} style={starterBtn}>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{a.oppName}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,.5)' }}>{tr.nextGame.wasCloser}</span>
                <kbd style={kbd}>2</kbd>
              </button>
            </div>
            <button onClick={() => setBullFor(null)} style={{ marginTop: 16, background: 'transparent', border: 'none', color: 'rgba(255,255,255,.55)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 8 }}>{tr.counter.backArrow} <kbd style={{ ...kbd, marginLeft: 6 }}>Esc</kbd></button>
          </>
        )}
      </div>
    </div>
  );
}
