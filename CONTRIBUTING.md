# Mitmachen bei DartsZentrale

Schön, dass du helfen willst! DartsZentrale wird von einem Vereins-Admin (kein
ausgebildeter Entwickler) mit KI-Unterstützung gepflegt — **Hinweise, Fehlermeldungen,
Doku-Verbesserungen und Code-Reviews sind darum ausdrücklich willkommen** und genauso
wertvoll wie Code.

Bitte hab etwas Geduld: Das Projekt wird nebenbei von einer Einzelperson betreut.

## Du musst nicht programmieren können

Auch ohne eine Zeile Code hilfst du weiter:

- **Fehler melden** — etwas funktioniert nicht wie erwartet? → [Neues Issue](../../issues/new/choose)
- **Idee oder Wunsch** — dir fehlt eine Funktion? → ebenfalls über [Issues](../../issues/new/choose)
- **Doku verbessern** — Anleitung unklar oder veraltet? Kleine Korrekturen gehen direkt als Pull Request.
- **Im echten Betrieb testen** und berichten, was im Vereinsalltag hakt.

> **Sicherheitslücken bitte nicht über öffentliche Issues melden**, sondern vertraulich —
> siehe [SECURITY.md](SECURITY.md).

## Fehler melden — was hilft mir

Damit ich ein Problem nachstellen kann:

- **Betriebsmodus**: lokal (ein Board) / Verein-LAN / Cloud
- **Version** (steht im README-Kopf bzw. auf der [Releases-Seite](../../releases))
- **Was passiert**, was hättest du **erwartet**, und die **Schritte** dorthin
- Wenn möglich ein Screenshot — aber **keine echten Mitgliederdaten** mitschicken

## Code beitragen

### Entwicklungsumgebung

Voraussetzungen: **Node.js** (v20+; getestet mit v24) und **git**. Die Web-App liegt im
Ordner [`app/`](app/):

```bash
cd app
npm install
npm run dev      # Dev-Server auf http://localhost:5173
```

Technische Details zum Frontend stehen in [`app/README.md`](app/README.md), das
Vereins-Backend (PocketBase) in [`pocketbase/`](pocketbase/).

### Vor dem Pull Request

- `npm run lint` läuft ohne Fehler
- `npm run build` läuft durch (`tsc -b && vite build`)
- Änderung im Browser getestet (welcher Betriebsmodus betroffen ist)

### Ablauf

1. Vom Branch `main` einen eigenen Branch abzweigen.
2. **Kleine, fokussierte** Änderungen — ein Thema pro Pull Request lässt sich leichter prüfen.
3. Im Stil des umgebenden Codes bleiben (Inline-Styles + CSS-Variablen, kein neues UI-Framework;
   Kommentare und Doku auf Deutsch).
4. Pull Request öffnen und **was** und **warum** kurz beschreiben; bei UI-Änderungen ein Screenshot.

### Commit-Nachrichten

Das Projekt nutzt **Conventional Commits mit deutschem Text**. Muster: `typ(bereich): beschreibung`.

```
feat(kalender): Serientermine anlegen
fix(import): Saison aus CSV erkennen statt aktive Saison
docs(readme): Download-Block ergänzt
chore(gitignore): Build-Artefakte ignorieren
```

Gängige Typen: `feat`, `fix`, `docs`, `refactor`, `chore`, `ui`.

## Sprache

Projektsprache ist **Deutsch** (Code-Kommentare, Doku, Oberfläche). Issues und Pull
Requests darfst du auf Deutsch oder Englisch schreiben.

## Lizenz

Mit einem Beitrag stimmst du zu, dass er unter der [MIT-Lizenz](LICENSE) des Projekts
veröffentlicht wird.
