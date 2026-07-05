# Roadmap → Version 1.0

> Stand: **2026-07-03**. Zentrale Sammelstelle für alle offenen Punkte bis zum 1.0-Release.
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
- [x] 🧑‍💻 **#6-Rest:** Kapitän-Roster-Editing auf die *eigene* Mannschaft gescoped (`captainId == auth.playerId`)
      — Migration `1782600100_scope_team_update_to_captain` + provision; gegen lokale PB verifiziert.
- [x] 🧑‍💻 #11 `reset-password.mjs`: `NEW_PW` ist Pflicht (kein stiller Default `dartszentrale123` mehr) — Fehlerpfade getestet.
- [ ] 🧑‍💻 #12 (abwägen) Kader-Lesbarkeit für eingeloggte Nutzer — bei Minderjährigen einschränken

**Offen — Betreiber / Pre-Go-live-Checkliste** (⚙️ nicht von Claude erledigbar, nur vorbereitbar):
- [ ] ⚙️ #1 PB-Superuser-Passwort rotiert, Literal aus `seed-remote.sh` entfernt
- [ ] ⚙️ #2 Produktiv-Admin manuell mit starkem Passwort; keine Seeds gegen Prod
- [ ] ⚙️ #3 PB nicht als Klartext-HTTP im Internet (loopback + Firewall, oder bewusst nur LAN)
- [ ] ⚙️ #5 PB-Admin-Konsole `/_/` abgeschirmt (Caddy IP-Allowlist/basic_auth bzw. Firewall/VPN), Superuser-MFA + Rate-Limit (CORS setzt die Cloud bereits per `--origins`)
- [ ] ⚙️ #9 CSP in `nginx.conf` auf echte PB-Domain angepasst, einkommentiert, getestet
- [ ] ⚙️ HTTPS erzwungen (Proxy/Cloudflare), HSTS aktiv
- [ ] ⚙️ Starke, einzigartige Passwörter für alle Konten

---

## 2. Features für 1.0

- [x] 🧑‍💻 **2FA / TOTP** (optional, opt-in) — **KOMPLETT umgesetzt** (Phasen A+B+C, 2026-07-05).
      Plan: [`docs/plan-2fa.md`](docs/plan-2fa.md) · Spike: [`spikes/2fa/ERGEBNIS.md`](spikes/2fa/ERGEBNIS.md).
      **A:** PB-JSVM hat **kein** HMAC-SHA1 → geprüfte Pure-JS-Routine (`spikes/2fa/totp.js`), im goja-JSVM gegen alle RFC-6238-Vektoren verifiziert.
      **B:** abgeschottete Collection `user_mfa` (Migration + provision.mjs) · Hooks `setup`/`enable`/`disable`/`backup/regenerate`/`status` + zentraler **`/api/login`**-Challenge (TOTP+Backup-Codes, Lockout 5/5min) in `pb_hooks/2fa_hooks.pb.js` · Rettungsskript `reset-2fa.mjs` — E2E getestet.
      **C:** Login auf `/api/login` umgestellt (2FA greift jetzt wirklich); Settings-Assistent unter *Mein Konto* mit QR (eigener Pure-JS-Encoder `app/src/lib/qrcode.ts`), Bestätigung, Backup-Codes, Deaktivieren, Neu-Erzeugen — E2E im echten Browser (Playwright) 9/9 verifiziert.
      **Offen (optional, später):** 2FA für Admins erzwingbar machen (Policy-Schalter); Turnier-App erbt es über den Fork (Phase E).
- [x] 🧑‍💻 **Saison-Lebenszyklus** (Abschluss · Neubeginn · Soft-Archiv · Auslagern) — Phasen 1–4 umgesetzt
      ([`docs/plan-saison.md`](docs/plan-saison.md)).

---

## 3. Datenmodell-Härtung (für robuste Statistik & Integrität)

Aus [`DATA_MODEL.md §5`](DATA_MODEL.md). Manche Punkte sind evtl. schon erledigt → vor Umsetzung prüfen.

- [?] 🧑‍💻 Echtes Login + Passwort-Reset — laut DATA_MODEL-Kopf bereits umgesetzt → nur verifizieren
- [ ] 🧑‍💻 **Einladungs-Flow per E-Mail** (im Prototyp nur angedeutet)
- [x] 🧑‍💻 **Match ↔ Player per ID statt Name** — Aggregation läuft über `playerId`/`winnerId` (Fallback Name), `saveMatch` stempelt beide (Commit `f93b0a5`).
- [ ] 🧑‍💻 **Referenzielle Integrität** beim Löschen eines Spielers (Kapitän / im Kader / mit Account verknüpft) definieren
- [ ] 🧑‍💻 **Liga-Team ↔ Vereins-Team:** `own`-Team einer Liga auf echtes `Team` zeigen lassen (statt Freitext)
- [ ] 🧑‍💻 **Ergebnis ↔ Counter:** Ligaspiel über den Darts Counter spielen, Ergebnis automatisch in die `Fixture`
- [ ] 🧑‍💻 **Tabellen-/Punktregeln** bestätigen (aktuell 2/1/0; reale Ligaregeln können abweichen)
- [x] 🧑‍💻 **Statistik aus echten Daten** (60+/100+/140+/180, Form-Verlauf) — war bereits real; jetzt robust (playerId), vollständig (Checkout-%/First-9) und tief (Verlauf/Rekorde/Saison-Filter/CSV) — Commits `f93b0a5`, `30fd1aa` ([`DATA_MODEL.md §7`](DATA_MODEL.md))

---

## 4. Offen / später (nach 1.0 oder optional)

- [ ] 🧑‍💻 **Autodarts-Integration (optional, opt-in, nach 1.0)** — autodarts ist **hybrid**: Erkennung
      läuft lokal auf dem autodarts-PC, Plattform/Spiel über die Cloud (`autodarts.io`). Wir **konsumieren
      nur** die Wurf-/**Takeout**-Events und tragen im **Board-/Kiosk-Modus** die Aufnahme automatisch ein
      (Würfe sammeln bis Takeout → 3-Dart-Score); Tastatur bleibt Override. **Killer-Feature (nur wir, nicht
      autodarts.io): Ergebnis fließt automatisch in den Ligaspielbericht/Fixture.** Ansatz: **Cloud-API
      (`autodarts.io`, wss+Token) zuerst** — passt zum cloud-basierten Betrieb und kein Mixed-Content-Problem;
      **lokale Board-API optional** (offline, falls die autodarts-Version sie exponiert). Community-Browser-
      Extension (Autodarts Tools) nur als Notlösung. **Spike-first:** Events erst per Browser-DevTools
      (Network→WS) beobachten, dann Node-Logger (`spikes/autodarts/`) → MVP (~2–3 Tage). **Testhardware
      vorhanden** (Betreiber spielt selbst autodarts). ⚠ Nutzen nur für autodarts-Vereine; die API ist
      community-dokumentiert und ändert sich mit autodarts-Versionen → **laufender Wartungsaufwand**. Als
      „drittes Scoreboard" lohnt es nicht — nur wegen der Liga-Ergebnis-Kopplung.
- [ ] Mobile-Layout für die Verwaltung (Counter ist bereits tablettauglich)
- [ ] Backup-Retention + Größen-Monitoring von `pb_data` (größerer Hebel als Saison-Auslagern)
- [ ] Optional: Grafana/Postgres-Export aus dem Saison-Bundle für freie Auswertung
- [ ] Eigenständige Turnier-App `dartszentrale-turniere` (gemeinsames Auth-Fundament — 2FA dort mitnutzen)

---

## Definition of Done für 1.0

1. Abschnitt **1 (Sicherheit & Go-live)** vollständig — Code-Punkte erledigt, Betreiber-Checkliste abgehakt.
2. **2FA** umgesetzt **oder** bewusst auf nach-1.0 verschoben (dokumentierte Entscheidung).
3. **Datenmodell-Härtung** §3: mindestens Match↔Player-per-ID und referenzielle Integrität erledigt.
4. Keine hartkodierten Demo-Daten mehr in produktiv sichtbaren Ansichten.
