// ═══════ [ INTERNER HELFER ] — wird importiert, nicht direkt ausgeführt ═══════
// Gemeinsamer Sicherheits-Guard für die Provisioning-/Seed-Skripte.
//
// Zweck: verhindern, dass bekannte Default-Passwörter aus diesem Repo gegen ein
// NICHT-lokales (= produktives/erreichbares) Ziel verwendet werden. Lokale
// Entwicklung (localhost / 127.0.0.1 / ::1) bleibt unverändert bequem – dort sind
// die Defaults weiterhin erlaubt.
//
// Hintergrund: Ein Konto wie chef@dartszentrale.local / dartszentrale123 (Rolle admin) wäre
// gegen eine im Internet erreichbare PocketBase ein offenes Scheunentor.

export const WEAK_DEFAULTS = new Set([
  'dartszentrale123',
  'dartszentrale-admin-2026',
  'board-dartszentrale-2026',
]);

/** true, wenn das Ziel offensichtlich lokal ist (dann sind Defaults ok). */
export function isLocalTarget(pbUrl) {
  try {
    const h = new URL(pbUrl).hostname;
    return h === '127.0.0.1' || h === 'localhost' || h === '::1';
  } catch {
    return false;
  }
}

/**
 * Bricht das Skript ab, wenn gegen ein nicht-lokales Ziel ein bekanntes
 * Default-Passwort verwendet/angelegt werden soll.
 * @param {string} pbUrl   Ziel-URL (PB_URL)
 * @param {string} label   was betroffen ist, z. B. "App-Admin"
 * @param {string} pw      das zu prüfende Passwort
 * @param {string} [envHint] Env-Variable für den Override, z. B. "APP_ADMIN_PASS=…"
 */
export function assertSafePassword(pbUrl, label, pw, envHint) {
  if (isLocalTarget(pbUrl)) return; // lokal: Defaults erlaubt
  if (WEAK_DEFAULTS.has(pw)) {
    console.error(`\n✗ ABBRUCH – Sicherheits-Guard:`);
    console.error(`  '${label}' würde ein bekanntes Default-Passwort gegen ein nicht-lokales Ziel verwenden:`);
    console.error(`    ${pbUrl}`);
    console.error(`  Setze ein starkes Passwort per Env${envHint ? ` (${envHint})` : ''} und starte erneut.`);
    console.error(`  (Defaults sind nur gegen localhost/127.0.0.1 erlaubt.)\n`);
    process.exit(1);
  }
}
