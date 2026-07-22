// CI-Wächter: schlägt fehl, wenn Tests übersprungen wurden.
//
// Warum: Ein Testlauf meldet "grün", auch wenn Tests gar nicht gelaufen sind — etwa nach einem
// vorübergehenden `it.skip(...)`, das jemand einzubauen vergaß zu entfernen, oder wenn eine ganze
// Datei aus Umgebungsgründen nicht lädt. Dann sichert die Suite still weniger ab, als sie vorgibt.
// Dieser Wächter liest den JSON-Bericht von vitest und bricht ab, sobald etwas übersprungen wurde.
//
// Absichtlich ausgeklammert: nichts. Wenn ein Test dauerhaft nicht laufen soll, gehört er gelöscht —
// ein übersprungener Test ist eine Notiz, kein Sicherheitsnetz.
import { readFileSync } from 'node:fs';

const REPORT = new URL('../vitest-report.json', import.meta.url);

let report;
try {
  report = JSON.parse(readFileSync(REPORT, 'utf8'));
} catch (e) {
  console.error(`Testbericht nicht lesbar (${REPORT.pathname}): ${e.message}`);
  process.exit(1);
}

const skipped = (report.numPendingTests ?? 0) + (report.numTodoTests ?? 0);
if (skipped === 0) {
  console.log(`OK — ${report.numPassedTests ?? 0} Tests gelaufen, keiner übersprungen.`);
  process.exit(0);
}

// Namen der übersprungenen Tests ausgeben, damit sofort klar ist, wo nachzusehen ist.
// (vitest schreibt je nach Fall 'skipped', 'pending' oder 'todo' — alle drei zählen.)
const SKIPPED = new Set(['skipped', 'pending', 'todo']);
const names = [];
for (const file of report.testResults ?? []) {
  for (const t of file.assertionResults ?? []) {
    if (SKIPPED.has(t.status)) names.push(`${file.name ?? '?'} → ${t.fullName ?? t.title}`);
  }
}

console.error(`FEHLER: ${skipped} Test(s) wurden übersprungen — der grüne Haken wäre irreführend.`);
for (const n of names) console.error(`  · ${n}`);
console.error('Entweder den Test wieder scharf schalten oder ihn löschen.');
process.exit(1);
