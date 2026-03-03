# HP1 ? PDCA Referenztest

Stand: 2026-03-03

Dieser Testlauf setzt `HP1` aus `docs/testplan.md` konkret als manuellen Referenztest um.
Er ist bewusst klein gehalten und dient als erste stabile Basis, bevor komplexere Flows getestet werden.

## Ziel

Best?tigen, dass der einfache Basisfluss vollst?ndig funktioniert:

1. Pferd anlegen
2. In `Pferde verwalten` wiederfinden
3. In `Pferde finden` sehen
4. Pferdedetailseite ?ffnen

Erfolgskriterium:
Alle vier Schritte funktionieren in genau dieser Reihenfolge ohne manuelle DB-Eingriffe.

## Testdaten

Verwende f?r diesen Lauf bewusst nur Minimaldaten:

- Rolle: `Pferdehalter`
- Tarif: idealerweise `Kostenlos`
- Titel: frei w?hlbar, aber eindeutig f?r den Testlauf
- PLZ: g?ltig, 5-stellig
- Beschreibung: kurzer Pflichttext
- Aktiv: eingeschaltet

Empfohlener Testtitel:
`HP1 Testpferd <Datum/Zeit>`

## P ? Plan

Voraussetzungen:

- Owner ist eingeloggt
- Kein anderer paralleler Testlauf ver?ndert gerade Pferdeprofile
- Es wird kein Bild-Upload und keine Kalenderpflege mitgetestet

Abgrenzung:

- Nur Minimaldaten
- Keine erweiterten Felder
- Keine Folgeflows wie Probetermine oder Buchungen

## D ? Do

### Schritt 1: Pferd anlegen

Aktion:

1. ?ffne `/owner/horses`
2. Trage nur diese Felder ein:
   - Titel
   - PLZ
   - Beschreibung
   - Aktiv = an
3. Speichern

Erwartet:

- Speichern funktioniert ohne Fehlermeldung
- Eine Erfolgsmeldung erscheint
- Die Zielseite nach dem Speichern ist plausibel

Tats?chlich:

- Status: ? OK ? Fehler
- Beobachtung:

### Schritt 2: In Pferde verwalten pr?fen

Aktion:

1. ?ffne `/owner/pferde-verwalten`
2. Suche den neu angelegten Eintrag

Erwartet:

- Das neue Pferd ist sichtbar
- Titel stimmt
- PLZ stimmt
- Aktivstatus ist plausibel sichtbar

Tats?chlich:

- Status: ? OK ? Fehler
- Beobachtung:

### Schritt 3: In Pferde finden pr?fen

Aktion:

1. ?ffne `/suchen`
2. Pr?fe, ob das neue Pferd in der Liste erscheint

Erwartet:

- Das neue Pferd ist in der Suche sichtbar
- Titel und PLZ stimmen

Tats?chlich:

- Status: ? OK ? Fehler
- Beobachtung:

### Schritt 4: Pferdedetailseite ?ffnen

Aktion:

1. ?ffne das Pferdeprofil aus der Suche oder direkt aus der Verwaltung

Erwartet:

- Die Detailseite ist erreichbar
- Titel wird korrekt angezeigt
- PLZ bzw. Standorttext wird korrekt angezeigt
- Beschreibung wird korrekt angezeigt

Tats?chlich:

- Status: ? OK ? Fehler
- Beobachtung:

## C ? Check

Auswertung nach dem Lauf:

1. Wurde das Pferd wirklich gespeichert?
2. Ist es Owner-seitig sofort sichtbar?
3. Ist es suchseitig sichtbar?
4. Ist die Detailseite erreichbar?
5. Stimmen Titel, PLZ und Aktivstatus konsistent ?berein?

## Fehlerklassifikation

Wenn HP1 fehlschl?gt, nur die erste gebrochene Stelle klassifizieren:

- Speichern fehlgeschlagen
- Owner-Rendering fehlerhaft
- Such-/Sichtbarkeitsproblem
- Detailseitenproblem
- Validierungsproblem

Wichtig:
Nicht mehrere Symptome gleichzeitig bearbeiten. Erst die erste kaputte Stelle fixen, dann HP1 komplett neu laufen lassen.

## A ? Act

Wenn HP1 gr?n ist:

- Als Referenz-Basisflow markieren
- Erst danach HP2 beginnen

Wenn HP1 rot ist:

1. Nur die erste gebrochene Stelle fixen
2. HP1 komplett erneut durchlaufen
3. Danach Mini-Regression:
   - `/owner/pferde-verwalten`
   - `/suchen`
   - `/pferde/[id]`

## Negativf?lle direkt neben HP1

Diese drei F?lle d?rfen direkt im Anschluss gepr?ft werden, aber getrennt vom Happy Path:

1. Ung?ltige PLZ (nicht 5-stellig) blockiert Speichern
2. Pferd wird gespeichert, erscheint aber nicht in `Pferde verwalten`
3. Pferd erscheint in `Pferde verwalten`, aber nicht in `Pferde finden`
4. Pferd erscheint in `Pferde finden`, aber Detailseite ist nicht erreichbar

## Ergebnisblock

Datum:

Tester:

Verwendeter Testtitel:

Ergebnis gesamt: ? Gr?n ? Rot

Erste gebrochene Stelle (falls rot):

N?chste Aktion:
