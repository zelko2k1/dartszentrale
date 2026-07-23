import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { assignBoards, participantById } from '../store/tournament';
import type { Tournament } from '../data/types';
import { useT } from '../i18n';

// Zeigt auf einem Board-PC (Kiosk) die diesem Board vom Turnier zugewiesene nächste Partie an.
// Wird nur im Board-Spiel-View gerendert (siehe App.tsx). Ohne Zuweisung → null (unsichtbar).
export function TournamentBoardOverlay() {
  const s = useStore();
  const tr = useT();
  const tt = tr.tournament;
  const me = s.accounts.find((a) => a.id === s.session) || null;
  const boardNumber = me?.isBoard ? (me.boardNumber ?? null) : null;
  const isVereinBoard = s.settings.appMode === 'verein' && boardNumber != null;
  // Board-PC: regelmäßig frisch laden, damit ein neu angelegtes Turnier / die nächste zugewiesene Partie
  // zuverlässig auftaucht (Fallback zur Realtime-Aktualisierung). Nur solange dieses Overlay montiert ist
  // (= Board wartet, spielt nicht) → kein Poll während einer laufenden Partie.
  const reload = s.reloadFromProvider;
  useEffect(() => {
    if (!isVereinBoard) return;
    const id = setInterval(() => reload(), 4000);
    return () => clearInterval(id);
  }, [isVereinBoard, reload]);
  if (!isVereinBoard) return null;

  // Laufende Turniere, neueste zuerst → erste Zuweisung für dieses Board gewinnt.
  const running = [...s.tournaments].filter((t) => t.status === 'running').sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  let hit: { t: Tournament; matchId: string } | null = null;
  for (const t of running) {
    const a = assignBoards(t).find((x) => x.board === boardNumber);
    if (a) { hit = { t, matchId: a.matchId }; break; }
  }
  if (!hit) return null;
  const m = hit.t.matches.find((x) => x.id === hit!.matchId);
  if (!m) return null;
  const home = participantById(hit.t, m.homeId)?.name || '?';
  const away = participantById(hit.t, m.awayId)?.name || '?';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(8,10,12,.82)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 22, padding: '34px 40px', width: 560, maxWidth: '94vw', textAlign: 'center', boxShadow: '0 30px 80px rgba(0,0,0,.6)' }}>
        <div style={{ fontSize: 13, color: '#F2B829', fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase' }}>{tt.board(boardNumber)} · {hit.t.name}</div>
        <div style={{ fontSize: 13, color: 'var(--text-4)', fontWeight: 700, marginTop: 4 }}>{tt.boardNextMatch}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, margin: '26px 0 30px' }}>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.02em', flex: 1, textAlign: 'right' }}>{home}</div>
          <div style={{ fontSize: 16, color: 'var(--text-4)', fontWeight: 700, fontFamily: 'var(--font-num)' }}>{tt.vs}</div>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.02em', flex: 1, textAlign: 'left' }}>{away}</div>
        </div>
        <button onClick={() => s.startTournamentMatch(m.id, boardNumber, hit.t.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: '#F2B829', border: 'none', color: '#06160d', padding: '15px 34px', borderRadius: 13, fontSize: 17, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 8px 24px color-mix(in srgb, #F2B829 30%, transparent)' }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4" /></svg>
          {tt.boardStart}
        </button>
      </div>
    </div>
  );
}
