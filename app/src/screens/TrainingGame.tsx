import { Fragment, useState } from 'react';
import { useStore } from '../store/useStore';
import { avatar } from '../data/constants';
import { CRICKET_TARGETS } from '../data/constants';
import { accentFg } from '../store/selectors';
import {
  standings, leaderboard, currentTarget, trainModeName,
  ATC_SEQ, BASEBALL_INNINGS, HALVEIT_TARGETS,
  type TrainGame, type TrainPlayer, type StandRow,
} from '../store/training';
import { IconBack, IconUndo, IconX } from '../lib/icons';

export function TrainingGame() {
  const s = useStore();
  const g = s.trainGame;
  if (!g) return null;
  const accent = s.settings.accent;
  const rows = standings(g);
  const cur = g.players[g.turnIdx];
  const tgt = currentTarget(g);
  const canUndo = s.trainUndo.length > 0;

  const headBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 7, background: 'var(--surface-3)', border: '1px solid var(--border-2)', color: 'var(--text-2)', padding: '9px 13px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };

  const roundLabel = g.modeId === 'baseball' ? `Inning ${Math.min(g.round, 9)} / 9`
    : g.modeId === 'halveit' ? `Runde ${g.round} / 9`
    : g.modeId === 'doubles' || g.modeId === 'bobs27' ? `Ziel ${g.round} / 21`
    : g.modeId === 'checkout121' ? `Finish ${g.round}`
    : `Runde ${g.round}`;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', background: s.settings.mode === 'light' ? 'var(--bg)' : '#0c0e11', fontFamily: 'inherit' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid var(--hairline)', background: 'var(--bar)', flexShrink: 0 }}>
        <button onClick={() => s.trainExit()} style={headBtn}><IconBack size={15} sw={2} />Beenden</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '.02em' }}>{trainModeName(g.modeId)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 2 }}>{roundLabel}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => s.trainUndoTurn()} disabled={!canUndo} style={{ ...headBtn, opacity: canUndo ? 1 : 0.4, cursor: canUndo ? 'pointer' : 'default' }}><IconUndo size={15} />Undo</button>
          <button onClick={() => s.trainExit()} style={{ ...headBtn, background: 'rgba(224,75,67,.10)', border: '1px solid rgba(224,75,67,.32)', color: '#E0594B' }}><IconX size={15} sw={2} />Abbrechen</button>
        </div>
      </div>

      {/* scoreboard */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 14 }}>
        {MATRIX_MODES.includes(g.modeId) ? (
          <GameBoard game={g} accent={accent} activeId={cur.id} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${g.players.length > 4 ? 170 : 220}px, 1fr))`, gap: 12, maxWidth: 1100, margin: '0 auto' }}>
            {rows.map((r) => <PlayerCard key={r.player.id} row={r} active={r.player.id === cur.id && !g.over} accent={accent} />)}
          </div>
        )}
      </div>

      {/* input deck */}
      {!g.over && (
        <div style={{ flexShrink: 0, borderTop: '1px solid var(--hairline)', background: 'var(--bar)', padding: '14px 16px' }}>
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: accent, boxShadow: `0 0 10px ${accent}`, flexShrink: 0 }} />
              <span style={{ fontSize: 15, fontWeight: 700 }}>{cur.name}</span>
              <span style={{ fontSize: 13, color: 'var(--text-4)' }}>ist am Wurf</span>
              {tgt && (
                <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>Ziel</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 18, fontWeight: 800, color: accent, background: `color-mix(in srgb, ${accent} 14%, transparent)`, padding: '3px 12px', borderRadius: 9 }}>{tgt.label}</span>
                  {tgt.hint && <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: 'var(--text-3)' }}>{tgt.hint}</span>}
                </span>
              )}
            </div>
            <InputDeck game={g} accent={accent} />
          </div>
        </div>
      )}

      {g.over && <TrainWinOverlay game={g} accent={accent} />}
    </div>
  );
}

function PlayerCard({ row, active, accent }: { row: StandRow; active: boolean; accent: string }) {
  const av = avatar(row.player.av);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderRadius: 16, padding: '14px 16px', background: active ? `color-mix(in srgb, ${accent} 9%, var(--surface-2))` : 'var(--surface-2)', border: `1px solid ${active ? accent : 'var(--border-2)'}`, boxShadow: active ? `0 0 0 1px ${accent}` : 'none', opacity: row.eliminated ? 0.5 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: av.bg, color: av.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{row.player.short}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.player.name}</div>
          {active && <div style={{ fontSize: 10, color: accent, fontWeight: 800, letterSpacing: '.06em' }}>AM WURF</div>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 28, fontWeight: 800, color: active ? accent : 'var(--text)', lineHeight: 1 }}>{row.primary}</div>
        {row.secondary && <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: 'var(--text-4)' }}>{row.secondary}</div>}
      </div>
      {row.sub && <div style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 600 }}>{row.sub}</div>}
    </div>
  );
}

// ── Cricket: klassisches Marks-Raster (Felder × Spieler) ──
// Marks-Glyph: 1 = /, 2 = X, 3 = ⊗ (geschlossen). Geschlossene Felder + aktive Spalte werden hervorgehoben.
function MarkCell({ n, color, dim }: { n: number; color: string; dim: string }) {
  if (n <= 0) return <span style={{ color: dim, fontSize: 13 }}>·</span>;
  const sw = 2.6;
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" style={{ display: 'block' }}>
      {n >= 1 && <line x1="5" y1="19" x2="19" y2="5" stroke={color} strokeWidth={sw} strokeLinecap="round" />}
      {n >= 2 && <line x1="5" y1="5" x2="19" y2="19" stroke={color} strokeWidth={sw} strokeLinecap="round" />}
      {n >= 3 && <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" fill="none" />}
    </svg>
  );
}

// ── Generisches Matrix-Board (Ziele/Runden × Spieler) ──
const MATRIX_MODES = ['cricket', 'baseball', 'atc', 'halveit'];

interface BoardCol { player: TrainPlayer; primary: string; secondary?: string; active: boolean; eliminated?: boolean; }
interface BoardRow { key: string | number; label: string; dim?: boolean; highlight?: boolean; }

function MatrixBoard({ headLabel, cols, rows, accent, renderCell, footer }: {
  headLabel: string;
  cols: BoardCol[];
  rows: BoardRow[];
  accent: string;
  renderCell: (colIndex: number, rowIndex: number) => React.ReactNode;
  footer?: { label: string; values: React.ReactNode[] };
}) {
  const grid = `58px repeat(${cols.length}, minmax(58px, 1fr))`;
  const cellBase: React.CSSProperties = { background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const activeBg = `color-mix(in srgb, ${accent} 10%, var(--surface-2))`;
  const rowBg = `color-mix(in srgb, ${accent} 5%, var(--surface-2))`;

  return (
    <div style={{ maxWidth: Math.min(1100, 140 + cols.length * 130), margin: '0 auto', overflowX: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: grid, gap: 1, background: 'var(--border)', border: '1px solid var(--border-2)', borderRadius: 14, overflow: 'hidden', minWidth: 'fit-content' }}>
        {/* Kopfzeile */}
        <div style={{ ...cellBase, padding: '10px 0', fontSize: 10, color: 'var(--text-5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>{headLabel}</div>
        {cols.map((c, i) => {
          const av = avatar(c.player.av);
          return (
            <div key={i} style={{ ...cellBase, flexDirection: 'column', gap: 4, padding: '9px 6px', background: c.active ? activeBg : 'var(--surface-2)', borderBottom: c.active ? `2px solid ${accent}` : '2px solid transparent', opacity: c.eliminated ? 0.5 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, maxWidth: '100%' }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, background: av.bg, color: av.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 10, flexShrink: 0 }}>{c.player.short}</div>
                <span style={{ fontSize: 12, fontWeight: 700, color: c.active ? accent : 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.player.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 17, fontWeight: 800, color: c.active ? accent : 'var(--text)', lineHeight: 1 }}>{c.primary}</div>
                {c.secondary && <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700, color: 'var(--text-4)' }}>{c.secondary}</div>}
              </div>
            </div>
          );
        })}

        {/* Zeilen */}
        {rows.map((row, r) => (
          <Fragment key={row.key}>
            <div style={{ ...cellBase, fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 800, color: row.dim ? 'var(--text-5)' : 'var(--text-2)', textDecoration: row.dim ? 'line-through' : 'none', background: row.highlight ? rowBg : 'var(--surface-2)', whiteSpace: 'nowrap', overflow: 'hidden' }}>{row.label}</div>
            {cols.map((c, i) => (
              <div key={i} style={{ ...cellBase, padding: '7px 0', minHeight: 38, background: c.active ? activeBg : (row.highlight ? rowBg : 'var(--surface-2)') }}>
                {renderCell(i, r)}
              </div>
            ))}
          </Fragment>
        ))}

        {/* Fußzeile */}
        {footer && (
          <>
            <div style={{ ...cellBase, padding: '8px 0', fontSize: 9, color: 'var(--text-5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em' }}>{footer.label}</div>
            {footer.values.map((v, i) => (
              <div key={i} style={{ ...cellBase, padding: '8px 0', background: cols[i].active ? activeBg : 'var(--surface-2)', fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: 'var(--text-4)' }}>{v}</div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function CheckIcon({ color }: { color: string }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><path d="M20 6 9 17l-5-5" /></svg>;
}
const dotCell = (txt = '·'): React.ReactNode => <span style={{ color: 'var(--text-5)', fontSize: 13 }}>{txt}</span>;

function GameBoard({ game, accent, activeId }: { game: TrainGame; accent: string; activeId: string }) {
  const players = game.players;
  const isActive = (p: TrainPlayer) => p.id === activeId && !game.over;

  switch (game.modeId) {
    case 'cricket': {
      const marks = game.data.marks!; const points = game.data.points!;
      const cols: BoardCol[] = players.map((p) => ({ player: p, primary: String(points[p.id]), active: isActive(p) }));
      const rows: BoardRow[] = CRICKET_TARGETS.map((num) => ({ key: num, label: num === 25 ? 'Bull' : String(num), dim: players.every((p) => marks[p.id][num] >= 3) }));
      const renderCell = (ci: number, ri: number) => {
        const p = players[ci]; const num = CRICKET_TARGETS[ri]; const m = marks[p.id][num];
        const color = m >= 3 ? accent : (isActive(p) ? 'var(--text)' : 'var(--text-3)');
        return <MarkCell n={m} color={color} dim="var(--text-5)" />;
      };
      const footer = { label: 'Zu', values: players.map((p) => `${CRICKET_TARGETS.filter((num) => marks[p.id][num] >= 3).length}/${CRICKET_TARGETS.length}`) };
      return <MatrixBoard headLabel="Feld" cols={cols} rows={rows} accent={accent} renderCell={renderCell} footer={footer} />;
    }
    case 'baseball': {
      const innings = game.data.innings!; const runs = game.data.runs!;
      const cols: BoardCol[] = players.map((p) => ({ player: p, primary: String(runs[p.id]), secondary: 'R', active: isActive(p) }));
      const rows: BoardRow[] = Array.from({ length: BASEBALL_INNINGS }, (_, i) => ({ key: i + 1, label: String(i + 1), highlight: (i + 1) === game.round && !game.over }));
      const renderCell = (ci: number, ri: number) => {
        const arr = innings[players[ci].id];
        if (ri >= arr.length) return dotCell();
        const v = arr[ri];
        return <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 15, fontWeight: 700, color: v > 0 ? 'var(--text)' : 'var(--text-5)' }}>{v}</span>;
      };
      return <MatrixBoard headLabel="Inn." cols={cols} rows={rows} accent={accent} renderCell={renderCell} />;
    }
    case 'atc': {
      const pos = game.data.pos!; const darts = game.data.darts!;
      const cols: BoardCol[] = players.map((p) => ({ player: p, primary: `${pos[p.id]}/${ATC_SEQ.length}`, secondary: `${darts[p.id]}D`, active: isActive(p) }));
      const rows: BoardRow[] = ATC_SEQ.map((v) => ({ key: v, label: v === 25 ? 'Bull' : String(v) }));
      const renderCell = (ci: number, ri: number) => {
        const p = players[ci]; const cleared = pos[p.id] > ri; const current = pos[p.id] === ri && !game.over;
        if (cleared) return <CheckIcon color={accent} />;
        if (current) return <span style={{ width: 10, height: 10, borderRadius: '50%', boxSizing: 'border-box', border: `2px solid ${isActive(p) ? accent : 'var(--text-4)'}`, background: isActive(p) ? accent : 'transparent', display: 'block' }} />;
        return dotCell();
      };
      return <MatrixBoard headLabel="Ziel" cols={cols} rows={rows} accent={accent} renderCell={renderCell} />;
    }
    case 'halveit': {
      const rounds = game.data.rounds!; const score = game.data.score!;
      const cols: BoardCol[] = players.map((p) => ({ player: p, primary: String(score[p.id]), active: isActive(p) }));
      const rows: BoardRow[] = HALVEIT_TARGETS.map((t, i) => ({ key: i, label: t.label, highlight: (i + 1) === game.round && !game.over }));
      const renderCell = (ci: number, ri: number) => {
        const arr = rounds[players[ci].id];
        if (ri >= arr.length) return dotCell();
        const e = arr[ri];
        return <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 700, color: e.hit ? 'var(--text)' : '#E0594B' }}>{e.val}</span>;
      };
      return <MatrixBoard headLabel="Runde" cols={cols} rows={rows} accent={accent} renderCell={renderCell} />;
    }
    default: return null;
  }
}

// ── pro-Modus Eingabe ──
function InputDeck({ game, accent }: { game: TrainGame; accent: string }) {
  switch (game.modeId) {
    case 'doubles': case 'bobs27': return <HitsPanel />;
    case 'atc': return <AdvancePanel />;
    case 'checkout121': return <CheckoutPanel accent={accent} />;
    case 'baseball': return <RunsPanel />;
    case 'halveit': return <HalvePanel accent={accent} />;
    case 'elimination': return <ScorePanel accent={accent} />;
    case 'cricket': return <CricketPanel game={game} accent={accent} />;
    case 'killer': return <KillerPanel game={game} accent={accent} />;
    default: return null;
  }
}

const bigBtn = (): React.CSSProperties => ({ flex: 1, minWidth: 64, background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', borderRadius: 13, padding: '16px 0', fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 800, cursor: 'pointer' });
const primaryBtn = (accent: string): React.CSSProperties => ({ background: accent, border: 'none', color: accentFg(accent), borderRadius: 12, padding: '13px 24px', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' });

function HitsPanel() {
  const apply = useStore((s) => s.trainApply);
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 600, marginBottom: 8 }}>Wie viele der 3 Darts haben getroffen?</div>
      <div style={{ display: 'flex', gap: 10 }}>
        {[0, 1, 2, 3].map((h) => (
          <button key={h} onClick={() => apply({ kind: 'hits', hits: h })} style={bigBtn()}>{h}</button>
        ))}
      </div>
    </div>
  );
}

function AdvancePanel() {
  const apply = useStore((s) => s.trainApply);
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 600, marginBottom: 8 }}>Wie viele Ziele in dieser Aufnahme geschafft?</div>
      <div style={{ display: 'flex', gap: 10 }}>
        {[0, 1, 2, 3].map((h) => (
          <button key={h} onClick={() => apply({ kind: 'advance', advance: h })} style={bigBtn()}>+{h}</button>
        ))}
      </div>
    </div>
  );
}

function CheckoutPanel({ accent }: { accent: string }) {
  const apply = useStore((s) => s.trainApply);
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {[1, 2, 3].map((d) => (
        <button key={d} onClick={() => apply({ kind: 'made', made: true, darts: d })} style={{ ...bigBtn(), background: `color-mix(in srgb, ${accent} 16%, var(--btn))`, border: `1px solid ${accent}`, color: 'var(--text)', fontSize: 15 }}>✓ {d} Dart{d > 1 ? 's' : ''}</button>
      ))}
      <button onClick={() => apply({ kind: 'made', made: false, darts: 3 })} style={{ ...bigBtn(), background: 'rgba(224,89,75,.12)', border: '1px solid rgba(224,89,75,.4)', color: '#E0594B', fontSize: 15 }}>✗ Verfehlt</button>
    </div>
  );
}

function RunsPanel() {
  const apply = useStore((s) => s.trainApply);
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 600, marginBottom: 8 }}>Runs dieses Inning (Single=1 · Double=2 · Triple=3 je Treffer)</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((r) => (
          <button key={r} onClick={() => apply({ kind: 'runs', runs: r })} style={{ ...bigBtn(), padding: '14px 0', fontSize: 20 }}>{r}</button>
        ))}
      </div>
    </div>
  );
}

function HalvePanel({ accent }: { accent: string }) {
  const apply = useStore((s) => s.trainApply);
  const [val, setVal] = useState('');
  const v = parseInt(val, 10);
  const valid = !isNaN(v) && v > 0 && v <= 180;
  const submit = () => { if (valid) { apply({ kind: 'halve', scored: v }); setVal(''); } };
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <input autoFocus type="text" inputMode="numeric" value={val} placeholder="Punkte"
        onChange={(e) => setVal(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        style={{ flex: 1, minWidth: 120, background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 12, padding: '13px 16px', color: 'var(--text)', fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 800, textAlign: 'center', outline: 'none', boxSizing: 'border-box' }} />
      <button onClick={submit} disabled={!valid} style={{ ...primaryBtn(accent), opacity: valid ? 1 : 0.4, cursor: valid ? 'pointer' : 'default', padding: '15px 24px' }}>Eintragen</button>
      <button onClick={() => { apply({ kind: 'halve', scored: 0 }); setVal(''); }} style={{ background: 'rgba(224,89,75,.12)', border: '1px solid rgba(224,89,75,.4)', color: '#E0594B', borderRadius: 12, padding: '15px 22px', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Verfehlt → halbieren</button>
    </div>
  );
}

function ScorePanel({ accent }: { accent: string }) {
  const apply = useStore((s) => s.trainApply);
  const [val, setVal] = useState('');
  const v = val === '' ? 0 : parseInt(val, 10);
  const valid = !isNaN(v) && v >= 0 && v <= 180;
  const submit = () => { if (valid) { apply({ kind: 'score', score: v }); setVal(''); } };
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
        <input autoFocus type="text" inputMode="numeric" value={val} placeholder="Aufnahme"
          onChange={(e) => setVal(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          style={{ flex: 1, background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 12, padding: '13px 16px', color: 'var(--text)', fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 800, textAlign: 'center', outline: 'none', boxSizing: 'border-box' }} />
        <button onClick={submit} disabled={!valid} style={{ ...primaryBtn(accent), opacity: valid ? 1 : 0.4, cursor: valid ? 'pointer' : 'default', padding: '15px 24px' }}>Eintragen</button>
      </div>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        {[26, 40, 41, 45, 60, 81, 100, 140, 180].map((q) => (
          <button key={q} onClick={() => { apply({ kind: 'score', score: q }); setVal(''); }} style={{ flex: '1 1 60px', background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text-2)', borderRadius: 10, padding: '10px 0', fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>{q}</button>
        ))}
      </div>
    </div>
  );
}

function CricketPanel({ game, accent }: { game: TrainGame; accent: string }) {
  const apply = useStore((s) => s.trainApply);
  const [mult, setMult] = useState(1);
  const [marks, setMarks] = useState<Record<number, number>>({});
  const [darts, setDarts] = useState(0);
  const cur = game.players[game.turnIdx];
  const myMarks = game.data.marks![cur.id];

  const addDart = (num: number) => {
    if (darts >= 3) return;
    setMarks((m) => ({ ...m, [num]: (m[num] || 0) + mult }));
    setDarts((d) => d + 1);
  };
  const reset = () => { setMarks({}); setDarts(0); };
  const submit = () => { apply({ kind: 'marks', marks }); reset(); };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 600 }}>Feldwert:</span>
        {[['Single', 1], ['Double', 2], ['Triple', 3]].map(([lbl, m]) => (
          <button key={m as number} onClick={() => setMult(m as number)} style={{ background: mult === m ? accent : 'var(--btn)', color: mult === m ? accentFg(accent) : 'var(--text-2)', border: `1px solid ${mult === m ? accent : 'var(--border-2)'}`, borderRadius: 9, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{lbl}</button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-3)', fontFamily: "'JetBrains Mono',monospace" }}>Darts: {darts}/3</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 10 }}>
        {CRICKET_TARGETS.map((num) => {
          const closed = myMarks[num] >= 3;
          const pending = marks[num] || 0;
          return (
            <button key={num} onClick={() => addDart(num)} disabled={darts >= 3} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: closed ? `color-mix(in srgb, ${accent} 18%, var(--btn))` : 'var(--btn)', border: `1px solid ${pending ? accent : 'var(--border-2)'}`, borderRadius: 11, padding: '10px 0', cursor: darts >= 3 ? 'default' : 'pointer', opacity: darts >= 3 ? 0.5 : 1, fontFamily: 'inherit' }}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{num === 25 ? 'Bull' : num}</span>
              <span style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 700 }}>{marksGlyph(Math.min(3, myMarks[num] + pending))}{pending ? ` +${pending}` : ''}</span>
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={reset} disabled={darts === 0} style={{ background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text-3)', borderRadius: 12, padding: '13px 22px', fontSize: 14, fontWeight: 700, cursor: darts ? 'pointer' : 'default', opacity: darts ? 1 : 0.5, fontFamily: 'inherit' }}>Zurücksetzen</button>
        <button onClick={submit} style={{ ...primaryBtn(accent), flex: 1 }}>Aufnahme eintragen</button>
      </div>
    </div>
  );
}
function marksGlyph(n: number) { return n >= 3 ? 'Ⓧ' : n === 2 ? '⊘' : n === 1 ? '╱' : '–'; }

function KillerPanel({ game, accent }: { game: TrainGame; accent: string }) {
  const apply = useStore((s) => s.trainApply);
  const [darts, setDarts] = useState<(string | null)[]>([]);
  const cur = game.players[game.turnIdx];
  const isKiller = game.data.isKiller![cur.id];
  const lives = game.data.lives!;
  const num = game.data.num!;

  const addDart = (target: string | null) => { if (darts.length < 3) setDarts((d) => [...d, target]); };
  const reset = () => setDarts([]);
  const submit = () => { apply({ kind: 'killer', darts }); reset(); };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
          {isKiller ? <b style={{ color: accent }}>Killer aktiv</b> : <>Triff deine Zahl <b style={{ color: 'var(--text)' }}>{num[cur.id]}</b>, um Killer zu werden</>}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-3)', fontFamily: "'JetBrains Mono',monospace" }}>Darts: {darts.length}/3</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(110px, 1fr))`, gap: 8, marginBottom: 10 }}>
        {game.players.map((p) => {
          const dead = lives[p.id] <= 0;
          const self = p.id === cur.id;
          const hitCount = darts.filter((d) => d === p.id).length;
          return (
            <button key={p.id} onClick={() => addDart(p.id)} disabled={dead || darts.length >= 3} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: hitCount ? `color-mix(in srgb, ${accent} 16%, var(--btn))` : 'var(--btn)', border: `1px solid ${self ? accent : 'var(--border-2)'}`, borderRadius: 11, padding: '10px 6px', cursor: (dead || darts.length >= 3) ? 'default' : 'pointer', opacity: dead ? 0.4 : 1, fontFamily: 'inherit' }}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{num[p.id]}</span>
              <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{self ? 'Eigene' : p.short} · {'♥'.repeat(Math.max(0, lives[p.id])) || '✗'}{hitCount ? ` (${hitCount})` : ''}</span>
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => addDart(null)} disabled={darts.length >= 3} style={{ background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text-3)', borderRadius: 12, padding: '13px 20px', fontSize: 14, fontWeight: 700, cursor: darts.length >= 3 ? 'default' : 'pointer', opacity: darts.length >= 3 ? 0.5 : 1, fontFamily: 'inherit' }}>Daneben</button>
        <button onClick={reset} disabled={!darts.length} style={{ background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text-3)', borderRadius: 12, padding: '13px 20px', fontSize: 14, fontWeight: 700, cursor: darts.length ? 'pointer' : 'default', opacity: darts.length ? 1 : 0.5, fontFamily: 'inherit' }}>Zurück</button>
        <button onClick={submit} style={{ ...primaryBtn(accent), flex: 1 }}>Aufnahme eintragen</button>
      </div>
    </div>
  );
}

function TrainWinOverlay({ game, accent }: { game: TrainGame; accent: string }) {
  const s = useStore();
  const board = leaderboard(game);
  const solo = game.players.length === 1;
  const winners = game.winnerIds.map((id) => game.players.find((p) => p.id === id)?.name).filter(Boolean);
  const title = solo ? 'Training beendet' : winners.length > 1 ? 'Unentschieden' : 'Gewonnen';
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,10,12,.86)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40, padding: 24 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 20, padding: 28, width: 460, maxWidth: '94vw', boxShadow: '0 30px 70px rgba(0,0,0,.55)' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'radial-gradient(circle,rgba(242,184,41,.25),rgba(242,184,41,.05))', border: '1px solid rgba(242,184,41,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#F2B829" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2z" /></svg>
          </div>
          <div style={{ fontSize: 12, color: '#F2B829', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 6 }}>{title}</div>
          {!solo && <div style={{ fontSize: 26, fontWeight: 800 }}>{winners.join(' & ') || '—'}</div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
          {board.map((r) => {
            const isWin = game.winnerIds.includes(r.player.id);
            return (
              <div key={r.player.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 12, background: isWin ? `color-mix(in srgb, ${accent} 12%, var(--surface-2))` : 'var(--surface-2)', border: `1px solid ${isWin ? accent : 'var(--border-2)'}` }}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 800, color: 'var(--text-4)', width: 20 }}>{solo ? '' : `${r.rank}.`}</span>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.player.name}</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 16, fontWeight: 800, color: isWin ? accent : 'var(--text-2)' }}>{r.primary}</span>
                {r.secondary && <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: 'var(--text-4)' }}>{r.secondary}</span>}
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => s.trainExit()} style={{ background: 'var(--surface-3)', border: '1px solid var(--border-2)', color: 'var(--text-2)', padding: '13px 24px', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Beenden</button>
          <button onClick={() => s.trainRematch()} style={{ background: accent, border: 'none', color: accentFg(accent), padding: '13px 28px', borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Nochmal</button>
        </div>
      </div>
    </div>
  );
}
