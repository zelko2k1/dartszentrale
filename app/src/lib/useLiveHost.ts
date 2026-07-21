// Host-Controller für „Remote & Live" (Plan docs/plan-remote.md, Phase 2).
// Einmal in App gemountet. Aktiv NUR im Board-/Kiosk-Modus (entschieden 2026-07-19): sobald ein
// Board-Konto im Vereinsmodus angemeldet ist und `remoteEnabled` an ist, veröffentlicht dieses Gerät
// automatisch eine Live-Session, spiegelt den Spielstand debounced und spielt eingehende Befehle über
// die bestehenden Store-Aktionen ab. Kein PC-Klick nötig (Notfall-Szenario).
import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useLiveHostStore, genPairCode, projectLiveState, applyRemoteCommand } from './liveHost';

function currentBoardName(): string {
  const s = useStore.getState();
  const me = s.accounts.find((a) => a.id === s.session);
  const named = (s.settings.boardName || '').trim();
  if (named) return named;
  return me?.isBoard && me.boardNumber != null ? `Board ${me.boardNumber}` : 'Board';
}

export function useLiveHost(): void {
  const provider = useStore((s) => s.provider);
  // Host nur, wenn: Vereinsmodus + Provider kann Live + angemeldetes Board-Konto + remoteEnabled an.
  const isBoardHost = useStore((s) => {
    const me = s.accounts.find((a) => a.id === s.session);
    return s.settings.appMode === 'verein' && s.provider.liveSupported
      && !!me?.isBoard && me?.boardNumber != null && s.settings.remoteEnabled !== false;
  });

  useEffect(() => {
    if (!isBoardHost) return;
    let cancelled = false;
    let sid: string | null = null;
    let unsubCmd: (() => void) | null = null;
    let unsubStore: (() => void) | null = null;
    let pushTimer: number | undefined;
    let heartbeat: number | undefined;
    let appliedSeq = 0;
    const code = genPairCode();

    const pushState = () => {
      if (!sid) return;
      provider.liveUpdateState(sid, projectLiveState(useStore.getState()), false).catch(() => {});
    };
    const schedulePush = () => {
      if (pushTimer) window.clearTimeout(pushTimer);
      pushTimer = window.setTimeout(pushState, 150);
    };

    (async () => {
      try {
        sid = await provider.livePublish({ boardName: currentBoardName(), code, state: projectLiveState(useStore.getState()) });
      } catch { return; }
      if (cancelled) { void provider.liveEnd(sid).catch(() => {}); sid = null; return; }
      useLiveHostStore.setState({ sessionId: sid, code });

      // Eingehende Befehle: in seq-Reihenfolge abspielen (idempotent), dann bestätigen + löschen.
      unsubCmd = provider.liveConsume(sid, (cmd) => {
        if (!sid) return;
        if (cmd.seq <= appliedSeq) { void provider.liveDeleteCommand(cmd.id); return; }
        applyRemoteCommand(cmd);
        appliedSeq = cmd.seq;
        void provider.liveAck(sid, cmd.seq, projectLiveState(useStore.getState())).catch(() => {});
        void provider.liveDeleteCommand(cmd.id);
      });

      // Lokale Änderungen am Board (selbst getippt) ebenfalls spiegeln — debounced.
      unsubStore = useStore.subscribe(schedulePush);

      // Lebenszeichen: erneuert heartbeat regelmäßig, damit die Server-Cleanup (Cron) ein abgestürztes
      // Board von einem still ruhenden Board (kein Wurf, aber online) unterscheiden kann.
      heartbeat = window.setInterval(() => {
        if (sid) void provider.liveUpdateState(sid, projectLiveState(useStore.getState()), true).catch(() => {});
      }, 30000);
    })();

    return () => {
      cancelled = true;
      if (pushTimer) window.clearTimeout(pushTimer);
      if (heartbeat) window.clearInterval(heartbeat);
      if (unsubCmd) unsubCmd();
      if (unsubStore) unsubStore();
      if (sid) void provider.liveEnd(sid).catch(() => {});
      useLiveHostStore.setState({ sessionId: null, code: null });
    };
  }, [isBoardHost, provider]);
}
