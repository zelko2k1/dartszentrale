import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seedLocalDevice, openApp, gotoScreen, LOCAL_SCREENS } from './app';

// Barrierefreiheit im echten Browser.
//
// Die statischen Prüfer (validate-a11y/-palette/-type/-i18n) sehen den Quelltext. axe sieht den
// GERENDERTEN Baum: berechnete Kontraste, tatsächliche Rollenbäume, echte Fokusreihenfolge.
// Erst beides zusammen ist eine Aussage.
//
// Geprüft wird gegen WCAG 2.1 A + AA — dieselbe Messlatte, die das Audit anlegt.
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const scan = (page: import('@playwright/test').Page) =>
  new AxeBuilder({ page }).withTags(WCAG).analyze();

/** Verdichtet axe-Verstöße auf eine Zeile je Regel — sonst ist die Fehlermeldung unlesbar. */
function summarize(violations: Awaited<ReturnType<typeof scan>>['violations']): string {
  return violations
    .map((v) => {
      const where = v.nodes.slice(0, 4).map((n) => n.target.join(' ')).join('\n        ');
      const more = v.nodes.length > 4 ? `\n        … und ${v.nodes.length - 4} weitere` : '';
      return `  [${v.impact ?? '?'}] ${v.id}: ${v.help}\n     ${v.nodes.length} Stelle(n):\n        ${where}${more}`;
    })
    .join('\n');
}

test.describe('Barrierefreiheit je Bildschirm', () => {
  for (const screen of LOCAL_SCREENS) {
    test(`${screen.nav} ist frei von axe-Verstößen`, async ({ page }) => {
      await seedLocalDevice(page);
      await openApp(page);
      if (screen.nav !== 'Dashboard') await gotoScreen(page, screen.nav);

      const { violations } = await scan(page);
      // Nur die Regel-IDs vergleichen: der Volltext-Diff eines axe-Ergebnisses ist unlesbar.
      // Die Einzelheiten stehen in der Fehlermeldung.
      expect(violations.map((v) => v.id), `\n${summarize(violations)}\n`).toEqual([]);
    });
  }
});

test.describe('Beide Hell/Dunkel-Modi', () => {
  for (const mode of ['dark', 'light'] as const) {
    test(`Dashboard im ${mode === 'dark' ? 'Dunkel' : 'Hell'}modus`, async ({ page }) => {
      await seedLocalDevice(page, { mode });
      await openApp(page);
      const { violations } = await scan(page);
      // Nur die Regel-IDs vergleichen: der Volltext-Diff eines axe-Ergebnisses ist unlesbar.
      // Die Einzelheiten stehen in der Fehlermeldung.
      expect(violations.map((v) => v.id), `\n${summarize(violations)}\n`).toEqual([]);
    });
  }
});

test.describe('Skins', () => {
  // Die vier Gestalt-Themes bringen eigene Flächen mit — der Kontrast muss auch dort tragen.
  for (const skin of ['theme01', 'theme02', 'theme03', 'theme07'] as const) {
    test(`Dashboard mit ${skin}`, async ({ page }) => {
      await seedLocalDevice(page, { skin });
      await openApp(page);
      const { violations } = await scan(page);
      // Nur die Regel-IDs vergleichen: der Volltext-Diff eines axe-Ergebnisses ist unlesbar.
      // Die Einzelheiten stehen in der Fehlermeldung.
      expect(violations.map((v) => v.id), `\n${summarize(violations)}\n`).toEqual([]);
    });
  }
});

test.describe('Dialoge', () => {
  test('Spieler-Dialog ist zugänglich und fokusgeführt', async ({ page }) => {
    await seedLocalDevice(page);
    await openApp(page);
    await gotoScreen(page, 'Spieler');

    // „Spieler" ist auch der Navigationseintrag — deshalb gezielt der Anlegen-Button im Seitenkopf.
    await page.getByRole('main').getByRole('button', { name: 'Spieler', exact: true }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // Der Dialog MUSS einen zugänglichen Namen haben (drei hatten früher keinen).
    await expect(dialog).toHaveAccessibleName(/.+/);
    // Der Fokus muss im Dialog liegen, nicht dahinter.
    await expect(dialog.locator(':focus')).toHaveCount(1);

    const { violations } = await scan(page);
    expect(violations.map((v) => v.id), `\n${summarize(violations)}\n`).toEqual([]);

    // Esc schließt und gibt den Fokus zurück.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });
});

test.describe('Tastatur', () => {
  test('Der Fokus-Ring ist sichtbar und wandert durch die Navigation', async ({ page }) => {
    await seedLocalDevice(page);
    await openApp(page);

    await page.keyboard.press('Tab');
    const focused = page.locator(':focus-visible');
    await expect(focused).toHaveCount(1);
    // outline-width kommt aus der globalen :focus-visible-Regel — 0 hieße unsichtbarer Fokus.
    const outline = await focused.evaluate((el) => getComputedStyle(el).outlineWidth);
    expect(parseFloat(outline)).toBeGreaterThan(0);
  });
});
