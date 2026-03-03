# Projektstatus

Stand: 2026-03-03

## Fokus jetzt

Wir stoppen vorerst gr??ere Parallel-Features und stabilisieren die Kernworkflows.
Die fachliche Referenz liegt jetzt in `docs/kernworkflows.md`.
Der konkrete Pr?frahmen liegt jetzt in `docs/testplan.md`.

## Produktkern

`reitbeteiligung.app` organisiert den Ablauf zwischen Pferdehaltern und Reitern:

- Pferd anlegen und sichtbar machen
- Probetermin anfragen und entscheiden
- Reiter als aktive Reitbeteiligung aufnehmen
- Laufende Termine planen und verwalten
- Reitbeteiligungen bei Bedarf wieder entfernen

Wichtig:
Das operative Tagesgesch?ft nach der Freischaltung ist die eigentliche Kernfunktion.

## Seit dem letzten Stand konkret erg?nzt

- Kernworkflows fachlich konsolidiert in `docs/kernworkflows.md`
- Fester Testplan angelegt in `docs/testplan.md`
- Pferde mit aktiven Reitbeteiligungen k?nnen nicht mehr gel?scht werden
- Operative Buchungsanfragen laufen Owner-seitig jetzt fachlich ?ber `/owner/reitbeteiligungen`
- Direkte Buchung innerhalb des Wochenkontingents ist vorbereitet:
  - innerhalb des Kontingents wird direkt gebucht
  - oberhalb des Kontingents bleibt es bei einer Anfrage zur Owner-Entscheidung
- Rider-Dashboard zeigt jetzt zus?tzlich die n?chsten best?tigten Termine

## Technischer Stand

- Next.js 14 App Router + TypeScript
- Supabase f?r Auth, Postgres und Storage
- Rollenbasierte Navigation mit Ungelesen-Indikator f?r Nachrichten
- Kalender im 15-Minuten-Raster
- Direkte Bearbeitung im Kalender-Raster ist bereits teilweise vorhanden
- Build ist gr?n (nur bekannte, nicht blockierende `<img>`-Warnings bleiben)

## Jetzt testkritisch

1. Probetermin -> Freischaltung -> aktive Reitbeteiligung
2. Direktbuchung innerhalb des Wochenkontingents
3. Anfrage oberhalb des Wochenkontingents
4. Kalenderbedienung im Tagesgesch?ft
5. L?schschutz bei aktiven Reitbeteiligungen

## N?chste sinnvolle Schritte

1. Testplan aus `docs/testplan.md` Punkt f?r Punkt manuell durchgehen.
2. Die ersten harten Fehler nur noch gegen die dokumentierten Kernworkflows beheben.
3. Danach gezielt kleine Techniktests f?r Zeitfenster, Konflikte und Kontingente einziehen.
