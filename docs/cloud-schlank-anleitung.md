# DartsHub schlank in der Cloud — ohne Coolify, ohne Docker

Die **leichteste** Art, den Vereinsmodus online zu betreiben: zwei native systemd-Dienste
plus **Caddy** als HTTPS-Proxy. Kein Coolify (~1 GB Dauerlast gespart), kein Docker.
Läuft auf einem **1–2-GB-Nano** ab ~3–4 €/Monat.

> **Geführt per Skript:** `einrichten-cloud.sh` fragt alles Nötige ab (Domains, Superuser,
> erster App-Admin) und richtet den Server komplett ein. Der **lokale Modus** der App braucht
> von alldem nichts.

## So sieht es aus

```
                Internet (HTTPS, Port 443)
                         │
                    ┌────▼─────┐   Caddy (Auto-HTTPS via Let's Encrypt)
                    │  Caddy   │   80/443 öffentlich
                    └──┬────┬──┘
        app.<domain>   │    │   db.<domain>
                       │    │
        127.0.0.1:4173 │    │ 127.0.0.1:8090   ← beide NUR lokal, nicht öffentlich
              ┌────────▼┐  ┌▼──────────────┐
              │ web svc │  │ pocketbase svc│
              │ node    │  │ (Go-Binary +  │
              │ serve-  │  │  SQLite       │
              │ dist.mjs│  │  pb_data/)    │
              └─────────┘  └───────────────┘
```

- **dartshub-pocketbase.service** — das PocketBase-Binary, lauscht nur auf `127.0.0.1:8090`.
- **dartshub-web.service** — `node serve-dist.mjs` (abhängigkeitsfrei), lauscht nur auf `127.0.0.1:4173`.
- **Caddy** — einziger öffentlicher Dienst, terminiert TLS, routet auf die zwei lokalen Ports.

Beide internen Ports sind **nicht** aus dem Internet erreichbar — so wandert kein Klartext-HTTP am
TLS-Proxy vorbei, ganz ohne extra Firewall-Regel, weil sie gar nicht erst nach außen binden.

---

## Voraussetzungen

| Was | Wofür | Kosten |
|-----|-------|--------|
| **VPS** (Hetzner CAX11 ARM o. 1–2-GB-Nano), **Ubuntu 24.04** | App + DB + Caddy | ~3–5 €/Monat |
| **Domain** + DNS-Zugang | `app.*` und `db.*` + HTTPS | ~12 €/Jahr |
| **Node.js, Caddy, PocketBase** | das Setup-Skript holt/installiert sie | 0 € |

DNS vorab: zwei **A-Records** auf die Server-IP zeigen lassen —
`app.deinedomain.de` und `db.deinedomain.de` (Details unten).

---

## DNS — die A-Records anlegen (wo genau?)

> ⚠️ A-Records trägst du **nicht** im Cloud-Server-Panel ein, sondern dort, wo die
> **DNS-Zone deiner Domain** verwaltet wird. Bei Hetzner sind das zwei verschiedene Produkte.

| Ort | Wann | Was tun |
|---|---|---|
| **Hetzner DNS Console** (`dns.hetzner.com`) | Domain nutzt Hetzners Nameserver | Zone wählen → „Add record" |
| **Domain-Registrar** (Namecheap, INWX, IONOS, Strato …) | Domain liegt nicht bei Hetzner | im DNS-Menü des Anbieters |
| **Hetzner Cloud Console** (`console.hetzner.cloud`) | ❌ **hier NICHT** | nur die **Server-IP** abholen (Server → Public IP) |

**Wo liegt meine DNS-Zone?** Wenn unklar:
```bash
nslookup -type=ns deinedomain.de
```
- Antwort `*.ns.hetzner.com` (hydrogen/oxygen/helium…) → **Hetzner DNS Console**
- etwas anderes → dorthin, wo diese Nameserver gehören (meist der Registrar)

**Die zwei Einträge** (beide auf die **gleiche** Server-IP). Als `Name` nur `app`/`db`
eintragen — die Domain hängt das System automatisch an:

| Type | Name | Value |
|------|------|-------|
| A | `app` | 203.0.113.10 |
| A | `db` | 203.0.113.10 |

> **`app` ist frei wählbar.** Du kannst die Subdomain beliebig benennen, z. B. `dartshub`
> (→ `dartshub.deinedomain.de`). Einzige Regel: **derselbe Name an beiden Stellen** —
> im A-Record (`Name = dartshub`) **und** beim Aufruf (`APP_DOMAIN=dartshub.deinedomain.de`).
> Das Skript backt `VITE_PB_URL=https://<DB_DOMAIN>` automatisch passend ins Frontend; in
> PocketBase dann die CORS-Origin auf `https://<APP_DOMAIN>` setzen. `db` lässt sich genauso
> umbenennen (z. B. `pb`/`backend`) — solange `DB_DOMAIN` mitgezogen wird.

**Danach prüfen** (DNS braucht ein paar Minuten, selten Stunden):
```bash
nslookup app.deinedomain.de
nslookup db.deinedomain.de
```
Beide müssen die Server-IP zurückgeben. **Erst dann** `einrichten-cloud.sh` laufen lassen bzw. Caddy
starten — sonst scheitert die HTTPS-Zertifikatsausstellung, weil Let's Encrypt die Domain
nicht zur IP auflösen kann.

---

## Weg A — automatisch (ein Skript)

Die Dateien auf den Server holen (ZIP entpacken **oder** `git clone …`), in den Ordner wechseln, dann:

```bash
sudo ./einrichten-cloud.sh
```

Das Skript **fragt alles Nötige interaktiv ab** (Domains, optional Let's-Encrypt-Mail, Superuser,
erster App-Admin). Werte lassen sich auch vorab als Env setzen:
`sudo APP_DOMAIN=app.deinedomain.de DB_DOMAIN=db.deinedomain.de ./einrichten-cloud.sh`.

Das Skript ([`einrichten-cloud.sh`](../einrichten-cloud.sh)) ist idempotent und erledigt:

1. **Node.js + Caddy** installieren (falls nicht vorhanden), **PocketBase-Binary** passend zur
   CPU (amd64/arm64) herunterladen.
2. **Frontend bauen** — schreibt `app/.env.local` mit `VITE_PB_URL=https://db.deinedomain.de`
   (wird zur **Build-Zeit** ins Bundle gebacken) und `npm run build`.
3. **Zwei systemd-System-Dienste** schreiben + aktivieren (laufen als dein User, Auto-Restart,
   Logs nach journald).
4. **Caddyfile** schreiben (`app.* → :4173`, `db.* → :8090`) und Caddy neu laden.
5. **Superuser + Schema + ersten App-Admin** anlegen (provision.mjs gegen die laufende PocketBase).

Danach bleiben nur noch:

- **Firewall:** Ports 80 + 443 offen (für Caddy/HTTPS), 8090/4173 **nicht** öffnen.
- **Application URL** in PocketBase setzen: `https://db.deinedomain.de/_/` → Settings →
  *Application URL* = `https://db.deinedomain.de`. (CORS ist via `--origins` bereits gesetzt.)

Fertig: `https://app.deinedomain.de` öffnen → **Vereinsmodus** → mit dem App-Admin anmelden.

---

## Weg B — von Hand (was das Skript tut)

Für alle, die jeden Schritt selbst setzen wollen.

### 1. Pakete + Binärdateien
```bash
# Node.js 22 (LTS)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs unzip

# Caddy (offizielles apt-Repo)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

# PocketBase (bei ARM: linux_arm64)
cd ~/dartshub/pocketbase
wget https://github.com/pocketbase/pocketbase/releases/download/v0.39.5/pocketbase_0.39.5_linux_amd64.zip
unzip -o pocketbase_0.39.5_linux_amd64.zip pocketbase && chmod +x pocketbase
```

### 2. Frontend bauen
```bash
cd ~/dartshub/app
echo 'VITE_PB_URL=https://db.deinedomain.de' > .env.local   # WICHTIG: Build-Zeit!
npm ci && npm run build
```

### 3. Zwei systemd-Dienste anlegen
`/etc/systemd/system/dartshub-pocketbase.service` (Pfade/`<user>` anpassen):
```ini
[Unit]
Description=DartsHub PocketBase
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=<user>
WorkingDirectory=/home/<user>/dartshub/pocketbase
ExecStart=/home/<user>/dartshub/pocketbase/pocketbase serve --automigrate=0 --http=127.0.0.1:8090 --origins=https://app.deinedomain.de --dir=/home/<user>/dartshub/pocketbase/pb_data --migrationsDir=/home/<user>/dartshub/pocketbase/pb_migrations --hooksDir=/home/<user>/dartshub/pocketbase/pb_hooks
Restart=on-failure
RestartSec=3
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```

`/etc/systemd/system/dartshub-web.service`:
```ini
[Unit]
Description=DartsHub Frontend (statischer dist-Server)
After=dartshub-pocketbase.service
Wants=dartshub-pocketbase.service

[Service]
Type=simple
User=<user>
WorkingDirectory=/home/<user>/dartshub/app
Environment=HOST=127.0.0.1
Environment=PORT=4173
ExecStart=/usr/bin/node /home/<user>/dartshub/app/serve-dist.mjs
Restart=on-failure
RestartSec=3
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now dartshub-pocketbase dartshub-web
```

### 4. Caddy konfigurieren
[`Caddyfile.example`](../Caddyfile.example) nach
`/etc/caddy/Caddyfile` kopieren, Domains ersetzen, dann:
```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

### 5. PocketBase einrichten
```bash
cd ~/dartshub/pocketbase
./pocketbase superuser upsert <admin-mail> '<starkes-pw>' --dir ./pb_data
node provision.mjs
```
Dann in `https://db.deinedomain.de/_/` → **Application URL** = `https://db.deinedomain.de` setzen.
(CORS muss **nicht** im UI gesetzt werden — das macht das `--origins`-Flag in der Unit.)

---

## Betrieb

| Aufgabe | Befehl |
|---|---|
| **Status** | `systemctl status dartshub-web dartshub-pocketbase caddy` |
| **Logs live** | `journalctl -u dartshub-pocketbase -f` |
| **App-Update** | neue Dateien einspielen (ZIP/`git pull`) → `./update-server.sh` (baut + startet die Dienste neu) |
| **Schema-Update** | `update-server.sh` zieht es mit; Migrations laufen beim PB-Start ohnehin (bei Bedarf `cd pocketbase && node provision.mjs`) |
| **Backups** | in PocketBase (`/_/` → Settings → Backups) aktivieren; Daten liegen in `pocketbase/pb_data/` |
| **PocketBase-Version pinnen** | feste Version laden statt `:latest`, kontrolliert tauschen |

### Konten & Notfall (Board-Rechner, Passwörter)

Die Ops-Skripte liegen in `pocketbase/` und laufen **auf dem Server** (PocketBase hört dort
lokal auf `127.0.0.1:8090`). `PB_SU_EMAIL`/`PB_SU_PASS` = das beim Setup gewählte Superuser-Konto.

- **Board-/Kiosk-Konto** anlegen (rechtearm — darf nur spielen; **nie** den Admin-Login an die
  Bretter geben):
  ```bash
  cd pocketbase
  BOARD_EMAIL=board1@deinedomain.de BOARD_PW=<starkes-pw> \
  PB_URL=http://127.0.0.1:8090 PB_SU_EMAIL=<su-mail> PB_SU_PASS=<su-pw> \
  node add-board-account.mjs
  ```
- **App-Passwort zurücksetzen** (jemand hat sich ausgesperrt):
  ```bash
  USER_EMAIL=<mail> NEW_PW=<min-8-zeichen> \
  PB_URL=http://127.0.0.1:8090 PB_SU_EMAIL=<su-mail> PB_SU_PASS=<su-pw> \
  node reset-password.mjs
  ```
- **Superuser-Passwort vergessen?** Dienst kurz stoppen, neu setzen, wieder starten:
  ```bash
  sudo systemctl stop dartshub-pocketbase
  ./pocketbase superuser upsert <su-mail> "<neues-pw>" --dir ./pb_data
  sudo systemctl start dartshub-pocketbase
  ```

> Saison sichern / auslagern / zurückspielen: `season-export.mjs` · `season-offload.mjs` ·
> `season-import.mjs` (oder in der App unter Einstellungen → **Saison**).

### Domain ändern

Die Domain steckt technisch an mehreren Stellen (Frontend-Build `VITE_PB_URL`, PocketBase
`--origins`, Caddyfile + CSP). **Nichts davon von Hand anfassen** — einfach `einrichten-cloud.sh` erneut mit
den neuen Domains laufen lassen; es schreibt alle Stellen konsistent neu und baut das Frontend neu:

```bash
sudo APP_DOMAIN=neu.deinedomain.de DB_DOMAIN=db2.deinedomain.de ./einrichten-cloud.sh
```

> `VITE_PB_URL` ist in den Build **gebacken** (Compile-Zeit) → ein Domain-Wechsel erfordert
> ohnehin einen Neu-Build; das erledigt `einrichten-cloud.sh` mit.

Separat (liegt außerhalb des Servers) bleiben nur zwei Schritte:
1. **DNS** für die neue Domain anlegen (A-Records `app`/`db` auf dieselbe Server-IP).
2. In `https://db2.deinedomain.de/_/` die **Application URL** anpassen.

Deine Daten (`pocketbase/pb_data/`) bleiben dabei unberührt.

## Sicherheit (vor dem Online-Gang)

- **Nur 80/443 öffentlich.** 8090/4173 binden bereits nur auf `127.0.0.1` — zusätzlich in der
  Host-Firewall (ufw/Hetzner Cloud Firewall) alles außer 22/80/443 sperren (löst Befund #3).
- **Security-Header** (X-Frame-Options, nosniff, Referrer-/Permissions-Policy, **HSTS**) setzt
  Caddy bereits — das `security_headers`-Snippet steckt im erzeugten Caddyfile (Befund #9/#13).
- **CORS** ist auf die App-Domain eingeschränkt — über `--origins=https://app.<domain>` in der
  PocketBase-Unit (Default wäre `*` = jede Website). `einrichten-cloud.sh` setzt das automatisch.
- **CSP einkommentieren:** im Caddyfile die `Content-Security-Policy`-Zeile aktivieren (das Skript
  füllt `connect-src https://db.<domain>` schon korrekt vor) — **vorher testen**, dass
  Login/API/PWA funktionieren (DevTools-Konsole auf CSP-Fehler prüfen), dann `sudo systemctl reload caddy`.
- **Admin-Konsole `/_/`** abschirmen: in Caddy auf deine IP sperren (`@admin path /_/*` +
  `handle`-Blöcke, Snippet in [`Caddyfile.example`](../Caddyfile.example)) —
  IP via `curl ifconfig.me`. Ohne feste IP: `basic_auth` davor oder VPN/Tailscale. Wichtigster
  Schutz bleibt ein **starkes, einzigartiges Superuser-Passwort**.
- **Keine `demo-*.mjs` gegen die Produktiv-DB** — den App-Admin legt `einrichten-cloud.sh` mit
  deinem starken Passwort an; die `demo-*.mjs` sind nur für lokale Tests.
- **HTTPS ist Pflicht** — erledigt Caddy automatisch; nie Klartext-HTTP ausliefern.

➡ Tägliche Bedienung der App: [`handbuch.md`](handbuch.md).
