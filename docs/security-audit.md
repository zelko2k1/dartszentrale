# Sicherheits-Audit DartsZentrale — Internet-Betrieb

> Stand: 2026-07-04 (Erst-Audit: 2026-06-28). **Lebende Liste der noch offenen Punkte** für den
> Betrieb im Internet — bereits im Code behobene Findings sind entfernt (Details in der Git-Historie).
> Ursprüngliche Methode: drei parallele Teil-Audits (Collection-Regeln, Frontend, Ops/Deploy) +
> manuelle Prüfung der `pb_hooks`.

## Betriebsmodi & Geltungsbereich

DartsZentrale läuft in **drei Modi** — die Checkliste unten ist entsprechend markiert:

| Modus | Netz | Reverse-Proxy / TLS | Diese Checkliste? |
|---|---|---|---|
| **on-board lokal** | nur das Gerät | keiner (localhost) | nur #1/#2 (starke Passwörter) |
| **lokal im LAN** | Vereins-WLAN | keiner / optional | #1/#2/#3/#5 via Firewall |
| **Cloud (Caddy)** | Internet | **Caddy, Auto-HTTPS** | **alle Punkte** |

> **Das Caddyfile / der Reverse-Proxy betrifft ausschließlich den Cloud-Modus.** on-board und LAN
> brauchen **kein** Caddy — dort ist entweder gar kein Netz-Exposé (on-board) oder die Absicherung
> läuft über Firewall/VPN (LAN). Der komplette Cloud-Aufbau ist in **`einrichten-cloud.sh`**
> automatisiert (systemd-Units + Caddy); das Template dazu ist **`Caddyfile.example`** (Referenz-Block
> unten). **Arcane/Docker ist nur Homelab/Dev, nicht der Produktions-Cloud-Pfad.**

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
- **#9 / #13** Security-Header + `-Server` (kein Versions-Header) als `security_headers`-Snippet im
  **Caddyfile** (`einrichten-cloud.sh` / `Caddyfile.example`). *Die CSP-Aktivierung bleibt ein
  Deploy-Schritt → siehe #9 in der Checkliste.* (Das alte `app/nginx.conf` gilt nur für den
  Arcane-/Docker-**Homelab/Dev**-Pfad; im Cloud-Modus übernimmt Caddy die Header.)
- **#11** `reset-password.mjs`: `NEW_PW` ist Pflicht, kein stiller Default mehr.
- **Nebenbefund (nur Homelab/Dev):** Der Arcane-/Docker-Deploy backt Migrations/Hooks **ins Image**
  (Dockerfile `COPY`), Frontend über `app/Dockerfile`. Für den **Cloud-Produktivpfad irrelevant** —
  dort laufen PB + Frontend als systemd-Units hinter Caddy (`einrichten-cloud.sh`).

---

## ⏳ Offen — vor/beim Go-live

### 🔴 Zwingend

**#1 — Live-Superuser-Passwort rotieren** (manuell, durch Betreiber)
`pocketbase/seed-remote.sh` enthielt das echte PB-Superuser-Passwort im Klartext (gitignored, **nie
committed** — verifiziert). Trotzdem: **Passwort rotieren** und den Literal aus der Datei entfernen
(per `read -s`-Prompt oder Env außerhalb des Repos). Es wurde im Review sichtbar.

**#2 — Produktiv-Admin manuell anlegen, keine Seeds gegen Prod** (Betriebsregel)
Der erste App-Admin wird von `provision.mjs` interaktiv abgefragt (oder per `APP_ADMIN_EMAIL`/
`APP_ADMIN_PASS`); ein reiner Arcane-/Docker-Deploy legt **kein** Konto an (nur Migrations+Hooks). **Regel:**
Produktiv-Admin mit **starkem** Passwort selbst anlegen; die `demo-*`-Seeds sind lokal-only (der
Guard blockiert sie gegen nicht-lokale Ziele).

**#3 — PocketBase nicht als Klartext-HTTP erreichbar** (Deploy)
- **Cloud (Caddy): bereits gelöst.** `einrichten-cloud.sh` startet PB mit
  `--http=127.0.0.1:8090` → PB lauscht **nur auf Loopback**, ist von außen gar nicht erreichbar;
  Caddy terminiert TLS und reicht `db.<domain>` → `127.0.0.1:8090` durch. Ports 8090/4173 bleiben
  in der Firewall zu (nur 80/443 offen). ✅
- **LAN:** hier nutzt der Betrieb PB bewusst direkt über `http://<lan-ip>:8090`. Absichern per
  **Host-/Router-Firewall** (Port 8090 nur im LAN, nie ins Internet forwarden); wer im LAN auch TLS
  will, kann Caddy lokal davorstellen — kein Muss.
- **on-board:** kein Netz-Exposé, entfällt.
- *(Der `8090:8090`-Port in `pocketbase/docker-compose.yaml` betrifft nur den Arcane-/Docker-Homelab-Pfad.)*

### 🟡 Mittel

**#5 — PB-Admin-Konsole `/_/` abschirmen** (Deploy)
Das Login-Panel `/_/` ist ein Brute-Force-Ziel. **Nur relevant, wo PB von außen erreichbar ist —
also im Cloud-Modus** (im LAN via Firewall/VPN; on-board entfällt).
- **Cloud:** am **Caddy** die `/_/`-Route per **IP-Allowlist** (oder `basic_auth` bei dynamischer IP)
  abschirmen — fertiger, **auskommentierter** Block im generierten `/etc/caddy/Caddyfile` **und** in
  `Caddyfile.example` (siehe Template unten). Die API (`/api/...`) bleibt offen — nur die UI wird
  gesperrt. **Aktiv schalten** = einzige echte Handarbeit hier.
- **PB-Rate-Limit** und **Superuser-MFA** in den PocketBase-Einstellungen (`/_/` → Settings) aktivieren
  — schützt den Auth-Endpunkt gegen Brute-Force, unabhängig von der UI-Abschirmung. Gilt in **allen**
  Modi, in denen `/_/` erreichbar ist.

> **CORS ist in der Cloud bereits gesetzt — nicht mehr im UI, sondern per CLI-Flag:** die
> PocketBase-Unit läuft mit **`--origins=https://app.<domain>`** (setzt `einrichten-cloud.sh`
> automatisch). PB 0.39 hat **keine CORS-Einstellung im Dashboard** mehr, aber das `--origins`-Flag
> (Default `*`) — kein manueller UI-Schritt. Sicherheitlich ist CORS bei **Token-Auth** (JWT im
> localStorage, keine Cookies) ohnehin nur Defense-in-Depth: eine Fremd-Origin kommt nicht ans Token.

**#9 — CSP aktivieren** (Deploy, **nur Cloud**)
Die Security-Header stehen (Caddy `security_headers`-Snippet), aber die **Content-Security-Policy**
liegt als Vorlage **auskommentiert** im Caddyfile (`app.<domain>`-Block). Auf die echte PB-Domain
anpassen (**`connect-src` MUSS `https://db.<domain>` enthalten**, sonst schlägt jeder API-Aufruf fehl),
einkommentieren, `sudo caddy validate` + `systemctl reload caddy`, dann testen. Siehe Template unten.

**#10 — JWT im localStorage** (durch #9 mitigiert)
PB speichert das Token JS-lesbar → bei XSS exfiltrierbar. Primäre Mitigation: strikte **CSP** (#9)
aktivieren. Kein XSS-Sink im Code vorhanden → Restrisiko gering.

**#12 — Kompletter Kader für jeden eingeloggten Nutzer lesbar** (Abwägung)
Als Vereins-Verzeichnis vertretbar (E-Mails sind geschützt). Bei Minderjährigen im Verein abwägen,
ob die Kaderliste weiter eingeschränkt werden soll.

---

## Pre-Go-live-Checkliste

**Alle Modi (immer):**
- [ ] **#1** PB-Superuser-Passwort rotiert, Literal aus `seed-remote.sh` entfernt.
- [ ] **#2** Produktiv-Admin manuell mit **starkem** Passwort angelegt; keine Seeds gegen Prod gelaufen.
- [ ] Starke, einzigartige Passwörter für alle Konten (Passwortmanager).
- [ ] **#5 (Teil)** PB-**Rate-Limit + Superuser-MFA** an (`/_/` → Settings) — überall, wo `/_/` erreichbar ist.

**Nur LAN-Modus (zusätzlich):**
- [ ] **#3** Port 8090 per Host-/Router-Firewall auf das LAN begrenzt, **nie** ins Internet geforwardet.
- [ ] **#5** `/_/` per Firewall/VPN abgeschirmt (oder lokalen Caddy davorstellen).

**Nur Cloud-Modus (Caddy) — zusätzlich:**
- [ ] `einrichten-cloud.sh` ausgeführt → PB an `127.0.0.1:8090`, Frontend an `127.0.0.1:4173`, Caddy aktiv.
- [ ] DNS-A-Records `app.<domain>` + `db.<domain>` zeigen auf die Server-IP; **nur Ports 80/443 offen**.
- [ ] **#3** ✅ automatisch (PB nur Loopback) — verifizieren: `curl http://<public-ip>:8090` schlägt fehl.
- [ ] **HTTPS/HSTS** ✅ automatisch (Caddy Auto-Let's-Encrypt + `security_headers`-Snippet) — verifizieren.
- [ ] **CORS** ✅ automatisch (`--origins=https://app.<domain>`) — verifizieren.
- [ ] **#5** `/_/`-Allowlist-Block im `/etc/caddy/Caddyfile` **einkommentiert** (eigene IP via `curl ifconfig.me`), `caddy validate` + `reload`.
- [ ] **#9** CSP im `app.<domain>`-Block **einkommentiert**, `connect-src` = echte `db.<domain>`, getestet.

---

## Caddyfile-Template (nur Cloud-Modus)

> **Gilt ausschließlich für den Cloud-Modus.** on-board & LAN brauchen kein Caddy.
> `einrichten-cloud.sh` **generiert `/etc/caddy/Caddyfile` automatisch** aus den Domains — das Template
> unten (`Caddyfile.example`) ist die Referenz zum Nachvollziehen und für manuelle Anpassungen (#5/#9).
> Nach jeder Änderung: `sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy`.

```caddyfile
# (optional) globale Optionen — E-Mail für Zertifikats-Benachrichtigungen:
# { email du@deinedomain.de }

# ── Basis-Security-Header (Befund #9/#13) — HSTS aktiv, da Caddy nur HTTPS ausliefert ──
(security_headers) {
	header {
		Strict-Transport-Security "max-age=63072000; includeSubDomains"
		X-Content-Type-Options "nosniff"
		Referrer-Policy "strict-origin-when-cross-origin"
		Permissions-Policy "camera=(), microphone=(), geolocation=()"
		-Server
	}
}

# ── Frontend (systemd: darts-web.service auf 127.0.0.1:4173) ──
app.deinedomain.de {
	encode zstd gzip
	import security_headers
	header X-Frame-Options "DENY"           # App wird nirgends eingebettet

	# #9 CSP — DEPLOYMENT-SPEZIFISCH, ERST nach Test einkommentieren.
	# connect-src MUSS die PB-Domain enthalten, sonst schlägt jeder API-Call fehl.
	# header Content-Security-Policy "default-src 'self'; connect-src 'self' https://db.deinedomain.de; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"

	reverse_proxy 127.0.0.1:4173
}

# ── PocketBase (systemd: darts-pocketbase.service auf 127.0.0.1:8090) ──
db.deinedomain.de {
	encode zstd gzip
	import security_headers
	header X-Frame-Options "SAMEORIGIN"     # PB-Admin-UI /_/ nutzt ggf. eigene Frames

	reverse_proxy 127.0.0.1:8090

	# #5 Admin-Konsole /_/ nur aus deinem Netz. Zum Aktivieren: die reverse_proxy-Zeile
	# OBEN entfernen (Caddy darf handle-Blöcke nicht mit nackter reverse_proxy mischen)
	# und diesen Block einkommentieren. Eigene IP: `curl ifconfig.me` (/32 = genau diese IP).
	#   @admin path /_/*
	#   handle @admin {
	#   	@blocked not remote_ip 203.0.113.45/32 192.168.0.0/16
	#   	respond @blocked "Forbidden" 403
	#   	reverse_proxy 127.0.0.1:8090
	#   }
	#   handle { reverse_proxy 127.0.0.1:8090 }
}
```

**Warum das sicher ist (Cloud):** Caddy erzwingt **HTTPS/WSS** (Auto-Let's-Encrypt, HSTS) → kein
Netzwerk-Mitlesen. PB + Frontend lauschen **nur auf Loopback** → nur Caddy spricht mit ihnen, von außen
sind 8090/4173 unerreichbar. Angriffsfläche = ein Caddy-Binary + zwei localhost-Dienste, kein
Docker-/Arcane-Stack.

### Secrets im Cloud-Modus (systemd)

Ohne einen Docker-Secrets-Store liegen Geheimnisse (z. B. der geplante **autodarts-Token**,
[`autodarts-api.md`](autodarts-api.md)) als **`EnvironmentFile`** einer systemd-Unit:
`/etc/dartszentrale/*.env`, **`chmod 600`, `root`-only**, **nicht** im Git-Repo. So verlässt der Token
nie den Server und landet in keinem Browser-Bundle.

## Optional / später

- **2FA für Admins** — siehe [`plan-2fa.md`](plan-2fa.md).
- **autodarts-Autoscore** — falls angebunden: Token-Handling wie oben (systemd `EnvironmentFile`),
  Listener schreibt mit eng berechtigtem Service-Account, siehe [`autodarts-api.md`](autodarts-api.md).
