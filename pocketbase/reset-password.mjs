// Setzt das Passwort eines App-Kontos (Collection "users") per Superuser-Recht zurück.
// Rettungsanker, falls sich der (einzige) App-Admin ausgesperrt hat — der Superuser ist davon unabhängig.
// Reaktiviert das Konto zugleich (active=true), damit ein deaktiviertes Admin-Konto nicht aussperrt.
//
// Aufruf (lokal, setzt chef@dartshub.local zurück):
//   USER_EMAIL=chef@dartshub.local NEW_PW="neues-pw-min-8" node reset-password.mjs
// Cloud:
//   PB_URL=https://db.deinverein.de PB_SU_EMAIL=… PB_SU_PASS=… USER_EMAIL=admin@deinverein.de NEW_PW=… node reset-password.mjs
//
// Falls auch das Superuser-Passwort weg ist, vorher per CLI neu setzen:
//   ./pocketbase superuser upsert <su-email> "<neues-su-pw>" --dir ./pb_data
import PocketBase from '../app/node_modules/pocketbase/dist/pocketbase.es.mjs';

const URL = process.env.PB_URL || 'http://127.0.0.1:8090';
const SU_EMAIL = process.env.PB_SU_EMAIL || 'admin@dartshub.local';
const SU_PASS = process.env.PB_SU_PASS || 'dartshub-admin-2026';
const USER_EMAIL = process.env.USER_EMAIL || 'chef@dartshub.local';
const NEW_PW = process.env.NEW_PW || 'dartshub123'; // BITTE überschreiben!

if (!NEW_PW || NEW_PW.length < 8) {
  console.error('FEHLER: NEW_PW muss mindestens 8 Zeichen haben.');
  process.exit(1);
}

const pb = new PocketBase(URL);
pb.autoCancellation(false);

async function main() {
  await pb.collection('_superusers').authWithPassword(SU_EMAIL, SU_PASS);
  console.log('OK Superuser angemeldet');

  let user;
  try {
    user = await pb.collection('users').getFirstListItem(`email="${USER_EMAIL}"`, { requestKey: null });
  } catch {
    console.error(`FEHLER: Kein Konto mit E-Mail ${USER_EMAIL} gefunden.`);
    process.exit(1);
  }

  await pb.collection('users').update(user.id, { password: NEW_PW, passwordConfirm: NEW_PW, active: true });
  console.log(`OK Passwort gesetzt + Konto aktiviert: ${USER_EMAIL} (Rolle: ${user.role})`);

  // Gegenprobe: Login mit dem neuen Passwort
  const test = new PocketBase(URL);
  const auth = await test.collection('users').authWithPassword(USER_EMAIL, NEW_PW);
  console.log(`OK Login getestet – Rolle: ${auth.record.role}, aktiv: ${auth.record.active}`);
  console.log(`\nApp-Login:  ${USER_EMAIL} / ${NEW_PW}`);
  if (NEW_PW === 'dartshub123') console.log('HINWEIS: Standard-Passwort — bitte direkt in der App ändern!');
}

main().catch((e) => { console.error('FEHLER:', e?.response?.data ? JSON.stringify(e.response.data, null, 2) : e); process.exit(1); });
