# HP4 - PDCA Referenztest

Stand: 2026-03-04

Dieser Testlauf setzt den eigentlichen Release-Kern als manuellen Referenztest um:

1. Probe anfragen
2. Probe entscheiden
3. Als Reitbeteiligung aufnehmen
4. Pferde-Chat pruefen
5. Reitbeteiligung wieder entfernen

## Ziel

Bestaetigen, dass der Lebenszyklus einer Reitbeteiligung von der Probe bis zum Entfernen stabil funktioniert.

Erfolgskriterium:
Der gleiche Reiter wird sauber
- aus der Probephase uebernommen,
- als aktive Reitbeteiligung sichtbar,
- im Pferde-Chat erreichbar,
- und anschliessend wieder sauber entfernt.

## Voraussetzungen

- 1 Pferdehalter ist eingeloggt
- 1 Reiter ist eingeloggt
- Ein Pferd mit aktivem Profil ist vorhanden
- Mindestens ein Probetermin-Slot ist gepflegt

## P - Plan

Wir testen nur den Kern-Lebenszyklus fuer R1.
Nicht mitgetestet werden in diesem Lauf:

- Wochenkontingente
- operative Alltagsbuchungen
- offene Zeitfenster fuer spaetere Management-Funktionen
- spaetere Kalenderlogik ausserhalb der Probetermine

## D - Do

### Schritt 1: Probe anfragen

1. Als Reiter das Pferdeprofil oeffnen.
2. Einen expliziten Probetermin-Slot waehlen.
3. Anfrage senden.

Erwartet:
- Die Anfrage erscheint in der Probephase.
- Die Konversation ist vorhanden.

### Schritt 2: Probe entscheiden

1. Als Pferdehalter die Anfrage annehmen oder ablehnen.
2. Fuer den positiven Pfad den Termin spaeter als durchgefuehrt markieren.

Erwartet:
- Status laeuft sauber auf `accepted` und danach `completed`.
- Die Anfrage bleibt bis zur Aufnahme in der Probephase.

### Schritt 3: Reiter aufnehmen

1. Nach `completed` den Reiter als Reitbeteiligung aufnehmen.

Erwartet:
- Die Freischaltung wird gespeichert.
- Der Reiter erscheint bei `Reitbeteiligungen` des Pferdehalters.
- Der Reiter erscheint bei `Meine Reitbeteiligungen`.

### Schritt 4: Pferde-Chat pruefen

1. Nach der Aufnahme den Pferde-Chat aus beiden Sichten oeffnen.
2. Je eine Nachricht senden.

Erwartet:
- Beide Seiten landen im richtigen Pferde-Kontext.
- Nachrichten sind sichtbar.
- Ungelesen reagiert plausibel.

### Schritt 5: Reitbeteiligung entfernen

1. Als Pferdehalter die Freischaltung entziehen oder die Reitbeteiligung loeschen.

Erwartet:
- Die aktive Reitbeteiligung verschwindet aus dem aktiven Bereich.
- Der Reiter verliert den Zugriff auf den Pferde-Kontext.
- Die Beziehung ist auf beiden Seiten sauber entfernt.

## C - Check

Nach dem Lauf pruefen:

1. War der Uebergang von Probe zu aktiv sauber?
2. War der Pferde-Chat nach der Aufnahme klar erreichbar?
3. Wurde der Reiter beim Entfernen wirklich aus dem aktiven Zustand zurueckgebaut?
4. Sind auf beiden Seiten dieselben Zustaende sichtbar?

## Fehlerklassifikation

Wenn HP4 fehlschlaegt, nur die erste gebrochene Stelle klassifizieren:

- Probetermin-Statusfluss fehlerhaft
- Aufnahme/Freischaltung fehlerhaft
- Pferde-Chat fehlerhaft
- Entfernen/Cleanup fehlerhaft
- Rollen- oder Sichtbarkeitsproblem

Wichtig:
Immer nur die erste gebrochene Stelle fixen. Danach den gesamten Lauf neu pruefen.

## A - Act

Wenn HP4 gruen ist:

- HP4 als Release-Referenzlauf markieren
- Danach HP5 bis HP7 gegen den R1-Kern weiter pruefen

Wenn HP4 rot ist:

1. Nur die erste gebrochene Stelle beheben
2. HP4 vollstaendig neu durchlaufen
3. Danach Mini-Regression:
   - `/owner/anfragen`
   - `/owner/reitbeteiligungen`
   - `/anfragen`
   - der jeweilige Chat-Kontext fuer das Pferd
