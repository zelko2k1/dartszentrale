import { useEffect, useRef, useState } from 'react';
import { useStore } from './store/useStore';
import { rootBg, fontFam, accentFg } from './store/selectors';
import { useDevice } from './lib/useIsPhone';
import { comboFromEvent } from './lib/shortcut';
import { Logo } from './lib/icons';
import { Sidebar } from './layout/Sidebar';
import { Login } from './screens/Login';
import { ModePicker } from './screens/ModePicker';
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
import { TournamentSetup } from './screens/TournamentSetup';
import { Tournament } from './screens/Tournament';
import { Counter } from './screens/Counter';
import { CounterSetup } from './screens/CounterSetup';
import { LiveEntry } from './screens/LiveEntry';
import { parseLiveRoute } from './lib/deepLink';
import { useLiveHost } from './lib/useLiveHost';
import { BoardPanel } from './components/BoardPanel';
import { NextGameOverlay } from './components/NextGameOverlay';
import { TournamentBoardOverlay } from './components/TournamentBoardOverlay';
import { CommandPalette } from './components/CommandPalette';
import { LiveClock } from './components/LiveClock';
import { Modals } from './modals/Modals';
import { useT } from './i18n';

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
    case 'tournamentSetup': return <TournamentSetup />;
    case 'tournament': return <Tournament />;
    case 'setup': return <CounterSetup />;
    default: return <Dashboard />;
  }
}

export default function App() {
  const s = useStore();
  const tr = useT();
  const init = useStore((st) => st.init);
  const { isHandset, width } = useDevice();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [kioskMenuOpen, setKioskMenuOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [exitForm, setExitForm] = useState({ email: '', pw: '', err: '', busy: false });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  // Deep-Link-Einstieg (QR): #/remote/<id> oder #/watch/<id> — einmalig beim Start ausgewertet.
  const [liveRoute] = useState(() => parseLiveRoute());

  useEffect(() => { init(); }, [init]);
  // Host für „Remote & Live": veröffentlicht im Board-/Kiosk-Modus automatisch eine Live-Session.
  useLiveHost();
  useEffect(() => {
    const t = setInterval(() => useStore.setState({ now: Date.now() }), 30000);
    return () => clearInterval(t);
  }, []);
  // Dokumenttitel (auch in der Edge-App-Leiste) — im Verein mit Vereinsname, sonst nur "DartsZentrale"
  useEffect(() => {
    const club = s.settings.clubName.trim();
    document.title = s.settings.appMode === 'verein' && club ? `DartsZentrale — ${club}` : 'DartsZentrale';
  }, [s.settings.appMode, s.settings.clubName]);
  // close the mobile nav drawer whenever the screen changes
  useEffect(() => { setDrawerOpen(false); }, [s.screen]);
  // global shortcut (configurable) → new game anytime; Esc closes its confirm dialog
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useStore.getState(); const cfg = st.settings;
      // Alt-Kürzel feuern bewusst AUCH im Suchfeld (Alt+Taste erzeugt keinen Text) – Setup ist tastatur-first.
      const combo = comboFromEvent(e);
      // Befehls-Palette (konfigurierbar, Default Alt+K): toggelt auch beim Tippen, um sie zu schließen.
      if (combo && combo === (cfg.paletteKey || 'alt+k')) { e.preventDefault(); setPaletteOpen((v) => !v); return; }
      // Kiosk-Tabs: Alt+S Spiel · Alt+T Training · Alt+E Einstellungen (nicht im laufenden Spiel).
      const me = st.accounts.find((a) => a.id === st.session) || null;
      const inKiosk = cfg.appMode === 'verein' && !!st.session && !!me?.isBoard && me?.boardNumber != null && !st.kioskUnlocked;
      // Board-Modus verlassen per Alt+V (öffnet den Admin/Kapitän-Dialog) – auch im laufenden Spiel erreichbar.
      if (inKiosk && combo === 'alt+v') { e.preventDefault(); setExitForm({ email: '', pw: '', err: '', busy: false }); setExitOpen(true); return; }
      if (inKiosk && combo && (combo === 'alt+s' || combo === 'alt+t' || combo === 'alt+e')) {
        if (st.screen === 'counter' || st.screen === 'trainGame') return; // laufendes Spiel nicht stören
        e.preventDefault();
        st.go(combo === 'alt+s' ? 'setup' : combo === 'alt+t' ? 'training' : 'settings');
        return;
      }
      if (combo) {
        if (combo === (cfg.newGameKey || 'alt+n')) { e.preventDefault(); st.requestNew({ kind: 'setup' }); return; }
        if (cfg.quickBo5Key && combo === cfg.quickBo5Key) { e.preventDefault(); st.requestNew({ kind: 'preset', preset: { startScore: 501, unit: 'legs', bestOf: 5, outMode: 'double', doubleOut: true, doubleIn: false } }); return; }
        if (cfg.quickBo3Key && combo === cfg.quickBo3Key) { e.preventDefault(); st.requestNew({ kind: 'preset', preset: { startScore: 501, unit: 'legs', bestOf: 3, outMode: 'double', doubleOut: true, doubleIn: false } }); return; }
      }
      // „Neues Spiel starten?" besitzt seine eigene Tastatursteuerung (NewGameConfirm, wie „Spiel abbrechen?").
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // Auto-Backup (nur Lokalmodus): bei jedem Start (mit Dedupe) + täglich zur eingestellten Uhrzeit.
  // Verpasste Zeit wird durch das Start-Backup nachgeholt, da eine geschlossene App nicht timern kann.
  useEffect(() => {
    if (s.pbMode || !s.settings.autoBackup) return;
    const time = s.settings.backupTime || '20:00';
    const last = s.lastBackupAt ? Date.parse(s.lastBackupAt) : 0;
    if (!last || Date.now() - last > 2 * 60 * 1000) void s.runBackup(); // Start-/Nachhol-Backup
    let timer = 0;
    const schedule = () => {
      const [h, m] = time.split(':').map((x) => parseInt(x, 10));
      const now = new Date();
      const next = new Date(now); next.setHours(h || 0, m || 0, 0, 0);
      if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
      timer = window.setTimeout(() => { void s.runBackup(); schedule(); }, next.getTime() - now.getTime());
    };
    schedule();
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.pbMode, s.settings.autoBackup, s.settings.backupTime]);

  const themeMode = s.settings.mode === 'light' ? 'light' : 'dark';
  const isVerein = s.settings.appMode === 'verein';
  const needsLogin = isVerein && !s.session;
  const isCounter = s.screen === 'counter';
  const isTrainGame = s.screen === 'trainGame';
  // Board-/Kiosk-Modus: ein Board-PC ist als nummeriertes Board-Konto angemeldet → automatisch im Kiosk.
  const meAccount = s.accounts.find((a) => a.id === s.session) || null;
  const boardNumber = meAccount?.isBoard ? (meAccount.boardNumber ?? null) : null;
  const kioskLocked = isVerein && !!s.session && boardNumber != null && !s.kioskUnlocked;
  const kioskUnlocked = s.kioskUnlocked; // „Zurück zum Board"-Button nach Kapitän-Entsperrung

  const submitExit = () => {
    setExitForm((f) => ({ ...f, busy: true, err: '' }));
    void Promise.resolve(s.kioskExitLogin(exitForm.email, exitForm.pw)).then((ok) => {
      if (ok) { setExitOpen(false); setExitForm({ email: '', pw: '', err: '', busy: false }); }
      else setExitForm((f) => ({ ...f, busy: false, err: tr.app.exitFailed }));
    });
  };

  const kioskInTraining = s.screen === 'training' || s.screen === 'trainSetup' || s.screen === 'trainGame' || s.screen === 'tournamentSetup' || s.screen === 'tournament';
  const kioskInSettings = s.screen === 'settings';
  const kioskTab = (label: string, active: boolean, onClick: () => void, hint?: string) => (
    <button onClick={onClick} title={hint ? `${label} (${hint})` : label} style={{ display: 'flex', alignItems: 'center', gap: 7, background: active ? 'var(--accent)' : 'var(--surface-3)', color: active ? 'var(--accent-fg)' : 'var(--text-3)', border: `1px solid ${active ? 'var(--accent)' : 'var(--border-2)'}`, padding: '7px 14px', borderRadius: 9, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
      {label}
      {hint && <span style={{ fontFamily: 'var(--font-num)', fontSize: 10, fontWeight: 700, opacity: 0.65, background: active ? 'rgba(0,0,0,.16)' : 'var(--btn)', borderRadius: 5, padding: '1px 5px' }}>{hint}</span>}
    </button>
  );
  // Schmale Viewports (Smartphone, Tablet im Hochformat) → Tabs/Verlassen in eine Seitenleiste auslagern,
  // damit sich in der Topbar nichts überlagert. isHandset greift bei Tablets nicht, daher Breiten-Schwelle.
  const narrowBar = width < 860;
  const kioskMenuItem = (label: string, active: boolean, onClick: () => void) => (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left', background: active ? 'var(--accent)' : 'var(--btn)', color: active ? 'var(--accent-fg)' : 'var(--text-2)', border: `1px solid ${active ? 'var(--accent)' : 'var(--border-2)'}`, padding: '13px 15px', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>{label}</button>
  );
  const openExit = () => { setKioskMenuOpen(false); setExitForm({ email: '', pw: '', err: '', busy: false }); setExitOpen(true); };
  const kioskBar = (
    <>
      <header style={{ position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--hairline)', background: 'var(--bar)' }}>
        {narrowBar && (
          <button onClick={() => setKioskMenuOpen(true)} aria-label={tr.app.menuOpen} title={tr.app.menu}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, background: 'var(--surface-3)', border: '1px solid var(--border-2)', borderRadius: 11, color: 'var(--text-2)', cursor: 'pointer', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
          </button>
        )}
        {isVerein && s.settings.clubLogo
          ? <img src={s.settings.clubLogo} alt={tr.sidebar.clubLogoAlt} style={{ width: 28, height: 28, borderRadius: 7, objectFit: 'contain' }} />
          : <Logo size={28} />}
        <div style={{ fontWeight: 800, fontSize: 15 }}>{boardNumber != null ? `Board ${boardNumber}` : tr.app.board}</div>
        {!narrowBar && (
          <div style={{ display: 'flex', gap: 8, marginLeft: 8 }}>
            {kioskTab(tr.palette.game, !kioskInTraining && !kioskInSettings, () => s.go('setup'), 'Alt+S')}
            {kioskTab(tr.common.training, kioskInTraining, () => s.go('training'), 'Alt+T')}
            {kioskTab(tr.nav.settings, kioskInSettings, () => s.go('settings'), 'Alt+E')}
          </div>
        )}
        {/* Datum + Uhrzeit mittig – nur im breiten Layout, sonst würde sie mit dem Menü-Button kollidieren. */}
        {!narrowBar && <LiveClock mode="datetime" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', fontSize: 13, fontWeight: 600, color: 'var(--text-3)', whiteSpace: 'nowrap', pointerEvents: 'none' }} />}
        <div style={{ flex: 1 }} />
        {!narrowBar && (
          <button onClick={openExit}
            title={tr.app.exitTitleBar}
            style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--surface-3)', border: '1px solid var(--border-2)', color: 'var(--text-3)', padding: '8px 13px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            {tr.app.leave}
            <span style={{ fontFamily: 'var(--font-num)', fontSize: 10, fontWeight: 700, opacity: 0.65, background: 'var(--btn)', borderRadius: 5, padding: '1px 5px' }}>Alt+V</span>
          </button>
        )}
      </header>
      {kioskMenuOpen && (
        <>
          <div onClick={() => setKioskMenuOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(8,10,12,.6)', backdropFilter: 'blur(2px)', zIndex: 70 }} />
          <div style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: 'min(84vw, 320px)', background: 'var(--surface)', borderRight: '1px solid var(--border-2)', boxShadow: '12px 0 40px rgba(0,0,0,.5)', zIndex: 71, display: 'flex', flexDirection: 'column', padding: 16, gap: 9 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{boardNumber != null ? `Board ${boardNumber}` : tr.app.board}</div>
              <button onClick={() => setKioskMenuOpen(false)} aria-label={tr.common.close} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 10, color: 'var(--text-3)', cursor: 'pointer' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <LiveClock mode="datetime" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', marginBottom: 6 }} />
            {kioskMenuItem(tr.palette.game, !kioskInTraining && !kioskInSettings, () => { s.go('setup'); setKioskMenuOpen(false); })}
            {kioskMenuItem(tr.common.training, kioskInTraining, () => { s.go('training'); setKioskMenuOpen(false); })}
            {kioskMenuItem(tr.nav.settings, kioskInSettings, () => { s.go('settings'); setKioskMenuOpen(false); })}
            <div style={{ flex: 1 }} />
            <button onClick={openExit}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, background: 'var(--surface-3)', border: '1px solid var(--border-2)', color: 'var(--text-2)', padding: '13px 15px', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              {tr.app.leaveBoardMode}
            </button>
          </div>
        </>
      )}
    </>
  );

  return (
    <div
      data-theme={themeMode}
      style={{
        height: '100vh', width: '100%', background: 'var(--bg)', color: 'var(--text)',
        fontFamily: fontFam(s.settings), overflow: 'hidden', display: 'flex',
        fontVariantNumeric: 'tabular-nums', // Ziffern bündig, auch in proportionalen Schriften
        ...({
          '--accent': s.settings.accent, '--accent-fg': accentFg(s.settings.accent),
          // --font-num folgt der gewählten Schrift (Konsistenz); --font-score bleibt Mono für große Spiel-Scores.
          '--font-num': fontFam(s.settings),
          '--font-score': "'JetBrains Mono','SFMono-Regular',Consolas,ui-monospace,monospace",
        } as React.CSSProperties),
      }}
    >
      {/* PWA-Update-Hinweis: dezent, während eines laufenden Spiels ausgeblendet (unterbricht nie eine Partie).
          Auch auf Fernbedienung/Zuschauer-TV (liveRoute) aus — er würde dort über den Tasten schweben. */}
      {s.updateReady && !updateDismissed && !isCounter && !isTrainGame && !liveRoute && (
        <div style={{ position: 'fixed', bottom: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 90, display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', border: '1px solid var(--accent)', boxShadow: '0 8px 30px rgba(0,0,0,.4)', borderRadius: 12, padding: '10px 12px 10px 16px' }}>
          <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>Neue Version verfügbar</span>
          <button onClick={() => s.applyUpdate()} style={{ background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', borderRadius: 9, padding: '8px 14px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Aktualisieren</button>
          <button onClick={() => setUpdateDismissed(true)} aria-label="Später" title="Später" style={{ background: 'transparent', border: 'none', color: 'var(--text-4)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>
      )}
      {liveRoute?.mode === 'watch' ? (
        // Login-freier Zuschauer-TV: rendert VOR den Mode-/Login-Gates (Plan docs/plan-remote.md, Phase 4).
        <LiveEntry route={liveRoute} />
      ) : s.needsModeChoice ? (
        <ModePicker />
      ) : needsLogin ? (
        <Login />
      ) : liveRoute ? (
        <LiveEntry route={liveRoute} />
      ) : kioskLocked ? (
        isCounter ? (
          <Counter />
        ) : isTrainGame ? (
          <TrainingGame />
        ) : (
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {kioskBar}
            <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: rootBg(s.settings), position: 'relative' }}>
              {s.screen === 'training' ? <Training />
                : s.screen === 'trainSetup' ? <TrainingSetup />
                : s.screen === 'tournamentSetup' ? <TournamentSetup />
                : s.screen === 'tournament' ? <Tournament />
                : s.screen === 'settings' ? <Settings kiosk />
                : <><BoardPanel /><CounterSetup /><NextGameOverlay /><TournamentBoardOverlay /></>}
            </main>
          </div>
        )
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
            <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-.01em' }}>DartsZentrale</div>
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
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      {s.syncError && (
        <div
          onClick={() => s.clearSyncError()}
          style={{ position: 'fixed', bottom: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 95, display: 'flex', alignItems: 'center', gap: 10, background: '#3a1714', border: '1px solid #E0594B', color: '#ffd9d3', padding: '10px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600, boxShadow: '0 12px 30px rgba(0,0,0,.45)', cursor: 'pointer', maxWidth: '92vw' }}
        >
          <span>⚠ {s.syncError}</span>
          <span style={{ opacity: .7, fontSize: 11 }}>{tr.app.tapToClose}</span>
        </div>
      )}
      {s.newConfirm && <NewGameConfirm />}

      {kioskUnlocked && (
        <button
          onClick={() => s.relockKiosk()}
          title={tr.app.relockTitle}
          style={{ position: 'fixed', bottom: 18, right: 18, zIndex: 92, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent)', border: 'none', color: 'var(--accent-fg)', padding: '12px 18px', borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 10px 28px rgba(0,0,0,.4)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          {tr.app.relock}
        </button>
      )}

      {exitOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,10,12,.82)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 96 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 18, padding: 26, width: '92vw', maxWidth: 420, boxShadow: '0 24px 60px rgba(0,0,0,.5)' }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>{tr.app.leaveBoardMode}</div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5, marginBottom: 18 }}>{tr.app.exitInfo}</div>
            <input className="dh-input" type="email" inputMode="email" autoCapitalize="off" autoCorrect="off" spellCheck={false} value={exitForm.email} onChange={(e) => setExitForm((f) => ({ ...f, email: e.target.value, err: '' }))} placeholder={tr.login.email} style={{ width: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 11, padding: '12px 14px', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', marginBottom: 10 }} />
            <input className="dh-input" type="password" value={exitForm.pw} onChange={(e) => setExitForm((f) => ({ ...f, pw: e.target.value, err: '' }))} onKeyDown={(e) => { if (e.key === 'Enter' && !exitForm.busy) submitExit(); }} placeholder={tr.login.password} autoComplete="current-password" style={{ width: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 11, padding: '12px 14px', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', marginBottom: exitForm.err ? 8 : 18 }} />
            {exitForm.err && <div style={{ fontSize: 12, color: '#E0594B', fontWeight: 600, marginBottom: 14 }}>{exitForm.err}</div>}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setExitOpen(false)} style={{ background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', padding: '11px 18px', borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{tr.common.cancel}</button>
              <button onClick={submitExit} disabled={exitForm.busy || !exitForm.email.trim() || !exitForm.pw} style={{ background: 'var(--accent)', border: 'none', color: 'var(--accent-fg)', padding: '11px 18px', borderRadius: 11, fontSize: 14, fontWeight: 800, cursor: exitForm.busy ? 'default' : 'pointer', opacity: (exitForm.busy || !exitForm.email.trim() || !exitForm.pw) ? 0.6 : 1, fontFamily: 'inherit' }}>{exitForm.busy ? tr.app.signingIn : tr.app.signInLeave}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// „Neues Spiel starten?" – vollständig per Tastatur bedienbar (wie „Spiel abbrechen?"): ◄ ► (bzw. ▲ ▼ /
// Tab) wechseln die Auswahl, Enter/Leertaste bestätigt die markierte Schaltfläche, Esc = weiterspielen.
// Der Fokus steht anfangs auf „Weiterspielen", damit ein versehentliches Enter das Spiel NICHT verwirft.
function NewGameConfirm() {
  const s = useStore();
  const tr = useT();
  const [sel, setSel] = useState<0 | 1>(0); // 0 = Weiterspielen · 1 = Neues Spiel
  const keepRef = useRef<HTMLButtonElement>(null);
  const newRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { (sel === 0 ? keepRef : newRef).current?.focus(); }, [sel]);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); s.cancelNew(); }
    else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.key)) { e.preventDefault(); setSel((v) => (v === 0 ? 1 : 0)); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (sel === 0) s.cancelNew(); else s.confirmNew(); }
  };
  const ring = (on: boolean, color: string): React.CSSProperties => (on ? { boxShadow: `0 0 0 3px color-mix(in srgb, ${color} 55%, transparent)` } : {});
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,10,12,.82)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90 }}>
      <div onKeyDown={onKey} style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 18, padding: 28, width: '92vw', maxWidth: 400, textAlign: 'center', boxShadow: '0 24px 60px rgba(0,0,0,.5)' }}>
        <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 8 }}>{tr.app.newGameConfirmTitle}</div>
        <div style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.5, marginBottom: 24 }}>{tr.counter.abortBody}</div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button ref={keepRef} onClick={() => s.cancelNew()} onMouseEnter={() => setSel(0)} style={{ flex: 1, background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', padding: 13, borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', outline: 'none', ...ring(sel === 0, 'var(--text)') }}>{tr.counter.keepPlaying}</button>
          <button ref={newRef} onClick={() => s.confirmNew()} onMouseEnter={() => setSel(1)} style={{ flex: 1, background: 'var(--accent)', border: 'none', color: 'var(--accent-fg)', padding: 13, borderRadius: 11, fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', outline: 'none', ...ring(sel === 1, 'var(--accent)') }}>{tr.counter.newGame}</button>
        </div>
        {/* Tastatur-Hinweis (nur Desktop, wo eine Tastatur da ist) – analog „Spiel abbrechen?". */}
        {s.settings.device === 'desktop' && (
          <div style={{ marginTop: 18, display: 'flex', gap: 16, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', fontSize: 12, color: 'var(--text-4)', fontWeight: 600 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><NewKbd>←</NewKbd><NewKbd>→</NewKbd> {tr.counter.abortKbdSelect}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><NewKbd>⏎</NewKbd> {tr.counter.abortKbdConfirm}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><NewKbd>Esc</NewKbd> {tr.counter.abortKbdKeep}</span>
          </div>
        )}
      </div>
    </div>
  );
}
function NewKbd({ children }: { children: React.ReactNode }) {
  return <kbd style={{ fontFamily: 'var(--font-num)', fontSize: 11, fontWeight: 800, color: 'var(--text-3)', background: 'var(--surface-3)', border: '1px solid var(--border-2)', borderRadius: 6, padding: '2px 7px', lineHeight: 1.4 }}>{children}</kbd>;
}
