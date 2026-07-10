# Konzept: nuLiga-Import (Tabelle & Ligaspieltage)

> Stand: 2026-07-07. Konzept, noch nicht umgesetzt. Ziel: die **Tabelle** und die **Spieltage** aus
> nuLiga (BDV, `bdv-dart.liga.nu`) automatisch in DartsZentrale anzeigen — **max. einmal täglich** abgerufen.

## 1. Ziel & Geltungsbereich

Die eigene Liga-Gruppe bei nuLiga (z. B. `<Verband> 2025/26`, Gruppe `123456`) liefert öffentlich Tabelle und
Spielplan als HTML. DartsZentrale soll diese Daten **read-only** spiegeln und im Vereinskontext anzeigen
(Tabelle, kommende/vergangene Spieltage, eigenes Team hervorgehoben).

**Nur Vereinsmodus (LAN/Cloud).** Der Abruf muss **server-seitig** laufen:
- **CORS:** nuLiga sendet keine CORS-Header → ein Browser-`fetch` aus der App wäre blockiert. Es braucht
  einen Server, der die Seite holt.
- **Zeitplan:** „einmal täglich" braucht einen Scheduler → PocketBase-Cron.
- **ein-board** (localProvider, kein Server) hat weder das eine noch das andere → dort **nicht verfügbar**
  (die Liga-Tabelle ist ohnehin ein Vereins-Thema). *(Optionaler Nebenweg für ein-board über
  `serve-dist.mjs` siehe §9 — nicht Teil des Primär-Scopes.)*

## 2. Datenquelle (verifiziert 2026-07-07)

Basis-URL: `https://bdv-dart.liga.nu/cgi-bin/WebObjects/nuLigaDARTDE.woa/wa/groupPage`
Parameter: `championship=<Saison>` (z. B. `<Verband> 2025/26`, url-enkodiert `<Verband>+2025%2F26`), `group=<id>` (z. B. `123456`).

| Zweck | URL-Zusatz |
|---|---|
| Tabelle + **aktueller** Spieltag | (Basis, ohne Zusatz) |
| **Vollständige Tabelle** | `&displayTyp=gesamt&displayDetail=table` |
| **Alle Spieltage** (Vor- + Rückrunde) | `&displayTyp=gesamt&displayDetail=meetings` |
| Nur Vor-/Rückrunde | `&displayTyp=vorrunde\|rueckrunde&displayDetail=…` |
| Einzelspiel-Bericht (Board-Details) | `groupMeetingReport?meeting=<id>&…` |
| Team-Seite | `teamPortrait?teamtable=<id>&…` |
| Spieler-Ranglisten (180er, HighFinish, LowDarts, Punkte) | `groupPortrait?…&type=ranking…` |
| PDF (Tabelle + Spielplan) | `…nuDokument?dokument=ScheduleReportFOP&group=<id>` |

**Rahmenbedingungen (geprüft):**
- `robots.txt`: `Disallow: *.inc`, `*.csi` — die `groupPage` ist **erlaubt**.
- HTTP 200, `text/html`, ~30 KB, **keine Anmeldung** nötig.
- Beide Zieltabellen sind sauber ausgezeichnet: `<h2>Tabelle</h2>` / `<h2>Spielplan …</h2>` gefolgt von
  `<table class="result-set">`.

**Für den vollen Umfang genügen 2 Requests/Tag:** `displayDetail=table` + `displayDetail=meetings` (beide `gesamt`).

## 3. Geparste Struktur (Ist-Zustand)

**Tabelle** (`result-set`), Spalten:
`Rang | Team | Spiele(gespielt) | S | U | N | Legs (z. B. 104:64) | +/- | Punkte (z. B. 23:5)`

**Spielplan** (`result-set`), Spalten:
`Wochentag | Datum | Zeit | Spiellokal(Code) | Heimmannschaft | Gastmannschaft | Ergebnis (z. B. 6:6, leer wenn offen)`

Parsing ist per Zeilen-/Zellen-Regex über den `result-set`-Block möglich (in einem Spike bereits erfolgreich
extrahiert) — kein DOM-Parser nötig, was zur PocketBase-Hook-Laufzeit (Goja) passt.

## 4. Architektur

```
PocketBase-Hook (pb_hooks/nuliga.pb.js)
  ├─ cronAdd("nuliga-sync", "17 5 * * *")     → 1×/Tag um 05:17 (odd minute = höflich)
  │     └─ $http.send(table-URL) + $http.send(meetings-URL)
  │           └─ parseResultSet(html) → { standings[], fixtures[] }
  │                 └─ Snapshot in Collection `nuliga_group` schreiben (fetched_at, status)
  ├─ POST /api/nuliga/sync  (nur Admin, manueller Refresh, gedrosselt: min. 1 h Abstand)
  └─ Fehlerfall: letzten guten Snapshot behalten, status/error setzen (Admin sieht es)

App (Frontend)
  └─ liest `nuliga_group` (read-only) → Liga-Ansicht (Tabelle + Spieltage), „Stand: … · Quelle: nuLiga"
```

Warum PocketBase-Hook: läuft in allen Vereins-Betriebsarten (LAN-Single-Binary **und** Cloud) identisch,
kann ausgehendes HTTP (`$http.send`) und Cron (`cronAdd`), und schreibt direkt in eine Collection.

## 5. Datenmodell (Vorschlag: minimal, Snapshot-basiert)

Eine Collection **`nuliga_group`** (admin-verwaltet), je verfolgter Gruppe ein Record:

| Feld | Typ | Zweck |
|---|---|---|
| `label` | text | Anzeigename (z. B. „Bezirksoberliga") |
| `championship` | text | z. B. `<Verband> 2025/26` |
| `group` | text | z. B. `123456` |
| `own_team` | text | eigener Teamname (zum Hervorheben; optional) |
| `enabled` | bool | Abruf an/aus |
| `standings` | json | geparste Tabelle (Array von Zeilen) |
| `fixtures` | json | geparste Spieltage (Array) |
| `fetched_at` | date | Zeitpunkt des letzten erfolgreichen Abrufs |
| `http_status` / `error` | text | Diagnose des letzten Laufs |

Snapshot wird **in-place ersetzt** (kein Diffing, keine Historie nötig). Rules: read = eingeloggt;
write/create = admin-only. Der Abruf-Hook schreibt als Systemkontext.

**Admin-UX:** Betreiber fügt eine Gruppe hinzu, indem er die **nuLiga-Gruppen-URL einfügt** — der Hook
zieht `championship` + `group` selbst heraus (kein Handzerlegen von Parametern).

## 6. Abruf-Politik („einmal am Tag")

- **Cron 1×/Tag** (feste, ungerade Minute; nachts). Kein Polling.
- **Manueller Refresh** (Admin-Button) **gedrosselt**: lehnt ab, wenn der letzte Abruf < 1 h her ist
  (Force nur explizit) — hält die „max. 1×/Tag"-Idee, erlaubt aber Ad-hoc bei Bedarf.
- **Conditional GET** (`If-Modified-Since`/`ETag` speichern) → 304 spart Übertragung/Last.
- Klarer, ehrlicher **User-Agent** (`DartsZentrale/<version> (+Vereins-Selbstabruf)`), Timeout ~15 s,
  **max. 1 Retry**. Bei zwei Gruppen: sequentiell mit kleiner Pause, nicht parallel.

## 7. Darstellung in der App

Neue read-only Rubrik **„Liga"** (Vereinsmodus):
- **Tabelle** mit eigenem Team hervorgehoben (Rang, Sp, S/U/N, Legs, Diff, Punkte).
- **Spieltage** als Liste/Akkordeon (Datum, Heim–Gast, Ergebnis; kommende oben oder „nächster Spieltag").
- Kopf: „Stand: `<fetched_at>` · Quelle: **nuLiga** (Link zur Gruppenseite)".
- Optional später: Abgleich mit eigenen Terminen/Spielen (eigener Heimspieltag → in den Kalender).

## 8. Robustheit, Betrieb, Recht

- **Brittle Parsing:** HTML kann sich ändern. Schutz: Header-Plausibilitätscheck (erwartete Spaltenzahl),
  bei Fehler **letzten guten Snapshot behalten** + `error` setzen; Admin sieht den Status.
- **Saisonwechsel:** `championship` ändert sich jährlich → Gruppe ist konfigurierbar (URL neu einfügen).
- **Recht:** öffentliche Verbandsdaten der **eigenen** Liga, read-only, mit **Quellenangabe/Link**, keine
  kommerzielle Weiterverbreitung, robots-konform, minimale Last (≤ 2 Requests/Tag). Risiko gering; im
  Zweifel kurze Rückfrage beim BDV/Landesverband.
- **Secrets:** keine — der Abruf ist unauthentifiziert.

## 9. Optionaler ein-board-Nebenweg (nicht Primär-Scope)

`serve-dist.mjs` (Node, im ein-board-/lokal-Betrieb) könnte einen Endpunkt `/api/nuliga` mit
Tages-Cache anbieten (gleiche Parse-Logik). Nur relevant, falls ein Einzel-Board ohne Vereinsserver die
Tabelle sehen soll — normalerweise überflüssig. Bewusst nachrangig.

## 10. Umsetzungsschritte (grobe Phasen)

1. **Spike/Parser härten:** `parseResultSet()` gegen echte Tabelle **und** Meetings-Seite, mit
   Header-Check und Beispiel-Fixtures (auch „offen"/leer, Verlegungen „v").
2. **Collection** `nuliga_group` + Rules (Migration).
3. **Hook** `pb_hooks/nuliga.pb.js`: `cronAdd` + `$http.send` + Parser + Snapshot-Write + `POST /api/nuliga/sync` (Admin, gedrosselt) + Conditional GET.
4. **Frontend:** Liga-Rubrik (Tabelle + Spieltage), eigenes Team markieren, Quelle/Stand anzeigen; Admin-UI zum Anlegen/Bearbeiten der Gruppe (URL einfügen) + „Jetzt aktualisieren".
5. **Test** gegen die reale Gruppe; Fehlerfälle (nuLiga down, HTML geändert) durchspielen.

## Offene Punkte

- Mehrere Teams/Gruppen eines Vereins? (Datenmodell erlaubt es — mehrere `nuliga_group`-Records.)
- Sollen **Spieler-Ranglisten** (180er/HighFinish/LowDarts) mitgenommen werden? (eigene URLs, §2 — später.)
- Einzelspiel-Details (`groupMeetingReport`) nur bei Bedarf (mehr Requests → gegen „1×/Tag" abwägen).
- Genaue Spaltensemantik „Legs" vs. „Sätze" im BDV-Modus final verifizieren.
