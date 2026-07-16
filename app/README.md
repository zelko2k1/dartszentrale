# DartsZentrale — App (Frontend)

Die eigentliche DartsZentrale-Web-App: **Vite + React + TypeScript**. Das ist der Produktivstand
(Version 1.0.0), nicht mehr der ursprüngliche HTML-Prototyp, aus dem die App einst hervorging.

> **Was die App fachlich alles kann** (Counter, Training, Ligen, Saisons, Rollen, 2FA, Board-Modus …)
> steht ausführlich im **[Haupt-README](../README.md)**. Dieses Dokument ist die technische
> Kurzübersicht für Entwickler.

## Stack
- **Vite 8 + React 19 + TypeScript**
- **zustand** für den State
- **PWA** (`vite-plugin-pwa`) — installierbar, offline-tauglich, Update-Modus „prompt"
- Reine Inline-Styles + CSS-Variablen (Design-Tokens), Pseudo-States über `src/styles/global.css`. Keine UI-Bibliothek.

## Betriebsmodi
Die App kennt zwei Modi (umschaltbar in den Einstellungen, mit automatischer Erkennung):
- **Lokal** — alles im Browser, kein Login. Persistenz in `localStorage`.
- **Verein** — mit Login und Rollen (**admin / captain / player / viewer / board**), Daten über ein
  **PocketBase**-Backend, mit Realtime-Sync über mehrere Geräte. Der passende Data-Provider liegt in
  `src/data/pocketbaseProvider.ts`.

Die Datenquelle ist über austauschbare Provider gekapselt: `src/data/provider.ts` (Schnittstelle),
`localProvider.ts` (localStorage, synchron) und `pocketbaseProvider.ts` (API, asynchron, Realtime).
Deploy-Setup: `../docs/de/arcane-homelab-anleitung.md` (Homelab/Docker) bzw. `../docs/de/admin-anleitung-cloud.md` (Cloud).

## Starten
```bash
npm install
npm run dev      # Dev-Server auf http://localhost:5173
npm run build    # Produktions-Build nach dist/ (tsc + vite build)
npm run preview  # Build lokal testen (vite preview)
npm run serve    # dist/ mit dem mitgelieferten Node-Server ausliefern (serve-dist.mjs)
npm run lint     # ESLint
```
Im **Lokal**-Modus werden Demo-Daten angelegt; Zurücksetzen = `localStorage` der Seite leeren.
Für den **Verein**-Modus braucht es ein laufendes PocketBase-Backend (siehe `../pocketbase/`).

## Struktur (`src/`)
- `src/data/` — Typen (`types.ts`), Konstanten (Design-Tokens, Rollen/Rechte, Avatare, Checkout-Wege,
  Trainingsmodi), Provider-Abstraktion (`provider.ts`, `localProvider.ts`, `pocketbaseProvider.ts`) + Seed-Daten
- `src/store/` — zustand-Store, Selektoren (`computeStandings`, `aggregateFor` …), X01- und Trainings-Engine
- `src/components/`, `src/layout/` — wiederverwendbare UI + App-Shell/Sidebar
- `src/screens/` — alle Screens: Login, Dashboard, Counter (Setup + In-Game), Training (Übersicht +
  Setup + In-Game), Kalender, Ligen, Mannschaften, Spieler (+ Detail), Statistiken, Benutzer,
  Einstellungen, Modus-Auswahl
- `src/modals/` — Dialoge (Spieler, Mannschaft, Benutzer, Liga, Begegnung, Aufstellung, Termin, Regeln, 2FA …)
- `src/styles/` — globale CSS-Variablen und Pseudo-States

## Auslieferung / Container
- `serve-dist.mjs` — abhängigkeitsfreier Node-Server für `dist/` (SPA-Fallback, Auto-Backup-Endpunkt,
  Datei-Update); wird von den Start-/Autostart-Skripten aus [`../scripts/`](../scripts/) genutzt
  (im Verteil-Paket liegen diese flach neben `app/`)
- `Dockerfile` · `docker-compose.yaml` · `nginx.conf` — Container-Betrieb (Node baut das Bundle,
  nginx liefert es aus). `VITE_PB_URL` ist ein **Build-Arg** (Adresse des PocketBase-Servers).
