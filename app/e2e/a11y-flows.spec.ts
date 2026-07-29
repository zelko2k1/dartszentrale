import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seedLocalDevice, openApp } from './app';
import {
  startCounterGame, openTrainingSetup, startTrainingGame,
  openTournamentSetup, openPlayerDetail, openLogin, openModePicker,
} from './flows';

// Die Bildschirme HINTER der Navigation.
//
// Die erste Fassung der Prüfung besuchte sieben von vierzehn Bildschirmen und meldete 57/57 grün.
// In der ungeprüften Hälfte saßen drei Verstöße, darunter ein kritischer im laufenden Counter —
// also genau dort, wo beim Spielen die meiste Zeit verbracht wird. Diese Datei schließt die Lücke.
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const scan = (page: import('@playwright/test').Page) =>
  new AxeBuilder({ page }).withTags(WCAG).analyze();

function summarize(violations: Awaited<ReturnType<typeof scan>>['violations']): string {
  return violations
    .map((v) => {
      const where = v.nodes.slice(0, 4).map((n) => {
        const why = [...n.any, ...n.all].map((c) => c.message).filter(Boolean)[0] ?? '';
        return `${n.target.join(' ')}\n           ${n.html.replace(/\s+/g, ' ').slice(0, 120)}\n           → ${why.replace(/\s+/g, ' ').slice(0, 160)}`;
      }).join('\n        ');
      const more = v.nodes.length > 4 ? `\n        … und ${v.nodes.length - 4} weitere` : '';
      return `  [${v.impact ?? '?'}] ${v.id}: ${v.help}\n     ${v.nodes.length} Stelle(n):\n        ${where}${more}`;
    })
    .join('\n');
}

async function expectClean(page: import('@playwright/test').Page) {
  const { violations } = await scan(page);
  expect(violations.map((v) => v.id), `\n${summarize(violations)}\n`).toEqual([]);
}

test.describe('Spielzustände', () => {
  test('Counter im laufenden Spiel (Aufschrieb, Tastenfeld, Kopfzeile)', async ({ page }) => {
    await seedLocalDevice(page); await openApp(page);
    await startCounterGame(page);
    await expectClean(page);
  });

  test('Counter nach einer Aufnahme', async ({ page }) => {
    await seedLocalDevice(page); await openApp(page);
    await startCounterGame(page);
    // Erst mit Eingaben zeigt der Aufschrieb Zeilen und die Statistikspalten füllen sich.
    for (const key of ['6', '0', 'Enter', '4', '5', 'Enter']) await page.keyboard.press(key);
    await page.waitForTimeout(300);
    await expectClean(page);
  });

  test('Trainings-Setup', async ({ page }) => {
    await seedLocalDevice(page); await openApp(page);
    await openTrainingSetup(page);
    await expectClean(page);
  });

  test('Trainingsspiel im Lauf', async ({ page }) => {
    await seedLocalDevice(page); await openApp(page);
    await startTrainingGame(page);
    await expectClean(page);
  });

  test('Turnier-Einrichtung', async ({ page }) => {
    await seedLocalDevice(page); await openApp(page);
    await openTournamentSetup(page);
    await expectClean(page);
  });
});

test.describe('Weitere Einstiege', () => {
  test('Spielerprofil', async ({ page }) => {
    await seedLocalDevice(page); await openApp(page);
    await openPlayerDetail(page);
    await expectClean(page);
  });

  test('Anmeldung (Vereinsmodus)', async ({ page }) => {
    await openLogin(page);
    await expectClean(page);
  });

  test('Erststart-Auswahl', async ({ page }) => {
    await openModePicker(page);
    await expectClean(page);
  });
});
