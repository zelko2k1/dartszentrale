# DartsHub in der Cloud betreiben — praktische Checkliste

Diese Anleitung sagt dir **was du brauchst**, **was es kostet** und **was du in welcher
Reihenfolge tun musst**, um die fertige App online laufen zu lassen.

Die rein technischen Details stehen in:
- [`COOLIFY-SETUP.md`](COOLIFY-SETUP.md) — Klick-für-Klick im Coolify
- [`pocketbase/SCHEMA.md`](../pocketbase/SCHEMA.md) — Datenmodell & Rechte (aktuelle Lese-Referenz)

Wenn die App läuft: **[`docs/handbuch.md`](handbuch.md)** erklärt die tägliche Nutzung
(Anmelden, Spieler/Mannschaften/Ligen, Counter, Board-Modus, Rollen, Backups).

> **Wichtig vorab:** Online-Betrieb brauchst du **nur für den Vereinsmodus**
> (mehrere Geräte, echte Logins, geteilte Daten). Der **lokale Modus** läuft komplett
> ohne Server im Browser — dafür ist nichts hiervon nötig.

---

## 1. Was du brauchst (Einkaufsliste)

| # | Was | Wofür | Kosten (ca.) |
|---|-----|-------|--------------|
| 1 | **Cloud-Server (VPS)** bei Hetzner | Läuft die App + Datenbank | ~4–8 €/Monat (Sizing s. u.) |
| 2 | **Domain** (z. B. `dartshub.de`) | Adresse + HTTPS für die PWA | ~10–15 €/Jahr |
| 3 | **Coolify** (kostenlose Software) | Verwaltet Deploy, HTTPS, Updates | 0 € (läuft auf dem Server) |
| 4 | **GitHub-Konto** (hast du schon ✔) | Coolify holt die App von hier | 0 € |
| 5 | *(optional)* Hetzner **Storage Box / S3** | Externe Backups der Datenbank | ~3–4 €/Monat |

**Gesamtkosten:** rund **5–9 € im Monat** (mit ARM/Spar-Optionen ab ~4 €) plus einmal ~12 €/Jahr für die Domain.

### Konkrete Empfehlung
- **Server (Sweet Spot):** Hetzner **CAX11** (ARM, 2 vCPU, **4 GB** RAM, 40 GB) — **~4 €/Monat**
  und damit günstiger als der x86-**CX22** (gleiche Eckdaten). PocketBase, nginx und der Build
  laufen sauber auf ARM. Beim Anlegen **Ubuntu 24.04** wählen.
- **Domain:** bei einem beliebigen Anbieter (Hetzner, Namecheap, INWX …). Hauptsache du
  kommst an die **DNS-Einstellungen** (A-Records).

### Wie groß muss der Server sein? (und wie man spart)

**Wichtig:** Die App selbst ist winzig — der Bedarf kommt fast nur von **Coolify** und vom
**Build**. Drei sehr unterschiedliche Lasten:

| Last | RAM | CPU | Bemerkung |
|---|---|---|---|
| **Coolify** (Steuerebene, läuft dauerhaft) | ~0,8–1,2 GB | ~1 vCPU idle | der eigentliche „Mieter" |
| **DartsHub-Laufzeit** (PocketBase + nginx) | ~50–100 MB | praktisch 0 | schlankes Go-Binary + SQLite |
| **Build-Spitze** (`npm install` + Vite-Build) | kurz 1–2 GB | 1–2 Kerne | **Engpass** auf kleinen Servern, nur beim Deploy |

**Sizing:**

| Variante | vCPU | RAM | Disk | Tauglich? |
|---|---|---|---|---|
| Coolify **knapp** | 2 | **2 GB + 2 GB Swap** | 30–40 GB | ✅ Swap fängt die Build-Spitze ab |
| Coolify **komfortabel** | 2 | **4 GB** | 40 GB | ✅ empfohlen (CAX11/CX22) |
| **Ohne Coolify** (nur Docker Compose) | 1 | **1–2 GB** | 20 GB | ✅ billigste Variante, etwas mehr Handarbeit |

**Disk:** Coolify+Docker-Basis ~5–8 GB · Images/Build-Cache wächst auf 5–15 GB
(⚠️ regelmäßig aufräumen: Coolify-Cleanup aktivieren bzw. `docker system prune -af`) ·
`pb_data` (DB + Spielerfotos) realistisch 50 MB – einige hundert MB. → **20 GB Minimum,
40 GB entspannt.**

**Spar-Hebel:**
1. **ARM statt x86** (Hetzner CAX-Linie): gleiches RAM, günstiger — voll kompatibel.
2. **2 GB + Swap** statt 4 GB: 2-GB-Box + 2-GB-Swap-Datei (kostenlos) übersteht die Builds.
3. **Build auslagern:** Image in GitHub Actions bauen → in die GitHub-Registry pushen →
   Coolify zieht nur das fertige Image. Dann reichen 2 GB locker.
4. **Coolify weglassen:** nur `docker-compose` (PocketBase + nginx + Caddy für HTTPS) auf einem
   1-GB-Nano (~3–4 €). Spart Coolifys ~1-GB-Dauergewicht, kostet dafür dessen Komfort-UI
   (Auto-Deploy, Klick-HTTPS, Log-Ansicht).

---

## 2. Welche Daten/Zugänge du bereithalten musst

Leg dir diese Dinge **vorher** zurecht — du brauchst sie während der Einrichtung:

| Daten | Woher / Beispiel |
|-------|------------------|
| **Server-IP-Adresse** | bekommst du von Hetzner nach dem Anlegen, z. B. `203.0.113.10` |
| **SSH-Zugang zum Server** | SSH-Key oder root-Passwort (bei Hetzner beim Erstellen festgelegt) |
| **Domain + DNS-Zugang** | Login bei deinem Domain-Anbieter |
| **Zwei Subdomains** | `app.deinedomain.de` (App) + `db.deinedomain.de` (Datenbank) |
| **GitHub-Repo-URL** | `https://github.com/zelko2k1/dartshub` (hast du ✔) |
| **PocketBase-Admin-Login** | E-Mail + sicheres Passwort, das du dir **jetzt ausdenkst** |
| **Erster App-Admin-Login** | E-Mail + Passwort für deinen Login *in der App* (separat vom PB-Admin!) |

> **Merke dir den Unterschied:**
> - **PocketBase-Admin** = Server-/Datenbank-Verwaltung (`db.deinedomain.de/_/`)
> - **App-Admin** = dein normaler Login *in der DartsHub-App* (Rolle `admin`)
> Das sind zwei verschiedene Konten mit zwei verschiedenen Passwörtern.

---

## 3. Reihenfolge der Schritte (Überblick)

```
1. Hetzner-Server bestellen      →  IP-Adresse notieren
2. Domain besorgen / DNS         →  app.* und db.* auf die IP zeigen lassen
3. Coolify auf dem Server        →  ein Installationsbefehl
4. PocketBase deployen           →  Datenbank läuft unter db.*
5. PocketBase einrichten         →  Admin + Collections + Rechte
6. Frontend (App) deployen       →  App läuft unter app.*
7. Ersten App-Admin anlegen      →  einloggen, fertig
```

Details zu Schritt 4–7: **[`COOLIFY-SETUP.md`](COOLIFY-SETUP.md)**.

---

## 4. Schritt für Schritt

### Schritt 1 — Server bestellen
1. Bei [hetzner.com/cloud](https://www.hetzner.com/cloud) Konto anlegen.
2. Neuen Server **CAX11 (ARM) oder CX22**, jeweils **Ubuntu 24.04**, erstellen — SSH-Key hinterlegen.
3. **IP-Adresse notieren.**

### Schritt 2 — DNS einrichten
Beim Domain-Anbieter zwei **A-Records** anlegen, beide auf die Server-IP:
```
app.deinedomain.de   A   203.0.113.10
db.deinedomain.de    A   203.0.113.10
```
(DNS-Änderungen können bis zu ein paar Stunden dauern.)

### Schritt 3 — Coolify installieren
Per SSH auf den Server verbinden und den offiziellen Installer ausführen:
```bash
ssh root@203.0.113.10
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```
Danach Coolify im Browser öffnen (`http://203.0.113.10:8000`) und das
Coolify-Admin-Konto anlegen.

### Schritt 4–7 — App & Datenbank deployen
Ab hier folgst du **[`COOLIFY-SETUP.md`](COOLIFY-SETUP.md)**.
Das Wichtigste in Kürze:

- **PocketBase:** in Coolify als *Docker Compose* aus `pocketbase/docker-compose.yaml`,
  Domain `db.deinedomain.de`, Port **8090**, **Volume `pb_data` persistent** (sonst Datenverlust!).
- **Frontend:** in Coolify *aus Git-Repo* (`zelko2k1/dartshub`, Pfad `app/`).
  Eine **Environment-Variable** ist entscheidend:
  ```
  VITE_PB_URL = https://db.deinedomain.de
  ```
  Ohne sie kennt die App die Server-Adresse nicht.
  Domain: `app.deinedomain.de`.
- **CORS** in PocketBase: `https://app.deinedomain.de` als erlaubte Origin eintragen.
- **Collections + Rechte** entstehen beim Start **automatisch** (Migrations) — Übersicht: [`pocketbase/SCHEMA.md`](../pocketbase/SCHEMA.md).

---

## 5. Fertig — so nutzt ihr es

- `https://app.deinedomain.de` im Browser öffnen → beim **ersten Start „Vereinsmodus"
  wählen** → mit dem **App-Admin-Konto** anmelden. (Jedes Gerät wird einmalig gefragt.)
- In Edge/Chrome **„Als App installieren"** (PWA, funktioniert weil HTTPS vorhanden ✔).
- Weitere Mitglieder: Konten legt der **Admin in der App** an (Self-Registration ist aus
  Sicherheitsgründen deaktiviert).
- **Board-/Kiosk-Rechner** an den Brettern bekommen ein eigenes, rechtearmes Board-Konto
  (nicht den Admin-Login!):
  ```
  PB_URL=https://db.deinedomain.de PB_SU_EMAIL=… PB_SU_PASS=… \
  BOARD_EMAIL=board1@deinedomain.de BOARD_PW=<starkes-pw> \
  node pocketbase/add-board-account.mjs
  ```

➡️ **Tägliche Bedienung** der App: **[`handbuch.md`](handbuch.md)**.

---

## 6. Laufender Betrieb (nicht vergessen)

- **Sicherheit vor dem Online-Gang** (Haken-Liste in [`security-audit.md`](security-audit.md)).
  Das Wichtigste in Kürze:
  - **Keine Demo-/Seed-Skripte gegen die Produktiv-DB** laufen lassen — den App-Admin
    **manuell mit starkem Passwort** anlegen. Die `demo-*.mjs` sind nur für lokale Tests
    (sie verweigern sich gegen ein nicht-lokales Ziel ohnehin von selbst).
  - **PocketBase-Konsole `/_/`** nicht offen ins Internet stellen (per Coolify/Proxy bzw.
    Firewall absichern); **Superuser-Passwort** stark wählen und sicher verwahren.
  - **HTTPS erzwingen** (Coolify macht das) — nie Klartext-HTTP; Port **8090** nicht direkt
    aus dem Internet erreichbar machen.
- **Backups:** in PocketBase automatische Backups aktivieren und gelegentlich einen
  Restore testen. Die Daten liegen alle im Volume `pb_data`.
- **Updates der App:** Code pushen → Coolify neu deployen (oder Auto-Deploy aktivieren).
- **PocketBase-Version pinnen:** in `docker-compose.yaml` statt `:latest` eine feste
  Version eintragen und Updates kontrolliert einspielen.
- **Passwort vergessen?** Der **PocketBase-Superuser** ist der Notfall-Schlüssel: in
  `…/_/` → Collection `users` neu setzen, oder per Skript
  `USER_EMAIL=… NEW_PW=… node pocketbase/reset-password.mjs`. Ist auch das
  Superuser-Passwort weg: `./pocketbase superuser upsert <email> "<pw>" --dir ./pb_data`.
  Details in [`handbuch.md`](handbuch.md) §13. **Superuser-Passwort sicher aufbewahren!**

---

## 7. Spickzettel — was bei jedem Schritt anfällt

| Du brauchst … | … spätestens bei Schritt |
|---|---|
| Hetzner-Konto + Zahlungsmittel | 1 |
| SSH-Key | 1 / 3 |
| Domain + DNS-Zugang | 2 |
| Coolify-Admin-Login (ausdenken) | 3 |
| PocketBase-Admin-Login (ausdenken) | 5 |
| App-Admin-Login (ausdenken) | 7 |
