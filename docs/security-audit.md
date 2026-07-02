# Sicherheits-Audit DartsZentrale — Internet-Betrieb

> Stand: 2026-07-02 (Erst-Audit: 2026-06-28). **Lebende Liste der noch offenen Punkte** für den
> Betrieb im Internet — bereits im Code behobene Findings sind entfernt (Details in der Git-Historie).
> Ursprüngliche Methode: drei parallele Teil-Audits (Collection-Regeln, Frontend, Ops/Deploy) +
> manuelle Prüfung der `pb_hooks`.

## Verdikt

Das **Auth-Fundament ist solide** — die Server-Regeln greifen, im App-Code wurden **keine offenen
Lücken** gefunden. Die verbleibenden Risiken liegen fast alle im **Provisioning/Deployment** und sind
vor dem Go-live zu schließen (siehe Checkliste unten).

## ✅ Verifiziert sicher

- **Keine Privilege-Escalation:** `users` create/update = admin-only → niemand kann sich selbst auf
  `role=admin` setzen. `pb_hooks/board_role_guard.pb.js` erzwingt zusätzlich `isBoard ⇔ role=board`.
- **`pb_hooks/set_password.pb.js`** erzwingt serverseitig `isAdmin || isSelf` (kein fremder Reset).
- **Nur eine** öffentlich lesbare Collection: `club_config` (Vereinsname, Logo, Impressum,
  Datenschutz, UI-Konfig) — **bewusst** public read, damit die Login-Seite Rechtstexte auch ohne
  Anmeldung zeigt (§ 5 DDG / Art. 13 DSGVO). Enthält **nichts Personenbezogenes**; Schreiben bleibt
  **admin-only**. Alle übrigen Collections erfordern Login; **keine** Selbstregistrierung; E-Mails
  durch `emailVisibility=false` geschützt.
- **Frontend:** keine XSS-Sinks (`eval`/`innerHTML`/`dangerouslySetInnerHTML` = 0), **keine** Secrets
  im Bundle (`VITE_PB_URL` ist nur die Backend-URL), `clubLogo` (data-URL in `img src`) ungefährlich,
  Local-Mode-Allrechte sicher (kein Server beteiligt).
- Die client-seitigen Rollen-Checks (`perm()`) sind **kosmetisch** — die echte Grenze sind die
  PB-Regeln, und die sind korrekt.

## ✅ Bereits behoben (im Code)

Kurz dokumentiert für die Nachvollziehbarkeit der Nummern; Details in der Git-Historie:

- **#4** Match-Ergebnisse an den Ersteller gebunden (`createdBy`-Stempel; Create-/Update-Rule) — gegen PB 0.39.5 getestet.
- **#6** Rollen-Scoping: `seasons`/`leagues`/`teams` anlegen+löschen nur Admin; `teams` *ändern* nur der eigene Kapitän (`captainId = @request.auth.playerId`).
- **#7 / #8** Default-Passwörter (Superuser, Board-Konto): `pocketbase/_security-guard.mjs` bricht ab, sobald ein bekannter Default gegen ein **nicht-lokales** Ziel liefe (`MEMBER_PW`/`BOARD_PW` erzwingbar).
- **#9 / #13** Security-Header + `server_tokens off` in `app/nginx.conf`, dasselbe als `security_headers`-Snippet im Caddyfile (`einrichten-cloud.sh`). *Die CSP-Aktivierung bleibt ein Deploy-Schritt → siehe #9 in der Checkliste.*
- **#11** `reset-password.mjs`: `NEW_PW` ist Pflicht, kein stiller Default mehr.
- **Nebenbefund:** Coolify-Deploy backt Migrations/Hooks **ins Image** (Dockerfile `COPY`), Frontend baut über `app/Dockerfile` (nicht Nixpacks).

---

## ⏳ Offen — vor/beim Go-live

### 🔴 Zwingend

**#1 — Live-Superuser-Passwort rotieren** (manuell, durch Betreiber)
`pocketbase/seed-remote.sh` enthielt das echte PB-Superuser-Passwort im Klartext (gitignored, **nie
committed** — verifiziert). Trotzdem: **Passwort rotieren** und den Literal aus der Datei entfernen
(per `read -s`-Prompt oder Env außerhalb des Repos). Es wurde im Review sichtbar.

**#2 — Produktiv-Admin manuell anlegen, keine Seeds gegen Prod** (Betriebsregel)
Der erste App-Admin wird von `provision.mjs` interaktiv abgefragt (oder per `APP_ADMIN_EMAIL`/
`APP_ADMIN_PASS`); ein reiner Coolify-Deploy legt **kein** Konto an (nur Migrations+Hooks). **Regel:**
Produktiv-Admin mit **starkem** Passwort selbst anlegen; die `demo-*`-Seeds sind lokal-only (der
Guard blockiert sie gegen nicht-lokale Ziele).

**#3 — PocketBase nicht direkt auf `0.0.0.0:8090` veröffentlichen** (Deploy-Entscheidung)
`docker-compose.yaml` published `8090:8090` → PB per Klartext-HTTP am TLS-Proxy vorbei erreichbar.
Bewusst nicht automatisch geändert, weil das LAN-Setup PB direkt über `http://<lan-ip>:8090` nutzt.
**Sobald PB ausschließlich hinter dem HTTPS-Proxy läuft:** Mapping entfernen oder auf
`127.0.0.1:8090:8090` binden + Host-Firewall Port 8090 sperren. *(Schlanke Cloud-Variante bindet PB
ohnehin nur an `127.0.0.1` — dort erledigt.)*

### 🟡 Mittel

**#5 — PB-Admin-Konsole `/_/` internet-erreichbar** (Deploy)
Das Login-Panel `/_/` ist ein Brute-Force-Ziel. **Fix (am Reverse-Proxy + in PB):**
- **`/_/` abschirmen** — in der Cloud am **Caddy** per IP-Allowlist bzw. `basic_auth` auf `path /_/*`
  (fertiger, auskommentierter Block im generierten `/etc/caddy/Caddyfile` **und** `Caddyfile.example`);
  im LAN via Firewall/VPN. Die API (`/api/...`) bleibt offen — nur die UI wird abgeschirmt.
- **PB-Rate-Limit** und **Superuser-MFA** in den PocketBase-Einstellungen (`/_/` → Settings) aktivieren
  — schützt den Auth-Endpunkt gegen Brute-Force, unabhängig von der UI-Abschirmung.

> **CORS ist in der Cloud bereits gesetzt — nicht mehr im UI, sondern per CLI-Flag:** die
> PocketBase-Unit läuft mit **`--origins=https://app.<domain>`** (setzt `einrichten-cloud.sh`
> automatisch). PB 0.39 hat **keine CORS-Einstellung im Dashboard** mehr, aber das `--origins`-Flag
> (Default `*`) — kein manueller UI-Schritt. Sicherheitlich ist CORS bei **Token-Auth** (JWT im
> localStorage, keine Cookies) ohnehin nur Defense-in-Depth: eine Fremd-Origin kommt nicht ans Token.

**#9 — CSP aktivieren** (Deploy)
Die Security-Header stehen (behoben), aber die **Content-Security-Policy** liegt als Vorlage
auskommentiert vor (nginx bzw. Caddyfile). Pro Deployment auf die echte PB-Domain anpassen
(`connect-src` MUSS die PB-URL enthalten), einkommentieren und testen.

**#10 — JWT im localStorage** (durch #9 mitigiert)
PB speichert das Token JS-lesbar → bei XSS exfiltrierbar. Primäre Mitigation: strikte **CSP** (#9)
aktivieren. Kein XSS-Sink im Code vorhanden → Restrisiko gering.

**#12 — Kompletter Kader für jeden eingeloggten Nutzer lesbar** (Abwägung)
Als Vereins-Verzeichnis vertretbar (E-Mails sind geschützt). Bei Minderjährigen im Verein abwägen,
ob die Kaderliste weiter eingeschränkt werden soll.

---

## Pre-Go-live-Checkliste

- [ ] **#1** PB-Superuser-Passwort rotiert, Literal aus `seed-remote.sh` entfernt.
- [ ] **#2** Produktiv-Admin manuell mit **starkem** Passwort angelegt; keine Seeds gegen Prod gelaufen.
- [ ] **#3** PB nicht als Klartext-HTTP im Internet: Port-Mapping entfernt/loopback + Firewall, oder bewusst nur LAN.
- [ ] **#5** PB-Admin-Konsole `/_/` abgeschirmt (Caddy IP-Allowlist/`basic_auth` bzw. Firewall/VPN); PB-**Rate-Limit + Superuser-MFA** an. *(CORS: bereits per `--origins` gesetzt.)*
- [ ] **#9** CSP auf die echte PB-Domain angepasst, einkommentiert und getestet.
- [ ] HTTPS erzwungen (Proxy/Cloudflare), HSTS aktiv.
- [ ] Starke, einzigartige Passwörter für alle Konten (Passwortmanager).

## Optional / später

- **2FA für Admins** — siehe [`plan-2fa.md`](plan-2fa.md).
