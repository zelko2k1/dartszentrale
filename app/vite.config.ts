import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

// https://vite.dev/config/
export default defineConfig({
  define: {
    // App-Version aus package.json → im UI anzeigbar (Update-Abschnitt der Einstellungen)
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      // 'prompt': ein neuer Service-Worker wartet, bis der Nutzer bewusst „Aktualisieren" klickt –
      // niemals ein automatischer Reload mitten im Spiel (siehe UpdateBanner + Einstellungen → App).
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons.svg', 'app-icon.svg'],
      manifest: {
        name: 'DartsHub',
        short_name: 'DartsHub',
        description: 'Darts Counter, Trainingsspiele & Verwaltung',
        lang: 'de',
        theme_color: '#0d0f12',
        background_color: '#0d0f12',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
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
