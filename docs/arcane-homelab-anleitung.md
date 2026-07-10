# DartsZentrale mit Arcane — Homelab (per IP)

Praxis-Anleitung für **PocketBase + Frontend als Compose-Stacks in [Arcane](https://arcane.ofkm.dev/)**.
Schwerpunkt ist der Betrieb im eigenen Netz über die **interne IP** (kein DNS, keine Domain, kein
HTTPS) — festgehalten nach dem ersten Aufsetzen inkl. der Stolpersteine.

> **Warum Arcane statt Coolify?** Fürs Homelab reicht eine schlanke Docker-/Compose-Verwaltung.
> Arcane macht genau das (Stacks starten, Logs, Volumes) und ist nicht so überladen. Der Preis:
> Arcane bringt **keinen** Reverse-Proxy und **kein** automatisches HTTPS mit. Fürs LAN per IP
> braucht man das ohnehin nicht — die beiden Dienste veröffentlichen ihre Ports direkt.
>
> **Öffentlicher Betrieb mit Domain + HTTPS?** Zwei Wege stehen in [Abschnitt 5](#5-öffentlich-mit-domain--https).
> Die schlankste Variante (systemd + Caddy, ganz ohne Docker) ist [`admin-anleitung-cloud.md`](admin-anleitung-cloud.md).

> Begriffe vorweg, damit nichts durcheinandergeht:
> - **Superuser** = PocketBase-**Verwaltung** (`/_/`-Login). Verwaltet die DB.
> - **App-Admin** = Konto in der Collection `users` mit `role = admin`. Damit loggt man sich in der **App** ein.
> - **Volume `pb_data`** = die einzigen persistenten Daten (SQLite + Uploads + Backups).
> - **Image** = enthält Schema (`/pb/migrations`) + Hooks (`/pb/hooks`) — fest eingebacken, **nicht** im Volume.
> - **Stack / Compose-Projekt** = ein `docker-compose.yaml` samt Build-Kontext, das Arcane als Einheit startet.

---

## 0. Voraussetzungen

- **Arcane** läuft im Homelab (verwaltet den lokalen Docker-Host).
- Du kennst die **interne IP** des Servers (hier `<IP>` genannt, z. B. `192.168.x.x`).
- Das **Repo liegt auf dem Docker-Host** — beide Stacks bauen aus lokalem Kontext (`build:`),
  Arcane braucht die Dateien also auf der Maschine:
  ```bash
  git clone https://github.com/zelko2k1/dartszentrale.git
  # (SSH: git@github.com:zelko2k1/dartszentrale.git), Branch main
  ```
  Update später: `git pull` im selben Verzeichnis, dann in Arcane **Redeploy** (mit Rebuild).

---

## 1. PocketBase-Stack deployen

Die Compose-Datei [`pocketbase/docker-compose.yaml`](../pocketbase/docker-compose.yaml) ist fertig:
Sie baut das eigene Image (Schema + Hooks eingebacken), legt das persistente Volume `pb_data` an,
veröffentlicht Port **8090** und hat einen Healthcheck.

1. In Arcane **Compose → New / Create Project** (bzw. „Add Stack").
2. Quelle = das Verzeichnis **`pocketbase/`** aus dem geklonten Repo (dort liegen `docker-compose.yaml`
   **und** der Build-Kontext). Alternativ den Inhalt der Datei in den Editor einfügen — dann muss der
   Build-Kontext (`.`) auf dieses Verzeichnis zeigen.
3. **Deploy / Up.** Beim ersten Start legen die ins Image gebackenen **Migrations** das Schema
   automatisch an (→ 10 Collections). Hooks (`/pb/hooks`) aktivieren den Vereinsmodus.

**Erreichbarkeit:** PocketBase lauscht auf **Port 8090** → `http://<IP>:8090`.

### PocketBase einrichten (im Dashboard)

1. `http://<IP>:8090/_/` öffnen (**mit Slash am Ende!**) → **ersten Superuser anlegen**
   (Mail + starkes Passwort). Erscheint stattdessen nur ein **Login** ohne Anlege-Dialog,
   liegen im Volume schon Daten (alter Superuser) → siehe „Neuanfang" unten.
2. **Settings → Application:**
   - `Application name` = `dartszentrale` (kosmetisch)
   - `Application URL` = `http://<IP>:8090`
3. **CORS gibt es nicht mehr im Dashboard** (PocketBase seit 0.23) — Default `*`, im LAN nichts zu tun.
   Einschränken ginge per **`--origins`-Flag** im Compose-`command` (z. B. `--origins=http://<IP>:8081`).
   Bei Token-Auth (JWT im localStorage, keine Cookies) ist CORS ohnehin kein echter Schutzwall.
4. **Ersten App-Admin anlegen:** Collection **`users`** → New record:
   - `role = admin`, Mail + starkes Passwort
   - **`active` anhaken (= true)** ← unbedingt!
   *(Das ist NICHT der Superuser — damit loggst du dich später in der App ein.)*
   > ⚠️ Die `users`-Collection hat die Auth-Rule **`active = true`** — nur aktive Records dürfen sich
   > einloggen. Beim Anlegen im Dashboard ist `active` standardmäßig **nicht** gesetzt → Login scheitert
   > mit **HTTP 403** (nicht 400!). `active` anhaken + Save → Login geht. Das ist KEIN Passwort-Problem.

---

## 2. Frontend-Stack deployen

Die Compose-Datei [`app/docker-compose.yaml`](../app/docker-compose.yaml) baut die SPA (nginx serviert
das statische Bundle) und trägt die PocketBase-URL als **Build-Arg** direkt im File:

```yaml
services:
  dartzentrale:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        - VITE_PB_URL=http://192.168.200.7:8090   # ← auf deine <IP> anpassen!
    ports:
      - "8081:80"
    restart: unless-stopped
```

1. **`VITE_PB_URL` auf deine `<IP>` setzen** — im File (`http://<IP>:8090`). Anders als bei Coolify
   gibt es **kein Build-Variable-Häkchen** mehr: der Wert steht versioniert in der Compose-Datei und
   wird von Vite **zur Build-Zeit** ins Bundle gebacken (`ARG VITE_PB_URL` im Dockerfile).
2. In Arcane einen zweiten **Compose-Stack** aus dem Verzeichnis **`app/`** anlegen.
3. **Deploy / Up.**

> ⚠️ **Build-Zeit, nicht Laufzeit.** Ändert sich die IP oder der Port, reicht kein Restart —
> es braucht einen **Rebuild** des Frontend-Stacks (in Arcane „Redeploy" mit Pull/Rebuild).
>
> ⚠️ **Port-Konflikt?** `Bind for :::8081 failed: port is already allocated` → linken Host-Port
> ändern (z. B. `8088:80`, `3000:80`). Belegung prüfen: `docker ps --filter "publish=8081"`.

**Erreichbarkeit:** `http://<IP>:8081`

---

## 3. Testen

1. `http://<IP>:8081` öffnen → Login-Maske Vereinsmodus.
2. Mit dem **App-Admin** (aus Schritt 1.4) anmelden.
3. Klappt das Laden, aber Login/Daten gehen nicht → **F12 → Tab „Network"**, Login wiederholen,
   den Request **`auth-with-password`** ansehen (Ziel-URL + Status-Code):
   - Geht an `localhost:8090` → `VITE_PB_URL` stand beim Build falsch/leer → in `app/docker-compose.yaml`
     korrigieren + **Rebuild**.
   - Geht an `http://<IP>:8090`, **Status 400** (`Failed to authenticate`) → falsche Mail/falsches Passwort
     → Record in `users` → „Change password" neu setzen.
   - Geht an `http://<IP>:8090`, **Status 403** → Auth-Rule `active = true` nicht erfüllt
     → Record in `users` → **`active` anhaken** + Save (siehe Schritt 1.4). Häufigster Stolperstein!

> Beides läuft über **http** (App `:8081`, PB `:8090`) → kein „Mixed Content"-Problem.

---

## 4. Spickzettel / Diagnose

**Wer antwortet mir gerade?** Anders als bei Coolify gibt es **keinen Reverse-Proxy dazwischen** —
die Container veröffentlichen ihre Ports direkt. Ein „404 page not found" kommt hier also **nicht**
von einem Proxy, sondern von einem falschen Pfad/Port oder einem gestoppten Container.

```bash
# Lebt PocketBase? (direkt) → erwartet: {"code":200,...}
curl -s http://localhost:8090/api/health

# Antwortet das Admin-Dashboard? (mit Slash!) → erwartet: 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8090/_/

# Antwortet das Frontend? → erwartet: 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8081/

# Wer hält einen Port?
docker ps --filter "publish=8090" --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"

# Logs eines Containers (oder direkt in der Arcane-UI)
docker logs --tail 50 <container-name>
```

- **Container löschen ≠ Daten löschen** — Daten leben im **Volume `pb_data`**, überleben Redeploys
  und das Neu-Deployen des Stacks. Stack/Container am besten **über die Arcane-UI** verwalten, damit
  Arcane seinen Zustand konsistent hält (statt `docker rm` von Hand).
- **Im Volume liegt nur `pb_data`** — das ist korrekt. Migrations/Hooks liegen im **Image** unter `/pb/...`.
- Arcane zeigt **Logs, Health und Ports** je Stack direkt in der UI — meist schneller als die `docker`-Befehle oben.

### Superuser-Passwort vergessen / setzen

```bash
docker exec -it <pocketbase-container> /usr/local/bin/pocketbase \
  superuser upsert "admin@dein.local" "NeuesStarkesPasswort" --dir=/pb_data
```
`upsert` = anlegen **oder** Passwort setzen. Trifft nur diese eine Mail, andere Admins bleiben unberührt.

### Kompletter Neuanfang (alle Daten + alle Admins weg!)

In Arcane den PocketBase-Stack entfernen **und das Volume `pb_data` mitlöschen** (bzw. das Volume in
der Volumes-Ansicht entfernen), dann neu deployen. ⚠️ Unwiderruflich: löscht **alle** Superuser,
**alle** App-`users` und sämtliche Daten.

---

## 5. Öffentlich mit Domain + HTTPS

Arcane bringt **kein** automatisches HTTPS mit. Für den öffentlichen Betrieb (Domain, TLS) gibt es
deshalb zwei Wege — je nachdem, ob du im Docker-/Arcane-Umfeld bleiben willst oder maximal schlank fahren möchtest:

### Weg A (empfohlen, am schlanksten) — systemd + Caddy, ohne Docker

Zwei native systemd-Dienste + **Caddy** als HTTPS-Reverse-Proxy (Auto-Let's-Encrypt). Spart ~1 GB
Dauerlast und die ganze Docker-Schicht, geführt per `einrichten-cloud.sh`. Komplett beschrieben in
[`admin-anleitung-cloud.md`](admin-anleitung-cloud.md).

### Weg B — bei Arcane bleiben: Caddy als zusätzlicher Container

Wenn du **ein Tool überall** willst (Arcane im Homelab **und** in der Cloud), packst du einen
**Caddy-Container** in den Stack, der das HTTPS übernimmt. Prinzip:

- **DNS:** zwei A-Records auf die Server-IP — `app.<domain>` (Frontend) und `db.<domain>` (PocketBase).
- **Ein gemeinsamer Compose-Stack** mit drei Services in einem internen Docker-Netz:
  `caddy` (Ports 80/443 öffentlich) → reverse_proxy auf `frontend:80` bzw. `pocketbase:8090`.
  Frontend und PocketBase veröffentlichen dann **keine** eigenen Host-Ports mehr (Caddy frontet sie).
- **`VITE_PB_URL` = `https://db.<domain>`** (Build-Zeit!) statt der LAN-IP.
- Caddy holt/erneuert die Let's-Encrypt-Zertifikate automatisch; Voraussetzung: Ports **80 + 443**
  aus dem Internet erreichbar, DNS zeigt auf die Server-IP.
- Als Vorlage für die Caddy-Konfig dient [`../Caddyfile.example`](../Caddyfile.example) — nur zeigen die
  `reverse_proxy`-Ziele im Container-Stack auf die **Service-Namen** (`frontend:80`, `pocketbase:8090`)
  statt auf `127.0.0.1:4173/:8090`. Die Security-Header/CSP-Hinweise dort gelten unverändert.
- **Rechtliches (Pflicht):** Öffentlich brauchst du ein **Impressum** (§ 5 DDG) und eine
  **Datenschutzerklärung** (Art. 13 DSGVO). Beides trägst du **in der App** ein (als Admin:
  Einstellungen → **Rechtliches**); es erscheint auf der Anmeldeseite und ist ohne Anmeldung
  erreichbar. Damit die Texte auch für nicht angemeldete Besucher sichtbar sind, macht die Migration
  `pb_migrations/1782300001_club_config_public_legal.js` die `club_config`-Collection öffentlich
  lesbar — sie greift **automatisch beim nächsten Rebuild** (das Image wird neu gebaut, PocketBase
  wendet neue Migrationen beim Start an). **Kein `provision.mjs` auf dem Server** — das ist der Weg
  der schlanken systemd-Variante, nicht der Docker/Arcane-Weg.

> Für einen einzelnen kleinen Vereins-Server ist **Weg A** meist die bessere Wahl (weniger bewegliche
> Teile, kein Rebuild bei Zertifikaten). Weg B lohnt sich, wenn du bewusst alles in Docker/Arcane haben willst.

---

## 6. Konten & Sicherheit

Die echte Zugriffskontrolle sind die **PocketBase-API-Rules** (serverseitig) — der Board-/Kiosk-Modus ist nur Oberfläche.

- **Board-Rechner-Konto** (rechtearm) anlegen, statt echte Admin-Logins an die Bretter zu geben:
  ```bash
  PB_URL=http://<IP>:8090 PB_SU_EMAIL=… PB_SU_PASS=… BOARD_EMAIL=board@dein.local BOARD_PW=<starkes-pw> \
    node pocketbase/add-board-account.mjs
  ```
  Rolle `board`: darf nur **Matches anlegen + lesen**, nichts verwalten. Ein Ergebnis korrigieren darf nur **Admin oder Ersteller** (Owner-Bindung).
- **App-Passwort vergessen?** Der Superuser ist der Rettungsanker:
  ```bash
  USER_EMAIL=… NEW_PW=<min-8> PB_URL=http://<IP>:8090 PB_SU_EMAIL=… PB_SU_PASS=… \
    node pocketbase/reset-password.mjs
  ```
- **Bei öffentlichem Betrieb** (Domain/Internet): HTTPS ist Pflicht, den PocketBase-Port **8090 nicht**
  offen ins Internet stellen, die Admin-Konsole **`/_/`** abschirmen (IP/VPN). Vollständige
  Pre-Go-live-Liste: [`security-audit.md`](security-audit.md).
- Self-Registration bleibt aus (`users` create = `admin`); unauthentifiziert ist nichts lesbar.

---

## 7. Merksätze

- **Superuser** = PB-Verwaltung · **App-Admin** = App-Login (`users`, `role=admin`). Zwei verschiedene Dinge.
- **`VITE_PB_URL`** ist **Build-Zeit** → ändern heißt **Rebuild**; der Wert steht in `app/docker-compose.yaml` (kein UI-Häkchen mehr).
- **Erster-Superuser-Dialog** erscheint nur, wenn `pb_data` **leer** ist. Sonst nur Login.
- **Alles http im LAN** ist ok, solange App und PB beide http sind (kein Mixed Content).
- **Arcane hat keinen Proxy/HTTPS** — im LAN egal (direkte Ports), in der Cloud brauchst du Caddy (Weg A oder B).
- Unterschied zur schlanken Variante (systemd + Caddy): nur die **Verpackung**. PocketBase selbst tickt gleich.
  Siehe [`admin-anleitung-cloud.md`](admin-anleitung-cloud.md).
