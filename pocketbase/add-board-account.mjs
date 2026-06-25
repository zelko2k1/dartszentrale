// Legt ein dediziertes, rechtearmes Board-Konto an (Rolle "board") für die Kiosk-Rechner.
// Damit melden sich die ~8 Board-PCs an – getrennt von echten Spieler-/Admin-Konten.
// Rolle board = darf nur Matches anlegen + lesen, nichts verwalten (siehe API-Rules + pb_hooks).
//
// Aufruf (lokal):  node add-board-account.mjs
// Cloud:           PB_URL=https://db.deinverein.de PB_SU_EMAIL=… PB_SU_PASS=… BOARD_EMAIL=board@deinverein.de BOARD_PW=… node add-board-account.mjs
import PocketBase from '../app/node_modules/pocketbase/dist/pocketbase.es.mjs';

const URL = process.env.PB_URL || 'http://127.0.0.1:8090';
const SU_EMAIL = process.env.PB_SU_EMAIL || 'admin@dartshub.local';
const SU_PASS = process.env.PB_SU_PASS || 'dartshub-admin-2026';
const BOARD_EMAIL = process.env.BOARD_EMAIL || 'board@dartshub.local';
const BOARD_PW = process.env.BOARD_PW || 'board-dartshub-2026'; // BITTE in der Cloud ändern!

const pb = new PocketBase(URL);
pb.autoCancellation(false);

async function main() {
  await pb.collection('_superusers').authWithPassword(SU_EMAIL, SU_PASS);
  console.log('OK Superuser angemeldet');

  let existing = null;
  try { existing = await pb.collection('users').getFirstListItem(`email="${BOARD_EMAIL}"`, { requestKey: null }); } catch { /* none */ }

  const body = {
    email: BOARD_EMAIL, role: 'board', active: true, verified: true, emailVisibility: true,
    name: 'Board-Rechner', first: 'Board', last: 'Rechner', position: 'Board-Rechner', playerId: null,
    isBoard: true,
  };

  if (existing) {
    await pb.collection('users').update(existing.id, { ...body, password: BOARD_PW, passwordConfirm: BOARD_PW });
    console.log('OK Board-Konto aktualisiert (Passwort neu gesetzt):', BOARD_EMAIL);
  } else {
    await pb.collection('users').create({ ...body, password: BOARD_PW, passwordConfirm: BOARD_PW });
    console.log('OK Board-Konto angelegt:', BOARD_EMAIL);
  }

  // Gegenprobe: Login als Board-Konto
  const test = new PocketBase(URL);
  const auth = await test.collection('users').authWithPassword(BOARD_EMAIL, BOARD_PW);
  console.log(`OK Login getestet – Rolle: ${auth.record.role}, aktiv: ${auth.record.active}`);
  console.log(`\nBoard-Login:  ${BOARD_EMAIL} / ${BOARD_PW}`);
  if (BOARD_PW === 'board-dartshub-2026') console.log('HINWEIS: In der Cloud unbedingt ein eigenes BOARD_PW setzen!');
}

main().catch((e) => { console.error('FEHLER:', e?.response?.data ? JSON.stringify(e.response.data, null, 2) : e); process.exit(1); });
