# DartsHub — React + TypeScript SPA

Pixelnahe Implementierung des DartsHub-Designs (Vereinsmodus) auf Basis von
`../DartsHub.dc.html` und den Referenz-Screenshots in `../screenshots/`.

## Stack
- **Vite + React 18 + TypeScript**
- **zustand** für State (spiegelt die Logik-Klasse des Prototyps)
- Reine Inline-Styles + CSS-Variablen (Design-Tokens 1:1 aus dem Prototyp), Pseudo-States
  über `src/styles/global.css`. Keine UI-Bibliothek.
- Persistenz in `localStorage` (gleiche `dartshub_*`-Schlüssel wie der Prototyp).

## Starten
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # Produktions-Build nach dist/
```

Beim ersten Start werden die Demo-Daten angelegt (Spieler, 2 Mannschaften, Verbandsliga
Nord 2025/26, 6 Benutzerkonten, Termine). Anmeldung über ein Demo-Konto auf dem
Login-Screen (Passwort beliebig). Zum Zurücksetzen den `localStorage` der Seite leeren.

## Struktur
- `src/data/` — Typen, Konstanten (Tokens, Rollen, Avatare, Checkouts, Trainingsmodi), Seed-Daten
- `src/store/` — zustand-Store, Selektoren (`computeStandings`, `aggregateFor` …), Counter-Engine
- `src/components/`, `src/layout/` — wiederverwendbare UI + App-Shell/Sidebar
- `src/screens/` — alle Screens (Login, Dashboard, Ligen, Mannschaften, Spieler, Spieler-Detail,
  Benutzer, Kalender, Statistiken, Einstellungen, Counter-Setup + In-Game, Training)
- `src/modals/` — Dialoge (Spieler, Mannschaft, Benutzer, Liga, Begegnung, Termin, Regeln)

## Umfang
Alle App-Screens des Vereinsmodus, interaktiv mit Demo-Daten: Navigation, Login/Logout,
Tabs, Tabellen-Neuberechnung, Modals (anlegen/bearbeiten/löschen), Theme- & Akzent-Umschaltung
und ein voll funktionsfähiger X01-Counter (Score-Eingabe, Bust/Checkout, Legs/Sätze,
„Wer beginnt?"/Ausbullen, Statistik-Speicherung).
