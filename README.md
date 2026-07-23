# 🎯 DartsZentrale

**🇩🇪 Deutsch | [🇬🇧 English](README.en.md)**

**Die kostenlose Vereins- und Zähl-App für Darts-Clubs.** Spielstände zählen, Trainings­spiele,
Ligen mit automatischer Tabelle, Mannschaften, Termine, Statistiken und Benutzer­verwaltung —
alles an einem Ort, auf deinem eigenen Gerät oder Server.

[![Version](https://img.shields.io/github/v/release/zelko2k1/dartszentrale?label=Version&color=blue)](https://github.com/zelko2k1/dartszentrale/releases/latest)
[![Lizenz: MIT](https://img.shields.io/github/license/zelko2k1/dartszentrale?label=Lizenz&color=green)](LICENSE)
![Sprache](https://img.shields.io/badge/Sprache-DE%20%2F%20EN-informational)
![React](https://img.shields.io/badge/React-19-61dafb)
![PocketBase](https://img.shields.io/badge/Backend-PocketBase-b8dbe4)
![PWA](https://img.shields.io/badge/PWA-offline--f%C3%A4hig-5a0fc8)
![Vereinsbetrieb](https://img.shields.io/badge/l%C3%A4uft%20im%20echten-Vereinsbetrieb-success)

## ⬇️ Herunterladen & loslegen

### ▶️ **[Demo direkt im Browser ausprobieren](https://zelko2k1.github.io/dartszentrale/)** — nichts zu installieren
*(Beim ersten Start „Lokal" wählen — Counter, Trainingsspiele und Statistik laufen komplett im Browser.)*

### 👉 **[Fertiges Paket herunterladen (neueste Version)](https://github.com/zelko2k1/dartszentrale/releases/latest)**

Kein Fachwissen nötig: Paket laden, entpacken, Start-Datei doppelklicken. Welches passt zu mir?

| Paket | Für wen? |
|---|---|
| **`01-single-board.zip`** | Ein PC/Tablet am Board — nur zählen & trainieren, ohne Server, ohne Anmeldung. **← einfachster Einstieg** |
| **`02-club-lan.zip`** | Ganzer Verein im eigenen Netzwerk — ein Programm liefert App **und** Datenbank aus. |
| **`03-club-cloud.zip`** | Betrieb auf einem eigenen Internet-Server mit Domain & HTTPS. |

Die passende Schritt-für-Schritt-Anleitung liegt **im Paket** und weiter unten unter [„Loslegen"](#loslegen--welche-anleitung-passt-zu-mir).

---

## Was ist DartsZentrale ?

DartsZentrale ist eine App, mit der ein Darts-Verein seinen kompletten Alltag abbilden kann:

- **Am Board zählen** statt Kreide und Tafel — mit Checkout-Vorschlägen und Live-Statistik.
- **Trainingsspiele** wie Cricket, Around the Clock oder Bob's 27 mit Rangliste.
- **Den Ligabetrieb organisieren** — Spielplan importieren, Ergebnisse eintragen, Tabelle rechnet sich selbst aus.
- **Mannschaften & Aufstellungen** verwalten und direkt „an die Boards senden".
- **Statistiken** für jeden Spieler (Ø 3-Dart, 180er, Checkout-Quote, Rekorde …).
- **Benutzerkonten mit Rollen**, damit nicht jeder alles ändern darf.

Du brauchst **keine Cloud-Firma und keine monatliche Gebühr**. Die App läuft entweder komplett
auf einem einzelnen PC am Board, im eigenen Vereins-Netzwerk oder auf einem eigenen Internet-Server —
du entscheidest. Deine Mitglieder­daten bleiben bei dir.

> ### Ehrlich gesagt: Wer steckt dahinter?
> Ich bin **Vereins-Admin, kein ausgebildeter Entwickler**. DartsZentrale ist aus einer konkreten
> Not im Verein entstanden und **mit KI-Unterstützung (Anthropic Claude) gebaut** — von der ersten
> Zeile bis zur Doku. Das sage ich lieber offen, als so zu tun, als käme es aus jahrelanger
> Entwickler-Erfahrung.
>
> **Was das für dich heißt:** Ich pflege das Projekt und teste es im echten Betrieb, kann aber nicht
> jeden Codepfad tief bewerten. **Code-Reviews, Hinweise und Pull Requests sind ausdrücklich willkommen.**
> Der Support ist begrenzt. Nutzung **auf eigenes Risiko, ohne Gewähr** (siehe [LICENSE](LICENSE)).
> Die App verwaltet **personenbezogene Mitglieder­daten (DSGVO)** — wer sie selbst hostet, sollte das
> bewusst und sorgfältig tun. Aktueller Sicherheits­stand und eine Go-live-Checkliste stehen in
> [`docs/security-audit.md`](docs/security-audit.md).

---

## Bildschirmfotos

| Dashboard | Darts Counter | Trainingsspiele |
|:--:|:--:|:--:|
| ![Dashboard](screenshots/01-dashboard.png) | ![Darts Counter](screenshots/02-counter.png) | ![Trainingsspiele](screenshots/03-trainingsspiele.png) |
| **Kalender** | **Ligen** | **Mannschaften** |
| ![Kalender](screenshots/04-kalender.png) | ![Ligen](screenshots/05-ligen.png) | ![Mannschaften](screenshots/06-mannschaften.png) |
| **Spieler** | **Statistiken** | **Benutzer & Rechte** |
| ![Spieler](screenshots/07-spieler.png) | ![Statistiken](screenshots/08-statistiken.png) | ![Benutzer & Rechte](screenshots/09-benutzer.png) |
| **Einstellungen** | **Board: „Nächstes Spiel"** | |
| ![Einstellungen](screenshots/10-einstellungen.png) | ![Board: „Nächstes Spiel"](screenshots/11-board-overlay.png) | |

*(Bildschirmfotos aus dem Vereinsmodus mit Demo-Daten; Board-Overlay aus der Kiosk-Ansicht eines Board-Kontos.)*


---

## Funktionsumfang

### 🎯 Spielen & Zählen (Darts Counter)
- **X01-Spiele** mit Startpunkten 301 / 501 / 701 / 1001
- Auscheck-Modi **Single / Double / Master Out**, optionaler **Double-In**
- Wertung nach **Legs** (Best of 1–11) oder nach **Sätzen**
- **Anwurf** per Ausbullen, Zufall oder manueller Wahl
- **Gastspieler** (einfach Namen eintippen) und **freies Spiel** (zählt nicht in die Statistik)
- Eingabe per **Tablet-Ziffernfeld oder Tastatur**, frei belegbare Schnell-Scores (F1–F8), Checkout mit 1/2/3 Darts
- **Checkout-Vorschläge** (Finish-Wege bis 170), **Rückgängig**, Bust-Erkennung
- **Live-Werte** je Spieler: Ø 3-Dart, First 9, 180/140+, Checkout-Quote, High Finish
- Zwei Ansichten: **„Restscore"** (fernlesbar am Board) oder **„Aufschrieb"** im klassischen Sheet-Stil
- **Revanche** per Klick; fertige Spiele werden automatisch mit allen Einzelwerten gespeichert

### 🏋️ Trainingsspiele (9 Modi, vollständig)
- **Solo:** Doppel-Training, Around the Clock, Bob's 27, 121 Checkout
- **Mehrspieler (bis 8):** Around the Clock, Cricket (mit MPR), Baseball, Halve It, Elimination, Killer — Cricket, Baseball & Halve It gehen auch **solo**
- Jeder Modus mit Regel-Dialog, Rangliste, Rückgängig und Revanche; meistgespielte Modi als Schnellstart

### 👥 Vereinsverwaltung
- **Spieler** anlegen/bearbeiten mit Avatar-Farbe, Kürzel und (im Vereinsmodus) **Profilfoto**
- **Mannschaften** als Liga-, Pokal- oder Freundschafts­mannschaft — mit Kader, Kapitän und bis zu 2 Ersatzkapitänen
- **Benutzerkonten** mit Rolle, optionaler Verknüpfung zu einem Spielerprofil, aktiv/inaktiv-Schalter
- **Vereinsidentität:** Vereinsname und Logo (wird automatisch verkleinert), Logo-Größe auf der Anmeldeseite
- **Rechtstexte** (Impressum & Datenschutz) — auf der Login-Seite ohne Anmeldung erreichbar
- **Schnellanlage** von Spieler / Benutzer / Mannschaft / Wettbewerb / Termin direkt aus dem Admin-Dashboard

### 🏆 Ligen & Wettbewerbe
- **Ligen, Pokale und Freundschaftsspiele** als getrennte Wettbewerbe
- **Spielformat-Vorlagen** (Bezirks-/Bayernliga, Landesliga) oder frei konfigurierbare Blockfolge
- **Automatische Tabelle** (Sp/S/U/N/Differenz/Punkte), eigene Mannschaft hervorgehoben
- **Begegnungen** mit Datum, Uhrzeit, Ort und Ergebnis
- **Aufstellung pro Spieltag:** Einzel/Doppel frei anordnen, Spieler zuordnen, **Boards zuweisen**, Ersatzliste, „An die Boards senden"
- **Spielbericht** Brett für Brett, mit **Highlights** (180er, Short Legs, High Finish)
- **Spielplan-Import (CSV):** erkennt das BDV-Exportformat, legt Tabelle, Begegnungen und Kalender-Termine an — **wiederholbar ohne Duplikate**
- **nuLiga-Import:** Tabelle & Spieltage direkt aus einer **nuLiga-Gruppen-URL** übernehmen (serverseitiger Abruf, nur Admin) und in die bestehende Liga einpflegen — eigene Heim-Ergebnisse bleiben maßgeblich (Abweichungen werden als **Konflikt** markiert, nie überschrieben), Auswärts-/Fremdergebnisse kommen aus nuLiga; die Tabelle rechnet die App selbst

### 🖥️ Board-Betrieb & Kiosk-Modus (nur im Vereinsmodus)

Macht aus einem PC am Board einen **selbstständigen Spiel-Rechner** — ideal für den Ligaabend:

- **Board-Rechner als Kiosk:** Der Board-PC meldet sich mit einem eigenen, **nummerierten Board-Konto** an — die App läuft dann automatisch **gesperrt** im Kiosk-Modus: nur noch **Spiel · Training · Einstellungen**, kein Zugriff auf die Verwaltung. Entsperren nur per Admin-/Kapitän-Login; nach einem Neustart ist das Board wieder gesperrt.
- **Nächstes Spiel erscheint automatisch:** Wird einem Board in der **Aufstellung** eine Begegnung zugeteilt, blendet es am Board ein **Vollbild-„Nächstes Spiel"** mit der Paarung ein — der Anwurf ist direkt wählbar (wer beginnt · Ausbullen · später). Die Einzel/Doppel laufen **nacheinander** ab, und jedes Ergebnis wird automatisch in den **Spielbericht der Begegnung** zurückgeschrieben.
- **Wann es angezeigt wird:** in einem einstellbaren **Zeitfenster** um den Spieltag (nur Spieltag bis ±3 Tage) — oder sofort per **„Jetzt an die Boards senden"** (bzw. lokal „Jetzt anzeigen").
- **Gut lesbar aus Distanz:** eigener **Board-Zoom** für große Leseabstände am Monitor.
- **Geräte per QR hinzufügen:** Ein QR-Code zeigt die **Server-Adresse** — Tablet/Handy scannt ihn, der Board-PC legt sie als Kiosk-Lesezeichen an; danach meldet man sich am Gerät mit dem jeweiligen **Board-Konto** an.
- **Board-Kiosk-Autostart:** Fertige Skripte (`board-kiosk-chrome` / `board-kiosk-firefox`, Windows & Linux) öffnen die App beim Anmelden automatisch im **Vollbild-Kiosk**. Da **Board-Konten über Neustarts angemeldet bleiben** (andere Konten nicht), gilt: **einschalten → sofort spielbereit**.

### 📲 Handy-Fernbedienung & Zuschauer-TV (nur im Vereinsmodus)

- **Handy als Fernbedienung:** Ein Smartphone per **QR-Code** (oder manuellem Code) an ein Board koppeln und von dort **Score-Eingabe und Navigation** übernehmen — inklusive **Startmenü** (Spieler aus dem Kader + Spielmodus wählen und **Spiel starten**), Anwurf-Wahl (wer beginnt · Ausbullen) und **Finish-Dart-Abfrage** am Handy. Genau ein „Anschreiber" pro Board; die Übernahme durch ein anderes Handy muss bestätigt werden.
- **Login-freier Zuschauer-TV:** ein geheimer Link (`#/watch/<token>`) zeigt das laufende Spiel auf einem Bildschirm im Nebenraum — mehrere Boards als Kachel-Übersicht, sonst Vollbild. Zeigt nur **Boardname + Spielstand**, vereinsweit ein-/ausschaltbar (**Standard aus** im Internet-Betrieb), Link rotierbar.

### 📅 Kalender
- Monatsansicht mit farbigen Termintypen (Training, Ligaspiel, Verein, Pokal, Freundschaft, Sonstiges)
- Termine anlegen/bearbeiten, automatische Ligaspiel-Termine aus dem Spielplan-Import, nach Saison gefiltert

### 📊 Statistiken
- **Bestenliste** aller Spieler (Ø 3-Dart, First 9, 60+/100+/140+/180, Short Legs, Checkout-Quote, High Finish) — **als CSV exportierbar**
- **Spieler-Detailseite** mit Rekorden, Siegquote, Scoring-Verlauf; umschaltbar zwischen allen Saisons und einzelner Saison

### 🔄 Saison-Verwaltung
- Genau **eine aktive Saison** plus lesbares Archiv früherer Saisons
- **Saison abschließen:** friert Tabelle & Statistik als Schnappschuss ein, lädt eine Sicherung herunter, legt die Folgesaison an
- **Vorsaison übernehmen** (Mannschaften/Ligen ohne Ergebnisse klonen) und **Saison auslagern** (Platz sparen, Statistik läuft aus dem Schnappschuss weiter)

### 🔐 Benutzer, Rollen & Sicherheit
- **Fünf Rollen mit abgestuften Rechten:** Administrator · Kapitän · Spieler · Betrachter (nur lesen) · Board-Rechner (Maschinen­konto, darf nur spielen)
- **Zwei-Faktor-Anmeldung (2FA/TOTP)** zum Selbst-Einrichten — QR-Code, Backup-Codes, Admin-Reset
- **Login** per E-Mail + Passwort (optional mit 2FA-Code); eigenes Passwort änderbar, inaktive Konten werden abgewiesen

### 💻 Betriebsmodi & Technik
- **Zweisprachige Oberfläche:** Deutsch/Englisch, pro Gerät umschaltbar unter Einstellungen → Darstellung
- **Darstellung:** Hell/Dunkel, Akzentfarben, 5 Schriftarten, viele Größenregler, Befehls-Palette (Strg+K), konfigurierbare Tastenkürzel
- **Progressive Web App (PWA):** installierbar und **offline lauffähig**, Update-Hinweis ohne Zwangs-Neustart
- **Backup:** Voll-Export/-Import aller Daten als JSON; im lokalen Betrieb zusätzlich automatisches tägliches Backup

---

## Betriebsmodi

DartsZentrale kann auf zwei Arten laufen. Beim ersten Start wählst du aus:

| | **Lokal** (ein Board) | **Verein** (Netzwerk/Server) |
|---|---|---|
| **Für wen?** | Ein einzelner PC/Tablet am Board | Ganzer Verein, mehrere Geräte |
| **Anmeldung?** | Nein | Ja, mit Benutzer & Rollen |
| **Daten liegen …** | im Browser des Geräts | in einer zentralen Datenbank (PocketBase) |
| **Gemeinsam nutzen?** | Nein | Ja — alle Geräte sehen dieselben Daten, live |
| **Enthält** | Counter, Training, Spieler, Statistik | zusätzlich Ligen, Mannschaften, Kalender, Benutzer, Saisons |

Mehr dazu in [`WORKFLOWS.md`](WORKFLOWS.md) (Abläufe der beiden Modi).

---

## Loslegen — welche Anleitung passt zu mir?

Such dir das Szenario aus, das zu deinem Verein passt:

| Ich will … | Anleitung |
|---|---|
| **Nur ein Board** auf einem PC betreiben (ohne Server) | [`docs/de/anleitung-lokal-linux.md`](docs/de/anleitung-lokal-linux.md) · [`docs/de/anleitung-lokal-windows.md`](docs/de/anleitung-lokal-windows.md) |
| **Im Vereinsheim/LAN** für mehrere Geräte (ein Rechner als Server) | [`docs/de/admin-anleitung-lan-linux.md`](docs/de/admin-anleitung-lan-linux.md) · [`docs/de/admin-anleitung-lan-windows.md`](docs/de/admin-anleitung-lan-windows.md) |
| **Im Internet** mit eigener Domain & HTTPS betreiben | [`docs/de/admin-anleitung-cloud.md`](docs/de/admin-anleitung-cloud.md) + [`docs/de/go-live-checkliste-cloud.md`](docs/de/go-live-checkliste-cloud.md) |
| Im **Homelab mit Docker/Arcane** laufen lassen | [`docs/de/arcane-homelab-anleitung.md`](docs/de/arcane-homelab-anleitung.md) |
| Die App im Alltag **bedienen** (als Vereins-Admin) | [`docs/de/handbuch.md`](docs/de/handbuch.md) |

---

## Mitmachen

Rückmeldungen, Fehlerberichte, Verbesserungs­ideen und Pull Requests sind herzlich willkommen —
gerade weil das Projekt aus dem Verein und nicht aus dem Entwicklerbüro kommt. Bitte hab Verständnis,
dass ich bei sehr tiefgehenden Code-Themen nur begrenzt reagieren kann.

Details zum Mitmachen (Entwicklungsumgebung, Ablauf, Commit-Stil) stehen in
[`CONTRIBUTING.md`](CONTRIBUTING.md).

---

## Für Entwickler & Mitwirkende

> Dieser Abschnitt richtet sich an alle, die in den Code oder die Projektablage schauen möchten.
> **Für den reinen Vereinsbetrieb brauchst du ihn nicht** — dafür genügen der Download oben und die
> Anleitung unter [„Loslegen"](#loslegen--welche-anleitung-passt-zu-mir).

**App lokal starten:** `cd app && npm install && npm run dev` (öffnet `http://localhost:5173`).
Technische Details zum Frontend stehen in [`app/README.md`](app/README.md).

**Skripte & Werkzeuge:** Die Start-/Update-/Autostart-/Einrichten-Skripte liegen im Ordner
[`scripts/`](scripts/) — dort ist jedes einzeln erklärt (in den heruntergeladenen Paketen liegen sie
flach im Hauptordner). Datenbank- und Wartungswerkzeuge (Passwort-/2FA-Reset, Saison-Export/-Import,
Board-Konto anlegen, Demo-Daten) sowie Schema, Hooks und die Docker-Dateien liegen unter
[`pocketbase/`](pocketbase/).

### Projektstruktur — was liegt wo?

```
dartszentrale/
├─ app/            → Die App selbst (Benutzeroberfläche). Quellcode in app/src/
├─ pocketbase/     → Backend: Datenbank, Login/Rollen, Server-Logik, Wartungs-Skripte, Docker
├─ scripts/        → Start-/Update-/Autostart-/Einrichten-Skripte (im Paket flach im Hauptordner)
├─ docs/           → Alle Anleitungen und Pläne — Englisch in docs/, Deutsch in docs/de/ (Tabelle unten)
├─ tools/          → Kleine Helfer (z. B. Spielplan aus PDF einlesen)
├─ screenshots/    → Bildschirmfotos für dieses README
├─ spikes/         → Experimentierecke für neue Ideen (noch nicht im Einsatz)
└─ backup/ updates/→ Ablage für Sicherungen bzw. Update-Pakete
```

**Wichtige Dateien im Hauptordner:**

| Datei | Zweck |
|---|---|
| [`LICENSE`](LICENSE) | Die MIT-Lizenz (frei nutzbar). |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) · [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) · [`CHANGELOG.md`](CHANGELOG.md) | Mitmachen, Verhaltensregeln, Änderungsverlauf. |
| [`SECURITY.md`](SECURITY.md) | Sicherheitslücken vertraulich melden. |
| [`WORKFLOWS.md`](WORKFLOWS.md) | Praktische Abläufe der beiden Betriebsmodi (Lokal vs. Verein). |
| [`ROADMAP.md`](ROADMAP.md) · [`BUGS.md`](BUGS.md) | Geplante Verbesserungen bzw. bekannte Fehler. |
| [`DATA_MODEL.md`](DATA_MODEL.md) | Datenmodell (historisch; maßgeblich ist heute `pocketbase/SCHEMA.md`). |
| [`Caddyfile.example`](Caddyfile.example) | Beispiel-Konfiguration für HTTPS im Cloud-Betrieb. |

**Dokumentation im Ordner [`docs/`](docs/)** — Anleitungen auf Englisch direkt in `docs/`, die deutschen Fassungen in [`docs/de/`](docs/de/):

| Deutsch (`docs/de/`) | Englisch (`docs/`) | Inhalt |
|---|---|---|
| `handbuch.md` | `manual.md` | Benutzerhandbuch für den Alltag |
| `anleitung-lokal-linux.md` · `-windows.md` · `lokaler-betrieb.md` | `guide-local-linux.md` · `-windows.md` · `local-operation.md` | Ein-Board-Betrieb einrichten |
| `admin-anleitung-lan-linux.md` · `-windows.md` | `admin-guide-lan-linux.md` · `-windows.md` | Vereinsmodus im Netzwerk einrichten |
| `admin-anleitung-cloud.md` · `go-live-checkliste-cloud.md` | `admin-guide-cloud.md` · `go-live-checklist-cloud.md` | Betrieb im Internet + Start-Checkliste |
| `arcane-homelab-anleitung.md` | `arcane-homelab-guide.md` | Betrieb im Homelab mit Docker/Arcane |
| — | `security-audit.md` · `plan-*.md` | Sicherheitsstand · Konzepte & Pläne (nur eine Fassung) |
| — | [`pocketbase/SCHEMA.md`](pocketbase/SCHEMA.md) | **Maßgebliche** Beschreibung der Datenstruktur & Rechte |

---

## Lizenz

[MIT](LICENSE) — frei nutzbar, ohne Gewähr. Nutzung auf eigenes Risiko.
