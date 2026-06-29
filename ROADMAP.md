# Roadmap → Version 1.0

> Stand: **2026-06-29**. Zentrale Sammelstelle für alle offenen Punkte bis zum 1.0-Release.
> Quelle der Einzelpläne: [`docs/plan-2fa.md`](docs/plan-2fa.md), [`docs/plan-saison.md`](docs/plan-saison.md),
> [`docs/security-audit.md`](docs/security-audit.md), [`DATA_MODEL.md`](DATA_MODEL.md).
>
> Diese Datei ist der **Master-Überblick**. Details/Begründungen stehen in den verlinkten Dokumenten —
> hier wird nur der Status gebündelt und priorisiert.

**Legende:** `[ ]` offen · `[x]` erledigt · `[~]` teilweise · `[?]` prüfen (evtl. schon erledigt)
· 🧑‍💻 = Code-Arbeit (von Claude umsetzbar) · ⚙️ = Betreiber-/Deploy-Aufgabe (manuell)

---

## 1. Sicherheit & Go-live (höchste Priorität)

**Code-seitig bereits gehärtet** (Details: [`docs/security-audit.md`](docs/security-audit.md)):
- [x] 🧑‍💻 #4 Match-Ergebnisse an Ersteller gebunden (`createdBy`-Stempel)
- [x] 🧑‍💻 #6 (Kern) `seasons`/`leagues`/`teams` anlegen/löschen admin-only (Migration `harden_authz`)
- [x] 🧑‍💻 #7/#8 Seeds brechen gegen Default-Passwörter / Nicht-Lokal-Ziele ab (`_security-guard.mjs`)
- [x] 🧑‍💻 #9/#13 nginx Security-Header, `server_tokens off`, CSP-Vorlage

**Offen — Code:**
- [ ] 🧑‍💻 **#6-Rest:** Kapitän-Roster-Editing auf die *eigene* Mannschaft scopen (`captainId == auth.playerId`)
- [ ] 🧑‍💻 #11 `reset-password.mjs`: `NEW_PW` erzwingen statt Default `dartshub123`
- [ ] 🧑‍💻 #12 (abwägen) Kader-Lesbarkeit für eingeloggte Nutzer — bei Minderjährigen einschränken

**Offen — Betreiber / Pre-Go-live-Checkliste** (⚙️ nicht von Claude erledigbar, nur vorbereitbar):
- [ ] ⚙️ #1 PB-Superuser-Passwort rotiert, Literal aus `seed-remote.sh` entfernt
- [ ] ⚙️ #2 Produktiv-Admin manuell mit starkem Passwort; keine Seeds gegen Prod
- [ ] ⚙️ #3 PB nicht als Klartext-HTTP im Internet (loopback + Firewall, oder bewusst nur LAN)
- [ ] ⚙️ #5 PB-Admin-Konsole `/_/` abgeschirmt (IP/VPN), Superuser-MFA + Rate-Limit, CORS-Allowlist
- [ ] ⚙️ #9 CSP in `nginx.conf` auf echte PB-Domain angepasst, einkommentiert, getestet
- [ ] ⚙️ HTTPS erzwungen (Proxy/Cloudflare), HSTS aktiv
- [ ] ⚙️ Starke, einzigartige Passwörter für alle Konten

---

## 2. Features für 1.0

- [ ] 🧑‍💻 **2FA / TOTP** (optional, opt-in) — vollständig geplant, noch nichts umgesetzt.
      Plan: [`docs/plan-2fa.md`](docs/plan-2fa.md). **Erster Schritt:** Feasibility-Spike —
      ist HMAC-SHA1 im PB-`pb_hooks`-JSVM verfügbar? Falls nein, geprüfte Pure-JS-Routine einbetten.
      Danach: Collection `user_mfa`, Enrollment (QR), serverseitige Verifikation, Backup-Codes, Rettungsskript.
- [x] 🧑‍💻 **Saison-Lebenszyklus** (Abschluss · Neubeginn · Soft-Archiv · Auslagern) — Phasen 1–4 umgesetzt
      ([`docs/plan-saison.md`](docs/plan-saison.md)).

---

## 3. Datenmodell-Härtung (für robuste Statistik & Integrität)

Aus [`DATA_MODEL.md §5`](DATA_MODEL.md). Manche Punkte sind evtl. schon erledigt → vor Umsetzung prüfen.

- [?] 🧑‍💻 Echtes Login + Passwort-Reset — laut DATA_MODEL-Kopf bereits umgesetzt → nur verifizieren
- [ ] 🧑‍💻 **Einladungs-Flow per E-Mail** (im Prototyp nur angedeutet)
- [ ] 🧑‍💻 **Match ↔ Player per ID statt Name** — Matches referenzieren Spieler über Namen; auf `Player.id` umstellen
- [ ] 🧑‍💻 **Referenzielle Integrität** beim Löschen eines Spielers (Kapitän / im Kader / mit Account verknüpft) definieren
- [ ] 🧑‍💻 **Liga-Team ↔ Vereins-Team:** `own`-Team einer Liga auf echtes `Team` zeigen lassen (statt Freitext)
- [ ] 🧑‍💻 **Ergebnis ↔ Counter:** Ligaspiel über den Darts Counter spielen, Ergebnis automatisch in die `Fixture`
- [ ] 🧑‍💻 **Tabellen-/Punktregeln** bestätigen (aktuell 2/1/0; reale Ligaregeln können abweichen)
- [ ] 🧑‍💻 **Hartkodierte Demo-Statistik** (60+/100+/140+/180, Form-Verlauf) durch echte Daten ersetzen ([`DATA_MODEL.md §7`](DATA_MODEL.md))

---

## 4. Offen / später (nach 1.0 oder optional)

- [ ] Mobile-Layout für die Verwaltung (Counter ist bereits tablettauglich)
- [ ] Backup-Retention + Größen-Monitoring von `pb_data` (größerer Hebel als Saison-Auslagern)
- [ ] Optional: Grafana/Postgres-Export aus dem Saison-Bundle für freie Auswertung
- [ ] Eigenständige Turnier-App `dartshub-turniere` (gemeinsames Auth-Fundament — 2FA dort mitnutzen)

---

## Definition of Done für 1.0

1. Abschnitt **1 (Sicherheit & Go-live)** vollständig — Code-Punkte erledigt, Betreiber-Checkliste abgehakt.
2. **2FA** umgesetzt **oder** bewusst auf nach-1.0 verschoben (dokumentierte Entscheidung).
3. **Datenmodell-Härtung** §3: mindestens Match↔Player-per-ID und referenzielle Integrität erledigt.
4. Keine hartkodierten Demo-Daten mehr in produktiv sichtbaren Ansichten.
