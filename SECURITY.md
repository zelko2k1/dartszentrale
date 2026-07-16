# Sicherheit

Danke, dass du hilfst, DartsZentrale sicher zu halten. Die App verwaltet
**personenbezogene Mitgliederdaten (DSGVO)** und wird oft von Vereinen ohne
IT-Abteilung selbst betrieben — Sicherheitshinweise sind darum besonders wertvoll.

> **Ehrlich vorweg:** DartsZentrale wird von einem Vereins-Admin (kein ausgebildeter
> Entwickler) mit KI-Unterstützung gepflegt. Support und Reaktionszeit sind begrenzt,
> aber Sicherheitsmeldungen nehme ich ernst und bearbeite sie nach bestem Wissen.

## Unterstützte Versionen

Sicherheitsfixes gibt es für die **jeweils neueste veröffentlichte Version**
(aktuell die `1.0.x`-Reihe, siehe [Releases](../../releases)). Ältere Stände
werden nicht rückwirkend gepatcht — bitte vor einer Meldung auf die neueste
Version aktualisieren.

## Eine Schwachstelle melden

**Bitte melde Sicherheitslücken nicht über öffentliche Issues** — so bleibt anderen
Betreibern Zeit zum Aktualisieren, bevor Details öffentlich werden.

Nutze stattdessen GitHubs **private Sicherheitsmeldung**:

1. Reiter **„Security"** dieses Repos öffnen
2. **„Report a vulnerability"** wählen und das Formular ausfüllen

Ist der Knopf nicht sichtbar, öffne ersatzweise ein **minimales** öffentliches
Issue mit dem Betreff „Sicherheit – bitte privaten Kanal" **ohne technische Details**;
ich melde mich dann mit einem privaten Weg.

Hilfreich in der Meldung:

- Betroffene Version bzw. Commit und der Betriebsmodus (lokal / LAN / Cloud)
- Schritte zum Nachstellen, erwartetes vs. tatsächliches Verhalten
- Mögliche Auswirkung (z. B. Zugriff auf fremde Daten, Rechteausweitung)

Bitte **keine echten Mitgliederdaten** in der Meldung mitschicken.

## Was du erwarten kannst

- Eingangsbestätigung, sobald ich die Meldung sehe (kein garantiertes SLA — Einzelperson)
- Rückfragen bei Bedarf, Einschätzung und, wenn bestätigt, ein Fix in einem der nächsten Releases
- Nennung als Melder\*in im Release-Text, falls gewünscht

## Sicherheit im Eigenbetrieb

Wer selbst hostet, trägt Verantwortung für die eigene Installation. Aktueller
Sicherheitsstand, bekannte Punkte und eine Go-live-Checkliste stehen in
[`docs/security-audit.md`](docs/security-audit.md) und
[`docs/de/go-live-checkliste-cloud.md`](docs/de/go-live-checkliste-cloud.md).
Nutzung erfolgt **auf eigenes Risiko, ohne Gewähr** (siehe [LICENSE](LICENSE)).
