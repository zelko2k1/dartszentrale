# Changelog

Alle nennenswerten Änderungen an DartsZentrale werden hier festgehalten.

Format angelehnt an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).

## [Unveröffentlicht]

_Noch nichts._

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

[Unveröffentlicht]: https://github.com/zelko2k1/dartszentrale/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/zelko2k1/dartszentrale/releases/tag/v1.0.0
