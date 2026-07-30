#!/usr/bin/env node
// Hält die Typo-Rollen-Leiter die einzige Quelle für Schriftgrößen.
//
// Die Leiter gab es schon einmal — benutzt haben sie 25 von 950 Stellen. Der Rest setzte rohe
// Pixelwerte, bis 23 verschiedene Größen im Umlauf waren (inklusive 9px und Bruchgrößen wie
// 11.5px). Eine Leiter, an die sich niemand halten muss, ist keine.
//
//   node scripts/validate-type.mjs [--quiet]
//
// Geprüft:
//   1. Keine rohen `fontSize: <Zahl>` in Komponenten — Rollen-Token oder eine bewusst
//      mitskalierende Angabe (clamp(), Berechnung) sind erlaubt.
//   2. Jedes benutzte --fs-* existiert wirklich in tokens.css (fängt Tippfehler und
//      umbenannte Token ab, bevor sie als "Größe fehlt" im UI landen).
//   3. Kein fontWeight, den keine der geladenen Schriften mitbringt.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const QUIET = process.argv.includes('--quiet');

// Schwerster Schnitt, den @fontsource für die wählbaren Familien hergibt. Oswald und
// Space Grotesk enden bei 700; 800 fällt dort regulär auf den geladenen 700er zurück.
// Alles über 800 gäbe es in KEINER Familie → der Browser müsste Fett rechnen.
const MAX_WEIGHT = 800;

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (e.endsWith('.tsx')) out.push(p);
  }
  return out;
}
const stripComments = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));

const tokensCss = readFileSync(join(SRC, 'styles/tokens.css'), 'utf8');
const defined = new Set([...tokensCss.matchAll(/(--fs-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));

const problems = [];
for (const file of walk(SRC).filter((f) => !f.endsWith('.test.tsx'))) {
  const src = stripComments(readFileSync(file, 'utf8'));
  const at = (i) => src.slice(0, i).split('\n').length;
  const rel = relative(ROOT, file);

  for (const m of src.matchAll(/fontSize: (\d+(?:\.\d+)?)[,}\s]/g)) {
    problems.push(`${rel}:${at(m.index)}  rohe Schriftgröße ${m[1]}px — Rolle aus der Leiter nehmen (--fs-…)`);
  }
  for (const m of src.matchAll(/var\((--fs-[a-z0-9-]+)\)/g)) {
    if (!defined.has(m[1])) problems.push(`${rel}:${at(m.index)}  ${m[1]} gibt es in tokens.css nicht`);
  }
  for (const m of src.matchAll(/fontWeight: (\d+)/g)) {
    if (+m[1] > MAX_WEIGHT) {
      problems.push(`${rel}:${at(m.index)}  fontWeight ${m[1]} — keine Schrift bringt ihn mit, der Browser rechnet Fett`);
    }
  }
}

if (problems.length) {
  console.log(`\n✗ ${problems.length} Typografie-Befund(e):`);
  for (const p of problems) console.log(`   ${p}`);
  process.exit(1);
}
if (!QUIET) console.log(`Typo-Leiter geschlossen — ${defined.size} Rollen, keine rohen Größen.`);
