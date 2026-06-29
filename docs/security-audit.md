# Sicherheits-Audit DartsHub — Internet-Betrieb

> Stand: 2026-06-28. Audit des kompletten Codes (App-Frontend, PocketBase-Regeln/Hooks,
> Ops-Skripte, Deploy-Config) im Hinblick auf den Betrieb im Internet. Methode: drei parallele
> Teil-Audits (Collection-Regeln, Frontend, Ops/Deploy) + manuelle Prüfung der `pb_hooks`.

## Verdikt

Das **Auth-Fundament ist solide** — die Server-Regeln greifen, im App-Code wurden **keine offenen
Lücken** gefunden. Die realen Risiken liegen fast alle im **Provisioning/Deployment** und sind vor
dem Go-live zu schließen.

## ✅ Verifiziert sicher

- **Keine Privilege-Escalation:** `users` create/update = admin-only → niemand kann sich selbst auf
  `role=admin` setzen. `pb_hooks/board_role_guard.pb.js` erzwingt zusätzlich `isBoard ⇔ role=board`.
- **`pb_hooks/set_password.pb.js`** erzwingt serverseitig `isAdmin || isSelf` (kein fremder Reset).
- **Keine** öffentliche Collection, **keine** Selbstregistrierung; E-Mails durch `emailVisibility=false`
  geschützt.
- **Frontend:** keine XSS-Sinks (`eval`/`innerHTML`/`dangerouslySetInnerHTML` = 0), **keine** Secrets
  im Bundle (`VITE_PB_URL` ist nur die Backend-URL), `clubLogo` (data-URL in `img src`) ungefährlich,
  Local-Mode-Allrechte sicher (kein Server beteiligt).
- Die client-seitigen Rollen-Checks (`perm()`) sind **kosmetisch** — die echte Grenze sind die
  PB-Regeln, und die sind (bis auf die Findings unten) korrekt.

---

## Befunde

Status: ✅ behoben (Quick-Win, dieser Commit) · ⏳ offen.

### 🔴 Vor Go-live zwingend

**#1 — Live-Superuser-Passwort rotieren ⏳ (manuell, durch Betreiber)**
`pocketbase/seed-remote.sh` enthält das echte PB-Superuser-Passwort im Klartext (gitignored, **nie
committed** — verifiziert). Trotzdem: **Passwort jetzt rotieren** und den Literal aus der Datei
entfernen (per `read -s`-Prompt oder Env außerhalb des Repos). Es wurde im Review sichtbar.

**#2 — Seed/Provision nie gegen die Produktiv-DB ✅ (gehärtet) + Betriebsregel ⏳**
`provision.mjs`/`demo-seed.mjs`/`demo-seed-dsv-fuerth.mjs` legen Konten mit dem Default `dartshub123` an (inkl.
`chef@dartshub.local` als **admin**). Ein reiner Coolify-Deploy tut das nicht (nur Migrations+Hooks).
**Gehärtet:** neuer `_security-guard.mjs` — die Skripte **brechen ab**, wenn ein bekanntes
Default-Passwort gegen ein **nicht-lokales** Ziel verwendet würde (localhost bleibt bequem). Member-
Passwörter sind jetzt per `MEMBER_PW=…` überschreibbar. **Betriebsregel bleibt:** Produktiv-Admin
manuell mit starkem Passwort anlegen; Seeds sind lokal-only.

**#3 — PocketBase nicht direkt auf `0.0.0.0:8090` veröffentlichen ⏳ (Deploy-Entscheidung)**
`docker-compose.yaml` published `8090:8090` → PB per Klartext-HTTP am TLS-Proxy vorbei erreichbar.
**Nicht automatisch geändert**, weil das aktuelle LAN-Setup PB direkt über `http://<lan-ip>:8090`
nutzt (Binding-Wechsel würde den Betrieb brechen). Erläuternder Sicherheits-Kommentar ist im Compose
ergänzt. **Sobald PB ausschließlich hinter dem HTTPS-Proxy läuft:** Mapping entfernen oder auf
`127.0.0.1:8090:8090` binden + Host-Firewall Port 8090 sperren.

### 🟠 Hoch

**#4 — Match-Ergebnisse fälschbar ✅ (behoben)**
`matches.createRule` zwingt jetzt `@request.body.createdBy = @request.auth.id` (Ersteller-Stempel),
`updateRule` erlaubt Admin ODER den Ersteller. Neues Feld `createdBy`; die App stempelt es beim
Speichern. Gesetzt in Migration `1782600000_harden_authz` UND `provision.mjs`. Gegen PB 0.39.4 getestet:
Forge mit fremder `createdBy` abgelehnt, eigener Eintrag erlaubt.

### 🟡 Mittel

**#5 — PB-Admin-Konsole `/_/` internet-erreichbar + CORS manuell ⏳ (Deploy)**
Login-Panel ist Brute-Force-Ziel; CORS-Allowlist ist ein manueller UI-Schritt. **Fix:** `/_/` per
IP/VPN/Proxy-Auth einschränken, PB-Rate-Limit + Superuser-MFA aktivieren, CORS-Allowlist verpflichtend
setzen (geht nicht via Compose → Deploy-Gate).

**#6 — Kapitän-Rolle ist global ✅ behoben**
`seasons`/`leagues` anlegen+löschen → nur Admin; `teams` löschen → nur Admin (Migration + provision,
getestet: Spieler/Kapitän kann keine Saison anlegen / kein Team löschen). **Rest ebenfalls behoben:**
`teams` *ändern* ist auf `@request.auth.role = "admin" || (cap && captainId = @request.auth.playerId)`
gescoped — ein Kapitän kann nur **seine eigene** Mannschaft (Roster) editieren. Der JSON-zu-JSON-Vergleich
`captainId = @request.auth.playerId` greift (gegen lokale PocketBase verifiziert: eigenes Update klappt,
fremdes wird mit 404 geblockt). Migration `1782600100_scope_team_update_to_captain`. Vize-Kapitäne haben
i. d. R. Rolle `player` und sind bewusst nicht eingeschlossen.

**#7 — Hardcodierte Default-Superuser-Creds ✅ (gehärtet)**
Skripte hatten `admin@dartshub.local` / `dartshub-admin-2026` als Default. Der `_security-guard.mjs`
bricht jetzt ab, wenn dieser Default gegen ein nicht-lokales Ziel benutzt würde. (Lokaler Default bleibt.)

**#8 — Board-Konto-Default ✅ (gehärtet)**
`add-board-account.mjs` Default `board-dartshub-2026` → vom Guard gegen nicht-lokale Ziele blockiert;
`BOARD_PW=…` erzwingbar.

**#9 — nginx ohne Security-Header ✅ (behoben)**
`app/nginx.conf` ergänzt: `X-Frame-Options DENY`, `X-Content-Type-Options nosniff`, `Referrer-Policy`,
`Permissions-Policy`, `server_tokens off`. **CSP als Vorlage auskommentiert** — muss pro Deployment auf
die PB-Domain angepasst und getestet werden (`connect-src` MUSS die PB-URL enthalten). HSTS am Proxy.

**#10 — JWT im localStorage ⏳ (durch CSP mitigiert)**
PB-Default speichert das Token JS-lesbar → bei XSS exfiltrierbar. Primäre Mitigation: strikte **CSP**
aktivieren (#9). Kein XSS-Sink im Code vorhanden.

### 🟢 Niedrig

**#11 — `reset-password.mjs` Default-Neu-Passwort `dartshub123` ⏳** → `NEW_PW` erzwingen (hat bereits Warnung).
**#12 — Kompletter Kader für jeden eingeloggten Nutzer lesbar ⏳** → als Vereins-Verzeichnis vertretbar (E-Mails geschützt); bei Minderjährigen abwägen.
**#13 — nginx Versions-Disclosure ✅ (behoben)** → `server_tokens off;` gesetzt.

### ℹ️ Nebenbefund (kein Security) — ✅ erledigt
`COOLIFY-SETUP.md` (jetzt unter `docs/`) ist angeglichen: Migrations/Hooks werden ins Image **gebacken**
(Dockerfile `COPY`), nicht gemountet; Frontend baut über `app/Dockerfile` (nicht Nixpacks).

---

## In diesem Commit umgesetzt (Quick-Wins)

- `pocketbase/_security-guard.mjs` (neu) + eingebunden in `provision.mjs`, `demo-seed.mjs`,
  `demo-seed-dsv-fuerth.mjs`, `add-board-account.mjs` → **Abbruch bei Default-Passwörtern gegen
  nicht-lokale Ziele** (#2, #7, #8). `MEMBER_PW` nun env-überschreibbar.
- `app/nginx.conf` → Security-Header + `server_tokens off` + CSP-Vorlage (#9, #13).
- `pocketbase/docker-compose.yaml` → Sicherheits-Kommentar zum Port-Mapping (#3, nicht-brechend).

## Pre-Go-live-Checkliste

- [ ] **#1** PB-Superuser-Passwort rotiert, Literal aus `seed-remote.sh` entfernt.
- [ ] **#2** Produktiv-Admin manuell mit **starkem** Passwort angelegt; keine Seeds gegen Prod gelaufen.
- [ ] **#3** PB nicht als Klartext-HTTP im Internet: Port-Mapping entfernt/loopback + Firewall, oder bewusst nur LAN.
- [ ] **#5** PB-Admin-Konsole `/_/` abgeschirmt (IP/VPN), Superuser-MFA + Rate-Limit an, **CORS-Allowlist gesetzt**.
- [ ] **#9** CSP in `nginx.conf` auf die echte PB-Domain angepasst, einkommentiert und getestet.
- [x] **#4** Match-Create an Ersteller gebunden (`createdBy`-Stempel) — erledigt.
- [x] **#6** `seasons`/`leagues`/`teams` anlegen/löschen admin-only **+** `teams`-Ändern auf eigenen Kapitän gescoped — vollständig erledigt.
- [ ] HTTPS erzwungen (Proxy/Cloudflare), HSTS aktiv.
- [ ] Starke, einzigartige Passwörter für alle Konten (Passwortmanager).

## Noch offen (separate Arbeitspakete)
- **#4 + #6 vollständig erledigt** (Migrationen `1782600000_harden_authz` + `1782600100_scope_team_update_to_captain`
  + provision, gegen lokale PB getestet). Inkl. Roster-Editing-Scoping (`captainId == auth.playerId`).
- Optional: 2FA für Admins (siehe `docs/plan-2fa.md`).
