// ═══════ [ PRODUKTIV / OPS ] — Rettungswerkzeug für den Produktivbetrieb ═══════
// Entfernt die 2-Faktor-Authentifizierung (TOTP) eines App-Kontos per Superuser-Recht:
// löscht dessen Datensatz in der abgeschotteten Collection "user_mfa" → 2FA ist danach AUS.
// Letzter Notnagel bei „Authenticator-Handy weg UND Backup-Codes weg" — der Nutzer kann sich
// danach wieder nur mit Passwort anmelden und 2FA in den Einstellungen neu einrichten.
//
// Aufruf (lokal, entfernt 2FA von chef@dartszentrale.local):
//   USER_EMAIL=chef@dartszentrale.local node reset-2fa.mjs
// Cloud:
//   PB_URL=https://db.deinverein.de PB_SU_EMAIL=… PB_SU_PASS=… USER_EMAIL=admin@deinverein.de node reset-2fa.mjs
//
// Falls auch das Superuser-Passwort weg ist, vorher per CLI neu setzen:
//   ./pocketbase superuser upsert <su-email> "<neues-su-pw>" --dir ./pb_data
import PocketBase from '../app/node_modules/pocketbase/dist/pocketbase.es.mjs';
import { assertSafePassword } from './_security-guard.mjs';

const URL = process.env.PB_URL || 'http://127.0.0.1:8090';
const SU_EMAIL = process.env.PB_SU_EMAIL || 'admin@dartszentrale.local';
const SU_PASS = process.env.PB_SU_PASS || 'dartszentrale-admin-2026';
const USER_EMAIL = process.env.USER_EMAIL || 'chef@dartszentrale.local';

// Sicherheits-Guard: kein bekanntes Default-Superuser-Passwort gegen ein nicht-lokales Ziel.
assertSafePassword(URL, 'Superuser-Login', SU_PASS, 'PB_SU_PASS=…');

const pb = new PocketBase(URL);
pb.autoCancellation(false);

async function main() {
  await pb.collection('_superusers').authWithPassword(SU_EMAIL, SU_PASS);
  console.log('OK Superuser angemeldet');

  // 1) Konto finden
  let user;
  try {
    user = await pb.collection('users').getFirstListItem(`email="${USER_EMAIL}"`, { requestKey: null });
  } catch {
    console.error(`FEHLER: Kein Konto mit E-Mail ${USER_EMAIL} gefunden.`);
    process.exit(1);
  }

  // 2) 2FA-Datensatz suchen (abgeschottet; nur als Superuser lesbar). 0/1 pro Nutzer (unique-Index).
  let mfa;
  try {
    mfa = await pb.collection('user_mfa').getFirstListItem(`user="${user.id}"`, { requestKey: null });
  } catch {
    console.log(`HINWEIS: Für ${USER_EMAIL} ist keine 2FA hinterlegt — nichts zu tun.`);
    process.exit(0);
  }

  const warStatus = mfa.enabled ? 'aktiv' : (mfa.pending ? 'in Einrichtung' : 'angelegt');

  // 3) Löschen = 2FA aus.
  await pb.collection('user_mfa').delete(mfa.id, { requestKey: null });
  console.log(`OK 2FA entfernt für ${USER_EMAIL} (Rolle: ${user.role}, vorher: ${warStatus}).`);

  // 4) Gegenprobe: Datensatz ist wirklich weg.
  try {
    await pb.collection('user_mfa').getFirstListItem(`user="${user.id}"`, { requestKey: null });
    console.error('WARNUNG: user_mfa-Datensatz ist noch vorhanden — Löschung fehlgeschlagen?');
    process.exit(1);
  } catch {
    console.log('OK Gegenprobe: kein 2FA-Datensatz mehr vorhanden.');
  }

  console.log(`\nDer Nutzer kann sich jetzt wieder nur mit Passwort anmelden und 2FA in den`);
  console.log(`Einstellungen neu einrichten.`);
}

main().catch((e) => { console.error('FEHLER:', e?.response?.data ? JSON.stringify(e.response.data, null, 2) : e); process.exit(1); });
