# DartsZentrale im Vereinsnetz (LAN) – Inbetriebnahme & Updates (Windows)

**🇩🇪 Deutsch | [🇬🇧 English](../admin-guide-lan-windows.md)**

Schritt für Schritt, ohne Vorkenntnisse. (Linux/Raspberry Pi? → [admin-anleitung-lan-linux.md](admin-anleitung-lan-linux.md).)

Dieser Weg ist die **einfache Vereinsvariante:** **ein einziges Programm** (PocketBase) liefert die
App **und** die Daten — **kein Node, kein Build.** Ideal fürs Vereinsnetz mit mehreren Brettern/Tablets.

> **Andere Betriebsarten:**
> - **Nur ein Gerät, ohne Anmeldung** (starten & loslegen, Daten im Browser) → Paket
>   `01-lokal-ein-board` ([anleitung-lokal-windows.md](anleitung-lokal-windows.md)).
> - **Server im Internet/Cloud** (von überall erreichbar) → Paket `03-verein-cloud`
>   ([admin-anleitung-cloud.md](admin-anleitung-cloud.md)).
>
> Tägliche Bedienung: [`handbuch.md`](handbuch.md) · Sicherheit: [`security-audit.md`](../security-audit.md).

---

## 0. Einmal vorweg

### 0a. Die App auf den Rechner holen — der „Ordner"
Du bekommst das Paket **`02-verein-lan`** als Ordner (USB-Stick/Share vom Einrichter). Darin liegen u. a.
`start-club-lan.bat`, `pb_public\`, `pb_migrations\`, `pb_hooks\`. **Alles gehört in diesen Ordner.**

> **Node.js ist NICHT nötig.** Das Programm ist ein einziges Binary, das beim ersten Start automatisch
> geladen wird. Du brauchst nur **einmal Internet** beim allerersten Start.

### 0b. Platzhalter
`<server-ip>` u. Ä. durch deinen Wert ersetzen (**Klammern `< >` weglassen**). **Server-IP finden:**
Eingabeaufforderung → `ipconfig` → „IPv4-Adresse" (z. B. `192.168.1.50`).

---

## 1. Starten & einrichten (Doppelklick)

**Doppelklick auf `start-club-lan.bat`** im Ordner.

Beim **allerersten Start** passiert automatisch:
1. das **PocketBase-Binary** wird geladen (~15 MB, einmal Internet nötig),
2. es werden **zwei Konten abgefragt**, die **du** festlegst — die Passwörter werden **nicht
   gespeichert** (im Passwortmanager notieren!):
   - **PocketBase-Konsole** (Wartung/Notfall unter `…:8090/_/`)
   - **App-Administrator** (dein tägliches Login *in der App*)
3. die App startet, der Browser öffnet **`http://127.0.0.1:8090`**.

Jedes weitere Mal genügt wieder der Doppelklick auf `start-club-lan.bat` — die Einrichtung läuft
**nur beim ersten Mal**. **Fenster offen lassen; zum Beenden das Fenster schließen.**

> Bricht das Fenster sofort ab? Meist ist das Antivirus/SmartScreen im Weg — Ordner freigeben.

---

## 2. Andere Bretter & Tablets anbinden

Die App ist im Netz unter **`http://<server-ip>:8090`** erreichbar.
- **Board-PC:** diese Adresse als **Lesezeichen / Kiosk-Verknüpfung** anlegen.
- **Tablet/Handy:** in der App unter *Einstellungen* den **Beitritts-QR** scannen.

Mit dem jeweiligen Konto anmelden.

---

## 3. Autostart (Board startet beim Anmelden von selbst)

**Doppelklick auf `autostart-club-lan.bat`** — legt eine Startup-Verknüpfung an. Voraussetzung:
einmal `start-club-lan.bat` gelaufen (Binary + Konten vorhanden).

> **Entfernen:** `Win+R` → `shell:startup` → dort `DartsZentrale.lnk` löschen.

---

## 4. Die zwei Logins nicht verwechseln

| | **App-Administrator** | **PocketBase-Superuser** |
|---|---|---|
| Wofür? | normale Nutzung (Verein verwalten) | Datenbank/Server verwalten, Backups |
| Wo anmelden? | in der App (`…:8090`) | unter `…:8090/_/` |
| Wie oft? | täglich | selten (Backups, Notfall) |

---

## 5. Backups (wichtig!)

Eine ganze Saison hängt an **`pb_data\`**. Richte Backups ein:
- **PocketBase-Backups:** `…:8090/_/` → **Settings → Backups** → Zeitplan (z. B. täglich).
- **Zusätzlich** `pb_data\` regelmäßig auf einen Stick/anderes Gerät kopieren (Schutz vor Geräteverlust).

---

## 6. Updates einspielen

Eine neue Version kommt als **`dartszentrale-update-<version>.tar.gz`**. **Deine Daten (`pb_data\`)
bleiben unangetastet.**

- Paket in den Ordner **`updates`** legen → **Doppelklick auf `update-club-lan.bat`**.
- Oder mit Pfad/Laufwerk: Eingabeaufforderung im Ordner → `update-club-lan.bat E:\` (Stick).

Tauscht das Frontend in `pb_public\` aus — **kein Neustart nötig**, an den Brettern nur die Seite neu
laden (ggf. zweimal, wegen PWA-Cache). Die alte Version landet in `backup\`.

> **Ändern sich Migrationen/Hooks (Backend)?** Dann den **kompletten Ordner** durch die neue Version
> ersetzen und dabei **`pb_data\` behalten** (deine Datenbank). Migrationen laufen beim nächsten Start.

---

## 7. Netz & Sicherheit

- **Port 8090 nur im LAN lassen — NIE ins Internet weiterleiten/portforwarden.** Wer von außen
  erreichbar sein will, nimmt das **Cloud-Paket** (TLS via Caddy).
- Die PocketBase-Konsole `…:8090/_/` nur im vertrauenswürdigen Netz nutzen; in den Settings
  **Rate-Limit** und **Superuser-2FA** aktivieren. Details: [`security-audit.md`](../security-audit.md).

---

## 8. Wenn etwas nicht klappt

- **Fenster schließt sofort** → Antivirus/SmartScreen? Ordner freigeben. Steht `pocketbase.exe` im Ordner (nach dem ersten Start)?
- **Andere Geräte erreichen den Server nicht** → Windows-Firewall fragt beim ersten Start nach — **Zugriff im privaten Netz erlauben**. Richtige **`<server-ip>`** (`ipconfig`)?
- **„Port belegt"** → es läuft schon ein Fenster/der Autostart. Das andere Fenster schließen.
- **Erstes Binary lädt nicht** → einmal Internet nötig; hinter Proxy ggf. `pocketbase.exe` manuell in den Ordner legen.

---

## 9. Notfälle (Passwörter)

- **App-Passwort vergessen** → in der App als Admin zurücksetzen, oder über die Konsole `…:8090/_/` → `users` → Konto → neues Passwort.
- **Superuser-Passwort weg** → Fenster schließen, dann in der Eingabeaufforderung im Ordner:
  `pocketbase.exe superuser upsert <mail> "<neues-pw>" --dir pb_data`.
- **Vorsorge:** beide Passwörter in den **Passwortmanager**; früh einen **zweiten App-Admin** anlegen.

---

## Anhang — Welche Datei wofür?

| Datei | Zweck |
|---|---|
| `start-club-lan.bat` | **Starten** (Erststart lädt das Binary + legt die zwei Konten an) |
| `autostart-club-lan.bat` | **Autostart** beim Anmelden (Startup-Verknüpfung) |
| `update-club-lan.bat` | **Update** einspielen (tauscht `pb_public\`, `pb_data\` bleibt) |
| `pb_public\` | das ausgelieferte Frontend (wird beim Update getauscht) |
| `pb_migrations\` · `pb_hooks\` | Schema & Server-Funktionen |
| `pb_data\` | **deine Datenbank** (entsteht beim ersten Start) — **sichern!** |

> Fertige Verteil-Pakete (genau diese Dateien je Betriebsart, ohne Test-/Secret-Dateien) erzeugt der
> Einrichter mit dem `copy2share`-Vorgang.
