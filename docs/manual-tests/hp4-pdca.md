# HP4 - PDCA Referenztest

Stand: 2026-03-04

Dieser Testlauf setzt den eigentlichen Release-Kern als manuellen Referenztest um:

1. Probetermin abschlie?en
2. Reiter als aktive Reitbeteiligung aufnehmen
3. Operatives Tagesgesch?ft pr?fen
4. Reitbeteiligung wieder entfernen

## Ziel

Best?tigen, dass der Lebenszyklus einer Reitbeteiligung von der Probe bis zum Entfernen stabil funktioniert.

Erfolgskriterium:
Der gleiche Reiter wird sauber
- aus der Probephase ?bernommen,
- operativ nutzbar,
- und anschlie?end wieder sauber aus dem operativen Zustand entfernt.

## Voraussetzungen

- 1 Pferdehalter ist eingeloggt
- 1 Reiter ist eingeloggt
- Ein Pferd mit aktivem Profil ist vorhanden
- Ein Probetermin ist angefragt oder kann direkt angefragt werden
- F?r das Pferd existieren offene operative Verf?gbarkeiten

## P - Plan

Wir testen nur den Kern-Lebenszyklus.
Nicht mitgetestet werden in diesem Lauf:

- Bilder-Upload
- Suchradius-Feinheiten
- Tarif-Upgrade-Flow
- optische Nebenbaustellen au?erhalb des Kernablaufs

## D - Do

### Schritt 1: Probetermin bis durchgef?hrt bringen

1. Als Pferdehalter unter `Probetermine` eine offene Anfrage annehmen.
2. Den Probetermin anschlie?end als durchgef?hrt markieren.

Erwartet:
- Status l?uft sauber auf `accepted` und danach `completed`.
- Die Anfrage bleibt in der Probephase, bis eine Entscheidung zur Aufnahme getroffen wird.

### Schritt 2: Reiter aufnehmen

1. Nach `completed` den Reiter als Reitbeteiligung aufnehmen.

Erwartet:
- Die Freischaltung wird gespeichert.
- Der Reiter erscheint bei `Reitbeteiligungen` des Pferdehalters.
- Der Reiter erscheint bei `Meine Reitbeteiligungen`.
- Der Reiter sieht ab jetzt den operativen Kalender.

### Schritt 3: Operativen Alltag pr?fen

1. Als Pferdehalter optional ein Wochenkontingent setzen.
2. Als Reiter einen Termin innerhalb eines offenen Fensters w?hlen.

Erwartet:
- Innerhalb des Kontingents wird direkt gebucht.
- Oberhalb des Kontingents entsteht stattdessen eine Anfrage.
- Beide Seiten sehen einen nachvollziehbaren Zustand.

### Schritt 4: Reitbeteiligung entfernen

1. Als Pferdehalter die Freischaltung entziehen oder die Reitbeteiligung l?schen.

Erwartet:
- Die aktive Reitbeteiligung verschwindet aus dem operativen Bereich.
- Der Reiter verliert den Kalenderzugriff.
- Wochenkontingent und operative Zuordnung sind bereinigt.

## C - Check

Nach dem Lauf pr?fen:

1. War der ?bergang von Probe zu aktiv sauber?
2. War das Tagesgesch?ft danach nutzbar?
3. Wurde der Reiter beim Entfernen wirklich aus dem operativen Zustand zur?ckgebaut?
4. Sind auf beiden Seiten dieselben Zust?nde sichtbar?

## Fehlerklassifikation

Wenn HP4 fehlschl?gt, nur die erste gebrochene Stelle klassifizieren:

- Probetermin-Statusfluss fehlerhaft
- Aufnahme/Freischaltung fehlerhaft
- Operative Buchung fehlerhaft
- Entfernen/Cleanup fehlerhaft
- Rollen- oder Sichtbarkeitsproblem

Wichtig:
Immer nur die erste gebrochene Stelle fixen. Danach den gesamten Lauf neu pr?fen.

## A - Act

Wenn HP4 gr?n ist:

- HP4 als Release-Referenzlauf markieren
- Danach HP5 und HP6 gezielt gegen das Kontingent pr?fen

Wenn HP4 rot ist:

1. Nur die erste gebrochene Stelle beheben
2. HP4 vollst?ndig neu durchlaufen
3. Danach Mini-Regression:
   - `/owner/anfragen`
   - `/owner/reitbeteiligungen`
   - `/anfragen`
   - `/pferde/[id]/kalender`
