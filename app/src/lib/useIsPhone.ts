import { useEffect, useState } from 'react';

function useViewport() {
  const [vp, setVp] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1024,
    h: typeof window !== 'undefined' ? window.innerHeight : 768,
  }));
  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);
  return vp;
}

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
  const { w, h } = useViewport();
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
