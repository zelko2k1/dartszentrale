import type { Page } from '@playwright/test';

// Gemeinsamer Auf- und Einstieg für die Browser-Prüfungen.
//
// Die App startet auf einem frischen Gerät mit der Modus-Auswahl (Lokal/Verein) und verlangt im
// Vereinsmodus einen Login gegen PocketBase. Für die Prüfung setzen wir das Gerät auf den LOKALEN
// Modus vor: kein Server, kein Login, und trotzdem alle Bildschirme, die nicht vereinsgebunden
// sind. `appModeManual: true` schreibt die Wahl fest, damit der Auswahlschirm ausbleibt.
export interface SeedOptions {
  /** 'dark' (Standard) oder 'light' — beide Modi müssen geprüft werden. */
  mode?: 'dark' | 'light';
  /** Skin-Kennung; 'classic' = Basis-Theme. */
  skin?: 'classic' | 'theme01' | 'theme02' | 'theme03' | 'theme07';
  /** Akzentfarbe; der Standard deckt den häufigsten Fall ab. */
  accent?: string;
  lang?: 'de' | 'en';
  /** 'verein' zeigt den Anmeldebildschirm (ohne Server bleibt die App dort stehen). */
  appMode?: 'local' | 'verein';
}

export async function seedLocalDevice(page: Page, opts: SeedOptions = {}): Promise<void> {
  const { mode = 'dark', skin = 'classic', accent = '#2BD377', lang = 'de', appMode = 'local' } = opts;
  await page.addInitScript(
    ({ mode, skin, accent, lang, appMode }) => {
      localStorage.setItem('darts_settings', JSON.stringify({
        appMode,
        appModeManual: true,
        mode,
        skin,
        accent,
        accentDark: accent,
        accentLight: accent,
      }));
      localStorage.setItem('darts_lang', lang);
    },
    { mode, skin, accent, lang, appMode },
  );
}

/** Sichtbare Namen der Navigationseinträge, die im lokalen Modus erreichbar sind. */
export const LOCAL_SCREENS = [
  { nav: 'Dashboard', id: 'dashboard' },
  { nav: 'Darts Counter', id: 'counter-setup' },
  { nav: 'Trainingsspiele', id: 'training' },
  { nav: 'Kalender', id: 'calendar' },
  { nav: 'Spieler', id: 'players' },
  { nav: 'Statistiken', id: 'stats' },
  { nav: 'Einstellungen', id: 'settings' },
] as const;

/** Öffnet die App und wartet, bis die Oberfläche steht. */
export async function openApp(page: Page): Promise<void> {
  await page.goto('/');
  // Der Seitentitel ist das erste, was nach dem Mount steht.
  await page.locator('h1').first().waitFor({ state: 'visible', timeout: 20_000 });
}

/** Wechselt über die Seitennavigation auf einen Bildschirm (prüft die Navigation gleich mit). */
export async function gotoScreen(page: Page, navLabel: string): Promise<void> {
  const isPhone = (page.viewportSize()?.width ?? 1440) < 900;
  if (isPhone) {
    const burger = page.getByRole('button', { name: 'Menü öffnen' });
    if (await burger.isVisible().catch(() => false)) await burger.click();
  }
  await page.getByRole('navigation').getByRole('button', { name: navLabel, exact: true }).click();
  await page.locator('h1').first().waitFor({ state: 'visible', timeout: 10_000 });
}
