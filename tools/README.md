# tools

Kleine Hilfsskripte rund um DartsHub. Kein Teil der App — nur lokal/offline.

## pdf2schedule.mjs — BDV-Spielplan-PDF → Import-CSV

Wandelt einen BDV-„ScheduleReportFOP"-Spielplan (PDF, eine Staffel mit
vollständiger Tabelle und allen Begegnungen) in die generische Import-CSV
(`Liga;Saison;Datum;Heim;Gast;HeimLegs;GastLegs`), die der „Import"-Dialog auf
dem Ligen-Screen einliest.

### Voraussetzung
`pdftotext` (xpdf/poppler) im PATH. Bei Git für Windows liegt es unter
`<Git>\mingw64\bin\pdftotext.exe` — am einfachsten in Git Bash ausführen.

### Aufruf
```bash
# eine Liga:
node tools/pdf2schedule.mjs "ScheduleReportFOP.pdf" liga.csv

# alle PDFs eines Ordners → eine Sammel-CSV (alle Staffeln):
node tools/pdf2schedule.mjs "C:/Pfad/zu/pdfs" alle-ligen.csv

# ohne Ausgabedatei: CSV nach stdout
node tools/pdf2schedule.mjs "ScheduleReportFOP.pdf"
```
Danach im Ligen-Screen → **Import** → die CSV wählen → bestätigen.

### Grenzen
- **„W"-Wertungen** (kampflos) stehen im PDF ohne Legs → werden als „noch offen"
  importiert. Ergebnis (i. d. R. 12:0 für die wertungsberechtigte Mannschaft)
  in der App manuell nachtragen: Begegnung anklicken → „Ergebnis eingetragen" →
  Legs setzen → Speichern.
- Pro Liga eine PDF nötig; der Vereinsspielplan-CSV deckt dagegen alle Ligen in
  einer Datei ab (aber nur eure Spiele).
