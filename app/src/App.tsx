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
import { BoardPanel } from './components/BoardPanel';
import { CommandPalette } from './components/CommandPalette';
import { LiveClock } from './components/LiveClock';
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
  const { isHandset, width } = useDevice();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [kioskMenuOpen, setKioskMenuOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [exitForm, setExitForm] = useState({ email: '', pw: '', err: '', busy: false });
  const [paletteOpen, setPaletteOpen] = useState(false);

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
      // Befehls-Palette: Strg+K (auch beim Tippen, um sie zu schließen).
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); setPaletteOpen((v) => !v); return; }
      // Alt-Kürzel feuern bewusst AUCH im Suchfeld (Alt+Taste erzeugt keinen Text) – Setup ist tastatur-first.
      const combo = comboFromEvent(e);
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
      if (st.newConfirm && e.key === 'Escape') { e.preventDefault(); st.cancelNew(); }
      else if (st.newConfirm && e.key === 'Enter' && !typing) { e.preventDefault(); st.confirmNew(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
      else setExitForm((f) => ({ ...f, busy: false, err: 'Anmeldung fehlgeschlagen oder keine Berechtigung (nur Admin/Kapitän).' }));
    });
  };

  const kioskInTraining = s.screen === 'training' || s.screen === 'trainSetup' || s.screen === 'trainGame';
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
        {isVerein && s.settings.clubLogo
          ? <img src={s.settings.clubLogo} alt="Vereinslogo" style={{ width: 28, height: 28, borderRadius: 7, objectFit: 'contain' }} />
          : <Logo size={28} />}
        <div style={{ fontWeight: 800, fontSize: 15 }}>{boardNumber != null ? `Board ${boardNumber}` : 'Board'}</div>
        {!narrowBar && (
          <div style={{ display: 'flex', gap: 8, marginLeft: 8 }}>
            {kioskTab('Spiel', !kioskInTraining && !kioskInSettings, () => s.go('setup'), 'Alt+S')}
            {kioskTab('Training', kioskInTraining, () => s.go('training'), 'Alt+T')}
            {kioskTab('Einstellungen', kioskInSettings, () => s.go('settings'), 'Alt+E')}
          </div>
        )}
        {/* Datum + Uhrzeit mittig – nur im breiten Layout, sonst würde sie mit dem Menü-Button kollidieren. */}
        {!narrowBar && <LiveClock mode="datetime" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', fontSize: 13, fontWeight: 600, color: 'var(--text-3)', whiteSpace: 'nowrap', pointerEvents: 'none' }} />}
        <div style={{ flex: 1 }} />
        {narrowBar ? (
          <button onClick={() => setKioskMenuOpen(true)} aria-label="Menü öffnen" title="Menü"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, background: 'var(--surface-3)', border: '1px solid var(--border-2)', borderRadius: 11, color: 'var(--text-2)', cursor: 'pointer', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
          </button>
        ) : (
          <button onClick={openExit}
            title="Board-Modus verlassen (Admin/Kapitän) · Alt+V"
            style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--surface-3)', border: '1px solid var(--border-2)', color: 'var(--text-3)', padding: '8px 13px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            Verlassen
            <span style={{ fontFamily: 'var(--font-num)', fontSize: 10, fontWeight: 700, opacity: 0.65, background: 'var(--btn)', borderRadius: 5, padding: '1px 5px' }}>Alt+V</span>
          </button>
        )}
      </header>
      {kioskMenuOpen && (
        <>
          <div onClick={() => setKioskMenuOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(8,10,12,.6)', backdropFilter: 'blur(2px)', zIndex: 70 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(84vw, 320px)', background: 'var(--surface)', borderLeft: '1px solid var(--border-2)', boxShadow: '-12px 0 40px rgba(0,0,0,.5)', zIndex: 71, display: 'flex', flexDirection: 'column', padding: 16, gap: 9 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{boardNumber != null ? `Board ${boardNumber}` : 'Board'}</div>
              <button onClick={() => setKioskMenuOpen(false)} aria-label="Schließen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 10, color: 'var(--text-3)', cursor: 'pointer' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <LiveClock mode="datetime" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', marginBottom: 6 }} />
            {kioskMenuItem('Spiel', !kioskInTraining && !kioskInSettings, () => { s.go('setup'); setKioskMenuOpen(false); })}
            {kioskMenuItem('Training', kioskInTraining, () => { s.go('training'); setKioskMenuOpen(false); })}
            {kioskMenuItem('Einstellungen', kioskInSettings, () => { s.go('settings'); setKioskMenuOpen(false); })}
            <div style={{ flex: 1 }} />
            <button onClick={openExit}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, background: 'var(--surface-3)', border: '1px solid var(--border-2)', color: 'var(--text-2)', padding: '13px 15px', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              Board-Modus verlassen
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
      {needsLogin ? (
        <Login />
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
                : s.screen === 'settings' ? <Settings kiosk />
                : <><BoardPanel /><CounterSetup /></>}
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
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      {s.syncError && (
        <div
          onClick={() => s.clearSyncError()}
          style={{ position: 'fixed', bottom: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 95, display: 'flex', alignItems: 'center', gap: 10, background: '#3a1714', border: '1px solid #E0594B', color: '#ffd9d3', padding: '10px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600, boxShadow: '0 12px 30px rgba(0,0,0,.45)', cursor: 'pointer', maxWidth: '92vw' }}
        >
          <span>⚠ {s.syncError}</span>
          <span style={{ opacity: .7, fontSize: 11 }}>(antippen zum Schließen)</span>
        </div>
      )}
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

      {kioskUnlocked && (
        <button
          onClick={() => s.relockKiosk()}
          title="Abmelden – der Board-Rechner meldet sich danach wieder mit seinem Board-Konto an"
          style={{ position: 'fixed', bottom: 18, right: 18, zIndex: 92, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent)', border: 'none', color: 'var(--accent-fg)', padding: '12px 18px', borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 10px 28px rgba(0,0,0,.4)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          Abmelden &amp; zum Board
        </button>
      )}

      {exitOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,10,12,.82)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 96 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 18, padding: 26, width: '92vw', maxWidth: 420, boxShadow: '0 24px 60px rgba(0,0,0,.5)' }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Board-Modus verlassen</div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5, marginBottom: 18 }}>Anmeldung als Administrator oder Kapitän, um z. B. die Aufstellung zu ändern. Danach kann der Rechner wieder als Board gesperrt werden.</div>
            <input className="dh-input" type="email" inputMode="email" autoCapitalize="off" autoCorrect="off" spellCheck={false} value={exitForm.email} onChange={(e) => setExitForm((f) => ({ ...f, email: e.target.value, err: '' }))} placeholder="E-Mail" style={{ width: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 11, padding: '12px 14px', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', marginBottom: 10 }} />
            <input className="dh-input" type="password" value={exitForm.pw} onChange={(e) => setExitForm((f) => ({ ...f, pw: e.target.value, err: '' }))} onKeyDown={(e) => { if (e.key === 'Enter' && !exitForm.busy) submitExit(); }} placeholder="Passwort" autoComplete="current-password" style={{ width: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 11, padding: '12px 14px', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', marginBottom: exitForm.err ? 8 : 18 }} />
            {exitForm.err && <div style={{ fontSize: 12, color: '#E0594B', fontWeight: 600, marginBottom: 14 }}>{exitForm.err}</div>}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setExitOpen(false)} style={{ background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', padding: '11px 18px', borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
              <button onClick={submitExit} disabled={exitForm.busy || !exitForm.email.trim() || !exitForm.pw} style={{ background: 'var(--accent)', border: 'none', color: 'var(--accent-fg)', padding: '11px 18px', borderRadius: 11, fontSize: 14, fontWeight: 800, cursor: exitForm.busy ? 'default' : 'pointer', opacity: (exitForm.busy || !exitForm.email.trim() || !exitForm.pw) ? 0.6 : 1, fontFamily: 'inherit' }}>{exitForm.busy ? 'Anmelden…' : 'Anmelden & verlassen'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
