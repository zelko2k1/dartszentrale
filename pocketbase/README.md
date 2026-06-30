# PocketBase-Skripte — Übersicht

Welche Skripte sind für den **Produktivbetrieb** gedacht und welche **nur zum Testen/Demonstrieren**.
Jedes Skript trägt dieselbe Markierung auch im Kopf (`[ PRODUKTIV / OPS ]` / `[ NUR TEST / DEMO ]`).

> **Sicherheitsnetz:** Alle konto-/passwortrelevanten Skripte rufen `_security-guard.mjs` auf und
> **brechen ab**, wenn ein bekanntes Default-Passwort gegen ein **nicht-lokales** Ziel (≠ localhost)
> liefe. Lokale Entwicklung bleibt unverändert bequem.

---

## 🟢 Produktiv / Ops — im echten Betrieb sinnvoll

| Skript | Zweck |
|---|---|
| `provision.mjs` | Schema anlegen/aktualisieren (idempotent, merge-sicher) + ersten App-Admin. Setup-Werkzeug. |
| `add-board-account.mjs` | Rechtearmes **Board-Konto** (Rolle `board`) für die Kiosk-Rechner anlegen. |
| `reset-password.mjs` | **Rettungsanker:** Passwort eines App-Kontos per Superuser zurücksetzen + Konto reaktivieren. |
| `season-export.mjs` | Saison als JSON-Bundle **wegsichern** (Backup / Re-Import-Grundlage). |
| `season-import.mjs` | Saison-Bundle **zurückspielen** (idempotent). |
| `season-offload.mjs` | Archivierte Saison **auslagern** (Matches löschen, Platz freigeben) — Export vorher Pflicht! |

**Produktiv immer mit eigenem Ziel + starkem Passwort**, z. B.:
```bash
PB_URL=https://db.deinverein.de PB_SU_EMAIL=… PB_SU_PASS='<stark>' node provision.mjs
```

## 🧪 Nur Test / Demo — NICHT gegen die Produktiv-DB

| Skript | Zweck |
|---|---|
| `demo-seed-dsv-fuerth.mjs` | Frische Demo-DB „DSV Fürth 86" (20 Mitglieder, 2 Mannschaften, 2 Ligen, Spielplan). Legt **keinen** Admin an. |

Diese legen Konten mit dem **öffentlichen Default-Passwort** an und sind ausschließlich für lokale
Entwicklung/Demos. Der Guard verhindert sie gegen Nicht-localhost-Ziele.

## 🔒 Interner Helfer (nicht direkt ausführen)

| Datei | Zweck |
|---|---|
| `_security-guard.mjs` | Wird von den Skripten **importiert**: bricht bei Default-Passwörtern gegen nicht-lokale Ziele ab. |

## (lokal, gitignored)

| Datei | Zweck |
|---|---|
| `seed-remote.sh` | Bequemer Wrapper, um ein Demo-Seed gegen eine entfernte PB zu fahren. Enthält Zugangsdaten → **nie committen**, Passwort per Env/Prompt statt Literal. |

---

Mehr zum lokalen Betrieb: `../docs/lokaler-betrieb.md` · Deploy: `../docs/COOLIFY-SETUP.md` ·
Sicherheit: `../docs/security-audit.md`.
