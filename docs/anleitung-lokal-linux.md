# DartsZentrale lokal (Linux / Raspberry Pi) — ein Board, kein Server

Der einfachste Weg: die App läuft nur im Browser auf **einem** Gerät — **ohne Server, ohne
Anmeldung**. Die Daten liegen lokal im Browser dieses Geräts.

> Mehrere Geräte mit echten Logins, Ligen und Mannschaften? Das ist der **Vereinsmodus** —
> dafür gibt es ein eigenes Verteil-Paket (LAN bzw. Cloud).
>
> Windows? Siehe [`anleitung-lokal-windows.md`](anleitung-lokal-windows.md).

---

## 1. Einmal: Node.js installieren (Pflicht)

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
```

**Prüfen:** ein Terminal öffnen, `node -v` eingeben → es muss `v20…` oder `v22…` erscheinen.

> Mehr braucht der lokale Modus **nicht** — kein PocketBase, keine Datenbank.

---

## 2. Starten

Im Projektordner **`./start-lokal.sh`**.

Der Browser öffnet die App → beim **ersten Start „Lokal"** wählen. Fertig.
Das Terminal **offen lassen**, solange du die App nutzt (zum Beenden **Strg+C**).

> Bricht der Befehl **sofort** ab? Dann fehlt meist **Node.js** (Schritt 1).

---

## 3. Autostart (Kiosk-Board)

Damit das Brett nach dem Hochfahren von selbst die App zeigt: **`./autostart-lokal.sh`**.

Entfernen: Das Skript zeigt am Ende den passenden Entfernen-Befehl an.

---

## 4. Updates einspielen

### Einfachster Weg — direkt in der App (empfohlen)

1. Die Datei **`dartszentrale-update-<version>.tar.gz`** in den Ordner **`updates`** neben der App legen
   (den genauen Pfad zeigt die App unter *Einstellungen → App & Updates*; der Ordner wird beim
   Start automatisch angelegt).
2. In der App: **Einstellungen → „App & Updates" → „Nach Updates suchen"** → **„Installieren"**.

Die App tauscht die neue Version ein und lädt sich neu — **kein Neustart, kein Terminal**. Am
lokalen Board ist dafür kein Passwort/Token nötig (läuft nur auf diesem Gerät).

### Alternativ — per Skript (USB-Stick/Ordner)

Im Projektordner **`./update-lokal.sh <quelle>`** (z. B. `./update-lokal.sh /media/usb`).

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

- **Befehl bricht sofort ab** → **Node.js** fehlt (Schritt 1).
- **„Port belegt" / `EADDRINUSE`** → die App läuft schon in einem anderen Terminal; eines beenden.
- **Alles zurücksetzen** → im Browser den **localStorage** der Seite leeren (dort liegen die Daten).
