import type { Page, BrowserContext } from '@playwright/test';
import { seedVereinDevice, VEREIN_LOGIN } from './verein';

// Die beiden login-freien Live-Flächen — Fernbedienung (#/remote) und Zuschauer-TV (#/watch).
//
// Beide setzen echte Server-Zustände voraus, die kein localStorage vortäuschen kann:
//   • Die Fernbedienung braucht eine LAUFENDE Live-Session. Die veröffentlicht ausschließlich ein
//     angemeldetes Board-Konto im Kiosk-Modus (useLiveHost).
//   • Der Zuschauer-TV braucht den öffentlichen Kanal EINGESCHALTET (Kill-Switch, Vorgabe: aus)
//     und dessen Token.
//
// ⚠ Der Zuschauer-Kanal ist der einzige Schreibvorgang der gesamten Prüfung. Er wird am Ende
// wieder ausgeschaltet, damit die Instanz so bleibt, wie sie war.

export const BOARD_LOGIN = {
  email: process.env.DZ_E2E_BOARD_EMAIL ?? 'board@dartszentrale.local',
  pass: process.env.DZ_E2E_BOARD_PASS ?? 'board-dartszentrale-2026',
};

/** Meldet ein Board-Konto an. Danach läuft der Kiosk-Modus und die Live-Session wird veröffentlicht. */
export async function loginBoard(page: Page): Promise<void> {
  // Ein Board ist ein FESTER Rechner bzw. ein Tablet am Dartboard — nie ein Handy. Die
  // Kiosk-Leiste gibt es unterhalb der Tablet-Breite gar nicht. Deshalb bekommt die Board-Seite
  // immer eine Board-Größe, egal unter welchem Geräteprofil die Prüfung läuft.
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedVereinDevice(page);
  await page.goto('/');
  await page.locator('#login-email').waitFor({ state: 'visible', timeout: 20_000 });
  await page.locator('#login-email').fill(BOARD_LOGIN.email);
  await page.locator('#login-pw').fill(BOARD_LOGIN.pass);
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  // Im Kiosk gibt es die Tab-Leiste statt der Seitennavigation.
  await page.getByRole('button', { name: 'Einstellungen' }).first().waitFor({ timeout: 20_000 });
}

/**
 * Holt den Kopplungscode aus dem Board-Panel in den Einstellungen. Er erscheint erst, wenn die
 * Session tatsächlich beim Server angemeldet ist — deshalb mit Wiederholung statt festem Warten.
 */
export async function readPairCode(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Einstellungen' }).first().click();
  const code = page.locator('span', { hasText: /^[A-Z0-9]{6}$/ }).first();
  await code.waitFor({ state: 'visible', timeout: 30_000 });
  return (await code.innerText()).trim();
}

/**
 * Öffnet die Code-Eingabe der Fernbedienung.
 *
 * Wichtig: #/remote liegt HINTER der Anmeldung — nur #/watch ist wirklich anmeldefrei. Das
 * Handy gehört einem Anschreiber, also einem Vereinsmitglied; es muss sich zuerst anmelden.
 */
export async function openRemote(page: Page): Promise<void> {
  await seedVereinDevice(page);
  await page.goto('/#/remote');
  await page.locator('#login-email').waitFor({ state: 'visible', timeout: 20_000 });
  await page.locator('#login-email').fill(VEREIN_LOGIN.email);
  await page.locator('#login-pw').fill(VEREIN_LOGIN.pass);
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.getByLabel('Kopplungscode').waitFor({ state: 'visible', timeout: 20_000 });
}

/** Koppelt über die manuelle Code-Eingabe (der Weg ohne QR-Scanner). */
export async function pairRemote(page: Page, code: string): Promise<void> {
  const field = page.getByLabel('Kopplungscode');
  await field.waitFor({ state: 'visible', timeout: 20_000 });
  await field.fill(code);
  await page.getByRole('button', { name: 'Koppeln', exact: true }).click();
  // Gekoppelt: die Konsole zeigt die Verbindungsanzeige.
  await page.getByText(/verbunden|sendet/i).first().waitFor({ timeout: 20_000 });
}

/** Öffnet die Rubrik „Geräte" in den Einstellungen — dort sitzen Kopplung und Zuschauer-Kanal. */
export async function openDeviceSettings(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Geräte', exact: true }).first().click();
  await page.getByRole('switch', { name: /Zuschauer-TV einschalten/i }).waitFor({ timeout: 20_000 });
}

/** Schaltet den öffentlichen Zuschauer-Kanal über das Admin-Panel und liefert den Link. */
export async function enableWatch(page: Page): Promise<string> {
  // Nur einschalten, wenn er AUS ist — ein blinder Klick würde einen bereits aktiven Kanal
  // abschalten und danach einen Link zeigen, der ins Leere führt.
  const sw = page.getByRole('switch', { name: /Zuschauer-TV einschalten/i });
  if ((await sw.getAttribute('aria-checked')) !== 'true') await sw.click();
  const link = page.getByText(/#\/watch\//).last();
  await link.waitFor({ state: 'visible', timeout: 20_000 });
  return (await link.innerText()).trim();
}

/** Schaltet den Kanal wieder aus — die Instanz bleibt, wie sie war. */
export async function disableWatch(page: Page): Promise<void> {
  const sw = page.getByRole('switch', { name: /Zuschauer-TV einschalten/i });
  if ((await sw.getAttribute('aria-checked')) === 'true') await sw.click();
}

/** Frischer Kontext (eigener localStorage) — Board, Handy und Zuschauer sind verschiedene Geräte. */
export async function newDevice(context: BrowserContext): Promise<Page> {
  return context.newPage();
}

export { VEREIN_LOGIN };
