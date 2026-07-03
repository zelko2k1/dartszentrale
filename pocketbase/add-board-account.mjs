// ═══════ [ PRODUKTIV / OPS ] — für den Produktivbetrieb gedacht ═══════
// Legt ein dediziertes, rechtearmes Board-Konto an (Rolle "board") für die Kiosk-Rechner.
// Damit melden sich die ~8 Board-PCs an – getrennt von echten Spieler-/Admin-Konten.
// Rolle board = darf nur Matches anlegen + lesen, nichts verwalten (siehe API-Rules + pb_hooks).
//
// WICHTIG: Jeder Board-PC braucht seine EIGENE Board-Nummer (BOARD_NUMBER) UND eigene E-Mail.
// Die Nummer verknüpft das Board mit der Aufstellung (Kapitän weist Positionen einer Board-Nr. zu) →
// ohne gültige Nummer (>=1) erscheint weder die Board-Leiste noch das „Nächstes Spiel"-Overlay.
//
// Aufruf (lokal):  BOARD_NUMBER=1 node add-board-account.mjs
// Mehrere Boards:  BOARD_NUMBER=2 BOARD_EMAIL=board2@… node add-board-account.mjs   (usw.)
// Cloud:           PB_URL=https://db.deinverein.de PB_SU_EMAIL=… PB_SU_PASS=… BOARD_EMAIL=board1@deinverein.de BOARD_PW=… BOARD_NUMBER=1 node add-board-account.mjs
import PocketBase from '../app/node_modules/pocketbase/dist/pocketbase.es.mjs';
import { assertSafePassword } from './_security-guard.mjs';

const URL = process.env.PB_URL || 'http://127.0.0.1:8090';
const SU_EMAIL = process.env.PB_SU_EMAIL || 'admin@dartszentrale.local';
const SU_PASS = process.env.PB_SU_PASS || 'dartszentrale-admin-2026';
const BOARD_EMAIL = process.env.BOARD_EMAIL || 'board@dartszentrale.local';
const BOARD_PW = process.env.BOARD_PW || 'board-dartszentrale-2026'; // BITTE in der Cloud ändern!
const BOARD_NUMBER = parseInt(process.env.BOARD_NUMBER || '1', 10);   // Board-Kennnummer (>=1); Default 1

// Board-Nummer validieren: eine positive Ganzzahl ist Pflicht (0/leer → kein Bezug zur Aufstellung).
if (!Number.isInteger(BOARD_NUMBER) || BOARD_NUMBER < 1) {
  console.error(`\n✗ ABBRUCH – ungültige BOARD_NUMBER: "${process.env.BOARD_NUMBER}".`);
  console.error('  Erwartet: eine positive Ganzzahl (z. B. BOARD_NUMBER=1). Jeder Board-PC braucht seine eigene Nummer.\n');
  process.exit(1);
}

// Sicherheits-Guard: keine bekannten Default-Passwörter gegen ein nicht-lokales Ziel.
assertSafePassword(URL, 'Superuser-Login', SU_PASS, 'PB_SU_PASS=…');
assertSafePassword(URL, 'Board-Konto', BOARD_PW, 'BOARD_PW=…');

const pb = new PocketBase(URL);
pb.autoCancellation(false);

async function main() {
  await pb.collection('_superusers').authWithPassword(SU_EMAIL, SU_PASS);
  console.log('OK Superuser angemeldet');

  let existing = null;
  try { existing = await pb.collection('users').getFirstListItem(`email="${BOARD_EMAIL}"`, { requestKey: null }); } catch { /* none */ }

  const body = {
    email: BOARD_EMAIL, role: 'board', active: true, verified: true, emailVisibility: true,
    name: `Board ${BOARD_NUMBER}`, first: 'Board', last: String(BOARD_NUMBER), position: `Board ${BOARD_NUMBER}`, playerId: null,
    isBoard: true, boardNumber: BOARD_NUMBER,
  };

  if (existing) {
    await pb.collection('users').update(existing.id, { ...body, password: BOARD_PW, passwordConfirm: BOARD_PW });
    console.log(`OK Board-Konto aktualisiert (Passwort neu gesetzt): ${BOARD_EMAIL} → Board ${BOARD_NUMBER}`);
  } else {
    await pb.collection('users').create({ ...body, password: BOARD_PW, passwordConfirm: BOARD_PW });
    console.log(`OK Board-Konto angelegt: ${BOARD_EMAIL} → Board ${BOARD_NUMBER}`);
  }

  // Gegenprobe: Login als Board-Konto
  const test = new PocketBase(URL);
  const auth = await test.collection('users').authWithPassword(BOARD_EMAIL, BOARD_PW);
  console.log(`OK Login getestet – Rolle: ${auth.record.role}, Board-Nr.: ${auth.record.boardNumber}, aktiv: ${auth.record.active}`);
  console.log(`\nBoard-Login:  ${BOARD_EMAIL} / ${BOARD_PW}  (Board ${BOARD_NUMBER})`);
  if (BOARD_PW === 'board-dartszentrale-2026') console.log('HINWEIS: In der Cloud unbedingt ein eigenes BOARD_PW setzen!');
  console.log('HINWEIS: Jeder weitere Board-PC braucht eine eigene BOARD_NUMBER und BOARD_EMAIL.');
}

main().catch((e) => { console.error('FEHLER:', e?.response?.data ? JSON.stringify(e.response.data, null, 2) : e); process.exit(1); });
