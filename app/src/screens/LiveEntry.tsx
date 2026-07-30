// Einstieg für Remote & Live (Plan docs/plan-remote.md). Router für den Deep-Link:
//   #/remote/<id> → Fernbedienung (Phase 3, RemoteConsole)
//   #/watch/<id>  → Zuschauer, read-only (schlanke Ansicht; die vollwertige TV-Ansicht folgt in Phase 4)
import { useEffect, useMemo, useState, useRef } from 'react';
import { useStore } from '../store/useStore';
import { createProvider } from '../data/dataProvider';
import { useT, dict } from '../i18n';
import type { LiveRoute } from '../lib/deepLink';
import type { LiveSession, LiveViewState } from '../data/provider';
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
  const tr = useT();
  const storeProvider = useStore((s) => s.provider);
  // Login-frei & modus-unabhängig: ein frischer TV-Browser hat evtl. noch keinen „Vereinsmodus" gewählt
  // (dann wäre der Store-Provider lokal). Für die Watch-Ansicht immer einen Server-Provider verwenden
  // (URL aus Einstellung/VITE_PB_URL/same-origin) — watchPublic braucht keine Anmeldung.
  const provider = useMemo(() => (storeProvider.liveSupported ? storeProvider : createProvider('verein')), [storeProvider]);
  const token = route.sessionId; // im Watch-Modus trägt das Deep-Link-Segment den Token
  const [boards, setBoards] = useState<PublicBoard[]>([]);
  const [status, setStatus] = useState<'loading' | 'ok' | 'off'>('loading');
  const [selected, setSelected] = useState<string | null>(null); // boardName des gewählten Spiels (null = Auswahl-Liste)

  // Der Zuschauer-TV läuft dauerhaft auf einem Bildschirm im Nebenraum und fragt alle 1,5 s nach.
  // Ein frisches Array aus dem Netz hat IMMER eine neue Identität — ohne diesen Vergleich rendert
  // die Vollansicht rund 2400-mal pro Stunde neu, auch wenn zwischen zwei Würfen nichts passiert.
  const lastPayload = useRef('');

  useEffect(() => {
    if (!provider.liveSupported) { setStatus('off'); return; }
    let alive = true;
    const tick = async () => {
      if (document.hidden) return; // versteckter Tab: kein Netz-Polling im Hintergrund
      try {
        const r = await provider.watchPublic(token);
        if (!alive) return;
        setStatus('ok');
        const fp = JSON.stringify(r.boards);
        if (fp === lastPayload.current) return;
        lastPayload.current = fp;
        setBoards(r.boards);
      } catch { if (alive) setStatus('off'); }
    };
    void tick();
    const id = window.setInterval(tick, 1500);
    // Beim Zurückkehren zum Tab sofort aktualisieren (statt bis zum nächsten Intervall zu warten).
    const onVis = () => { if (!document.hidden) void tick(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { alive = false; window.clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [provider, token]);

  const shell: React.CSSProperties = { flex: 1, width: '100%', boxSizing: 'border-box', minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 'clamp(16px,4vw,48px)', background: 'var(--counter-bg)', color: 'var(--text)', textAlign: 'center' };
  const active = boards.filter((b) => b.state && b.state.phase !== 'idle');

  if (status === 'loading') return <div style={shell}><div style={{ fontSize: 'var(--fs-heading)' }}>{tr.watch.connecting}</div></div>;
  if (status === 'off') return (
    <div style={shell}>
      <div style={{ fontSize: 'var(--fs-page)', fontWeight: 800 }}>{tr.watch.offTitle}</div>
      <div style={{ fontSize: 'var(--fs-lead)', color: 'var(--text-3)', maxWidth: 420, lineHeight: 1.5 }}>{tr.watch.offBody}</div>
    </div>
  );

  // Gewähltes Spiel (per boardName) noch aktiv? → Vollansicht mit „Zurück zur Liste".
  const current = selected ? active.find((b) => b.boardName === selected) : null;
  if (current) return (
    <div style={{ ...shell, justifyContent: 'flex-start' }}>
      <FullBoard board={current} onBack={() => setSelected(null)} />
    </div>
  );

  if (active.length === 0) return <div style={shell}><div style={{ fontSize: 'clamp(22px,4vw,40px)', fontWeight: 800, color: 'var(--text-5)' }}>{tr.watch.waiting}</div></div>;

  // Landing-Liste: immer erst die laufenden Spiele zeigen, dann eins auswählen.
  return (
    <div style={{ ...shell, justifyContent: 'flex-start' }}>
      <div style={{ fontSize: 'clamp(22px,3.5vw,34px)', fontWeight: 800 }}>{tr.watch.chooseGame}</div>
      <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', marginTop: -8 }}>{tr.watch.runningGames(active.length)}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))', gap: 16, width: '100%', maxWidth: 1100 }}>
        {active.map((b, i) => <GameListItem key={i} board={b} onSelect={() => setSelected(b.boardName)} />)}
      </div>
    </div>
  );
}

const fmtAvg = (v?: number) => (v && v > 0 ? v.toFixed(1) : '–');

// Ein Eintrag der Auswahl-Liste: Board, beide Spieler mit Legs/Sets + Restscore, „Live/Beendet"-Badge.
function GameListItem({ board, onSelect }: { board: PublicBoard; onSelect: () => void }) {
  const tr = useT();
  const st = board.state;
  const won = st?.phase === 'won';
  return (
    <button onClick={onSelect} className="dh-hover-border" style={{ textAlign: 'left', cursor: 'pointer', background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-lg)', padding: '18px 20px', color: 'var(--text)', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ fontSize: 'var(--fs-sub)', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-3)' }}>{board.boardName || tr.watch.board}</span>
        <span style={{ fontSize: 'var(--fs-meta)', fontWeight: 800, color: won ? 'var(--gold-text)' : 'var(--success)' }}>{won ? `🏆 ${tr.watch.finished}` : `● ${tr.watch.live}`}</span>
      </div>
      {(st?.players ?? []).map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontSize: 'var(--fs-title)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-3)' }}>L{p.legs} · S{p.sets}</span>
            <span style={{ fontFamily: 'monospace', fontSize: 'var(--fs-heading)', fontWeight: 800, minWidth: 52, textAlign: 'right' }}>{p.score}</span>
          </span>
        </div>
      ))}
      <div style={{ fontSize: 'var(--fs-sub)', fontWeight: 800, color: 'var(--danger)', marginTop: 2 }}>▶ {tr.watch.watchGame}</div>
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <span><span style={{ color: 'var(--text-5)', fontWeight: 700 }}>{label}</span> <strong style={{ color: 'var(--text)', fontFamily: 'monospace' }}>{value}</strong></span>;
}

type LiveEvent = NonNullable<LiveViewState['event']>;
// Feier-Text/-Farbe je Ereignisart. `big` = große Zahl (180 bzw. Ausmache); Short Leg nur als Textzeile.
function celebrationBanner(e: LiveEvent): { text: string; color: string; big?: string } {
  const w = dict().watch;
  if (e.kind === '180') return { color: 'var(--gold-text)', big: '180', text: w.maximum(e.player) };
  if (e.kind === 'highFinish') return { color: 'var(--danger)', big: String(e.value), text: w.highFinishOf(e.player) };
  return { color: 'var(--success)', text: w.shortLeg(e.player, e.value) }; // shortLeg: value = Darts
}

// Vollansicht eines Spiels: Restscore + Legs/Sets, Statistik-Zeile (3-Dart-Schnitt, 180er, High Finish),
// „Letzter Wurf" + „am Wurf"-Indikator, sowie eine TRANSIENTE Feier bei 180/High Finish/Short Leg (blendet
// nach ~6 s automatisch aus, danach Normalanzeige). Match-Ende (phase="won") bleibt dagegen dauerhaft stehen.
function FullBoard({ board, onBack }: { board: PublicBoard; onBack: () => void }) {
  const tr = useT();
  const st = board.state;
  const curIdx = st?.currentIdx ?? 0;
  const won = st?.phase === 'won';
  const lastThrow = st?.lastThrow ?? null;

  // Bei NEUER event.id die Feier einblenden und nach 6 s automatisch wieder ausblenden (transient).
  const [celebrate, setCelebrate] = useState<LiveEvent | null>(null);
  const ev = st?.event ?? null;
  const evId = ev?.id;
  useEffect(() => {
    if (!evId || !ev) return;
    setCelebrate(ev);
    const timer = window.setTimeout(() => setCelebrate(null), 6000);
    return () => window.clearTimeout(timer);
    // Absichtlich nur bei neuer event.id auslösen (ev wird im Effekt frisch gelesen):
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evId]);

  const banner = won
    ? { text: tr.watch.wins(st?.winner ?? ''), color: 'var(--gold-text)' as string, big: undefined as string | undefined }
    : celebrate
    ? celebrationBanner(celebrate)
    : null;

  return (
    <div style={{ width: '100%', maxWidth: 1000, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <style>{`@keyframes dzPop{0%{transform:scale(.92);opacity:0}100%{transform:scale(1);opacity:1}}@keyframes dzFade{from{opacity:0}to{opacity:1}}@media (prefers-reduced-motion:reduce){.dz-cel{animation:dzFade .12s ease both!important}}`}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <button onClick={onBack} style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', color: 'var(--text)', borderRadius: 'var(--radius-md)', padding: '10px 16px', minHeight: 44, fontSize: 'var(--fs-body)', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>← {tr.watch.backToList}</button>
        <span style={{ fontSize: 'var(--fs-lead)', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-3)' }}>{board.boardName || tr.watch.board}</span>
        <span style={{ width: 96 }} />
      </div>

      {banner && (
        <div key={won ? 'won' : celebrate?.id} className="dz-cel" style={{ animation: 'dzPop .4s cubic-bezier(.22,1,.36,1) both', textAlign: 'center', borderRadius: 'var(--radius-lg)', padding: 'clamp(12px,2.4vw,22px)', background: `linear-gradient(135deg, color-mix(in srgb, ${banner.color} 28%, var(--surface)), var(--surface))`, border: `1px solid ${banner.color}`, boxShadow: `0 12px 44px color-mix(in srgb, ${banner.color} 22%, transparent)` }}>
          {banner.big && <div style={{ fontSize: 'clamp(44px,12vw,128px)', fontWeight: 800, lineHeight: 1, color: banner.color, letterSpacing: '.03em', fontFamily: 'monospace' }}>{banner.big}</div>}
          <div style={{ fontSize: banner.big ? 'clamp(16px,2.6vw,30px)' : 'clamp(22px,5vw,46px)', fontWeight: 800, color: banner.big ? 'var(--text)' : banner.color, marginTop: banner.big ? 6 : 0 }}>{banner.text}</div>
        </div>
      )}

      {(st?.players ?? []).map((p, i) => {
        const cur = i === curIdx && !won;
        const threw = !!lastThrow && lastThrow.player === i;
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 'clamp(16px,2.5vw,26px)', borderRadius: 'var(--radius-lg)', background: cur ? 'color-mix(in srgb, var(--danger) 14%, transparent)' : 'var(--surface)', border: cur ? '1px solid var(--danger)' : '1px solid var(--border-2)', textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 800, fontSize: 'clamp(22px,4vw,40px)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  {cur && <span style={{ fontSize: 'clamp(10px,1.3vw,13px)', fontWeight: 800, color: 'var(--danger)', background: 'color-mix(in srgb, var(--danger) 14%, transparent)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-pill)', padding: '2px 10px', letterSpacing: '.06em', textTransform: 'uppercase', flexShrink: 0 }}>{tr.watch.onThrow}</span>}
                  {threw && <span style={{ fontSize: 'clamp(11px,1.4vw,15px)', fontWeight: 800, color: lastThrow!.bust ? 'var(--danger)' : 'var(--text-2)', background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)', padding: '2px 10px', fontFamily: 'monospace', flexShrink: 0 }}>{lastThrow!.bust ? tr.watch.bust : `Wurf ${lastThrow!.value}`}</span>}
                </div>
                <div style={{ fontSize: 'clamp(13px,1.6vw,16px)', color: 'var(--text-3)', marginTop: 4 }}>{tr.watch.setsLegs(p.sets, p.legs)}</div>
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 'clamp(48px,12vw,132px)', fontWeight: 800, lineHeight: 1 }}>{p.score}</div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(12px,2vw,26px)', fontSize: 'clamp(13px,1.7vw,18px)', color: 'var(--text-2)' }}>
              <Stat label={tr.watch.avg3} value={fmtAvg(p.avg3)} />
              <Stat label={tr.watch.count180} value={String(p.c180 ?? 0)} />
              <Stat label={tr.watch.highFinish} value={p.hf ? String(p.hf) : '–'} />
            </div>
            {cur && (st?.checkout?.length ?? 0) > 0 && (
              <div style={{ fontSize: 'clamp(15px,2vw,22px)', color: 'var(--success)', fontWeight: 700 }}>{tr.watch.checkout}: {st?.checkout.join(' ')}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
