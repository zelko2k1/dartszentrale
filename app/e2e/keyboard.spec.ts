import { test, expect, type Page } from '@playwright/test';
import { seedLocalDevice, openApp } from './app';

// Trainingsspiele ohne Maus — die Kernanforderung dieser App.
//
// Am Board steht keine Maus: der Spieler tippt seine Aufnahme auf einer Tastatur ein, oft im
// Stehen, aus zwei Metern Entfernung. Ein Trainingsspiel, das an irgendeiner Stelle einen Klick
// verlangt, ist am Board unbenutzbar — und genau das faellt in einer Pruefung, die klickt, nie auf.
// Deshalb ruehren diese Pruefungen die Maus NICHT an: kein click(), kein fill(), nur Tastatur.
//
// Geprueft wird die ganze Kette, nicht nur der Spielbildschirm: Navigation → Modus waehlen →
// starten → Aufnahme eintragen → zuruecknehmen → beenden. Reisst ein Glied, ist das Spiel am
// Board tot, auch wenn alle anderen gruen sind.
//
// Nur im Projekt "board": am Handy und Tablet wird getippt, dort ist die Tastatur nicht der Weg.

/**
 * Wandert per Tabulator zum Element mit dem gegebenen zugaenglichen Namen und meldet Fehler,
 * wenn es gar nicht erreichbar ist. Genau das ist der Kern der Pruefung: ein `<div onClick>`
 * ohne tabIndex laesst sich anklicken, aber niemals antabben.
 */
async function tabTo(page: Page, name: RegExp | string, max = 90): Promise<void> {
  const seen: string[] = [];
  for (let i = 0; i < max; i++) {
    const label = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return '';
      return (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim();
    });
    if (typeof name === 'string' ? label === name : name.test(label)) return;
    if (label) seen.push(label);
    await page.keyboard.press('Tab');
  }
  throw new Error(
    `Per Tabulator nicht erreichbar: ${name}\nDurchlaufene Stationen: ${seen.slice(0, 40).join(' · ')}`,
  );
}

/** Navigiert per Tastatur bis in ein laufendes Trainingsspiel. */
async function startTrainingByKeyboard(page: Page, modeName: string): Promise<void> {
  await seedLocalDevice(page);
  await openApp(page);
  await tabTo(page, /^Trainingsspiele$/);
  await page.keyboard.press('Enter');
  await tabTo(page, modeName);
  await page.keyboard.press('Enter');
  await tabTo(page, /Training starten/);
  await page.keyboard.press('Enter');
}

test.describe('Trainingsspiele sind ohne Maus bedienbar', () => {
  test.beforeEach(() => {
    test.skip(test.info().project.name !== 'board', 'Tastaturbetrieb gilt dem Board-PC.');
  });

  test('Doppel-Training: Ziffernblock traegt die Aufnahme ein, Alt+U nimmt zurueck, Alt+X beendet', async ({ page }) => {
    await startTrainingByKeyboard(page, 'Doppel-Training');

    // Das Spiel laeuft, sobald die Aufnahme-Frage samt Tastenhinweis steht.
    const frage = page.getByText('Wie viele der 3 Darts haben getroffen?');
    await expect(frage).toBeVisible();
    await expect(page.getByText('(Tasten 0–3)')).toBeVisible();

    // Erste Aufnahme rein ueber die Zifferntaste — ohne vorher irgendetwas zu fokussieren.
    const vorher = await page.locator('body').innerText();
    await page.keyboard.press('1');
    await expect.poll(() => page.locator('body').innerText(), {
      message: 'Die Zifferntaste hat die Aufnahme nicht eingetragen',
    }).not.toBe(vorher);

    // Zuruecknehmen per Kuerzel (Vorgabe Alt+U) — muss den Stand vor der Aufnahme herstellen.
    await page.keyboard.press('Alt+u');
    await expect.poll(() => page.locator('body').innerText(), {
      message: 'Alt+U hat die Aufnahme nicht zurueckgenommen',
    }).toBe(vorher);

    // Beenden per Kuerzel (Vorgabe Alt+X) — zurueck auf die Uebersicht der Trainingsspiele.
    await page.keyboard.press('Alt+x');
    await expect(page.getByRole('button', { name: 'Doppel-Training', exact: true }).first()).toBeVisible();
  });

  test('Halve It: Punkte tippen und mit Enter eintragen, ohne ins Feld zu klicken', async ({ page }) => {
    await startTrainingByKeyboard(page, 'Halve It');

    // Das Punktefeld muss von selbst den Fokus haben — sonst muesste man es anklicken.
    const feld = page.getByLabel('Punkte');
    await expect(feld).toBeFocused();

    await expect(page.getByText('Runde 1 / 9', { exact: true })).toBeVisible();
    await page.keyboard.type('60');
    await expect(feld).toHaveValue('60');
    await page.keyboard.press('Enter');

    // Beweis, dass die Aufnahme angekommen ist: das Feld leert sich (nur der Eintrag tut das) und
    // die Runde zaehlt weiter. Bewusst NICHT auf die Punktzahl geprueft — was aus 60 wird, sagt die
    // Spielregel (Startwert + Treffer), und die soll diese Pruefung nicht doppelt beschreiben.
    await expect(feld).toHaveValue('');
    await expect(page.getByText('Runde 2 / 9', { exact: true })).toBeVisible();

    // Und der Fokus bleibt im Feld — sonst waere die naechste Aufnahme wieder ein Mausklick.
    await expect(feld).toBeFocused();
  });
});
