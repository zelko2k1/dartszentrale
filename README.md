# 🎯 DartsZentrale

**Die kostenlose Vereins- und Zähl-App für Darts-Clubs.** Spielstände zählen, Trainings­spiele,
Ligen mit automatischer Tabelle, Mannschaften, Termine, Statistiken und Benutzer­verwaltung —
alles an einem Ort, auf deinem eigenen Gerät oder Server.

Quelloffen ([MIT](LICENSE)) · deutschsprachig · läuft im echten Vereins­betrieb · Version **1.0.0**

## ⬇️ Herunterladen & loslegen

### 👉 **[Fertiges Paket herunterladen (neueste Version)](https://github.com/zelko2k1/dartszentrale/releases/latest)**

Kein Fachwissen nötig: Paket laden, entpacken, Start-Datei doppelklicken. Welches passt zu mir?

| Paket | Für wen? |
|---|---|
| **`01-lokal-ein-board.zip`** | Ein PC/Tablet am Board — nur zählen & trainieren, ohne Server, ohne Anmeldung. **← einfachster Einstieg** |
| **`02-verein-lan.zip`** | Ganzer Verein im eigenen Netzwerk — ein Programm liefert App **und** Datenbank aus. |
| **`03-verein-cloud.zip`** | Betrieb auf einem eigenen Internet-Server mit Domain & HTTPS. |

Die passende Schritt-für-Schritt-Anleitung liegt **im Paket** und weiter unten unter [„Loslegen"](#loslegen--welche-anleitung-passt-zu-mir).

---

## Was ist das hier — in einfachen Worten?

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

| Anmeldung | Dashboard | Darts Counter |
|:--:|:--:|:--:|
| ![Anmeldung](screenshots/01-login.png) | ![Dashboard](screenshots/02-dashboard.png) | ![Darts Counter](screenshots/07-counter.png) |
| **Ligen** | **Mannschaften** | **Spieler** |
| ![Ligen](screenshots/03-ligen.png) | ![Mannschaften](screenshots/04-mannschaften.png) | ![Spieler](screenshots/05-spieler.png) |
| **Benutzer & Rechte** | **Einstellungen** | |
| ![Benutzer](screenshots/06-benutzer.png) | ![Einstellungen](screenshots/08-einstellungen.png) | |

*(Bildschirmfotos aus dem Vereinsmodus, als Administrator angemeldet.)*

---

## Was die App alles kann

### 🎯 Spielen & Zählen (Darts Counter)
- **X01-Spiele** mit Startpunkten 301 / 501 / 701 / 1001
- Auscheck-Modi **Single / Double / Master Out**, Double-In-Hinweis
- Wertung nach **Legs** (Best of 1–11) oder nach **Sätzen**
- **Anwurf** per Ausbullen, Auslosen oder manueller Wahl
- **Gastspieler** (einfach Namen eintippen) und **freies Spiel** (zählt nicht in die Statistik)
- Eingabe per **Tablet-Ziffernfeld oder Tastatur**, frei belegbare Schnell-Scores (F1–F8), Checkout mit 1/2/3 Darts
- **Checkout-Vorschläge** (Finish-Wege bis 170), **Rückgängig**, Bust-Erkennung
- **Live-Werte** je Spieler: Ø 3-Dart, First 9, 180/140+, Checkout-Quote, High Finish
- Zwei Ansichten: **„Große Zahl"** (fernlesbar am Board) oder **„Aufschrieb"** im klassischen Sheet-Stil
- **Revanche** per Klick; fertige Spiele werden automatisch mit allen Einzelwerten gespeichert

### 🏋️ Trainingsspiele (9 Modi, vollständig)
- **Solo:** Doppel-Training, Around the Clock, Bob's 27, 121 Checkout
- **Mehrspieler (bis 8):** Around the Clock, Cricket (mit MPR), Baseball, Halve It, Elimination, Killer
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
- **Board-/Kiosk-Betrieb:** Board-PC meldet sich mit Board-Konto an → gesperrter Kiosk mit reduzierter Bedienung; zugeordnete Begegnung wird automatisch angezeigt; **Geräte per QR-Code hinzufügen**
- **Darstellung:** Hell/Dunkel, Akzentfarben, 5 Schriftarten, viele Größenregler, Befehls-Palette (Strg+K), konfigurierbare Tastenkürzel
- **Progressive Web App (PWA):** installierbar und **offline lauffähig**, Update-Hinweis ohne Zwangs-Neustart
- **Backup:** Voll-Export/-Import aller Daten als JSON; im lokalen Betrieb zusätzlich automatisches tägliches Backup

---

## Die zwei Betriebsmodi

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
| **Nur ein Board** auf einem PC betreiben (ohne Server) | [`docs/anleitung-lokal-linux.md`](docs/anleitung-lokal-linux.md) · [`docs/anleitung-lokal-windows.md`](docs/anleitung-lokal-windows.md) |
| **Im Vereinsheim/LAN** für mehrere Geräte (ein Rechner als Server) | [`docs/admin-anleitung-lan-linux.md`](docs/admin-anleitung-lan-linux.md) · [`docs/admin-anleitung-lan-windows.md`](docs/admin-anleitung-lan-windows.md) |
| **Im Internet** mit eigener Domain & HTTPS betreiben | [`docs/admin-anleitung-cloud.md`](docs/admin-anleitung-cloud.md) + [`docs/go-live-checkliste-cloud.md`](docs/go-live-checkliste-cloud.md) |
| Im **Homelab mit Docker/Arcane** laufen lassen | [`docs/arcane-homelab-anleitung.md`](docs/arcane-homelab-anleitung.md) |
| Die App im Alltag **bedienen** (als Vereins-Admin) | [`docs/handbuch.md`](docs/handbuch.md) |

> **Für Entwickler:** App lokal starten mit `cd app && npm install && npm run dev` (öffnet
> `http://localhost:5173`). Details in [`app/README.md`](app/README.md).

---

## Die Skripte — was macht welches?

Damit du nicht raten musst, welche Datei wofür ist. Das **Namensschema** verrät den Einsatzzweck:

- **`…-lokal…`** → ein einzelnes Board auf einem PC (nur die App, keine Anmeldung)
- **`…-verein-lan…`** → Vereinsmodus im eigenen Netzwerk, als „alles-in-einem"-Paket (ein Programm liefert App **und** Datenbank aus)
- **`…-cloud` / `…-server`** → Vereinsmodus auf einem Internet-Server

Pro Aufgabe gibt es meist eine **Linux-Version (`.sh`)** und eine **Windows-Version (`.bat`/`.ps1`)** —
die `.bat` startet dabei oft nur die `.ps1`.

### Einrichten (einmalig)
| Datei | Zweck |
|---|---|
| `einrichten-cloud.sh` | Richtet einen **Internet-Server** komplett ein (Datenbank + App als Hintergrund­dienste + Caddy für HTTPS). Linux, als root. |
| `pocketbase/provision.mjs` | Legt die **Datenbank-Struktur** des Vereinsmodus an. Beliebig oft wiederholbar. |

### Starten
| Datei | Zweck |
|---|---|
| `start-lokal.sh` / `.bat` | Startet **ein Board** unter `http://127.0.0.1:4173` — ohne Server, ohne Anmeldung. |
| `start-verein-lan.sh` / `.ps1` / `.bat` | Startet den **Vereinsmodus im LAN** (ein Programm für App + Datenbank), legt beim Erststart die Admin-Konten an. |

### Aktualisieren
| Datei | Zweck |
|---|---|
| `update-lokal.sh` / `.bat` | Spielt eine **neue App-Version** für ein Board ein (von USB-Stick/Ordner). |
| `update-verein-lan.sh` / `.ps1` / `.bat` | Tauscht im LAN-Betrieb **nur die App** aus; die Daten bleiben, die alte Version wird gesichert. |
| `update-server.sh` | Aktualisiert einen **Internet-/Pi-Server** (App + Datenbank) von Stick/Ordner. |

### Automatisch beim Hochfahren starten (Autostart)
| Datei | Zweck |
|---|---|
| `autostart-lokal.sh` / `.bat` | Board startet **beim Einschalten** automatisch (ideal für einen Kiosk-PC). |
| `autostart-verein-lan.sh` / `.bat` | LAN-Server startet **beim Einschalten** automatisch. |

### Wartung & Notfälle (Datenbank-Werkzeuge, brauchen Node.js)
| Datei | Zweck |
|---|---|
| `pocketbase/reset-password.mjs` | **Passwort zurücksetzen**, wenn ein Admin ausgesperrt ist. |
| `pocketbase/reset-2fa.mjs` | **2-Faktor entfernen**, wenn Authenticator *und* Backup-Codes weg sind. |
| `pocketbase/add-board-account.mjs` | Legt ein **Board-Rechner-Konto** (Kiosk-PC) an. |
| `pocketbase/season-export.mjs` | **Saison sichern** (als JSON-Datei). |
| `pocketbase/season-import.mjs` | Eine gesicherte **Saison zurückspielen**. |
| `pocketbase/season-offload.mjs` | Eine archivierte **Saison auslagern** (Platz sparen) — vorher sichern! |
| `tools/pdf2schedule.mjs` | Wandelt einen **Spielplan aus einer PDF** in importierbare Daten um. |

### Nur zum Testen (nicht gegen echte Daten laufen lassen!)
| Datei | Zweck |
|---|---|
| `pocketbase/demo-seed.mjs` | Erzeugt eine **komplette Demo-Datenbank** („Dartverein Demo") zum Ausprobieren. |
| `pocketbase/seed-remote.sh` | Spielt Testdaten gegen eine entfernte Test-Datenbank ein. |
| `pocketbase/_security-guard.mjs` | Interner Schutz: verhindert, dass Standard-Passwörter versehentlich gegen einen echten Server laufen. |

### Für den Docker-Betrieb
| Datei | Zweck |
|---|---|
| `pocketbase/Dockerfile` · `pocketbase/docker-compose.yaml` | Baut & startet die **Datenbank** als Container. |
| `app/Dockerfile` · `app/docker-compose.yaml` · `app/nginx.conf` | Baut & startet die **App** als Container. |
| `app/serve-dist.mjs` | Kleiner, mitgelieferter Server, der die fertige App ausliefert (nutzen die Start-Skripte intern). |

---

## Projektstruktur — was liegt wo?

```
dartszentrale/
├─ app/            → Die App selbst (Benutzeroberfläche). Quellcode in app/src/
├─ pocketbase/     → Das Backend: Datenbank, Login/Rollen, Server-Logik, Wartungs-Skripte
├─ docs/           → Alle Anleitungen und Pläne (siehe Tabelle unten)
├─ screenshots/    → Bildschirmfotos für dieses README
├─ tools/          → Kleine Helfer (z. B. Spielplan aus PDF einlesen)
├─ spikes/         → Experimentierecke für neue Ideen (noch nicht im Einsatz)
├─ backup/ updates/→ Ablage für Sicherungen bzw. Update-Pakete
└─ (Start-/Update-/Autostart-Skripte, siehe oben)
```

**Wichtige Dateien im Hauptordner:**

| Datei | Zweck |
|---|---|
| [`README.md`](README.md) | Dieses Dokument. |
| [`LICENSE`](LICENSE) | Die MIT-Lizenz (frei nutzbar). |
| [`WORKFLOWS.md`](WORKFLOWS.md) | Praktische Abläufe der beiden Betriebsmodi (Lokal vs. Verein). |
| [`ROADMAP.md`](ROADMAP.md) | Überblick über offene Punkte und geplante Verbesserungen. |
| [`BUGS.md`](BUGS.md) | Sammelstelle für bekannte Fehler und Testfunde. |
| [`DATA_MODEL.md`](DATA_MODEL.md) | Beschreibung des Datenmodells (historisch; maßgeblich ist heute `pocketbase/SCHEMA.md`). |
| [`Caddyfile.example`](Caddyfile.example) | Beispiel-Konfiguration für HTTPS im Cloud-Betrieb. |

**Dokumentation im Ordner [`docs/`](docs/):**

| Datei | Inhalt |
|---|---|
| `handbuch.md` | Benutzerhandbuch für den Alltag |
| `anleitung-lokal-linux.md` · `anleitung-lokal-windows.md` | Ein-Board-Betrieb einrichten |
| `lokaler-betrieb.md` (+ `.pdf`) | Ausführliche Doku zum lokalen Betrieb |
| `admin-anleitung-lan-linux.md` · `admin-anleitung-lan-windows.md` | Vereinsmodus im Netzwerk einrichten |
| `admin-anleitung-cloud.md` · `go-live-checkliste-cloud.md` | Betrieb im Internet + Start-Checkliste |
| `arcane-homelab-anleitung.md` | Betrieb im Homelab mit Docker/Arcane |
| `security-audit.md` | Sicherheits­stand und Härtungs­maßnahmen |
| `verein-pocketbase-plan.md` · `plan-saison.md` · `plan-2fa.md` · `plan-nuliga-import.md` · `plan-autodarts-autoscore.md` · `autodarts-api.md` | Konzepte & Pläne (umgesetzt bzw. geplant) |
| [`pocketbase/SCHEMA.md`](pocketbase/SCHEMA.md) | **Maßgebliche** Beschreibung der Datenstruktur & Rechte |

---

## ☕ Unterstützen

DartsZentrale ist kostenlos und quelloffen ([MIT](LICENSE)) — und bleibt es. Die Entwicklung läuft
KI-gestützt und verursacht laufende Kosten (KI-Nutzung, Hosting). Wer mag, spendiert einen Kaffee:
**[buymeacoffee.com/zelko2k1](https://buymeacoffee.com/zelko2k1)**. Kein Muss — alles bleibt frei nutzbar.

## Mitmachen

Rückmeldungen, Fehlerberichte, Verbesserungs­ideen und Pull Requests sind herzlich willkommen —
gerade weil das Projekt aus dem Verein und nicht aus dem Entwicklerbüro kommt. Bitte hab Verständnis,
dass ich bei sehr tiefgehenden Code-Themen nur begrenzt reagieren kann.

## Lizenz

[MIT](LICENSE) — frei nutzbar, ohne Gewähr. Nutzung auf eigenes Risiko.
