// Kleiner, robuster CSV-Parser + Encoding-Decoder für Datei-Importe.
// Bewusst ohne Abhängigkeit — deckt die in Verbands-Exporten üblichen Fälle ab:
// Trennzeichen ; oder , oder Tab, optionale "..."-Quotes, CR/LF, BOM.

/**
 * Dekodiert hochgeladene Bytes zu Text. Verbands-Exporte (z. B. BDV) sind oft
 * Windows-1252/ANSI; UTF-8 würde Umlaute als U+FFFD (�) zerstören. Strategie:
 * erst UTF-8 versuchen — tauchen Ersetzungszeichen auf, auf windows-1252 wechseln.
 *
 * Achtung: U+FFFD im UTF-8-Ergebnis hat zwei Ursachen, die unterschieden werden müssen:
 *  (a) Windows-1252-Bytes als UTF-8 fehlgelesen → der Decoder *erzeugt* � aus ungültigen
 *      Bytes; Umschalten auf 1252 repariert die Umlaute.
 *  (b) Die Bytes *sind* bereits echtes UTF-8-U+FFFD (ef bf bd) → die Info war schon vor
 *      dem Speichern verloren (z. B. fehlerhafter Verbands-Export). Hier macht Umschalten
 *      es nur schlimmer: jedes � würde als 1252 zu „ï¿½" (ef→ï, bf→¿, bd→½).
 * Daher nur dann auf 1252 wechseln, wenn mindestens ein � NICHT durch bereits im Puffer
 * vorhandene ef-bf-bd-Bytes erklärbar ist (also Fall a vorliegt).
 */
export function decodeBytes(buf: ArrayBuffer): string {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buf);
  const total = (utf8.match(/�/g) || []).length;
  if (total === 0) return utf8;

  // Zähle bereits als echtes UTF-8 kodierte U+FFFD (Byte-Sequenz ef bf bd).
  const bytes = new Uint8Array(buf);
  let embedded = 0;
  for (let i = 0; i + 2 < bytes.length; i++) {
    if (bytes[i] === 0xef && bytes[i + 1] === 0xbf && bytes[i + 2] === 0xbd) {
      embedded++;
      i += 2;
    }
  }
  // Alle � stammen aus echten ef-bf-bd-Bytes (Fall b) → nicht verschlimmbessern.
  if (embedded >= total) return utf8;

  try {
    return new TextDecoder('windows-1252').decode(buf);
  } catch {
    return utf8;
  }
}

/** Anzahl unlesbarer Ersetzungszeichen (U+FFFD) im fertig dekodierten Text. */
export function countReplacementChars(text: string): number {
  return (text.match(/�/g) || []).length;
}

/** Ermittelt das wahrscheinlichste Trennzeichen aus der Kopfzeile. */
export function detectDelimiter(headerLine: string): string {
  const candidates = [';', '\t', ',', '|'];
  let best = ';';
  let bestCount = -1;
  for (const d of candidates) {
    const count = headerLine.split(d).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return best;
}

/**
 * Parst CSV-Text zu einem Zeilen-/Spalten-Array. Unterstützt "..."-Quotes
 * (inkl. verdoppelter "" im Feld) und beliebige Trennzeichen.
 */
export function parseCsv(text: string, delimiter?: string): string[][] {
  // BOM entfernen
  let src = text.replace(/^﻿/, '');
  // Erste nicht-leere Zeile für die Trennzeichen-Erkennung
  const firstLine = src.split(/\r?\n/).find((l) => l.trim().length > 0) || '';
  const delim = delimiter || detectDelimiter(firstLine);

  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { pushField(); rows.push(row); row = []; };

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') { inQuotes = true; continue; }
    if (c === delim) { pushField(); continue; }
    if (c === '\r') continue;
    if (c === '\n') { pushRow(); continue; }
    field += c;
  }
  // letzte Zeile (ohne abschließendes \n)
  if (field.length > 0 || row.length > 0) pushRow();

  // komplett leere Zeilen verwerfen
  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}
