# Plan: Tray-Programm für den Vereinsrechner (Go)

> **Status: ZURÜCKGESTELLT (2026-08-31).** Kein Auftrag, nichts gebaut, nichts angefangen.
> Alles, was das Programm können soll, **geht heute schon** — nur über Startdateien und ein
> Konsolenfenster statt über ein Symbol neben der Uhr. Dieses Dokument hält den Zuschnitt fest,
> damit er nicht neu erfunden werden muss, falls der Bedarf entsteht.
>
> **Auslöser, der es aus der Schublade holen würde:** ein Verein betreibt das Bundle
> `02-club-lan` auf einem eigenen Rechner und kommt mit dem Konsolenfenster nicht zurecht — es
> wird versehentlich geschlossen, niemand traut sich es zu schließen, oder keiner sieht, ob der
> Server gerade läuft. Solange DartsZentrale nur im Homelab per Docker läuft
> ([`arcane-homelab-guide.md`](./arcane-homelab-guide.md)), nützt ein Tray-Symbol **gar nichts**.

---

## 1. Das Problem

Im Vereinsmodus im eigenen Netz läuft DartsZentrale als **ein** Programm: PocketBase liefert die
App aus `pb_public/` gleich mit aus. Gestartet wird es mit einem Doppelklick auf
`start-club-lan.bat` — und dann steht ein **Konsolenfenster** offen, das offen bleiben muss.

Für jemanden, der Software am Vereinsrechner nur benutzt und nicht betreut, wirft das drei Fragen
auf, die das Fenster nicht beantwortet:

- Läuft der Server gerade, oder ist das nur ein Fenster mit Text?
- Wie komme ich an die Adresse, die ich auf den Tablets eintippen muss?
- Darf ich das Fenster schließen? (Nein — und genau das passiert.)

## 2. Was es heute schon gibt

Nichts davon fehlt funktional. Es ist nur nicht an einer Stelle versammelt.

| Aufgabe | Heute | Wo |
|---|---|---|
| Starten | `start-club-lan.sh` / `.ps1` / `.bat` | `scripts/` (im Bundle flach oben) |
| Automatisch beim Einschalten | `autostart-club-lan.sh` / `.bat` | `scripts/` |
| Aktualisieren | `update-club-lan.sh` / `.ps1` / `.bat` | `scripts/` |
| Stoppen | Fenster schließen bzw. `Strg+C` | — |
| Status | „läuft das Fenster noch?" | — |
| Beitritts-QR für Tablets | Einstellungen → Geräte | in der App, also **nach** dem Anmelden |

Die beiden letzten Zeilen sind die eigentliche Lücke: **Status** und **QR ohne vorher anmelden zu
müssen**.

## 3. Zuschnitt

**Muss:**

1. **Symbol im Infobereich** (Windows-Taskleiste, Linux-Systray) mit Ampel: läuft / gestoppt /
   startet gerade / Fehler.
2. **Start / Stop** über das Kontextmenü. Das Tray startet dabei genau das, was heute
   `start-club-lan` startet — es ersetzt die Startlogik **nicht**, es ruft sie auf.
3. **Adresse anzeigen** — `http://<LAN-IP>:8090` als Text zum Kopieren **und als QR-Code** in
   einem kleinen Fenster, damit ein Tablet ihn abscannen kann, ohne dass sich jemand anmeldet.
4. **Protokoll öffnen** — die letzten Zeilen der Server-Ausgabe, für den Fall, dass doch jemand
   gefragt werden muss, was los ist.

**Kann:**

5. **Aktualisieren** über das Menü — ruft `update-club-lan` auf, inklusive der Sicherung der alten
   Version, die das Skript ohnehin anlegt.
6. **Beim Anmelden mitstarten** als Häkchen im Menü, statt `autostart-club-lan` von Hand.

**Ausdrücklich nicht:**

- **Keine zweite Einrichtungslogik.** Der Erststart mit den beiden Konten bleibt, wo er ist
  (`start-club-lan.*`). Zwei Stellen, die Konten anlegen, wären zwei Wahrheiten.
- **Keine Vereinsverwaltung**, keine Einstellungen, keine Benutzer — das ist die App.
- **Kein Ersatz für `03-club-cloud`.** Auf einem Server ohne Bildschirm gibt es keinen
  Infobereich; dort bleibt es bei systemd.

## 4. Warum Go

Eine einzelne ausführbare Datei ohne Laufzeitumgebung, für Windows und Linux aus derselben
Quelle baubar. Das passt zum Versprechen der Bundles: ein Ordner, ein Doppelklick, kein Node,
kein Installer. Eine Electron- oder Python-Lösung würde entweder eine Laufzeit mitschleppen oder
eine voraussetzen — beides der Grund, warum es die Bundles überhaupt gibt.

**Bibliothek:** eine der üblichen Systray-Bindings (`fyne.io/systray`, der gepflegte Abkömmling
von `getlantern/systray`). Vor dem Bauen prüfen, was aktuell gepflegt wird — das Feld ändert sich.
Für das QR-Fenster reicht ein QR-Encoder plus ein minimales Fenster; notfalls tut es eine erzeugte
PNG-Datei, die im Standard-Bildbetrachter aufgeht.

**Wo es liegen würde:** eigener Ordner `tray/` im Repo, eigener Build, eigenes Release-Artefakt —
**nicht** in die bestehenden Bundles einbacken, solange es nicht gebraucht wird. Ein Verein, der
es nicht will, soll es nicht mit herunterladen.

## 5. Aufbau

Das Tray ist ein **Aufseher**, kein Server:

```
Tray-Prozess (Go)
  ├── startet  → start-club-lan.(ps1|sh) als Kindprozess
  ├── liest    → dessen Ausgabe mit (fürs Protokollfenster und die Fehlererkennung)
  ├── prüft    → periodisch, ob der Dienst antwortet
  └── stoppt   → beendet den Kindprozess sauber
```

Damit bleibt die gesamte Start- und Einrichtungslogik in den Skripten, die heute schon in der CI
geprüft werden (Linux **und** `windows-latest`).

## 6. Vier Fallen, die schon bekannt sind

Alle vier sind beim Bau der Bundles nachgemessen worden und gelten für das Tray genauso:

1. **`/api/health` ist kein Beleg dafür, dass alles steht.** Beim Erststart läuft PocketBase
   zwischendurch an, um den App-Admin anzulegen — health antwortet also bereits, während das Konto
   noch fehlt. Die Ampel darf beim **ersten** Start deshalb nicht auf health hören, sondern muss
   abwarten, bis die Einrichtung durch ist.
2. **`pocketbase superuser upsert` liefert immer Exit-Code 0** und schreibt Fehler auf *stdout*.
   Wer den Kindprozess nur am Rückgabewert misst, zeigt Grün, obwohl die Einrichtung scheiterte —
   die Ausgabe muss auf `Error` geprüft werden, so wie es die Skripte tun.
3. **`--migrationsDir` / `--hooksDir` sind Pflicht**, sobald `--dir` woanders hinzeigt: die
   Vorgabewerte hängen am Datenverzeichnis, nicht am Arbeitsverzeichnis. Ohne sie startet eine
   Instanz **ohne Schema und ohne Hooks**. Falls das Tray PocketBase je direkt aufruft statt über
   die Skripte, muss es beide Angaben mitgeben.
4. **Zeilenenden.** Windows-Startdateien brauchen CRLF, sonst stolpert `cmd.exe` an Sprungmarken.
   Gilt für alles, was ein Tray-Build zusätzlich in ein Bundle legt.

## 7. Phasen

- [ ] **1 · Gerüst** — Symbol, Menü, Start/Stop des Kindprozesses, Ampel aus dem Prozesszustand.
      Linux zuerst, weil dort schneller zu prüfen.
- [ ] **2 · Status, der stimmt** — periodische Prüfung inkl. der Erststart-Ausnahme aus 6.1,
      Fehlerzustand mit lesbarer Meldung.
- [ ] **3 · Adresse & QR** — LAN-Adresse ermitteln (die richtige Schnittstelle wählen, nicht die
      erstbeste), QR anzeigen, Adresse in die Zwischenablage.
- [ ] **4 · Protokollfenster** — mitgelesene Ausgabe, letzte N Zeilen, kopierbar.
- [ ] **5 · Windows** — bauen, auf einer echten Windows-Maschine prüfen. Erst hier zeigt sich, ob
      der Kindprozess beim Abmelden sauber endet.
- [ ] **6 · Kür** — Aktualisieren aus dem Menü, „beim Anmelden mitstarten".

## 8. Was dagegen spricht

Ehrlich, damit die Entscheidung beim nächsten Mal nicht neu diskutiert wird:

- **Es löst kein Problem, das jemand hat.** Bisher betreibt niemand außerhalb des Homelabs eine
  Installation. Der Bedarf ist vermutet, nicht beobachtet.
- **Es ist eine neue Sprache im Repo.** Bisher gibt es JavaScript/TypeScript und Shell. Go
  bedeutet eine eigene Werkzeugkette, eigene CI-Schritte, eigene Release-Artefakte — für ein
  Programm, das nichts kann, was die Skripte nicht können.
- **GUI-Code ist plattformabhängig und schlecht prüfbar.** Systray-Verhalten lässt sich nicht
  sinnvoll in der CI testen; jede Änderung braucht einen Menschen vor zwei Rechnern.
- **Der billigere Weg zuerst:** Ein Startskript, das sein Fenster minimiert und beim Start Adresse
  und QR-Code **ins Fenster** schreibt, deckt vielleicht drei Viertel des Nutzens zu einem
  Bruchteil des Aufwands. Das wäre der erste Versuch — nicht das Tray.

## 9. Offene Entscheidungen

- **Eigenes Repo oder `tray/` im Hauptrepo?** Vorschlag: `tray/` — ein eigenes Repo für ein
  optionales Hilfsprogramm ist Verwaltungsaufwand ohne Gegenwert.
- **Ausgeliefert oder auf Anfrage?** Vorschlag: als eigenes Release-Artefakt neben den Bundles,
  nicht darin. Wer es will, holt es.
- **Auch für `01-single-board`?** Dort läuft nur die App ohne Server — das Tray hätte kaum etwas
  zu tun. Eher nein.
