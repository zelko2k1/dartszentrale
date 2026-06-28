# DartsHub – Admin-Anleitung: Inbetriebnahme & Updates

Diese Anleitung zeigt **ohne Vorkenntnisse**, wie du die App zum Laufen bringst und aktuell hältst —
**lokal** (ein Gerät), im **Vereinsmodus** (mehrere Geräte) und beim **Update**. Ohne Beispieldaten.

> **Welcher Weg ist meiner?**
> - **Nur ein Brett/Gerät, schnell zählen, keine Anmeldung** → **Abschnitt 1 (Lokaler Modus)**. Am einfachsten.
> - **Mehrere Geräte, echte Logins, Ligen/Mannschaften** → **Abschnitt 2 (Vereinsmodus)**. Etwas mehr Aufwand.
>
> Tägliche Bedienung der App: [`handbuch.md`](handbuch.md) · Online/Cloud betreiben: [`cloud-anleitung.md`](cloud-anleitung.md).

---

## 0. Einmal vorweg (gilt für alle Wege)

### 0a. Die App auf den Rechner holen — der „Projektordner"

Du brauchst die Programmdateien als Ordner auf dem Rechner. Du bekommst sie **per USB-Stick** (vom
Einrichter) oder per `git` (für Fortgeschrittene). Wichtig ist nur das Ergebnis:

> **Projektordner** = der Ordner, in dem **`app`** und **`pocketbase`** direkt nebeneinander liegen.
> Alle Befehle und Skripte in dieser Anleitung gehören in **diesen** Ordner.

### 0b. Node.js installieren (Pflicht)

Node.js ist das Programm, das DartsHub ausführt.
1. [nodejs.org](https://nodejs.org) öffnen → die **LTS**-Version herunterladen → Installer starten → einfach **Weiter / Weiter / Fertig**.
2. **Erfolg prüfen:** ein Terminal öffnen (0c) und `node -v` eintippen → es muss eine Zahl wie `v20…` oder `v22…` erscheinen. Erscheint ein Fehler, ist Node nicht installiert.

### 0c. Ein „Terminal" im Projektordner öffnen

Das Terminal ist ein Fenster, in das du die Befehle tippst.
- **Windows:** Projektordner im Explorer öffnen → oben in die **Adressleiste** klicken, `cmd` tippen, **Enter**.
  (Alternativ: Rechtsklick im Ordner → „Im Terminal öffnen".)
- **Linux / Raspberry Pi:** Rechtsklick im Projektordner → **„Im Terminal öffnen"**.

Bleibt das Fenster bei einem Befehl „hängen" und läuft weiter (z. B. ein Server) — **das ist gewollt,
einfach offen lassen**. Schließen beendet das Programm. Für einen neuen Befehl ein **zweites** Terminal öffnen.

### 0d. Platzhalter in den Befehlen

Steht in einem Befehl etwas in **spitzen Klammern** wie `<starkes-pw>` oder `<server-ip>`, ersetzt du
das durch deinen eigenen Wert — **die Klammern `< >` lässt du weg**.
- **Server-IP herausfinden:** Windows → `ipconfig` (Zeile „IPv4-Adresse", z. B. `192.168.1.50`).
  Linux → `hostname -I` (erste Zahl). Auf demselben Gerät kannst du auch `127.0.0.1` nehmen.

---

## 1. Lokaler Modus (ein Gerät, kein Server)

**Der einfache Weg:**
- **Windows:** Doppelklick auf **`start-dartshub.bat`** im Projektordner.
- **Linux / Pi:** im Terminal `./start-dartshub.sh`.

Es öffnet sich der Browser mit der App. **Beim ersten Start** fragt sie nach dem Modus → **„Lokal"** wählen. Fertig.

> Schließt sich das schwarze Fenster **sofort wieder**? Dann fehlt meist **Node.js** (0b).

**Von Hand (falls du es lieber tippst):**
```bash
cd app
npm install      # nur beim ersten Mal, kann ein paar Minuten dauern
npm run dev      # startet die App
```
Danach im Browser **`http://localhost:5173`** öffnen. **Das Terminal-Fenster muss offen bleiben**,
solange du die App nutzt.

---

## 2. Vereinsmodus (mehrere Geräte, Server im eigenen Netz)

Hier laufen **zwei** Programme **gleichzeitig** (also zwei offene Fenster):
**PocketBase** (die Datenbank/das Backend) und das **Frontend** (die eigentliche App).

> **Schnellster Weg, wenn 2a einmal erledigt ist:** das Skript **`start-dartshub.sh`** (Linux) bzw.
> **`start-dartshub.bat`** (Windows) startet **beide** Programme zusammen. Für Autostart beim Hochfahren
> siehe Ende dieses Abschnitts. Die einmalige Einrichtung in **2a** musst du aber zuerst machen.

### 2a. PocketBase einrichten (nur einmal)

**Schritt 1 — PocketBase herunterladen** und in den Ordner **`pocketbase`** legen:
- **Windows:** [diese Seite](https://github.com/pocketbase/pocketbase/releases/tag/v0.39.4) öffnen →
  Datei **`pocketbase_0.39.4_windows_amd64.zip`** laden → per Rechtsklick **„Alle extrahieren"** →
  die Datei **`pocketbase.exe`** in den Ordner `pocketbase` kopieren.
- **Linux / Pi** (im Terminal, im Ordner `pocketbase`; bei Raspberry Pi `amd64` durch `arm64` ersetzen):
  ```bash
  cd pocketbase
  wget https://github.com/pocketbase/pocketbase/releases/download/v0.39.4/pocketbase_0.39.4_linux_amd64.zip
  unzip -o pocketbase_0.39.4_linux_amd64.zip pocketbase && chmod +x pocketbase
  ```

**Schritt 2 — Server-Admin (Superuser) anlegen.** Das ist das Verwalter-Konto der Datenbank
(nicht dein App-Login!). Wähle ein **starkes Passwort** und merke es dir gut.
- **Windows:** `pocketbase.exe superuser upsert admin@deinverein.de "<starkes-pw>" --dir .\pb_data`
- **Linux / Pi:** `./pocketbase superuser upsert admin@deinverein.de "<starkes-pw>" --dir ./pb_data`

**Schritt 3 — PocketBase starten.** Schema und Funktionen entstehen dabei von selbst.
- **Windows:** `pocketbase.exe serve --http=0.0.0.0:8090 --dir .\pb_data --migrationsDir .\pb_migrations --hooksDir .\pb_hooks`
- **Linux / Pi:** `./pocketbase serve --http=0.0.0.0:8090 --dir ./pb_data --migrationsDir ./pb_migrations --hooksDir ./pb_hooks`

> **Erfolg:** im Fenster erscheint „Server started" mit einer Adresse. **Fenster offen lassen!**
> (`0.0.0.0` = von anderen Geräten im Netz erreichbar. Nur dieser eine PC: stattdessen `127.0.0.1`.)
> Beim ersten `0.0.0.0`-Start fragt evtl. die **Windows-Firewall** — **„Zugriff zulassen"**.

**Schritt 4 — deinen App-Admin anlegen** (dein normales Login *in der App*):
1. Im Browser **`http://<server-ip>:8090/_/`** öffnen und mit dem **Superuser** aus Schritt 2 anmelden.
2. Links auf **`users`** klicken → Button **„+ New record"**.
3. Ausfüllen: **email** = deine Login-Mail, **password** = starkes Passwort, Feld **role** = **`admin`**,
   Häkchen bei **active** setzen → **„Create".**

> Das ist alles — **keine** Beispiel-/Seed-Daten nötig.

### 2b. Frontend starten

**Schritt 1 — Server-Adresse hinterlegen.** Lege im Ordner `app` eine Datei **`.env.local`** an. Am
einfachsten per Terminal (ersetzt `<server-ip>`):
- **Windows:** `cd app` &nbsp;dann&nbsp; `echo VITE_PB_URL=http://<server-ip>:8090> .env.local`
- **Linux / Pi:** `cd app` &nbsp;dann&nbsp; `printf 'VITE_PB_URL=http://<server-ip>:8090\n' > .env.local`

**Schritt 2 — bauen und starten:**
```bash
cd app
npm install        # nur beim ersten Mal
npm run build
npm run preview -- --port 4173 --strictPort
```
Dann im Browser **`http://localhost:4173`** öffnen → beim **ersten Start „Vereinsmodus"** wählen →
mit dem **App-Admin** (2a, Schritt 4) anmelden. **Fenster offen lassen.**

> **Bequemer:** Statt Schritt 2 von Hand startet **`start-dartshub.sh`** / **`start-dartshub.bat`**
> PocketBase **und** Frontend zusammen.
> **Autostart beim Hochfahren:** `./autostart-einrichten.sh` (Linux, als Hintergrund-Dienst) bzw.
> `autostart-einrichten.bat` (Windows). Voraussetzung: 2a ist erledigt.

### 2c. Die zwei Logins nicht verwechseln

| | **App-Admin** | **PocketBase-Superuser** |
|---|---|---|
| Wofür? | normale Nutzung der App (Verein verwalten) | Datenbank/Server verwalten |
| Wo anmelden? | in der DartsHub-App (`…:4173`) | unter `…:8090/_/` |
| Wie oft? | täglich | selten (Backups, Notfall) |

---

## 3. Updates einspielen

Eine neue Version sind neue Dateien für `app/`. **Deine Daten (`pb_data`) und deine Konfiguration
bleiben dabei unangetastet.**

**Der einfache Weg (per USB-Stick mit der neuen Version):**
- **Windows:** Doppelklick auf **`update-dartshub.bat`** &nbsp;*(oder in PowerShell `.\update.ps1 -Source E:\`,
  wobei `E:\` dein USB-Laufwerk ist)*.
- **Linux / Pi:** `./update.sh /media/usb` &nbsp;*(`/media/usb` = Pfad deines Sticks)*.

Das Skript übernimmt die neuen Dateien, installiert Abhängigkeiten und baut die App neu.

**Nach jedem Update:**
1. **App neu starten** (Start-Skript erneut ausführen bzw. Terminal-Fenster schließen und neu starten).
2. Lief PocketBase mit und hat sich das Schema geändert: **PocketBase neu starten** (passiert automatisch).
3. An den **Brettern die Seite neu laden** (zur Sicherheit zweimal).

*(Für Fortgeschrittene mit `git`: `git pull` → `cd app && npm install && npm run build` → neu starten.)*

---

## 4. Spickzettel — die wichtigsten Befehle

| Zweck | Befehl |
|---|---|
| **Lokal/Verein starten** | `start-dartshub.bat` (Windows) · `./start-dartshub.sh` (Linux) |
| **Autostart einrichten** | `autostart-einrichten.bat` · `./autostart-einrichten.sh` |
| **Update (USB)** | `update-dartshub.bat` · `./update.sh /media/usb` |
| Lokal von Hand | `cd app && npm run dev` |
| PocketBase-Superuser setzen | `./pocketbase superuser upsert <mail> "<pw>" --dir ./pb_data` |
| PocketBase starten | `./pocketbase serve --http=0.0.0.0:8090 --dir ./pb_data --migrationsDir ./pb_migrations --hooksDir ./pb_hooks` |

**Optional / für später (fortgeschritten):**

| Zweck | Befehl |
|---|---|
| Board-Konto fürs Brett anlegen | `BOARD_EMAIL=board1@deinverein.de BOARD_PW=<pw> PB_URL=http://<ip>:8090 PB_SU_EMAIL=<mail> PB_SU_PASS=<pw> node pocketbase/add-board-account.mjs` |
| App-Passwort zurücksetzen | `USER_EMAIL=<mail> NEW_PW=<min-8> PB_URL=http://<ip>:8090 PB_SU_EMAIL=<mail> PB_SU_PASS=<pw> node pocketbase/reset-password.mjs` |

> Linux-Dienste (nach Autostart): `systemctl --user status dartshub-web dartshub-pocketbase` ·
> Logs ansehen: `journalctl --user -u dartshub-pocketbase -f`

---

## 5. Wenn etwas nicht klappt

- **Schwarzes Fenster geht sofort zu** → meist fehlt **Node.js** (0b) bzw. (im Vereinsmodus) die
  **`pocketbase.exe`** im Ordner `pocketbase`.
- **Browser sagt „nicht erreichbar"** → läuft das passende Fenster noch? (App-Fenster für `…:5173`/`…:4173`,
  PocketBase-Fenster für `…:8090`). Stimmt die Adresse/der Port?
- **Andere Geräte erreichen den Server nicht** → PocketBase mit `0.0.0.0` gestartet? Windows-Firewall
  „Zugriff zulassen"? Stimmt die **Server-IP** in `app/.env.local` (0d)?
- **`.env.local` wirkt nicht** → heißt die Datei wirklich exakt `.env.local` (Windows blendet die
  Endung `.txt` manchmal aus)? Liegt sie im Ordner **`app`**? Danach die App neu bauen/starten.
- **„Port belegt"** → läuft das Programm schon in einem anderen Fenster? Eines schließen.

---

## 6. Notfälle (Passwörter)

- **App-Passwort vergessen** → mit dem **Superuser** zurücksetzen: `…:8090/_/` → `users` → Konto öffnen →
  neues Passwort. *(Oder per `reset-password.mjs`, siehe §4.)*
- **Superuser-Passwort selbst weg** → auf dem Server neu setzen:
  `./pocketbase superuser upsert <mail> "<neues-pw>" --dir ./pb_data`.
- **Vorsorge:** Superuser-Passwort im **Passwortmanager** sichern und früh einen **zweiten App-Admin** anlegen —
  dann sperrt dich kein vergessenes Passwort aus.
