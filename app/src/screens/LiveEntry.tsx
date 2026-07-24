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
  const [selected, setSelected] = useState<string | null>(null); // boardName des gewählten Spiels (null = Auswahl-Liste)

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

  // Gewähltes Spiel (per boardName) noch aktiv? → Vollansicht mit „Zurück zur Liste".
  const current = selected ? active.find((b) => b.boardName === selected) : null;
  if (current) return (
    <div style={{ ...shell, justifyContent: 'flex-start' }}>
      <FullBoard board={current} onBack={() => setSelected(null)} />
    </div>
  );

  if (active.length === 0) return <div style={shell}><div style={{ fontSize: 'clamp(22px,4vw,40px)', fontWeight: 800, color: '#6b747c' }}>Warten auf das nächste Spiel…</div></div>;

  // Landing-Liste: immer erst die laufenden Spiele zeigen, dann eins auswählen.
  return (
    <div style={{ ...shell, justifyContent: 'flex-start' }}>
      <div style={{ fontSize: 'clamp(22px,3.5vw,34px)', fontWeight: 900 }}>Spiel wählen</div>
      <div style={{ fontSize: 14, color: '#9aa4ad', marginTop: -8 }}>{active.length} {active.length === 1 ? 'laufendes Spiel' : 'laufende Spiele'} · tippe zum Ansehen</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))', gap: 16, width: '100%', maxWidth: 1100 }}>
        {active.map((b, i) => <GameListItem key={i} board={b} onSelect={() => setSelected(b.boardName)} />)}
      </div>
    </div>
  );
}

const fmtAvg = (v?: number) => (v && v > 0 ? v.toFixed(1) : '–');

// Ein Eintrag der Auswahl-Liste: Board, beide Spieler mit Legs/Sets + Restscore, „Live/Beendet"-Badge.
function GameListItem({ board, onSelect }: { board: PublicBoard; onSelect: () => void }) {
  const st = board.state;
  const won = st?.phase === 'won';
  return (
    <button onClick={onSelect} className="dh-hover-border" style={{ textAlign: 'left', cursor: 'pointer', background: '#12161a', border: '1px solid #1c2228', borderRadius: 16, padding: '18px 20px', color: '#e9edf1', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9aa4ad' }}>{board.boardName || 'Board'}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: won ? '#f2b829' : '#59c26a' }}>{won ? '🏆 Beendet' : '● Live'}</span>
      </div>
      {(st?.players ?? []).map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontSize: 18, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <span style={{ fontSize: 12, color: '#9aa4ad' }}>L{p.legs} · S{p.sets}</span>
            <span style={{ fontFamily: 'monospace', fontSize: 24, fontWeight: 800, minWidth: 52, textAlign: 'right' }}>{p.score}</span>
          </span>
        </div>
      ))}
      <div style={{ fontSize: 13, fontWeight: 800, color: '#E0594B', marginTop: 2 }}>▶ Ansehen</div>
    </button>
  );
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return <div style={{ background: `color-mix(in srgb, ${color} 16%, #12161a)`, border: `1px solid ${color}`, color, borderRadius: 12, padding: 'clamp(8px,1.6vw,12px) clamp(14px,2.4vw,22px)', fontSize: 'clamp(15px,2.3vw,24px)', fontWeight: 800 }}>{children}</div>;
}
function Stat({ label, value }: { label: string; value: string }) {
  return <span><span style={{ color: '#7c858d', fontWeight: 700 }}>{label}</span> <strong style={{ color: '#e9edf1', fontFamily: 'monospace' }}>{value}</strong></span>;
}

// Vollansicht eines Spiels: Restscore + Legs/Sets (wie bisher) PLUS Statistik-Zeile (3-Dart-Schnitt, 180er,
// High Finish) und ein persistentes Highlight (Shortleg/High Finish); Match-Ende hat Vorrang.
function FullBoard({ board, onBack }: { board: PublicBoard; onBack: () => void }) {
  const st = board.state;
  const curIdx = st?.currentIdx ?? 0;
  const won = st?.phase === 'won';
  const hl = st?.highlight;
  return (
    <div style={{ width: '100%', maxWidth: 1000, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <button onClick={onBack} style={{ background: '#12161a', border: '1px solid #1c2228', color: '#e9edf1', borderRadius: 10, padding: '10px 16px', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>← Zur Liste</button>
        <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9aa4ad' }}>{board.boardName || 'Board'}</span>
        <span style={{ width: 96 }} />
      </div>

      {won ? (
        <div style={{ textAlign: 'center', fontSize: 'clamp(28px,6vw,56px)', fontWeight: 900, color: '#f2b829' }}>🏆 {st?.winner} gewinnt!</div>
      ) : hl ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
          {hl.shortLeg && <Badge color="#59c26a">⚡ {hl.player} · Shortleg · {hl.darts} Darts</Badge>}
          {hl.highFinish && <Badge color="#E0594B">🎯 {hl.player} · High Finish {hl.score}</Badge>}
        </div>
      ) : null}

      {(st?.players ?? []).map((p, i) => {
        const cur = i === curIdx && !won;
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 'clamp(16px,2.5vw,26px)', borderRadius: 18, background: cur ? 'rgba(224,89,75,.14)' : '#12161a', border: cur ? '1px solid #E0594B' : '1px solid #1c2228', textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 'clamp(22px,4vw,40px)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                <div style={{ fontSize: 'clamp(13px,1.6vw,16px)', color: '#9aa4ad' }}>Sets {p.sets} · Legs {p.legs}</div>
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 'clamp(48px,12vw,132px)', fontWeight: 800, lineHeight: 1 }}>{p.score}</div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(12px,2vw,26px)', fontSize: 'clamp(13px,1.7vw,18px)', color: '#c3ccd4' }}>
              <Stat label="⌀3" value={fmtAvg(p.avg3)} />
              <Stat label="180er" value={String(p.c180 ?? 0)} />
              <Stat label="High Finish" value={p.hf ? String(p.hf) : '–'} />
            </div>
            {cur && (st?.checkout?.length ?? 0) > 0 && (
              <div style={{ fontSize: 'clamp(15px,2vw,22px)', color: '#59c26a', fontWeight: 700 }}>Checkout: {st?.checkout.join(' ')}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
