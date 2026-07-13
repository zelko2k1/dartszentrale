// Importiert Verbands-Spielpläne (CSV) in das Liga-/Begegnungs-Modell.
// Erkennt das BDV-Exportformat (Spalten wie HeimMannschaftName, ToreHeim …)
// und ein generisches Format (Liga;Saison;Datum;Heim;Gast;HeimLegs;GastLegs).
// Gruppiert nach Staffel → eine Liga je Staffel; ermittelt die eigenen
// Mannschaften über die häufigste Vereinsnummer (Export ist vereinsgefiltert).

import type { League, LeagueTeam, Fixture, Team, EventItem, TeamKind, Season } from '../data/types';
import { uid } from './format';
import { parseCsv } from './csv';

// ── geparste Zwischenform ──
export interface ParsedFixture {
  date: string;        // YYYY-MM-DD ('' = unbekannt)
  time: string;        // HH:MM ('' = unbekannt)
  loc: string;         // Spielort ('' = unbekannt)
  homeName: string;
  awayName: string;
  homeOwn: boolean;
  awayOwn: boolean;
  played: boolean;
  hs: number;
  as: number;
}
export interface ImportGroup {
  name: string;        // Liganame (= Staffel)
  season: string;
  kind: TeamKind;      // 'cup' bei Pokal-/K.-o.-Wettbewerben (keine Tabellenwertung), sonst 'league'
  fixtures: ParsedFixture[];
}
export interface ParsedSchedule {
  groups: ImportGroup[];
  ownClubName: string | null;
  total: number;       // gültige Begegnungen
  skipped: number;     // übersprungen (spielfrei, unvollständig)
  warnings: string[];
}

export interface ImportCounts {
  leaguesNew: number;
  leaguesExisting: number;
  teamsNew: number;       // Mannschaften in den Liga-Tabellen
  ownTeamsNew: number;    // eigene Vereins-Mannschaften (Mannschaften-Screen)
  fixturesNew: number;
  resultsSet: number;
  eventsNew: number;      // neue Kalender-Termine (eigene Begegnungen)
  skipped: number;
}
export interface MergeResult {
  leagues: League[];
  touched: { id: string; isNew: boolean }[];
  counts: ImportCounts;
}

// ── Helfer ──
const normHeader = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const norm = (s: string) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
const clean = (s: string) => (s || '').replace(/\s+/g, ' ').trim();

// Kanonischer Saison-Schlüssel für den Abgleich: extrahiert „JJJJ/JJ" aus Namen wie „2025/26",
// „2025/2026" oder „Saison 2025/26" → alle ergeben „2025/26". So trifft ein Re-Import dieselbe Saison
// auch bei abweichender Schreibweise, statt versehentlich eine zweite Saison anzulegen (und dabei die
// bisherige samt ihrer manuellen Kalender-Termine zu archivieren). Ohne Jahresmuster → normaler Name.
export function seasonKey(name: string): string {
  const m = (name || '').match(/(\d{4})\s*[/-]\s*(\d{2,4})/);
  if (m) { const b = m[2].length >= 4 ? m[2].slice(-2) : m[2].padStart(2, '0'); return `${m[1]}/${b}`; }
  return norm(name);
}

function colIndex(headers: string[], aliases: string[]): number {
  const normed = headers.map(normHeader);
  for (const a of aliases) {
    const i = normed.indexOf(a);
    if (i >= 0) return i;
  }
  return -1;
}

function parseDate(raw: string): string {
  const s = (raw || '').trim();
  if (!s) return '';
  const head = s.split(/[ T]/)[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(head)) return head;
  const m = head.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (m) {
    const d = m[1].padStart(2, '0');
    const mo = m[2].padStart(2, '0');
    let y = m[3];
    if (y.length === 2) y = '20' + y;
    return `${y}-${mo}-${d}`;
  }
  return '';
}

function parseTime(raw: string): string {
  const m = (raw || '').match(/(\d{1,2}):(\d{2})/);
  if (!m) return '';
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

function parseScore(raw: string): number | null {
  const t = (raw || '').trim();
  if (t === '') return null;
  const n = parseInt(t, 10);
  return isNaN(n) ? null : n;
}

const BYE = new Set(['spielfrei', 'freilos', 'frei']);

// Mannschaftsnummer → römische Ziffer (1 → I, 2 → II …).
function toRoman(n: number): string {
  if (!(n >= 1) || n > 3999) return '';
  const map: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = ''; let r = Math.floor(n);
  for (const [v, sym] of map) while (r >= v) { out += sym; r -= v; }
  return out;
}
// Anzeigename einer Mannschaft. Hängt die römische Mannschaftsnr NUR ab der 2. Mannschaft an, und nur
// wenn der Mannschaftsname die Mannschaft noch nicht unterscheidet (BDV-Export: MannschaftName ==
// VereinName bzw. MannschaftName leer). Die 1. Mannschaft bleibt bewusst OHNE Zusatz — so heißt sie auch
// bei nuLiga (z. B. „DSV Nürnberg", nicht „DSV Nürnberg I"). Grund: der Export schreibt den Vereinsnamen
// uneinheitlich (mal „DSV Nürnberg '93 e.V.", mal kurz „DSV Nürnberg"); mit nr>=1 erschiene dieselbe
// 1. Mannschaft mal als „DSV Nürnberg", mal als „DSV Nürnberg I" → gespaltene Tabellenzeilen + Fehl-Match
// beim nuLiga-Abgleich. Selbst gebaute CSVs mit vollem Namen ("… I") bleiben unverändert.
function teamDisplayName(mannschaftName: string, vereinName: string, nrRaw: string): string {
  const mn = clean(mannschaftName); const vn = clean(vereinName);
  const base = mn || vn;
  if (!base) return '';
  const nr = parseInt((nrRaw || '').trim(), 10);
  const undifferentiated = !mn || (!!vn && mn.toLowerCase() === vn.toLowerCase());
  return (!isNaN(nr) && nr >= 2 && undifferentiated) ? `${base} ${toRoman(nr)}` : base;
}

/**
 * Parst CSV-Text eines Spielplans. clubName dient nur als Notbehelf, wenn keine
 * Vereinsnummern vorhanden sind (eigene Mannschaft per Namensabgleich).
 */
export function parseSchedule(text: string, clubName?: string): ParsedSchedule {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('Die Datei enthält keine Datenzeilen.');

  const headers = rows[0];
  const idx = {
    date: colIndex(headers, ['termin', 'datum', 'date', 'spieltermin']),
    season: colIndex(headers, ['saison', 'season']),
    staffel: colIndex(headers, ['staffel']),
    liga: colIndex(headers, ['liga', 'league', 'gruppe']),
    meisterschaft: colIndex(headers, ['meisterschaft']),
    home: colIndex(headers, ['heimmannschaftname', 'heimmannschaft', 'heim', 'home', 'heimteam']),
    away: colIndex(headers, ['gastmannschaftname', 'gastmannschaft', 'gast', 'away', 'gegner', 'gastteam']),
    homeVereinNr: colIndex(headers, ['heimvereinnr', 'heimvereinnummer']),
    awayVereinNr: colIndex(headers, ['gastvereinnr', 'gastvereinnummer']),
    homeVereinName: colIndex(headers, ['heimvereinname']),
    awayVereinName: colIndex(headers, ['gastvereinname']),
    homeMannschaftNr: colIndex(headers, ['heimmannschaftnr', 'heimmannschaftnummer']),
    awayMannschaftNr: colIndex(headers, ['gastmannschaftnr', 'gastmannschaftnummer']),
    hs: colIndex(headers, ['toreheim', 'heimlegs', 'heimtore', 'heimpunkte', 'hs', 'heimscore']),
    as: colIndex(headers, ['toregast', 'gastlegs', 'gasttore', 'gastpunkte', 'as', 'gastscore']),
    time: colIndex(headers, ['uhrzeit', 'zeit', 'time', 'anwurf', 'beginn']),
    loc: colIndex(headers, ['ort', 'spielort', 'location', 'halle', 'spielstaette', 'spielstätte', 'spiellokalname', 'spiellokal']),
  };

  const leagueCol = idx.staffel >= 0 ? idx.staffel : (idx.liga >= 0 ? idx.liga : idx.meisterschaft);
  if (idx.date < 0 || idx.home < 0 || idx.away < 0) {
    throw new Error('Pflichtspalten fehlen (Datum, Heim, Gast). Bitte Vorlage prüfen.');
  }

  const data = rows.slice(1);
  const cell = (r: string[], i: number) => (i >= 0 && i < r.length ? r[i] : '');

  // eigene Vereinsnummer = häufigste über Heim/Gast (Export ist vereinsgefiltert)
  let ownNr: string | null = null;
  let ownClubName: string | null = null;
  if (idx.homeVereinNr >= 0 || idx.awayVereinNr >= 0) {
    const freq = new Map<string, number>();
    for (const r of data) {
      for (const i of [idx.homeVereinNr, idx.awayVereinNr]) {
        const nr = cell(r, i).trim();
        if (nr) freq.set(nr, (freq.get(nr) || 0) + 1);
      }
    }
    let best = -1;
    for (const [nr, c] of freq) if (c > best) { best = c; ownNr = nr; }
    // zugehörigen Vereinsnamen für die Anzeige finden
    for (const r of data) {
      if (ownNr && cell(r, idx.homeVereinNr).trim() === ownNr) { ownClubName = clean(cell(r, idx.homeVereinName)) || ownClubName; break; }
      if (ownNr && cell(r, idx.awayVereinNr).trim() === ownNr) { ownClubName = clean(cell(r, idx.awayVereinName)) || ownClubName; break; }
    }
  }
  const clubN = (clubName || '').trim().toLowerCase();
  const matchesClub = (name: string) => clubN.length >= 3 && norm(name).includes(clubN);

  const groups = new Map<string, ImportGroup>();
  let skipped = 0;
  let total = 0;
  const warnings: string[] = [];

  for (const r of data) {
    const homeName = teamDisplayName(cell(r, idx.home), cell(r, idx.homeVereinName), cell(r, idx.homeMannschaftNr));
    const awayName = teamDisplayName(cell(r, idx.away), cell(r, idx.awayVereinName), cell(r, idx.awayMannschaftNr));
    const date = parseDate(cell(r, idx.date));
    // Uhrzeit: eigene Spalte bevorzugen, sonst aus dem Datums-/Termin-Feld ableiten.
    const time = (idx.time >= 0 ? parseTime(cell(r, idx.time)) : '') || parseTime(cell(r, idx.date));
    const loc = idx.loc >= 0 ? clean(cell(r, idx.loc)) : '';
    // Freilos/spielfrei erkennen — auch an den Rohfeldern (Mannschaft + Verein), unabhängig vom Anzeigenamen.
    const bye = (dn: string, m: string, v: string) => BYE.has(norm(dn)) || BYE.has(norm(m)) || BYE.has(norm(v));
    if (!homeName || !awayName || !date
      || bye(homeName, cell(r, idx.home), cell(r, idx.homeVereinName))
      || bye(awayName, cell(r, idx.away), cell(r, idx.awayVereinName))) {
      skipped++;
      continue;
    }
    const seasonRaw = clean(idx.season >= 0 ? cell(r, idx.season) : '') || '—';
    // Saison-Label normalisieren: BDV/nuLiga filet Pokale unter „Pokal 2025/26" — die eigentliche Saison
    // ist „2025/26". Das Jahr extrahieren, damit Pokal- und Ligawettbewerbe unter DERSELBEN Saison stehen
    // (sonst entstünde eine Phantom-Saison „Pokal 2025/26"). Die Cup-Erkennung nutzt weiter den Rohwert.
    const ym = seasonRaw.match(/\d{4}\s*\/\s*\d{2,4}/);
    const season = ym ? ym[0].replace(/\s+/g, '') : seasonRaw;
    const leagueName = clean(leagueCol >= 0 ? cell(r, leagueCol) : '') || 'Liga';

    const hs = parseScore(cell(r, idx.hs));
    const as = parseScore(cell(r, idx.as));
    const played = hs !== null && as !== null && !(hs === 0 && as === 0);

    const homeOwn = (!!ownNr && cell(r, idx.homeVereinNr).trim() === ownNr) || matchesClub(homeName);
    const awayOwn = (!!ownNr && cell(r, idx.awayVereinNr).trim() === ownNr) || matchesClub(awayName);

    // Pokal/K.-o. erkennen — die CSV unterscheidet Liga/Pokal über die Saison-Spalte („Pokal 2025/26"),
    // zusätzlich über den Staffelnamen („…Pokal"/„Cup"). Der kind fließt in den Gruppierungs-Schlüssel ein,
    // damit eine Liga- und eine Pokal-Staffel mit GLEICHEM Namen NIE verschmelzen (getrennte Wettbewerbe).
    const isCup = /pokal|cup/i.test(seasonRaw) || /pokal|cup/i.test(leagueName);
    const kind: TeamKind = isCup ? 'cup' : 'league';
    const key = `${season}|||${kind}|||${leagueName}`;
    let g = groups.get(key);
    if (!g) {
      g = { name: leagueName, season, kind, fixtures: [] };
      groups.set(key, g);
    }
    g.fixtures.push({ date, time, loc, homeName, awayName, homeOwn, awayOwn, played, hs: hs ?? 0, as: as ?? 0 });
    total++;
  }

  if (total === 0) warnings.push('Keine gültigen Begegnungen erkannt.');

  return {
    groups: [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'de')),
    ownClubName,
    total,
    skipped,
    warnings,
  };
}

/**
 * Fügt geparste Daten idempotent in die bestehenden Ligen ein. Ligen werden über
 * (Name + Saison) erkannt, Mannschaften über den Namen, Begegnungen über
 * (Datum + Heim + Gast). Erneuter Import derselben Datei legt nichts doppelt an,
 * trägt aber neue/aktualisierte Ergebnisse nach.
 */
export function mergeSchedule(existing: League[], parsed: ParsedSchedule): MergeResult {
  const leagues: League[] = existing.map((l) => ({
    ...l,
    teams: l.teams.map((t) => ({ ...t })),
    fixtures: l.fixtures.map((f) => ({ ...f })),
  }));

  const counts: ImportCounts = {
    leaguesNew: 0, leaguesExisting: 0, teamsNew: 0, ownTeamsNew: 0, fixturesNew: 0, resultsSet: 0, eventsNew: 0, skipped: parsed.skipped,
  };
  const newIds = new Set<string>();
  const dirty = new Set<string>();

  for (const group of parsed.groups) {
    // Zuordnung über (Name + Saison + Art): eine Liga und ein Pokal mit gleichem Namen bleiben getrennt.
    const gkind: TeamKind = group.kind === 'cup' ? 'cup' : 'league';
    let league = leagues.find((l) => norm(l.name) === norm(group.name) && norm(l.season) === norm(group.season) && (l.kind === 'cup' ? 'cup' : 'league') === gkind);
    if (!league) {
      // Pokale als kind='cup' anlegen (K.-o. → keine Tabellenwertung). Ligen bleiben ohne kind (= 'league').
      league = { id: uid(), name: group.name, season: group.season, teams: [], fixtures: [], ...(group.kind === 'cup' ? { kind: 'cup' as const } : {}) };
      leagues.push(league);
      counts.leaguesNew++;
      newIds.add(league.id);
      dirty.add(league.id);
    } else {
      counts.leaguesExisting++;
    }

    const teamByName = new Map<string, LeagueTeam>();
    league.teams.forEach((t) => teamByName.set(norm(t.name), t));
    const getTeam = (name: string, own: boolean): LeagueTeam => {
      const n = norm(name);
      let t = teamByName.get(n);
      if (t) {
        if (own && !t.own) { t.own = true; dirty.add(league!.id); }
        return t;
      }
      t = { id: uid(), name: clean(name), own };
      league!.teams.push(t);
      teamByName.set(n, t);
      counts.teamsNew++;
      dirty.add(league!.id);
      return t;
    };

    const fixtureByKey = new Map<string, Fixture>();
    league.fixtures.forEach((f) => fixtureByKey.set(`${f.date}|${f.homeId}|${f.awayId}`, f));

    for (const pf of group.fixtures) {
      const home = getTeam(pf.homeName, pf.homeOwn);
      const away = getTeam(pf.awayName, pf.awayOwn);
      if (home.id === away.id) { counts.skipped++; continue; }

      const key = `${pf.date}|${home.id}|${away.id}`;
      const fx = fixtureByKey.get(key);
      if (fx) {
        if (pf.played && (!fx.played || fx.hs !== pf.hs || fx.as !== pf.as)) {
          fx.played = true; fx.hs = pf.hs; fx.as = pf.as; fx.resultSource = 'csv';
          counts.resultsSet++;
          dirty.add(league.id);
        }
        // Uhrzeit/Ort aus dem Import nachtragen, falls an der Begegnung noch nicht gesetzt.
        if (pf.time && !fx.time) { fx.time = pf.time; dirty.add(league.id); }
        if (pf.loc && !fx.loc) { fx.loc = pf.loc; dirty.add(league.id); }
      } else {
        const rec: Fixture = {
          id: uid(), homeId: home.id, awayId: away.id, date: pf.date,
          time: pf.time || undefined, loc: pf.loc || undefined,
          played: pf.played, hs: pf.played ? pf.hs : '', as: pf.played ? pf.as : '',
          ...(pf.played ? { resultSource: 'csv' as const } : {}),
        };
        league.fixtures.push(rec);
        fixtureByKey.set(key, rec);
        counts.fixturesNew++;
        if (pf.played) counts.resultsSet++;
        dirty.add(league.id);
      }
    }
  }

  const touched = [...dirty].map((id) => ({ id, isNew: newIds.has(id) }));
  return { leagues, touched, counts };
}

/**
 * Leitet aus den (gemergten) Ligen die eigenen Vereins-Mannschaften ab, die im
 * "Mannschaften"-Screen noch fehlen. Nur als "eigen" markierte Liga-Teams werden
 * berücksichtigt (Gegnervereine bleiben außen vor). Kader bleibt leer — Spieler
 * werden später manuell zugeordnet.
 *
 * Wichtig: Die Mannschaft bekommt die ART ihres Wettbewerbs (Pokal-Liga → 'cup', sonst 'league'),
 * und der Abgleich läuft pro (Art + Name) — so entsteht für denselben Namen sowohl eine Liga- als
 * auch eine Pokalmannschaft (z. B. „DSV Nürnberg" spielt in Liga UND Pokal). Ein Spieler darf je einer
 * Liga- und einer Pokalmannschaft angehören.
 */
export function deriveOwnTeams(leagues: League[], existingTeams: Team[]): Team[] {
  const tkind = (k?: TeamKind): TeamKind => (k === 'cup' ? 'cup' : k === 'friendly' ? 'friendly' : 'league');
  const keyOf = (kind: TeamKind | undefined, name: string) => `${tkind(kind)}|${norm(name)}`;
  const have = new Set(existingTeams.map((t) => keyOf(t.kind, t.name)));
  const seen = new Set<string>();
  const out: Team[] = [];
  for (const lg of leagues) {
    const kind: TeamKind = lg.kind === 'cup' ? 'cup' : 'league';
    for (const t of lg.teams) {
      if (!t.own) continue;
      const k = keyOf(kind, t.name);
      if (have.has(k) || seen.has(k)) continue;
      seen.add(k);
      // Saison der Quell-Liga erben, damit die Mannschaft in der richtigen Saison auftaucht.
      out.push({ id: uid(), name: clean(t.name), league: lg.name, memberIds: [], captainId: null, kind, ...(lg.seasonId ? { seasonId: lg.seasonId } : {}) });
    }
  }
  return out;
}

/**
 * Leitet aus den geparsten Begegnungen Kalender-Termine (Typ „ligaspiel") ab —
 * nur für Begegnungen mit Beteiligung einer eigenen Mannschaft, gespielte wie
 * anstehende. Idempotent: ein Termin gilt als vorhanden, wenn schon ein
 * Ligaspiel mit gleichem Datum + Titel existiert (auch innerhalb eines Imports
 * wird nicht doppelt angelegt). Standard-Uhrzeit 19:30, wenn die CSV keine liefert.
 */
export function deriveLeagueEvents(parsed: ParsedSchedule, existingEvents: EventItem[]): EventItem[] {
  const title = (pf: ParsedFixture) => `${pf.homeName} — ${pf.awayName}`;
  const keyOf = (date: string, t: string) => `${date}|||${norm(t)}`;
  const have = new Set(
    existingEvents.filter((e) => e.type === 'ligaspiel').map((e) => keyOf(e.date, e.title)),
  );
  const out: EventItem[] = [];
  for (const g of parsed.groups) {
    for (const pf of g.fixtures) {
      if (!pf.homeOwn && !pf.awayOwn) continue;
      const t = title(pf);
      const k = keyOf(pf.date, t);
      if (have.has(k)) continue;
      have.add(k);
      out.push({
        id: uid(), scope: 'verein', title: t, date: pf.date,
        time: pf.time || '19:30', type: 'ligaspiel',
        loc: pf.homeOwn ? 'Heim' : 'Auswärts',
      });
    }
  }
  return out;
}

// Beschreibt (ohne etwas zu ändern), in welche Saison der Import laufen würde — für die Vorschau/Warnung
// im Import-Dialog. Muss dieselbe Regel wie importSchedule verwenden: Primär-Saison = die CSV-Saison mit
// den meisten Wettbewerben; ohne echte Saison-Spalte („—") bleibt die aktive Saison.
export interface ImportSeasonInfo {
  targetName: string;           // Saison, in die importiert wird
  targetExists: boolean;        // false = würde neu angelegt
  willSwitchActive: boolean;    // true = die AKTUELL aktive Saison wird gewechselt und archiviert
  archivedName: string | null;  // Name der bisher aktiven Saison, die archiviert würde (sonst null)
}
export function describeImportSeason(
  groups: { season: string }[],
  seasons: Pick<Season, 'id' | 'name'>[],
  activeSeasonId: string | null,
): ImportSeasonInfo {
  const real = [...new Set(groups.map((g) => g.season))].filter((n) => n && n !== '—');
  const activeSeason = seasons.find((s) => s.id === activeSeasonId) || null;
  if (real.length === 0) {
    // keine (echte) Saison-Spalte → aktive Saison bleibt maßgeblich, kein Wechsel.
    return { targetName: activeSeason?.name || '—', targetExists: true, willSwitchActive: false, archivedName: null };
  }
  const cnt = new Map<string, number>();
  groups.forEach((g) => cnt.set(norm(g.season), (cnt.get(norm(g.season)) || 0) + 1));
  const primaryName = real.slice().sort((a, b) => (cnt.get(norm(b)) || 0) - (cnt.get(norm(a)) || 0))[0];
  // Toleranter Abgleich (seasonKey): „Saison 2025/2026" trifft „2025/26" → kein ungewollter Saison-Wechsel.
  const existing = seasons.find((s) => seasonKey(s.name) === seasonKey(primaryName)) || null;
  const willSwitch = !!activeSeason && (!existing || existing.id !== activeSeason.id);
  return {
    targetName: existing ? existing.name : primaryName,
    targetExists: !!existing,
    willSwitchActive: willSwitch,
    archivedName: willSwitch ? (activeSeason?.name ?? null) : null,
  };
}

/**
 * CSV-Vorlage (generisches Format) zum Befüllen von Hand — wenn kein nuLiga-/BDV-Export vorliegt und
 * der Verein nuLiga nicht nutzt. Eine Zeile je Begegnung. Trennzeichen „;". Spalten:
 *   • Termin         Datum + optional Uhrzeit (TT.MM.JJJJ [HH:MM]); ohne Uhrzeit → Kalender 19:30.
 *   • Saison         z. B. 2025/26. Zusammen mit Staffel die Gruppierung: je Saison+Staffel eine Liga.
 *   • Staffel        Liganame. Enthält er „Pokal" oder „Cup", wird der Wettbewerb als K.-o. angelegt
 *                    (kind='cup' → keine Tabelle, nur Begegnungen).
 *   • SpiellokalName Spielort (optional).
 *   • Heim-/GastMannschaftName  Anzeigename der Mannschaft. 1. Mannschaft OHNE Zusatz, ab der 2. mit
 *                    „II", „III" … (wie bei nuLiga). Eure Mannschaften erkennt der Import am Vereinsnamen
 *                    aus den Einstellungen — der Name sollte ihn enthalten (z. B. „DC Beispiel II").
 *   • ToreHeim/ToreGast  gewonnene Spiele/Legs. Beide leer = Begegnung noch nicht gespielt (geplant).
 * Die Beispielzeilen zeigen: Heim- & Auswärtsspiel, gespielt & offen, 1. & 2. Mannschaft, Liga & Pokal.
 * „DC Beispiel" durch euren Vereinsnamen (Einstellungen) ersetzen, damit die eigenen Teams erkannt werden.
 */
export function scheduleTemplate(): string {
  return [
    'Termin;Saison;Staffel;SpiellokalName;HeimMannschaftName;GastMannschaftName;ToreHeim;ToreGast',
    '06.09.2025 19:30;2025/26;Bezirksoberliga;Vereinsheim;DC Beispiel;DC Falken;8;4',
    '04.10.2025 19:30;2025/26;Bezirksoberliga;Sportheim Falken;DC Falken;DC Beispiel;;',
    '20.09.2025 19:30;2025/26;Kreisliga;Vereinsheim;DC Beispiel II;SG Adler;6;6',
    '27.09.2025 14:00;2025/26;Vereinspokal;Vereinsheim;DC Beispiel;DC Löwen;;',
  ].join('\r\n');
}
