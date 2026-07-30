import type { Page } from '@playwright/test';
import { openApp, gotoScreen, seedLocalDevice } from './app';

// Einstiege in die Bildschirme, die NICHT über die Seitennavigation erreichbar sind.
//
// Diese Zustände waren der blinde Fleck der ersten Fassung: die Prüfung besuchte sieben von
// vierzehn Bildschirmen und meldete „alles grün" — während im laufenden Counter ein kritischer
// Verstoß saß. Wer ein Spiel zählt, ist genau hier, nicht im Setup.

/** Startet ein X01-Spiel und liefert die laufende Zähl-Ansicht. */
export async function startCounterGame(page: Page): Promise<void> {
  await gotoScreen(page, 'Darts Counter');
  await page.getByRole('button', { name: /Spiel starten/i }).first().click();
  // Der Aufschrieb steht, sobald die Live-Ansage den ersten Spieler nennt.
  await page.getByText(/ist dran, Rest/i).first().waitFor({ state: 'attached', timeout: 10_000 });
}

/** Öffnet das Setup eines Trainingsmodus (Standard: Around the Clock — reines Solo, kein Kader nötig). */
export async function openTrainingSetup(page: Page, mode = 'Around the Clock'): Promise<void> {
  await gotoScreen(page, 'Trainingsspiele');
  await page.getByRole('button', { name: mode, exact: true }).first().click();
  await page.getByRole('button', { name: /Training starten/i }).first().waitFor({ timeout: 10_000 });
}

/** Startet ein Trainingsspiel und liefert die laufende Ansicht. */
export async function startTrainingGame(page: Page, mode = 'Around the Clock'): Promise<void> {
  await openTrainingSetup(page, mode);
  await page.getByRole('button', { name: /Training starten/i }).first().click();
  await page.waitForTimeout(400);
}

/** Öffnet die Turnier-Einrichtung (Kachel „Neues Turnier" auf dem Trainingsbildschirm). */
export async function openTournamentSetup(page: Page): Promise<void> {
  await gotoScreen(page, 'Trainingsspiele');
  await page.getByRole('button', { name: /Neues Turnier/ }).first().click();
  await page.locator('h1').first().waitFor({ timeout: 10_000 });
}

/** Öffnet ein Spielerprofil. */
export async function openPlayerDetail(page: Page): Promise<void> {
  await gotoScreen(page, 'Spieler');
  await page.getByRole('button', { name: 'Spieler 1', exact: true }).first().click();
  await page.locator('h1').first().waitFor({ timeout: 10_000 });
}

/**
 * Zeigt den Anmeldebildschirm. Der Vereinsmodus verlangt eine Anmeldung; ohne erreichbare
 * PocketBase-Instanz bleibt die App genau auf dieser Maske stehen — das genügt, um sie zu prüfen.
 */
export async function openLogin(page: Page): Promise<void> {
  await seedLocalDevice(page, { appMode: 'verein' });
  await page.goto('/');
  await page.getByRole('button', { name: /Anmelden/i }).first().waitFor({ timeout: 20_000 });
}

/** Erststart-Auswahl „Lokal oder Verein?" — die allererste Maske, die ein Gerät je zeigt. */
export async function openModePicker(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.getByText(/Vereinsmodus|Lokal/i).first().waitFor({ timeout: 20_000 });
}

export { openApp, gotoScreen, seedLocalDevice };
