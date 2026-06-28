# Handoff: DartsHub — Darts-Verein Verwaltung & Counter

> **📖 Dokumentation — wo finde ich was?**
> - **App aufsetzen (eigener Server):** [`docs/cloud-anleitung.md`](docs/cloud-anleitung.md) + [`docs/COOLIFY-SETUP.md`](docs/COOLIFY-SETUP.md)
> - **App im Alltag nutzen (Vereins-Admins):** [`docs/handbuch.md`](docs/handbuch.md)
> - **Datenmodell & Rechte:** [`pocketbase/SCHEMA.md`](pocketbase/SCHEMA.md) (aktuelles PB-Schema) · [`DATA_MODEL.md`](DATA_MODEL.md) (App-Datenmodell) · [`docs/verein-pocketbase-plan.md`](docs/verein-pocketbase-plan.md) (ursprünglicher Plan, historisch)
>
> Dieses README selbst ist ein **Entwickler-/Design-Handoff** (Prototyp & Design-Tokens), kein Endnutzer-Dokument.

## Overview
DartsHub ist eine Verwaltungs- und Scoring-App für Darts-Vereine. Sie deckt zwei
Betriebsmodi ab: **Lokal** (ein Gerät am Board, kein Login) und **Verein**
(server-gehostet, mit Anmeldung, Rollen, Ligen, Mannschaften und Benutzerverwaltung).
Funktionsumfang: Dashboard, Darts Counter (X01 etc.), Trainingsspiele, Kalender,
Ligen mit berechneter Tabelle & manueller Ergebniseingabe, Mannschaftskader,
Spielerliste, Statistiken, Benutzer-/Rechteverwaltung und Einstellungen.

Die Oberfläche ist **deutschsprachig** und als **Desktop-Web-App** mit fester
Seitenleiste (248px) gestaltet; der Counter ist zusätzlich tablettauglich.

## About the Design Files
Die Dateien in diesem Paket sind **Design-Referenzen, erstellt in HTML** — ein
Prototyp, der Aussehen und Verhalten zeigt, **kein** Produktionscode zum 1:1-Kopieren.
Aufgabe ist, diese Designs in der **Zielumgebung** des Projekts nachzubauen
(z. B. React/Vue/Svelte + echtes Backend) mit deren etablierten Mustern und
Bibliotheken. Existiert noch keine Codebasis, das am besten passende Framework
wählen (Empfehlung: React/TypeScript-SPA + REST/GraphQL-Backend mit DB & Auth).

Technischer Hinweis zum Prototyp: Er ist als „Design Component" (`*.dc.html`)
gebaut — ein deklaratives Template plus eine `Component`-Logikklasse, gerendert von
`support.js`. Das ist **nur das Prototyp-Laufzeitsystem**; nicht übernehmen. Relevant
sind Layout, Styling-Werte, Datenflüsse und Verhalten, nicht das DC-Framework.

Der Prototyp persistiert alles in **localStorage**. In der echten App gehören diese
Daten in eine Datenbank hinter einem Server; siehe `DATA_MODEL.md`.

## Fidelity
**High-fidelity.** Finale Farben, Typografie, Abstände, Komponenten und Interaktionen.
Die UI sollte pixelgenau mit den Bibliotheken/Patterns der Zielcodebasis nachgebaut
werden. Exakte Werte siehe „Design Tokens".

---

## Architektur & Navigation

**App-Shell** (Vereinsmodus, eingeloggt): feste Sidebar links (248px) + scrollender
Hauptbereich.
- **Sidebar:** Logo + Vereinsname oben; Navigation; unten die angemeldete Konto-Karte
  mit Abmelden-Button.
- **Navigationspunkte:** Dashboard, Darts Counter, Trainingsspiele, Kalender,
  Ligen*, Mannschaften*, Spieler, Statistiken, Benutzer*, Einstellungen.
  (* = nur Vereinsmodus / rollenabhängig, siehe Rechte.)
- **Lokaler Modus** blendet Ligen/Mannschaften/Benutzer und die Konto-Karte aus.

**Login-Screen** (Vereinsmodus, nicht angemeldet): zentrierte Karte (420px) auf
dunklem Radial-Verlauf-Hintergrund — Logo, „Anmelden", E-Mail + Passwort,
Anmelden-Button, Trenner „Demo-Konten", Liste anklickbarer Demo-Konten.
Im Prototyp ist das Passwort wirkungslos (Demo).

---

## Screens / Views

### 1. Dashboard
- **Zweck:** Überblick; Schnellzugriff aufs Spielen, Termine, Form.
- **Layout:** Kopf (Datum/Uhrzeit klein, große Begrüßung) + primärer Button „Darts
  Counter" rechts (nur mit Spielrecht). Termin-Leiste. Dann 4-Spalten-Statistikraster.
  Darunter zwei Spalten (links Schnellstart/„Nächster Spieltag" + „Letzte Ergebnisse",
  rechts Training-Quicklaunch / Top-Spieler).
- **Statistikkarten (Verein, echte Daten):** „Spieler" (Anzahl), „Mannschaften"
  (Anzahl Kader), „Team Ø 3-Dart" (Mittel der gewerteten Spieler, sonst „–"),
  „Tabellenplatz" (aus der Liga berechnet). Karte: `--surface`, 1px `--border`,
  radius 16px, Padding 16–22px; großer Wert in **JetBrains Mono** 24px/800.
- **„Nächster Spieltag":** Karte mit grünem Verlauf
  (`linear-gradient(135deg,#13241b,var(--surface) 60%)`, Border `#234032`), zeigt
  die nächste offene Begegnung der eigenen Mannschaft: zwei 54px-Team-Badges
  (eigenes Team grüner Verlauf, sonst grau) mit Namen, „VS", Heim/Auswärts + Liga.
- **„Letzte Ergebnisse":** Liste; je Zeile farbiger 5px-Balken (S=grün, U=gold,
  N=rot), Gegner + Liga, Legs-Ergebnis (Mono 18px/800), Ergebnis-Kürzel.

### 2. Darts Counter (Setup + Spiel)
- **Zweck:** X01-Spiel zählen (Einzel/Mannschaft), inkl. „Wer beginnt?"/Ausbullen.
- Großflächige Score-Anzeige, Tablet-Tastenfeld oder Desktop-Tastatur (F1–F8 =
  Schnellscores). Einstellbar: Startscore (301/501/701/1001), Double-In/Out, Best of
  Legs/Sätze. Abgeschlossene Spiele werden gespeichert (→ Statistik).
- Nur mit **Spielrecht** (admin/captain/player; viewer nicht).

### 3. Trainingsspiele
- Kartenübersicht der Modi (Cricket, Around the Clock, Doubles, Bob's 27, Checkout
  121, Elimination, Baseball, Halve-it, Killer …) mit Regel-Overlays und Setup
  (Spieleranzahl/Auswahl). Ergebnisse werden gespeichert.

### 4. Kalender
- Monatsansicht (7-Spalten-Grid) + Listenleiste „Termine". Termin-Typen farbcodiert
  (Training, Ligaspiel, Verein, Competition, Pokal, Sonstiges). Termin-anlegen-Button
  nur mit „Termine verwalten"-Recht.

### 5. Ligen
- **Zweck:** Mehrere Ligen verwalten; Mannschaften zuordnen; Ergebnisse manuell
  eintragen; Tabelle berechnen.
- **Layout:** Titel „Ligen" + „+ Liga" (rechts). Liga-**Tabs** (Name + Saison).
  Sub-Kopf mit Liga-Name/Saison + „Mannschaften" (Liga bearbeiten) + „+ Begegnung".
  Zwei Spalten: links **Tabelle**, rechts **Begegnungen & Ergebnisse**.
- **Tabelle (berechnet):** Spalten `# · Mannschaft · Sp · S · U · N · Diff · Pkt`
  (Grid `28px 1fr 30px 30px 30px 30px 44px 40px`). Eigene Mannschaft grün hinterlegt
  (`rgba(25,164,99,.08)`) + fett, mit grünem Badge. Top 2 grün, Letzter rot.
  Zahlen in **JetBrains Mono**. Punkte: Sieg 2 / Unentschieden 1 / Niederlage 0;
  Sortierung Punkte → Legdifferenz → erzielte Legs → Name.
- **Begegnungen:** je Zeile Datum (Mon/Tag), Paarung „Heim — Gast", Status
  (Beendet/Geplant), Legs-Ergebnis. Klick öffnet Ergebnis-Modal (nur mit Recht).
- Leerzustände: „Noch keine Liga" / „Noch keine Ergebnisse" / „Noch keine Begegnungen".

### 6. Mannschaften
- **Zweck:** Vereinsmannschaften; Kader aus der Spielerliste bilden.
- **Layout:** Titel + „+ Mannschaft". Mannschafts-**Tabs** (Name + Spielerzahl).
  Team-Kopf (Badge aus Initialen, Name, Liga · Spielerzahl · Kapitän, „Bearbeiten").
  Zwei Spalten: **Kader** (Spielerzeilen, Kapitän mit „C"-Badge, Ø 3-Dart) und
  **Aufstellung** (Einzel 1–4 + Doppel 1–2, gefüllt/„Noch offen").
- Kader & Aufstellung leiten sich aus `Team.memberIds` (→ Spieler) ab.

### 7. Spieler
- Kartenraster (3 Spalten). Je Karte: Avatar (Initialen-Badge), Name, Nickname/
  Spielanzahl, zwei Statistikkacheln (Ø 3-Dart, Siege). Bearbeiten-Stift + „+ Spieler"
  nur mit „Spieler verwalten"-Recht. Klick öffnet Spieler-Detail.

### 8. Spieler-Detail
- Kopf (Avatar, Name, Nickname/Rolle), Statistik-Kacheln, Scoring (60+/100+/140+/180),
  Form-Balkendiagramm, „letzte Spiele". (Detailwerte teils Demo, solange keine echten
  Match-Daten — siehe DATA_MODEL.md.)

### 9. Statistiken
- Bestenliste (Tabelle) aus der Spielerliste: Rang, Spieler, Ø 3-Dart, Spiele, Siege/
  Niederlagen, Checkout-%, 60+/100+/140+/180, High Finish.

### 10. Benutzer & Rechte (nur Admin)
- **Zweck:** Vereinskonten verwalten, getrennt von der Spielerliste.
- **Layout:** Titel + „+ Benutzer". 3 Statistikkacheln (Konten gesamt / aktiv / mit
  Spieler verknüpft). Tabelle: `Benutzer · Rolle · Spielerprofil · Status · ⋯`
  (Grid `1.5fr 1fr 1.1fr 92px 56px`). Je Zeile: Avatar+Name (eigenes Konto „DU"-Badge)
  + E-Mail; Rollen-Badge + Position darunter; „↔ Spielername" oder „kein
  Spielerprofil"; Status-Punkt+Label (klickbar = aktiv/inaktiv); Bearbeiten-Stift.
  Deaktivierte Zeilen mit `opacity:.55`. Rollen-Legende unten.

### 11. Einstellungen
- App-Modus / Vereinsname / Logo (nur Admin), „Benutzer & Rechte"-Verknüpfung (Admin),
  Eingabe & Tasten, Counter-Darstellung (Akzentfarbe, Theme, Schrift, Größen) usw.

---

## Modals (Dialoge)
Gemeinsamer Stil: Overlay `rgba(8,10,12,.78)` + `backdrop-filter: blur(6px)`,
zentrierte Karte `--surface`, 1px `--border-2`, radius 20px, Padding 28px,
Schatten `0 30px 70px rgba(0,0,0,.55)`. Fußzeile: links ggf. „Löschen" (rot), rechts
„Abbrechen" + „Speichern" (Akzent). Speichern ist deaktiviert, solange Pflichtfeld leer.

- **Spieler** (add/edit): Avatar-Farbwahl, Name, Kürzel (max 3).
- **Mannschaft** (add/edit): Name, Liga (Freitext), Kader-Auswahl per Checkbox aus
  der Spielerliste, Kapitän-Stern je gewähltem Spieler.
- **Benutzer** (add/edit): Avatar-Farbwahl, **Vorname + Nachname**, E-Mail,
  **Position im Verein** (optional), **Rolle** (4 Radio-Karten mit Beschreibung),
  **Mit Spieler verknüpfen** (optionale Chips), Aktiv-Schalter.
- **Liga** (add/edit): Name, Saison, dynamische Mannschaftsliste (Name + „Eigene"-
  Toggle + Entfernen + „Mannschaft hinzufügen").
- **Begegnung/Ergebnis** (add/edit): Heim/Gast (Chip-Auswahl, Gegenteam deaktiviert),
  Datum, „Ergebnis eingetragen"-Schalter, der ein Leg-Eingabefeld `hs : as` einblendet.
- **Termin** (add/edit): Titel, Datum, Uhrzeit, Typ, Ort.

---

## Interactions & Behavior
- **Login:** E-Mail → passendes aktives Konto wird angemeldet (Demo: Passwort egal);
  Demo-Konto-Klick meldet direkt an. Sitzung persistent bis Abmelden.
- **Tabs** (Ligen/Mannschaften): wechseln die aktive Auswahl, aktiver Tab mit
  Akzent-Rahmen.
- **Tabelle** rechnet bei jeder Ergebnisänderung neu.
- **Schalter/Toggles:** 44×24px Pille, 20px Knopf, `transform: translateX(20px)` an,
  Transition 0.15s.
- **Hover:** Karten/Listenzeilen heben `border-color` auf `--border-strong`; Buttons
  haben dezente Hover-Hintergründe.
- **Leerzustände** überall vorhanden (gestrichelte Karten + Hinweistext).
- **Rechte** werden doppelt durchgesetzt: UI blendet Aktionen aus **und** die
  Aktionen prüfen die Rolle (im echten Backend serverseitig erzwingen!).

## State Management
Siehe `DATA_MODEL.md` (§2 Entitäten, §3 Beziehungen). Kern-Zustände: aktueller Screen,
angemeldetes Konto (Session), ausgewählte Liga/Mannschaft/Spieler, sowie die
persistierten Sammlungen (Spieler, Teams, Accounts, Ligen, Events, Matches, Training,
Settings). Abgeleitet werden: Tabelle (`computeStandings`), Kader/Aufstellung,
Spieler-Aggregate (`aggregateFor`), Dashboard-Kennzahlen.

---

## Design Tokens

### Farben — Dark-Theme (Standard)
| Token | Hex | Verwendung |
|-------|-----|------------|
| sidebar | `#0a0c0e` | Seitenleisten-Hintergrund |
| bg | `#0d0f12` | App-Hintergrund |
| surface | `#14181c` | Karten |
| surface-2 | `#13171c` | leicht abgesetzt |
| surface-3 | `#161b20` | – |
| btn | `#1a2026` | Buttons/Eingaben/Kacheln |
| border | `#232a31` | Standard-Rahmen |
| border-2 | `#2a333c` | stärker |
| border-strong | `#3a434d` | Hover/aktiv |
| hairline | `#1c2229` | Trennlinien |
| text | `#ECEAE3` | Primärtext |
| text-2 | `#aeb4bd` | |
| text-3 | `#8a9099` | |
| text-4 | `#6b7480` | Labels/sekundär |
| text-5 | `#5b626b` | dezent |
| success | `#7fd7a6` (Marke `#19A463` / live `#2BD377`) | Siege, Akzent |
| danger | `#c98b86` (kräftig `#E0594B`) | Niederlagen, Löschen |
| nav-active | `#13241b` / fg `#7fd7a6` | aktiver Navi-Punkt |

### Akzent-/Statusfarben (fix)
- Primär-Grün `#19A463`, Live-Grün `#2BD377`, Gold `#F2B829` (Kapitän/1. Platz/
  Unentschieden), Blau `#3B9EFF`, Rot `#E0594B`, Lila `#9b6dff`, Türkis `#2bd3c0`.
- Akzentfarbe ist in den Einstellungen wählbar (CSS-Variable, wirkt auf Buttons/
  Highlights). Es gibt auch ein **Light-Theme** (Tokens im `:root[data-theme="light"]`).

### Rollenfarben
admin `#E0594B`, captain `#F2B829`, player `#19A463`, viewer `#3B9EFF`
(jeweils mit ~13% Hintergrund + ~40% Rahmen).

### Typografie
- **UI-Schrift:** Inter (wählbar: Archivo, Rubik, Oswald). Gewichte 400–800.
- **Zahlen/Scores:** **JetBrains Mono** (500–800).
- Größen: H1 27px/800 (letter-spacing −0.02em); Karten-Werte 24px/800; Listenname
  14px/600; Labels 11–12px/700 uppercase (letter-spacing .05–.08em); Kleintext 11–12px.

### Radius / Schatten / Spacing
- Radius: Buttons/Eingaben 10–11px, Karten 14–16px, große Karten/Modals 18–20px,
  Avatare 8–16px, Pillen/Chips 999px.
- Schatten: Modals `0 30px 70px rgba(0,0,0,.55)`; Primärbutton
  `0 8px 24px rgba(25,164,99,.28)`.
- Abstände: Seiteninhalt-Padding 28–32px; Kartenabstände/Gaps 16–18px; Grid-Gaps
  5–18px. Sidebar 248px breit.
- Avatar-Farben: feste 8er-Palette aus Verläufen (Index `avi` am Datensatz).

## Assets
- **Logo:** inline-SVG (Dartscheibe aus konzentrischen Kreisen, Farben
  `#0f2419`/`#E04B43`/`#19A463`/`#F2B829`). Eigenes Logo per Upload möglich (Settings).
- **Icons:** durchgängig inline-SVG im Stroke-Stil (`stroke-width` ~1.9–2, round caps),
  passend zu Lucide/Feather. In der Zielcodebasis durch das dortige Icon-Set ersetzbar.
- Keine externen Bilddateien; ein paar Emoji in Statistik-Kacheln.
- Fonts via Google Fonts (Inter, Archivo, Rubik, Oswald, JetBrains Mono).

## Files
- `DartsHub.dc.html` — der vollständige Prototyp (alle Screens, Logik, Seed-Daten).
- `support.js` — Laufzeit des Prototyp-Frameworks (nur zum Ausführen der HTML-Datei;
  **nicht** Teil der Zielimplementierung).
- `DATA_MODEL.md` — **maßgebliche** Doku zu Entitäten, Beziehungen, Rollen-Matrix,
  localStorage-Schlüsseln und offenen Entscheidungen fürs echte Backend.
- `screenshots/` — Referenzbilder der wichtigsten Screens:
  `01-login`, `02-dashboard`, `03-ligen`, `04-mannschaften`, `05-spieler`,
  `06-benutzer` (jeweils Vereinsmodus, als Admin angemeldet).

### So öffnest du den Prototyp
`DartsHub.dc.html` + `support.js` im selben Ordner lassen und die HTML-Datei im
Browser öffnen. Demo-Daten werden beim ersten Start angelegt. Zum Zurücksetzen den
localStorage der Seite leeren.
