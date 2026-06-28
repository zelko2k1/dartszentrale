// Liest ein Saison-Bundle (von season-export.mjs / In-App-Export) zurück in die DB.
// Legt fehlende Datensätze (nach id) neu an und setzt offloaded=false. Idempotent (Vorhandenes wird übersprungen).
//
// Aufruf:  node season-import.mjs <bundle.json>
import PocketBase from '../app/node_modules/pocketbase/dist/pocketbase.es.mjs';
import { readFileSync } from 'fs';
import { assertSafePassword } from './_security-guard.mjs';

const URL = process.env.PB_URL || 'http://127.0.0.1:8090';
const SU_EMAIL = process.env.PB_SU_EMAIL || 'admin@dartshub.local';
const SU_PASS = process.env.PB_SU_PASS || 'dartshub-admin-2026';
const FILE = process.argv[2];

// Sicherheits-Guard: kein Default-Superuser-Passwort gegen ein nicht-lokales Ziel.
assertSafePassword(URL, 'Superuser-Login', SU_PASS, 'PB_SU_PASS=…');

if (!FILE) { console.error('FEHLER: Bundle-Datei angeben: node season-import.mjs <bundle.json>'); process.exit(1); }

const pb = new PocketBase(URL);
pb.autoCancellation(false);

async function restore(coll, rows) {
  if (!rows || !rows.length) return 0;
  const existing = await pb.collection(coll).getFullList({ requestKey: null });
  const have = new Set(existing.map((r) => r.id));
  let n = 0;
  for (const r of rows) {
    if (!r || !r.id || have.has(r.id)) continue;
    const body = { ...r }; for (const k of ['collectionId', 'collectionName', 'created', 'updated', 'expand']) delete body[k];
    await pb.collection(coll).create(body);
    n++;
  }
  return n;
}

async function main() {
  await pb.collection('_superusers').authWithPassword(SU_EMAIL, SU_PASS);
  const bundle = JSON.parse(readFileSync(FILE, 'utf8'));
  if (bundle.format !== 'dartshub-season-bundle' || !bundle.season?.id) { console.error('FEHLER: Keine gültige Saison-Bundle-Datei.'); process.exit(1); }
  const sid = bundle.season.id;

  // Saison selbst sicherstellen (offloaded=false)
  const seasons = await pb.collection('seasons').getFullList({ requestKey: null });
  if (!seasons.some((s) => s.id === sid)) {
    const b = { ...bundle.season, offloaded: false }; for (const k of ['collectionId', 'collectionName', 'created', 'updated', 'expand']) delete b[k];
    await pb.collection('seasons').create(b);
  } else {
    await pb.collection('seasons').update(sid, { offloaded: false });
  }
  if (bundle.snapshot) await restore('season_snapshots', [bundle.snapshot]);
  const teams = await restore('teams', bundle.teams);
  const leagues = await restore('leagues', bundle.leagues);
  const events = await restore('events', bundle.events);
  const matches = await restore('matches', bundle.matches);
  console.log(`OK „${bundle.season.name}" eingelesen: matches=${matches} leagues=${leagues} teams=${teams} events=${events}, offloaded=false`);
}

main().catch((e) => { console.error('FEHLER:', e?.response?.data ? JSON.stringify(e.response.data, null, 2) : e); process.exit(1); });
