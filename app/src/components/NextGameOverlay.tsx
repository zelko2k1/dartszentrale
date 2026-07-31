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

  const kbd: React.CSSProperties = { fontFamily: 'var(--font-num)', fontSize: 'var(--fs-badge)', fontWeight: 800, color: 'var(--text-4)', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-xs)', padding: '2px 8px', marginLeft: 8 };
  const starterBtn: React.CSSProperties = { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-lg)', padding: '18px 12px', cursor: 'pointer', fontFamily: 'inherit' };

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={tr.nextGame.title}
      onKeyDown={(e) => {
        // Garantierter Esc-Pfad, wenn das (fokussierte) Overlay-Div die Taste bekommt. Escape ist idempotent
        // (dismiss/zurück), daher unkritisch, falls zusätzlich der window-Capture-Handler feuert.
        if (e.key === 'Escape' && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); if (bull) setBullFor(null); else s.dismissNextGame(game.positionId); }
      }}
      style={{ position: 'fixed', inset: 0, background: 'color-mix(in srgb, var(--bg) 94%, transparent)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80, padding: 24, outline: 'none' }}
    >
      <div style={{ width: 560, maxWidth: '94vw', textAlign: 'center' }}>
        <div style={{ fontSize: 'var(--fs-sub)', color: 'var(--gold-text)', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 8 }}>
          {tr.nextGame.title}{games.length > 1 ? tr.nextGame.ofCount(gi + 1, games.length) : ''}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontSize: 'var(--fs-meta)', fontWeight: 800, color: 'var(--accent-fg)', background: 'var(--accent)', padding: '3px 10px', borderRadius: 'var(--radius-xs)' }}>{boardName}</span>
          <span style={{ fontSize: 'var(--fs-lead)', fontWeight: 700, color: 'var(--text)' }}>{a.ownTeamName}</span>
          <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-4)' }}>{tr.nextGame.vsWord}</span>
          <span style={{ fontSize: 'var(--fs-lead)', fontWeight: 700, color: 'var(--text-2)' }}>{a.oppName}</span>
          {a.date && <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-4)', fontWeight: 600 }}>· {shortLong(a.date)}</span>}
        </div>

        {/* Begegnung groß */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, margin: '24px 0 8px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            {game.players.map((pl) => (
              <div key={pl.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <Avatar photo={pl.photo} short={pl.short} avi={pl.avi} size={game.players.length > 1 ? 46 : 64} circle />
                <div style={{ fontSize: 'var(--fs-lead)', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>{pl.name}</div>
              </div>
            ))}
            <div style={{ fontSize: 'var(--fs-badge)', fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{game.label}</div>
          </div>
          <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 800, color: 'var(--text-5)', fontFamily: 'var(--font-num)' }}>vs</div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
            <Avatar short={oppShort} avi={0} size={64} circle />
            <div style={{ fontSize: 'var(--fs-lead)', fontWeight: 700, color: 'var(--text-2)', lineHeight: 1.2 }}>{a.oppName}</div>
          </div>
        </div>

        {!bull ? (
          <>
            <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-4)', margin: '20px 0 14px' }}>{tr.counter.whoStarts}</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="dh-hover-border" onClick={() => start(0)} style={starterBtn}>
                <span style={{ fontSize: 'var(--fs-lead)', fontWeight: 800, color: 'var(--text)' }}>{ownFirst}</span>
                <kbd style={kbd}>1</kbd>
              </button>
              <button className="dh-hover-border" onClick={() => start(1)} style={starterBtn}>
                <span style={{ fontSize: 'var(--fs-lead)', fontWeight: 800, color: 'var(--text)' }}>{a.oppName}</span>
                <kbd style={kbd}>2</kbd>
              </button>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
              <button className="dh-hover-border" onClick={() => setBullFor(game.positionId)} style={{ ...starterBtn, flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
                {/* Die zwei Hex-Werte bleiben ABSICHTLICH: das ist keine UI-Farbe, sondern das Abbild des
                    Bulls einer echten Dartscheibe — außenrot, innengrün. Ein Bull ist in jedem Lichtmodus
                    rot und grün; an Tokens gehängt wäre er im Hellmodus kein Bull mehr. */}
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#E0594B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#19A463' }} /></span>
                <span style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text)' }}>{tr.counter.bullOff}</span>
                <kbd style={kbd}>B</kbd>
              </button>
              <button className="dh-hover-border" onClick={() => s.dismissNextGame(game.positionId)} style={{ ...starterBtn, flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
                <span style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text-3)' }}>{tr.nextGame.later}</span>
                <kbd style={kbd}>Esc</kbd>
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 800, color: 'var(--text)', margin: '20px 0 4px' }}>{tr.counter.bullOff}</div>
            <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-4)', lineHeight: 1.5, marginBottom: 18 }}>{tr.counter.bullOffSub}</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="dh-hover-border" onClick={() => start(0)} style={starterBtn}>
                <span style={{ fontSize: 'var(--fs-lead)', fontWeight: 800, color: 'var(--text)' }}>{ownFirst}</span>
                <span style={{ fontSize: 'var(--fs-badge)', color: 'var(--text-5)' }}>{tr.nextGame.wasCloser}</span>
                <kbd style={kbd}>1</kbd>
              </button>
              <button className="dh-hover-border" onClick={() => start(1)} style={starterBtn}>
                <span style={{ fontSize: 'var(--fs-lead)', fontWeight: 800, color: 'var(--text)' }}>{a.oppName}</span>
                <span style={{ fontSize: 'var(--fs-badge)', color: 'var(--text-5)' }}>{tr.nextGame.wasCloser}</span>
                <kbd style={kbd}>2</kbd>
              </button>
            </div>
            <button onClick={() => setBullFor(null)} style={{ marginTop: 16, background: 'transparent', border: 'none', color: 'var(--text-5)', fontSize: 'var(--fs-sub)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 8 }}>{tr.counter.backArrow} <kbd style={{ ...kbd, marginLeft: 6 }}>Esc</kbd></button>
          </>
        )}
      </div>
    </div>
  );
}
