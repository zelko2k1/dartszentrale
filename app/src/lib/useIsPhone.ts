import { useSyncExternalStore } from 'react';

// EINE Viewport-Quelle für die ganze App.
//
// Vorher hielt jeder Aufrufer seinen eigenen useState + resize/orientationchange-Listener — bei
// 14 Aufrufstellen also bis zu 14 Listener, die bei jedem Resize-Event ungedrosselt setState
// riefen. Am Handy feuert das im Dauerlauf, sobald die Adressleiste ein- oder ausblendet.
//
// Jetzt: ein Listener, per requestAnimationFrame auf einen Frame gedrosselt, mit einem
// zwischengespeicherten Snapshot. useSyncExternalStore verteilt ihn an alle Abonnenten — und
// die Identität wechselt nur, wenn sich die Maße wirklich geändert haben.

interface Viewport { w: number; h: number }

const read = (): Viewport => ({
  w: typeof window !== 'undefined' ? window.innerWidth : 1024,
  h: typeof window !== 'undefined' ? window.innerHeight : 768,
});

let snapshot: Viewport = read();
const listeners = new Set<() => void>();
let frame = 0;

function onResize(): void {
  if (frame) return;                 // für diesen Frame ist schon eine Messung eingeplant
  frame = requestAnimationFrame(() => {
    frame = 0;
    const next = read();
    if (next.w === snapshot.w && next.h === snapshot.h) return;
    snapshot = next;
    listeners.forEach((fn) => fn());
  });
}

function subscribe(fn: () => void): () => void {
  if (listeners.size === 0 && typeof window !== 'undefined') {
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    snapshot = read(); // beim ersten Abonnenten nachziehen (kann sich seit Modul-Load geändert haben)
  }
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      if (frame) { cancelAnimationFrame(frame); frame = 0; }
    }
  };
}

const getSnapshot = (): Viewport => snapshot;

export interface DeviceInfo {
  width: number;
  height: number;
  /** A handset is any device whose shorter side is below the tablet threshold — true for phones in both orientations. */
  isHandset: boolean;
  portrait: boolean;
  isPhonePortrait: boolean;
  isPhoneLandscape: boolean;
}

export function useDevice(threshold = 560): DeviceInfo {
  const { w, h } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const isHandset = Math.min(w, h) < threshold;
  const portrait = h >= w;
  return {
    width: w,
    height: h,
    isHandset,
    portrait,
    isPhonePortrait: isHandset && portrait,
    isPhoneLandscape: isHandset && !portrait,
  };
}

// Narrow portrait viewport → the stacked mobile layouts (grids, minimal counter).
export function useIsPhone(): boolean {
  return useDevice().isPhonePortrait;
}
