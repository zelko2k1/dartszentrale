// Merge von nuLiga-Begegnungen in EINE bestehende Liga (das gerichtete Gegenstück zum CSV-Import).
// nuLiga liefert dieselbe Datenform wie der Spielplan-CSV; hier kommt die Herkunfts-/Vorrang-Logik dazu:
//   • Eigenes Heimspiel  → Counter/manuell ist autoritativ. Weicht nuLiga ab → KONFLIKT (lokal behalten,
//                          am Fixture vermerken); nie automatisch überschreiben.
//   • Eigenes Auswärtsspiel + jede fremde Begegnung → nuLiga gewinnt (Quelle → 'nuliga').
//   • Offene nuLiga-Begegnung (kein Ergebnis) → nur ANLEGEN falls fehlt; vorhandenes Ergebnis nie löschen.
// Die Tabelle rechnet die App weiter selbst (computeStandings) — mit vollständigen Begegnungen ist sie
// deckungsgleich mit nuLigas offizieller Tabelle (verifiziert, siehe spikes/nuliga/README.md).
// Plan: docs/plan-nuliga-import.md (Revision 2026-07-12).

import type { League, LeagueTeam, Fixture } from '../data/types';
import { uid } from './format';

// ── Rohform aus dem Hook (POST /api/nuliga/fetch) ──
export interface NuligaRow {
  date: string;        // YYYY-MM-DD
  time: string;        // HH:MM ('' = unbekannt)
  loc: string;         // Hallenname ('' = unbekannt)
  round?: string;      // Pokal-Runde (leer bei Ligen)
  home: string;
  away: string;
  hs: number | null;   // gewonnene Spiele Heim (null = offen)
  as: number | null;
  played: boolean;
}
export interface NuligaResponse {
  championship: string;
  group: string;
  sourceUrl: string;
  fetchedAt: string;
  count: number;
  fixtures: NuligaRow[];
}

export interface NuligaConflict {
  fixtureId: string;
  date: string;
  homeName: string;
  awayName: string;
  local: { hs: number; as: number; source: 'counter' | 'manual' };
  nuliga: { hs: number; as: number };
}
export interface NuligaCounts {
  fixturesNew: number;   // neu angelegte Begegnungen (mit oder ohne Ergebnis)
  resultsSet: number;    // Ergebnisse aus nuLiga übernommen (neu oder geändert)
  teamsNew: number;      // neue Mannschaften in der Liga-Tabelle
  metaFilled: number;    // Zeit/Ort an bestehenden Begegnungen nachgetragen
  conflicts: number;     // eigene Heimspiele mit Abweichung (nicht überschrieben)
  unchanged: number;     // gespielte nuLiga-Begegnungen ohne Änderung
}
export interface NuligaMergeResult {
  league: League;        // aktualisierte Liga (Kopie)
  changed: boolean;
  counts: NuligaCounts;
  conflicts: NuligaConflict[];
}

const norm = (s: string) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
const clean = (s: string) => (s || '').replace(/\s+/g, ' ').trim();

/**
 * Merged die nuLiga-Zeilen in die Liga mit `leagueId`. Reine Funktion: gibt eine aktualisierte
 * League-Kopie + Konfliktliste + Zähler zurück (der Store übernimmt Persistenz/State).
 */
export function mergeNuliga(leagues: League[], leagueId: string, rows: NuligaRow[], nowIso: string): NuligaMergeResult {
  const src = leagues.find((l) => l.id === leagueId);
  const counts: NuligaCounts = { fixturesNew: 0, resultsSet: 0, teamsNew: 0, metaFilled: 0, conflicts: 0, unchanged: 0 };
  const conflicts: NuligaConflict[] = [];
  if (!src) return { league: src as unknown as League, changed: false, counts, conflicts };

  const league: League = {
    ...src,
    teams: src.teams.map((t) => ({ ...t })),
    fixtures: src.fixtures.map((f) => ({ ...f })),
  };
  let changed = false;

  const teamByName = new Map<string, LeagueTeam>();
  league.teams.forEach((t) => teamByName.set(norm(t.name), t));
  const getTeam = (name: string): LeagueTeam => {
    const n = norm(name);
    let t = teamByName.get(n);
    if (t) return t;
    t = { id: uid(), name: clean(name), own: false };
    league.teams.push(t);
    teamByName.set(n, t);
    counts.teamsNew++;
    changed = true;
    return t;
  };

  const fixtureByKey = new Map<string, Fixture>();
  league.fixtures.forEach((f) => fixtureByKey.set(`${f.date}|${f.homeId}|${f.awayId}`, f));

  for (const r of rows) {
    if (!r.home || !r.away || !r.date) continue;
    const home = getTeam(r.home);
    const away = getTeam(r.away);
    if (home.id === away.id) continue;

    const key = `${r.date}|${home.id}|${away.id}`;
    let fx = fixtureByKey.get(key);

    // Begegnung ggf. anlegen (offen oder mit Ergebnis).
    if (!fx) {
      fx = {
        id: uid(), homeId: home.id, awayId: away.id, date: r.date,
        time: r.time || undefined, loc: r.loc || undefined,
        round: r.round || undefined,
        played: false, hs: '', as: '',
      };
      league.fixtures.push(fx);
      fixtureByKey.set(key, fx);
      counts.fixturesNew++;
      changed = true;
    } else {
      // Zeit/Ort/Runde aus nuLiga nachtragen, falls an der Begegnung noch nicht gesetzt.
      if (r.time && !fx.time) { fx.time = r.time; counts.metaFilled++; changed = true; }
      if (r.loc && !fx.loc) { fx.loc = r.loc; counts.metaFilled++; changed = true; }
      if (r.round && fx.round !== r.round) { fx.round = r.round; changed = true; }
    }

    // Offene nuLiga-Begegnung: kein Ergebnis anfassen (nie löschen).
    if (!r.played || r.hs == null || r.as == null) continue;

    const nHs = r.hs, nAs = r.as;
    const ownHome = home.own;
    const authoritative = fx.resultSource === 'counter' || fx.resultSource === 'manual';
    const localHs = typeof fx.hs === 'number' ? fx.hs : null;
    const localAs = typeof fx.as === 'number' ? fx.as : null;
    const sameAsLocal = fx.played && localHs === nHs && localAs === nAs;

    // Eigenes Heimspiel mit autoritativem (counter/manual) Ergebnis → Vorrang lokal.
    if (ownHome && authoritative) {
      if (sameAsLocal) {
        if (fx.nuligaConflict) { delete fx.nuligaConflict; changed = true; } // frühere Abweichung aufgelöst
        counts.unchanged++;
      } else {
        // Abweichung → Konflikt vermerken, lokal behalten.
        const conflict: NuligaConflict = {
          fixtureId: fx.id, date: fx.date, homeName: home.name, awayName: away.name,
          local: { hs: localHs ?? 0, as: localAs ?? 0, source: fx.resultSource as 'counter' | 'manual' },
          nuliga: { hs: nHs, as: nAs },
        };
        conflicts.push(conflict);
        fx.nuligaConflict = { hs: nHs, as: nAs, at: nowIso };
        counts.conflicts++;
        changed = true;
      }
      continue;
    }

    // Auswärts / fremd / nicht-autoritatives Heim → nuLiga übernehmen.
    if (sameAsLocal) {
      if (fx.nuligaConflict) { delete fx.nuligaConflict; changed = true; }
      counts.unchanged++;
    } else {
      fx.played = true; fx.hs = nHs; fx.as = nAs; fx.resultSource = 'nuliga';
      if (fx.nuligaConflict) delete fx.nuligaConflict;
      counts.resultsSet++;
      changed = true;
    }
  }

  return { league, changed, counts, conflicts };
}
