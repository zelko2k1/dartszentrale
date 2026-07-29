import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { gotoScreen } from './app';
import { loginVerein, VEREIN_SCREENS } from './verein';

// Die vereinsgebundenen Bildschirme — der letzte blinde Fleck der Prüfung.
//
// Läuft nur, wenn die lokale PocketBase erreichbar ist (der webServer startet sie mit).
// STRIKT LESEND: navigieren und scannen, nie speichern. Siehe verein.ts.
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

test.describe('Vereinsmodus', () => {
  test('Anmeldung führt ins Dashboard', async ({ page }) => {
    await loginVerein(page);
    await expect(page.locator('h1').first()).toBeVisible();
    await expectClean(page);
  });

  for (const screen of VEREIN_SCREENS) {
    test(`${screen.nav} ist frei von axe-Verstößen`, async ({ page }) => {
      await loginVerein(page);
      await gotoScreen(page, screen.nav);
      await expectClean(page);
    });
  }

  test('Liga-Detail mit Tabelle und Begegnungen', async ({ page }) => {
    await loginVerein(page);
    await gotoScreen(page, 'Ligen');
    // Erste Liga öffnen, falls die Übersicht mehrere zeigt (rein lesend).
    const first = page.getByRole('main').getByRole('button').first();
    if (await first.isVisible().catch(() => false)) {
      await first.click();
      await page.waitForTimeout(400);
    }
    await expectClean(page);
  });
});
