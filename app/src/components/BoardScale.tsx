// BoardScale.tsx
// Zoom-Wrapper für die Vollbild-Spiel-Screens (Counter, TrainingGame).
// CSS `zoom: z` skaliert den gesamten Inhalt (Schriften, Abstände, Buttons) um Faktor z hoch –
// ideal fürs Betrachten aus großer Distanz am Board-Monitor. Der Restscore misst sich an seiner Box
// (Container-Query-Einheiten cqh/cqw) und bleibt dadurch optisch gleich groß; alles fix in px Gesetzte
// wächst mit. Wichtig: bei `zoom` löst `width/height: 100%` bereits auf die VISUELLE Viewport-Größe auf
// (keine 1/z-Kompensation nötig); die Kind-Screens nutzen `height: 100%` statt `100vh`, damit nichts
// über den Viewport hinausläuft. Greift nur am Board (device === 'desktop') und nur bei > 100 %.

import { useStore } from '../store/useStore';

export function BoardScale({ children }: { children: React.ReactNode }) {
  const cfg = useStore((s) => s.settings);
  const z = cfg.device === 'desktop' ? Math.max(1, (cfg.boardScale ?? 100) / 100) : 1;

  if (z === 1) return <>{children}</>;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        zoom: z as unknown as number,
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}
