# DartsZentrale — Workflows

Praxis-Ablauf für die zwei Betriebsmodi sowie Trainings- und Ligaspieltage.
Ergänzt [DATA_MODEL.md](DATA_MODEL.md) (Datenmodell) und [docs/de/arcane-homelab-anleitung.md](docs/de/arcane-homelab-anleitung.md) (Server/Härtung).

## Betriebsmodi

| | **Lokal** (Einzelgerät / Heim) | **Verein** (Server) |
|---|---|---|
| Daten | nur im Browser (localStorage) | zentral in PocketBase (Cloud) |
| Login | keiner, alle Rechte | Login + Rollen (admin / captain / player / viewer / board) |
| Bereiche | Dashboard, Counter, Training, Spieler, Statistik | + Ligen, Mannschaften, Benutzer, Board-/Kiosk-Modus |
| Wofür | privates Board zuhause | Verein + die ~8 Board-PCs |

Umschalten: beim **ersten Start** fragt jedes Gerät Lokal/Verein; ändern in **Einstellungen → Nutzungsart** (gerätelokal). Die Board-PCs laufen im **Verein-Modus**
(brauchen zentrale Daten + Rückschreiben). Einstellungen sind im Verein **vereinsweit zentral** (nur Admin ändert sie).

## Rollen & Logins

- **Board-PCs:** dediziertes, rechtearmes **Board-Konto** (Rolle `board`) bleibt dauerhaft angemeldet.
  Darf nur Matches anlegen + lesen, nichts verwalten. Anlegen: `pocketbase/add-board-account.mjs`.
- **Kapitän/Admin:** eigenes Login für Aufstellung, Ergebnis-Bestätigung und Verwaltung —
  am eigenen Gerät (Handy/PWA) **oder** indem ein Board kurz entsperrt wird (Kiosk → „Verlassen" → Login).
- Statistik hängt am **Spieler**, nicht am Login → man wählt sich am Board einfach aus dem Kader.

## Trainingstag (am Board-PC)

1. Board ist im Board-/Kiosk-Modus (Board-Konto angemeldet).
2. Tab **„Training"** (Cricket / ATC / Bob's 27 …) **oder** Tab **„Spiel"** (501). Kein persönlicher Login nötig.
3. **501 mit Statistik:** sich selbst im Setup aus dem Kader wählen → zählt für den Spieler.
4. **Nur Spaß:** „Freies Spiel" an → wird nicht gespeichert. **Gast** ohne Kader: Name eintippen.

> Trainings-Modi sind ein Übungswerkzeug ohne persönliche Statistik. Persönliche Werte kommen aus gespielten **501-Matches**.
> Zuhause (Lokal-Modus): App öffnen, spielen/trainieren, kein Login.

## Ligaspieltag — Heimspiel (mit Board-Automatik)

1. **Vorbereitung** (Kapitän/Admin): **Aufstellung** der Begegnung anlegen — Einzel/Doppel + Reihenfolge,
   Spieler, **Board-Zuordnung** (Board 1–8), Ersatz E1/E2.
2. **Am Brett:** Die **Board-Anzeige** zeigt das diesem Board zugewiesene Spiel → **„Spiel starten"** →
   501 gegen Gast → **Ergebnis wird automatisch erfasst** (mit der Aufstellungsposition verknüpft).
3. **Nach den Spielen:** Kapitän öffnet die Begegnung → **„Ergebnis"** → Spielbericht ist
   **vorausgefüllt (AUTO)** → prüfen/korrigieren → **bestätigen** → Begegnungsergebnis + Tabelle.
   (Am Board per „Verlassen" → Kapitän-Login, ~20 s; kein Zusatzrechner nötig.)

## Ligaspieltag — Auswärtsspiel (nachträglich am Vereins-PC)

Auswärts gibt es keine eigenen Board-PCs → keine Automatik.
- Nach dem Spiel trägt der **Kapitän/Admin am Vereins-PC** (angemeldet) das Ergebnis ein:
  **Ligen → Begegnung → „Ergebnis"** (Spielbericht je Position) **oder** kurz das Gesamtergebnis
  über die Begegnung bearbeiten. Begegnung wird als gespielt markiert → Tabelle.
- Optional vorab eine Aufstellung anlegen, um den Spielbericht positionsweise auszufüllen.

## Board-Konten & Board-PC einrichten (einmalig)

1. **Board-Konten anlegen** (Admin): **Einstellungen → Benutzer verwalten → „Board-Konten"** → Anzahl der Bretter (Board 1…N)
   + gemeinsames Passwort. Es entstehen `board1…boardN@board.local` (Rolle `board`, rechtearm, **nie** mit einem Spieler verknüpft).
2. **Pro Brett-Rechner:** mit dem zugehörigen Board-Konto anmelden (z. B. `board3@board.local`) → der Rechner ist damit
   automatisch **Board 3** und startet im **gesperrten Kiosk**. Keine weitere Geräte-Einstellung nötig.
3. **In der Aufstellung** trägst du pro Position nur die **Board-Nummer** ein → das passende Brett zeigt sein Spiel.
4. Verlassen/Wartung: „Verlassen" → Admin/Kapitän-Login → Änderungen → „Abmelden & zum Board" (Board meldet sich wieder an).
