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
