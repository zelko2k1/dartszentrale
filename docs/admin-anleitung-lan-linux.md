# DartsZentrale im Vereinsnetz (LAN) – Inbetriebnahme & Updates (Linux / Raspberry Pi)

Schritt für Schritt, ohne Vorkenntnisse. (Windows? → [admin-anleitung-lan-windows.md](admin-anleitung-lan-windows.md).)

Dieser Weg ist die **einfache Vereinsvariante:** **ein einziges Programm** (PocketBase) liefert die
App **und** die Daten — **kein Node, kein Build.** Ideal fürs Vereinsnetz mit mehreren Brettern/Tablets.

> **Andere Betriebsarten:**
> - **Nur ein Gerät, ohne Anmeldung** (starten & loslegen, Daten im Browser) → Paket
>   `01-lokal-ein-board` ([anleitung-lokal-linux.md](anleitung-lokal-linux.md)).
> - **Server im Internet/Cloud** (von überall erreichbar) → Paket `03-verein-cloud`
>   ([admin-anleitung-cloud.md](admin-anleitung-cloud.md)).
>
> Tägliche Bedienung: [`handbuch.md`](handbuch.md) · Sicherheit: [`security-audit.md`](security-audit.md).

---

## 0. Einmal vorweg

### 0a. Die App auf den Rechner holen — der „Ordner"
Du bekommst das Paket **`02-verein-lan`** als Ordner (USB-Stick/Share vom Einrichter). Darin liegen u. a.
`start-verein-lan.sh`, `pb_public/`, `pb_migrations/`, `pb_hooks/`. **Alle Befehle gehören in diesen Ordner.**

> **Node.js ist NICHT nötig.** Das Programm ist ein einziges Binary, das beim ersten Start automatisch
> geladen wird. Du brauchst nur **einmal Internet** beim allerersten Start.

### 0b. Terminal im Ordner öffnen
Im Dateimanager den Ordner öffnen → **Rechtsklick → „Im Terminal öffnen"**. Läuft ein Befehl „endlos"
weiter (der Server), ist das **gewollt** — Fenster **offen lassen**.

### 0c. Platzhalter in Befehlen
`<server-ip>` u. Ä. durch deinen Wert ersetzen (**Klammern `< >` weglassen**). **Server-IP finden:**
`hostname -I` (erste Zahl, z. B. `192.168.1.50`).

---

## 1. Starten & einrichten (ein Befehl)

Im Terminal im Ordner:
```bash
./start-verein-lan.sh
```
Beim **allerersten Start** passiert automatisch:
1. das **PocketBase-Binary** wird geladen (~15 MB, einmal Internet nötig),
2. es werden **zwei Konten abgefragt**, die **du** festlegst — die Passwörter werden **nicht
   gespeichert** (im Passwortmanager notieren!):
   - **PocketBase-Konsole** (Wartung/Notfall unter `…:8090/_/`)
   - **App-Administrator** (dein tägliches Login *in der App*)
3. die App startet, der Browser öffnet **`http://127.0.0.1:8090`**.

Jedes weitere Mal genügt derselbe Befehl `./start-verein-lan.sh` — die Einrichtung läuft **nur beim
ersten Mal**. **Fenster offen lassen; beenden mit Strg+C.**

> Nur dieses eine Gerät (kein Netzzugriff)? `HOST=127.0.0.1 ./start-verein-lan.sh`.

---

## 2. Andere Bretter & Tablets anbinden

Die App ist im Netz unter **`http://<server-ip>:8090`** erreichbar.
- **Board-PC:** diese Adresse als **Lesezeichen / Kiosk-Verknüpfung** anlegen.
- **Tablet/Handy:** in der App unter *Einstellungen* den **Beitritts-QR** scannen.

Mit dem jeweiligen Konto anmelden.

---

## 3. Autostart (Board startet beim Hochfahren von selbst)

```bash
./autostart-verein-lan.sh
```
Richtet **einen** systemd-User-Dienst ein (Autostart beim Boot, Neustart bei Absturz). Voraussetzung:
einmal `./start-verein-lan.sh` gelaufen (Binary + Konten vorhanden).
- Status: `systemctl --user status dartszentrale`
- Logs: `journalctl --user -u dartszentrale -f`
- Entfernen: `systemctl --user disable --now dartszentrale`

---

## 4. Die zwei Logins nicht verwechseln

| | **App-Administrator** | **PocketBase-Superuser** |
|---|---|---|
| Wofür? | normale Nutzung (Verein verwalten) | Datenbank/Server verwalten, Backups |
| Wo anmelden? | in der App (`…:8090`) | unter `…:8090/_/` |
| Wie oft? | täglich | selten (Backups, Notfall) |

---

## 5. Backups (wichtig!)

Eine ganze Saison hängt an **`pb_data/`**. Richte Backups ein:
- **PocketBase-Backups:** `…:8090/_/` → **Settings → Backups** → Zeitplan (z. B. täglich).
- **Zusätzlich** `pb_data/` regelmäßig auf einen Stick/anderes Gerät kopieren (Schutz vor Geräteverlust).

---

## 6. Updates einspielen

Eine neue Version kommt als **`dartszentrale-update-<version>.tar.gz`**. **Deine Daten (`pb_data/`)
bleiben unangetastet.**

```bash
./update-verein-lan.sh                 # nimmt das neueste Paket im Ordner updates/
./update-verein-lan.sh /media/usb      # oder Pfad zum Stick/Paket angeben
```
Tauscht das Frontend in `pb_public/` aus — **kein Neustart nötig**, an den Brettern nur die Seite neu
laden (ggf. zweimal, wegen PWA-Cache). Die alte Version landet in `backup/`.

> **Ändern sich Migrationen/Hooks (Backend)?** Dann den **kompletten Ordner** durch die neue Version
> ersetzen und dabei **`pb_data/` behalten** (deine Datenbank). Migrationen laufen beim nächsten Start.

---

## 7. Netz & Sicherheit

- **Port 8090 nur im LAN lassen — NIE ins Internet weiterleiten/portforwarden.** Wer von außen
  erreichbar sein will, nimmt das **Cloud-Paket** (TLS via Caddy).
- Die PocketBase-Konsole `…:8090/_/` nur im vertrauenswürdigen Netz nutzen; in den Settings
  **Rate-Limit** und **Superuser-2FA** aktivieren. Details: [`security-audit.md`](security-audit.md).

---

## 8. Wenn etwas nicht klappt

- **Bricht sofort ab / „command not found"** → im richtigen Ordner? (`start-verein-lan.sh` muss dort liegen; ausführbar: `chmod +x start-verein-lan.sh`.)
- **Andere Geräte erreichen den Server nicht** → mit LAN-Bind gestartet (Standard `0.0.0.0`)? Firewall
  (`ufw`) für Port 8090 im LAN offen? Richtige **`<server-ip>`**?
- **„Port belegt"** → es läuft schon ein Server/der Autostart-Dienst: `systemctl --user status dartszentrale`.
- **Erstes Binary lädt nicht** → einmal Internet nötig; hinter Proxy ggf. die `pocketbase`-Binärdatei manuell in den Ordner legen.

---

## 9. Notfälle (Passwörter)

- **App-Passwort vergessen** → in der App als Admin zurücksetzen, oder über die Konsole `…:8090/_/` → `users` → Konto → neues Passwort.
- **Superuser-Passwort weg** → Programm/Dienst stoppen, dann neu setzen:
  `./pocketbase superuser upsert <mail> "<neues-pw>" --dir ./pb_data`.
- **Vorsorge:** beide Passwörter in den **Passwortmanager**; früh einen **zweiten App-Admin** anlegen.

---

## Anhang — Welche Datei wofür?

| Datei | Zweck |
|---|---|
| `./start-verein-lan.sh` | **Starten** (Erststart lädt das Binary + legt die zwei Konten an) |
| `./autostart-verein-lan.sh` | **Autostart** beim Hochfahren (systemd-User-Dienst) |
| `./update-verein-lan.sh` | **Update** einspielen (tauscht `pb_public/`, `pb_data/` bleibt) |
| `pb_public/` | das ausgelieferte Frontend (wird beim Update getauscht) |
| `pb_migrations/` · `pb_hooks/` | Schema & Server-Funktionen |
| `pb_data/` | **deine Datenbank** (entsteht beim ersten Start) — **sichern!** |

> Fertige Verteil-Pakete (genau diese Dateien je Betriebsart, ohne Test-/Secret-Dateien) erzeugt der
> Einrichter mit dem `copy2share`-Vorgang.
