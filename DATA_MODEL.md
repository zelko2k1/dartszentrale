# DartsHub — Datenmodell & Entwickler-Übergabe

Stand: Juni 2026. Dieses Dokument beschreibt die Datenstrukturen, Beziehungen und
offenen Punkte des Prototyps `DartsHub.dc.html`, damit die Umsetzung in eine echte
(server-gehostete) Anwendung sauber aufsetzen kann.

> **Wichtig:** Der Prototyp speichert alles in `localStorage` (rein clientseitig).
> Für den Verein-Modus ist ein **Server-Backend mit Datenbank + Auth** vorgesehen.
> Die Anmeldung ist im Prototyp nur **simuliert** (Passwort wird ignoriert).

---

## 1. Zwei Betriebsmodi

| Modus | Zweck | Auth | Zusatz-Bereiche |
|-------|-------|------|-----------------|
| **local** | Einzelgerät (Heim-Board, ein Nutzer) | keine | – |
| **verein** | Verein auf eigenem Server, mehrere Nutzer | Login + Rollen | Ligen, Mannschaften, Benutzerverwaltung |

Der Modus liegt in `settings.appMode` (`"local"` \| `"verein"`). Im lokalen Modus
sind **alle Rechte freigegeben** (ein Gerät, ein Nutzer); im Vereinsmodus greift das
Rollenmodell (siehe §4).

---

## 2. Entitäten

Kernprinzip: **Die Spielerliste (`Player`) ist die einzige Quelle für sportliche
Personen.** Mannschaftskader, Aufstellungen und Statistiken leiten sich daraus ab.
Login-**Accounts** sind davon getrennt und referenzieren optional einen Spieler.

### Player — `localStorage["dartshub_players"]`
Die zentrale Spielerliste. Einzige Quelle für Kader & Statistik.
```
{ id: string, name: string, short: string (max 3),
  avi: number (Avatar-Farbindex), locked?: boolean (Seed-Spieler) }
```

### Team (Mannschaft) — `localStorage["dartshub_teams"]`
Vereinsmannschaft. Kader = Referenzen auf `Player.id`.
```
{ id: string, name: string, league?: string (Freitext),
  memberIds: string[]  → Player.id,
  captainId: string|null → Player.id (muss in memberIds sein) }
```
- Kader & Aufstellung der Mannschaftsseite werden aus `memberIds` gebildet.
- **Offen:** `league` ist hier nur Freitext und **nicht** mit der `League`-Entität
  verknüpft (siehe §5).

### Account (Benutzer) — `localStorage["dartshub_users"]`
Login-Konto für den Vereinsmodus. **Getrennt** vom Spieler.
```
{ id: string, first: string, last: string, name: string (abgeleitet "first last"),
  email: string, role: "admin"|"captain"|"player"|"viewer",
  playerId: string|null → Player.id (optionale 1:1-Verknüpfung),
  position?: string (Vereinsfunktion, Freitext, optional),
  active: boolean, avi: number, last_login?: string }
```
- Ein Account **kann** mit einem Spieler verknüpft sein (`playerId`), muss aber nicht
  (z. B. Vorstand/Schriftführer ohne Spielerprofil).
- Nicht jeder Spieler hat einen Account (Jugend-, Gastspieler).
- **Auth-Felder (Passwort-Hash, Tokens, Reset) gehören NICHT hierher** — im echten
  Backend in eine separate, geschützte Tabelle.

### League (Liga) — `localStorage["dartshub_leagues"]`
Eine Liga mit eigenen Teilnehmer-Teams und Begegnungen. Die **Tabelle wird berechnet**.
```
{ id: string, name: string, season: string,
  teams:    [ { id: string, name: string, own: boolean } ],
  fixtures: [ Fixture ] }
```
- `teams` sind **freie Einträge** (eigene + gegnerische Vereine), `own:true` markiert
  die eigene Mannschaft.
- **Offen:** Liga-Teams sind nicht mit `Team`/`Player` verknüpft (siehe §5).

### Fixture (Begegnung) — eingebettet in `League.fixtures`
```
{ id: string, homeId: string → League.teams.id, awayId: string → League.teams.id,
  date: string (YYYY-MM-DD), played: boolean,
  hs: number|"" (Heim-Legs), as: number|"" (Gast-Legs) }
```
- Ergebnisse werden **manuell** eingetragen (`played:true` + `hs`/`as`).
- **Tabellenberechnung** (`computeStandings`): pro gespielter Begegnung
  Sp +1, Sieg → +2 Pkt, Unentschieden → +1 Pkt je Team, Legdifferenz aus `hs`/`as`.
  Sortierung: Punkte → Legdifferenz → erzielte Legs → Name.

### Event (Termin) — `localStorage["dartshub_events"]`
Kalender-/Dashboard-Termine.
```
{ id: string, scope: "local"|"verein", title: string,
  date: string (YYYY-MM-DD), time: string, type: string (s. EVENT_TYPES), loc: string }
```

### Match (gespielte Partie) — `localStorage["dartshub_matches"]`
Vom Darts Counter gespeicherte, abgeschlossene Spiele. Basis für die
Spieler-Aggregation (`aggregateFor(name)` → Ø 3-Dart, Siege, 180er …).
Aktuell werden Spieler in Matches **per Name** zugeordnet.

### TrainingResult — `localStorage["dartshub_training"]`
Gespeicherte Trainingseinheiten (Cricket, ATC, Doubles, Bob's 27 …).

### Session — `localStorage["dartshub_session"]`
Aktuell angemeldetes Konto: `Account.id` oder `null`. → Im Backend durch echte
Session/JWT ersetzen.

### Settings — `localStorage["dartshub_settings"]`
App-Modus, Vereinsname, Logo, Counter-/Anzeige-Einstellungen, Akzentfarbe etc.

---

## 3. Beziehungen (Übersicht)

```
Player 1 ──── 0..1 Account         (Account.playerId, optional)
Player * ──── *   Team             (Team.memberIds[])     · Captain: Team.captainId
Player * ──── *   Match            (Zuordnung per Name — siehe Offener Punkt)
League 1 ──── *   Fixture          (eingebettet)
League 1 ──── *   LeagueTeam       (eingebettet; own-Flag = eigene Mannschaft)
```

---

## 4. Rollen & Rechte (Vereinsmodus)

Definiert in `ROLES` / Methode `perm()`. Im **lokalen Modus sind alle `true`**.

| Fähigkeit          | admin | captain | player | viewer |
|--------------------|:-----:|:-------:|:------:|:------:|
| Benutzer verwalten | ✓     | –       | –      | –      |
| Verein/Einstellungen (Modus, Name, Logo) | ✓ | – | – | – |
| Spieler verwalten  | ✓     | ✓       | –      | –      |
| Mannschaften verwalten | ✓ | ✓       | –      | –      |
| Ligen & Ergebnisse | ✓     | ✓       | –      | –      |
| Termine verwalten  | ✓     | ✓       | –      | –      |
| Spielen (Counter/Training) | ✓ | ✓   | ✓      | –      |

Durchsetzung im Prototyp: (a) UI blendet Aktionen aus, (b) die mutierenden
Methoden (`openAdd*`, `goSetup` …) prüfen `perm()` zusätzlich. **Im Backend müssen
die Rechte serverseitig erzwungen werden** — die Client-Prüfung ist nur UX.

---

## 5. Offene Entscheidungen vor / während der Umsetzung

1. **Auth & Sicherheit:** echtes Login (Passwort-Hash, Session/JWT, „Passwort
   vergessen"), **Einladungs-Flow per E-Mail** (im Prototyp nur angedeutet).
2. **Liga-Teams ↔ Vereins-Teams:** Soll das `own`-Team einer Liga auf ein echtes
   `Team` (und damit Spieler/Statistik) zeigen, statt Freitext?
3. **Ergebnis ↔ Counter:** Soll ein Ligaspiel über den Darts Counter (Brett für
   Brett) gespielt und das Ergebnis automatisch in die `Fixture` übernommen werden?
   Aktuell sind Liga-Ergebnisse reine Leg-Zahlen, getrennt von `Match`.
4. **Match ↔ Player per ID statt Name:** Matches referenzieren Spieler aktuell über
   den Namen. Für robuste Statistik auf `Player.id` umstellen.
5. **Referenzielle Integrität:** Verhalten beim Löschen eines Spielers, der Kapitän
   ist / in einem Kader steht / mit einem Account verknüpft ist, definieren.
6. **Tabellen-/Punktregeln** bestätigen (aktuell 2/1/0; Auf-/Abstiegszonen sind nur
   kosmetisch). Reale Ligaregeln können abweichen (Satzpunkte etc.).
7. **Mobile/Tablet:** Die Verwaltung ist eine Desktop-Oberfläche (feste Sidebar);
   der Counter ist tablettauglich. Mobile-Layout für die Verwaltung klären.

---

## 6. localStorage-Schlüssel (Referenz)

| Key | Inhalt |
|-----|--------|
| `dartshub_players`  | Player[] |
| `dartshub_teams`    | Team[] |
| `dartshub_users`    | Account[] |
| `dartshub_session`  | Account.id \| null |
| `dartshub_leagues`  | League[] (inkl. Fixtures) |
| `dartshub_events`   | Event[] |
| `dartshub_matches`  | Match[] (Counter-Ergebnisse) |
| `dartshub_training` | TrainingResult[] |
| `dartshub_settings` | Settings |
| `dartshub_live`     | laufendes Counter-Spiel (Wiederaufnahme) |

---

## 7. Noch hartkodierte Demo-Daten (bewusst Platzhalter)

- **Statistik-Seite:** Scoring-Detail (60+/100+/140+/180), Form-Verlauf und „letzte
  Spiele" im Spielerdetail sind teils Demo-Werte, solange keine echten `Match`-Daten
  vorliegen.
- **Spieltag-Detail (Brett-für-Brett-Ansicht):** vorhanden, aber nicht mehr verlinkt
  — entweder an `Fixture` anbinden oder entfernen.
- Lokaler Modus: einige Dashboard-Kennzahlen sind Beispielwerte.

Dashboard-Kennzahlen, Tabelle, „Nächster Spieltag", Top-Spieler und die
Mannschafts-/Liga-Listen im **Vereinsmodus** werden bereits aus den echten Daten
(Spieler, Teams, Ligen) berechnet.
