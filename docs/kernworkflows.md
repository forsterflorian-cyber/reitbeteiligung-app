# Kernworkflows

Stand: 2026-03-03

Diese Datei beschreibt den aktuell gew?nschten fachlichen Kern von `reitbeteiligung.app`.
Sie ist die Referenz f?r Produktentscheidungen, UI-Priorit?ten und den Testplan.

## Produktkern

Die Plattform organisiert den Ablauf zwischen `Pferdehalter` und `Reiter` in f?nf Phasen:

1. Pferd sichtbar machen
2. Probetermin anfragen und entscheiden
3. Reiter als aktive Reitbeteiligung aufnehmen
4. Laufende Termine planen und verwalten
5. Reitbeteiligung entfernen oder pausieren

Wichtig:
Der operative Alltag nach der Freischaltung ist die eigentliche Kernfunktion.

## Rollen und Hauptsichten

### Pferdehalter

Die fachlich wichtigen Hauptsichten sind:

1. `Pferde verwalten`
2. `Probetermine verwalten`
3. `Reitbeteiligungen`
4. `Nachrichten`
5. `Profil`

Regeln:

- `Pferde verwalten` ist die Hauptsicht f?r Bestand und ?bersicht.
- `Neues Pferd anlegen` ist ein Unterweg innerhalb von `Pferde verwalten`, kein eigener Hauptbereich.
- Die Default?bersicht muss die wichtigsten offenen Themen sofort zeigen.
- `Probetermine` enth?lt nur die Probephase.
- `Reitbeteiligungen` enth?lt nur das operative Tagesgesch?ft nach der Freischaltung.

### Reiter

Die fachlich wichtigen Hauptsichten sind:

1. `Pferde finden`
2. `Proben & Planung`
3. `Profil`

Regeln:

- Die Default?bersicht muss die wichtigsten Infos sofort zeigen.
- Im Fokus steht entweder ein aktiver Probetermin oder die n?chste operative Buchung.
- Zus?tzlich braucht der Reiter eine ?bersicht ?ber seine n?chsten Termine.

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
4. Pferdehalter kann eine aktive Reitbeteiligung wieder entfernen.

Wichtig:
Das ist die Hauptlast der Plattform und muss f?r beide Seiten einfach und fl?ssig bedienbar sein.

Ziel:
Laufende Zusammenarbeit pro Pferd steuerbar halten.

## Workflow 7: Operative Terminplanung (Pferdehalter)

Der Kalender ist der Kern des Tagesgesch?fts.

Aktuelle Regeln:

- Verf?gbarkeiten werden im 15-Minuten-Raster gedacht.
- ?berlappende Verf?gbarkeiten sind nicht erlaubt.
- Kalender-Sperren k?nnen einen optionalen Titel haben.
- Offene Zeitfenster, Belegung und Anfragen werden im selben Planer sichtbar gemacht.

Gew?nschte Bedienung:

1. Pferdehalter kann Tagesfenster direkt im Raster anlegen.
2. Bestehende Verf?gbarkeiten und Sperren k?nnen im Raster direkt bearbeitet werden.
3. Balken sollen sich direkt im Raster verschieben und in der L?nge anpassen lassen.
4. Der untere Editor ist nur noch Detail- oder Fallback-Werkzeug.

Zielbild:
Planen soll sich wie eine echte Terminoberfl?che anf?hlen, nicht wie ein Formular.

## Workflow 8: Operative Terminplanung (Reiter)

Nur freigeschaltete Reiter d?rfen operative Termine anfragen oder buchen.

Ablauf:

1. Reiter ?ffnet seine aktive Reitbeteiligung bzw. den Pferdekalender.
2. Reiter sieht offene Verf?gbarkeitsfenster.
3. Reiter w?hlt innerhalb eines offenen Fensters einen Termin im 15-Minuten-Raster.
4. Der Termin muss vollst?ndig innerhalb des gew?hlten Verf?gbarkeitsfensters liegen.
5. Wiederholungen sollen einfach ausw?hlbar sein und nicht nur als technische RRULE-Eingabe funktionieren.
6. Wenn der Termin frei ist und innerhalb des Wochenkontingents liegt, wird er direkt gebucht.
7. Nur wenn das Wochenkontingent ?berschritten w?rde, braucht der Pferdehalter eine Entscheidung.
8. Oberhalb des Kontingents entsteht also eine `booking_request`.
9. Bei Annahme durch den Pferdehalter werden echte `bookings` erzeugt.

Ergebnis:
Laufende Termine der Reitbeteiligung werden organisiert.

## Workflow 9: Nachrichten

1. Vor Freischaltung l?uft Kommunikation intern ?ber den Chat.
2. Nachrichten sind f?r Pferdehalter und Reiter leicht erreichbar.
3. Es gibt einen Ungelesen-Indikator in der Navigation.
4. Nach Freischaltung kann Kommunikation zus?tzlich au?erhalb der Plattform laufen.

## Workflow 10: Tariflogik

Aktueller fachlicher Stand:

- `Kostenlos`: 1 Pferd, 1 aktive Reitbeteiligung
- `Testphase`: 1 Pferd, bis zu 2 aktive Reitbeteiligungen f?r 14 Tage
- `Bezahlt`: mehrere Pferde, mehrere aktive Reitbeteiligungen

Wichtig:

- Reiter bleiben kostenlos.
- Tariflimits betreffen den Pferdehalter-Bereich.
- Die Tarifinfos sollen sichtbar sein, aber nicht den operativen Arbeitsfluss dominieren.

## Aktuell testkritische Kernbereiche

Das sind die fachlich wichtigsten und zugleich fehleranf?lligsten Bereiche:

1. ?bergang von Probeterminphase zu aktiver Reitbeteiligung
2. Operatives Buchen aus offenen Fenstern f?r Reiter
3. Automatische Direktbuchung innerhalb des Wochenkontingents
4. Kalender-Bedienung im Tagesgesch?ft
5. Saubere Trennung der Owner-Hauptsichten (`Probetermine` vs. `Reitbeteiligungen`)
6. Zusammenspiel aus Kontingent, offenen Fenstern und Buchungsanfragen

## N?chster Schritt

Auf Basis dieser Datei definieren wir eine feste Teststruktur mit:

- Kern-Happy-Paths
- kritischen Negativf?llen
- manuellen Smoke-Checks pro Rolle
- gezielten Techniktests f?r Kalender- und Zeitlogik
