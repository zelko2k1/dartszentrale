# nuLiga-Parser – Spike-Fixtures & verifizierte Struktur

Reale, öffentlich abgerufene Seiten (BDV, Gruppe MFr 2025/26, `group=211260`) als Regressions-Fixtures
für den Parser in `pb_hooks/nuliga.pb.js`. Abgerufen 2026-07-12, HTTP 200, keine Anmeldung.

- `sample-meetings-MFr-211260.html` — Liga-Spielplan (`&displayTyp=gesamt&displayDetail=meetings`), 117 KB.
- `sample-table-MFr-211260.html` — offizielle Liga-Tabelle (`&displayDetail=table`), 22 KB. Nur zum Abgleich;
  die App **rechnet** die Tabelle selbst.
- `sample-pokal-MFr-210736.html` — **Pokal** (K.-o., `Mittelfranken Pokal 25/26`, group 210736), 213 KB.

## Pokal-Layout (K.-o.) — abweichend, wird vom selben Parser abgedeckt

Der Pokal-Spielplan hat **zwei Zusatzspalten** (`Runde`, `Nr.`) zwischen Spiellokal und Heimmannschaft →
Heim/Gast/Spiele stehen bei **Zelle 6/7/8** statt 4/5/6. Deshalb liest der Parser die Spaltenindizes
**aus der Kopfzeile** (Label → physischer Index inkl. `colspan`), statt fixe Positionen anzunehmen.
Zusätzlich: Runden-Titelzeilen (`<th>Final</th>` etc.) und „Freilose"-Abschnitte (nur ein Team) werden
übersprungen (kein Heim+Gast). Datum/Zeit/Spiellokal liegen in beiden Layouts bei 1/2/3.
Verifiziert: Liga 56 Begegnungen (Cols 4/5/6), Pokal 69 (Cols 6/7/8). Pokal zeigt in der App **keine
Tabelle** (kind='cup' → K.-o., nur Begegnungen/Ergebnisse).

## Verifizierte Meetings-Struktur (Ist 2026-07-12)

- Genau **eine** `<table class="result-set">` auf der Meetings-Seite (der Spielplan).
- Header-Zeile: `Tag Datum Zeit | Spiellokal | Heimmannschaft | Gastmannschaft | Spiele | (3× leer)`.
- **Datenzeilen haben 10 `<td>`** (Header 8 durch Gruppierung):
  0. Tag (`Fri.`/`Sat.`/…) — **leer bei Folgespielen desselben Spieltags**
  1. Datum (`26.09.2025`) — **leer bei Folgespielen** → letzten Wert **fortschreiben**
  2. Zeit (`20:00`); bei Verlegung `20:00 v` — der **`v`-Suffix = verlegt**; `HH:MM`-Regex ignoriert ihn,
     das Datum ist bereits das (verlegte) echte Spieldatum.
  3. Spiellokal: Code als Linktext, **echter Hallenname im `<span title="…">`** → daraus `loc`.
  4. Heimmannschaft (Klartext)
  5. Gastmannschaft (Klartext)
  6. Spiele/Ergebnis: `<a title="Match Report"><span>8:4</span></a>` → `hs:as` (gewonnene Spiele).
     **Leer = noch nicht gespielt** (kein Link/Span).
  7.–9. Icons/Links (ignorieren).

## Abgleich gerechnet ↔ offiziell

Aus den 56 geparsten Begegnungen mit `computeStandings` (2/1/0, Tiebreak Pkt → Leg-Diff → Legs → Name)
gerechnete Tabelle ist **deckungsgleich** mit nuLigas offizieller Tabelle (Rang, S/U/N, Legs, Diff, Pkt) —
für alle 8 Teams. nuLiga zeigt Punkte zweiseitig (`11:17`), maßgeblich ist die erste Zahl (= App-`pts`).
Keine Strafpunkte / keine Legs-vs-Sätze-Abweichung in dieser Gruppe. Validiert die Merge-Architektur.
