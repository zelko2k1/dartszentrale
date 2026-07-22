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
        globPatterns: ['**/*.{js,css,html,svg,woff,woff2}'],
        // Google Fonts zur Laufzeit cachen, damit Schriften auch offline bleiben (nach erstem Online-Laden)
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      // SW nur im Production-Build (npm run build / vite preview); im Dev-Server aus, um Caching-Probleme zu vermeiden
      devOptions: { enabled: false },
    }),
  ],
})
