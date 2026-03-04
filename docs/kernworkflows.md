# Kernworkflows

Stand: 2026-03-04

Diese Datei beschreibt den aktuell gewuenschten fachlichen Kern von `reitbeteiligung.app`.
Sie ist die Referenz fuer Produktentscheidungen, UI-Prioritaeten und den Testplan.

## Release-Fokus R1

Fuer das erste echte Release muss zuerst dieser Kernblock stabil sein:

1. Registrieren
2. Rollen waehlen
3. Pferd anlegen
4. Pferde suchen, die Probetermine haben
5. Probe anfragen
6. Probe annehmen oder ablehnen
7. Termine fuer Proben einstellen
8. Chat in der Plattform
9. Als Reitbeteiligung fuer ein Pferd aufnehmen
10. Gruppenchat fuer das Pferd
11. Reitbeteiligung wieder entfernen

Wichtig:
Das eigentliche laufende Pferde-Management nach der Aufnahme kommt erst danach.

## Phase 2 nach R1

Erst wenn R1 stabil steht, ziehen wir das eigentliche Tagesgeschaeft nach:

- offene Zeitfenster fuer aktive Reitbeteiligungen
- Wochenkontingente
- direkte operative Buchungen
- Buchungsanfragen oberhalb des Kontingents
- das volle Kalender-Management fuer den Alltag

## Rollen und Hauptsichten

### Pferdehalter

Die fachlich wichtigen Hauptsichten in R1 sind:

1. `Pferde verwalten`
2. `Probetermine`
3. `Reitbeteiligungen`
4. `Nachrichten`
5. `Profil`

Regeln:

- `Pferde verwalten` ist die Hauptsicht fuer Bestand und Uebersicht.
- `Neues Pferd anlegen` ist ein Unterweg innerhalb von `Pferde verwalten`.
- `Probetermine` enthaelt nur die Probephase.
- `Reitbeteiligungen` enthaelt in R1 vor allem Aufnahme, bestehende Beziehungen, Gruppenchat und Entfernen.
- Tarifinfos sind sichtbar, duerfen aber den Arbeitsfluss nicht dominieren.

### Reiter

Die fachlich wichtigen Hauptsichten in R1 sind:

1. `Pferde finden`
2. `Proben & Planung`
3. `Profil`

Regeln:

- Vor der Aufnahme steht der Probetermin im Fokus.
- Nach der Aufnahme steht zuerst die Beziehung zum Pferd im Fokus, nicht das volle operative Management.
- Der Gruppenchat fuer das Pferd muss leicht erreichbar sein.

## Workflow 1: Registrieren und Rollenstart

1. Nutzer registriert sich mit E-Mail und Passwort ueber Supabase Auth.
2. Wenn noch kein Profil existiert, folgt Onboarding.
3. Im Onboarding wird die Rolle gewaehlt: `owner` oder `rider`.
4. Danach wird auf den passenden geschuetzten Bereich geleitet.

## Workflow 2: Pferd anlegen und sichtbar machen

1. Pferdehalter legt ein neues Pferdeprofil an.
2. Mindestdaten heute: Titel, PLZ, Beschreibung, Aktiv-Status.
3. Das Pferd ist als aktives Pferdeprofil fuer Reiter auffindbar.

Wichtige Regel:

- Ein Pferd mit aktiven Reitbeteiligungen darf nicht geloescht werden.

## Workflow 3: Probetermine einstellen

1. Pferdehalter pflegt explizite Probetermin-Slots.
2. Diese Slots sind klar von spaeteren operativen Buchungsfenstern getrennt.
3. Nur diese Slots zaehlen in R1 fuer die Probetrainings-Suche.

## Workflow 4: Pferde mit Probeterminen finden

1. Reiter sucht nach aktiven Pferdeprofilen.
2. Reiter soll zuerst Pferde finden koennen, die konkrete Probetermine haben.
3. Reiter oeffnet das Pferdeprofil und sieht die verfuegbaren Probetermin-Slots.

## Workflow 5: Probe anfragen

1. Reiter waehlt einen konkreten Probetermin-Slot.
2. Falls kein Slot gepflegt ist, kann eine generische Probeanfrage gesendet werden.
3. Optional kann der Reiter eine Nachricht mitsenden.
4. Beim Anlegen der Probeanfrage wird eine Konversation vorbereitet bzw. genutzt.

Ergebnis:
Eine `trial_request` liegt beim Pferdehalter zur Entscheidung vor.

## Workflow 6: Probe annehmen oder ablehnen

Statusfluss der Probetermine:

- `requested` -> neu eingegangen
- `accepted` -> Probe angenommen
- `declined` -> Probe abgelehnt
- `completed` -> Probe hat stattgefunden

Ablauf:

1. Pferdehalter sieht neue Probeanfragen in `Probetermine`.
2. Pferdehalter kann annehmen oder ablehnen.
3. Wenn angenommen, kann der Termin spaeter als durchgefuehrt markiert werden.

## Workflow 7: Chat in der Plattform

1. Vor der Aufnahme laeuft Kommunikation intern ueber den Chat.
2. Beide Seiten koennen Nachrichten schreiben.
3. Ungelesene Nachrichten sind sichtbar.
4. Der Chat ist Teil des Kernflows und kein Nebenfeature.

## Workflow 8: Als Reitbeteiligung aufnehmen

Nach `completed` entscheidet der Pferdehalter, ob der Reiter aufgenommen wird.

Statusfluss der Aufnahme:

- `approved` -> Reiter ist aktive Reitbeteiligung
- `declined` -> Probetraining war nicht passend, der Fall ist abgeschlossen
- `revoked` -> eine bestehende Freischaltung wurde spaeter entzogen

Ablauf:

1. Pferdehalter entscheidet nach dem durchgefuehrten Probetermin.
2. Bei positiver Entscheidung wird ein Eintrag in `approvals` mit `approved` angelegt oder aktualisiert.
3. Der Reiter erscheint ab dann als aktive Reitbeteiligung auf beiden Seiten.

## Workflow 9: Gruppenchat fuer das Pferd

1. Nach der Aufnahme gibt es einen klaren Chat-Kontext fuer das Pferd.
2. Die aktive Reitbeteiligung und der Pferdehalter koennen dort direkt fuer dieses Pferd schreiben.
3. Dieser Chat muss leicht erreichbar sein.
4. Er bleibt auch dann der zentrale Kommunikationsort, wenn das volle operative Management spaeter dazukommt.

## Workflow 10: Reitbeteiligung entfernen

1. Pferdehalter entzieht entweder die Freischaltung oder entfernt die aktive Reitbeteiligung.
2. Die Beziehung verschwindet aus den aktiven Reitbeteiligungen.
3. Gruppenchat- und Sichtbarkeitslogik muessen danach wieder in einen sauberen Zustand gehen.
4. Das Pferd zaehlt danach wieder nicht mehr als aktive Reitbeteiligung im Tariflimit.

Wichtig:
Das Entfernen muss genauso sauber funktionieren wie das Aufnehmen.

## Workflow 11: Pferd managen (nach R1)

Dieser Block gehoert ausdruecklich nicht mehr zum ersten Release.

Erst nach R1:

- offene operative Zeitfenster
- Wochenkontingente
- direkte Buchungen
- Buchungsanfragen oberhalb des Kontingents
- voll ausgebauter Alltagskalender

## Aktuell release-kritisch

Das sind die Punkte, die fuer den ersten echten Release zuerst rund sein muessen:

1. Registrierung und Rollenstart
2. Pferd anlegen und sichtbar machen
3. Probetermine einstellen und finden
4. Probetermin anfragen und entscheiden
5. Plattform-Chat vor der Aufnahme
6. Aufnahme als Reitbeteiligung
7. Gruppenchat fuer das Pferd
8. Reitbeteiligung sauber entfernen
