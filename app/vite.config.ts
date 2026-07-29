// defineConfig aus 'vitest/config' (statt 'vite') — identisch zur Vite-Variante, kennt zusätzlich
// den `test`-Abschnitt weiter unten.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pkg from './package.json' with { type: 'json' }

// Basis-Pfad (Default '/'): für Deployments in einem Unterpfad — z. B. die GitHub-Pages-Demo
// unter /dartszentrale/ — beim Build via  VITE_BASE=/dartszentrale/  setzen.
const BASE = process.env.VITE_BASE || '/'

// https://vite.dev/config/
export default defineConfig({
  base: BASE,
  test: {
    // Die Playwright-Specs unter e2e/ laufen im Browser-Runner, nicht in vitest — sonst versucht
    // vitest sie zu importieren und scheitert an Playwrights eigenem `test`.
    exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
    // 'virtual:pwa-register' ist ein virtuelles Modul des PWA-Plugins und existiert nur im
    // Dev-Server/Build. In den Tests (node) zeigt der Alias auf einen No-op-Stub — ohne ihn bricht
    // jede Testdatei ab, die (indirekt über den Store) lib/pwaUpdate.ts lädt.
    alias: {
      'virtual:pwa-register': fileURLToPath(new URL('./src/test/pwaRegisterStub.ts', import.meta.url)),
    },
  },
  define: {
    // App-Version aus package.json → im UI anzeigbar (Update-Abschnitt der Einstellungen)
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    // Das alte .woff-Format aus dem Build werfen. @fontsource deklariert je Schnitt
    // `src: url(.woff2) format("woff2"), url(.woff) format("woff")` — die zweite Quelle ist ein
    // Fallback für Browser vor ~2016. Diese App verlangt ohnehin oklch() und color-mix() (Chrome 111+,
    // Safari 16.2+); dort ist woff2 seit einem Jahrzehnt Pflichtprogramm. Die Dateien lagen also nur
    // als tote Fracht im Verteilpaket (USB-Stick/copy2share) herum: 25 Dateien, ~560 KB.
    {
      name: 'drop-legacy-woff',
      apply: 'build',
      generateBundle(_options, bundle) {
        let dropped = 0, bytes = 0;
        for (const [file, asset] of Object.entries(bundle)) {
          if (file.endsWith('.woff')) {
            bytes += (asset as { source?: string | Uint8Array }).source?.length ?? 0;
            delete bundle[file];
            dropped++;
          }
        }
        // Die .woff-Quelle aus jedem @font-face streichen, damit kein 404 provoziert wird.
        for (const asset of Object.values(bundle)) {
          if (asset.type !== 'asset' || !asset.fileName.endsWith('.css')) continue;
          const css = String(asset.source);
          asset.source = css.replace(/,\s*url\([^)]*\.woff\)\s*format\("woff"\)/g, '');
        }
        if (dropped) this.warn(`drop-legacy-woff: ${dropped} Dateien entfernt (~${Math.round(bytes / 1024)} KB)`);
      },
    },
    // Schreibt dist/version.json → der schlanke Server (serve-dist.mjs) liest daraus die laufende
    // Version für den Update-Vergleich (Datei-basiertes Update lokal/LAN/Cloud, siehe /admin/update).
    {
      name: 'emit-version-json',
      apply: 'build',
      writeBundle(options) {
        if (options.dir) writeFileSync(join(options.dir, 'version.json'), JSON.stringify({ version: pkg.version, built: new Date().toISOString() }));
      },
    },
    VitePWA({
      // 'prompt': ein neuer Service-Worker wartet, bis der Nutzer bewusst „Aktualisieren" klickt –
      // niemals ein automatischer Reload mitten im Spiel (siehe UpdateBanner + Einstellungen → App).
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons.svg', 'app-icon.svg'],
      manifest: {
        name: 'DartsZentrale',
        short_name: 'DartsZentrale',
        description: 'Darts Counter, Trainingsspiele & Verwaltung',
        lang: 'de',
        theme_color: '#0d0f12',
        background_color: '#0d0f12',
        display: 'standalone',
        orientation: 'any',
        start_url: BASE,
        scope: BASE,
        icons: [
          { src: 'app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App-Shell + Assets vorab cachen → offline lauffähig (wichtig für den lokalen Modus)
        // woff2 ONLY: @fontsource liefert zusätzlich das alte .woff, das kein Zielbrowser je anfragt.
        // Beide zu precachen hieß, bei jeder Installation ~560 KB tote Bytes zu übertragen.
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
      },
      // SW nur im Production-Build (npm run build / vite preview); im Dev-Server aus, um Caching-Probleme zu vermeiden
      devOptions: { enabled: false },
    }),
  ],
})
