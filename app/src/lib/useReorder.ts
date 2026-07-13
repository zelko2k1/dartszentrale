// Wiederverwendbares Umsortieren per Drag & Drop — pointer-basiert, damit es auch auf Tablets/Boards
// (Touch) funktioniert, ohne zusätzliche Abhängigkeit. Passt sowohl für Reihen als auch für umbrechende
// Grids: Ziel ist das Element, dessen Mittelpunkt dem Zeiger am nächsten liegt (2D-Distanz).
//
// Nutzung:
//   const dnd = useReorder(canEdit, (from, to) => reorder(from, to));
//   <div ref={dnd.containerRef}> {items.map((it, i) => (
//     <button {...dnd.itemProps(i)} style={{ ...dnd.itemStyle(i), … }} onClick={…}>…</button>
//   ))} </div>
// Der Klick des Elements wird nach einem Drag automatisch unterdrückt (keine versehentliche Auswahl).
import { useCallback, useRef, useState } from 'react';

export interface ReorderItemProps {
  'data-reorder-item': number;
  onPointerDown?: (e: React.PointerEvent) => void;
  onPointerMove?: (e: React.PointerEvent) => void;
  onPointerUp?: (e: React.PointerEvent) => void;
  onPointerCancel?: (e: React.PointerEvent) => void;
  onClickCapture?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}

export interface Reorder {
  containerRef: (el: HTMLElement | null) => void;
  dragIndex: number | null;   // aktuell gezogenes Element (oder null)
  overIndex: number | null;   // aktuelles Ziel (oder null)
  itemProps: (index: number) => ReorderItemProps;
}

const THRESHOLD = 6; // Pixel Bewegung, ab der aus einem Klick ein Drag wird

export function useReorder(enabled: boolean, onReorder: (from: number, to: number) => void): Reorder {
  const containerEl = useRef<HTMLElement | null>(null);
  const start = useRef<{ index: number; x: number; y: number; active: boolean } | null>(null);
  const didDrag = useRef(false); // unterdrückt den Klick unmittelbar nach einem Drag
  const [drag, setDrag] = useState<{ from: number | null; over: number | null }>({ from: null, over: null });

  const containerRef = useCallback((el: HTMLElement | null) => { containerEl.current = el; }, []);

  const nearest = useCallback((x: number, y: number): number | null => {
    const c = containerEl.current;
    if (!c) return null;
    let best: number | null = null;
    let bestD = Infinity;
    c.querySelectorAll<HTMLElement>('[data-reorder-item]').forEach((el) => {
      const r = el.getBoundingClientRect();
      const dx = r.left + r.width / 2 - x;
      const dy = r.top + r.height / 2 - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = Number(el.getAttribute('data-reorder-item')); }
    });
    return best;
  }, []);

  // Ein einziger, stabiler Handler; der Index kommt aus dem data-Attribut des Elements. So baut itemProps
  // beim Rendern keine neue Closure über Refs (die React-Compiler-Lintregel react-hooks/refs bliebe sonst hängen).
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const index = Number((e.currentTarget as HTMLElement).getAttribute('data-reorder-item'));
    didDrag.current = false;
    start.current = { index, x: e.clientX, y: e.clientY, active: false };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const s = start.current;
    if (!s) return;
    if (!s.active) {
      if (Math.abs(e.clientX - s.x) + Math.abs(e.clientY - s.y) < THRESHOLD) return;
      s.active = true;
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
      setDrag({ from: s.index, over: s.index });
    }
    const over = nearest(e.clientX, e.clientY);
    setDrag((prev) => (prev.over === over ? prev : { from: s.index, over }));
  }, [nearest]);

  const end = useCallback(() => {
    const s = start.current;
    start.current = null;
    if (!s || !s.active) return; // reiner Klick → nichts tun (Auswahl darf durch)
    didDrag.current = true;
    setDrag((prev) => {
      if (prev.from != null && prev.over != null && prev.over !== prev.from) onReorder(prev.from, prev.over);
      return { from: null, over: null };
    });
  }, [onReorder]);

  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (didDrag.current) { e.stopPropagation(); e.preventDefault(); didDrag.current = false; }
  }, []);

  const itemProps = useCallback((index: number): ReorderItemProps => {
    if (!enabled) return { 'data-reorder-item': index };
    return {
      'data-reorder-item': index,
      onPointerDown,
      onPointerMove,
      onPointerUp: end,
      onPointerCancel: end,
      onClickCapture,
      style: { touchAction: 'none' }, // Scroll-Gesten nicht abfangen lassen, damit Drag greift
    };
  }, [enabled, onPointerDown, onPointerMove, end, onClickCapture]);

  return { containerRef, dragIndex: drag.from, overIndex: drag.over, itemProps };
}
