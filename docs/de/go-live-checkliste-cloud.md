# ✅ Go-live-Checkliste — Cloud-Betrieb (Caddy + systemd)

**🇩🇪 Deutsch | [🇬🇧 English](../go-live-checklist-cloud.md)**

> Abhakbare Schritt-für-Schritt-Liste für den **sicheren Produktivstart** im Cloud-Modus
> (`app.<domain>` / `db.<domain>` hinter Caddy, PocketBase + Frontend nur auf Loopback).
> Begründungen zu jedem Punkt: [`security-audit.md`](../security-audit.md). Deploy-Details:
> [`admin-anleitung-cloud.md`](admin-anleitung-cloud.md).
>
> **Legende:** ✅ = vom Setup-Skript automatisch (nur **verifizieren**) · 🔧 = echte Handarbeit · 🔴 = zwingend.
> Alle Ops-Befehle laufen **auf dem Server** in `~/dartszentrale/pocketbase/` (PB hört dort auf `127.0.0.1:8090`);
> `PB_SU_EMAIL`/`PB_SU_PASS` = dein Superuser-Konto.

---

## Phase 0 — Aktuellen Stand ausrollen 🔴

Damit die neuen Funktionen (2FA, E-Mail-Änderung durch Admins) live sind:

- [ ] 🔧 Neuen Code einspielen und Dienste neu starten:
  ```bash
  cd ~/dartszentrale && git pull
  ./update-server.sh          # baut das Frontend neu + startet darts-web & darts-pocketbase neu
  ```
  > **Wichtig:** PocketBase muss neu starten, damit die neuen **Hooks** (`/api/login`, `/api/2fa/*`) und
  > **Migrationen** (`user_mfa`, `manageRule`) greifen. Ein reiner Frontend-Update (In-App) reicht dafür **nicht**.
- [ ] 🔧 Schema/Rules nachziehen (setzt `user_mfa` + `manageRule`, falls die Migration allein nicht alles abdeckt):
  ```bash
  cd ~/dartszentrale/pocketbase
  PB_URL=http://127.0.0.1:8090 PB_SU_EMAIL=<su-mail> PB_SU_PASS=<su-pw> node provision.mjs
  ```
- [ ] ✅ **Verifizieren:** `curl -s -X POST http://127.0.0.1:8090/api/login -d '{}' -H 'Content-Type: application/json'`
  → muss **`"E-Mail und Passwort sind erforderlich."` (HTTP 400)** liefern, **nicht** 404.

---

## Phase 1 — Konten & Passwörter 🔴

- [ ] 🔴 **#1 Superuser-Passwort rotieren.** Setz ein neues, starkes, einzigartiges PW (Passwortmanager) und
  sichere es an einem sicheren Ort:
  ```bash
  sudo systemctl stop darts-pocketbase
  ./pocketbase superuser upsert <su-mail> "<neues-starkes-pw>" --dir ./pb_data
  sudo systemctl start darts-pocketbase
  ```
  Falls `seed-remote.sh` je ein PW-Literal enthielt: entfernen (die Datei ist gitignored, war aber im Review sichtbar).
- [ ] 🔴 **#2 Produktiv-Admin** existiert mit **starkem** Passwort (legt `setup-cloud.sh` an). Keine `demo-*.mjs`
  gegen die Prod-DB laufen lassen (der Guard blockt das gegen nicht-lokale Ziele, trotzdem: nicht tun).
- [ ] 🔧 **Superuser-MFA aktivieren:** `https://db.<domain>/_/` → **Settings** → Superuser-2FA (TOTP) einschalten.
- [ ] 🔧 **PB-Rate-Limit aktivieren:** `/_/` → **Settings** → Rate limiting einschalten. **Regel für `POST /api/login`**
  ergänzen (schützt vor Passwort-Brute-Force — der App-eigene Lockout greift nur beim 2FA-Code, nicht beim Passwort).
- [ ] 🔧 **App-Admins 2FA empfehlen/einrichten:** Jeder Admin meldet sich an → *Einstellungen → Mein Konto →
  2-Faktor-Authentifizierung → einrichten* (QR scannen, Backup-Codes sicher speichern). Für Konten mit Admin-Rechten
  dringend empfohlen.
- [ ] 🔧 Alle Konten: **starke, einzigartige Passwörter** (Passwortmanager).

---

## Phase 2 — Netzwerk & TLS

- [ ] 🔧 **Firewall:** nur **22/80/443** offen. 8090/4173 **nicht** öffnen (binden ohnehin nur auf `127.0.0.1`):
  ```bash
  sudo ufw allow 22,80,443/tcp && sudo ufw enable      # (oder Hetzner Cloud Firewall)
  ```
- [ ] ✅ **#3 PB nur Loopback** — verifizieren, dass PB von außen **nicht** erreichbar ist:
  ```bash
  curl -m 5 http://<public-ip>:8090     # muss fehlschlagen / timeouten
  ```
- [ ] ✅ **HTTPS + HSTS** (Caddy Auto-Let's-Encrypt + `security_headers`) — verifizieren:
  ```bash
  curl -sI https://app.<domain> | grep -i strict-transport-security   # HSTS-Header muss da sein
  ```
  Und im Browser: Schloss-Symbol, gültiges Zertifikat, `http://` leitet auf `https://` um.
- [ ] ✅ **CORS** auf die App-Domain begrenzt (`--origins=https://app.<domain>` in der PB-Unit) — verifizieren:
  `systemctl cat darts-pocketbase | grep origins`.

---

## Phase 3 — Caddy-Härtung 🔧

- [ ] 🔧 **#5 Admin-Konsole `/_/` abschirmen.** Im `/etc/caddy/Caddyfile` (bzw. [`Caddyfile.example`](../../Caddyfile.example))
  den auskommentierten `@admin path /_/*`-Block einkommentieren und deine IP eintragen
  (`curl ifconfig.me`). Ohne feste IP: `basic_auth` davor oder VPN/Tailscale. Die API (`/api/...`) bleibt offen.
  ```bash
  sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy
  ```
- [ ] 🔧 **#9 CSP aktivieren.** Im `app.<domain>`-Block die `Content-Security-Policy`-Zeile einkommentieren;
  **`connect-src` MUSS `https://db.<domain>` enthalten** (sonst schlägt jeder API-Aufruf fehl).
  Dann `caddy validate` + `reload` und **im Browser testen** (DevTools-Konsole auf CSP-Fehler prüfen: Login,
  API, PWA-Installation, QR-Anzeige bei der 2FA-Einrichtung).

---

## Phase 4 — Backups 🔴

Eine ganze Vereinssaison hängt an `pocketbase/pb_data/` — Backups sind Pflicht, nicht optional.

- [ ] 🔧 **Automatische PB-Backups aktivieren:** `/_/` → **Settings → Backups** → Zeitplan (z. B. täglich) einschalten.
- [ ] 🔧 **Off-site-Kopie** einrichten (S3/Storage Box o. ä.) — ein Backup nur auf demselben Server schützt nicht vor
  Serververlust. (PB-Backups können direkt in einen S3-Bucket geschrieben werden.)
- [ ] 🔧 **Restore einmal testen** (auf einem Zweitserver/lokal): Backup einspielen → App startet mit den Daten.
  Ein ungetestetes Backup ist kein Backup.

---

## Phase 5 — Rechtliches (Pflicht im Internet-Betrieb) 🔴

- [ ] 🔴 **Impressum (§ 5 DDG)** + **Datenschutzerklärung (Art. 13 DSGVO)** eintragen: als Admin →
  *Einstellungen → Rechtliches*. Erscheinen dann **ohne Anmeldung** auf der Login-Seite.
- [ ] 🔧 Falls Altinstallation: `club_config` einmal öffentlich lesbar machen (sonst sehen nicht angemeldete Besucher
  die Texte nicht):
  ```bash
  cd ~/dartszentrale/pocketbase && PB_URL=http://127.0.0.1:8090 PB_SU_EMAIL=<su-mail> PB_SU_PASS=<su-pw> node provision.mjs
  ```

---

## Phase 6 — Abschluss-Smoketest 🔧

Am Live-System (`https://app.<domain>`) einmal durchklicken:

- [ ] Login als Admin funktioniert.
- [ ] 2FA einrichten (QR wird angezeigt) → aktivieren → Logout → Login verlangt Code → mit Code rein.
- [ ] Benutzerliste: 2FA-Spalte sichtbar; E-Mail eines Kontos ändern klappt (früherer Bug #8).
- [ ] Ein normaler Nutzer (Spieler) kann sich anmelden und sieht nur seine Rechte.
- [ ] Impressum/Datenschutz-Links auf der Login-Seite erreichbar (ohne Anmeldung).

---

## Notfall-Werkzeuge (bereithalten)

Alle in `~/dartszentrale/pocketbase/`, laufen als Superuser gegen `127.0.0.1:8090`:

| Situation | Befehl |
|---|---|
| App-Passwort vergessen | `USER_EMAIL=… NEW_PW=… PB_URL=http://127.0.0.1:8090 PB_SU_EMAIL=… PB_SU_PASS=… node reset-password.mjs` |
| 2FA aussperren (Handy + Codes weg) — falls kein Admin verfügbar | `USER_EMAIL=… PB_URL=http://127.0.0.1:8090 PB_SU_EMAIL=… PB_SU_PASS=… node reset-2fa.mjs` |
| Board-Konto anlegen | `BOARD_EMAIL=… BOARD_PW=… PB_URL=http://127.0.0.1:8090 PB_SU_EMAIL=… PB_SU_PASS=… node add-board-account.mjs` |
| Superuser-PW neu setzen | Dienst stoppen → `./pocketbase superuser upsert <mail> "<pw>" --dir ./pb_data` → starten |

> **Reset-2FA in der App:** Der normale Weg ist jetzt in der App — *Benutzer → Konto bearbeiten →
> „2FA zurücksetzen"*. Das CLI-Skript ist nur der Notnagel, wenn kein Admin mehr reinkommt.

---

## Kein Blocker

- **#12** Kaderliste ist für jeden eingeloggten Nutzer lesbar (E-Mails geschützt). **Entscheidung 2026-07-05:
  aktuell keine Einschränkung nötig** — nur auf Vereinswunsch umsetzen (z. B. wegen Minderjähriger). Steht als
  optionales Feature in der [ROADMAP](../../ROADMAP.md) §4. Rationale: [`security-audit.md`](../security-audit.md) #12.
