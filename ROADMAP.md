# Roadmap

> Stand: **2026-07-14**. Version **1.0.0** ist veröffentlicht
> ([Releases](https://github.com/zelko2k1/dartszentrale/releases/latest)).
> Diese Datei sammelt nur noch die **offenen** Punkte danach — Erledigtes ist entfernt,
> der Änderungsverlauf steht in [`CHANGELOG.md`](CHANGELOG.md). Details/Begründungen stehen in den
> verlinkten Dokumenten ([`docs/security-audit.md`](docs/security-audit.md), [`DATA_MODEL.md`](DATA_MODEL.md)).

**Legende:** `[ ]` offen · `[~]` teilweise · 🧑‍💻 = Code-Arbeit · ⚙️ = Betreiber-/Deploy-Aufgabe (manuell)

---

## 1. Sicherer Betrieb (pro Installation, ⚙️)

> Die **Code-Härtung ist erledigt** (Details: [`docs/security-audit.md`](docs/security-audit.md)).
> Offen bleiben nur die Schritte, die **jeder Betreiber selbst** beim Internet-Betrieb macht —
> abhakbar in [`docs/go-live-checkliste-cloud.md`](docs/go-live-checkliste-cloud.md):

- [ ] ⚙️ #1 PB-Superuser-Passwort rotiert, Literal aus `seed-remote.sh` entfernt
- [ ] ⚙️ #2 Produktiv-Admin manuell mit starkem Passwort; keine Seeds gegen Prod
- [ ] ⚙️ #3 PB nicht als Klartext-HTTP im Internet (loopback + Firewall, oder bewusst nur LAN)
- [ ] ⚙️ #5 PB-Admin-Konsole `/_/` abgeschirmt (Caddy IP-Allowlist/basic_auth bzw. Firewall/VPN), Superuser-MFA + Rate-Limit
- [ ] ⚙️ #9 CSP in `nginx.conf` auf echte PB-Domain angepasst, einkommentiert, getestet
- [ ] ⚙️ HTTPS erzwungen (Proxy/Cloudflare), HSTS aktiv
- [ ] ⚙️ Starke, einzigartige Passwörter für alle Konten

---

## 2. Datenmodell & Integrität (🧑‍💻)

Aus [`DATA_MODEL.md §5`](DATA_MODEL.md):

- [ ] **Referenzielle Integrität** beim Löschen eines Spielers definieren (Kapitän / im Kader / mit Account verknüpft)
- [ ] **Liga-Team ↔ Vereins-Team:** `own`-Team einer Liga auf ein echtes `Team` zeigen lassen (statt Freitext)
- [ ] **Ergebnis ↔ Counter:** Ligaspiel über den Darts Counter spielen, Ergebnis automatisch in die `Fixture`
- [ ] **Tabellen-/Punktregeln** bestätigen (aktuell 2/1/0; reale Ligaregeln können abweichen)
- [ ] **Einladungs-Flow per E-Mail** (bisher nur angedeutet)

---

## 3. Später / optional (nach 1.0)

- [ ] 🧑‍💻 **Autodarts-Integration (optional, opt-in)** — autodarts ist **hybrid**: Erkennung
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
- [ ] 🧑‍💻 **2FA für Admins erzwingbar machen** (Policy-Schalter) — 2FA/TOTP selbst ist bereits umgesetzt.
- [ ] 🧑‍💻 **#12 Kaderliste einschränken (auf Wunsch)** — aktuell ist der Kader für jeden eingeloggten Nutzer lesbar (E-Mails bleiben geschützt); als Vereins-Verzeichnis vertretbar. **Entscheidung 2026-07-05: keine Einschränkung nötig.** Nur umsetzen, **falls ein Verein es wünscht** (z. B. wegen Minderjähriger). Rationale: [`docs/security-audit.md`](docs/security-audit.md) #12.
- [ ] Mobile-Layout für die Verwaltung (der Counter ist bereits tablettauglich)
- [ ] Backup-Retention + Größen-Monitoring von `pb_data` (größerer Hebel als Saison-Auslagern)
- [ ] Optional: Grafana/Postgres-Export aus dem Saison-Bundle für freie Auswertung
