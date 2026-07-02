# DartsHub lokal — ein Board, kein Server

Der einfachste Weg: die App läuft nur im Browser auf **einem** Gerät — **ohne Server, ohne
Anmeldung**. Die Daten liegen lokal im Browser dieses Geräts.

> Mehrere Geräte mit echten Logins, Ligen und Mannschaften? Das ist der **Vereinsmodus** —
> dafür gibt es ein eigenes Verteil-Paket (LAN bzw. Cloud).

---

## 1. Einmal: Node.js installieren (Pflicht)

- **Windows:** [nodejs.org](https://nodejs.org) öffnen → **LTS**-Version laden → Installer →
  Weiter / Weiter / Fertig.
- **Linux / Raspberry Pi:**
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt install -y nodejs
  ```
- **Prüfen:** ein Terminal öffnen, `node -v` eingeben → es muss `v20…` oder `v22…` erscheinen.

> Mehr braucht der lokale Modus **nicht** — kein PocketBase, keine Datenbank.

---

## 2. Starten

- **Windows:** Doppelklick auf **`start-lokal.bat`** im Projektordner.
- **Linux / Pi:** im Projektordner **`./start-lokal.sh`**.

Der Browser öffnet die App → beim **ersten Start „Lokal"** wählen. Fertig.
Das schwarze Fenster bzw. Terminal **offen lassen**, solange du die App nutzt
(Windows: Fenster schließen zum Beenden · Linux: **Strg+C**).

> Schließt sich das Fenster **sofort wieder** / bricht der Befehl ab? Dann fehlt meist
> **Node.js** (Schritt 1).

---

## 3. Autostart (Kiosk-Board)

Damit das Brett nach dem Hochfahren von selbst die App zeigt:

- **Windows:** Doppelklick auf **`autostart-lokal.bat`**.
- **Linux / Pi:** **`./autostart-lokal.sh`**.

Entfernen: **Windows** → `Win+R` → `shell:startup` → `DartsHub.lnk` löschen.
**Linux** → das Skript zeigt am Ende den passenden Entfernen-Befehl an.

---

## 4. Updates einspielen

### Einfachster Weg — direkt in der App (empfohlen)

1. Die Datei **`dartshub-update-<version>.tar.gz`** in den Ordner **`updates`** neben der App legen
   (den genauen Pfad zeigt die App unter *Einstellungen → App & Updates*; der Ordner wird beim
   Start automatisch angelegt).
2. In der App: **Einstellungen → „App & Updates" → „Nach Updates suchen"** → **„Installieren"**.

Die App tauscht die neue Version ein und lädt sich neu — **kein Neustart, kein Terminal**. Am
lokalen Board ist dafür kein Passwort/Token nötig (läuft nur auf diesem Gerät).

### Alternativ — per Skript (USB-Stick/Ordner)

Im Projektordner:

- **Windows:** Doppelklick auf **`update-lokal.bat`** (nimmt Laufwerk `E:\`; anderer Buchstabe:
  im Terminal `update-lokal.bat F:\`).
- **Linux / Pi:** **`./update-lokal.sh <quelle>`** (z. B. `./update-lokal.sh /media/usb`).

Das übernimmt die neuen Dateien und baut die App neu. Im lokalen Modus liegen die Daten im
Browser — es geht nichts verloren. Danach am Brett die Seite **neu laden**.

---

## 5. Bedienung

Der lokale Modus ist **bewusst reduziert**: **keine** Anmeldung, **keine** Rollen, Ligen,
Mannschaften oder Benutzerverwaltung. Im Mittelpunkt stehen:

- **Darts Counter** — ein Spiel zählen,
- **Board-/Kiosk-Modus** — die Vollbild-Ansicht fürs Brett.

Wie das genau geht, steht im [`handbuch.md`](handbuch.md), Abschnitte **10 (Counter)** und
**11 (Board-/Kiosk-Modus)**. (Die Abschnitte zu Login, Rollen, Ligen usw. betreffen nur den
Vereinsmodus und gelten hier nicht.)

---

## 6. Wenn etwas nicht klappt

- **Fenster geht sofort zu / Befehl bricht ab** → **Node.js** fehlt (Schritt 1).
- **„Port belegt" / `EADDRINUSE`** → die App läuft schon in einem anderen Fenster; eines schließen.
- **Alles zurücksetzen** → im Browser den **localStorage** der Seite leeren (dort liegen die Daten).
