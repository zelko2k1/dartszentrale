# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Deutschsprachige Darts-Vereine sind die Kern-Zielgruppe. Innerhalb eines Vereins gibt es
abgestufte Nutzerrollen mit unterschiedlichen Situationen:

- **Vereins-Administrator** — richtet ein und verwaltet Ligen, Mannschaften, Benutzer, Saisons,
  Termine und die Vereinsidentität. Meist am Desktop.
- **Kapitän** — stellt Mannschaften auf, teilt Boards zu, trägt Ergebnisse ein.
- **Spieler** — spielt und zählt am Board: liest schnell, oft in abgedunkelten Räumen, im Stehen
  2–3 m vom Bildschirm entfernt; sieht eigene Statistik.
- **Betrachter** — nur lesender Zugriff.
- **Board-Rechner** — Maschinenkonto; ein PC/Tablet am Board, das im gesperrten Kiosk-Modus nur
  spielen und trainieren darf.

Englischsprachige / nicht-deutsche Vereine sind eine willkommene Beigabe (die Oberfläche ist
zweisprachig), aber **nicht** gleichrangig zur deutschen Kern-Zielgruppe.

## Product Purpose

DartsZentrale bildet den kompletten Alltag eines Darts-Vereins an einem Ort ab: am Board zählen
(statt Kreide und Tafel), Trainingsspiele, Ligabetrieb mit automatischer Tabelle, Mannschaften &
Aufstellungen, Termine, Spieler- und Vereins-Statistiken sowie Benutzerverwaltung mit Rollen.
Erfolg heißt: Ein Verein kann seinen Spielbetrieb — besonders den Ligaabend — ohne fremde
Cloud-Firma und ohne monatliche Gebühr auf eigener Infrastruktur führen. Die App ist kostenlos
(MIT) und aus einer echten Not im Verein entstanden.

## Positioning

Selbst-gehostete, kostenlose Vereins- und Zähl-App, deren Betreiber die volle Datenhoheit behält:
läuft wahlweise komplett lokal auf einem Board, im Vereins-LAN oder auf einem eigenen
Internet-Server — dieselbe App, ohne Zwang zu einem fremden Cloud-Dienst oder Abo. Der
Board-/Kiosk-Betrieb mit automatischem „Nächstes Spiel", Handy-Fernbedienung und
Zuschauer-TV ist speziell auf den realen Ligaabend zugeschnitten. Deutschland-spezifische
Ligaanbindung (BDV-CSV- und nuLiga-Import) ist eingebaut. Bewusst offen und ehrlich
positioniert: gepflegt von einem Vereins-Admin, nicht aus einem Entwicklerbüro.

## Operating Context

- **Primäre Szene: der Board-Betrieb am Ligaabend.** Wenn Design-Prioritäten kollidieren, gewinnt
  die reale Spielsituation am Board (Kiosk-Vollbild, schnelle Eingabe, Fernlesbarkeit aus Distanz,
  Handy als Fernbedienung), nicht die Verwaltung am Schreibtisch.
- **Zwei Betriebsmodi**, beim ersten Start gewählt: **Lokal** (ein Board, keine Anmeldung, Daten im
  Browser des Geräts) und **Verein** (Anmeldung mit Rollen, zentrale PocketBase-Datenbank, mehrere
  Geräte sehen live dieselben Daten).
- **Drei Verteil-Pakete:** `01-single-board` (ein PC am Board), `02-club-lan` (Single-Binary für den
  Verein im eigenen Netz), `03-club-cloud` (eigener Internet-Server mit Domain/HTTPS); zusätzlich
  Homelab/Docker (Arcane).
- **Board-Rechner** melden sich mit nummerierten Board-Konten an, laufen gesperrt im Kiosk-Modus und
  bleiben über Neustarts angemeldet (einschalten → sofort spielbereit).
- Eingabe per Tablet-Ziffernfeld, Tastatur oder gekoppeltem Smartphone; Monitore werden aus mehreren
  Metern Abstand gelesen.

## Capabilities and Constraints

- **Darts Counter:** X01 (301/501/701/1001), Single/Double/Master Out, optional Double-In, Wertung
  nach Legs oder Sätzen, Anwurf per Ausbullen/Zufall/manuell, Gastspieler & freies Spiel,
  Checkout-Vorschläge, Rückgängig, Bust-Erkennung, Live-Werte (Ø 3-Dart, First 9, 180/140+,
  Checkout-Quote, High Finish). Zwei Ansichten: „Restscore" (fernlesbar) und „Aufschrieb" (n01-Stil).
- **Trainingsspiele:** 9 Modi (u. a. Around the Clock, Cricket mit MPR, Bob's 27, Baseball, Halve It,
  Elimination, Killer), solo & bis 8 Spieler, mit Ranglisten.
- **Vereinsverwaltung:** Spieler, Mannschaften (Liga/Pokal/Freundschaft, Kader, Kapitän),
  Benutzerkonten mit Rollen, Vereinsidentität (Name/Logo), Rechtstexte auf der Login-Seite.
- **Ligen & Wettbewerbe:** Spielformat-Vorlagen und frei konfigurierbare Blockfolgen, automatische
  Tabelle, Begegnungen, Aufstellung pro Spieltag mit Board-Zuweisung, Spielbericht mit Highlights,
  CSV-Spielplan-Import (BDV, wiederholbar ohne Duplikate), nuLiga-Import (serverseitig, Admin;
  eigene Heim-Ergebnisse bleiben maßgeblich, Abweichungen werden als Konflikt markiert).
- **Board-Betrieb/Kiosk, Handy-Fernbedienung, login-freier Zuschauer-TV** (`#/watch/<token>`,
  Standard aus im Internet-Betrieb), Kalender, Statistiken (CSV-Export), Saison-Verwaltung
  (eine aktive Saison + Archiv, Abschluss friert Schnappschuss ein).
- **Sicherheit:** fünf Rollen, 2FA/TOTP zum Selbst-Einrichten, Login per E-Mail + Passwort,
  inaktive Konten abgewiesen.
- **Technik:** React 19 + TypeScript (Ordner `app/`), Backend PocketBase (Ordner `pocketbase/`),
  Progressive Web App (installierbar, offline lauffähig), Backup als JSON-Voll-Export/-Import
  (lokal zusätzlich automatisches tägliches Backup über `serve-dist.mjs`).
- **Styling-Architektur (Ist-Zustand):** kein Utility-Framework und kein CSS-in-JS — stattdessen
  globale CSS-Dateien (`app/src/styles/tokens.css`, `global.css`, `index.css`, `App.css`). **Alle
  Design-Tokens sind CSS-Custom-Properties** (`--bg`, `--surface`, `--text`, `--accent` …), per
  `[data-theme="dark|light"]` umgeschaltet — das ist der Andockpunkt für Themes. Klassen tragen ein
  `dh-`-Präfix (`dh-btn`, `dh-primary`, `dh-nav`, `dh-dialog` …; Altlast des früheren Namens
  DartsHub) — **kein** BEM, **keine** CSS Modules.

**Unantastbare Grundsätze — jede künftige Arbeit muss sie bewahren:**

1. **Selbst-hostbar, keine Cloud-Pflicht** — lokal / LAN / eigener Server, nie Zwang zu fremdem
   Cloud-Dienst oder Abo.
2. **Daten bleiben beim Verein (DSGVO)** — Mitgliederdaten verlassen nie unkontrolliert Gerät/Server;
   datensparsam.
3. **Offline lauffähig** — als PWA installierbar, ohne Internet nutzbar (mind. Counter/Training/
   Statistik lokal).
4. **Fernlesbarkeit am Board** — der Spielstand muss aus mehreren Metern Entfernung gut lesbar bleiben.

**Terminologie:** Verein/Club, Board, Aufschrieb, Anwurf/Ausbullen, Leg/Satz, Begegnung, Aufstellung,
Spieltag, Kiosk, Board-Konto, Fernbedienung, Zuschauer-TV, Saison.

## Brand Commitments

- **Name:** DartsZentrale (bestehende Wortmarke, Emoji-Kennung 🎯). Frühere Namen (DartsHub) sind
  überholt und nicht wiederzubeleben.
- **Vereins-Logo** ist konfigurierbar und erscheint auf der Login-Seite — die App muss ein vom Verein
  gestelltes Logo aufnehmen können.
- **Stimme:** offen, ehrlich, bodenständig — „von einem Vereins-Admin, kein Entwicklerbüro". Keine
  aufgeblasenen Marketing-Versprechen; Grenzen (Support, Gewähr) werden klar benannt. Ton insgesamt
  clean und sportlich, kein Schnickschnack.
- **Bindende visuelle Anti-Referenzen** (vom Betreiber festgelegt, gelten für jede künftige
  Design-Arbeit): **keine** Lila-Verläufe, **kein** Glassmorphism, **kein** „rounded-everything"-
  SaaS-Look.
- **Lizenz:** MIT, öffentlich (`github.com/zelko2k1/dartszentrale`).
- **Zweisprachig DE/EN**, pro Gerät umschaltbar; DE ist die Primärsprache.

## Evidence on Hand

- Läuft im echten Vereinsbetrieb (nicht bloß Prototyp).
- Öffentliche Browser-Demo: https://zelko2k1.github.io/dartszentrale/ (Lokal-Modus).
- Bildschirmfotos unter `screenshots/` (Dashboard, Counter, Training, Kalender, Ligen, Mannschaften,
  Spieler, Statistiken, Benutzer, Einstellungen, Board-Overlay) — aus dem Vereinsmodus mit Demo-Daten.
- Fertige Release-Pakete unter GitHub Releases; Sicherheitsstand in `docs/security-audit.md`.
- Keine erfundenen Testimonials, Kundenzahlen, Benchmarks oder Preise — es gibt keine; künftige
  Arbeit darf solche nicht erfinden (die App ist kostenlos, ohne zahlende Kundschaft).

## Product Principles

1. **Der Ligaabend am Board gewinnt.** Im Zweifel wird auf die reale Spielsituation optimiert
   (Kiosk, schnelle Eingabe, Distanz-Lesbarkeit), nicht auf die Verwaltung.
2. **Datenhoheit vor Bequemlichkeit.** Selbst-hostbar und DSGVO-treu bleibt Vorbedingung, nicht Option.
3. **Funktioniert ohne Netz.** Offline-Fähigkeit ist Kernversprechen, kein Nice-to-have.
4. **Ehrlich statt hochglanz.** Klarheit und offengelegte Grenzen schlagen Marketing-Politur.
5. **Deutscher Vereins-Alltag zuerst.** Ligaanbindung und Terminologie folgen dem deutschen
   Darts-Betrieb; EN läuft mit, gibt aber nie den Takt vor.

## Accessibility & Inclusion

- **Distanz-Lesbarkeit** am Board ist eine harte Anforderung: gelesen wird schnell, im Stehen aus
  2–3 m, oft in abgedunkelten Räumen. Dafür: eigener Board-Zoom und viele Größenregler (Restscore,
  Statistik, Kopf, Kader, Leg).
- Vereinsmitglieder sind gemischten Alters und keine Software-Profis — Bedienung muss ohne
  Fachwissen möglich sein (Paket laden, entpacken, Startdatei doppelklicken).
- Bedienbar per Touch (Tablet), Tastatur (mit konfigurierbaren Kürzeln und Befehls-Palette) und
  gekoppeltem Smartphone.
