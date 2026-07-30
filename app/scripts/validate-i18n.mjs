#!/usr/bin/env node
// Hält die Oberfläche übersetzbar.
//
// Die DE/EN-Parität erzwingt bereits der TypeScript-Typ (`Dict = typeof de`, en muss ihn
// erfüllen). Was er NICHT erwischt: Text, der gar nicht erst im Sprachpaket landet, sondern
// direkt in der Komponente steht. Genau so ist „Remote & Live" als komplett deutsches Feature
// entstanden — der Vertrag war nicht gebrochen, er wurde umgangen.
//
//   node scripts/validate-i18n.mjs [--quiet]
//
// Gesucht wird deutscher Klartext in Komponenten: JSX-Textknoten und längere String-Literale.
//
// Für die sichtbaren bzw. vorgelesenen Attribute (aria-label/title/placeholder/alt) gilt eine
// STRENGERE Regel: dort ist JEDES String-Literal ein Fund, nicht nur ein deutsches. Grund:
// die Deutsch-Heuristik unten ist eine Heuristik. `placeholder="name@verein.de"` und
// `alt="Vereinslogo"` haben weder Umlaut noch Funktionswort — beide standen monatelang
// hartkodiert in Komponenten und erschienen so in der englischen Oberfläche, ohne dass dieser
// Prüfer etwas gemeldet hat. Bei einer Handvoll Attributen ist „alles muss durchs Sprachpaket"
// billiger zu erfüllen als eine Wortliste, die nie vollständig wird.
//
// Sprachneutrale Werte sind über NEUTRAL ausgenommen — als Muster, nicht als Wortliste, damit
// die Ausnahme nicht zur Sammelstelle für Ausreden wird.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const QUIET = process.argv.includes('--quiet');

// Das Sprachpaket selbst ist die Quelle des Textes und natürlich voller Deutsch.
const SKIP = [join('src', 'i18n')];

// Umlaute oder unmissverständlich deutsche Funktionswörter. Bewusst eng gehalten:
// Fachbegriffe wie „Leg", „Set", „Bust", „Double" sind in beiden Sprachen gleich.
const GERMAN = /[äöüßÄÖÜ]|\b(der|die|das|dem|den|und|oder|nicht|kein|keine|wird|wurde|kann|muss|bitte|noch|schon|beim|vom|zum|zur)\b/;

// Sichtbare/vorgelesene Attribute: hier ist jedes Literal ein Fund — außer es ist strukturell
// sprachneutral. Absichtlich Muster statt Wortliste: ein Wort wie „Undo" sieht neutral aus, ist
// aber Oberflächentext und gehört ins Sprachpaket (dort steht es dann in beiden Sprachen gleich).
const VISIBLE_ATTR = /(aria-label|title|placeholder|alt)="([^"]*)"/g;
const NEUTRAL = [
  /^$/,                    // alt="" — bei dekorativen bzw. schon benannten Bildern a11y-korrekt
  /^[^\p{L}]+$/u,          // ohne jeden Buchstaben: "0", "123456", "2025/26", "••••••••"
  /^(https?:)?\/\//,       // URL-Beispiele und URL-Muster
];
const isNeutral = (v) => NEUTRAL.some((re) => re.test(v));

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (e.endsWith('.tsx')) out.push(p);
  }
  return out;
}
// Kommentare neutralisieren, Zeilennummern erhalten.
const stripComments = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));

const files = walk(SRC)
  .filter((f) => !f.endsWith('.test.tsx'))
  .filter((f) => !SKIP.some((s) => f.includes(s)));

const problems = [];
for (const file of files) {
  const src = stripComments(readFileSync(file, 'utf8'));
  const at = (i) => src.slice(0, i).split('\n').length;
  const flag = (i, what, text) => problems.push(
    `${relative(ROOT, file)}:${at(i)}  ${what}: „${text.length > 60 ? text.slice(0, 57) + '…' : text}"`,
  );

  // JSX-Textknoten — Generics wie Record<string, unknown> ausschließen
  for (const m of src.matchAll(/>([^<>{}\n]{4,120})</g)) {
    const t = m.group?.(1) ?? m[1];
    const text = t.trim();
    if (GERMAN.test(text) && !/^[A-Z][a-z]+</.test(text)) flag(m.index, 'JSX-Text', text);
  }
  // Sichtbare bzw. vorgelesene Attribute — streng: jedes Literal, das nicht sprachneutral ist.
  for (const m of src.matchAll(VISIBLE_ATTR)) {
    if (!isNeutral(m[2])) flag(m.index, `Attribut ${m[1]} hartkodiert`, m[2]);
  }
  // Längere String-Literale (kurze sind meist Schlüssel/CSS/IDs)
  for (const m of src.matchAll(/'([^'\n]{8,120})'/g)) {
    if (GERMAN.test(m[1])) flag(m.index, 'String', m[1]);
  }
}

if (problems.length) {
  console.log(`\n✗ ${problems.length} nicht übersetzte Textstelle(n) — gehören ins Sprachpaket (src/i18n):`);
  for (const p of problems) console.log(`   ${p}`);
  console.log('\n   Bei „Attribut … hartkodiert": Schlüssel in de.ts + en.ts anlegen und');
  console.log('   per tr.<bereich>.<schlüssel> einsetzen. Ist der Wert wirklich sprachneutral');
  console.log('   (Zahl, Datum, URL), gehört er als MUSTER in die NEUTRAL-Liste dieses Skripts.');
  process.exit(1);
}
if (!QUIET) console.log('Keine harten Texte in Komponenten — alles läuft über das Sprachpaket.');
