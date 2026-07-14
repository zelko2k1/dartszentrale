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
| `reset-2fa.mjs` | **Notnagel:** 2-Faktor (TOTP) eines App-Kontos entfernen — bei verlorenem Authenticator *und* Backup-Codes. |
| `season-export.mjs` | Saison als JSON-Bundle **wegsichern** (Backup / Re-Import-Grundlage). |
| `season-import.mjs` | Saison-Bundle **zurückspielen** (idempotent). |
| `season-offload.mjs` | Archivierte Saison **auslagern** (Matches löschen, Platz freigeben) — Export vorher Pflicht! |

**Produktiv immer mit eigenem Ziel + starkem Passwort**, z. B.:
```bash
PB_URL=https://db.deinverein.de PB_SU_EMAIL=… PB_SU_PASS='<stark>' node provision.mjs
```

> **Docker-/Arcane-Betrieb:** Dort wird das Schema **automatisch aus `pb_migrations/`** angewendet
> (fest ins Image gebacken) — `provision.mjs` ist dann **nicht nötig**; es ist der Weg für den
> **Cloud-/LAN-Betrieb ohne Container**. Details: [`../docs/arcane-homelab-anleitung.md`](../docs/arcane-homelab-anleitung.md).

## 🧪 Nur Test / Demo — NICHT gegen die Produktiv-DB

| Skript | Zweck |
|---|---|
| `demo-seed.mjs` | Frische Demo-DB „Dartverein Demo" (20 Mitglieder, 2 Mannschaften, 2 Ligen, Spielplan). Legt **keinen** Admin an. |

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

Mehr zum lokalen Betrieb: `../docs/lokaler-betrieb.md` · Deploy: `../docs/arcane-homelab-anleitung.md`
(Homelab) bzw. `../docs/admin-anleitung-cloud.md` (Cloud) · Sicherheit: `../docs/security-audit.md`.
