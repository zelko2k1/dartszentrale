// Exportiert eine Saison als JSON-Bundle (Wegsicherung / Re-Import-Grundlage / Grafana-Feed).
// Aufruf:  SEASON_NAME="2025/26" node season-export.mjs        (oder SEASON_ID=...)
// Cloud:   PB_URL=https://db.deinverein.de PB_SU_EMAIL=… PB_SU_PASS=… SEASON_NAME="2025/26" node season-export.mjs
import PocketBase from '../app/node_modules/pocketbase/dist/pocketbase.es.mjs';
import { writeFileSync } from 'fs';

const URL = process.env.PB_URL || 'http://127.0.0.1:8090';
const SU_EMAIL = process.env.PB_SU_EMAIL || 'admin@dartshub.local';
const SU_PASS = process.env.PB_SU_PASS || 'dartshub-admin-2026';
const SEASON_ID = process.env.SEASON_ID || '';
const SEASON_NAME = process.env.SEASON_NAME || '';

const pb = new PocketBase(URL);
pb.autoCancellation(false);

export async function findSeason(pb) {
  const seasons = await pb.collection('seasons').getFullList({ requestKey: null });
  const season = SEASON_ID ? seasons.find((s) => s.id === SEASON_ID) : seasons.find((s) => s.name === SEASON_NAME);
  if (!season) { console.error(`FEHLER: Saison nicht gefunden (${SEASON_ID || SEASON_NAME || '— SEASON_ID/SEASON_NAME setzen'}).`); process.exit(1); }
  return season;
}

async function main() {
  await pb.collection('_superusers').authWithPassword(SU_EMAIL, SU_PASS);
  const season = await findSeason(pb);
  const by = (coll) => pb.collection(coll).getFullList({ filter: `seasonId="${season.id}"`, requestKey: null });
  const [leagues, teams, events, matches, snaps] = await Promise.all([by('leagues'), by('teams'), by('events'), by('matches'), by('season_snapshots')]);
  const strip = (r) => { const o = { ...r }; for (const k of ['collectionId', 'collectionName', 'created', 'updated', 'expand']) delete o[k]; return o; };
  const bundle = {
    format: 'dartshub-season-bundle', version: 1, exportedAt: new Date().toISOString(),
    season: strip(season), snapshot: snaps[0] ? strip(snaps[0]) : null,
    leagues: leagues.map(strip), teams: teams.map(strip), events: events.map(strip), matches: matches.map(strip),
  };
  const safe = season.name.replace(/[^\dA-Za-z]+/g, '-');
  const file = `dartshub-saison-${safe}-${new Date().toISOString().slice(0, 10)}.json`;
  writeFileSync(file, JSON.stringify(bundle, null, 2));
  console.log(`OK Bundle geschrieben: ${file}`);
  console.log(`   leagues=${leagues.length} teams=${teams.length} events=${events.length} matches=${matches.length} snapshot=${snaps[0] ? 'ja' : 'nein'}`);
}

main().catch((e) => { console.error('FEHLER:', e?.response?.data ? JSON.stringify(e.response.data, null, 2) : e); process.exit(1); });
