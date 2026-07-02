// displayScale.ts
// Vorschlagswert für die Board-Gesamtgröße (boardScale) anhand der Bildschirm-Eigenschaften.
// Bewusst konservativ und NUR als Startwert per Button gedacht – die Browser-Werte (devicePixelRatio,
// screen.width/height) sind je nach OS-Skalierung unzuverlässig, deshalb nie automatisch/fix setzen.

export function suggestBoardScale(): number {
  const dpr = window.devicePixelRatio || 1;
  const diag = Math.hypot(window.screen.width * dpr, window.screen.height * dpr);

  let base = 100;
  if (diag >= 4500) base = 200;      // 4K 27"+
  else if (diag >= 3500) base = 175; // 2K 27" / 4K 24"
  else if (diag >= 2500) base = 150; // FHD 24"
  else if (diag >= 1800) base = 130; // FHD 21" / HD 24"

  return Math.min(250, base);
}
