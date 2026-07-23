// Fernbedienung am Handy (Plan docs/plan-remote.md, Phase 3).
// Rendert ausschließlich aus session.state (kein lokales Spiel) und schickt jede Aktion als Befehl
// an den Host. Kopplung per Code (aus dem QR-Deep-Link), Übernahme-Bestätigung, Verbindungsanzeige.
//
// Layout-Grundsatz: die Konsole ist ein FESTES Vollbild (position:fixed) — nie scrollen, nie zoomen.
// Alles zwischen Kopfzeile und Fußzeile teilt sich die verbleibende Höhe über Flex-Anteile, damit die
// Tasten auf kleinen Handys schrumpfen statt aus dem Bild zu rutschen. Querformat = zwei Spalten.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, type RemoteStartSelection } from '../store/useStore';
import { useDevice } from '../lib/useIsPhone';
import type { LiveRoute } from '../lib/deepLink';
import type { LiveSession } from '../data/provider';

const msg = (e: unknown) => (e instanceof Error ? e.message : 'Fehler');
const ACCENT = '#E0594B';

// Tasten-Optik + Druck-Feedback als CSS (inline styles können kein :active) und Safe-Area fürs iPhone.
const CSS = `
.rc-root{position:fixed;inset:0;display:flex;flex-direction:column;background:#0b0d0f;color:#e9edf1;
  overflow:hidden;-webkit-tap-highlight-color:transparent;touch-action:manipulation;
  user-select:none;-webkit-user-select:none;overscroll-behavior:none;
  padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);}
.rc-root button{font-family:inherit;cursor:pointer;touch-action:manipulation;}
.rc-key,.rc-quick,.rc-primary,.rc-ghost{display:flex;align-items:center;justify-content:center;
  transition:background .08s,transform .08s;}
.rc-key{background:#14181c;color:#e9edf1;border:1px solid #2a3138;border-radius:12px;font-weight:800;
  font-family:var(--font-num,ui-monospace,monospace);font-size:clamp(19px,6vw,27px);min-height:0;min-width:0;}
.rc-key:active{background:#222a31;transform:scale(.96);}
.rc-quick{background:#12161a;color:#c7ced4;border:1px solid #232a31;border-radius:10px;font-weight:800;
  font-family:var(--font-num,inherit);font-size:clamp(13px,3.9vw,17px);min-height:0;min-width:0;}
.rc-quick:active{background:#1c232a;transform:scale(.96);}
.rc-primary{background:${ACCENT};color:#fff;border:none;border-radius:13px;font-weight:800;
  font-size:clamp(15px,4.2vw,18px);min-height:0;}
.rc-primary:active{filter:brightness(.88);transform:scale(.98);}
.rc-ghost{background:transparent;color:#9aa4ad;border:1px solid #2a3138;border-radius:12px;font-weight:700;
  font-size:clamp(13px,3.8vw,16px);min-height:0;}
.rc-ghost:active{background:#161b20;transform:scale(.98);}
.rc-scroll{overflow-y:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;}
.rc-scroll::-webkit-scrollbar{display:none;}
`;

/** Kurzes haptisches Feedback beim Tippen (Android/Chrome; iOS ignoriert es still). */
function buzz() { try { navigator.vibrate?.(8); } catch { /* egal */ } }

export function RemoteConsole({ route }: { route: LiveRoute }) {
  const provider = useStore((s) => s.provider);
  const { isPhoneLandscape, height: vh } = useDevice();
  const meId = useMemo(() => provider.currentUser()?.id ?? '', [provider]);
  // Session-ID: per QR aus dem Deep-Link, oder erst nach manueller Code-Eingaben (dann gesetzt).
  const [sessionId, setSessionId] = useState(route.sessionId);
  const [session, setSession] = useState<LiveSession | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'gone'>('loading');
  const [claim, setClaim] = useState<'idle' | 'pending' | 'error'>('idle');
  const [err, setErr] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [busy, setBusy] = useState(false);
  const seqRef = useRef(0);
  const [pendingSeq, setPendingSeq] = useState(0);
  const activeRowRef = useRef<HTMLDivElement | null>(null);
  // Zuletzt bekannter Kopplungscode (aus QR-Deep-Link oder manueller Eingabe) — Basis für die
  // Selbstheilung, wenn die beobachtete Session-ID nach einem Board-Neuladen veraltet ist.
  const codeRef = useRef((route.code || '').trim().toUpperCase());
  const triedFallback = useRef(false);

  useEffect(() => {
    triedFallback.current = false;                // je Session-ID einen Heilungsversuch erlauben
    if (!sessionId) return;                       // noch keine Session (manuelle Eingabe offen)
    if (!provider.liveSupported) { setStatus('gone'); return; }
    const unsub = provider.liveWatch(sessionId, (s) => {
      setSession(s);
      if (s) { setStatus('ok'); return; }
      // Session weg: nach einem Board-Neuladen zeigt die im QR eingebettete ID ins Leere. Kennen wir
      // den Code, lösen wir die jetzt aktive Session dazu auf und beobachten sie (QR-Selbstheilung).
      const code = codeRef.current;
      if (code && !triedFallback.current) {
        triedFallback.current = true;
        void provider.liveFindByCode(code).then((id) => {
          if (id && id !== sessionId) setSessionId(id); // löst den Effekt neu aus → neue Session
          else setStatus('gone');
        }).catch(() => setStatus('gone'));
        return;
      }
      setStatus('gone');
    });
    return () => { unsub(); void provider.liveRelease(sessionId).catch(() => {}); };
  }, [provider, sessionId]);

  // Bei vielen Spielern ist die Liste gedeckelt — den Spieler am Wurf immer ins Bild holen.
  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [session?.state?.currentIdx]);

  const isRemote = !!session && meId !== '' && session.remoteUser === meId;
  const someoneElse = !!session && !!session.remoteUser && session.remoteUser !== meId;
  const iRequested = !!session && meId !== '' && session.pendingRemote === meId;
  const takeoverIncoming = isRemote && !!session?.pendingRemote && session.pendingRemote !== meId;
  const acked = (session?.lastAppliedSeq ?? 0) >= pendingSeq;

  async function pair() {
    setErr('');
    try {
      const r = await provider.liveClaim(sessionId, route.code);
      setClaim(r.claimed ? 'idle' : r.pending ? 'pending' : 'idle');
    } catch (e) { setClaim('error'); setErr(msg(e)); }
  }
  async function pairByCode() {
    const code = manualCode.trim().toUpperCase();
    if (code.length < 4) return;
    codeRef.current = code;                        // für die Selbstheilung merken (auch ohne QR)
    setErr(''); setBusy(true);
    try {
      const r = await provider.liveClaimByCode(code);
      setSessionId(r.sessionId);                  // ab jetzt beobachten wir die gefundene Session
      setClaim(r.pending ? 'pending' : 'idle');
    } catch (e) { setErr(msg(e)); }
    finally { setBusy(false); }
  }
  async function send(type: string, payload: Record<string, unknown> = {}) {
    buzz();
    seqRef.current = Math.max(seqRef.current, session?.lastAppliedSeq ?? 0) + 1;
    const seq = seqRef.current; setPendingSeq(seq);
    try { await provider.liveSend(sessionId, seq, type, payload); }
    catch (e) { setErr(msg(e)); }
  }

  // ── Rahmen ──
  const style = <style>{CSS}</style>;
  const center: React.CSSProperties = { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center', overflowY: 'auto' };
  const bigBtn: React.CSSProperties = { padding: '16px 24px', fontSize: 16 };
  const hint: React.CSSProperties = { fontSize: 14, color: '#9aa4ad', maxWidth: 320, lineHeight: 1.5 };

  // ── Manuelle Code-Eingabe (Aufruf über #/remote ohne Session-ID) ──
  if (!sessionId) {
    if (!provider.liveSupported) return (
      <div className="rc-root">{style}<div style={center}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Nur im Vereinsmodus</div>
        <div style={hint}>Die Fernbedienung ist nur im Vereins-/Board-Modus verfügbar.</div>
      </div></div>
    );
    return (
      <div className="rc-root">{style}
        <div style={center}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: ACCENT }}>Fernbedienung</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>Code eingeben</div>
          <div style={hint}>Den Kopplungscode findest du am Board unter <b>Einstellungen → Handy koppeln</b>.</div>
          <input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value.toUpperCase().slice(0, 8))}
            onKeyDown={(e) => { if (e.key === 'Enter') void pairByCode(); }}
            placeholder="z. B. DVXR2K"
            autoCapitalize="characters" autoCorrect="off" spellCheck={false} autoFocus
            style={{ width: 220, maxWidth: '80vw', textAlign: 'center', fontFamily: 'var(--font-num,ui-monospace,monospace)', fontSize: 28, fontWeight: 800, letterSpacing: '.18em', background: '#12161a', border: '1px solid #2a3138', borderRadius: 12, padding: '14px 12px', color: '#e9edf1', outline: 'none' }}
          />
          <button className="rc-primary" style={{ ...bigBtn, opacity: busy || manualCode.trim().length < 4 ? 0.5 : 1 }} disabled={busy || manualCode.trim().length < 4} onClick={pairByCode}>Koppeln</button>
          {err && <div style={{ color: ACCENT, fontWeight: 700 }}>{err}</div>}
        </div>
      </div>
    );
  }

  if (status === 'loading') return <div className="rc-root">{style}<div style={center}><div style={{ fontSize: 18, fontWeight: 700 }}>Verbinde…</div></div></div>;
  if (status === 'gone') return (
    <div className="rc-root">{style}<div style={center}>
      <div style={{ fontSize: 20, fontWeight: 800 }}>Session nicht gefunden</div>
      <div style={hint}>
        {provider.liveSupported ? 'Die Session ist beendet oder existiert nicht mehr. QR-Code am Board erneut scannen.' : 'Fernbedienung gibt es nur im Vereinsmodus.'}
      </div>
    </div></div>
  );

  // ── Kopplung nötig ──
  if (!isRemote) {
    return (
      <div className="rc-root">{style}
        <div style={center}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: ACCENT }}>Fernbedienung</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{session?.boardName || 'Board'}</div>
          {iRequested ? (
            <>
              <div style={{ ...hint, color: ACCENT, fontWeight: 700 }}>Übernahme angefragt — warte auf Bestätigung am aktuellen Handy.</div>
              <button className="rc-ghost" style={{ padding: '10px 16px' }} onClick={() => provider.liveRelease(sessionId)}>Abbrechen</button>
            </>
          ) : someoneElse ? (
            <>
              <div style={hint}>Dieses Board wird gerade von einem anderen Handy gesteuert.</div>
              <button className="rc-primary" style={bigBtn} onClick={pair}>Steuerung übernehmen</button>
            </>
          ) : (
            <button className="rc-primary" style={bigBtn} onClick={pair}>Als Anschreiber koppeln</button>
          )}
          {claim === 'pending' && <div style={{ color: ACCENT, fontWeight: 700 }}>Übernahme angefragt…</div>}
          {err && <div style={{ color: ACCENT, fontWeight: 700 }}>{err}</div>}
        </div>
      </div>
    );
  }

  // ── Gekoppelt: Konsole ──
  const st = session?.state ?? null;
  const phase = st?.phase ?? 'idle';
  const players = st?.players ?? [];
  const curIdx = st?.currentIdx ?? 0;
  // Enge Displays (kleines Handy, eingeblendete Browserleisten) oder viele Spieler: oben Höhe sparen,
  // damit die Zifferntasten fingerfreundlich groß bleiben (statt alles gleichmäßig zu schrumpfen).
  const tight = vh < 620;
  const many = players.length > 2 || tight;
  const quickValues = tight ? [180, 140, 100, 60] : [180, 140, 100, 85, 60, 45, 41, 26];

  const header = (
    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', borderBottom: '1px solid #1c2228' }}>
      <div style={{ fontWeight: 800, fontSize: 14, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session?.boardName || 'Board'}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: acked ? '#59c26a' : ACCENT, fontWeight: 700, flexShrink: 0 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: acked ? '#59c26a' : ACCENT, display: 'inline-block' }} />
        {acked ? 'verbunden' : 'sendet…'}
      </div>
    </div>
  );

  const takeoverBar = takeoverIncoming && (
    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: '#3a2714', borderBottom: '1px solid #7a5a2a', fontSize: 13 }}>
      <span style={{ flex: 1, minWidth: 0 }}>Ein anderes Gerät möchte übernehmen.</span>
      <button className="rc-ghost" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => provider.liveClaimDeny(sessionId)}>Ablehnen</button>
      <button className="rc-primary" style={{ padding: '6px 12px', fontSize: 13, borderRadius: 9 }} onClick={() => provider.liveClaimApprove(sessionId)}>Zulassen</button>
    </div>
  );

  // Spielerliste: gedeckelt auf ein Drittel der Höhe und intern scrollend, damit sie bei 4 Spielern
  // nicht den Ziffernblock auffrisst; der Spieler am Wurf wird automatisch sichtbar gehalten.
  const scorePanel = (
    <div className="rc-scroll" style={{ flex: '0 1 auto', minHeight: 0, maxHeight: tight ? '26vh' : '33vh', padding: tight ? '8px 14px 4px' : '10px 14px 6px', display: 'flex', flexDirection: 'column', gap: many ? 5 : 6 }}>
      {players.map((p, i) => (
        <div key={i} ref={i === curIdx ? activeRowRef : undefined} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: many ? '5px 11px' : '9px 13px', borderRadius: 12, background: i === curIdx ? 'rgba(224,89,75,.14)' : '#12161a', border: i === curIdx ? `1px solid ${ACCENT}` : '1px solid #1c2228' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: many ? 'row' : 'column', alignItems: many ? 'baseline' : 'stretch', gap: many ? 8 : 0 }}>
            <div style={{ fontWeight: 800, fontSize: many ? 13 : 15, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
            <div style={{ fontSize: 11, color: '#9aa4ad', flexShrink: 0, whiteSpace: 'nowrap' }}>{many ? `${p.sets}·${p.legs}` : `Sets ${p.sets} · Legs ${p.legs}`}</div>
          </div>
          <div style={{ fontFamily: 'var(--font-num,ui-monospace,monospace)', fontSize: many ? 21 : 30, fontWeight: 800, letterSpacing: '.02em', lineHeight: 1.15, fontVariantNumeric: 'tabular-nums' }}>{p.score}</div>
        </div>
      ))}
    </div>
  );

  // Eingabepuffer + Checkout in EINER Zeile (spart die Höhe, die vorher zwei Blöcke gefressen haben).
  const inputRow = (
    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, background: '#12161a', border: '1px solid #232a31', borderRadius: 12, padding: '8px 14px' }}>
      <span style={{ fontSize: 12, color: '#6b747c', fontWeight: 700, flexShrink: 0 }}>Wurf</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, color: '#59c26a', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {phase === 'playing' && (st?.checkout?.length ?? 0) > 0 ? st?.checkout.join(' ') : ''}
      </span>
      <span style={{ fontFamily: 'var(--font-num,ui-monospace,monospace)', fontSize: 28, fontWeight: 800, letterSpacing: '.06em', minWidth: 62, textAlign: 'right', color: st?.input ? '#e9edf1' : '#3a444c', fontVariantNumeric: 'tabular-nums' }}>{st?.input || '–'}</span>
    </div>
  );

  const quickGrid = (
    // Flex-Anteil je Reihe etwas unter dem Ziffernblock (0.9) — die Ziffern sind die wichtigeren Tasten
    // und sollen auf engen Displays zuerst Platz bekommen.
    <div style={{ flex: `${0.72 * quickValues.length / 4} 1 0`, minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gridAutoRows: '1fr', gap: 7 }}>
      {quickValues.map((v) => (
        <button key={v} className="rc-quick" onClick={() => send('quick', { v })}>{v}</button>
      ))}
    </div>
  );

  const numPad = (
    <div style={{ flex: '3.6 1 0', minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gridAutoRows: '1fr', gap: 7 }}>
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
        <button key={d} className="rc-key" onClick={() => send('digit', { d })}>{d}</button>
      ))}
      <button className="rc-key" style={{ fontSize: 18, color: '#9aa4ad' }} onClick={() => send('clear')}>C</button>
      <button className="rc-key" onClick={() => send('digit', { d: '0' })}>0</button>
      <button className="rc-key" style={{ fontSize: 20 }} onClick={() => send('del')} aria-label="Löschen">⌫</button>
    </div>
  );

  const actionRow = (
    <div style={{ flexShrink: 0, display: 'flex', gap: 8, height: 'clamp(46px,7.5vh,58px)' }}>
      <button className="rc-ghost" style={{ flex: 1 }} onClick={() => send('undo')}>↶ Undo</button>
      <button className="rc-primary" style={{ flex: 2 }} onClick={() => send('enter')}>Enter ⏎</button>
    </div>
  );

  const footer = (
    <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', gap: 10, height: 'clamp(38px,5.5vh,48px)' }}>
      <button className="rc-ghost" style={{ flex: 1, maxWidth: 200, fontSize: 14, fontWeight: 700 }} onClick={() => send('newGame')}>Neues Spiel</button>
      <button className="rc-ghost" style={{ flex: 1, maxWidth: 200, fontSize: 14, fontWeight: 700 }} onClick={() => send('abort')}>Abbruch</button>
    </div>
  );

  const errLine = err && <div style={{ flexShrink: 0, color: ACCENT, fontWeight: 700, textAlign: 'center', fontSize: 13 }}>{err}</div>;

  // Finish-Dart-Abfrage: erscheint auch am Handy (nicht mehr nur am Board), sobald der Checkout ohne
  // bekannte Dartzahl fällt. Deckt die Konsole als Modal ab; 1/2/3 unterhalb der Mindestzahl gesperrt.
  const finishOverlay = st?.finish && (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,10,12,.92)', backdropFilter: 'blur(3px)', zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 19, fontWeight: 800, color: '#e9edf1' }}>Mit welchem Dart beendet?</div>
      <div style={{ display: 'flex', gap: 12 }}>
        {[1, 2, 3].map((d) => {
          const off = d < (st.finish?.minDarts ?? 1);
          return <button key={d} className="rc-key" disabled={off} style={{ width: 80, height: 80, fontSize: 32, opacity: off ? 0.3 : 1 }} onClick={() => !off && send('finishDart', { d })}>{d}</button>;
        })}
      </div>
      <button className="rc-ghost" style={{ padding: '11px 22px' }} onClick={() => send('finishCancel')}>Zurück</button>
    </div>
  );

  // Nicht-Spiel-Phasen (Starterwahl, Sieg, Leerlauf): mittig, scrollt notfalls.
  const phasePanel = (
    <div className="rc-scroll" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12, padding: '10px 16px 16px' }}>
      {errLine}
      {phase === 'whoBegins' && (
        <>
          <div style={{ textAlign: 'center', color: '#9aa4ad', fontSize: 14 }}>Wer beginnt?</div>
          {players.map((p, i) => (
            <button key={i} className="rc-primary" style={{ padding: '14px 18px' }} onClick={() => send('starter', { idx: i })}>{p.name} beginnt</button>
          ))}
          <button className="rc-ghost" style={{ padding: '12px 0' }} onClick={() => send('starter', { mode: 'bull' })}>Bull-Off</button>
        </>
      )}
      {phase === 'won' && (
        <>
          <div style={{ textAlign: 'center', fontSize: 18, fontWeight: 800 }}>🏆 {st?.winner} gewinnt!</div>
          <button className="rc-primary" style={{ padding: '15px 18px' }} onClick={() => send('rematch')}>Revanche</button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="rc-ghost" style={{ flex: 1, padding: '12px 0' }} onClick={() => send('endGame', { to: 'setup' })}>Neues Spiel</button>
            <button className="rc-ghost" style={{ flex: 1, padding: '12px 0' }} onClick={() => send('endGame', { to: 'dashboard' })}>Dashboard</button>
          </div>
        </>
      )}
      {phase === 'idle' && <StartMenu onStart={(sel) => send('startCustom', sel as unknown as Record<string, unknown>)} />}
    </div>
  );

  const playing = phase === 'playing' || phase === 'bust';

  // Querformat: Stand links, Tastenfeld rechts — sonst passt im Landscape nichts aufs Bild.
  if (playing && isPhoneLandscape) {
    return (
      <div className="rc-root">{style}
        {header}
        {takeoverBar}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 10, padding: '8px 12px 10px' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="rc-scroll" style={{ flex: '0 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {players.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', borderRadius: 10, background: i === curIdx ? 'rgba(224,89,75,.14)' : '#12161a', border: i === curIdx ? `1px solid ${ACCENT}` : '1px solid #1c2228' }}>
                  <div style={{ flex: 1, minWidth: 0, fontWeight: 800, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  <div style={{ fontFamily: 'var(--font-num,ui-monospace,monospace)', fontSize: 24, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{p.score}</div>
                </div>
              ))}
            </div>
            {inputRow}
            {quickGrid}
            {footer}
          </div>
          <div style={{ width: '44%', maxWidth: 340, minWidth: 210, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
            {numPad}
            {actionRow}
          </div>
        </div>
        {finishOverlay}
      </div>
    );
  }

  return (
    <div className="rc-root">{style}
      {header}
      {takeoverBar}
      {finishOverlay}
      {playing ? (
        <>
          {scorePanel}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 14px 10px' }}>
            {errLine}
            {inputRow}
            {quickGrid}
            {numPad}
            {actionRow}
            {footer}
          </div>
        </>
      ) : (
        <>
          {/* Im Leerlauf KEIN Score-Panel — sonst zeigten die Board-Platzhalter (gamePlayers) oben mit.
              Das Startmenü bringt seine eigene Spielerwahl mit. */}
          {phase !== 'idle' && scorePanel}
          {phasePanel}
        </>
      )}
    </div>
  );
}

// ── Startmenü der Fernbedienung (Leerlauf) ──
// Kompaktes „neues Spiel"-Menü: zwei Spieler-Zeilen (antippen → aus dem Kader wählen) + Modus-Zeile
// (antippen → Format einstellen). Der Kader liegt am angemeldeten Handy bereits im Store. „Starten"
// schickt Spieler-IDs + Format als Befehl; das Board bildet es ab und geht in die Anwurf-Phase.
function StartMenu({ onStart }: { onStart: (sel: RemoteStartSelection) => void }) {
  const players = useStore((s) => s.players);
  // Standard-Spieler („Spieler 1/2", locked) oben — wie am Board.
  const roster = useMemo(() => {
    const locked = players.filter((p) => p.locked);
    const rest = players.filter((p) => !p.locked);
    return [...locked, ...rest];
  }, [players]);
  const [p1Id, setP1Id] = useState('');
  const [p2Id, setP2Id] = useState('');
  const [fmt, setFmt] = useState<{ startScore: number; outMode: 'single' | 'double' | 'master'; doubleIn: boolean; unit: 'legs' | 'sets'; bestOf: number; bestOfSets: number }>(
    { startScore: 501, outMode: 'double', doubleIn: false, unit: 'legs', bestOf: 5, bestOfSets: 3 });
  const [picker, setPicker] = useState<null | 'p1' | 'p2' | 'mode'>(null);

  // Vorbelegung: die ersten beiden (Standard-)Spieler, sobald der Kader geladen ist.
  const effP1 = p1Id || roster[0]?.id || '';
  const effP2 = p2Id || roster[1]?.id || roster[0]?.id || '';
  const nameOf = (id: string) => roster.find((p) => p.id === id)?.name || '—';

  const outLabel = fmt.outMode === 'master' ? 'Master Out' : fmt.outMode === 'single' ? 'Single Out' : 'Double Out';
  const modeSummary = `${fmt.startScore} · ${outLabel}${fmt.doubleIn ? ' · Double In' : ''} · ${fmt.unit === 'sets' ? `Best of ${fmt.bestOfSets} Sets` : `Best of ${fmt.bestOf}`}`;

  const start = () => onStart({ p1Id: effP1, p2Id: effP2, startScore: fmt.startScore, outMode: fmt.outMode, doubleIn: fmt.doubleIn, unit: fmt.unit, bestOf: fmt.bestOf, bestOfSets: fmt.bestOfSets });

  const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: '#12161a', border: '1px solid #232a31', borderRadius: 12, padding: '13px 15px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' };
  const rowLabel: React.CSSProperties = { fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#6b747c' };
  const rowValue: React.CSSProperties = { fontSize: 16, fontWeight: 800, color: '#e9edf1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
  const chevron = <span style={{ marginLeft: 'auto', color: '#6b747c', fontSize: 18, flexShrink: 0 }}>›</span>;

  const playerRow = (slot: 'p1' | 'p2', label: string, id: string) => (
    <button style={rowStyle} onClick={() => setPicker(slot)}>
      <div style={{ minWidth: 0 }}>
        <div style={rowLabel}>{label}</div>
        <div style={rowValue}>{nameOf(id)}</div>
      </div>
      {chevron}
    </button>
  );

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 420, margin: '0 auto' }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: ACCENT, textAlign: 'center' }}>Neues Spiel</div>
        {playerRow('p1', 'Spieler 1', effP1)}
        {playerRow('p2', 'Spieler 2', effP2)}
        <button style={rowStyle} onClick={() => setPicker('mode')}>
          <div style={{ minWidth: 0 }}>
            <div style={rowLabel}>Spielmodus</div>
            <div style={{ ...rowValue, fontSize: 14, fontFamily: 'var(--font-num,ui-monospace,monospace)' }}>{modeSummary}</div>
          </div>
          {chevron}
        </button>
        <button className="rc-primary" style={{ padding: '15px 18px', marginTop: 4 }} onClick={start}>Spiel starten</button>
      </div>

      {(picker === 'p1' || picker === 'p2') && (
        <PickerSheet title={picker === 'p1' ? 'Spieler 1 wählen' : 'Spieler 2 wählen'} onClose={() => setPicker(null)}>
          {roster.map((p) => {
            const on = (picker === 'p1' ? effP1 : effP2) === p.id;
            return (
              <button key={p.id} className="rc-key" style={{ justifyContent: 'flex-start', gap: 12, padding: '13px 15px', fontSize: 15, fontFamily: 'inherit', fontWeight: 700, background: on ? 'rgba(224,89,75,.14)' : '#14181c', border: on ? `1px solid ${ACCENT}` : '1px solid #2a3138' }}
                onClick={() => { if (picker === 'p1') setP1Id(p.id); else setP2Id(p.id); setPicker(null); }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, background: '#222a31', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#c7ced4', flexShrink: 0 }}>{p.short}</span>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
              </button>
            );
          })}
        </PickerSheet>
      )}

      {picker === 'mode' && (
        <PickerSheet title="Spielmodus" onClose={() => setPicker(null)}>
          <ModeGroup label="Startpunkte">
            {[301, 501, 701, 1001].map((v) => <Seg key={v} on={fmt.startScore === v} onClick={() => setFmt((f) => ({ ...f, startScore: v }))}>{v}</Seg>)}
          </ModeGroup>
          <ModeGroup label="Out-Modus">
            {([['double', 'Double'], ['master', 'Master'], ['single', 'Single']] as const).map(([v, l]) => <Seg key={v} on={fmt.outMode === v} onClick={() => setFmt((f) => ({ ...f, outMode: v }))}>{l}</Seg>)}
          </ModeGroup>
          <ModeGroup label="Double In">
            <Seg on={!fmt.doubleIn} onClick={() => setFmt((f) => ({ ...f, doubleIn: false }))}>Aus</Seg>
            <Seg on={fmt.doubleIn} onClick={() => setFmt((f) => ({ ...f, doubleIn: true }))}>An</Seg>
          </ModeGroup>
          <ModeGroup label="Zählweise">
            <Seg on={fmt.unit === 'legs'} onClick={() => setFmt((f) => ({ ...f, unit: 'legs' }))}>Legs</Seg>
            <Seg on={fmt.unit === 'sets'} onClick={() => setFmt((f) => ({ ...f, unit: 'sets' }))}>Sets</Seg>
          </ModeGroup>
          {fmt.unit === 'sets' ? (
            <ModeGroup label="Best of Sets">
              {[3, 5].map((v) => <Seg key={v} on={fmt.bestOfSets === v} onClick={() => setFmt((f) => ({ ...f, bestOfSets: v }))}>{v}</Seg>)}
            </ModeGroup>
          ) : (
            <ModeGroup label="Best of Legs">
              {[1, 3, 5, 7, 9, 11].map((v) => <Seg key={v} on={fmt.bestOf === v} onClick={() => setFmt((f) => ({ ...f, bestOf: v }))}>{v}</Seg>)}
            </ModeGroup>
          )}
          <button className="rc-primary" style={{ padding: '14px 18px', marginTop: 6 }} onClick={() => setPicker(null)}>Fertig</button>
        </PickerSheet>
      )}
    </>
  );
}

// Vollflächiges Auswahl-Blatt über der Konsole (scrollt intern, schließt per „×").
function PickerSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0b0d0f', zIndex: 40, display: 'flex', flexDirection: 'column', padding: 'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)' }}>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid #1c2228' }}>
        <div style={{ flex: 1, fontWeight: 800, fontSize: 16 }}>{title}</div>
        <button onClick={onClose} aria-label="Schließen" className="rc-ghost" style={{ width: 40, height: 40, borderRadius: 10, fontSize: 20 }}>×</button>
      </div>
      <div className="rc-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: 16 }}>
        {children}
      </div>
    </div>
  );
}

function ModeGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#6b747c' }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{children}</div>
    </div>
  );
}

function Seg({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ flex: '1 0 auto', minWidth: 64, padding: '11px 16px', borderRadius: 10, fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'var(--font-num,inherit)', background: on ? ACCENT : '#14181c', color: on ? '#fff' : '#c7ced4', border: on ? 'none' : '1px solid #2a3138' }}>{children}</button>
  );
}
