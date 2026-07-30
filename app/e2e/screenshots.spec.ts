import { test } from '@playwright/test';
import { seedLocalDevice, openApp, gotoScreen, LOCAL_SCREENS } from './app';
import { startCounterGame, startTrainingGame } from './flows';

// Sichtbelege. Kein Vergleichstest — die Bilder sind da, um Design-Arbeit tatsächlich ANZUSEHEN,
// statt sie aus dem Quelltext zu erschließen. Landen unter e2e/.artifacts/screens/.
//
//   npx playwright test screenshots --project=board
//
// Bewusst kein toHaveScreenshot(): Pixelvergleiche würden bei jeder Absicht-Änderung rot,
// und ohne festgezurrte Schriftrasterung sind sie zwischen Maschinen ohnehin nicht stabil.
const SHOTS = [
  { mode: 'dark', skin: 'classic' },
  { mode: 'light', skin: 'classic' },
  { mode: 'dark', skin: 'theme01' },
  { mode: 'light', skin: 'theme03' },
] as const;

for (const shot of SHOTS) {
  test(`Bildschirme: ${shot.mode}/${shot.skin}`, async ({ page }, testInfo) => {
    await seedLocalDevice(page, { mode: shot.mode, skin: shot.skin });
    await openApp(page);

    const dir = `${testInfo.project.name}-${shot.skin}-${shot.mode}`;
    for (const screen of LOCAL_SCREENS) {
      if (screen.nav !== 'Dashboard') await gotoScreen(page, screen.nav);
      await page.screenshot({ path: `e2e/.artifacts/screens/${dir}/${screen.id}.png`, fullPage: false });
    }
  });
}

// Die Spielzustände gehören genauso ins Bild wie die Navigationsseiten — dort steckte der
// kritische Verstoß, den die erste Fassung der Prüfung nicht gesehen hat.
test('Spielzustände', async ({ page }, testInfo) => {
  await seedLocalDevice(page);
  await openApp(page);
  const dir = `${testInfo.project.name}-spiel`;
  await startCounterGame(page);
  await page.screenshot({ path: `e2e/.artifacts/screens/${dir}/counter-live.png` });
  for (const key of ['6', '0', 'Enter']) await page.keyboard.press(key);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `e2e/.artifacts/screens/${dir}/counter-nach-aufnahme.png` });

  await seedLocalDevice(page);
  await openApp(page);
  await startTrainingGame(page);
  await page.screenshot({ path: `e2e/.artifacts/screens/${dir}/training-live.png` });
});
