# DartsHub in der Cloud betreiben — praktische Checkliste

Diese Anleitung sagt dir **was du brauchst**, **was es kostet** und **was du in welcher
Reihenfolge tun musst**, um die fertige App online laufen zu lassen.

Die rein technischen Details stehen in:
- [`pocketbase/COOLIFY-SETUP.md`](../pocketbase/COOLIFY-SETUP.md) — Klick-für-Klick im Coolify
- [`docs/verein-pocketbase-plan.md`](verein-pocketbase-plan.md) — Datenmodell & Rechte

Wenn die App läuft: **[`docs/handbuch.md`](handbuch.md)** erklärt die tägliche Nutzung
(Anmelden, Spieler/Mannschaften/Ligen, Counter, Board-Modus, Rollen, Backups).

> **Wichtig vorab:** Online-Betrieb brauchst du **nur für den Vereinsmodus**
> (mehrere Geräte, echte Logins, geteilte Daten). Der **lokale Modus** läuft komplett
> ohne Server im Browser — dafür ist nichts hiervon nötig.

---

## 1. Was du brauchst (Einkaufsliste)

| # | Was | Wofür | Kosten (ca.) |
|---|-----|-------|--------------|
| 1 | **Cloud-Server (VPS)** bei Hetzner | Läuft die App + Datenbank | ~5–8 €/Monat (CX22) |
| 2 | **Domain** (z. B. `dartshub.de`) | Adresse + HTTPS für die PWA | ~10–15 €/Jahr |
| 3 | **Coolify** (kostenlose Software) | Verwaltet Deploy, HTTPS, Updates | 0 € (läuft auf dem Server) |
| 4 | **GitHub-Konto** (hast du schon ✔) | Coolify holt die App von hier | 0 € |
| 5 | *(optional)* Hetzner **Storage Box / S3** | Externe Backups der Datenbank | ~3–4 €/Monat |

**Gesamtkosten:** rund **6–9 € im Monat** plus einmal ~12 €/Jahr für die Domain.

### Konkrete Empfehlung
- **Server:** Hetzner Cloud, Typ **CX22** (2 vCPU, 4 GB RAM) — für einen Verein dick ausreichend.
  Beim Anlegen **Ubuntu 24.04** wählen.
- **Domain:** bei einem beliebigen Anbieter (Hetzner, Namecheap, INWX …). Hauptsache du
  kommst an die **DNS-Einstellungen** (A-Records).

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

Details zu Schritt 4–7: **[`pocketbase/COOLIFY-SETUP.md`](../pocketbase/COOLIFY-SETUP.md)**.

---

## 4. Schritt für Schritt

### Schritt 1 — Server bestellen
1. Bei [hetzner.com/cloud](https://www.hetzner.com/cloud) Konto anlegen.
2. Neuen Server **CX22 / Ubuntu 24.04** erstellen, SSH-Key hinterlegen.
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
Ab hier folgst du **[`pocketbase/COOLIFY-SETUP.md`](../pocketbase/COOLIFY-SETUP.md)**.
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
- **Collections + Rechte** anlegen (Datenmodell siehe `docs/verein-pocketbase-plan.md`).

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
