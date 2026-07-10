// Wandelt einen BDV-"ScheduleReportFOP"-Spielplan (PDF) in die generische
// Import-CSV der App um (Liga;Saison;Datum;Heim;Gast;HeimLegs;GastLegs).
//
// Diese PDF-Reports enthalten – anders als der Vereinsspielplan-CSV – ALLE
// Begegnungen einer Staffel (auch fremde) → vollständige Ligatabelle möglich.
//
// Voraussetzung: pdftotext (xpdf/poppler) im PATH. Bei Git für Windows liegt es
// unter <Git>/mingw64/bin/pdftotext.
//
// Aufruf:  node tools/pdf2schedule.mjs "<datei.pdf>" [ausgabe.csv]
//          node tools/pdf2schedule.mjs "<ordner>"   gesammelt.csv   (alle PDFs)

import { execFileSync } from 'node:child_process';
import { writeFileSync, readdirSync, statSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const WD = /^(Mo|Di|Mi|Do|Fr|Sa|So)\.?$/;
const DATE = /^\d{2}\.\d{2}\.\d{4}$/;
const VENUE = /^\d{8}$/;
const RESULT = /^\d{1,2}:\d{1,2}$/;
const hasLetter = (s) => /[A-Za-zÄÖÜäöüß]/.test(s);

function pdfToText(pdf) {
  const dir = mkdtempSync(join(tmpdir(), 'pdf2sched-'));
  const out = join(dir, 'out.txt');
  try {
    execFileSync('pdftotext', ['-table', '-enc', 'UTF-8', pdf, out], { stdio: ['ignore', 'ignore', 'pipe'] });
    return readFileSync(out, 'utf8');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function parseReport(text) {
  const lines = text.split(/\r?\n/);

  // Saison + Staffel aus dem Kopf (z. B. "<Verband> 2025/26" → "5. Bezirksliga D")
  let season = '';
  let league = '';
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/(\d{4}\/\d{2})/);
    if (m) {
      season = m[1];
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const t = lines[j].trim();
        if (t && !/Tabelle|Spielplan|Rang/i.test(t)) { league = t; break; }
      }
      break;
    }
  }

  const fixtures = [];
  let lastDate = '';
  for (const line of lines) {
    const dm = line.match(/\b(\d{2}\.\d{2}\.\d{4})\b/);
    if (dm) lastDate = dm[1];

    const tok = line.trim().split(/\s{2,}/).filter(Boolean);
    const vi = tok.findIndex((t) => VENUE.test(t) || VENUE.test(t.split(' ')[0]));
    if (vi < 0) continue;
    // Nach der Hallennummer kann ein Status-Flag stehen (z. B. "v" = verlegt),
    // das pdftotext als eigenes Token abtrennt → überspringen.
    let hi = vi + 1;
    if (tok[hi] && /^[a-z]$/.test(tok[hi])) hi++;
    const home = tok[hi];
    const away = tok[hi + 1];
    if (!home || !away || !hasLetter(home) || !hasLetter(away)) continue;
    if (DATE.test(home) || WD.test(home)) continue;

    const res = tok[hi + 2] || '';
    let hs = '', as = '';
    if (RESULT.test(res)) { [hs, as] = res.split(':'); }

    fixtures.push({ date: lastDate, home, away, hs, as });
  }

  return { season, league, fixtures };
}

function toCsv(reports) {
  const rows = ['Liga;Saison;Datum;Heim;Gast;HeimLegs;GastLegs'];
  for (const r of reports) {
    for (const f of r.fixtures) {
      rows.push([r.league, r.season, f.date, f.home, f.away, f.hs, f.as].join(';'));
    }
  }
  return '﻿' + rows.join('\r\n');
}

// ── CLI ──
const input = process.argv[2];
const output = process.argv[3];
if (!input) {
  console.error('Aufruf: node tools/pdf2schedule.mjs "<datei.pdf|ordner>" [ausgabe.csv]');
  process.exit(1);
}

const pdfs = statSync(input).isDirectory()
  ? readdirSync(input).filter((f) => f.toLowerCase().endsWith('.pdf')).map((f) => join(input, f))
  : [input];

const reports = pdfs.map((p) => {
  const r = parseReport(pdfToText(p));
  const played = r.fixtures.filter((f) => f.hs !== '').length;
  console.error(`✓ ${r.league || '(?)'} · Saison ${r.season || '?'} — ${r.fixtures.length} Begegnungen, ${played} mit Ergebnis  [${p.split(/[\\/]/).pop()}]`);
  return r;
});

const csv = toCsv(reports);
if (output) { writeFileSync(output, csv); console.error(`\n→ geschrieben: ${output}`); }
else { process.stdout.write(csv); }
