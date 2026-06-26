// Lagert eine ARCHIVIERTE Saison aus: löscht ihre Spiele (matches) aus der DB und setzt offloaded=true.
// Gibt Plattenplatz frei; Tabellen/Kader/Termine bleiben, Einzelstatistik kommt danach aus dem Snapshot.
// WICHTIG: Vorher unbedingt `node season-export.mjs` ausführen (Wegsicherung)! Per Bundle wieder einlesbar.
//
// Aufruf:  SEASON_NAME="2024/25" node season-offload.mjs        (oder SEASON_ID=...)
import PocketBase from '../app/node_modules/pocketbase/dist/pocketbase.es.mjs';

const URL = process.env.PB_URL || 'http://127.0.0.1:8090';
const SU_EMAIL = process.env.PB_SU_EMAIL || 'admin@dartshub.local';
const SU_PASS = process.env.PB_SU_PASS || 'dartshub-admin-2026';
const SEASON_ID = process.env.SEASON_ID || '';
const SEASON_NAME = process.env.SEASON_NAME || '';

const pb = new PocketBase(URL);
pb.autoCancellation(false);

async function main() {
  await pb.collection('_superusers').authWithPassword(SU_EMAIL, SU_PASS);
  const seasons = await pb.collection('seasons').getFullList({ requestKey: null });
  const season = SEASON_ID ? seasons.find((s) => s.id === SEASON_ID) : seasons.find((s) => s.name === SEASON_NAME);
  if (!season) { console.error(`FEHLER: Saison nicht gefunden (${SEASON_ID || SEASON_NAME}).`); process.exit(1); }
  if (season.status !== 'archived') { console.error(`FEHLER: „${season.name}" ist nicht archiviert (status=${season.status}). Erst abschließen.`); process.exit(1); }

  const matches = await pb.collection('matches').getFullList({ filter: `seasonId="${season.id}"`, requestKey: null });
  console.log(`Lagere „${season.name}" aus: ${matches.length} Spiele werden entfernt …`);
  for (const m of matches) await pb.collection('matches').delete(m.id);
  await pb.collection('seasons').update(season.id, { offloaded: true });
  console.log(`OK ausgelagert: ${matches.length} Spiele gelöscht, offloaded=true gesetzt.`);
  console.log('   Wiederherstellung: node season-import.mjs <bundle.json>');
}

main().catch((e) => { console.error('FEHLER:', e?.response?.data ? JSON.stringify(e.response.data, null, 2) : e); process.exit(1); });
