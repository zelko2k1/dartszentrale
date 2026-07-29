import { defineConfig, devices } from '@playwright/test';

// Endanwender-Prüfung im echten Browser: die vier statischen Prüfer (Palette, a11y, i18n, Typo)
// belegen Struktur und Zahlen — hier wird gemessen, was tatsächlich gerendert wird.
//
//   npm run e2e            → Barrierefreiheit (axe) über alle Bildschirme
//   npm run e2e:report     → HTML-Bericht des letzten Laufs
//   npm run e2e -- --ui    → interaktiv
//
// Getestet wird gegen den PRODUKTIONS-Build (vite preview), nicht den Dev-Server: nur dort greifen
// Minifizierung, Token-Auflösung und das Font-Bundle so wie beim Verein auf dem Board.
export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.artifacts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: 'http://127.0.0.1:4173',
    // Die App ist deutschsprachig voreingestellt; die Sprache folgt sonst navigator.language.
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },

  projects: [
    // Board/Desktop — der Hauptschauplatz: ein Rechner am Dartboard.
    { name: 'board', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    // Tablet am Board (Zweitgerät des Vereins).
    { name: 'tablet', use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 } } },
    // Handy — Fernbedienung und mobile Layouts.
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],

  webServer: [
    {
      // Lokale PocketBase für die Vereins-Prüfungen (a11y-verein.spec.ts). Läuft gegen das
      // vorhandene pocketbase/pb_data — die Prüfungen sind deshalb strikt LESEND.
      // Läuft schon eine Instanz, wird sie weiterverwendet statt eine zweite zu starten.
      command: '../pocketbase/pocketbase serve --http=127.0.0.1:8090 --dir ../pocketbase/pb_data',
      url: 'http://127.0.0.1:8090/api/health',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      // Nur ausliefern, NICHT bauen: ein `npm run build &&` an dieser Stelle bringt den Runner in
      // dieser Umgebung zu Fall. Der Build gehört ohnehin einmal vor den Lauf (siehe npm-Skript "e2e"),
      // nicht in jeden Serverstart.
      // --host 127.0.0.1 ist Pflicht: `vite preview` bindet sonst NUR auf IPv6 ([::1]), und der
      // Health-Check auf 127.0.0.1 läuft dann ins Leere, bis der Timeout zuschlägt.
      command: 'npm run preview -- --port 4173 --strictPort --host 127.0.0.1',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
