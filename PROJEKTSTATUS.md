# Projektstatus

Stand: 2026-03-04

## Fokus jetzt

Wir priorisieren f?r den ersten echten Release bewusst nur einen Kernblock:

1. Probetermin sauber bis `completed` f?hren
2. Reiter als aktive Reitbeteiligung aufnehmen
3. Operativen Alltag mit offenen Zeitfenstern und Kontingent stabil f?hren
4. Reitbeteiligung wieder sauber entziehen oder l?schen

Wichtig:
Das operative Tagesgesch?ft nach der Freischaltung ist die eigentliche Kernfunktion.

## Was daf?r bereits vorhanden ist

- Trennung der Owner-Hauptsichten in `Pferde verwalten`, `Probetermine` und `Reitbeteiligungen`
- Freischalten und Entziehen der Freischaltung
- Eigene Rider-Sicht f?r aktive Reitbeteiligungen
- Wochenkontingent pro aktiver Reitbeteiligung
- Direkte Buchung innerhalb des Kontingents als Grundlage
- Buchungsanfrage oberhalb des Kontingents als Grundlage
- Kalenderzugriff ist f?r nicht freigeschaltete Reiter gesperrt
- Pferde mit aktiven Reitbeteiligungen k?nnen nicht gel?scht werden
- Interner Chat und Ungelesen-Indikator sind vorhanden

## Was jetzt zuerst robust werden muss

1. Aufnahme eines Reiters nach dem Probetermin ohne Medienbruch
2. Sofort sichtbare ?berf?hrung in die aktive Reitbeteiligung auf beiden Seiten
3. Operative Terminbuchung im Alltag ohne holprige Nebenwege
4. Sauberes Entziehen oder L?schen einer Reitbeteiligung inklusive Cleanup
5. Klare Tests f?r genau diesen Lebenszyklus

## Technischer Stand

- Next.js 14 App Router + TypeScript
- Supabase f?r Auth, Postgres und Storage
- Rollenbasierte Navigation mit Ungelesen-Indikator f?r Nachrichten
- Kalender im 15-Minuten-Raster
- Direkte Bearbeitung im Kalender-Raster ist bereits teilweise vorhanden
- Build ist gr?n (nur bekannte, nicht blockierende `<img>`-Warnings bleiben)

## Verbindliche Testreihenfolge

1. HP4: Reitbeteiligung aufnehmen und in den Betrieb ?berf?hren
2. HP5: Direktbuchung innerhalb des Wochenkontingents
3. HP6: Anfrage oberhalb des Wochenkontingents
4. HP7: Aktive Reitbeteiligung entfernen

## Offene Bugliste separat

Nicht-release-kritische Holprigkeiten laufen gesammelt in `docs/bugliste.md`.
Die n?chste Arbeit orientiert sich aber zuerst an `docs/testplan.md` und am Lebenszyklus aus `docs/kernworkflows.md`.
