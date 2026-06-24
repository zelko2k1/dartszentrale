import { useEffect, useState } from 'react';
import { useStore } from './store/useStore';
import { rootBg, fontFam, accentFg } from './store/selectors';
import { useDevice } from './lib/useIsPhone';
import { comboFromEvent } from './lib/shortcut';
import { Logo } from './lib/icons';
import { Sidebar } from './layout/Sidebar';
import { Login } from './screens/Login';
import { Dashboard } from './screens/Dashboard';
import { Leagues } from './screens/Leagues';
import { Teams } from './screens/Teams';
import { Players } from './screens/Players';
import { PlayerDetail } from './screens/PlayerDetail';
import { Users } from './screens/Users';
import { Calendar } from './screens/Calendar';
import { Statistics } from './screens/Statistics';
import { Settings } from './screens/Settings';
import { Training } from './screens/Training';
import { TrainingSetup } from './screens/TrainingSetup';
import { TrainingGame } from './screens/TrainingGame';
import { Counter } from './screens/Counter';
import { CounterSetup } from './screens/CounterSetup';
import { Modals } from './modals/Modals';

function ScreenView() {
  const screen = useStore((s) => s.screen);
  switch (screen) {
    case 'dashboard': return <Dashboard />;
    case 'leagues': return <Leagues />;
    case 'teams': return <Teams />;
    case 'players': return <Players />;
    case 'playerDetail': return <PlayerDetail />;
    case 'users': return <Users />;
    case 'calendar': return <Calendar />;
    case 'stats': return <Statistics />;
    case 'settings': return <Settings />;
    case 'training': return <Training />;
    case 'trainSetup': return <TrainingSetup />;
    case 'setup': return <CounterSetup />;
    default: return <Dashboard />;
  }
}

export default function App() {
  const s = useStore();
  const init = useStore((st) => st.init);
  const { isHandset } = useDevice();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => { init(); }, [init]);
  useEffect(() => {
    const t = setInterval(() => useStore.setState({ now: Date.now() }), 30000);
    return () => clearInterval(t);
  }, []);
  // Dokumenttitel (auch in der Edge-App-Leiste) — im Verein mit Vereinsname, sonst nur "DartsHub"
  useEffect(() => {
    const club = s.settings.clubName.trim();
    document.title = s.settings.appMode === 'verein' && club ? `DartsHub — ${club}` : 'DartsHub';
  }, [s.settings.appMode, s.settings.clubName]);
  // close the mobile nav drawer whenever the screen changes
  useEffect(() => { setDrawerOpen(false); }, [s.screen]);
  // global shortcut (configurable) → new game anytime; Esc closes its confirm dialog
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useStore.getState(); const cfg = st.settings;
      const tgt = e.target as HTMLElement | null;
      const typing = !!tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.tagName === 'SELECT' || tgt.isContentEditable);
      const combo = typing ? null : comboFromEvent(e);
      if (combo) {
        if (combo === (cfg.newGameKey || 'ctrl+alt+n')) { e.preventDefault(); st.requestNew({ kind: 'setup' }); return; }
        if (cfg.quickBo5Key && combo === cfg.quickBo5Key) { e.preventDefault(); st.requestNew({ kind: 'preset', preset: { startScore: 501, unit: 'legs', bestOf: 5, outMode: 'double', doubleOut: true, doubleIn: false } }); return; }
        if (cfg.quickBo3Key && combo === cfg.quickBo3Key) { e.preventDefault(); st.requestNew({ kind: 'preset', preset: { startScore: 501, unit: 'legs', bestOf: 3, outMode: 'double', doubleOut: true, doubleIn: false } }); return; }
      }
      if (st.newConfirm && e.key === 'Escape') { e.preventDefault(); st.cancelNew(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const themeMode = s.settings.mode === 'light' ? 'light' : 'dark';
  const isVerein = s.settings.appMode === 'verein';
  const needsLogin = isVerein && !s.session;
  const isCounter = s.screen === 'counter';
  const isTrainGame = s.screen === 'trainGame';

  return (
    <div
      data-theme={themeMode}
      style={{
        height: '100vh', width: '100%', background: 'var(--bg)', color: 'var(--text)',
        fontFamily: fontFam(s.settings), overflow: 'hidden', display: 'flex',
        ...({ '--accent': s.settings.accent, '--accent-fg': accentFg(s.settings.accent) } as React.CSSProperties),
      }}
    >
      {needsLogin ? (
        <Login />
      ) : isCounter ? (
        <Counter />
      ) : isTrainGame ? (
        <TrainingGame />
      ) : isHandset ? (
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
          <header style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid var(--hairline)', background: 'var(--bar)' }}>
            <button
              onClick={() => setDrawerOpen(true)} aria-label="Menü öffnen"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, background: 'var(--surface-3)', border: '1px solid var(--border-2)', borderRadius: 10, color: 'var(--text-2)', cursor: 'pointer', flexShrink: 0 }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
            </button>
            {isVerein && s.settings.clubLogo
              ? <img src={s.settings.clubLogo} alt="Vereinslogo" style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'contain', flexShrink: 0 }} />
              : <Logo size={30} />}
            <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-.01em' }}>DartsHub</div>
          </header>
          <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: rootBg(s.settings), position: 'relative' }}>
            <ScreenView />
          </main>
          {drawerOpen && (
            <>
              <div onClick={() => setDrawerOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(8,10,12,.55)', backdropFilter: 'blur(2px)', zIndex: 60 }} />
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, zIndex: 61, boxShadow: '0 0 40px rgba(0,0,0,.5)', display: 'flex' }}>
                <Sidebar />
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          <Sidebar />
          <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: rootBg(s.settings), position: 'relative' }}>
            <ScreenView />
          </main>
        </>
      )}
      <Modals />
      {s.newConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,10,12,.82)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 18, padding: 28, width: '92vw', maxWidth: 400, textAlign: 'center', boxShadow: '0 24px 60px rgba(0,0,0,.5)' }}>
            <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 8 }}>Neues Spiel starten?</div>
            <div style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.5, marginBottom: 24 }}>Das laufende Spiel wird verworfen und erscheint nicht in der Statistik.</div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={() => s.cancelNew()} style={{ flex: 1, background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', padding: 13, borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Weiter spielen</button>
              <button onClick={() => s.confirmNew()} style={{ flex: 1, background: 'var(--accent)', border: 'none', color: 'var(--accent-fg)', padding: 13, borderRadius: 11, fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Neues Spiel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
