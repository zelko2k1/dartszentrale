# DartsHub — React + TypeScript SPA

Pixelnahe Implementierung des DartsHub-Designs (Vereinsmodus) auf Basis von
`../DartsHub.dc.html` und den Referenz-Screenshots in `../screenshots/`.

## Stack
- **Vite 8 + React 19 + TypeScript**
- **zustand** für State (spiegelt die Logik-Klasse des Prototyps)
- **PWA** (`vite-plugin-pwa`) — installierbar, offline-tauglich
- Reine Inline-Styles + CSS-Variablen (Design-Tokens 1:1 aus dem Prototyp), Pseudo-States
  über `src/styles/global.css`. Keine UI-Bibliothek.

## Betriebsmodi
Die App kennt zwei Modi (umschaltbar in den Einstellungen, mit automatischer Erkennung):
- **Local** — alles im Browser, kein Login. Persistenz in `localStorage`
  (gleiche `dartshub_*`-Schlüssel wie der Prototyp).
- **Verein** — mit Login und Rollen (admin / captain / player / viewer),
  Daten über ein **PocketBase**-Backend. Der passende Data-Provider liegt in
  `src/data/pocketbaseProvider.ts`; das Deploy-Setup (Coolify auf Hetzner)
  ist unter `../pocketbase/COOLIFY-SETUP.md` dokumentiert.

Die Datenquelle ist über austauschbare Provider gekapselt (`src/data/provider.ts`,
`localProvider.ts`, `pocketbaseProvider.ts`).

## Starten
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # Produktions-Build nach dist/
npm run preview  # Build lokal testen
npm run lint     # ESLint
```

Beim ersten Start werden die Demo-Daten angelegt (Spieler, 2 Mannschaften, Verbandsliga
Nord 2025/26, 6 Benutzerkonten, Termine). Anmeldung über ein Demo-Konto auf dem
Login-Screen (Passwort beliebig). Zum Zurücksetzen den `localStorage` der Seite leeren.

## Struktur
- `src/data/` — Typen, Konstanten (Tokens, Rollen, Avatare, Checkouts, Trainingsmodi), Seed-Daten
- `src/store/` — zustand-Store, Selektoren (`computeStandings`, `aggregateFor` …), Counter-Engine
- `src/components/`, `src/layout/` — wiederverwendbare UI + App-Shell/Sidebar
- `src/screens/` — alle Screens (Login, Dashboard, Ligen, Mannschaften, Spieler, Spieler-Detail,
  Benutzer, Kalender, Statistiken, Einstellungen, Counter-Setup + In-Game,
  Training-Übersicht + Setup + In-Game)
- `src/modals/` — Dialoge (Spieler, Mannschaft, Benutzer, Liga, Begegnung, Termin, Regeln)

## Umfang
Alle App-Screens interaktiv mit Demo-Daten: Navigation (Desktop-Sidebar + Mobile-Drawer,
responsiv), Login/Logout, Tabs, Tabellen-Neuberechnung, Modals (anlegen/bearbeiten/löschen),
Theme- & Akzent-Umschaltung. Dazu:
- ein voll funktionsfähiger **X01-Counter** (Score-Eingabe, Bust/Checkout, Legs/Sätze,
  „Wer beginnt?"/Ausbullen, Statistik-Speicherung),
- ein **Trainingsmodus** mit eigenen Übungsvarianten,
- **PWA-Installation** und Offline-Betrieb,
- konfigurierbare Tastenkürzel (neues Spiel, Schnellstart Bo3/Bo5) und Layout-Größen.
