#!/usr/bin/env node
// Prüft die Farb-Tokens aus src/styles/tokens.css maschinell — für JEDES Theme
// (dark, light und die vier Skins), damit ein neues Skin nicht still unter die
// Barrierefreiheits-Grenze rutscht.
//
//   node scripts/validate-palette.mjs          → Bericht + Exit-Code
//   node scripts/validate-palette.mjs --quiet   → nur Fehler
//
// Geprüft wird:
//   1. Text-Leiter (--text … --text-5) ≥ 4.5:1 auf JEDER Fläche des Themes  (WCAG 1.4.3 AA)
//   2. Semantik-Farben (--success/--danger/--warn/--info/--gold-text …) ebenso
//   3. Kategoriale Skala (--cat-1…8) ≥ 4.5:1 als Schrift auf jeder Fläche
//   4. Die kategoriale Skala bleibt bei Farbfehlsichtigkeit unterscheidbar
//      (Deuteranopie/Protanopie/Tritanopie, paarweiser OKLab-Abstand)
//   5. Die Text-Leiter läuft monoton — jede Stufe ist blasser als die vorige
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QUIET = process.argv.includes('--quiet');

const AA_TEXT = 4.5;
// Paarweiser OKLab-Abstand, unter dem zwei Kategorien bei Farbfehlsichtigkeit verschmelzen.
// Bei ACHT Kategorien sind nicht alle 28 Paare gleichzeitig sauber trennbar — das ist eine
// bekannte Grenze kategorialer Skalen, keine Nachlässigkeit. Deshalb ist der Kontrast ein
// harter Fehler (WCAG), die CVD-Trennung dagegen ein Hinweis: sie zeigt, welche Paare NICHT
// allein über die Farbe unterschieden werden dürfen (dort zusätzlich Label/Position/Form).
const CVD_MIN_DIST = 0.09;

// ── Farbraum ──────────────────────────────────────────────────────────────────
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const srgbToLin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const linToSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

function parseHex(h) {
  let s = h.replace('#', '').trim();
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  if (s.length === 8) s = s.slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);
}
function oklchToRgb(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ].map((v) => clamp01(linToSrgb(v)));
}
/** Hex, oklch(…) oder rgb(a)(…) → [r,g,b] in 0…1. Gibt null bei Unbekanntem. */
function parseColor(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (s.startsWith('#')) return parseHex(s);
  const ok = s.match(/oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/i);
  if (ok) return oklchToRgb(ok[2] ? parseFloat(ok[1]) / 100 : parseFloat(ok[1]), parseFloat(ok[3]), parseFloat(ok[4]));
  const rgb = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (rgb) return [1, 2, 3].map((i) => parseFloat(rgb[i]) / 255);
  return null;
}
const relLum = (rgb) => { const [r, g, b] = rgb.map(srgbToLin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
function contrast(a, b) {
  const l1 = relLum(a), l2 = relLum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
function toOklab(rgb) {
  const [r, g, b] = rgb.map(srgbToLin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}
// Farbfehlsichtigkeit, lineare Näherung nach Viénot/Brettel — genau genug, um
// „diese beiden Kategorien fallen zusammen" zuverlässig zu erkennen.
const CVD = {
  Deuteranopie: [[0.625, 0.375, 0], [0.7, 0.3, 0], [0, 0.3, 0.7]],
  Protanopie:   [[0.567, 0.433, 0], [0.558, 0.442, 0], [0, 0.242, 0.758]],
  Tritanopie:   [[0.95, 0.05, 0], [0, 0.433, 0.567], [0, 0.475, 0.525]],
};
function simulate(rgb, mat) {
  const lin = rgb.map(srgbToLin);
  return mat.map((row) => clamp01(linToSrgb(clamp01(row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2]))));
}
const dist = (a, b) => Math.hypot(...toOklab(a).map((v, i) => v - toOklab(b)[i]));

// ── tokens.css lesen ──────────────────────────────────────────────────────────
function parseTokens(css) {
  const blocks = {};
  const re = /(:root,\s*\[data-theme="dark"\]|\[data-theme="light"\]|\[data-skin="[a-z0-9]+"\])\s*\{([^}]*)\}/gi;
  let m;
  while ((m = re.exec(css))) {
    const sel = m[1];
    const name = sel.includes(':root') ? 'dark' : sel.includes('light') ? 'light' : sel.match(/data-skin="([a-z0-9]+)"/i)[1];
    const decls = {};
    for (const d of m[2].replace(/\/\*[\s\S]*?\*\//g, '').split(';')) {
      const mm = d.match(/^\s*(--[a-z0-9-]+)\s*:\s*(.+?)\s*$/is);
      if (mm) decls[mm[1]] = mm[2].trim();
    }
    blocks[name] = decls;
  }
  return blocks;
}

const css = readFileSync(join(ROOT, 'src/styles/tokens.css'), 'utf8');
const blocks = parseTokens(css);
const THEMES = [['dark', null], ['light', null], ['theme01', 'dark'], ['theme02', 'dark'], ['theme03', 'light'], ['theme07', 'light']];
const SURFACES = ['--bg', '--surface', '--surface-2', '--surface-3', '--btn', '--sidebar'];
const TEXT_RAMP = ['--text', '--text-2', '--text-3', '--text-4', '--text-5'];
const SEMANTIC = ['--success', '--danger', '--danger-soft', '--warn', '--info', '--gold-text'];
const CATS = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => `--cat-${i}`);

// Ein Token kann auf ein anderes verweisen (var(--gold-text)) → einmal auflösen.
function value(theme, key, seen = new Set()) {
  const raw = theme[key];
  if (!raw || seen.has(key)) return null;
  const ref = raw.match(/^var\(\s*(--[a-z0-9-]+)\s*\)$/i);
  if (ref) { seen.add(key); return value(theme, ref[1], seen); }
  return parseColor(raw);
}

let failures = 0;
const say = (s) => { if (!QUIET) console.log(s); };

for (const [name, base] of THEMES) {
  const theme = { ...(base ? blocks[base] : {}), ...blocks[name] };
  const surfaces = SURFACES.map((s) => ({ s, rgb: value(theme, s) })).filter((x) => x.rgb);
  const problems = [];

  const checkInk = (keys, label, min) => {
    for (const k of keys) {
      const rgb = value(theme, k);
      if (!rgb) continue;
      for (const { s, rgb: bg } of surfaces) {
        const r = contrast(rgb, bg);
        if (r < min) problems.push(`${label}: ${k} auf ${s} = ${r.toFixed(2)}:1 (min ${min})`);
      }
    }
  };
  checkInk(TEXT_RAMP, 'Text', AA_TEXT);
  checkInk(SEMANTIC, 'Semantik', AA_TEXT);
  checkInk(CATS, 'Kategorie', AA_TEXT);

  // Farbe auf einer TÖNUNG IHRER SELBST — Rollen-Badges, aktive Navigation, Hinweisflächen
  // bauen ihren Hintergrund als `color-mix(<dieselbe Farbe> 13 %, transparent)`. Diese Paarung
  // taucht in keiner Token-gegen-Token-Matrix auf; axe hat sie im Browser gefunden, nachdem
  // sie hier zweimal durchgerutscht war (--nav-active-fg und die Rollen-Badges).
  const TINT = 0.13;
  for (const k of [...CATS, ...SEMANTIC]) {
    const fg = value(theme, k);
    if (!fg) continue;
    for (const { s, rgb: base } of surfaces) {
      const tint = fg.map((v, i) => v * TINT + base[i] * (1 - TINT));
      const r = contrast(fg, tint);
      if (r < AA_TEXT) {
        problems.push(`Tönung: ${k} auf ${Math.round(TINT * 100)} % ${k} über ${s} = ${r.toFixed(2)}:1 (min ${AA_TEXT})`);
      }
    }
  }

  // Leiter muss monoton blasser werden
  const lums = TEXT_RAMP.map((k) => ({ k, rgb: value(theme, k) })).filter((x) => x.rgb);
  const canvasLum = relLum(value(theme, '--bg'));
  const towardCanvas = lums.map((x) => Math.abs(relLum(x.rgb) - canvasLum));
  for (let i = 1; i < towardCanvas.length; i++) {
    if (towardCanvas[i] > towardCanvas[i - 1]) {
      problems.push(`Leiter: ${lums[i].k} ist kontrastreicher als ${lums[i - 1].k} — die Stufen sind vertauscht`);
    }
  }

  // Kategorien unter Farbfehlsichtigkeit auseinanderhalten (Hinweis, kein Fehler — s. o.)
  const cvdNotes = [];
  for (const [cvdName, mat] of Object.entries(CVD)) {
    const sim = CATS.map((k) => ({ k, rgb: value(theme, k) })).filter((x) => x.rgb).map((x) => ({ k: x.k, rgb: simulate(x.rgb, mat) }));
    for (let i = 0; i < sim.length; i++) {
      for (let j = i + 1; j < sim.length; j++) {
        const d = dist(sim[i].rgb, sim[j].rgb);
        if (d < CVD_MIN_DIST) cvdNotes.push({ cvdName, a: sim[i].k, b: sim[j].k, d });
      }
    }
  }

  failures += problems.length;
  if (problems.length) {
    console.log(`\n✗ ${name} — ${problems.length} Fehler`);
    for (const p of problems) console.log(`    ${p}`);
  } else {
    say(`✓ ${name}`);
  }
  if (cvdNotes.length && !QUIET) {
    const worst = cvdNotes.sort((x, y) => x.d - y.d).slice(0, 3);
    console.log(`    ⚠ ${cvdNotes.length} Kategoriepaare liegen bei Farbfehlsichtigkeit eng beieinander; engste:`);
    for (const w of worst) console.log(`       ${w.cvdName}: ${w.a}/${w.b} = ${w.d.toFixed(3)}`);
  }
}

if (failures) {
  console.log(`\n${failures} Fehler — Palette nicht in Ordnung.`);
  process.exit(1);
}
console.log('\nAlle Themes bestehen die Kontrastprüfung.');
