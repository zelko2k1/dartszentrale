# DartsHub auf Linux / Raspberry Pi – Inbetriebnahme & Updates

Schritt für Schritt für **Linux und Raspberry Pi**, ohne Vorkenntnisse. (Windows? →
[admin-anleitung-windows.md](admin-anleitung-windows.md).)

> **Welcher Weg ist meiner?**
> - **Nur ein Brett/Gerät, schnell zählen, keine Anmeldung** → **Abschnitt 1**. Am einfachsten.
> - **Mehrere Geräte, echte Logins, Ligen/Mannschaften** → **Abschnitt 2**.
> - **Server im Internet/Cloud** (von überall erreichbar) → eigenes **Cloud-Paket** (`03-cloud-vereinsmodus`).
>
> Tägliche Bedienung: [`handbuch.md`](handbuch.md).

---

## 0. Einmal vorweg

### 0a. Die App auf den Rechner holen — der „Projektordner"
Du brauchst die Programmdateien als Ordner. Du bekommst sie **per USB-Stick** (vom Einrichter) oder per `git`.

> **Projektordner** = der Ordner, in dem **`app`** und **`pocketbase`** direkt nebeneinander liegen.
> Alle Befehle und Skripte gehören in **diesen** Ordner.

### 0b. Node.js installieren (Pflicht)
Node.js 20+ installieren (z. B. auf Ubuntu/Debian/Raspberry Pi OS):
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git unzip
```
**Erfolg prüfen:** `node -v` → es muss `v20…`/`v22…` erscheinen.

### 0c. Ein „Terminal" im Projektordner öffnen
Im Dateimanager den Projektordner öffnen → **Rechtsklick → „Im Terminal öffnen"**. Da tippst du die Befehle rein.

> Läuft ein Befehl „endlos" weiter (z. B. ein Server), ist das **gewollt** — Fenster **offen lassen**.
> Für einen weiteren Befehl ein **zweites** Terminal öffnen.

### 0d. Platzhalter in Befehlen
Steht etwas in **spitzen Klammern** wie `<starkes-pw>` oder `<server-ip>`, ersetzt du es durch deinen
Wert — **die Klammern `< >` weglassen.**
- **Server-IP finden:** `hostname -I` (erste Zahl, z. B. `192.168.1.50`). Auf demselben Gerät geht auch `127.0.0.1`.

---

## 1. Lokaler Modus (ein Gerät, kein Server)

**Einfach** (im Terminal im Projektordner):
```bash
./start-lokal.sh
```
Der Browser öffnet die App → beim **ersten Start „Lokal"** wählen. Fertig. (Kein Server, kein
PocketBase — die Daten liegen im Browser.)

> Bricht es mit einem Fehler ab? Dann fehlt meist **Node.js** (0b).
> **Kiosk-Board, das beim Hochfahren von selbst startet:** `./autostart-lokal.sh`.

**Von Hand:**
```bash
cd app
npm install
npm run dev
```
Dann im Browser **`http://localhost:5173`** öffnen. **Terminal-Fenster offen lassen.**

---

## 2. Vereinsmodus (mehrere Geräte, Server im eigenen Netz)

Hier laufen **zwei** Programme gleichzeitig: **PocketBase** (Datenbank) und das **Frontend** (die App).

### 2 — Empfohlen: geführte Einrichtung (ein Befehl)

```bash
./einrichten-lan.sh
```
Das Skript **fragt das Nötige ab** (LAN-Zugriff/Server-IP, Superuser-Login, erster App-Admin) und macht
dann **alles** in einem Rutsch: PocketBase **automatisch herunterladen**, App bauen, beide als
Autostart-Dienst einrichten, Schema + ersten Admin anlegen. Danach läuft alles — die App ist im Netz
unter **`http://<server-ip>:4173`** erreichbar.

> Voraussetzung: nur **Node.js** (0b). Die PocketBase-Binärdatei lädt das Skript selbst herunter.
> Update später: **`./update-server.sh <quelle>`** — baut neu **und startet die Dienste automatisch neu**.

Wer lieber jeden Schritt selbst kontrolliert, folgt **2a + 2b von Hand**:

### 2a. PocketBase von Hand einrichten (nur einmal)

**Schritt 1 — herunterladen** (im Ordner `pocketbase`; **Raspberry Pi:** `amd64` durch `arm64` ersetzen):
```bash
cd pocketbase
wget https://github.com/pocketbase/pocketbase/releases/download/v0.39.5/pocketbase_0.39.5_linux_amd64.zip
unzip -o pocketbase_0.39.5_linux_amd64.zip pocketbase && chmod +x pocketbase
```

**Schritt 2 — Server-Admin (Superuser) anlegen** (Verwalter der Datenbank, *nicht* dein App-Login;
starkes Passwort merken):
```bash
./pocketbase superuser upsert admin@deinverein.de "<starkes-pw>" --dir ./pb_data
```

**Schritt 3 — PocketBase starten** (Schema/Funktionen entstehen automatisch):
```bash
./pocketbase serve --automigrate=0 --http=0.0.0.0:8090 --dir ./pb_data --migrationsDir ./pb_migrations --hooksDir ./pb_hooks
```
> **Erfolg:** „Server started" erscheint. **Fenster offen lassen!**
> (`0.0.0.0` = von anderen Geräten im Netz erreichbar; nur dieses Gerät: `127.0.0.1`.)

**Schritt 4 — deinen App-Admin anlegen** (dein Login *in der App*):
1. Browser → **`http://<server-ip>:8090/_/`** → mit dem Superuser aus Schritt 2 anmelden.
2. Links auf **`users`** → **„+ New record"**.
3. **email** = Login-Mail, **password** = starkes Passwort, **role** = **`admin`**, Häkchen bei
   **active** → **„Create".** *(Keine Beispieldaten nötig.)*

### 2b. Frontend starten

**Schritt 1 — Server-Adresse hinterlegen** (Datei `app/.env.local`; `<server-ip>` ersetzen):
```bash
cd app
printf 'VITE_PB_URL=http://<server-ip>:8090\n' > .env.local
```

**Schritt 2 — bauen & starten:**
```bash
cd app
npm install
npm run build
npm run serve                       # liefert das gebaute dist/ aus → http://localhost:4173
```
> Sollen **andere Geräte im LAN** dieses Frontend erreichen (statt je Gerät ein eigenes):
> `HOST=0.0.0.0 npm run serve` — dann über `http://<server-ip>:4173`.

Browser → **`http://localhost:4173`** → beim **ersten Start „Vereinsmodus"** wählen → mit dem
**App-Admin** (2a, Schritt 4) anmelden. **Fenster offen lassen.**

> **Bequemer:** `./start-lan.sh` startet PocketBase **und** Frontend zusammen.
> **Autostart beim Hochfahren:** `./autostart-lan.sh` (richtet systemd-Dienste ein; Voraussetzung: 2a erledigt).

### 2c. Die zwei Logins nicht verwechseln

| | **App-Admin** | **PocketBase-Superuser** |
|---|---|---|
| Wofür? | normale Nutzung (Verein verwalten) | Datenbank/Server verwalten |
| Wo anmelden? | in der App (`…:4173`) | unter `…:8090/_/` |
| Wie oft? | täglich | selten (Backups, Notfall) |

---

## 3. Updates einspielen

Eine neue Version sind neue Dateien für `app/`. **Deine Daten (`pb_data`) und Konfiguration bleiben
unangetastet.**

### 3a. Einfachster Weg — direkt in der App (nur Frontend)

Für reine App-Updates (kein PocketBase-Wechsel) — ohne Terminal, ohne Dienst-Neustart:

1. Die Datei **`dartshub-update-<version>.tar.gz`** in den Ordner **`updates/`** der Installation legen
   (genauer Pfad steht in der App unter *Einstellungen → App & Updates*).
2. In der App: **Einstellungen → „App & Updates" → „Nach Updates suchen"** → **„Installieren"**.

- **Direkt am Board** (localhost): ohne Token.
- **Von einem anderen Board** (über die Server-IP): einmalig den **Update-Token** eintragen, den
  `./einrichten-lan.sh` am Ende angezeigt hat (steht auch in `.update-token` im Projektordner).

> Für Updates, die auch **PocketBase** betreffen, weiter mit dem Skript (3b).

### 3b. Per Skript (USB/Ordner, auch PocketBase)

> **Lokales Paket (ein Board):** dort heißt das Update-Skript **`./update-lokal.sh`** (Windows:
> `update-lokal.bat`) — gleicher Ablauf, ohne PocketBase. Die folgenden Befehle (`update-server.sh` /
> `update-server.bat`) gelten fürs **Vereins-Paket**.

**Einfach (neue Version per USB-Stick/Ordner):**
```bash
./update-server.sh /media/usb      # /media/usb = Pfad deines Sticks (oder entpackte ZIP)
```
Übernimmt die neuen Dateien, installiert Abhängigkeiten, **baut neu** und **startet die Dienste neu**.

> Wurde der Server per **`./einrichten-lan.sh`** eingerichtet, erkennt `update-server.sh` die Dienste und
> erledigt Build **und** Neustart automatisch — du musst nichts weiter tun.
> Läuft die App noch **von Hand** (ohne Autostart-Dienst)? Dann nach dem Update `./start-lan.sh`
> erneut starten (und ggf. PocketBase).

**Danach:** an den **Brettern die Seite neu laden** (zur Sicherheit zweimal, wegen PWA-Cache).

*(Mit `git`: `git pull` → `./update-server.sh` bzw. `cd app && npm install && npm run build` → neu starten.)*

---

## 4. Spickzettel — wichtigste Befehle

| Zweck | Befehl |
|---|---|
| **Lokal starten** (ein Board) | `./start-lokal.sh` · Autostart: `./autostart-lokal.sh` |
| **Vereinsmodus einrichten (geführt)** | `./einrichten-lan.sh` |
| **Verein von Hand starten/Autostart** | `./start-lan.sh` · `./autostart-lan.sh` |
| **Update (In-App, nur Frontend)** | `dartshub-update-*.tar.gz` in **`updates/`** legen → Einstellungen → „App & Updates" → Installieren |
| **Update (USB/Ordner, auch PocketBase)** | `./update-server.sh /media/usb` |
| Lokal von Hand | `cd app && npm run dev` |
| PocketBase-Superuser setzen | `./pocketbase superuser upsert <mail> "<pw>" --dir ./pb_data` |
| PocketBase starten | `./pocketbase serve --automigrate=0 --http=0.0.0.0:8090 --dir ./pb_data --migrationsDir ./pb_migrations --hooksDir ./pb_hooks` |
| Dienste/Logs (nach Autostart) | `systemctl --user status dartshub-web dartshub-pocketbase` · `journalctl --user -u dartshub-pocketbase -f` |

**Optional / für später (fortgeschritten):**

| Zweck | Befehl (eine Zeile) |
|---|---|
| Board-Konto fürs Brett | `BOARD_EMAIL=board1@deinverein.de BOARD_PW=<pw> PB_URL=http://<ip>:8090 PB_SU_EMAIL=<mail> PB_SU_PASS=<pw> node pocketbase/add-board-account.mjs` |
| App-Passwort zurücksetzen | `USER_EMAIL=<mail> NEW_PW=<min-8> PB_URL=http://<ip>:8090 PB_SU_EMAIL=<mail> PB_SU_PASS=<pw> node pocketbase/reset-password.mjs` |

---

## 5. Wenn etwas nicht klappt

- **Befehl bricht sofort ab** → Node.js fehlt (0b) bzw. (Vereinsmodus) die `pocketbase`-Binärdatei im Ordner `pocketbase` (Schritt 1, `chmod +x` gemacht?).
- **Browser sagt „nicht erreichbar"** → läuft das passende Fenster noch? (App für `…:5173`/`…:4173`,
  PocketBase für `…:8090`.) Stimmen Adresse/Port?
- **Andere Geräte erreichen den Server nicht** → PocketBase mit `0.0.0.0` gestartet? Stimmt die
  **Server-IP** in `app/.env.local` (0d)? Ggf. Firewall (`ufw`) für Port 8090 öffnen.
- **„Port belegt" / `EADDRINUSE`** → das Programm läuft schon. Mit `pkill -f vite` bzw. das andere Fenster schließen.

---

## 6. Notfälle (Passwörter)

- **App-Passwort vergessen** → mit dem **Superuser** zurücksetzen: `…:8090/_/` → `users` → Konto → neues Passwort.
- **Superuser-Passwort weg** → neu setzen: `./pocketbase superuser upsert <mail> "<neues-pw>" --dir ./pb_data`.
- **Vorsorge:** Superuser-Passwort im **Passwortmanager** sichern und früh einen **zweiten App-Admin** anlegen.

---

## Anhang A — Welche Dateien braucht der Betrieb?

**Müssen da sein (Betrieb):**
- `app/` — das **Frontend**. Ohne `node_modules/` und `dist/` (die entstehen beim ersten
  `npm install` / `npm run build`).
- **Nur Vereinsmodus:** `pocketbase/pb_migrations/` + `pocketbase/pb_hooks/` (Schema & Funktionen),
  die selbst geladene **`pocketbase`**-Binärdatei, und `pocketbase/pb_data/` (deine Datenbank —
  entsteht beim Start). Außerdem `app/.env.local` (Server-Adresse).
- Die Start-/Autostart-/Update-Skripte (siehe Tabelle).

**Beim Update austauschen:** das neue `app/src`, `app/public` und die Konfig-Dateien
(`package.json` usw.). **`pb_data` und `app/.env.local` bleiben unangetastet** — `./update-server.sh`
macht genau das.

## Anhang B — Welches Skript wofür?

| Datei | Zweck |
|---|---|
| `./start-lokal.sh` | **Lokal starten** (ein Board, nur Frontend — kein Server) |
| `./autostart-lokal.sh` | **Lokaler Autostart** (nur Frontend, fürs Kiosk-Board) |
| `./update-lokal.sh` | **Lokal-Update** (nur Frontend, kein PocketBase) |
| `./einrichten-lan.sh` | **Geführte Vereinsmodus-Einrichtung** (Download, Build, Dienste, Admin) — empfohlen |
| `./start-lan.sh` | **Verein von Hand starten** (PocketBase **und** Frontend) |
| `./autostart-lan.sh` | **Vereins-Autostart** beim Hochfahren einrichten (systemd) |
| `./update-server.sh` | **Update** einspielen (Daten bleiben, Dienste starten neu) |
| *Vereinsmodus, einmalig/selten (`node …`):* | |
| `pocketbase/provision.mjs` | Schema anlegen/aktualisieren + Admin (Alternative zum Auto-Schema) |
| `pocketbase/add-board-account.mjs` | Board-Konto fürs Brett anlegen |
| `pocketbase/reset-password.mjs` | App-Passwort per Superuser zurücksetzen |
| `pocketbase/season-export\|import\|offload.mjs` | Saison sichern · zurückspielen · auslagern |
| `pocketbase/_security-guard.mjs` | interner Helfer (nicht direkt starten) |
| `pocketbase/demo-*.mjs` | **nur Testdaten — NICHT im Betrieb verwenden** |

> Fertige Verteil-Pakete (genau diese Dateien je Betriebsart, ohne Test-/Secret-Dateien) erzeugt der
> Einrichter mit dem `copy2share`-Vorgang — du bekommst dann einen einzelnen, passenden Ordner.
