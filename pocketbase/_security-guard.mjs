// ═══════ [ INTERNER HELFER ] — wird importiert, nicht direkt ausgeführt ═══════
// Gemeinsamer Sicherheits-Guard für die Provisioning-/Seed-Skripte.
//
// Zweck: verhindern, dass bekannte Default-Passwörter aus diesem Repo gegen ein
// NICHT-lokales (= produktives/erreichbares) Ziel verwendet werden. Lokale
// Entwicklung (localhost / 127.0.0.1 / ::1) bleibt unverändert bequem – dort sind
// die Defaults weiterhin erlaubt.
//
// Hintergrund: Ein Admin-Konto mit einem der früheren Repo-Standardpasswörter wäre gegen eine
// im Internet erreichbare PocketBase ein offenes Scheunentor.
//
// Die Sperrliste steht als SHA-256-HASH da, nicht im Klartext: dieses Repo ist öffentlich, und
// eine Sperrliste soll schützen, nicht die gesperrten Passwörter weiterverbreiten. Enthalten
// sind die Altlasten aus der dartshub-/dartszentrale-Ära (bis 2026-07 im Klartext in der
// Historie) sowie ein paar offensichtlich schwache Klassiker.
import { createHash } from 'node:crypto';

const WEAK_HASHES = new Set([
  '37f732d3d1695ecfd8d35320e26c1e06ec9fe68b7f54e0128cdfaf401f6c29f0',
  'e6510d53e34791e12f02137bf4a53bbff41c65a15aa735f2ffc2711546c1427a',
  'bb72415522d0738e9e53599a0d3cf858284966cea0117a5a1c9d2da82e532372',
  '13318ade6a6486f14b7d2c3b37419f13a7652ad9f496b412893e52035924241f',
  '14a36f19a73c383e940596d77ee5f9071517595dab83181f197c91439758d950',
  '7cdad983104eca52f7aae91e4ae99a13f706e1697c518103502b2309f8858e50',
  '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
  '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
  '33c5ebbb01d608c254b3b12413bdb03e46c12797e591770ccf20f5e2819929b2',
  '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
]);

/** true, wenn das Passwort auf der Sperrliste steht. */
export function isWeakDefault(pw) {
  return WEAK_HASHES.has(createHash('sha256').update(String(pw)).digest('hex'));
}

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
  if (isWeakDefault(pw)) {
    console.error(`\n✗ ABBRUCH – Sicherheits-Guard:`);
    console.error(`  '${label}' würde ein bekanntes Default-Passwort gegen ein nicht-lokales Ziel verwenden:`);
    console.error(`    ${pbUrl}`);
    console.error(`  Setze ein starkes Passwort per Env${envHint ? ` (${envHint})` : ''} und starte erneut.`);
    console.error(`  (Defaults sind nur gegen localhost/127.0.0.1 erlaubt.)\n`);
    process.exit(1);
  }
}
