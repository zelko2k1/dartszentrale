// Kompakter, abhängigkeitsfreier QR-Code-Encoder (Byte-Modus, ECC-Level M) → SVG.
// Zweck: otpauth://-URI für die 2FA-Einrichtung als QR anzeigen, ohne schweres npm-Paket
// (Plan docs/plan-2fa.md §7). Unterstützt Versionen 1–10 (bis ~271 Byte bei ECC M) — deckt
// otpauth-URIs (typisch 90–140 Byte) mit Reserve ab. Reed-Solomon über GF(256), 8 Masken,
// automatische Masken-/Versionswahl. Funktional gegen einen QR-Decoder verifiziert.
//
// Basiert auf dem QR-Standard (ISO/IEC 18004). Eigenständige, geprüfte Implementierung.

// ---- GF(256) für Reed-Solomon -------------------------------------------
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d; // Primitivpolynom
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const gfMul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function rsGenerator(degree: number): number[] {
  // Divisor-Polynom (Grad `degree`), Koeffizienten Index 0 = höchster Grad. Nayuki-Algorithmus.
  const result = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1; // α^0
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 0x02); // α^(i+1)
  }
  return result;
}
function rsEncode(data: number[], ecLen: number): number[] {
  const gen = rsGenerator(ecLen);
  const res = new Array(ecLen).fill(0);
  for (const d of data) {
    const factor = d ^ res[0];
    res.shift();
    res.push(0);
    for (let j = 0; j < ecLen; j++) res[j] ^= gfMul(gen[j], factor);
  }
  return res;
}

// ---- Kapazitäts-/Blocktabellen für ECC-Level M, Versionen 1..10 ----------
// [ Datencodewörter gesamt, EC-Codewörter pro Block, Blockanzahl-Gruppe1, dataPerBlockG1, blocksG2, dataPerBlockG2 ]
const VERSIONS_M: Record<number, { totalData: number; ecPerBlock: number; g1: number; d1: number; g2: number; d2: number }> = {
  1: { totalData: 16, ecPerBlock: 10, g1: 1, d1: 16, g2: 0, d2: 0 },
  2: { totalData: 28, ecPerBlock: 16, g1: 1, d1: 28, g2: 0, d2: 0 },
  3: { totalData: 44, ecPerBlock: 26, g1: 1, d1: 44, g2: 0, d2: 0 },
  4: { totalData: 64, ecPerBlock: 18, g1: 2, d1: 32, g2: 0, d2: 0 },
  5: { totalData: 86, ecPerBlock: 24, g1: 2, d1: 43, g2: 0, d2: 0 },
  6: { totalData: 108, ecPerBlock: 16, g1: 4, d1: 27, g2: 0, d2: 0 },
  7: { totalData: 124, ecPerBlock: 18, g1: 4, d1: 31, g2: 0, d2: 0 },
  8: { totalData: 154, ecPerBlock: 22, g1: 2, d1: 38, g2: 2, d2: 39 },
  9: { totalData: 182, ecPerBlock: 22, g1: 3, d1: 36, g2: 2, d2: 37 },
  10: { totalData: 216, ecPerBlock: 26, g1: 4, d1: 43, g2: 1, d2: 44 },
};

function chooseVersion(byteLen: number): number {
  // Byte-Modus: Header = 4 Bit Modus + 8/16 Bit Längenfeld. Länge < 256 → 8 Bit (V1–9), sonst 16 Bit (V10).
  for (let v = 1; v <= 10; v++) {
    const lenBits = v <= 9 ? 8 : 16;
    const capacityBytes = VERSIONS_M[v].totalData - Math.ceil((4 + lenBits) / 8);
    if (byteLen <= capacityBytes) return v;
  }
  throw new Error('Daten zu lang für QR-Version ≤ 10');
}

// ---- Bitstrom → Codewörter ----------------------------------------------
function buildData(bytes: number[], version: number): number[] {
  const info = VERSIONS_M[version];
  const lenBits = version <= 9 ? 8 : 16;
  const bits: number[] = [];
  const push = (val: number, n: number) => { for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  push(0b0100, 4);            // Byte-Modus
  push(bytes.length, lenBits);
  for (const b of bytes) push(b, 8);
  // Terminator (max 4 Bit)
  const cap = info.totalData * 8;
  for (let i = 0; i < 4 && bits.length < cap; i++) bits.push(0);
  // auf Byte-Grenze auffüllen
  while (bits.length % 8 !== 0) bits.push(0);
  // Füll-Bytes
  const pads = [0xec, 0x11];
  let pi = 0;
  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    codewords.push(byte);
  }
  while (codewords.length < info.totalData) codewords.push(pads[pi++ % 2]);

  // In Blöcke aufteilen, EC berechnen, verschachteln
  const blocks: { data: number[]; ec: number[] }[] = [];
  let idx = 0;
  for (let i = 0; i < info.g1; i++) { const d = codewords.slice(idx, idx + info.d1); idx += info.d1; blocks.push({ data: d, ec: rsEncode(d, info.ecPerBlock) }); }
  for (let i = 0; i < info.g2; i++) { const d = codewords.slice(idx, idx + info.d2); idx += info.d2; blocks.push({ data: d, ec: rsEncode(d, info.ecPerBlock) }); }

  const result: number[] = [];
  const maxData = Math.max(info.d1, info.d2);
  for (let i = 0; i < maxData; i++) for (const b of blocks) if (i < b.data.length) result.push(b.data[i]);
  for (let i = 0; i < info.ecPerBlock; i++) for (const b of blocks) result.push(b.ec[i]);
  return result;
}

// ---- Matrix-Aufbau -------------------------------------------------------
type Grid = Int8Array[]; // -1 = frei, 0/1 = Modul
function sizeForVersion(v: number) { return v * 4 + 17; }

function placeFinder(g: Grid, r: number, c: number) {
  for (let dr = -1; dr <= 7; dr++) for (let dc = -1; dc <= 7; dc++) {
    const rr = r + dr, cc = c + dc;
    if (rr < 0 || cc < 0 || rr >= g.length || cc >= g.length) continue;
    const inRing = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6 &&
      (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
    g[rr][cc] = inRing ? 1 : 0;
  }
}

const ALIGN_POS: Record<number, number[]> = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};

function buildMatrix(version: number, codewords: number[]): { grid: Grid; size: number } {
  const size = sizeForVersion(version);
  const grid: Grid = Array.from({ length: size }, () => new Int8Array(size).fill(-1));

  // Finder + Separatoren
  placeFinder(grid, 0, 0); placeFinder(grid, 0, size - 7); placeFinder(grid, size - 7, 0);
  // Timing
  for (let i = 8; i < size - 8; i++) { const b = i % 2 === 0 ? 1 : 0; if (grid[6][i] === -1) grid[6][i] = b; if (grid[i][6] === -1) grid[i][6] = b; }
  // Ausrichtungsmuster
  const ap = ALIGN_POS[version];
  for (const r of ap) for (const c of ap) {
    if ((r <= 8 && c <= 8) || (r <= 8 && c >= size - 9) || (r >= size - 9 && c <= 8)) continue;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      const inRing = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
      grid[r + dr][c + dc] = inRing ? 1 : 0;
    }
  }
  // Versions-Information (nur Versionen ≥ 7): 18 Bit (6 Bit Version + 12 Bit BCH mit G18=0x1f25),
  // in zwei 6×3-Blöcken nahe dem oberen-rechten und unteren-linken Finder. MUSS vor der
  // Datenplatzierung gesetzt werden, damit die Traversierung diese Zellen überspringt.
  if (version >= 7) {
    let d = version << 12;
    const bchDigit = (x: number) => { let n = 0; while (x !== 0) { n++; x >>>= 1; } return n; };
    while (bchDigit(d) - 13 >= 0) d ^= 0x1f25 << (bchDigit(d) - 13);
    const vbits = (version << 12) | d;
    for (let i = 0; i < 18; i++) {
      const bit = (vbits >> i) & 1;
      const r = Math.floor(i / 3), c = (i % 3) + size - 11;
      grid[r][c] = bit;      // Block oben-rechts
      grid[c][r] = bit;      // gespiegelter Block unten-links
    }
  }
  // Dark module
  grid[size - 8][8] = 1;
  // Reservierte Format-/Versionsbereiche als 0 markieren (werden später überschrieben)
  const reserveFormat = (rr: number, cc: number) => { if (grid[rr][cc] === -1) grid[rr][cc] = 0; };
  for (let i = 0; i < 9; i++) { reserveFormat(8, i); reserveFormat(i, 8); }
  for (let i = 0; i < 8; i++) { reserveFormat(8, size - 1 - i); reserveFormat(size - 1 - i, 8); }

  // Datenbits platzieren (Zick-Zack in Spaltenpaaren von rechts). Richtung pro Paar aus der
  // Spalte berechnet (nicht getoggelt), damit der Timing-Spalten-Skip nicht desynct (Nayuki-Schema).
  const dataBits: number[] = [];
  for (const cw of codewords) for (let i = 7; i >= 0; i--) dataBits.push((cw >> i) & 1);
  let bitIdx = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // Timing-Spalte 6 überspringen
    const upward = ((right + 1) & 2) === 0;
    for (let vert = 0; vert < size; vert++) {
      const row = upward ? size - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const cc = right - j;
        if (grid[row][cc] !== -1) continue; // Funktionsmodule überspringen
        grid[row][cc] = bitIdx < dataBits.length ? dataBits[bitIdx] : 0;
        bitIdx++;
      }
    }
  }
  return { grid, size };
}

// ---- Masken + Format-Info ------------------------------------------------
const MASKS = [
  (r: number, c: number) => (r + c) % 2 === 0,
  (r: number, _c: number) => r % 2 === 0,
  (_r: number, c: number) => c % 3 === 0,
  (r: number, c: number) => (r + c) % 3 === 0,
  (r: number, c: number) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r: number, c: number) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r: number, c: number) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r: number, c: number) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function isFunction(size: number, version: number, r: number, c: number): boolean {
  if ((r < 9 && c < 9) || (r < 9 && c >= size - 8) || (r >= size - 8 && c < 9)) return true; // Finder+Format
  if (r === 6 || c === 6) return true; // Timing
  if (version >= 7) { // Versions-Info (zwei 6×3-Blöcke) darf nicht maskiert werden
    if (r < 6 && c >= size - 11 && c < size - 8) return true;
    if (c < 6 && r >= size - 11 && r < size - 8) return true;
  }
  const ap = ALIGN_POS[version];
  for (const ar of ap) for (const ac of ap) {
    if ((ar <= 8 && ac <= 8) || (ar <= 8 && ac >= size - 9) || (ar >= size - 9 && ac <= 8)) continue;
    if (Math.abs(r - ar) <= 2 && Math.abs(c - ac) <= 2) return true;
  }
  return false;
}

function formatValue(maskIdx: number): number {
  // ECC-Level M = 0b00; 5 Bit Daten = 00 (M) << 3 | maskIdx. BCH(15,5) + Standard-XOR-Maske.
  const data = (0b00 << 3) | maskIdx;
  let v = data << 10;
  const g = 0b10100110111;
  for (let i = 14; i >= 10; i--) if ((v >> i) & 1) v ^= g << (i - 10);
  return (((data << 10) | v) ^ 0b101010000010010) & 0x7fff; // 15-Bit-Integer, Bit 0 = LSB
}

function applyMaskAndFormat(base: Grid, size: number, version: number, maskIdx: number): Grid {
  const g: Grid = base.map((row) => Int8Array.from(row));
  const mask = MASKS[maskIdx];
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    if (!isFunction(size, version, r, c) && mask(r, c)) g[r][c] ^= 1;
  }
  // Format-Info schreiben (MSB-first: k=0 → Bit 14). Gegen node-qrcode verifiziert.
  const fv = formatValue(maskIdx);
  const fbit = (k: number) => (fv >> (14 - k)) & 1;
  // Kopie 1 — um oberes-linkes Finder (Spalte/Zeile 6 = Timing wird übersprungen)
  for (let k = 0; k <= 5; k++) g[8][k] = fbit(k);
  g[8][7] = fbit(6); g[8][8] = fbit(7); g[7][8] = fbit(8);
  for (let k = 9; k <= 14; k++) g[14 - k][8] = fbit(k); // Zeilen 5..0
  // Kopie 2 — 7 Bit vertikal (unten-links) + 8 Bit horizontal (oben-rechts); Dark-Module dazwischen.
  for (let k = 0; k <= 6; k++) g[size - 1 - k][8] = fbit(k);
  for (let k = 7; k <= 14; k++) g[8][size - 8 + (k - 7)] = fbit(k);
  g[size - 8][8] = 1; // Dark module (immer dunkel)
  return g;
}

function penalty(g: Grid, size: number): number {
  let p = 0;
  // Regel 1: Läufe ≥5 gleicher Module
  for (let r = 0; r < size; r++) {
    let run = 1;
    for (let c = 1; c < size; c++) { if (g[r][c] === g[r][c - 1]) { run++; } else { if (run >= 5) p += 3 + (run - 5); run = 1; } }
    if (run >= 5) p += 3 + (run - 5);
  }
  for (let c = 0; c < size; c++) {
    let run = 1;
    for (let r = 1; r < size; r++) { if (g[r][c] === g[r - 1][c]) { run++; } else { if (run >= 5) p += 3 + (run - 5); run = 1; } }
    if (run >= 5) p += 3 + (run - 5);
  }
  // Regel 2: 2x2-Blöcke
  for (let r = 0; r < size - 1; r++) for (let c = 0; c < size - 1; c++) {
    const v = g[r][c]; if (v === g[r][c + 1] && v === g[r + 1][c] && v === g[r + 1][c + 1]) p += 3;
  }
  return p;
}

/** Erzeugt aus Text eine QR-Boolean-Matrix (true = dunkel). */
export function qrMatrix(text: string): boolean[][] {
  const bytes: number[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x80) bytes.push(cp);
    else if (cp < 0x800) bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
  }
  const version = chooseVersion(bytes.length);
  const codewords = buildData(bytes, version);
  const { grid, size } = buildMatrix(version, codewords);

  let best: Grid | null = null;
  let bestScore = Infinity;
  for (let m = 0; m < 8; m++) {
    const g = applyMaskAndFormat(grid, size, version, m);
    const score = penalty(g, size);
    if (score < bestScore) { bestScore = score; best = g; }
  }
  return best!.map((row) => Array.from(row, (v) => v === 1));
}

/** Rendert Text als QR-SVG-String (dunkle Module auf hellem Grund). */
export function qrSvg(text: string, opts: { moduleSize?: number; margin?: number; dark?: string; light?: string } = {}): string {
  const { moduleSize = 4, margin = 4, dark = '#000000', light = '#ffffff' } = opts;
  const m = qrMatrix(text);
  const n = m.length;
  const dim = (n + margin * 2) * moduleSize;
  let rects = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (m[r][c]) {
    rects += `<rect x="${(c + margin) * moduleSize}" y="${(r + margin) * moduleSize}" width="${moduleSize}" height="${moduleSize}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges" role="img" aria-label="QR-Code">` +
    `<rect width="${dim}" height="${dim}" fill="${light}"/><g fill="${dark}">${rects}</g></svg>`;
}
