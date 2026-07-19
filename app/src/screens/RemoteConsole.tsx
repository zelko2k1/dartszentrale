// Fernbedienung am Handy (Plan docs/plan-remote.md, Phase 3).
// Rendert ausschließlich aus session.state (kein lokales Spiel) und schickt jede Aktion als Befehl
// an den Host. Kopplung per Code (aus dem QR-Deep-Link), Übernahme-Bestätigung, Verbindungsanzeige.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import type { LiveRoute } from '../lib/deepLink';
import type { LiveSession } from '../data/provider';

const msg = (e: unknown) => (e instanceof Error ? e.message : 'Fehler');
const ACCENT = '#E0594B';

export function RemoteConsole({ route }: { route: LiveRoute }) {
  const provider = useStore((s) => s.provider);
  const meId = useMemo(() => provider.currentUser()?.id ?? '', [provider]);
  const [session, setSession] = useState<LiveSession | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'gone'>('loading');
  const [claim, setClaim] = useState<'idle' | 'pending' | 'error'>('idle');
  const [err, setErr] = useState('');
  const seqRef = useRef(0);
  const [pendingSeq, setPendingSeq] = useState(0);

  useEffect(() => {
    if (!provider.liveSupported) { setStatus('gone'); return; }
    const unsub = provider.liveWatch(route.sessionId, (s) => { setSession(s); setStatus(s ? 'ok' : 'gone'); });
    return () => { unsub(); void provider.liveRelease(route.sessionId).catch(() => {}); };
  }, [provider, route.sessionId]);

  const isRemote = !!session && meId !== '' && session.remoteUser === meId;
  const someoneElse = !!session && !!session.remoteUser && session.remoteUser !== meId;
  const iRequested = !!session && meId !== '' && session.pendingRemote === meId;
  const takeoverIncoming = isRemote && !!session?.pendingRemote && session.pendingRemote !== meId;
  const acked = (session?.lastAppliedSeq ?? 0) >= pendingSeq;

  async function pair() {
    setErr('');
    try {
      const r = await provider.liveClaim(route.sessionId, route.code);
      setClaim(r.claimed ? 'idle' : r.pending ? 'pending' : 'idle');
    } catch (e) { setClaim('error'); setErr(msg(e)); }
  }
  async function send(type: string, payload: Record<string, unknown> = {}) {
    seqRef.current = Math.max(seqRef.current, session?.lastAppliedSeq ?? 0) + 1;
    const seq = seqRef.current; setPendingSeq(seq);
    try { await provider.liveSend(route.sessionId, seq, type, payload); }
    catch (e) { setErr(msg(e)); }
  }

  // ── Rahmen ──
  const shell: React.CSSProperties = { minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#0b0d0f', color: '#e9edf1', WebkitTapHighlightColor: 'transparent' };
  const center: React.CSSProperties = { ...shell, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center' };
  const bigBtn: React.CSSProperties = { background: ACCENT, color: '#fff', border: 'none', borderRadius: 14, padding: '16px 24px', fontSize: 16, fontWeight: 800, cursor: 'pointer' };
  const ghost: React.CSSProperties = { background: 'transparent', color: '#9aa4ad', border: '1px solid #2a3138', borderRadius: 11, padding: '10px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer' };

  if (status === 'loading') return <div style={center}><div style={{ fontSize: 18, fontWeight: 700 }}>Verbinde…</div></div>;
  if (status === 'gone') return (
    <div style={center}>
      <div style={{ fontSize: 20, fontWeight: 800 }}>Session nicht gefunden</div>
      <div style={{ fontSize: 14, color: '#9aa4ad', maxWidth: 320, lineHeight: 1.5 }}>
        {provider.liveSupported ? 'Die Session ist beendet oder existiert nicht mehr. QR-Code am Board erneut scannen.' : 'Fernbedienung gibt es nur im Vereinsmodus.'}
      </div>
    </div>
  );

  // ── Kopplung nötig ──
  if (!isRemote) {
    return (
      <div style={center}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: ACCENT }}>Fernbedienung</div>
        <div style={{ fontSize: 22, fontWeight: 800 }}>{session?.boardName || 'Board'}</div>
        {iRequested ? (
          <>
            <div style={{ color: ACCENT, fontWeight: 700, maxWidth: 320, lineHeight: 1.5 }}>Übernahme angefragt — warte auf Bestätigung am aktuellen Handy.</div>
            <button style={ghost} onClick={() => provider.liveRelease(route.sessionId)}>Abbrechen</button>
          </>
        ) : someoneElse ? (
          <>
            <div style={{ color: '#9aa4ad', maxWidth: 320, lineHeight: 1.5 }}>Dieses Board wird gerade von einem anderen Handy gesteuert.</div>
            <button style={bigBtn} onClick={pair}>Steuerung übernehmen</button>
          </>
        ) : (
          <button style={bigBtn} onClick={pair}>Als Anschreiber koppeln</button>
        )}
        {claim === 'pending' && <div style={{ color: ACCENT, fontWeight: 700 }}>Übernahme angefragt…</div>}
        {err && <div style={{ color: ACCENT, fontWeight: 700 }}>{err}</div>}
      </div>
    );
  }

  // ── Gekoppelt: Konsole ──
  const st = session?.state ?? null;
  const phase = st?.phase ?? 'idle';
  const players = st?.players ?? [];
  const curIdx = st?.currentIdx ?? 0;

  const keyBtn = (label: React.ReactNode, onClick: () => void, style: React.CSSProperties = {}) => (
    <button onClick={onClick} style={{ background: '#14181c', color: '#e9edf1', border: '1px solid #2a3138', borderRadius: 12, fontSize: 24, fontWeight: 800, padding: '18px 0', cursor: 'pointer', ...style }}>{label}</button>
  );

  return (
    <div style={shell}>
      {/* Kopfzeile */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #1c2228' }}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>{session?.boardName || 'Board'}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: acked ? '#59c26a' : ACCENT, fontWeight: 700 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: acked ? '#59c26a' : ACCENT, display: 'inline-block' }} />
          {acked ? 'verbunden' : 'sendet…'}
        </div>
      </div>

      {takeoverIncoming && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#3a2714', borderBottom: '1px solid #7a5a2a', fontSize: 13 }}>
          <span style={{ flex: 1 }}>Ein anderes Gerät möchte übernehmen.</span>
          <button style={{ ...ghost, padding: '6px 12px' }} onClick={() => provider.liveClaimDeny(route.sessionId)}>Ablehnen</button>
          <button style={{ background: ACCENT, color: '#fff', border: 'none', borderRadius: 9, padding: '6px 12px', fontSize: 13, fontWeight: 800, cursor: 'pointer' }} onClick={() => provider.liveClaimApprove(route.sessionId)}>Zulassen</button>
        </div>
      )}

      {/* Score-Panel */}
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {players.map((p, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 12, background: i === curIdx ? 'rgba(224,89,75,.14)' : '#12161a', border: i === curIdx ? `1px solid ${ACCENT}` : '1px solid #1c2228' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
              <div style={{ fontSize: 11, color: '#9aa4ad' }}>Sets {p.sets} · Legs {p.legs}</div>
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 30, fontWeight: 800, letterSpacing: '.02em' }}>{p.score}</div>
          </div>
        ))}
        {phase === 'playing' && (st?.checkout?.length ?? 0) > 0 && (
          <div style={{ fontSize: 13, color: '#59c26a', fontWeight: 700, textAlign: 'center' }}>Checkout: {st?.checkout.join(' ')}</div>
        )}
      </div>

      {/* Phasen-Steuerung */}
      <div style={{ flex: 1, padding: '4px 16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 12 }}>
        {err && <div style={{ color: ACCENT, fontWeight: 700, textAlign: 'center', fontSize: 13 }}>{err}</div>}

        {phase === 'whoBegins' && (
          <>
            <div style={{ textAlign: 'center', color: '#9aa4ad', fontSize: 14 }}>Wer beginnt?</div>
            {players.map((p, i) => (
              <button key={i} style={bigBtn} onClick={() => send('starter', { idx: i })}>{p.name} beginnt</button>
            ))}
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...ghost, flex: 1 }} onClick={() => send('starter', { mode: 'bull' })}>Bull-Off</button>
              <button style={{ ...ghost, flex: 1 }} onClick={() => send('starter', { mode: 'draw' })}>Losen</button>
            </div>
          </>
        )}

        {phase === 'won' && (
          <>
            <div style={{ textAlign: 'center', fontSize: 18, fontWeight: 800 }}>🏆 {st?.winner} gewinnt!</div>
            <button style={bigBtn} onClick={() => send('rematch')}>Revanche</button>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...ghost, flex: 1 }} onClick={() => send('endGame', { to: 'setup' })}>Neues Spiel</button>
              <button style={{ ...ghost, flex: 1 }} onClick={() => send('endGame', { to: 'dashboard' })}>Dashboard</button>
            </div>
          </>
        )}

        {phase === 'idle' && (
          <>
            <div style={{ textAlign: 'center', color: '#9aa4ad', fontSize: 14, lineHeight: 1.5 }}>Am Board läuft gerade kein Spiel.</div>
            <button style={bigBtn} onClick={() => send('newGame')}>Neues Spiel starten</button>
          </>
        )}

        {(phase === 'playing' || phase === 'bust') && (
          <>
            {/* Eingabepuffer */}
            <div style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 34, fontWeight: 800, minHeight: 42, letterSpacing: '.08em' }}>
              {st?.input || <span style={{ color: '#3a444c' }}>–</span>}
            </div>
            {/* Quick-Scores */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
              {[180, 140, 100, 85, 60, 45, 41, 26].map((v) => (
                <button key={v} onClick={() => send('quick', { v })} style={{ background: '#12161a', color: '#c7ced4', border: '1px solid #1c2228', borderRadius: 10, padding: '10px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>{v}</button>
              ))}
            </div>
            {/* Ziffernblock */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => keyBtn(d, () => send('digit', { d })))}
              {keyBtn('C', () => send('clear'), { fontSize: 20, color: '#9aa4ad' })}
              {keyBtn('0', () => send('digit', { d: '0' }))}
              {keyBtn('⌫', () => send('del'), { fontSize: 20 })}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => send('undo')} style={{ ...ghost, flex: 1, padding: '16px 0', fontSize: 16 }}>↶ Undo</button>
              <button onClick={() => send('enter')} style={{ ...bigBtn, flex: 2, padding: '16px 0' }}>Enter ⏎</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginTop: 2 }}>
              <button onClick={() => send('newGame')} style={{ background: 'none', border: 'none', color: '#6b747c', fontSize: 12, cursor: 'pointer' }}>Neues Spiel</button>
              <button onClick={() => send('abort')} style={{ background: 'none', border: 'none', color: '#6b747c', fontSize: 12, cursor: 'pointer' }}>Abbruch</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
