// Einstieg für Remote & Live (Plan docs/plan-remote.md). Router für den Deep-Link:
//   #/remote/<id> → Fernbedienung (Phase 3, RemoteConsole)
//   #/watch/<id>  → Zuschauer, read-only (schlanke Ansicht; die vollwertige TV-Ansicht folgt in Phase 4)
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { createProvider } from '../data/dataProvider';
import type { LiveRoute } from '../lib/deepLink';
import type { LiveSession } from '../data/provider';
import { RemoteConsole } from './RemoteConsole';

export function LiveEntry({ route }: { route: LiveRoute }) {
  if (route.mode === 'remote') return <RemoteConsole route={route} />;
  return <WatchView route={route} />;
}

// Login-freier Zuschauer-TV (Plan docs/plan-remote.md, Phase 4): der Deep-Link-Wert ist ein WATCH-TOKEN
// (nicht eine Session-ID). Ohne Anmeldung wird per Polling der öffentliche Endpunkt abgefragt; er liefert
// NUR Boardname + Spielstand und nur, wenn der Kanal aktiv ist und der Token stimmt (serverseitig geprüft).
type PublicBoard = { boardName: string; state: LiveSession['state'] };

function WatchView({ route }: { route: LiveRoute }) {
  const storeProvider = useStore((s) => s.provider);
  // Login-frei & modus-unabhängig: ein frischer TV-Browser hat evtl. noch keinen „Vereinsmodus" gewählt
  // (dann wäre der Store-Provider lokal). Für die Watch-Ansicht immer einen Server-Provider verwenden
  // (URL aus Einstellung/VITE_PB_URL/same-origin) — watchPublic braucht keine Anmeldung.
  const provider = useMemo(() => (storeProvider.liveSupported ? storeProvider : createProvider('verein')), [storeProvider]);
  const token = route.sessionId; // im Watch-Modus trägt das Deep-Link-Segment den Token
  const [boards, setBoards] = useState<PublicBoard[]>([]);
  const [status, setStatus] = useState<'loading' | 'ok' | 'off'>('loading');

  useEffect(() => {
    if (!provider.liveSupported) { setStatus('off'); return; }
    let alive = true;
    const tick = async () => {
      try {
        const r = await provider.watchPublic(token);
        if (!alive) return;
        setBoards(r.boards); setStatus('ok');
      } catch { if (alive) setStatus('off'); }
    };
    void tick();
    const id = window.setInterval(tick, 1500);
    return () => { alive = false; window.clearInterval(id); };
  }, [provider, token]);

  const shell: React.CSSProperties = { flex: 1, width: '100%', boxSizing: 'border-box', minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 'clamp(16px,4vw,48px)', background: '#0b0d0f', color: '#e9edf1', textAlign: 'center' };
  const active = boards.filter((b) => b.state && b.state.phase !== 'idle');

  if (status === 'loading') return <div style={shell}><div style={{ fontSize: 22 }}>Verbinde…</div></div>;
  if (status === 'off') return (
    <div style={shell}>
      <div style={{ fontSize: 26, fontWeight: 800 }}>Zuschauen nicht verfügbar</div>
      <div style={{ fontSize: 15, color: '#9aa4ad', maxWidth: 420, lineHeight: 1.5 }}>Der öffentliche Zuschauer-Kanal ist deaktiviert oder der Link ist ungültig.</div>
    </div>
  );
  if (active.length === 0) return <div style={shell}><div style={{ fontSize: 'clamp(22px,4vw,40px)', fontWeight: 800, color: '#6b747c' }}>Warten auf das nächste Spiel…</div></div>;

  if (active.length === 1) return (
    <div style={shell}>
      <div style={{ width: '100%', maxWidth: 900, display: 'flex', justifyContent: 'center' }}>
        <BoardCard board={active[0]} big />
      </div>
    </div>
  );
  return (
    <div style={{ ...shell, justifyContent: 'flex-start' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 20, width: '100%' }}>
        {active.map((b, i) => <BoardCard key={i} board={b} />)}
      </div>
    </div>
  );
}

function BoardCard({ board, big = false }: { board: PublicBoard; big?: boolean }) {
  const st = board.state;
  const curIdx = st?.currentIdx ?? 0;
  const nameFs = big ? 'clamp(22px,4vw,40px)' : 22;
  const scoreFs = big ? 'clamp(48px,12vw,140px)' : 52;
  return (
    <div style={{ width: '100%', maxWidth: big ? 900 : undefined, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: big ? 18 : 12 }}>
      <div style={{ fontSize: big ? 16 : 13, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9aa4ad' }}>{board.boardName || 'Board'}</div>
      {(st?.players ?? []).map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: big ? '22px 28px' : '16px 20px', borderRadius: 16, background: i === curIdx ? 'rgba(224,89,75,.14)' : '#12161a', border: i === curIdx ? '1px solid #E0594B' : '1px solid #1c2228' }}>
          <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: nameFs, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
            <div style={{ fontSize: big ? 15 : 12, color: '#9aa4ad' }}>Sets {p.sets} · Legs {p.legs}</div>
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: scoreFs, fontWeight: 800, lineHeight: 1 }}>{p.score}</div>
        </div>
      ))}
      {st?.phase === 'won' && <div style={{ fontSize: big ? 'clamp(24px,5vw,44px)' : 22, fontWeight: 800 }}>🏆 {st.winner} gewinnt!</div>}
      {st?.phase === 'playing' && (st?.checkout?.length ?? 0) > 0 && <div style={{ fontSize: big ? 20 : 15, color: '#59c26a', fontWeight: 700 }}>Checkout: {st?.checkout.join(' ')}</div>}
    </div>
  );
}
