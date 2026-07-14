# scripts/ — Start-, Update- & Autostart-Skripte

Hier liegen die **Betriebs-Skripte** von DartsZentrale: starten, aktualisieren, beim
Hochfahren automatisch starten und den Cloud-Server einrichten.

> **Wichtig — im Download liegen sie flach:** In den [heruntergeladenen Paketen](https://github.com/zelko2k1/dartszentrale/releases/latest)
> stecken diese Dateien **nicht** in einem `scripts/`-Unterordner, sondern direkt im Hauptordner
> neben `app/`. Ein Verein doppelklickt also z. B. `start-lokal.bat` gleich oben im entpackten Ordner —
> ohne in einen Unterordner zu wechseln. Der Ordner `scripts/` ist nur die **Ablage im Quellcode**;
> der `copy2share`-Build kopiert die passenden Skripte pro Paket flach ins Bundle.

Pro Aufgabe gibt es meist eine **Linux-Version (`.sh`)** und eine **Windows-Version (`.bat`/`.ps1`)** —
die `.bat` ruft dabei oft nur die `.ps1` auf. Namensschema:

- **`…-lokal…`** → ein einzelnes Board auf einem PC (nur die App, keine Anmeldung)
- **`…-verein-lan…`** → Vereinsmodus im eigenen Netzwerk (ein Programm liefert App **und** Datenbank aus)
- **`…-cloud` / `…-server`** → Vereinsmodus auf einem Internet-Server

## Starten
| Datei | Zweck |
|---|---|
| `start-lokal.sh` / `.bat` | Startet **ein Board** unter `http://127.0.0.1:4173` — ohne Server, ohne Anmeldung. |
| `start-verein-lan.sh` / `.ps1` / `.bat` | Startet den **Vereinsmodus im LAN** (ein Programm für App + Datenbank), legt beim Erststart die Admin-Konten an. |

## Aktualisieren
| Datei | Zweck |
|---|---|
| `update-lokal.sh` / `.bat` | Spielt eine **neue App-Version** für ein Board ein (von USB-Stick/Ordner). |
| `update-verein-lan.sh` / `.ps1` / `.bat` | Tauscht im LAN-Betrieb **nur die App** aus; die Daten bleiben, die alte Version wird gesichert. |
| `update-server.sh` | Aktualisiert einen **Internet-/Pi-Server** (App + Datenbank) von Stick/Ordner. |

## Automatisch beim Hochfahren starten (Autostart)
| Datei | Zweck |
|---|---|
| `autostart-lokal.sh` / `.bat` | Board startet **beim Einschalten** automatisch (ideal für einen Kiosk-PC). |
| `autostart-verein-lan.sh` / `.bat` | LAN-Server startet **beim Einschalten** automatisch. |

## Einrichten (einmalig)
| Datei | Zweck |
|---|---|
| `einrichten-cloud.sh` | Richtet einen **Internet-Server** komplett ein (Datenbank + App als Hintergrunddienste + Caddy für HTTPS). Linux, als root. |

## Wozu welches Paket?

Welches Skript in welchem Download-Bundle landet, steht im
[Haupt-README](../README.md#loslegen--welche-anleitung-passt-zu-mir); die
Schritt-für-Schritt-Anleitungen liegen unter [`docs/`](../docs/) und in jedem Paket.
Datenbank- und Wartungswerkzeuge (Passwort-Reset, Saison-Export …) liegen nicht hier,
sondern unter [`pocketbase/`](../pocketbase/).
