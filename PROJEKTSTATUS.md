# Projektstatus

Stand: 2026-03-04

## Fokus jetzt

Wir ziehen das eigentliche Pferde-Management bewusst nach hinten.
Fuer R1 konzentrieren wir uns nur auf diesen Kern:

1. Registrieren
2. Rollen
3. Pferd anlegen
4. Pferde mit Probeterminen finden
5. Probe anfragen
6. Probe annehmen oder ablehnen
7. Probetermine einstellen
8. Chat in der Plattform
9. Als Reitbeteiligung aufnehmen
10. Gruppenchat fuer das Pferd
11. Reitbeteiligung entfernen

Wichtig:
Erst wenn dieser Kern stabil ist, bauen wir das spaetere laufende Pferde-Management weiter aus.

## Was dafuer bereits vorhanden ist

- Registrierung, Login und Onboarding
- Rollenrouting fuer Pferdehalter und Reiter
- Pferde anlegen und sichtbar machen
- Probetermin-Slots als Grundlage
- Probeanfragen inklusive interner Konversation
- Annehmen, Ablehnen und `completed` in der Probephase
- Freischalten und Entziehen der Freischaltung
- Eigene Sicht fuer aktive Reitbeteiligungen
- Reitbeteiligung loeschen bzw. entfernen als Grundlage
- Kalenderzugriff ist fuer nicht freigeschaltete Reiter gesperrt
- Interner Chat und Ungelesen-Indikator sind vorhanden

## Was fuer R1 jetzt zuerst robust werden muss

1. Probetermine sauber pflegen und auffindbar machen
2. Aufnahme eines Reiters nach dem Probetermin ohne Medienbruch
3. Sofort sichtbare Ueberfuehrung in die aktive Reitbeteiligung auf beiden Seiten
4. Klarer Pferde-Chat nach der Aufnahme
5. Sauberes Entfernen einer Reitbeteiligung inklusive Cleanup

## Was bewusst nach R1 kommt

Dieser Block ist derzeit ausdruecklich nach hinten geschoben:

- offene operative Zeitfenster fuer aktive Reitbeteiligungen
- Wochenkontingente
- direkte Buchungen
- Buchungsanfragen oberhalb des Kontingents
- das volle laufende Pferde-Management im Alltag

## Oeffentliche Release-Oberflaeche

- Landing, Login, Signup und FAQ muessen immer zum aktuellen Kernflow passen.
- FAQ und Hilfe gehoeren zur oeffentlichen Release-Oberflaeche und werden bei Kernflow-Aenderungen mitgeprueft.

## Technischer Stand

- Next.js 14 App Router + TypeScript
- Supabase fuer Auth, Postgres und Storage
- Rollenbasierte Navigation mit Ungelesen-Indikator fuer Nachrichten
- Build ist gruen (nur bekannte, nicht blockierende `<img>`-Warnings bleiben)

## Verbindliche Testreihenfolge

1. HP1: Registrieren und Rollenstart
2. HP2: Pferd anlegen und sichtbar machen
3. HP3: Probetermine einstellen und finden
4. HP4: Probe anfragen und als Reitbeteiligung aufnehmen
5. HP5: Chat in der Plattform
6. HP6: Gruppenchat fuer das Pferd
7. HP7: Reitbeteiligung entfernen

## Offene Bugliste separat

Nicht-release-kritische Holprigkeiten laufen gesammelt in `docs/bugliste.md`.
Die naechste Arbeit orientiert sich aber zuerst an `docs/testplan.md` und am R1-Kern.
