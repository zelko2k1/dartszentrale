import type { Page } from '@playwright/test';

// Vereinsmodus gegen die LOKALE PocketBase-Instanz.
//
// ⚠ Diese Prüfungen laufen gegen ECHTE Daten in pocketbase/pb_data. Sie sind deshalb strikt
// LESEND: navigieren, ansehen, scannen — niemals speichern, anlegen oder löschen. Wer hier
// Tests ergänzt, hält sich daran; ein „Speichern"-Klick im falschen Dialog verändert den
// Datenbestand des Vereins.
//
// Zugang: die Instanz wird vom Playwright-webServer mitgestartet (siehe playwright.config.ts).
// Das Konto kommt aus der Umgebung, damit keine Zugangsdaten im Git landen:
//   DZ_E2E_EMAIL / DZ_E2E_PASS  (Vorgabe: der App-Admin der lokalen Demo-Einrichtung)

export const VEREIN_LOGIN = {
  email: process.env.DZ_E2E_EMAIL ?? 'admin2@dartszentrale.local',
  pass: process.env.DZ_E2E_PASS ?? 'dartszentrale123',
};

/** Setzt das Gerät auf Vereinsmodus vor (die Server-URL liefert VITE_PB_URL aus .env.local). */
export async function seedVereinDevice(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('darts_settings', JSON.stringify({
      appMode: 'verein', appModeManual: true, mode: 'dark', skin: 'classic',
      accent: '#2BD377', accentDark: '#2BD377', accentLight: '#2BD377',
    }));
    localStorage.setItem('darts_lang', 'de');
  });
}

/** Meldet sich über das echte Formular an — prüft damit den Anmeldeweg gleich mit. */
export async function loginVerein(page: Page): Promise<void> {
  await seedVereinDevice(page);
  await page.goto('/');
  await page.locator('#login-email').waitFor({ state: 'visible', timeout: 20_000 });
  await page.locator('#login-email').fill(VEREIN_LOGIN.email);
  await page.locator('#login-pw').fill(VEREIN_LOGIN.pass);
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  // Nach erfolgreicher Anmeldung steht das Dashboard. Auf den Seitentitel warten, NICHT auf die
  // Navigation: am Handy liegt die im Schubfach und ist unsichtbar, bis man das Menü öffnet.
  await page.locator('h1').first().waitFor({ state: 'visible', timeout: 20_000 });
}

/** Bildschirme, die es NUR im Vereinsmodus gibt. */
export const VEREIN_SCREENS = [
  { nav: 'Ligen', id: 'leagues' },
  { nav: 'Mannschaften', id: 'teams' },
  { nav: 'Benutzer', id: 'users' },
] as const;
