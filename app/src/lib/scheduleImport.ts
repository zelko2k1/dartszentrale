// Importiert Verbands-Spielpläne (CSV) in das Liga-/Begegnungs-Modell.
// Erkennt das BDV-Exportformat (Spalten wie HeimMannschaftName, ToreHeim …)
// und ein generisches Format (Liga;Saison;Datum;Heim;Gast;HeimLegs;GastLegs).
// Gruppiert nach Staffel → eine Liga je Staffel; ermittelt die eigenen
// Mannschaften über die häufigste Vereinsnummer (Export ist vereinsgefiltert).

import type { League, LeagueTeam, Fixture, Team } from '../data/types';
import { uid } from './format';
import { parseCsv } from './csv';

// ── geparste Zwischenform ──
export interface ParsedFixture {
  date: string;        // YYYY-MM-DD ('' = unbekannt)
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

function parseScore(raw: string): number | null {
  const t = (raw || '').trim();
  if (t === '') return null;
  const n = parseInt(t, 10);
  return isNaN(n) ? null : n;
}

const BYE = new Set(['spielfrei', 'freilos', 'frei']);

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
    hs: colIndex(headers, ['toreheim', 'heimlegs', 'heimtore', 'heimpunkte', 'hs', 'heimscore']),
    as: colIndex(headers, ['toregast', 'gastlegs', 'gasttore', 'gastpunkte', 'as', 'gastscore']),
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
    const homeName = clean(cell(r, idx.home));
    const awayName = clean(cell(r, idx.away));
    const date = parseDate(cell(r, idx.date));
    if (!homeName || !awayName || BYE.has(norm(homeName)) || BYE.has(norm(awayName)) || !date) {
      skipped++;
      continue;
    }
    const season = clean(idx.season >= 0 ? cell(r, idx.season) : '') || '—';
    const leagueName = clean(leagueCol >= 0 ? cell(r, leagueCol) : '') || 'Liga';

    const hs = parseScore(cell(r, idx.hs));
    const as = parseScore(cell(r, idx.as));
    const played = hs !== null && as !== null && !(hs === 0 && as === 0);

    const homeOwn = (!!ownNr && cell(r, idx.homeVereinNr).trim() === ownNr) || matchesClub(homeName);
    const awayOwn = (!!ownNr && cell(r, idx.awayVereinNr).trim() === ownNr) || matchesClub(awayName);

    const key = `${season}|||${leagueName}`;
    let g = groups.get(key);
    if (!g) { g = { name: leagueName, season, fixtures: [] }; groups.set(key, g); }
    g.fixtures.push({ date, homeName, awayName, homeOwn, awayOwn, played, hs: hs ?? 0, as: as ?? 0 });
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
    leaguesNew: 0, leaguesExisting: 0, teamsNew: 0, ownTeamsNew: 0, fixturesNew: 0, resultsSet: 0, skipped: parsed.skipped,
  };
  const newIds = new Set<string>();
  const dirty = new Set<string>();

  for (const group of parsed.groups) {
    let league = leagues.find((l) => norm(l.name) === norm(group.name) && norm(l.season) === norm(group.season));
    if (!league) {
      league = { id: uid(), name: group.name, season: group.season, teams: [], fixtures: [] };
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
          fx.played = true; fx.hs = pf.hs; fx.as = pf.as;
          counts.resultsSet++;
          dirty.add(league.id);
        }
      } else {
        const rec: Fixture = {
          id: uid(), homeId: home.id, awayId: away.id, date: pf.date,
          played: pf.played, hs: pf.played ? pf.hs : '', as: pf.played ? pf.as : '',
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
 * werden später manuell zugeordnet. Abgleich über den Namen (kein Duplikat).
 */
export function deriveOwnTeams(leagues: League[], existingTeams: Team[]): Team[] {
  const have = new Set(existingTeams.map((t) => norm(t.name)));
  const seen = new Set<string>();
  const out: Team[] = [];
  for (const lg of leagues) {
    for (const t of lg.teams) {
      if (!t.own) continue;
      const n = norm(t.name);
      if (have.has(n) || seen.has(n)) continue;
      seen.add(n);
      out.push({ id: uid(), name: t.name, league: lg.name, memberIds: [], captainId: null });
    }
  }
  return out;
}

/** CSV-Vorlage (generisches Format) zum Befüllen von Hand. */
export function scheduleTemplate(): string {
  return [
    'Liga;Saison;Datum;Heim;Gast;HeimLegs;GastLegs',
    'Verbandsliga Nord;2025/26;20.09.2025;SV Adler Niederrhein 1;DC Falke Moers;6;3',
    'Verbandsliga Nord;2025/26;27.09.2025;DC Falke Moers;SV Adler Niederrhein 1;;',
  ].join('\r\n');
}
