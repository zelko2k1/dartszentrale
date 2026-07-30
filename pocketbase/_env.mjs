// ═══════ [ INTERNER HELFER ] — wird importiert, nicht direkt ausgeführt ═══════
// Zugangsdaten für die Provisioning-/Seed-/Wartungsskripte.
//
// Dieses Repo ist ÖFFENTLICH. Deshalb steht hier weder ein Passwort noch eine Konto-Adresse
// im Klartext — auch nicht als Vorgabe oder Beispiel. Jedes Skript verlangt beides aus der
// Umgebung und bricht mit einer konkreten Anleitung ab, wenn etwas fehlt.
//
// Bequem bleibt es trotzdem: `pocketbase/.env.local` (gitignored) wird automatisch geladen.
//
//   # pocketbase/.env.local
//   PB_SU_EMAIL=dein-superuser-konto          ← Konto der PocketBase-Konsole /_/
//   PB_SU_PASS=dein-superuser-passwort
//   APP_ADMIN_PASS=dein-admin-passwort
//   MEMBER_PW=passwort-der-demo-mitglieder
//   BOARD_EMAIL=board1@dein-verein.example     ← nur für add-board-account.mjs
//   BOARD_PW=passwort-der-board-konten
//   USER_EMAIL=konto@dein-verein.example       ← nur für reset-password.mjs / reset-2fa.mjs
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Lädt pocketbase/.env.local in process.env, ohne bereits gesetzte Werte zu überschreiben. */
export function loadEnvLocal() {
  const file = join(HERE, '.env.local');
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvLocal();

/**
 * Gemeinsamer Abbruch für fehlende Pflicht-Angaben: nennt die Variable, wofür sie steht und
 * die zwei Wege, sie zu setzen. `hint` schließt mit dem Grund ab, warum es keine Vorgabe gibt.
 */
function demand(name, what, hint) {
  const v = process.env[name];
  if (v && v.trim()) return v;
  console.error(`\n✗ ABBRUCH – ${name} fehlt.\n`);
  console.error(`  Gebraucht wird ${what}.\n`);
  console.error('  Entweder einmalig in pocketbase/.env.local hinterlegen (wird nicht versioniert):');
  console.error(`      echo '${name}=…' >> pocketbase/.env.local\n`);
  console.error('  … oder für einen einzelnen Aufruf mitgeben:');
  console.error(`      ${name}=… node ${process.argv[1]?.split('/').pop() ?? 'skript.mjs'}\n`);
  console.error(`  ${hint}\n`);
  process.exit(1);
}

/**
 * Liest ein Pflicht-Geheimnis aus der Umgebung. Fehlt es, bricht das Skript mit einer
 * Anleitung ab — statt still auf ein im Repo stehendes Passwort zurückzufallen.
 * @param {string} name  Name der Umgebungsvariable, z. B. "PB_SU_PASS"
 * @param {string} what  wofür sie steht, z. B. "das Superuser-Passwort der PocketBase"
 */
export function requireSecret(name, what) {
  return demand(name, what, 'Hinweis: Dieses Repo ist öffentlich — hier stehen bewusst keine Passwörter.');
}

/**
 * Wie requireSecret, aber für Pflicht-Angaben, die kein Geheimnis sind — vor allem Konto-Adressen.
 * Auch die haben bewusst keine Vorgabe im Repo: eine eingebaute Admin-Adresse verrät einem
 * Angreifer den Kontonamen und verleitet dazu, sie unverändert zu übernehmen.
 * @param {string} name  Name der Umgebungsvariable, z. B. "PB_SU_EMAIL"
 * @param {string} what  wofür sie steht, z. B. "die E-Mail des PocketBase-Superusers"
 */
export function requireValue(name, what) {
  return demand(name, what, 'Hinweis: Dieses Repo ist öffentlich — hier stehen bewusst keine Konto-Adressen.');
}
