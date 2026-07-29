#!/usr/bin/env node
// Statische Prüfung der Barrierefreiheits-Zusagen, die sonst still zurückfallen.
// Kein Ersatz für einen echten Screenreader-Durchlauf — aber es hält genau die Regeln fest,
// die in dieser Codebasis schon einmal weggerutscht sind.
//
//   node scripts/validate-a11y.mjs [--quiet]
//
// Geprüft:
//   1. Jeder <Modal> hat einen zugänglichen Namen (label= ODER ein <ModalTitle> im selben Baum)
//   2. Jedes Eingabefeld hat einen Namen (aria-label, aria-labelledby oder id= für ein <label for>)
//   3. Jedes <img> hat alt
//   4. Klickbare <div>/<span> haben eine Rolle — Ausnahme: ganzflächige Overlays (inset:0),
//      bei denen der Klick nur eine Zugabe zu Esc/Schließen-Knopf ist
//   5. Die Spielbildschirme haben eine Live-Region (LiveAnnouncer)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const QUIET = process.argv.includes('--quiet');

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (e.endsWith('.tsx')) out.push(p);
  }
  return out;
}
const files = walk(SRC).filter((f) => !f.endsWith('.test.tsx'));
const problems = [];
const add = (file, line, msg) => problems.push(`${relative(ROOT, file)}:${line}  ${msg}`);
const lineOf = (src, idx) => src.slice(0, idx).split('\n').length;

// Ein JSX-Tag ab `<name` bis zum passenden schließenden > (Klammern in {…} beachten).
function tagAt(src, start) {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return src.slice(start, i + 1);
  }
  return src.slice(start, start + 400);
}
function eachTag(src, name, fn) {
  const re = new RegExp(`<${name}(?=[\\s/>])`, 'g');
  let m;
  while ((m = re.exec(src))) fn(tagAt(src, m.index), m.index);
}

// Kommentare durch gleich lange Leerzeichen ersetzen: Zeilennummern und Offsets bleiben gültig,
// aber ein im Fließtext erwähntes `<img>` wird nicht als Markup gelesen.
const stripComments = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));

for (const file of files) {
  const src = stripComments(readFileSync(file, 'utf8'));
  const isModalDef = file.endsWith('components/Modal.tsx');

  // 1. Dialoge
  if (!isModalDef) {
    eachTag(src, 'Modal', (tag, at) => {
      if (/\blabel=/.test(tag)) return;
      if (src.includes('<ModalTitle')) return;
      add(file, lineOf(src, at), '<Modal> ohne zugänglichen Namen (weder label= noch <ModalTitle>)');
    });
  }

  // 2. Eingabefelder. <label><input …/> Text</label> benennt implizit — das zählt.
  const wrappedInLabel = (at) => {
    const before = src.slice(Math.max(0, at - 600), at);
    const open = before.lastIndexOf('<label');
    return open !== -1 && !before.slice(open).includes('</label>');
  };
  for (const el of ['input', 'select', 'textarea']) {
    eachTag(src, el, (tag, at) => {
      if (/\btype="(hidden|file)"/.test(tag)) return;
      if (/aria-label|aria-labelledby|\bid=/.test(tag)) return;
      if (wrappedInLabel(at)) return;
      add(file, lineOf(src, at), `<${el}> ohne zugänglichen Namen`);
    });
  }

  // 3. Bilder
  eachTag(src, 'img', (tag, at) => {
    if (!/\balt=/.test(tag)) add(file, lineOf(src, at), '<img> ohne alt');
  });

  // 4. Klickbare Nicht-Bedienelemente OHNE jeden Tastaturweg.
  //
  // Achtung, zwei Regeln ziehen hier gegeneinander: eine Karte, die selbst `role="button"` trägt
  // UND Knöpfe enthält, ist verschachtelte Bedienung (axe: nested-interactive). Richtig ist
  // deshalb die Karte OHNE Rolle — Maus klickt die Fläche, Tastatur und Screenreader nehmen den
  // echten Button darin (Titel als PressableRow). Genau dieses Muster darf hier nicht anschlagen.
  //
  // Der Textscanner kann keinen Teilbaum auswerten; er schaut in ein begrenztes Fenster nach
  // einem echten Bedienelement. Die Wahrheit über den GERENDERTEN Baum liefert axe (npm run e2e) —
  // diese Regel ist nur der billige, schnelle Vorfilter.
  for (const el of ['div', 'span', 'li']) {
    eachTag(src, el, (tag, at) => {
      if (!/\bonClick=/.test(tag)) return;
      if (/\brole=/.test(tag)) return;
      // Ganzflächiges Overlay: Klick ist Zugabe, nicht der einzige Weg
      if (/inset:\s*0/.test(tag)) return;
      // Reine Ereignis-Bremse (stopPropagation) ist kein Bedienelement
      if (/onClick=\{\(e\)\s*=>\s*e\.stopPropagation\(\)\}/.test(tag)) return;
      // Enthält der Block ein echtes Bedienelement, trägt dieses den Tastaturweg.
      if (/<button|<PressableRow|<PrimaryButton|<SecondaryButton/.test(src.slice(at, at + 2500))) return;
      add(file, lineOf(src, at), `klickbares <${el}> ohne role und ohne Bedienelement darin — Tastatur erreicht es nicht`);
    });
  }
}

// 5b. Farbe als Schrift auf einer TÖNUNG IHRER SELBST.
//
// Dreimal ist genau dieses Muster durch alle Prüfungen gerutscht und erst axe im Browser
// aufgefallen: aktive Navigation, Rollen-Badges, Board-Badges. Der Paletten-Prüfer rechnet
// Token gegen Token — eine `color-mix()`-Tönung derselben Farbe kommt darin nicht vor, und
// beim Akzent steht der Wert ohnehin erst zur Laufzeit fest.
//
// Für den Akzent gibt es --accent-ink (App.tsx, accentText): gleicher Farbton, aber auf 4,5:1
// nachgeführt. Wer den rohen Akzent auf eine Akzentfläche schreibt, meint fast immer den.
for (const file of walk(SRC).filter((f) => !f.endsWith('.test.tsx'))) {
  const src = stripComments(readFileSync(file, 'utf8'));
  const rel = relative(ROOT, file);
  for (const m of src.matchAll(/style=\{\{[^}]*\}\}/g)) {
    const blk = m[0];
    if (!/color:\s*'var\(--accent\)'/.test(blk)) continue;
    if (!/color-mix\([^)]*var\(--accent\)\s*\d+%/.test(blk)) continue;
    const line = src.slice(0, m.index).split('\n').length;
    problems.push(`${rel}:${line}  --accent als Schrift auf einer Akzent-Tönung — --accent-ink verwenden`);
  }
}

// 5. Live-Region auf den Spielbildschirmen
for (const screen of ['screens/Counter.tsx', 'screens/TrainingGame.tsx']) {
  const p = join(SRC, screen);
  if (!readFileSync(p, 'utf8').includes('<LiveAnnouncer')) {
    problems.push(`${screen}  keine Live-Region — Spielstandsänderungen werden nicht angesagt`);
  }
}

if (problems.length) {
  console.log(`\n✗ ${problems.length} Befund(e):`);
  for (const p of problems) console.log(`   ${p}`);
  process.exit(1);
}
if (!QUIET) console.log('Barrierefreiheits-Prüfung bestanden.');
