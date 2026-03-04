# Kernworkflows

Stand: 2026-03-04

Diese Datei beschreibt den aktuell gew?nschten fachlichen Kern von `reitbeteiligung.app`.
Sie ist die Referenz f?r Produktentscheidungen, UI-Priorit?ten und den Testplan.

## Release-Fokus 1

F?r das erste echte Release muss ein kompletter Lebenszyklus stabil funktionieren:

1. Probetermin anfragen
2. Probetermin entscheiden
3. Reiter als aktive Reitbeteiligung aufnehmen
4. Operatives Tagesgesch?ft f?hren
5. Reitbeteiligung wieder entziehen oder entfernen

Wichtig:
Das ist die zentrale Kernfunktion. Andere Features sind nachrangig, solange dieser Ablauf nicht rund ist.

## Produktkern

Die Plattform organisiert den Ablauf zwischen `Pferdehalter` und `Reiter` in f?nf Phasen:

1. Pferd sichtbar machen
2. Probetermin anfragen und entscheiden
3. Reiter als aktive Reitbeteiligung aufnehmen
4. Laufende Termine planen und verwalten
5. Reitbeteiligung entfernen oder pausieren

## Rollen und Hauptsichten

### Pferdehalter

Die fachlich wichtigen Hauptsichten sind:

1. `Pferde verwalten`
2. `Probetermine`
3. `Reitbeteiligungen`
4. `Nachrichten`
5. `Profil`

Regeln:

- `Pferde verwalten` ist die Hauptsicht f?r Bestand und ?bersicht.
- `Neues Pferd anlegen` ist ein Unterweg innerhalb von `Pferde verwalten`, kein eigener Hauptbereich.
- `Probetermine` enth?lt nur die Probephase.
- `Reitbeteiligungen` enth?lt nur das operative Tagesgesch?ft nach der Freischaltung.
- Tarifinfos sind sichtbar, d?rfen aber den Arbeitsfluss nicht dominieren.

### Reiter

Die fachlich wichtigen Hauptsichten sind:

1. `Pferde finden`
2. `Proben & Planung`
3. `Profil`

Regeln:

- Im Fokus steht entweder ein aktiver Probetermin oder die n?chste operative Buchung.
- Vor der Freischaltung l?uft alles ?ber Probetermine.
- Nach der Freischaltung l?uft das Tagesgesch?ft ?ber aktive Reitbeteiligungen.

## Workflow 1: Konto und Rollenstart

1. Nutzer registriert sich mit E-Mail und Passwort ?ber Supabase Auth.
2. Wenn noch kein Profil existiert, folgt Onboarding.
3. Im Onboarding wird die Rolle gew?hlt: `owner` oder `rider`.
4. Danach wird auf den passenden gesch?tzten Bereich geleitet.

## Workflow 2: Pferd anlegen und pflegen (Pferdehalter)

1. Pferdehalter legt ein neues Pferdeprofil an.
2. Mindestdaten heute: Titel, PLZ, Beschreibung, Aktiv-Status.
3. Erweiterte Daten sind ebenfalls vorgesehen bzw. teilweise aktiv: Standortdetails, Bildmaterial, Stammdaten.
4. Bilder k?nnen hinzugef?gt und entfernt werden (maximal 5 pro Pferd).
5. Pferdehalter kann ein Pferd inklusive Cleanup l?schen.

Wichtige Regel:

- Ein Pferd mit aktiven Reitbeteiligungen darf nicht gel?scht werden.

Ergebnis:
Das Pferd ist als aktives Pferdeprofil f?r Reiter auffindbar.

## Workflow 3: Pferd finden und Probetermin anfragen (Reiter)

1. Reiter sucht nach aktiven Pferdeprofilen.
2. Reiter ?ffnet das Pferdeprofil.
3. Es gibt zwei Varianten f?r die Probeanfrage:
   - explizite Probetermin-Slots sind gepflegt
   - keine Probetermin-Slots sind gepflegt
4. Wenn Probetermin-Slots vorhanden sind, w?hlt der Reiter einen konkreten Probetermin (FCFS).
5. Wenn keine Probetermin-Slots vorhanden sind, sendet der Reiter eine generische Probeanfrage.
6. Optional kann der Reiter eine Nachricht mitsenden.
7. Beim Anlegen der Probeanfrage wird eine Konversation vorbereitet bzw. genutzt.

Ergebnis:
Eine `trial_request` ist angelegt und liegt beim Pferdehalter zur Entscheidung vor.

## Workflow 4: Probetermin entscheiden (Pferdehalter)

Statusfluss der Probetermine:

- `requested` -> neu eingegangen
- `accepted` -> Probetermin angenommen
- `declined` -> Probetermin abgelehnt
- `completed` -> Probetermin hat stattgefunden

Ablauf:

1. Pferdehalter sieht neue Probeanfragen in `Probetermine`.
2. Pferdehalter kann annehmen oder ablehnen.
3. Wenn angenommen, kann der Termin sp?ter als durchgef?hrt markiert werden.
4. W?hrend der Probephase k?nnen beide Seiten intern chatten.

Wichtig:
In dieser Phase ist der Reiter noch keine aktive Reitbeteiligung.

## Workflow 5: Freischaltung zur aktiven Reitbeteiligung

Nach `completed` entscheidet der Pferdehalter, ob der Reiter ?bernommen wird.

Statusfluss der Aufnahme:

- `approved` -> Reiter ist aktive Reitbeteiligung
- `declined` -> Probetraining war nicht passend, der Fall ist abgeschlossen
- `revoked` -> eine bestehende Freischaltung wurde sp?ter entzogen

Ablauf:

1. Pferdehalter entscheidet nach dem durchgef?hrten Probetermin.
2. Bei positiver Entscheidung wird ein Eintrag in `approvals` mit `approved` angelegt oder aktualisiert.
3. Ab dann wird der Reiter aus der Probeterminphase in die operative Reitbeteiligung ?berf?hrt.
4. Kontaktdaten k?nnen danach sichtbar sein, Kommunikation kann zus?tzlich au?erhalb der Plattform stattfinden.

Wichtig:
Ab hier beginnt das eigentliche Tagesgesch?ft.

## Workflow 6: Aktive Reitbeteiligung verwalten (Pferdehalter)

Dieser Bereich geh?rt fachlich in `Reitbeteiligungen`, nicht in `Probetermine`.

Ablauf:

1. Pferdehalter sieht aktive Reitbeteiligungen getrennt von offenen Proben.
2. Pro aktiver Reitbeteiligung kann ein Wochenkontingent in Stunden hinterlegt werden.
3. Pferdehalter verwaltet offene Zeitfenster und pr?ft nur noch die F?lle, die nicht automatisch laufen.
4. Pferdehalter kann eine aktive Reitbeteiligung wieder entfernen oder die Freischaltung entziehen.

Wichtig:
Das ist die Hauptlast der Plattform und muss f?r beide Seiten einfach und fl?ssig bedienbar sein.

## Workflow 7: Operative Terminplanung (Pferdehalter)

Der Kalender ist der Kern des Tagesgesch?fts.

Aktuelle Regeln:

- Verf?gbarkeiten werden im 15-Minuten-Raster gedacht.
- ?berlappende Verf?gbarkeiten sind nicht erlaubt.
- Kalender-Sperren k?nnen einen optionalen Titel haben.
- Offene Zeitfenster, Belegung und Anfragen werden im selben Planer sichtbar gemacht.

Gew?nschte Bedienung:

1. Pferdehalter pflegt zuerst Standardzeiten (Regelverf?gbarkeit).
2. Danach pflegt er Ausnahmen.
3. Einzelne Tage sind nur der Detail- oder Fallback-Fall.
4. Balken sollen direkt im Raster anlegbar, verschiebbar und in der L?nge anpassbar sein.

Zielbild:
Planen soll sich wie eine echte Terminoberfl?che anf?hlen, nicht wie ein Formular.

## Workflow 8: Operative Terminplanung (Reiter)

Nur freigeschaltete Reiter d?rfen operative Termine anfragen oder buchen.

Ablauf:

1. Reiter ?ffnet seine aktive Reitbeteiligung bzw. den Pferdekalender.
2. Reiter sieht offene Verf?gbarkeitsfenster.
3. Reiter w?hlt innerhalb eines offenen Fensters einen Termin im 15-Minuten-Raster.
4. Der Termin muss vollst?ndig innerhalb des gew?hlten Verf?gbarkeitsfensters liegen.
5. Wenn der Termin frei ist und innerhalb des Wochenkontingents liegt, wird er direkt gebucht.
6. Nur wenn das Wochenkontingent ?berschritten w?rde, braucht der Pferdehalter eine Entscheidung.
7. Oberhalb des Kontingents entsteht also eine `booking_request`.
8. Bei Annahme durch den Pferdehalter werden echte `bookings` erzeugt.

Ergebnis:
Laufende Termine der Reitbeteiligung werden organisiert.

## Workflow 9: Reitbeteiligung entfernen oder entziehen

Dieser Schritt geh?rt ebenfalls zum Release-Kern.

Ablauf:

1. Pferdehalter entzieht entweder die Freischaltung oder entfernt die aktive Reitbeteiligung.
2. Wochenkontingent und operative Zuordnung werden bereinigt.
3. Der Reiter verliert den operativen Zugriff auf Kalender und offene Zeitfenster.
4. Das Pferd z?hlt danach wieder nicht mehr als aktive Reitbeteiligung im Tariflimit.

Wichtig:
Das Entfernen muss genauso sauber funktionieren wie das Aufnehmen.

## Workflow 10: Nachrichten

1. Vor Freischaltung l?uft Kommunikation intern ?ber den Chat.
2. Nachrichten sind f?r Pferdehalter und Reiter leicht erreichbar.
3. Es gibt einen Ungelesen-Indikator in der Navigation.
4. Nach Freischaltung kann Kommunikation zus?tzlich au?erhalb der Plattform laufen.

## Workflow 11: Tariflogik

Aktueller fachlicher Stand:

- `Kostenlos`: 1 Pferd, 1 aktive Reitbeteiligung
- `Testphase`: 1 Pferd, bis zu 2 aktive Reitbeteiligungen f?r 14 Tage
- `Bezahlt`: mehrere Pferde, mehrere aktive Reitbeteiligungen

Wichtig:

- Reiter bleiben kostenlos.
- Tariflimits betreffen den Pferdehalter-Bereich.
- Tarifinfos sollen sichtbar sein, aber nicht den operativen Arbeitsfluss dominieren.

## Aktuell release-kritisch

Das sind die Punkte, die f?r den ersten echten Release zuerst rund sein m?ssen:

1. Probetermin -> Freischaltung -> aktive Reitbeteiligung
2. Aktive Reitbeteiligung auf beiden Seiten sofort korrekt sichtbar
3. Direktbuchung innerhalb des Wochenkontingents
4. Anfrage oberhalb des Wochenkontingents
5. Aktive Reitbeteiligung sauber entziehen oder l?schen
6. Kalenderzugriff nur f?r Pferdehalter und aktive Reitbeteiligungen
7. Interne Kommunikation und Ungelesen-Indikator entlang dieses Lebenszyklus
