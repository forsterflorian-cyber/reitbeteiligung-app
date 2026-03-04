# Testplan

Stand: 2026-03-04

Diese Datei ?bersetzt die Kernworkflows in konkrete Testf?lle.
Ziel ist ein kleiner, fester Pr?frahmen statt paralleler Ad-hoc-?nderungen.

## Release-Fokus zuerst

F?r das erste echte Release testen wir nicht alles gleich wichtig.
Der zentrale Freigabe-Block ist:

1. Probetermin bis `completed`
2. Reiter als aktive Reitbeteiligung aufnehmen
3. Operativ Termine innerhalb und au?erhalb des Kontingents abwickeln
4. Reitbeteiligung wieder entziehen oder l?schen

Alles andere ist nachrangig, solange dieser Block nicht stabil ist.

## Testprinzip

Wir testen zuerst die produktkritischen Happy Paths und danach die h?rtesten Negativf?lle.
Neue Feature-Arbeit sollte erst weitergehen, wenn diese F?lle stabil sind.

## Teststufen

1. Dokumentierter Happy Path pro Kernworkflow
2. Kritische Negativf?lle und Guards
3. Manueller Smoke-Check pro Rolle
4. Gezielte Techniktests f?r Zeit- und Statuslogik

## Gemeinsame Testdaten

F?r konsistente Tests brauchen wir mindestens:

- 1 Pferdehalter im kostenlosen Tarif
- 1 Reiter mit vollst?ndigem Profil
- 1 aktives Pferd ohne Reitbeteiligung
- 1 aktives Pferd mit bestehender freigeschalteter Reitbeteiligung
- 1 Pferd mit gepflegten Probetermin-Slots
- 1 Pferd mit gepflegten offenen operativen Verf?gbarkeiten
- 1 Pferd mit gesetztem Wochenkontingent f?r eine aktive Reitbeteiligung

## Kern-Happy-Paths

### HP1: Pferd anlegen und sichtbar machen

Referenzlauf: siehe `docs/manual-tests/hp1-pdca.md`
Status: Einmal manuell gr?n gepr?ft (2026-03-03). Der Redirect nach dem ersten Speichern wurde auf `Pferde verwalten` nachgezogen.

1. Pferdehalter legt ein neues Pferdeprofil an.
2. Pferd erscheint unter `Pferde verwalten`.
3. Pferd erscheint in der Reitersuche.
4. Pferdeprofil ist aufrufbar.

Erwartung:
Das Pferd ist aktiv sichtbar und vollst?ndig bearbeitbar.

### HP2: Probetermin mit explizitem Slot anfragen

1. Pferdehalter pflegt einen expliziten Probetermin-Slot.
2. Reiter ?ffnet das Pferdeprofil.
3. Reiter w?hlt genau diesen Slot und sendet die Anfrage.
4. Pferdehalter sieht die Anfrage in `Probetermine`.

Erwartung:
`trial_request` wird mit konkretem Slot angelegt und ist f?r beide Seiten sichtbar.

### HP3: Generische Probeanfrage ohne gepflegte Probetermin-Slots

1. Pferdehalter hat keine expliziten Probetermin-Slots gepflegt.
2. Reiter sendet eine allgemeine Probeanfrage.
3. Pferdehalter sieht die Anfrage in `Probetermine`.

Erwartung:
Der Fallback funktioniert ohne Kalenderpflege.

### HP4: Reitbeteiligung aufnehmen und in den Betrieb ?berf?hren

Referenzlauf: siehe `docs/manual-tests/hp4-pdca.md`

1. Pferdehalter nimmt einen Probetermin an.
2. Pferdehalter markiert ihn sp?ter als durchgef?hrt.
3. Pferdehalter nimmt den Reiter als Reitbeteiligung auf.
4. Reiter erscheint unter `Meine Reitbeteiligungen`.
5. Pferdehalter sieht den Reiter unter `Reitbeteiligungen`.

Erwartung:
Der ?bergang von Probephase zu aktivem Tagesgesch?ft ist klar und sauber.

### HP5: Direktbuchung innerhalb des Wochenkontingents

1. F?r eine aktive Reitbeteiligung ist ein Wochenkontingent gesetzt.
2. Pferdehalter hat offene Verf?gbarkeitsfenster gepflegt.
3. Reiter w?hlt einen freien Termin innerhalb des Fensters.
4. Der Termin bleibt innerhalb des Wochenkontingents.

Erwartung:
Der Termin wird direkt als Buchung angelegt, ohne dass der Pferdehalter manuell annehmen muss.

### HP6: Buchungsanfrage oberhalb des Wochenkontingents

1. F?r eine aktive Reitbeteiligung ist ein Wochenkontingent gesetzt.
2. Reiter w?hlt einen weiteren Termin, der das Wochenkontingent ?berschreitet.
3. Pferdehalter sieht diese Anfrage zur Entscheidung.
4. Pferdehalter kann die Anfrage annehmen oder ablehnen.

Erwartung:
Oberhalb des Kontingents wird nicht automatisch gebucht.

### HP7: Aktive Reitbeteiligung entfernen

1. Eine Reitbeteiligung ist aktiv freigeschaltet.
2. Pferdehalter entzieht die Freischaltung oder l?scht die Reitbeteiligung.
3. Der Reiter verschwindet aus den aktiven Reitbeteiligungen.
4. Der Reiter verliert den operativen Kalenderzugriff.

Erwartung:
Das Entfernen ist sauber und hinterl?sst keinen halben operativen Zustand.

### HP8: Operative Kalenderpflege

1. Pferdehalter legt ein Tagesfenster direkt im Raster an.
2. Pferdehalter verschiebt das Fenster im Raster.
3. Pferdehalter passt Beginn oder Ende im Raster an.
4. Pferdehalter legt eine Sperre mit Titel an.

Erwartung:
Der Planer ist direkt nutzbar, ohne dass Formulare die Hauptinteraktion sind.

### HP9: Nachrichten entlang des Lebenszyklus

1. Reiter stellt eine Probeanfrage.
2. Konversation ist vorhanden.
3. Beide Seiten k?nnen schreiben.
4. Ungelesen-Indikator reagiert sichtbar.
5. Nach Freischaltung bleibt die Kommunikation nachvollziehbar.

Erwartung:
Die interne Kommunikation funktioniert vor und nach der Freischaltung stabil.

## Kritische Negativf?lle

### NG1: Pferd mit aktiver Reitbeteiligung l?schen

1. Pferd hat mindestens eine aktive `approved`-Reitbeteiligung.
2. Pferdehalter versucht zu l?schen.

Erwartung:
L?schen wird blockiert, mit klarer Fehlermeldung.

### NG2: Termin au?erhalb des offenen Fensters

1. Reiter w?hlt einen Terminstart oder ein Terminende au?erhalb des offenen Verf?gbarkeitsfensters.

Erwartung:
Die Aktion wird serverseitig abgelehnt.

### NG3: ?berlappende Verf?gbarkeiten anlegen

1. Pferdehalter hat bereits ein offenes Zeitfenster.
2. Pferdehalter versucht ein ?berlappendes neues Fenster anzulegen oder ein bestehendes hineinzuschieben.

Erwartung:
Die ?berschneidung wird blockiert.

### NG4: Probetermin-Slot ist bereits vergeben

1. Ein expliziter Probetermin wurde bereits reserviert.
2. Ein zweiter Reiter versucht denselben Slot anzufragen.

Erwartung:
FCFS greift, der Slot ist nicht mehr buchbar.

### NG5: Kalenderzugriff ohne Freischaltung

1. Reiter ist noch nicht freigeschaltet.
2. Reiter versucht den operativen Pferde-Kalender zu ?ffnen.

Erwartung:
Der Kalender bleibt gesperrt und zeigt nur den Hinweis auf die Freischaltung.

## Manueller Smoke-Check: Pferdehalter

Vor jedem gr??eren Release:

1. In `Pferde verwalten` ein Pferd anlegen, ?ffnen, bearbeiten.
2. In `Probetermine` eine neue Anfrage sehen und bis `completed` durchspielen.
3. Einen Reiter freischalten und danach in `Reitbeteiligungen` wiederfinden.
4. Im Kalender ein offenes Fenster anlegen, verschieben, skalieren und eine Sperre setzen.
5. Eine aktive Reitbeteiligung wieder entfernen.
6. Ungelesene Nachricht pr?fen.

## Manueller Smoke-Check: Reiter

Vor jedem gr??eren Release:

1. Pferd finden und Detailseite ?ffnen.
2. Probetermin anfragen.
3. Interne Nachricht senden.
4. Nach Freischaltung offene Zeiten sehen.
5. Einen Termin innerhalb des Fensters buchen.
6. Pr?fen, ob `Als N?chstes` und die n?chsten Termine plausibel sind.
7. Nach Entzug der Freischaltung keinen operativen Kalender mehr sehen.

## Techniktests mit h?chstem Nutzen

Diese Teile sollten als erste in kleine, isolierte Tests ausgelagert werden:

1. Zeitfenster-Validierung (`innerhalb des Verf?gbarkeitsfensters`)
2. Konfliktpr?fung (`hasWindowConflict`)
3. Wochenkontingent-Berechnung
4. Status?berg?nge:
   - Probetermin
   - Freischaltung
   - Buchungsanfrage
5. Entfernen einer aktiven Reitbeteiligung inklusive Cleanup

## Release-Gate R1

Ein Stand gilt f?r den ersten echten Release erst als belastbar, wenn:

1. HP4, HP5, HP6 und HP7 mindestens einmal sauber manuell durchlaufen wurden.
2. NG1, NG2, NG3 und NG5 mit erwarteter Fehlermeldung gepr?ft wurden.
3. `npm run build` gr?n ist.
4. Keine neue Kernlogik ohne Eintrag in `docs/kernworkflows.md` und `docs/testplan.md` eingebaut wurde.
