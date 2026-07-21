import { useEffect, useState, Fragment } from 'react';
import { useStore } from '../store/useStore';
import { Avatar } from '../components/Avatar';
import { accentFg } from '../store/selectors';
import {
  scores, progress, currentIdx, currentLeg, average, first9, lastThrow, scoreList,
  countAtLeast, checkoutSuggestion, canCheckout, finishStats, first9Match, matchOver, winner, checkoutAchievement, type CounterSlice,
} from '../store/counter';
import { IconBack, IconUndo, IconRefresh, IconX } from '../lib/icons';
import { useDevice } from '../lib/useIsPhone';
import { BoardScale } from '../components/BoardScale';
import { useT } from '../i18n';

export function Counter() {
  const s = useStore();
  const tr = useT();
  const slice: CounterSlice = { gamePlayers: s.gamePlayers, allThrows: s.allThrows, startOffset: s.startOffset, settings: s.settings };
  const accent = s.settings.accent;
  const accFg = accentFg(accent);
  const cfg = s.settings;

  const sc = scores(slice);
  const prog = progress(slice);
  const curIdx = currentIdx(slice);
  const over = matchOver(slice);
  const leg = currentLeg(slice);
  const isTablet = cfg.device !== 'desktop';

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useStore.getState();
      if (st.screen !== 'counter') return;
      // modifier combos (Strg/Alt/⌘ + …) are handled by global shortcuts, not score entry
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (st.newConfirm) return; // confirm dialog owns the keyboard (Esc handled globally)
      // rest-entry box owns the keyboard while open
      if (st.restEntry) { if (e.key === 'Escape') { e.preventDefault(); st.closeRestEntry(); } return; }
      if (st.pendingStart) {
        const n = st.gamePlayers.length;
        if (e.key >= '1' && e.key <= String(n)) { e.preventDefault(); st.chooseStarter(parseInt(e.key, 10) - 1); }
        else if (e.key.toLowerCase() === 'b') { e.preventDefault(); st.openBullOff(); }
        else if (e.key.toLowerCase() === 'z') { e.preventDefault(); st.spinStarter(); }
        else if (e.key === 'Escape' && st.bullMode) { e.preventDefault(); st.closeBullOff(); }
        return;
      }
      // Auto-Hinweis (Short-Leg-Feier): jeder Tastendruck blendet ihn sofort weg (und wird geschluckt);
      // ein blockierendes Modal-Hinweis (auto=false) schluckt Tasten wie bisher.
      if (st.hint) { if (st.hint.auto) st.closeHint(); return; }
      if (matchOver({ gamePlayers: st.gamePlayers, allThrows: st.allThrows, startOffset: st.startOffset, settings: st.settings }) || st.abortConfirm) return;
      // function keys F1–F12
      const fk = /^F(\d{1,2})$/.exec(e.key);
      if (fk) {
        e.preventDefault();
        const n = parseInt(fk[1], 10);
        const keys = st.settings.fkeys || [];
        if (n >= 1 && n <= 8) { const v = keys[n - 1]; if (typeof v === 'number') st.quick(v); return; }
        if (st.settings.device !== 'desktop') return; // F9–F12 desktop only
        const sl: CounterSlice = { gamePlayers: st.gamePlayers, allThrows: st.allThrows, startOffset: st.startOffset, settings: st.settings };
        const cp = st.gamePlayers[currentIdx(sl)]; if (!cp) return;
        const remNow = scores(sl)[cp.id];
        if (n === 9) { st.openRestEntry(); return; }
        if (n >= 10 && n <= 12) { const darts = n - 9; if (canCheckout(st.settings, remNow, darts).ok) st.apply(remNow, darts); }
        return;
      }
      if (e.key >= '0' && e.key <= '9') st.pressDigit(e.key);
      else if (e.key === 'Enter') st.pressEnter();
      else if (e.key === 'Backspace') st.pressDel();
      else if (e.key === 'Escape') useStore.setState({ input: '' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Auto-Hinweis (z. B. Short-Leg-Feier) blendet sich nach ~3 s selbst wieder aus.
  useEffect(() => {
    if (!s.hint?.auto) return;
    const id = window.setTimeout(() => useStore.getState().closeHint(), 3000);
    return () => window.clearTimeout(id);
  }, [s.hint]);

  // phone mode: portrait → stacked minimal layout, landscape → scores | keypad split
  const { isPhonePortrait, isPhoneLandscape } = useDevice();
  const isPhone = isPhonePortrait || isPhoneLandscape;
  // Aufschrieb-Ansicht (n01-Stil): nur auf Desktop/Board/Tablet, nicht am Handy. Die kompakte
  // Score-Leiste bleibt oben (Fernlesbarkeit), der volle Aufschrieb füllt darunter.
  const sheetMode = !isPhone && cfg.counterView === 'sheet';
  // Aufschrieb-Box klappbar (undefined = offen, damit Bestandsgeräte unverändert starten). Zugeklappt
  // füllt die große-Zahl-Leiste den frei werdenden Platz; die Klappleiste bleibt zum Wieder-Aufklappen.
  const sheetOpen = cfg.sheetOpen !== false;
  // dito für die Wurfanzeige-Box im „Restscore"-Modus.
  const historyOpen = cfg.historyOpen !== false;

  // resizable score area (score band vs throws band)
  const startResize = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const board = e.currentTarget.parentElement;
    const h = board ? board.getBoundingClientRect().height : window.innerHeight * 0.55;
    const startY = e.clientY;
    const startArea = useStore.getState().settings.scoreArea || 58;
    const move = (ev: PointerEvent) => {
      const area = startArea + ((ev.clientY - startY) / h) * 100;
      useStore.getState().setSetting('scoreArea', Math.round(Math.max(35, Math.min(85, area))));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const outLabel = cfg.outMode === 'master' ? 'Master Out' : cfg.outMode === 'single' ? 'Single Out' : 'Double Out';
  const gameTitle = `X01 · ${cfg.startScore} · ${outLabel}`;
  const matchInfo = cfg.unit === 'sets' ? tr.counter.matchInfoSets(cfg.bestOfSets) : tr.counter.matchInfoLegs(leg, cfg.bestOf);

  const activePlayer = s.gamePlayers[curIdx];
  const activeRem = activePlayer ? sc[activePlayer.id] : 0;
  const activeCheckout = activePlayer ? checkoutSuggestion(cfg, activeRem) : null;
  const inputDisplay = s.input === '' ? '—' : s.input;

  const headBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 7, background: 'var(--surface-3)', border: '1px solid var(--border-2)', color: 'var(--text-2)', padding: '9px 13px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };

  // colours are chosen per light/dark mode (cfg.accent / scoreColor / legColor are already the
  // effective values for the active mode), so we use them directly.
  const accentInk = accent;
  const legInk = cfg.legColor || accent;
  const scoreInk = cfg.scoreColor;
  const coInk = cfg.mode === 'light' ? '#8a5e00' : '#F2B829';
  // crisp outline for the big score, immer aktiv und je nach Hell-/Dunkelmodus (stroke hinter der Füllung)
  const scoreOutline: React.CSSProperties = { WebkitTextStroke: `1.5px ${cfg.mode === 'light' ? 'rgba(0,0,0,.45)' : 'rgba(0,0,0,.6)'}`, paintOrder: 'stroke fill' as React.CSSProperties['paintOrder'] };

  const keypad = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  // Quick-Scores spiegeln die Funktionstasten F1–F8 wider
  const quickChips = (cfg.fkeys && cfg.fkeys.length ? cfg.fkeys : [180, 140, 100, 95, 85, 60, 45, 40]).slice(0, 8);

  // auto-scroll throw-history columns to the newest entry
  useEffect(() => {
    document.querySelectorAll('.dh-history-scroll').forEach((el) => { (el as HTMLElement).scrollTop = el.scrollHeight; });
  }, [s.allThrows.length]);

  return (
    <BoardScale>
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: cfg.mode === 'light' ? 'var(--bg)' : '#0c0e11', fontFamily: 'inherit' }}>
      {isPhone ? (
        <PhoneCounter landscape={isPhoneLandscape} />
      ) : (
        <>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid var(--hairline)', background: 'var(--bar)', backdropFilter: 'blur(6px)', flexShrink: 0 }}>
        <button onClick={() => s.go('dashboard')} style={headBtn}><IconBack size={15} sw={2} />{tr.counter.back}</button>
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '.02em', whiteSpace: 'nowrap' }}>{gameTitle}</div>
          <div style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 2 }}>{matchInfo}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => s.undo()} style={headBtn}><IconUndo size={15} />Undo</button>
          <button onClick={() => s.newMatch()} style={headBtn}><IconRefresh size={15} />{tr.counter.newBtn}</button>
          <button onClick={() => s.abortGame()} style={{ ...headBtn, background: 'rgba(224,75,67,.10)', border: '1px solid rgba(224,75,67,.32)', color: '#E0594B' }}><IconX size={15} sw={2} />{tr.counter.abort}</button>
        </div>
      </div>

      {/* board */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 12, minHeight: 0 }}>
        {/* SCORE band */}
        <div style={{ flex: sheetMode ? (cfg.showHistory && sheetOpen ? 40 : 100) : (cfg.showHistory ? cfg.scoreArea : 100), display: 'flex', gap: 12, minHeight: 0 }}>
          {s.gamePlayers.map((p, i) => {
            const isActive = i === curIdx && !over;
            const rem = sc[p.id];
            const co = checkoutSuggestion(cfg, rem);
            const turnLabel = isActive ? tr.trainingScr.atThrow : '';
            const pips = Array.from({ length: prog.legsToWinSet }, (_, k) => k < (prog.legsSet[p.id] || 0));
            return (
              <div key={p.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRadius: 16, background: isActive ? `color-mix(in srgb, ${accent} 9%, var(--surface-2))` : 'var(--surface-2)', border: `1px solid ${isActive ? accent : 'var(--border-2)'}`, boxShadow: isActive ? `0 0 0 1px ${accent}, 0 0 46px color-mix(in srgb, ${accent} 12%, transparent)` : 'none', transition: 'border-color .18s ease', minWidth: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 18px 0', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                    <Avatar photo={p.photo} short={p.short} avi={p.av} size={40} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: Math.round(17 * cfg.headerSize / 100), fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.15 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: accentInk, fontWeight: 700, height: 14, letterSpacing: '.04em' }}>{turnLabel}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {cfg.unit === 'sets' && <div style={{ fontFamily: 'var(--font-num)', fontSize: Math.round(15 * cfg.legSize / 100), fontWeight: 800, color: legInk, background: `color-mix(in srgb, ${legInk} 14%, transparent)`, padding: '3px 9px', borderRadius: 999 }}>{prog.setsWon[p.id] || 0}</div>}
                    <div style={{ display: 'flex', gap: 5 }}>
                      {pips.map((on, k) => <div key={k} style={{ width: Math.round(9 * cfg.legSize / 100), height: Math.round(9 * cfg.legSize / 100), borderRadius: '50%', background: on ? legInk : 'transparent', border: `2px solid ${on ? legInk : 'var(--border-strong)'}` }} />)}
                    </div>
                  </div>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 0, padding: '6px 10px', gap: 6 }}>
                  {/* self-sizing: fill the score box's height AND width (container-query units), scaled by the font-size setting */}
                  <div style={{ flex: 1, width: '100%', minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', containerType: 'size' }}>
                    <div style={{ fontFamily: 'var(--font-score)', fontWeight: 800, fontSize: `min(${Math.round(88 * cfg.scoreScale / 100)}cqh, ${Math.round(56 * cfg.scoreScale / 100)}cqw)`, lineHeight: 1, letterSpacing: '-.03em', color: isActive ? (scoreInk || accentInk) : 'var(--text-4)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center', ...scoreOutline }}>{rem}</div>
                  </div>
                  {/* checkout suggestion — centred under the score */}
                  {cfg.showCheckout && co && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0, maxWidth: '100%', background: 'rgba(242,184,41,.12)', border: '1px solid rgba(242,184,41,.32)', color: coInk, padding: '5px 12px', borderRadius: 999, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-num)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{co}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Aufschrieb-Ansicht (n01-Stil): ersetzt die Wurf-Liste; die Statistik-Box bleibt darunter
            wie gewohnt über den „Statistik-Box"-Schalter (showStats) an-/abwählbar. */}
        {sheetMode && (cfg.showHistory || cfg.showStats) && (
          <div style={{ flex: cfg.showHistory && sheetOpen ? '60 1 0' : '0 0 auto', display: 'flex', flexDirection: 'column', minHeight: 0, marginTop: 8, gap: 8 }}>
            {/* Aufschrieb-Box (= Wurf-Verlauf): über den „Wurf-Verlauf"-Schalter (showHistory) an-/abwählbar;
                Klapp-Pfeil ist in die Box integriert (bleibt zugeklappt als schmale Leiste sichtbar). */}
            {cfg.showHistory && <ScoreSheet open={sheetOpen} onToggle={() => s.setSetting('sheetOpen', !sheetOpen)} />}
            {cfg.showStats && <SheetStats />}
          </div>
        )}
        {/* throws & stats band: die Wurfanzeige ist EINE gemeinsame Box (beide Spieler nebeneinander) mit
            integriertem Klapp-Pfeil; die Statistik-Box bleibt separat über „showStats" schaltbar. */}
        {!sheetMode && (cfg.showHistory || cfg.showStats) && (
          <>
            {/* Ziehgriff zum Verschieben der Trennung Score-Leiste ↔ Wurfanzeige — nur wenn aufgeklappt */}
            {cfg.showHistory && historyOpen && (
              <div onPointerDown={startResize} style={{ height: 18, margin: '8px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexShrink: 0, background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 9, cursor: 'row-resize', touchAction: 'none', userSelect: 'none' }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-strong)' }} />
              </div>
            )}
            <div style={{ flex: cfg.showHistory && historyOpen ? `${100 - cfg.scoreArea} 1 0` : '0 0 auto', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0, marginTop: cfg.showHistory && historyOpen ? 0 : 8 }}>
              {cfg.showHistory && <HistoryBox open={historyOpen} onToggle={() => s.setSetting('historyOpen', !historyOpen)} />}
              {cfg.showStats && <SheetStats />}
            </div>
          </>
        )}
      </div>

      {/* input deck */}
      {isTablet ? (
        <div style={{ flex: `0 0 ${36 * cfg.deckSize / 100}vh`, display: 'flex', gap: 12, padding: '0 12px 12px', minHeight: 0 }}>
          {cfg.showQuick && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, minHeight: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', paddingLeft: 2, flexShrink: 0 }}>{tr.counter.quickScore}</div>
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gridAutoRows: '1fr', gap: 8, minHeight: 0 }}>
                {quickChips.map((q, i) => (
                  <button key={i} onClick={() => s.quick(q)} style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)', borderRadius: 14, fontFamily: 'var(--font-num)', fontSize: 'clamp(15px,2.8vh,23px)', fontWeight: 800, cursor: 'pointer', minHeight: 0 }}>{q}</button>
                ))}
              </div>
            </div>
          )}
          <div style={{ width: 340, display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, minHeight: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', paddingLeft: 2, flexShrink: 0 }}>{tr.counter.inputLabel}</div>
            <div style={{ flex: '2 1 0', minHeight: 0, background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 14, padding: 'clamp(4px,0.9vh,10px) 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600 }}>{activePlayer?.name}</span>
              <span style={{ fontFamily: 'var(--font-num)', fontSize: 'clamp(18px,2.8vh,30px)', fontWeight: 800, color: accentInk, letterSpacing: '-.02em', minWidth: 70, textAlign: 'right' }}>{inputDisplay}</span>
            </div>
            <div style={{ flex: '14 1 0', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gridAutoRows: '1fr', gap: 8, minHeight: 0 }}>
                {keypad.map((k) => (
                  <button key={k} onClick={() => s.pressDigit(k)} style={{ background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-num)', fontSize: 'clamp(20px,3vh,26px)', fontWeight: 700, cursor: 'pointer', minHeight: 0 }}>{k}</button>
                ))}
                <button onClick={() => s.pressClear()} style={{ background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text-3)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', minHeight: 0 }}>C</button>
                <button onClick={() => s.pressDigit('0')} style={{ background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-num)', fontSize: 'clamp(20px,3vh,26px)', fontWeight: 700, cursor: 'pointer', minHeight: 0 }}>0</button>
                <button onClick={() => s.pressDel()} style={{ background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text-3)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', minHeight: 0 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" /><path d="M18 9l-6 6M12 9l6 6" /></svg>
                </button>
              </div>
              <button onClick={() => s.pressEnter()} style={{ background: accent, border: 'none', color: accFg, borderRadius: 13, padding: 'clamp(11px,1.9vh,15px) 0', fontSize: 'clamp(15px,2.1vh,18px)', fontWeight: 800, letterSpacing: '.02em', cursor: 'pointer', boxShadow: `0 6px 18px color-mix(in srgb, ${accent} 22%, transparent)`, flexShrink: 0 }}>{tr.counter.enterBtn}</button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flexShrink: 0, margin: '0 12px 12px', display: 'flex', alignItems: 'center', gap: 18, background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 14, padding: '14px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: accent, boxShadow: `0 0 10px ${accent}` }} />
            <span style={{ fontSize: 15, fontWeight: 700 }}>{activePlayer?.name}</span>
            <span style={{ fontSize: 13, color: 'var(--text-4)' }}>{tr.counter.throwsRest(activeRem)}</span>
          </div>
          {activeCheckout && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(242,184,41,.12)', border: '1px solid rgba(242,184,41,.32)', color: coInk, padding: '5px 12px', borderRadius: 999, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-num)' }}>{activeCheckout}</div>}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontFamily: 'var(--font-num)', fontSize: 38, fontWeight: 800, color: accentInk, letterSpacing: '-.02em', minWidth: 78, textAlign: 'right' }}>{inputDisplay}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 10, whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>{tr.counter.typeScoreThen}</span>
              <span style={{ fontFamily: 'var(--font-num)', fontSize: 13, fontWeight: 700, color: accentInk, background: `color-mix(in srgb, ${accent} 12%, transparent)`, padding: '2px 8px', borderRadius: 5 }}>↵ Enter</span>
            </div>
          </div>
        </div>
      )}
      {/* function-key legend (desktop only) */}
      {cfg.device === 'desktop' && <FKeyLegend />}
        </>
      )}

      {/* rest-score entry box (F9) */}
      {s.restEntry && <RestEntryBox />}
      {/* who-starts overlay */}
      {s.pendingStart && <WhoStarts />}
      {/* hint */}
      {s.hint && (
        <Overlay z={45}>
          {s.hint.auto ? (
            // Selbst-ausblendende Feier (Short Leg): kein Knopf, ganze Fläche zum Wegtippen.
            <div onClick={() => s.closeHint()} style={{ cursor: 'pointer', background: 'var(--surface)', border: `2px solid ${accent}`, borderRadius: 22, padding: '30px 48px', textAlign: 'center', boxShadow: `0 24px 60px rgba(0,0,0,.5), 0 0 0 6px color-mix(in srgb, ${accent} 14%, transparent)` }}>
              <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: '.01em', color: accent, marginBottom: 6, lineHeight: 1.1 }}>{s.hint.title}</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{s.hint.body}</div>
            </div>
          ) : (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 18, padding: 28, maxWidth: 420, textAlign: 'center', boxShadow: '0 24px 60px rgba(0,0,0,.5)' }}>
              <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 8 }}>{s.hint.title}</div>
              <div style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.55, marginBottom: 24 }}>{s.hint.body}</div>
              <button onClick={() => s.closeHint()} style={{ background: accent, border: 'none', color: accFg, padding: '13px 32px', borderRadius: 11, fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>{tr.counter.gotIt}</button>
            </div>
          )}
        </Overlay>
      )}
      {/* abort */}
      {s.abortConfirm && (
        <Overlay z={40}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 18, padding: 28, maxWidth: 400, textAlign: 'center', boxShadow: '0 24px 60px rgba(0,0,0,.5)' }}>
            <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 8 }}>{tr.counter.abortTitle}</div>
            <div style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.5, marginBottom: 24 }}>{tr.counter.abortBody}</div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={() => s.cancelAbort()} style={{ flex: 1, background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', padding: 13, borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{tr.counter.keepPlaying}</button>
              <button onClick={() => s.confirmAbort()} style={{ flex: 1, background: '#E0594B', border: 'none', color: '#fff', padding: 13, borderRadius: 11, fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>{tr.counter.abort}</button>
            </div>
          </div>
        </Overlay>
      )}
      {/* win */}
      {over && <WinOverlay />}
    </div>
    </BoardScale>
  );
}

const phoneIconBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, background: 'var(--surface-3)', border: '1px solid var(--border-2)', color: 'var(--text-2)', borderRadius: 10, cursor: 'pointer' };

// Integrierter, beschriftungsloser Klapp-Pfeil (rechtsbündig) als schmale Kopfleiste einer auf-/zuklappbaren
// Box (Aufschrieb, Wurfanzeige, Statistik). Klick schaltet um; die Leiste bleibt auch zugeklappt sichtbar,
// damit man jederzeit wieder aufklappen kann. Pfeil zeigt bei „offen" nach unten, sonst nach oben.
function CollapseArrow({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const tr = useT();
  return (
    <button
      onClick={onToggle}
      title={open ? tr.counter.sheetCollapse : tr.counter.sheetExpand}
      style={{ flexShrink: 0, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '2px 8px', background: 'var(--surface-3)', border: 'none', borderBottom: open ? '1px solid var(--border-2)' : 'none', cursor: 'pointer', color: 'var(--text-4)' }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .18s ease' }}><path d="M6 9l6 6 6-6" /></svg>
    </button>
  );
}

// F9: type the REMAINING score after a throw — the app derives the scored value (so the throw counts toward the average).
function RestEntryBox() {
  const s = useStore();
  const tr = useT();
  const slice: CounterSlice = { gamePlayers: s.gamePlayers, allThrows: s.allThrows, startOffset: s.startOffset, settings: s.settings };
  const cfg = s.settings;
  const accent = cfg.accent;
  const accFg = accentFg(accent);
  const cp = s.gamePlayers[currentIdx(slice)];
  const curRem = cp ? scores(slice)[cp.id] : 0;
  const [val, setVal] = useState('');
  const entered = val === '' ? NaN : parseInt(val, 10);
  const valid = !isNaN(entered) && entered >= 0 && entered <= curRem && (curRem - entered) <= 180;
  const scored = valid ? curRem - entered : null;
  const submit = () => { if (valid) s.submitRestEntry(val); };
  return (
    <Overlay z={47}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 18, padding: 26, width: 360, maxWidth: '92vw', boxShadow: '0 24px 60px rgba(0,0,0,.5)' }}>
        <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 4 }}>{tr.counter.restTitle}</div>
        <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 18 }}>{cp?.name}{tr.counter.restCurrent1}<b style={{ color: 'var(--text)', fontFamily: 'var(--font-num)' }}>{curRem}</b>{tr.counter.restCurrent2}</div>
        <input
          autoFocus type="text" inputMode="numeric" value={val} placeholder={tr.counter.restPlaceholder}
          onChange={(e) => setVal(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); else if (e.key === 'Escape') s.closeRestEntry(); }}
          style={{ width: '100%', background: 'var(--btn)', border: `1px solid ${val !== '' && !valid ? '#E0594B' : 'var(--border-2)'}`, borderRadius: 12, padding: '12px 14px', color: 'var(--text)', fontFamily: 'var(--font-num)', fontSize: 26, fontWeight: 800, textAlign: 'center', outline: 'none', boxSizing: 'border-box' }}
        />
        <div style={{ fontSize: 13, height: 18, marginTop: 10, textAlign: 'center', color: val !== '' && !valid ? '#E0594B' : 'var(--text-4)' }}>
          {val === '' ? tr.counter.restHintEmpty : (scored != null ? tr.counter.restScored(scored) : tr.counter.restInvalid)}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
          <button onClick={() => s.closeRestEntry()} style={{ flex: 1, background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', padding: 13, borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{tr.trainingScr.cancel}</button>
          <button onClick={submit} disabled={!valid} style={{ flex: 1, background: valid ? accent : 'var(--surface-3)', border: 'none', color: valid ? accFg : 'var(--text-4)', padding: 13, borderRadius: 11, fontSize: 14, fontWeight: 800, cursor: valid ? 'pointer' : 'default', fontFamily: 'inherit' }}>{tr.trainingScr.enter}</button>
        </div>
      </div>
    </Overlay>
  );
}

// Small visual cheat-sheet of the function keys, shown at the bottom in desktop mode. Boxes are also clickable.
function FKeyLegend() {
  const s = useStore();
  const tr = useT();
  const cfg = s.settings;
  const accent = cfg.accent;
  const accentInk = accent;
  const slice: CounterSlice = { gamePlayers: s.gamePlayers, allThrows: s.allThrows, startOffset: s.startOffset, settings: s.settings };
  const cp = s.gamePlayers[currentIdx(slice)];
  const rem = cp ? scores(slice)[cp.id] : 0;
  const items = [
    ...(cfg.showQuick ? (cfg.fkeys || []).slice(0, 8).map((v, i) => ({ k: `F${i + 1}`, label: String(v), enabled: true, onClick: () => s.quick(v) })) : []),
    { k: 'F9', label: tr.counter.fkeyRest, enabled: true, onClick: () => s.openRestEntry() },
    { k: 'F10', label: '1-Dart', enabled: canCheckout(cfg, rem, 1).ok, onClick: () => { if (canCheckout(cfg, rem, 1).ok) s.apply(rem, 1); } },
    { k: 'F11', label: '2-Dart', enabled: canCheckout(cfg, rem, 2).ok, onClick: () => { if (canCheckout(cfg, rem, 2).ok) s.apply(rem, 2); } },
    { k: 'F12', label: '3-Dart', enabled: canCheckout(cfg, rem, 3).ok, onClick: () => { if (canCheckout(cfg, rem, 3).ok) s.apply(rem, 3); } },
  ];
  return (
    <div style={{ flexShrink: 0, display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 12px 10px' }}>
      {items.map((it) => (
        <button key={it.k} onClick={it.onClick} disabled={!it.enabled} title={`${it.k} · ${it.label}`} style={{ flex: '1 1 60px', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 8, padding: '5px 4px', cursor: it.enabled ? 'pointer' : 'default', opacity: it.enabled ? 1 : 0.4, fontFamily: 'inherit' }}>
          <span style={{ fontSize: 9, fontWeight: 800, color: accentInk, letterSpacing: '.04em' }}>{it.k}</span>
          <span style={{ fontFamily: 'var(--font-num)', fontSize: 13, fontWeight: 700, color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{it.label}</span>
        </button>
      ))}
    </div>
  );
}

// Voller Aufschrieb im n01-Stil (Entwurf): beide Spieler nebeneinander mit Score/Rest je Aufnahme,
// mittiger Dart-Zähler-Spalte (bei 2 Spielern) und Ton-Markierung (100+/140+/180). Zeigt das AKTUELLE
// Leg; die kompakte große-Zahl-Leiste darüber bleibt für die Fernlesbarkeit erhalten.
function ScoreSheet({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const s = useStore();
  const tr = useT();
  const slice: CounterSlice = { gamePlayers: s.gamePlayers, allThrows: s.allThrows, startOffset: s.startOffset, settings: s.settings };
  const cfg = s.settings;
  const accent = cfg.accent;
  const players = s.gamePlayers;
  const two = players.length === 2;
  const over = matchOver(slice);
  const curIdx = currentIdx(slice);
  const start = cfg.startScore;
  const perRows = players.map((p) => scoreList(slice, p.id));
  const maxR = perRows.reduce((m, r) => Math.max(m, r.length), 0);
  const inputDisplay = s.input;

  // ans Ende scrollen, wenn eine neue Aufnahme dazukommt
  useEffect(() => {
    document.querySelectorAll('.dh-sheet-scroll').forEach((el) => { (el as HTMLElement).scrollTop = el.scrollHeight; });
  }, [s.allThrows.length]);

  type Col = { k: 'scored' | 'rest' | 'dart'; p?: number };
  // 2 Spieler → Dart-Zähler mittig (echter n01-Look); mehr Spieler → Dart-Spalte links, dann je Spieler Score/Rest.
  const columns: Col[] = two
    ? [{ k: 'scored', p: 0 }, { k: 'rest', p: 0 }, { k: 'dart' }, { k: 'scored', p: 1 }, { k: 'rest', p: 1 }]
    : [{ k: 'dart' }, ...players.flatMap((_, pi) => [{ k: 'scored', p: pi } as Col, { k: 'rest', p: pi } as Col])];
  const gridCols = two ? '1fr 1fr 54px 1fr 1fr' : `54px ${players.map(() => '1fr 1fr').join(' ')}`;

  // Ton-Markierung: 180 = gold gefüllt, 140–179 = Akzent-Ring, 100–139 = dezenter Ring (wie n01s Kringel).
  const scoredInner = (v: string | number, bust: boolean) => {
    if (bust || typeof v !== 'number') return <span style={{ color: '#E0594B', fontWeight: 800 }}>BUST</span>;
    let wrap: React.CSSProperties | null = null;
    if (v >= 180) wrap = { background: '#F2B829', color: '#1a1206', border: '1.5px solid #F2B829' };
    else if (v >= 140) wrap = { border: `1.6px solid ${accent}`, color: accent };
    else if (v >= 100) wrap = { border: '1.5px solid var(--border-strong)', color: 'var(--text)' };
    if (wrap) return <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 34, padding: '2px 9px', borderRadius: 999, fontWeight: 800, ...wrap }}>{v}</span>;
    return <span>{v}</span>;
  };

  const cellBase: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontFamily: 'var(--font-num)', fontSize: 'clamp(13px,2vh,18px)', fontWeight: 700, padding: '5px 12px', minWidth: 0, borderBottom: '1px solid var(--hairline)' };
  const dartCellBase: React.CSSProperties = { ...cellBase, justifyContent: 'center', color: 'var(--text-5)', fontSize: 'clamp(10px,1.4vh,12px)', padding: '5px 4px', background: 'color-mix(in srgb, var(--border) 45%, transparent)' };

  const dataRow = (i: number) => columns.map((col, ci) => {
    if (col.k === 'dart') return <div key={`${i}-${ci}`} style={dartCellBase}>{(i + 1) * 3}</div>;
    const row = perRows[col.p!][i];
    if (col.k === 'scored') return <div key={`${i}-${ci}`} style={cellBase}>{row ? scoredInner(row.scored, row.bust) : ''}</div>;
    return <div key={`${i}-${ci}`} style={{ ...cellBase, color: row?.checkout ? accent : 'var(--text-3)', fontWeight: row?.checkout ? 800 : 700 }}>{row ? row.rest : ''}</div>;
  });

  return (
    <div style={{ flex: open ? 1 : '0 0 auto', minWidth: 0, display: 'flex', flexDirection: 'column', border: '1px solid var(--border-2)', borderRadius: 16, background: 'var(--surface-2)', overflow: 'hidden' }}>
      {/* integrierter Klapp-Pfeil (ohne Beschriftung), rechtsbündig in der Ecke */}
      <CollapseArrow open={open} onToggle={onToggle} />
      {open && (
        <>
          {/* Spaltenköpfe */}
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, borderBottom: '1px solid var(--border-2)', background: 'var(--surface-3)', flexShrink: 0 }}>
            {columns.map((col, ci) => (
              <div key={ci} style={{ padding: '7px 12px', textAlign: col.k === 'dart' ? 'center' : 'right', fontSize: 9, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-5)' }}>
                {col.k === 'dart' ? tr.counter.colDarts : col.k === 'scored' ? tr.counter.colScore : tr.counter.colRest}
              </div>
            ))}
          </div>
          {/* Aufschrieb */}
          <div className="dh-sheet-scroll" style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'grid', gridTemplateColumns: gridCols, alignContent: 'start' }}>
            {/* Startzeile: Startscore in der Rest-Spalte */}
            {columns.map((col, ci) => (
              <div key={`s${ci}`} style={col.k === 'rest' ? { ...cellBase, color: 'var(--text-2)', fontWeight: 800 } : (col.k === 'dart' ? dartCellBase : cellBase)}>
                {col.k === 'rest' ? start : (col.k === 'dart' ? 0 : '')}
              </div>
            ))}
            {/* Aufnahmen */}
            {Array.from({ length: maxR }).map((_, i) => dataRow(i))}
            {/* Cursor-Zeile: aktuelle Eingabe des Spielers am Wurf (gelb hervorgehoben) */}
            {!over && columns.map((col, ci) => {
              const active = col.p === curIdx;
              if (col.k === 'scored') return <div key={`p${ci}`} style={{ ...cellBase, borderBottom: 'none', background: active ? 'rgba(242,184,41,.16)' : 'transparent', color: active ? 'var(--text)' : 'var(--text-5)', fontWeight: 800 }}>{active ? (inputDisplay || <span style={{ color: 'var(--text-5)' }}>·</span>) : ''}</div>;
              return <div key={`p${ci}`} style={{ ...(col.k === 'dart' ? dartCellBase : cellBase), borderBottom: 'none', background: col.k === 'dart' ? undefined : 'transparent' }} />;
            })}
          </div>
        </>
      )}
    </div>
  );
}

// Statistik-Box (beide Ansichten): dieselben Kennzahlen (Ø 3-Dart, First 9, Letzter, 180·140+, CO %, HF)
// für beide Spieler in EINER Box mit Trennlinie in der Mitte. Über den „Statistik-Box"-Schalter (showStats)
// grundsätzlich an-/abwählbar; zusätzlich im Counter über einen integrierten, beschriftungslosen Pfeil
// auf-/zuklappbar (statsOpen). Standard: offen.
function SheetStats() {
  const s = useStore();
  const tr = useT();
  const slice: CounterSlice = { gamePlayers: s.gamePlayers, allThrows: s.allThrows, startOffset: s.startOffset, settings: s.settings };
  const cfg = s.settings;
  const statsOpen = cfg.statsOpen !== false;
  return (
    <div style={{ flexShrink: 0, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border-2)', background: 'var(--surface-2)' }}>
      {/* integrierter Klapp-Pfeil (ohne Beschriftung), rechtsbündig in der Ecke */}
      <CollapseArrow open={statsOpen} onToggle={() => s.setSetting('statsOpen', !statsOpen)} />
      {statsOpen && (
        <div style={{ display: 'flex' }}>
          {s.gamePlayers.map((p, pi) => {
            const lt = lastThrow(slice, p.id);
            const fs = finishStats(slice, p.id);
            return (
              <div key={p.id} style={{ flex: 1, display: 'flex', gap: 1, background: 'var(--border)', minWidth: 0, borderLeft: pi > 0 ? '2px solid var(--border-strong)' : 'none' }}>
                {[[tr.common.avg3, average(slice, p.id).toFixed(1)], ['First 9', first9(slice, p.id).toFixed(1)], [tr.counter.statLast, lt ? (lt.bust ? 'BUST' : String(lt.raw)) : '–'], ['180·140+', `${countAtLeast(slice, p.id, 180, true)}·${countAtLeast(slice, p.id, 140)}`], ['CO', `${fs.co}%`], ['HF', fs.hf > 0 ? String(fs.hf) : '–']].map(([label, val], k) => (
                  <div key={k} style={{ flex: 1, background: 'var(--surface-2)', padding: '8px 3px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, textAlign: 'center', minWidth: 0 }}>
                    <div style={{ fontSize: Math.round(9 * cfg.statsSize / 100), color: 'var(--text-4)', fontWeight: 700, letterSpacing: '.02em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</div>
                    <div style={{ fontFamily: 'var(--font-num)', fontSize: Math.round(13 * cfg.statsSize / 100), fontWeight: 700, lineHeight: 1 }}>{val}</div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Wurfanzeige im „Restscore"-Modus: beide Spieler in EINER Box (gemeinsamer Kopf mit den Spielernamen,
// darunter je Spieler die Spalten Rd/Score/Rest mit eigener Scroll-Liste). Ersetzt die früheren zwei
// getrennten Boxen. Über die Klappleiste auf-/zuklappbar.
function HistoryBox({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const s = useStore();
  const tr = useT();
  const slice: CounterSlice = { gamePlayers: s.gamePlayers, allThrows: s.allThrows, startOffset: s.startOffset, settings: s.settings };
  const cfg = s.settings;
  const accent = cfg.accent;

  // ans Ende scrollen, wenn eine neue Aufnahme dazukommt
  useEffect(() => {
    document.querySelectorAll('.dh-history-scroll').forEach((el) => { (el as HTMLElement).scrollTop = el.scrollHeight; });
  }, [s.allThrows.length]);

  return (
    <div style={{ flex: open ? 1 : '0 0 auto', display: 'flex', flexDirection: 'column', borderRadius: 16, background: 'var(--surface-2)', border: '1px solid var(--border-2)', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
      {/* integrierter Klapp-Pfeil (ohne Beschriftung), rechtsbündig in der Ecke */}
      <CollapseArrow open={open} onToggle={onToggle} />
      {open && (
        <>
          {/* gemeinsamer Kopf: Spielernamen nebeneinander */}
          <div style={{ display: 'flex', flexShrink: 0, borderBottom: '1px solid var(--border-2)', background: 'var(--surface-3)' }}>
            {s.gamePlayers.map((p, i) => (
              <div key={p.id} style={{ flex: 1, minWidth: 0, padding: '9px 18px', borderLeft: i > 0 ? '1px solid var(--border-2)' : 'none', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
            ))}
          </div>
          {/* je Spieler eine Spalte mit Unter-Kopf (Rd/Score/Rest) und Scroll-Liste */}
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            {s.gamePlayers.map((p, i) => {
              const rows = scoreList(slice, p.id);
              return (
                <div key={p.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, borderLeft: i > 0 ? '1px solid var(--border-2)' : 'none' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '34px 1fr 1fr', gap: 4, padding: '8px 18px 6px', flexShrink: 0, borderBottom: '1px solid var(--hairline)' }}>
                    <span style={{ fontSize: 9, color: 'var(--text-5)', fontWeight: 700, textTransform: 'uppercase' }}>{tr.counter.colRd}</span>
                    <span style={{ fontSize: 9, color: 'var(--text-5)', fontWeight: 700, textTransform: 'uppercase', textAlign: 'right' }}>{tr.counter.colScore}</span>
                    <span style={{ fontSize: 9, color: 'var(--text-5)', fontWeight: 700, textTransform: 'uppercase', textAlign: 'right' }}>{tr.counter.colRest}</span>
                  </div>
                  <div className="dh-history-scroll" style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '4px 8px 8px' }}>
                    {rows.map((r, k) => (
                      <div key={k} style={{ display: 'grid', gridTemplateColumns: '34px 1fr 1fr', gap: 4, padding: '6px 10px', borderRadius: 6, background: r.checkout ? `color-mix(in srgb, ${accent} 12%, transparent)` : 'transparent' }}>
                        <span style={{ fontFamily: 'var(--font-num)', fontSize: 12, color: 'var(--text-5)' }}>{r.round}</span>
                        <span style={{ fontFamily: 'var(--font-num)', fontSize: 14, fontWeight: 700, textAlign: 'right', color: r.bust ? '#E0594B' : 'var(--text)' }}>{r.scored}</span>
                        <span style={{ fontFamily: 'var(--font-num)', fontSize: 14, fontWeight: 700, textAlign: 'right', color: r.checkout ? accent : 'var(--text-3)' }}>{r.rest}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function PhoneCounter({ landscape }: { landscape: boolean }) {
  const s = useStore();
  const tr = useT();
  const slice: CounterSlice = { gamePlayers: s.gamePlayers, allThrows: s.allThrows, startOffset: s.startOffset, settings: s.settings };
  const cfg = s.settings;
  const accent = cfg.accent;
  const accFg = accentFg(accent);
  const accentInk = accent;
  const scoreInk = cfg.scoreColor || accentInk;
  const coInk = cfg.mode === 'light' ? '#8a5e00' : '#F2B829';
  const scoreOutline: React.CSSProperties = { WebkitTextStroke: `1.5px ${cfg.mode === 'light' ? 'rgba(0,0,0,.45)' : 'rgba(0,0,0,.6)'}`, paintOrder: 'stroke fill' as React.CSSProperties['paintOrder'] };
  const sc = scores(slice);
  const prog = progress(slice);
  const curIdx = currentIdx(slice);
  const leg = currentLeg(slice);
  const [showDetail, setShowDetail] = useState(false);

  const active = s.gamePlayers[curIdx];
  const rem = active ? sc[active.id] : 0;
  const co = active ? checkoutSuggestion(cfg, rem) : null;
  const inputDisplay = s.input === '' ? '—' : s.input;
  const matchInfo = cfg.unit === 'sets' ? tr.counter.matchInfoPhone(cfg.bestOfSets) : `Leg ${leg} · BO${cfg.bestOf}`;
  const others = s.gamePlayers.filter((_, i) => i !== curIdx);
  // fill = keys grow to fill available height (landscape, where the deck owns a full column)
  const keyBtn = (fill: boolean): React.CSSProperties => ({ background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-num)', fontSize: 26, fontWeight: 700, cursor: 'pointer', minHeight: fill ? 0 : 54 });

  const activeCard = (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', borderRadius: 18, background: `color-mix(in srgb, ${accent} 9%, var(--surface-2))`, border: `1px solid ${accent}`, padding: '14px 16px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {active
            ? <Avatar photo={active.photo} short={active.short} avi={active.av} size={34} />
            : <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--surface-3)', flexShrink: 0 }} />}
          <div style={{ fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{active?.name}</div>
        </div>
        {cfg.unit === 'sets' && <div style={{ fontFamily: 'var(--font-num)', fontSize: 13, fontWeight: 800, color: accentInk, background: `color-mix(in srgb, ${accent} 14%, transparent)`, padding: '3px 9px', borderRadius: 999, flexShrink: 0 }}>{(active && prog.setsWon[active.id]) || 0}</div>}
        <div style={{ fontSize: 10, color: accentInk, fontWeight: 800, letterSpacing: '.08em', flexShrink: 0 }}>{tr.trainingScr.atThrow}</div>
      </div>
      <div style={{ flex: 1, width: '100%', minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', containerType: 'size' }}>
        <div style={{ fontFamily: 'var(--font-score)', fontWeight: 800, fontSize: `min(${Math.round(150 * cfg.scoreScale / 100)}cqh, ${Math.round(46 * cfg.scoreScale / 100)}cqw)`, lineHeight: 1, letterSpacing: '-.03em', color: scoreInk, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', ...scoreOutline }}>{rem}</div>
      </div>
      {cfg.showCheckout && co && (
        <div style={{ alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0, background: 'rgba(242,184,41,.12)', border: '1px solid rgba(242,184,41,.32)', color: coInk, padding: '5px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-num)' }}>{co}</div>
      )}
    </div>
  );

  const opponentRow = (
    <button onClick={() => setShowDetail(true)} style={{ flexShrink: 0, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 12, padding: '10px 14px', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text)' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, fontSize: 13, color: 'var(--text-3)', overflow: 'hidden' }}>
        {others.map((p) => (
          <span key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--border-strong)', flexShrink: 0 }} />
            {p.name} · {tr.counter.restWord} <b style={{ color: 'var(--text-2)', fontFamily: 'var(--font-num)' }}>{sc[p.id]}</b>
          </span>
        ))}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontFamily: 'var(--font-num)', fontSize: 13, fontWeight: 700, color: 'var(--text-3)' }}>
          {s.gamePlayers.map((p) => cfg.unit === 'sets' ? (prog.setsWon[p.id] || 0) : (prog.legsSet[p.id] || 0)).join(' : ')}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-4)' }}><path d="M9 18l6-6-6-6" /></svg>
      </span>
    </button>
  );

  const deck = (fill: boolean) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: fill ? 6 : 8, minHeight: 0, ...(fill ? { flex: 1 } : { flexShrink: 0 }) }}>
      <div style={{ flexShrink: 0, background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 12, padding: fill ? '6px 16px' : '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>{tr.counter.enterThrow}</span>
        <span style={{ fontFamily: 'var(--font-num)', fontSize: fill ? 24 : 28, fontWeight: 800, color: accentInk, letterSpacing: '-.02em', minWidth: 60, textAlign: 'right' }}>{inputDisplay}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7, ...(fill ? { flex: 1, gridAutoRows: '1fr', minHeight: 0 } : {}) }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
          <button key={k} onClick={() => s.pressDigit(k)} style={keyBtn(fill)}>{k}</button>
        ))}
        <button onClick={() => s.pressClear()} style={{ ...keyBtn(fill), color: 'var(--text-3)', fontFamily: 'inherit', fontSize: 16 }}>C</button>
        <button onClick={() => s.pressDigit('0')} style={keyBtn(fill)}>0</button>
        <button onClick={() => s.pressDel()} style={{ ...keyBtn(fill), color: 'var(--text-3)' }} aria-label={tr.counter.del}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" /><path d="M18 9l-6 6M12 9l6 6" /></svg>
        </button>
      </div>
      {cfg.showQuick && (
        <div style={{ flexShrink: 0, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7 }}>
          {[180, 140, 100].map((q) => (
            <button key={q} onClick={() => s.quick(q)} style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text-2)', borderRadius: 10, padding: fill ? '8px 0' : '11px 0', fontFamily: 'var(--font-num)', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>{q}</button>
          ))}
        </div>
      )}
      <button onClick={() => s.pressEnter()} style={{ flexShrink: 0, background: accent, border: 'none', color: accFg, borderRadius: 13, padding: fill ? '11px 0' : '15px 0', fontSize: 16, fontWeight: 800, letterSpacing: '.02em', cursor: 'pointer' }}>{tr.counter.enterBtn}</button>
    </div>
  );

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid var(--hairline)', background: 'var(--bar)', flexShrink: 0 }}>
      <button onClick={() => s.go('dashboard')} style={phoneIconBtn} aria-label={tr.counter.back}><IconBack size={18} sw={2} /></button>
      <div style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>{matchInfo}</div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => s.undo()} style={phoneIconBtn} aria-label="Undo"><IconUndo size={18} /></button>
        <button onClick={() => s.abortGame()} style={{ ...phoneIconBtn, color: '#E0594B' }} aria-label={tr.counter.abort}><IconX size={18} sw={2} /></button>
      </div>
    </div>
  );

  return (
    <>
      {header}

      {landscape ? (
        // landscape: scores on the left, keypad fills the right column
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 10, padding: '8px 10px 10px' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activeCard}
            {opponentRow}
          </div>
          <div style={{ width: '44%', maxWidth: 380, minWidth: 230, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {deck(true)}
          </div>
        </div>
      ) : (
        <>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '12px 12px 8px', gap: 8 }}>
            {activeCard}
            {opponentRow}
          </div>
          <div style={{ flexShrink: 0, padding: '0 12px 12px' }}>{deck(false)}</div>
        </>
      )}

      {/* detail overlay (stats & history) */}
      {showDetail && (
        <Overlay z={35}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 18, padding: 18, width: '92vw', maxWidth: 460, maxHeight: '84vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{tr.counter.detailTitle}</div>
              <button onClick={() => setShowDetail(false)} style={phoneIconBtn} aria-label={tr.trainingScr.close}><IconX size={18} sw={2} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {s.gamePlayers.map((p) => {
                const rows = scoreList(slice, p.id);
                return (
                  <div key={p.id} style={{ border: '1px solid var(--border-2)', borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--surface-2)' }}>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{p.name}</span>
                      <span style={{ fontFamily: 'var(--font-num)', fontSize: 14, fontWeight: 800, color: accentInk }}>{sc[p.id]}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 1, background: 'var(--border)' }}>
                      {[[tr.common.avg3, average(slice, p.id).toFixed(1)], ['First 9', first9(slice, p.id).toFixed(1)], ['180·140+', `${countAtLeast(slice, p.id, 180, true)}·${countAtLeast(slice, p.id, 140)}`]].map(([label, val], k) => (
                        <div key={k} style={{ flex: 1, background: 'var(--surface-2)', padding: '7px 4px', textAlign: 'center' }}>
                          <div style={{ fontSize: 9, color: 'var(--text-4)', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase' }}>{label}</div>
                          <div style={{ fontFamily: 'var(--font-num)', fontSize: 13, fontWeight: 700, marginTop: 2 }}>{val}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ maxHeight: 150, overflowY: 'auto', padding: '4px 8px 8px' }}>
                      {rows.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-4)', padding: '8px 6px' }}>{tr.counter.noThrows}</div>}
                      {rows.map((r, i) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr', gap: 4, padding: '5px 8px', borderRadius: 6, background: r.checkout ? `color-mix(in srgb, ${accent} 12%, transparent)` : 'transparent' }}>
                          <span style={{ fontFamily: 'var(--font-num)', fontSize: 12, color: 'var(--text-5)' }}>{r.round}</span>
                          <span style={{ fontFamily: 'var(--font-num)', fontSize: 13, fontWeight: 700, textAlign: 'right', color: r.bust ? '#E0594B' : 'var(--text)' }}>{r.scored}</span>
                          <span style={{ fontFamily: 'var(--font-num)', fontSize: 13, fontWeight: 700, textAlign: 'right', color: r.checkout ? accent : 'var(--text-3)' }}>{r.rest}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Overlay>
      )}
    </>
  );
}

function Overlay({ children, z }: { children: React.ReactNode; z: number }) {
  return <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,10,12,.82)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: z }}>{children}</div>;
}

function WhoStarts() {
  const s = useStore();
  const tr = useT();
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,10,12,.86)', backdropFilter: 'blur(7px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 48 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 20, padding: '32px 34px', width: 520, maxWidth: '92vw', boxShadow: '0 30px 70px rgba(0,0,0,.55)' }}>
        {!s.bullMode ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: 22 }}>
              <div style={{ fontSize: 23, fontWeight: 800, marginBottom: 6 }}>{tr.counter.whoStarts}</div>
              <div style={{ fontSize: 14, color: 'var(--text-3)' }}>{tr.counter.whoStartsSub}</div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              {s.gamePlayers.map((p, i) => {
                const picked = s.spinPick === i;
                return (
                  <button key={p.id} className="dh-hover-border" onClick={() => s.chooseStarter(i)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, background: 'var(--btn)', border: `2px solid ${picked ? 'var(--accent)' : 'var(--border-2)'}`, borderRadius: 15, padding: '20px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <Avatar photo={p.photo} short={p.short} avi={p.av} size={54} circle />
                    <div style={{ fontSize: 15, fontWeight: 700, textAlign: 'center', lineHeight: 1.25 }}>{p.name}</div>
                    <kbd style={{ fontFamily: 'var(--font-num)', fontSize: 12, fontWeight: 800, color: 'var(--text-2)', background: 'var(--surface-3)', border: '1px solid var(--border-2)', borderRadius: 7, padding: '3px 10px' }}>{i + 1}</kbd>
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="dh-hover-border" onClick={() => s.openBullOff()} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 13, padding: 14, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#E0594B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#19A463' }} /></span>
                {tr.counter.bullOff} <kbd style={{ fontFamily: 'var(--font-num)', fontSize: 11, fontWeight: 800, color: 'var(--text-3)', background: 'var(--surface-3)', border: '1px solid var(--border-2)', borderRadius: 6, padding: '2px 7px' }}>B</kbd>
              </button>
              <button className="dh-hover-border" onClick={() => s.spinStarter()} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 13, padding: 14, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F2B829" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" /></svg>
                {tr.counter.random} <kbd style={{ fontFamily: 'var(--font-num)', fontSize: 11, fontWeight: 800, color: 'var(--text-3)', background: 'var(--surface-3)', border: '1px solid var(--border-2)', borderRadius: 6, padding: '2px 7px' }}>Z</kbd>
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>{tr.counter.bullOff}</div>
            <div style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.5, marginBottom: 24 }}>{tr.counter.bullOffSub}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {s.gamePlayers.map((p, i) => {
                return (
                  <button key={p.id} className="dh-hover-border" onClick={() => s.chooseStarter(i)} style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 13, padding: '14px 18px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                    <Avatar photo={p.photo} short={p.short} avi={p.av} size={42} circle />
                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 16, fontWeight: 700 }}>{p.name}</div><div style={{ fontSize: 12, color: 'var(--text-4)' }}>{tr.counter.closerBull}</div></div>
                    <kbd style={{ fontFamily: 'var(--font-num)', fontSize: 12, fontWeight: 800, color: 'var(--text-2)', background: 'var(--surface-3)', border: '1px solid var(--border-2)', borderRadius: 7, padding: '4px 9px' }}>{i + 1}</kbd>
                  </button>
                );
              })}
            </div>
            <button onClick={() => s.closeBullOff()} style={{ marginTop: 18, background: 'transparent', border: 'none', color: 'var(--text-3)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 8 }}>{tr.counter.backArrow}</button>
          </div>
        )}
      </div>
    </div>
  );
}

function WinOverlay() {
  const s = useStore();
  const tr = useT();
  const slice: CounterSlice = { gamePlayers: s.gamePlayers, allThrows: s.allThrows, startOffset: s.startOffset, settings: s.settings };
  const w = winner(slice);
  const prog = progress(slice);
  const accent = s.settings.accent; const accFg = accentFg(accent);
  const legs = s.gamePlayers.map((p) => s.settings.unit === 'sets' ? (prog.setsWon[p.id] || 0) : (prog.legsSet[p.id] || 0)).join(':');
  const avg = w ? average(slice, w.id).toFixed(1) : '0.0';
  // War der Siegwurf ein High Finish und/oder Short Leg? Zeigt das Sieg-Overlay an (respektiert die
  // Feier-Schalter, damit „aus“ auch hier greift). Das Live-Feier-Overlay unterdrückt sich beim
  // entscheidenden Leg selbst – hier holen wir die Auszeichnung nach.
  const ach = w ? checkoutAchievement(slice, w.id) : null;
  const finishParts: string[] = [];
  if (ach?.highFinish && s.settings.highFinishHint !== false) finishParts.push(tr.counter.winFinishHf(ach.score));
  if (ach?.shortLeg && s.settings.shortLegHint !== false) finishParts.push(tr.counter.winFinishSl(ach.darts));
  const finishLine = finishParts.length ? `🎯 ${finishParts.join(' · ')}` : null;
  // Einklappbare Match-Statistik (Standard: zu). Je Kennzahl = höher besser → besserer Wert grün.
  const players = s.gamePlayers;
  const statsOpen = s.settings.matchStatsOpen === true;
  const fsAll = players.map((p) => finishStats(slice, p.id));
  const statRows: { label: string; vals: number[]; fmt: (v: number) => string }[] = [
    { label: tr.common.avg3, vals: players.map((p) => average(slice, p.id)), fmt: (v) => v.toFixed(1) },
    { label: 'First 9', vals: players.map((p) => first9Match(slice, p.id)), fmt: (v) => v.toFixed(1) },
    { label: '180', vals: players.map((p) => countAtLeast(slice, p.id, 180, true)), fmt: (v) => String(v) },
    { label: '140+', vals: players.map((p) => countAtLeast(slice, p.id, 140)), fmt: (v) => String(v) },
    { label: 'CO %', vals: fsAll.map((f) => f.co), fmt: (v) => `${v}%` },
    { label: 'High Finish', vals: fsAll.map((f) => f.hf), fmt: (v) => (v > 0 ? String(v) : '–') },
  ];
  // Nach Spielende per Tastatur bedienbar (Desktop/Board): 1 = Dashboard, 2 = Neues Spiel, 3/Enter = Revanche,
  // S = Match-Statistik auf-/zuklappen. Live-Wert aus dem Store lesen (nicht aus dem Closure), sonst wäre er stale.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '1') { e.preventDefault(); s.endGameTo('dashboard'); }
      else if (e.key === '2') { e.preventDefault(); s.endGameTo('setup'); }
      else if (e.key === '3' || e.key === 'Enter') { e.preventDefault(); s.rematch(); }
      else if (e.key.toLowerCase() === 's') { e.preventDefault(); const st = useStore.getState(); st.setSetting('matchStatsOpen', st.settings.matchStatsOpen !== true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const kbd: React.CSSProperties = { fontFamily: 'var(--font-num)', fontSize: 10, fontWeight: 700, opacity: 0.7, background: 'rgba(0,0,0,.22)', borderRadius: 5, padding: '1px 6px', marginLeft: 7 };
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,10,12,.86)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 30 }}>
      <div style={{ textAlign: 'center', maxWidth: 440, padding: '0 24px' }}>
        <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'radial-gradient(circle,rgba(242,184,41,.25),rgba(242,184,41,.05))', border: '1px solid rgba(242,184,41,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#F2B829" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2z" /></svg>
        </div>
        <div style={{ fontSize: 13, color: '#F2B829', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 8 }}>{tr.counter.matchWon}</div>
        {/* Overlay liegt immer auf dunklem Schleier → Textfarben fest hell, unabhängig vom Hell/Dunkel-Modus. */}
        <div style={{ fontSize: 34, fontWeight: 800, marginBottom: 6, color: '#fff' }}>{w?.name}</div>
        <div style={{ fontFamily: 'var(--font-num)', fontSize: 18, color: 'rgba(255,255,255,.6)', marginBottom: finishLine ? 10 : 16 }}>{legs} · Ø {avg}</div>
        {finishLine && <div style={{ fontSize: 15, fontWeight: 800, color: '#F2B829', marginBottom: 16 }}>{finishLine}</div>}
        {/* einklappbare Match-Statistik: pro Kennzahl der bessere Wert grün beim jeweiligen Spieler */}
        <div>
          <button
            onClick={() => s.setSetting('matchStatsOpen', !statsOpen)}
            title={tr.counter.matchStats}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.15)', color: 'rgba(255,255,255,.75)', padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit', marginBottom: statsOpen ? 14 : 26 }}
          >
            {tr.counter.matchStats}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: statsOpen ? 'rotate(180deg)' : 'none', transition: 'transform .18s ease' }}><path d="M6 9l6 6 6-6" /></svg>
            <span style={kbd}>S</span>
          </button>
        </div>
        {statsOpen && (
          <div style={{ margin: '0 auto 26px', maxWidth: 360, border: '1px solid rgba(255,255,255,.12)', borderRadius: 14, background: 'rgba(255,255,255,.04)', padding: '12px 14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: `1.15fr repeat(${players.length}, 1fr)`, columnGap: 10, rowGap: 7, alignItems: 'center' }}>
              <div />
              {players.map((p) => <div key={p.id} style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,.7)', textAlign: 'right', letterSpacing: '.04em' }}>{p.short}</div>)}
              {statRows.map((r) => {
                const best = Math.max(...r.vals); const worst = Math.min(...r.vals); const hasWinner = best > worst;
                return (
                  <Fragment key={r.label}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.42)', textTransform: 'uppercase', letterSpacing: '.03em', textAlign: 'left' }}>{r.label}</div>
                    {r.vals.map((v, i) => (
                      <div key={i} style={{ fontFamily: 'var(--font-num)', fontSize: 15, fontWeight: 800, textAlign: 'right', color: hasWinner && v === best ? '#2BD377' : 'rgba(255,255,255,.85)' }}>{r.fmt(v)}</div>
                    ))}
                  </Fragment>
                );
              })}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
          <button onClick={() => s.endGameTo('dashboard')} style={{ background: 'var(--surface-3)', border: '1px solid var(--border-2)', color: 'var(--text-2)', padding: '13px 24px', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{tr.counter.toDashboard}<span style={kbd}>1</span></button>
          <button onClick={() => s.endGameTo('setup')} style={{ background: 'var(--surface-3)', border: '1px solid var(--border-2)', color: 'var(--text-2)', padding: '13px 24px', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{tr.counter.newGame}<span style={kbd}>2</span></button>
          <button onClick={() => s.rematch()} style={{ background: accent, border: 'none', color: accFg, padding: '13px 28px', borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>{tr.counter.rematch}<span style={{ ...kbd, background: 'rgba(0,0,0,.28)' }}>3</span></button>
        </div>
      </div>
    </div>
  );
}
