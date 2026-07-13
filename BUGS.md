# 🐞 BUGS

> Sammelstelle für konkrete Fehler & Testfunde. Für geplante Features / größere offene Punkte siehe [ROADMAP.md](ROADMAP.md).
>
> **Status:** `[ ]` offen · `[~]` in Arbeit · `[x]` behoben · `[?]` nicht reproduzierbar / Rückfrage
> **Prio:** 🔴 hoch (blockiert) · 🟡 mittel · ⚪ niedrig / kosmetisch

---

## Offen
<!-- Neue Funde hier oben eintragen. Vorlage darunter kopieren. -->

### [ ] #0 — Kurztitel
- **Prio:** 🟡
- **Screen/Bereich:** z. B. Counter · Training · Settings · Dashboard
- **Gerät:** z. B. Board-Monitor (Desktop, ~2,37 m) · Tablet · Smartphone
- **Erwartet:** was passieren sollte
- **Tatsächlich:** was passiert
- **Schritte:** 1. … 2. … 3. …
- **Notiz:** Screenshot, Konsole, Vermutung …

---

## Behoben

_Behoben am 2026-07-13 (Nachtrag 3) — im Vereinsmodus mit Saison-Namensabweichung reproduziert & live verifiziert._

### [x] #13 — Nach Import: manuelle Kalender-Termine „gelöscht" + Termine fehlen im Dashboard
- **Prio:** 🔴 · **Bereich:** Kalender/Dashboard (nach CSV-Import) · **Gerät:** alle (Vereinsmodus)
- **Symptom:** Nach dem Import waren selbst eingetragene Termine verschwunden und importierte Termine tauchten im Dashboard nicht auf (im Kalender schon).
- **Ursache:** Die Saison-Erkennung (#0) glich Saisonnamen **exakt** ab. Hieß die aktive Saison minimal anders als die CSV-Saison (z. B. „Saison 2025/2026" vs. CSV „2025/26"), legte der Import eine **zweite Saison** an, machte sie aktiv und **archivierte die bisherige** → Ligen/Termine der alten Saison (inkl. der manuellen) landeten in der archivierten Saison und fielen aus Dashboard/Kalender (die nach der aktiven Saison filtern).
- **Fix:** Toleranter Saison-Abgleich `seasonKey` (`app/src/lib/scheduleImport.ts`): „2025/26", „2025/2026", „Saison 2025/26" ergeben denselben Schlüssel „2025/26". `importSchedule` (`useStore.ts`) und die Import-Vorschau nutzen ihn → ein Re-Import trifft die bestehende Saison, statt eine zweite anzulegen. Kein Saison-Wechsel → manuelle Termine bleiben, importierte Termine liegen in der aktiven Saison.
- **Verifiziert:** aktive Saison „Saison 2025/2026" + manueller Termin + Import „2025/26"-CSV → nur EINE Saison, manueller Termin bleibt, Termin erscheint im Dashboard (Zeitraum „Alle").

### [x] #12 — „Liga bearbeiten" öffnet die falsche Liga (bei Ligen in mehreren Saisons)
- **Prio:** 🔴 · **Bereich:** Ligen · **Gerät:** alle (Vereinsmodus mit archivierter Vorsaison)
- **Symptom:** Im Ligen-Screen die richtige Liga ausgewählt (z. B. 8er-Cup mit korrekter Tabelle/Begegnungen), aber „Liga bearbeiten" öffnete eine **andere** Liga (z. B. „4. Bezirksliga B"). Trat nur auf, wenn die Datenbank Ligen aus **mehreren Saisons** enthielt (z. B. archivierte Vorsaison mit eigenen Ligen) — auf einer frischen DB mit nur einer Saison unauffällig.
- **Ursache:** `selectedLeague` ist ein Index in die **saison­gefilterte Anzeige** (`inSeason`), aber `openEditLeague`/`openAddFixture`/`openResult`/… lösten mit demselben Index direkt in die **ungefilterte** `st.leagues` (alle Saisons) auf → bei Ligen mehrerer Saisons verschoben sich die Indizes.
- **Fix:** Zentraler Helfer `currentLeague(st)` löst die Auswahl immer über dieselbe gefilterte Liste auf wie der Screen; alle betroffenen Aktionen nutzen ihn. Zusätzlich setzen Anlegen/Löschen die Auswahl als Index in die gefilterte Liste. `app/src/store/useStore.ts`.
- **Verifiziert:** Vorsaison mit eigenen Ligen angelegt → 8er-Cup, Klaus Unterberg Pokal, 4. Bezirksliga B, Bayernliga, Damenpokal: „Liga bearbeiten" öffnet jeweils die korrekte Liga.
- **Zusatz-Härtung:** Der Liga/Pokal-Typ fließt jetzt in Gruppierung + Merge des CSV-Imports ein (`scheduleImport.ts`), sodass eine Liga- und eine Pokal-Staffel mit gleichem Namen nie verschmelzen.

### [x] #0 — CSV-Import: Saison aus der Datei wird nicht erkannt (immer aktive Saison)
- **Prio:** 🟡 · **Bereich:** Ligen/Saison (CSV-Import) · **Gerät:** alle
- **Symptom:** Der Import ordnete alle Ligen **immer der aktuell aktiven Saison** zu und nutzte die `Saison`-Spalte der CSV nur als Text-Label. Hieß die aktive Saison anders als in der CSV (z. B. aktiv „2024/25", CSV „2025/26"), landete der Spielplan in der falschen Saison — die CSV-Saison wurde „nicht erkannt".
- **Ursache:** `importSchedule` (`app/src/store/useStore.ts`) taggte Ligen/Teams/Termine fest mit `activeSeasonId`, ohne die CSV-Saison zu berücksichtigen.
- **Fix:** Der Import **erkennt jetzt die Saison aus der CSV**: bestehende Saison per Name finden, sonst neu anlegen; die (Primär-)CSV-Saison wird **aktiv + angezeigt**, eine bisher andere aktive Saison wird **archiviert** (bleibt erhalten). Ligen/Mannschaften/Termine werden der erkannten Saison zugeordnet (Mannschaften erben die Saison der Liga via `deriveOwnTeams`).
- **Verifiziert:** aktive Saison „2024/25" + Import einer „2025/26"-CSV → neue Saison „2025/26" aktiv, „2024/25" archiviert, alle 13 Ligen + 15 Mannschaften unter „2025/26"; erneuter Import legt nichts doppelt an.

### [x] #11 — CSV-Import: Termine werden bei erneutem Import doppelt angelegt
- **Prio:** 🟡 · **Bereich:** Kalender/Termine (CSV-Import, Vereinsmodus) · **Gerät:** alle
- **Symptom:** Zweiter Import desselben Spielplans legte alle Spieltag-Termine **erneut** an (154 → 308 …).
- **Ursache:** Die `events`-Collection in `pocketbase/provision.mjs` hatte **kein `fixtureId`-Feld** (die Baseline-Migration schon → nur der provision-basierte Betrieb war betroffen). PocketBase verwarf die `fixtureId` beim Speichern → nach dem Reload konnte der Import vorhandene Termine nicht mehr wiedererkennen (Idempotenz über `fixtureId`) und legte sie doppelt an.
- **Fix:** `text('fixtureId')` in der `events`-Definition von `provision.mjs` ergänzt (deckungsgleich mit der Baseline-Migration). Bestehende provision-Installationen: einmal `provision.mjs` erneut ausführen.
- **Verifiziert:** Feld vorhanden; 1. Import 154 Termine, 2. Import 0 neue (events bleiben 154).

_Behoben am 2026-07-13 — gegen PocketBase im Vereinsmodus reproduziert & live verifiziert (Import der echten Vereins-CSV + nuLiga-Abgleich)._

### [x] #10 — CSV-Import: Pokalmannschaften werden als Ligamannschaften erkannt (nur eine Mannschaft pro Pokal)
- **Prio:** 🟡 · **Bereich:** Mannschaften (nach CSV-Import) · **Gerät:** alle
- **Symptom:** Nach dem Spielplan-Import fehlten die **Pokalmannschaften**. Eine Mannschaft, die in Liga **und** Pokal spielt (z. B. „DSV Nürnberg", „DSV Nürnberg II"), existierte nur **einmal** (als Ligamannschaft); reine Pokal-Teams (Manuka, 501 No Scope II, DSV Devils & Angels) wurden ohne Pokal-Kennung angelegt.
- **Ursache:** `deriveOwnTeams` (`app/src/lib/scheduleImport.ts`) hat die eigenen Mannschaften **nur nach Namen** dedupliziert und **keine `kind`** gesetzt → gleiche Namen aus Liga & Pokal fielen zusammen, alles landete als Liga-Team.
- **Fix:** Ableitung erhält jetzt die **Art** aus dem Wettbewerb (Pokal-Liga → `kind='cup'`, sonst `'league'`) und dedupliziert pro **(Art + Name)**. So entstehen für denselben Namen eine Liga- **und** eine Pokalmannschaft; ein Spieler darf je einer angehören.
- **Verifiziert:** Import der echten Vereins-CSV → 15 eigene Mannschaften (10 Liga + 5 Pokal), „DSV Nürnberg"/„DSV Nürnberg II" in PocketBase als je Liga- **und** Pokal-Team.

### [x] #9 — CSV-Import: Pokal-Saison „Pokal 2025/26" statt „2025/26" (Phantom-Saison)
- **Prio:** 🟡 · **Bereich:** Ligen/Saison (nach CSV-Import) · **Gerät:** alle
- **Symptom:** Pokal-Wettbewerbe erschienen unter der Saison **„Pokal 2025/26"** statt der eigentlichen Saison **„2025/26"** — die Saison wurde für Pokal-Zeilen nicht korrekt erkannt.
- **Ursache:** BDV/nuLiga filet Pokale in der `Saison`-Spalte unter „Pokal 2025/26". Der Import übernahm den Wert **wörtlich** als Saison-Label → eigene Phantom-Saison neben „2025/26".
- **Fix:** Saison-Label wird normalisiert (Jahr `\d{4}/\d{2,4}` extrahiert): „Pokal 2025/26" → „2025/26". Die **Cup-Erkennung** nutzt weiter den Rohwert (Staffelname „…Pokal"/„Cup" bzw. rohe Saison), bleibt also erhalten. `app/src/lib/scheduleImport.ts`.
- **Verifiziert:** Import → nur noch **ein** Saison-Label „2025/26"; alle drei Pokale (Klaus Unterberg Pokal, 8er-Cup, Damenpokal) mit `kind='cup'` darunter.

_Behoben am 2026-07-05 — gegen PocketBase reproduziert & verifiziert._

### [x] #8 — Benutzerverwaltung: E-Mail-Adresse eines Kontos lässt sich nicht ändern
- **Prio:** 🔴 · **Bereich:** Benutzerverwaltung · **Gerät:** alle
- **Symptom:** Beim Ändern der E-Mail eines Kontos (auch des eigenen Admin-Kontos) → „Änderung konnte nicht gespeichert werden". Andere Felder (Name, Rolle …) speichern normal.
- **Ursache:** Die `users`-Collection hatte **keine `manageRule`** (war `null`). PocketBase behandelt `email`/`verified` als „managed" Auth-Felder und lässt sie über die Records-API nur von einem **Superuser** oder einer Anfrage mit erfüllter `manageRule` ändern. Die App meldet sich als normaler `users`-Datensatz an (App-Rolle `admin`, kein PB-Superuser) → E-Mail-Änderung wird mit HTTP 400 `validation_values_mismatch` („Values don't match") abgewiesen, das ganze Update scheitert. Der echte Feld-Fehler landete nur in der Konsole (`persist` → generisches `syncError`).
- **Fix:** `manageRule = "@request.auth.role = \"admin\""` an der `users`-Collection (deckungsgleich mit `updateRule`). Migration `pocketbase/pb_migrations/1782300003_users_manage_rule.js` + gespiegelt in `pocketbase/provision.mjs`.
- **Verifiziert:** Reproduktion gegen PocketBase — vorher 400, nach der Migration ändert der App-Admin fremde **und** eigene E-Mail mit 200; Superuser-Pfad unverändert.
- **Nebenwirkung (erwartet):** Ändert ein Admin seine **eigene** E-Mail, invalidiert PocketBase dessen Session-Token (wie bei Passwortänderung) → danach neu anmelden.

_Behoben am 2026-07-03 — im lokalen Verein-Test verifiziert._

### [x] #7 — Kiosk: Admin kann sich zum Verlassen des Board-Modus nicht anmelden
- **Prio:** 🔴 · **Bereich:** Kiosk-Ausstieg (Board-Modus) · **Gerät:** Board-Monitor
- **Symptom:** Nach Eingabe korrekter Admin-Zugangsdaten im Exit-Dialog passiert nichts / „Anmeldung fehlgeschlagen".
- **Ursache:** `kioskExitLogin` prüfte die Rolle **vorab per E-Mail-Vergleich** gegen die geladene Kontoliste. Ein Board-Konto sieht fremde E-Mails aber nur bei `emailVisibility=true` (bei manuell im PB-Panel angelegten Admins default **aus**) → Konto wird nicht gefunden → Abbruch **vor** jedem Login-Versuch.
- **Fix:** Neue Provider-Methode `kioskExitAuth(email, pw, allowedRoles)` — meldet an, prüft die Rolle am echten authentifizierten Record und stellt die Board-Sitzung bei Ablehnung/falschem Passwort wieder her. `app/src/data/provider.ts`, `pocketbaseProvider.ts`, `localProvider.ts`, `store/useStore.ts`.
- **Verifiziert:** lokaler Verein-Test T1–T5 (Admin mit versteckter E-Mail, Admin/Kapitän mit sichtbarer E-Mail, Spieler-Ablehnung + Board-Sitzung erhalten, falsches Passwort).

_Behoben am 2026-07-02 — verifiziert in der Preview._

### [x] #1 — Startbildschirm: „PocketBase" → „Datenbank"
- **Bereich:** ModePicker (Ersteinrichtung) · **Fix:** Benutzertext auf „Datenbank" umbenannt (kein Techbegriff „PocketBase" mehr) — `app/src/screens/ModePicker.tsx`.

### [x] #2 — Trainingsspiele per Tastatur bedienbar
- **Bereich:** Trainingsspiele · **Fix:** Zahlentasten im Board-Betrieb: Doppel/Bob's 27 & Around-the-Clock `0–3`, Checkout 121 `1–3` + `0` = verfehlt, Baseball `0–9`. Hits-, Advance-, Checkout- & Runs-Panel via neuem `useTrainKeys`-Hook — `app/src/screens/TrainingGame.tsx`. (Score-/Halve-Panels hatten bereits Eingabefeld + Enter.)

### [x] #3 — Ersteinrichtung: leerer Kalender
- **Bereich:** Kalender · **Fix:** `seedEvents()` liefert `[]` → frische Installation ohne Demo-Termine (lokal & Verein) — `app/src/data/seed.ts`.

### [x] #4 — Nach Spielende: Buttons per Tastatur
- **Bereich:** Darts Counter (Sieg-Overlay) · **Fix:** `1` = Dashboard, `2` = Neues Spiel, `3`/`Enter` = Revanche, mit Tasten-Hinweisen — `app/src/screens/Counter.tsx`.

### [x] #5 — Einstellungen: „Zum Darts Counter"-Button entfernt
- **Bereich:** Einstellungen · **Fix:** Button samt ungenutztem Icon-Import entfernt — `app/src/screens/Settings.tsx`.

### [x] #6 — Counter-Setup: Tastenkürzel Alt+Enter
- **Bereich:** Darts Counter (Setup) · **Fix:** „Spiel starten" jetzt auf **Alt+Enter**, als globaler Listener (funktioniert unabhängig vom Fokus; das alte Strg+Enter griff nur bei Fokus im Suchfeld). Hinweis-Badge/Tooltip angepasst — `app/src/screens/CounterSetup.tsx`.
