---
name: DartsZentrale
description: Vereinsverwaltung und Darts-Counter fuer den Spielbetrieb im Vereinsheim — lesbar vom Board aus, bedienbar mit dem Daumen.
colors:
  accent-default: "#2BD377"
  leistungsgold: "#F2B829"
  gold-ink: "#1a1206"
  gold-text-light: "#7e5300"
  canvas: "#0d0f12"
  canvas-sidebar: "#0a0c0e"
  canvas-counter: "#0c0e11"
  surface: "#14181c"
  surface-2: "#13171c"
  surface-3: "#161b20"
  control: "#1a2026"
  hairline: "#1c2229"
  border: "#232a31"
  border-2: "#2a333c"
  border-strong: "#3a434d"
  text: "#ECEAE3"
  text-2: "#aeb4bd"
  text-3: "#a0a6af"
  text-4: "#9198a2"
  text-5: "#838a93"
  success: "#7fd7a6"
  danger: "#f36a5a"
  danger-soft: "#c98b86"
  warn: "#f19d4c"
  info: "#4c9dff"
  win-good: "#2BD377"
  cat-1: "#4c9dff"
  cat-2: "#f07a3d"
  cat-3: "#2bd3c0"
  cat-4: "#F2B829"
  cat-5: "#e87ba4"
  cat-6: "#2bd377"
  cat-7: "#b48aff"
  cat-8: "#f36a5a"
typography:
  badge:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.05em"
  meta:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
  sub:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
  lead:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 700
  title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
  heading:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 800
  page:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "27px"
    fontWeight: 800
    letterSpacing: "-0.02em"
  stat:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 800
    lineHeight: 1
  hero:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "38px"
    fontWeight: 800
  score:
    fontFamily: "JetBrains Mono, SFMono-Regular, Consolas, ui-monospace, monospace"
    fontSize: "38px"
    fontWeight: 800
rounded:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  pill: "999px"
components:
  button-primary:
    backgroundColor: "{colors.accent-default}"
    textColor: "#0d0f12"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "11px 18px"
  button-primary-disabled:
    backgroundColor: "{colors.control}"
    textColor: "{colors.text-5}"
    rounded: "{rounded.md}"
    padding: "11px 18px"
  button-secondary:
    backgroundColor: "{colors.control}"
    textColor: "{colors.text-2}"
    typography: "{typography.sub}"
    rounded: "{rounded.md}"
    padding: "9px 14px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-2}"
    typography: "{typography.sub}"
    rounded: "{rounded.md}"
    padding: "9px 14px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
  stat-tile:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.stat}"
    rounded: "{rounded.lg}"
    padding: "18px 20px"
  input:
    backgroundColor: "{colors.control}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "12px 14px"
---

# Design System: DartsZentrale

## Overview

**Creative North Star: "Die Anzeigetafel"**

Das System ist eine lesbare Tafel, kein Interface-Kunstwerk. Der harte Fall ist nicht der Laptop des Admins, sondern der Board-PC im Vereinsheim: eine Person steht 2,37 Meter entfernt an der Abwurflinie, hat drei Darts in der Hand und muss den Restscore erfassen, ohne die Augen zusammenzukneifen. Alles Weitere folgt daraus. 11 px ist der Boden der Typo-Leiter, weil die App vorher an 44 Stellen mit 9 px und 10 px arbeitete und aus Wurfentfernung unlesbar war. Ziffern laufen tabellarisch, damit ein Score beim Herunterzaehlen nicht seitlich wandert.

Kontrast wird in diesem System **gerechnet, nicht geschaetzt**. Die fuenfstufige Textleiter haelt in jedem der sechs Themes mindestens 4,5:1 gegen **jede** Flaeche des Themes — geprueft von `scripts/validate-palette.mjs`, das zusaetzlich die kategoriale Skala auf Unterscheidbarkeit bei Deuteranopie, Protanopie und Tritanopie prueft und verlangt, dass die Textleiter monoton laeuft. Ein Skin, das die Grenze reisst, faellt in der CI durch. Das ist der Grund, warum es hier keine handverlesenen Hex-Werte in Komponenten geben darf: Was an den Tokens vorbeigeht, wird nie geprueft.

Die Oberflaeche dient dem Spiel und stellt sich nicht daneben. Farbe ist sparsam und bedeutet etwas: Der Akzent markiert die eine primaere Handlung eines Bildschirms, Leistungsgold erscheint nur, wo etwas geleistet wurde. Der Rest ist ruhige tonale Schichtung in Graustufen mit warmem Weiss. Bewegung bestaetigt eine Handlung und verschwindet wieder — es gibt keine Eingangsanimationen fuer Inhalte, weil diese App stundenlang offen steht.

**Key Characteristics:**
- Lesbarkeit aus Wurfentfernung ist die Grundbedingung, nicht ein Feature
- Kontrast ist maschinell garantiert, in sechs Themes und bei Farbfehlsichtigkeit
- Sechs Themes teilen eine Struktur: nur Werte wechseln, nie das Layout
- Der Akzent ist eine austauschbare Rolle, kein Markenton
- Tiefe entsteht tonal; Schatten ist die begruendete Ausnahme
- Bewegung quittiert, sie inszeniert nicht

## Colors

Eine ruhige, fast neutrale Grundflaeche, auf der wenige gesaettigte Toene etwas bedeuten. Die Basis ist dunkel (`:root` = Dunkelmodus); der Hellmodus ist warmes Papier, kein kaltes Weiss.

### Primary

- **Akzent** (Rolle, kein fester Wert; Standard Signalgruen `#2BD377`): Markiert die **eine** primaere Handlung eines Bildschirms — Spiel starten, Speichern, Anlegen. Der Verein waehlt ihn selbst, getrennt je Modus; die vier Skins bringen eigene mit (Cyan, Teal, Salbei, Navy-Ink). Deshalb steht in dieser Datei kein Primaerton als Wahrheit, sondern eine Rechenregel.

**Der Akzent-Ableitungs-Grundsatz.** Der rohe Akzent wird nie direkt als Schrift, Fokusring oder Kontur verwendet. Vier Funktionen leiten lesbare Begleiter ab: `accentFg()` waehlt die Schrift **auf** der Akzentflaeche als den kontraststaerkeren von zwei Inks; `accentText()` liefert den Akzent **als** Schrift auf normaler Flaeche; `accentRing()` haelt den Fokusring bei mindestens 3,2:1 und verschiebt dafuer nur die OKLCH-Helligkeit, nicht den Farbton; `accentEdge()` liefert die Kontur fuer den Extremfall. Im Hellmodus schaffen 8 von 10 Presets ungefiltert keine 3:1 gegen die Flaeche — ohne diese Ableitungen waere der Fokus dort unsichtbar.

### Secondary

- **Leistungsgold** (`#F2B829`): Erscheint ausschliesslich, wo etwas geleistet wurde — 180er, High Finish, Checkout-Vorschlag, Kapitaens-Badge, Rang 1, Formbalken. Es hat **zwei getrennte Rollen**, die nicht vermischt werden duerfen: als Flaeche (mit `gold-ink` `#1a1206` darauf) und als Schrift auf normaler Flaeche. Als Schrift wird es im Hellmodus auf `#7e5300` abgedunkelt, weil `#F2B829` dort bei 1,48–1,80:1 lag.

**Der Seltenheits-Grundsatz.** Leistungsgold ist kein Dekor und keine Hervorhebung. Wer es fuer eine Ueberschrift oder einen Rahmen benutzt, entwertet es fuer den 180er.

### Tertiary

- **Kategoriale Skala** (`cat-1` bis `cat-8`): Acht unterscheidbare Farbtoene fuer Identitaet in Statistiken, Trainingsmodi, Termintypen und Rollen. Die Reihenfolge ist nach Sicherheit bei Farbfehlsichtigkeit sortiert: Wer nur drei Kategorien braucht, nimmt 1–3 und ist auf der sicheren Seite. Im Hellmodus ist die Skala eigens abgedunkelt, weil sie inzwischen auch Text traegt und nicht nur Diagrammmarken.

### Neutral

- **Leinwand** (`#0d0f12`) und **Seitenleiste** (`#0a0c0e`): Der Grund, auf dem alles liegt. Die Seitenleiste ist die dunkelste Flaeche des Systems und damit der harte Fall fuer die Textleiter.
- **Counter-Leinwand** (`#0c0e11`): Eigene Flaeche fuer die Spiel- und Kioskbildschirme (Counter, Zuschauer-TV, Fernbedienung).
- **Flaechen** (`surface` `#14181c`, `surface-2` `#13171c`, `surface-3` `#161b20`): Drei Stufen fuer geschichtete Panels.
- **Bedienflaeche** (`#1a2026`): Grund von Buttons, Eingaben und Kacheln — die Stufe, die „anfassbar" signalisiert.
- **Raender** (`hairline` `#1c2229`, `border` `#232a31`, `border-2` `#2a333c`, `border-strong` `#3a434d`): Vier Staerken. `hairline` trennt Zeilen innerhalb einer Flaeche, `border` umfasst Karten, `border-2` Bedienelemente, `border-strong` markiert Hover und Fokus.
- **Textleiter** (`text` `#ECEAE3` bis `text-5` `#838a93`): Fuenf Stufen, gleichmaessig in OKLCH-Helligkeit verteilt. Das Primaerweiss ist bewusst warm getoent, kein reines `#fff`.

### Semantik

- **Erfolg** (`#7fd7a6`), **Gefahr** (`#f36a5a`), **Gefahr gedaempft** (`#c98b86`), **Warnung** (`#f19d4c`), **Info** (`#4c9dff`): Je Theme eigens auf AA nachgezogen. Die Warnung ist bewusst nach Orange gedreht, weil sie als `#e0a83a` nur 4 Grad vom Gold entfernt lag und im Hellmodus sogar bytegleich mit `gold-text` war.

**Der Token-Grundsatz.** Farbe kommt aus einem Token, immer. Die einzigen erlaubten Literale sind Abbilder physischer Dinge (das Bull einer Dartscheibe ist aussen rot und innen gruen, in jedem Lichtmodus) und Werte, die durch echte Farbrechnung laufen muessen, weil eine JS-Funktion `var(--…)` nicht aufloesen kann. Beide Faelle tragen eine Begruendung im Code.

## Typography

**Anzeige- und Fliesstext:** Archivo (Fallback `system-ui`, `sans-serif`). Vier weitere Familien sind waehlbar (Inter, Rubik, Oswald, Space Grotesk); ein Skin kann die Wahl erzwingen.
**Ziffern in Kennzahlen:** folgt der gewaehlten Schrift (`--font-num`), damit Zahlen und Text zusammenpassen.
**Spiel-Scores:** JetBrains Mono (`--font-score`) — die grossen Restscores bleiben monospace, damit dreistellige Zahlen beim Herunterzaehlen nicht springen.

**Charakter:** Sachlich, breitlaufend, ohne Zierde. Archivo traegt fette Gewichte ohne zuzulaufen, was bei 11 px und bei 38 px gleichermassen zaehlt.

### Hierarchy

Die Leiter benennt **Rollen, nicht Groessen**. Wer eine Kartenueberschrift setzt, greift zu `lead` und muss nicht wissen, dass 16 px daran haengen.

- **Page** (800, 27 px, Tracking -0.02em): Seitentitel, ein `h1` je Bildschirm.
- **Heading** (800, 22 px): Hervorgehobene Ueberschrift in Login und Overlays.
- **Title** (700, 18 px): Dialog- und Paneltitel.
- **Lead** (700, 16 px): Betonter Text, Karten- und Paneluberschrift.
- **Body** (400, 14 px): Fliesstext, Bedienelemente, Zeilenlabel.
- **Sub** (600, 13 px): Sekundaertext, Unterzeile.
- **Meta** (600, 12 px): Sektionsueberschrift, Metadaten.
- **Badge** (700, 11 px, Tracking 0.05em, versal): Badge, Chip, Mikrolabel — zugleich die Lesbarkeitsgrenze.
- **Stat** (800, 30 px, Zeilenhoehe 1), **Display** (800, 34 px), **Hero** (800, 38 px): Grosse Zahlen und Momente, deutlich ueber der Textleiter.

**Der Elf-Pixel-Grundsatz.** 11 px ist der Boden. Es gibt keinen Text darunter, auch nicht fuer Fussnoten, auch nicht „nur dieses eine Mal".

**Der Rollen-Grundsatz.** Neue Groessen werden nicht erfunden. Zwischen 17 und 28 px lagen einmal elf verschiedene Werte fuer drei Aufgaben; daraus wurden `title` / `heading` / `page`. Wer eine Zwischengroesse braucht, braucht in Wahrheit eine der bestehenden Rollen.

Ausserhalb der Leiter stehen bewusst die **mitskalierenden** Groessen: der Restscore am Board, der Board-Zoom und die `clamp()`-Overlays haengen an Nutzereinstellung und Viewport.

## Layout

Die App ist eine Arbeitsflaeche mit fester Hoehe (`100vh`, kein Seitenscroll auf der Huelle): Seitenleiste plus Inhaltsbereich, der Inhalt scrollt in sich. Inhaltsbildschirme laufen zentriert mit `maxWidth` 1100 px (Einstellungen 920 px) und `28px 32px` Innenabstand, am Handy `18px 16px`.

**Es gibt keine breitenbasierten Media Queries — und das ist Absicht.** Die Oberflaeche ist fast durchgehend inline gestylt, dort sind Media Queries unmoeglich. Anpassung laeuft stattdessen in JS ueber `useDevice()`: eine einzige, auf einen Frame gedrosselte Viewport-Quelle, die per `useSyncExternalStore` an alle Abonnenten verteilt. Die Schwelle liegt bei 560 px kuerzerer Kante. Wer hier Media Queries sucht und keine findet, zieht den falschen Schluss.

Fluide Mittel tragen den Rest: `repeat(auto-fit, minmax(280px, 1fr))` fuer Kartenraster, `flexWrap` fuer Kopfzeilen und Chipreihen, `clamp()` fuer mitskalierende Groessen, und breite Tabellen scrollen horizontal im eigenen Container statt die Seite zu sprengen.

Ein Raster-Token fuer Abstaende gibt es **nicht**; Abstaende stehen als Zahlen an der Stelle, an der sie wirken. Wiederkehrend sind 6/8/10/12 innerhalb einer Gruppe, 14–20 zwischen Gruppen und 18–24 zwischen Sektionen.

**Der Grob-Zeiger-Grundsatz.** Unter `@media (pointer: coarse)` erbt **jedes** interaktive Element mindestens 44x44 px. Nicht als Klasse zum Anfordern — eine Garantie, die man erst anfordern muss, ist keine und waechst nicht mit. Bewusst dichte Flaechen tragen `.dh-dense` am Container, damit die Ausnahme im Layout sichtbar ist und nicht am einzelnen Knopf versteckt.

## Elevation & Depth

Tiefe entsteht **tonal**: Leinwand, drei Flaechenstufen, Bedienflaeche, dazu ein 1-px-Rand aus der vierstufigen Randleiter. Flaechen liegen flach; sie trennen sich durch Helligkeit und Kontur, nicht durch Schlagschatten. Das haelt die Oberflaeche bei stundenlangem Betrieb ruhig und funktioniert in allen sechs Themes ohne Nacharbeit.

### Shadow Vocabulary

- **Kartenschatten** (`--shadow-card`, dunkel `0 24px 60px rgba(0,0,0,.5)`, hell `0 20px 50px rgba(60,55,40,.18)`): Fuer Ebenen, die sich wirklich abheben — Dialoge und Overlays.
- **Scrim** (`--scrim`, dunkel `rgba(6,8,10,.72)`, hell `rgba(24,20,12,.5)`): Verdunkelt den Hintergrund unter modalen Ebenen.

**Der Ausnahme-Grundsatz.** Ein Schatten ist die begruendete Ausnahme, nicht die Standardtiefe einer Karte. Wer eine normale Karte abheben will, greift zur naechsten Flaechenstufe oder zum staerkeren Rand — nicht zu `--shadow-card`.

### Motion

Eine Dauer (0,15 s), eine Kurve (`--ease-out`, `cubic-bezier(.16, 1, .3, 1)`). Bewegung **bestaetigt eine Handlung und verschwindet** — es gibt keine Eingangsanimationen fuer Inhalte.

**Der Null-Layout-Grundsatz.** Es wird nichts animiert, was Layout ausloest: keine `width`, `height`, `padding`, `margin`. Bewegung laeuft ueber `transform` und `opacity`, Zustandswechsel ueber `background`, `border-color`, `box-shadow`.

Bei `prefers-reduced-motion: reduce` wird Bewegung **nicht abgeschaltet**, sondern verengt: Die `transition-property` faellt auf nicht-layoutende Eigenschaften zurueck und Animationen werden gegen einen kurzen Fade getauscht. Ein globaler `0.01ms`-Kill wuerde nuetzliches Feedback zerstoeren.

## Shapes

Weiche, aber nicht runde Formen: eine sechsstufige Radiusleiter von 6 px (`xs`, Mikroflaechen wie Badges und Icon-Knoepfe) ueber 8 px (`sm`), 12 px (`md`, Buttons und Eingaben), 16 px (`lg`, Karten und Panels), 20 px (`xl`) bis `pill` (999 px, Schalter und Chips).

Die Leiter ist **themeunabhaengig deklariert, aber ueberschreibbar**: Das Skin „Salbei" setzt alle Stufen ausser `pill` auf 0 und wird dadurch kantig, ohne dass eine Komponente davon weiss. Radius ist damit ein Theme-Merkmal, kein Komponenten-Merkmal.

Grenzen sind durchgehend 1 px. Es gibt keine dickeren Zierrahmen und keine farbigen Seitenkanten als Dekor.

## Components

**Charakter: nuechtern und griffig.** Klare Kanten, ruhige Flaechen, grosszuegige Trefferflaechen. Nichts glaenzt, alles ist anfassbar.

### Buttons

- **Shape:** Weich gerundet (`--radius-md`, 12 px).
- **Primaer:** Akzentflaeche mit gerechneter Schrift (`--accent-fg` aus `accentFg()`), `11px 18px`, Gewicht 800, Groesse `body` (14 px). Deaktiviert wechselt auf Bedienflaeche mit `text-5`. Hover hellt um 6 % auf, `:active` versetzt um 1 px nach unten.
- **Sekundaer:** Bedienflaeche, 1 px `border-2`, `text-2`, `9px 14px`, Gewicht 600, Groesse `sub` (13 px).
- **Ghost:** wie Sekundaer, aber transparenter Grund.
- **Fokus:** siehe Grundregel unten — nie ueber die Komponente geloest.

**Der Eine-Handlung-Grundsatz.** Pro Bildschirm traegt genau ein Button den Akzent. Zwei Primaerbuttons nebeneinander heisst, dass die Hierarchie nicht entschieden wurde.

### Cards / Containers

- **Corner Style:** `--radius-lg` (16 px).
- **Background:** `surface`; geschichtete Panels nutzen `surface-2` / `surface-3`.
- **Border:** 1 px `border`. Bei `hover` wechselt der Rand auf `border-strong` (`.dh-hover-border`, 0,18 s) — die Karte hebt sich **nicht**, sie schaerft nur ihre Kontur.
- **Shadow Strategy:** keiner (siehe Elevation & Depth).
- **Internal Padding:** 18–20 px.

### Inputs / Fields

- **Style:** Bedienflaeche, 1 px `border-2`, `--radius-md`, `12px 14px`, Groesse `body`.
- **Focus:** Der Rand wechselt auf `border-strong`, dazu ein 3-px-Ring aus `color-mix(in srgb, var(--focus-ring) 22%, transparent)`.
- **Placeholder:** kommt aus dem Sprachpaket, nie als Literal in der Komponente.

### Navigation

Seitenleiste auf der dunkelsten Flaeche des Systems, am Handy eingeklappt hinter einem Menuknopf. Der aktive Eintrag traegt `--nav-active` (Akzent bei 16 % gemischt) und `--nav-active-fg`, also einen lesbaren Ableger des Akzents — nicht den rohen Akzent.

### Signature: Text-Leiter auf Board-Distanz

Die eigentliche Signatur dieses Systems ist keine Komponente, sondern die Kombination aus fuenfstufiger Textleiter, maschinell geprueftem Kontrast und tabellarischen Ziffern. Sie ist der Grund, warum ein Restscore am Board aus 2,37 m ablesbar bleibt — und der Grund, warum jede neue Flaeche durch die Tokens gehen muss.

### Fokus (Grundregel, nicht abschaltbar)

Jedes interaktive Element zeigt bei Tastaturnavigation einen Ring: `outline: 2px solid var(--focus-ring)` mit 2 px Versatz, gesetzt ueber `:where(…):focus-visible` mit `!important`. `:where()` haelt die Spezifitaet bei 0 (leicht ueberschreibbar), das `!important` schlaegt das inline gesetzte `outline: none` der vielen inline gestylten Elemente. Nur `:focus-visible` — Mausklicks bleiben ringfrei.

### Tastaturbetrieb am Board (harte Anforderung, nicht verhandelbar)

**Jedes Spiel muss sich vollstaendig ohne Maus spielen lassen — von der Navigation bis zum Ende-Bildschirm.** Am Board steht keine Maus: gezaehlt wird auf einer Tastatur, im Stehen, aus zwei Metern Entfernung. Ein Spiel, das an genau einer Stelle einen Klick verlangt, ist dort unbenutzbar, und keine klickende Pruefung wird das je bemerken.

Die Kette, die halten muss: **Navigation → Modus waehlen → starten → Aufnahme eintragen → zuruecknehmen → beenden.** Reisst ein Glied, ist das Spiel am Board tot, auch wenn jedes andere gruen ist.

Die drei Muster, aus denen sich das zusammensetzt:

- **Feste Auswahl** (Treffer 0–3, Vorruecken, Runs): direkte Zifferntasten ueber `useTrainKeys`, im Panel sichtbar angeschrieben (`(Tasten 0–3)`). Der Griff zur Tastatur darf nicht geraten werden muessen.
- **Freie Punktzahl** (Halve It, Elimination): `autoFocus` auf dem Zahlenfeld, Enter traegt ein, und der Fokus **bleibt** danach im Feld. Ein Feld, das man erst anklicken muss, ist derselbe Fehler wie ein fehlendes Kuerzel.
- **Globale Aktionen**: Zuruecknehmen und Beenden liegen auf konfigurierbaren Kuerzeln (Vorgabe `Alt+U` / `Alt+X`) und gelten im ganzen Spiel, unabhaengig vom Fokus.

Massgeblich ist die **Aktion**, nicht die Flaeche: jede Aktion braucht genau einen Tabstopp mit echter Button-Semantik (`PressableRow`, sonst `role="button"` + `tabIndex` + `onKeyDown`). Eine grosszuegige Klickflaeche darum herum darf ein schlichtes `<div onClick>` bleiben — so machen es die Kacheln der Trainingsuebersicht, deren Tabstopp am Modusnamen sitzt. Ein zweiter Tabstopp fuer dieselbe Aktion waere kein Gewinn, sondern ein Umweg. Falsch ist nur das eine: eine Aktion, die **ausschliesslich** an einem `<div onClick>` haengt — anklickbar, per Tastatur unerreichbar, optisch nicht zu unterscheiden.

Abgesichert ist das durch `app/e2e/keyboard.spec.ts`: die Pruefung ruehrt die Maus nicht an (kein `click()`, kein `fill()`) und tabbt sich durch die ganze Kette. Wer ein Spiel ergaenzt, ergaenzt dort einen Fall — sonst ist die Anforderung nur eine Absichtserklaerung.

## Do's and Don'ts

### Do:

- **Do** jede Farbe aus einem Token nehmen. Wer eine Farbe braucht, die es nicht gibt, braucht eine Entscheidung im Token-System, keinen Hex-Wert in der Komponente.
- **Do** die Typo-Leiter nach **Rolle** waehlen (`lead` fuer eine Kartenueberschrift), nicht nach Pixelwert.
- **Do** Tiefe tonal aufbauen: naechste Flaechenstufe oder staerkerer Rand.
- **Do** neue Bildschirme mit `useDevice()` anpassen — das ist der Mechanismus dieser Codebasis, nicht Media Queries.
- **Do** sichtbaren Text und Platzhalter ins Sprachpaket legen. `validate-i18n.mjs` behandelt jedes String-Literal in `placeholder`, `alt`, `aria-label` und `title` als Fund, sofern es nicht strukturell sprachneutral ist (Zahl, Datum, URL).
- **Do** `node scripts/validate-palette.mjs` laufen lassen, wenn eine Flaeche oder ein Theme dazukommt. Neue Flaechen gehoeren in `SURFACES`, sonst prueft sie niemand.

### Don't:

- **Don't** Leistungsgold dekorativ verwenden. Es markiert Leistung — 180er, High Finish, Rang 1 — und verliert seine Bedeutung, sobald es eine Ueberschrift einfaerbt.
- **Don't** den rohen Akzent als Schrift, Fokusring oder Kontur setzen. Dafuer gibt es `accentText()`, `accentRing()` und `accentEdge()`; im Hellmodus scheitern 8 von 10 Presets ungefiltert.
- **Don't** Layout-Eigenschaften animieren (`width`, `height`, `padding`, `margin`). `transform` und `opacity` tragen die Bewegung.
- **Don't** `prefers-reduced-motion` mit einem globalen `0.01ms` erschlagen. Verengen statt abschalten.
- **Don't** Text unter 11 px setzen.
- **Don't** eine eigene Fokus-Anzeige bauen, die die Grundregel ersetzt. Zusaetzlich ja, anstelle nein.
- **Don't** Touch-Ziele einzeln anfordern. Sie werden geerbt; Ausnahmen tragen `.dh-dense` am Container.
- **Don't** einen Spielschritt nur anklickbar machen. Am Board gibt es keine Maus — siehe Tastaturbetrieb oben.
- **Don't** zwei Primaerbuttons auf einen Bildschirm stellen.
