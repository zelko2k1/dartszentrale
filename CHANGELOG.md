# Changelog

Alle nennenswerten Änderungen an DartsZentrale werden hier festgehalten.

Format angelehnt an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).

## [Unveröffentlicht]

### Behoben
- **Trainings-Bestwerte im Vereinsmodus** ließen sich nicht speichern — nach jedem Trainingsspiel
  erschien „Änderung konnte nicht gespeichert werden". Ursache: Der Bestwert wird am Spieler-Datensatz
  verbucht, Schreibrechte auf Spieler hatten aber nur Admin und Kapitän — am **Board-Rechner**, also
  genau dort, wo trainiert wird, schlug es immer fehl. Jetzt darf jedes angemeldete Konto Bestwerte
  speichern, **aber nur diese**: Name, Kürzel, Foto und Sperre bleiben Admin/Kapitän vorbehalten.
  ⚠ **Erfordert ein Server-Update** (neue Migration) — im lokalen Einzelboard-Modus trat der Fehler
  nicht auf.
- **Standardspieler „Spieler 1/2" im Vereinsmodus:** Ein Trainingsspiel mit den beiden immer
  vorhandenen Standardspielern meldete „Änderung konnte nicht gespeichert werden". Diese Spieler
  gibt es nur gerätelokal (kein Datensatz auf dem Server), der Bestwert wurde aber trotzdem an den
  Server geschickt und lief ins Leere. Ihre Bestwerte werden jetzt korrekt nur lokal geführt; die
  Meldung bleibt aus. Betrifft ebenso das Bearbeiten dieser beiden Spieler.

### Geändert
- **Fernbedienung am Handy:** Die Bedienoberfläche passt sich jetzt auf jedes Handy ein — sie füllt
  genau den Bildschirm, ohne zu scrollen. Vorher rutschten „Enter" und „Undo" auf kleineren Geräten
  unter den sichtbaren Bereich. Neu außerdem: Querformat als Zwei-Spalten-Ansicht (Stand links,
  Tastenfeld rechts), Druck-Feedback und kurze Vibration beim Tippen, kein versehentliches Zoomen
  oder Textmarkieren mehr, Rand-Freihaltung für Geräte mit Kamera-Aussparung, Wurf-Anzeige und
  Checkout-Vorschlag in einer Zeile, kompakte Spielerliste ab drei Spielern (der Spieler am Wurf
  bleibt immer sichtbar).
- Der Update-Hinweis („Neue Version verfügbar") erscheint nicht mehr auf Fernbedienung und
  Zuschauer-TV — er schwebte dort über den Tasten.

## [1.0.3] – 2026-07-21

### Hinzugefügt
- **Remote & Live:** Ein Smartphone lässt sich per QR-Code (oder manueller Code-Eingabe) als
  **Fernbedienung** an ein Board koppeln — Score-Eingabe **und** Navigation vom Handy (Notfall bei
  defekter Maus/Tastatur oder einfach als bequeme Bedienung). Genau ein „Anschreiber" pro Board;
  Übernahme durch ein anderes Handy muss bestätigt werden. Koppeln auch über die Einstellungen.
- **Login-freier Zuschauer-TV:** ein dauerhafter, geheimer Link (`#/watch/<token>`) zeigt auf einem
  Bildschirm im Nebenraum das laufende Spiel (mehrere Boards als Kachel-Übersicht, sonst Vollbild).
  Vereinsweit ein-/ausschaltbar (**Standard aus** im Internet-Betrieb), Token rotierbar, zeigt nur
  Boardname + Spielstand. Beides nur im Vereins-/Board-Modus (PocketBase als Kanal).
  Plan/Details: [`docs/plan-remote.md`](docs/plan-remote.md).
- **Counter – Match-Statistik:** einklappbare Match-Statistik im Sieg-Overlay, eigene Statistik-Box
  (Darts/Short Legs statt „140+"), Kennzahl **Ø Darts/CO** und eine Finish-Dart-Abfrage (1/2/3) für
  eine korrekte Checkout-Quote. Das Sieg-Overlay zeigt die Ausmache (High Finish / Short Leg).
- **Counter – Live-Feier** bei Short Leg (≤ 19 Darts) und High Finish (≥ 100).
- **Tastenkürzel:** Übersicht aller Kürzel, Befehlspalette auf **Alt+K**, Undo/Abbrechen auf **Alt+Z/Alt+X**
  (alle drei in den Einstellungen konfigurierbar), zusätzlich Ctrl+Z / Ctrl+X. Header-Hinweise nur am Desktop.
- **Liga:** acht **Spielformat-Vorlagen** zur schnellen Auswahl.
- **Import:** englische CSV-Vorlage und zweisprachige Spalten-Erkennung.
- **Erststart:** Browser-Sprache wird übernommen (Deutsch → DE, sonst EN).
- **Kalender/Dashboard:** Hinweis auf den nächsten Termin, wenn der gewählte Zeitraum leer ist.

## [1.0.2] – 2026-07-16

### Geändert
- **Mobile-Layout:** Kein horizontales Scrollen mehr am Smartphone —
  Statistik-Bestenliste als Karten je Spieler, Kalender als Agenda-Liste,
  Ligatabelle mit kompakten Spalten (ohne Legs/Differenz). Verwaltungs-Tabellen
  (z. B. Benutzer) bleiben am Handy bewusst scrollbare Tabellen.

### Behoben
- Terminart „Competition" hieß im deutschen UI englisch — jetzt „Wettbewerb".

## [1.0.1] – 2026-07-16

### Behoben
- **Counter:** Bei Rest 2 oder 3 war der **3-Dart-Checkout** fälschlich gesperrt
  (z. B. Miss, Miss, D1) und solche Aufnahmen fehlten in der Checkout-Quote —
  die Auscheck-Prüfung berücksichtigt jetzt Finishes mit weniger Darts als verfügbar.

### Hinzugefügt
- **Browser-Demo** auf GitHub Pages: App ohne Installation im Lokal-Modus ausprobieren.
- **Automatische Tests** für die Spiellogik (Checkout-Regeln aller drei Out-Modi,
  Checkout-Tabelle, Leg-/Satz-Wertung, Bust-Regel, Ligatabelle) — laufen in der neuen **CI**
  (Lint + Tests + Build bei jedem Push/Pull-Request).
- **Release-Automation:** Ein Git-Tag `v*` baut die Verteil-Bundles und veröffentlicht das Release.

### Geändert
- **Alles englischsprachig als Primärfassung** (App war es schon): Skripte in `scripts/`
  (Namen + Inhalte), alle Anleitungen in `docs/` mit deutschen Fassungen in `docs/de/`,
  Verteil-Bundles heißen jetzt `01-single-board` / `02-club-lan` / `03-club-cloud`,
  Release-Notes zweisprachig.

## [1.0.0] – 2026-07-14

Erste öffentliche Version. Läuft im echten Vereinsbetrieb.

### Hinzugefügt
- **Am Board zählen** (n01-Stil) mit Checkout-Vorschlägen, Aufschrieb-Ansicht, Live-Statistik
  und einstellbarem Zoom für große Leseabstände.
- **Trainingsspiele**: Cricket, Around the Clock, Bob's 27 u. a. mit Regel-Dialog, Rangliste,
  Rückgängig und Revanche.
- **Ligabetrieb**: Spielplan-Import (inkl. **nuLiga**, Liga **und** Pokal), automatische Tabelle,
  Ergebniseintrag; Board-Modus mit „Nächstes Spiel"-Overlay und Datumsfenster.
- **Mannschaften & Aufstellungen** verwalten und direkt „an die Boards senden".
- **Kalender** mit Serienterminen, Batch-Löschen alter Termine und Saison-Abschluss.
- **Statistiken** je Spieler: Ø 3-Dart, 180er, Checkout-Quote, First-9, Short Legs, Rekorde,
  Saison-Filter und CSV-Export.
- **Benutzerkonten mit Rollen** (admin / captain / player / viewer / board) und optionaler
  **2-Faktor-Anmeldung (TOTP)** samt Einrichtungs-Assistent und Admin-Reset.
- **Zwei Betriebsmodi**: lokal (ein Board, ohne Login, `localStorage`) und Verein (PocketBase-Backend
  mit Realtime-Sync über mehrere Geräte).
- **Drei Verteil-Bundles** zum Herunterladen: lokal, Verein-LAN (Single-Binary, App + Datenbank),
  Verein-Cloud — plus dateibasiertes In-App-Update.
- Konfigurierbares **Impressum & Datenschutz** und automatisches Backup für den Eigenbetrieb.

[Unveröffentlicht]: https://github.com/zelko2k1/dartszentrale/compare/v1.0.2...HEAD
[1.0.2]: https://github.com/zelko2k1/dartszentrale/releases/tag/v1.0.2
[1.0.1]: https://github.com/zelko2k1/dartszentrale/releases/tag/v1.0.1
[1.0.0]: https://github.com/zelko2k1/dartszentrale/releases/tag/v1.0.0
