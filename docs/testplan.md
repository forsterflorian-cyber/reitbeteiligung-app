# Testplan

Stand: 2026-03-04

Diese Datei uebersetzt die Kernworkflows in konkrete Testfaelle.
Ziel ist ein kleiner, fester Pruefrahmen statt paralleler Ad-hoc-Aenderungen.

## Release-Fokus R1

Fuer den ersten echten Release pruefen wir zuerst nur diesen Kern:

1. Registrieren
2. Rollen waehlen
3. Pferd anlegen
4. Pferde mit Probeterminen finden
5. Probe anfragen
6. Probe annehmen oder ablehnen
7. Probetermine einstellen
8. Chat in der Plattform
9. Als Reitbeteiligung aufnehmen
10. Gruppenchat fuer das Pferd
11. Reitbeteiligung entfernen

Das spaetere laufende Pferde-Management ist fuer R1 bewusst nachrangig.

## Testprinzip

Wir testen zuerst die produktkritischen Happy Paths und danach die haertesten Negativfaelle.
Neue Feature-Arbeit sollte erst weitergehen, wenn diese Faelle stabil sind.

## Gemeinsame Testdaten

Fuer konsistente Tests brauchen wir mindestens:

- 1 Pferdehalter im kostenlosen Tarif
- 1 Reiter mit vollstaendigem Profil
- 1 aktives Pferd ohne Reitbeteiligung
- 1 Pferd mit gepflegten Probetermin-Slots
- 1 bestehende Konversation aus einer Probeanfrage

## Kern-Happy-Paths R1

### HP1: Registrieren und Rollenstart

1. Neuer Nutzer registriert sich.
2. Onboarding erscheint.
3. Rolle wird gesetzt.
4. Nutzer landet im passenden Bereich.

Erwartung:
Auth, Onboarding und Rollenrouting sind stabil.

### HP2: Pferd anlegen und sichtbar machen

Referenzlauf: siehe `docs/manual-tests/hp1-pdca.md`

1. Pferdehalter legt ein neues Pferdeprofil an.
2. Pferd erscheint unter `Pferde verwalten`.
3. Pferd erscheint in der Reitersuche.
4. Pferdeprofil ist aufrufbar.

Erwartung:
Das Pferd ist aktiv sichtbar und vollstaendig bearbeitbar.

### HP3: Probetermine einstellen und finden

1. Pferdehalter pflegt mindestens einen expliziten Probetermin-Slot.
2. Reiter findet das Pferd mit diesem Slot.
3. Im Pferdeprofil ist der Slot klar sichtbar.

Erwartung:
Die Probetraining-Suche funktioniert ueber echte Probetermin-Slots.

### HP4: Probe anfragen und als Reitbeteiligung aufnehmen

Referenzlauf: siehe `docs/manual-tests/hp4-pdca.md`

1. Reiter fragt einen Probetermin an.
2. Pferdehalter nimmt an oder lehnt ab.
3. Bei Annahme wird spaeter auf `completed` gesetzt.
4. Pferdehalter nimmt den Reiter als Reitbeteiligung auf.

Erwartung:
Der Uebergang von Probephase zu aktiver Reitbeteiligung ist klar und sauber.

### HP5: Chat in der Plattform

1. Reiter stellt eine Probeanfrage.
2. Konversation ist vorhanden.
3. Beide Seiten koennen schreiben.
4. Ungelesene Nachrichten sind sichtbar.

Erwartung:
Die Kommunikation vor der Aufnahme funktioniert stabil.

### HP6: Gruppenchat fuer das Pferd

1. Nach der Aufnahme ist ein klarer Chat-Kontext fuer das Pferd erreichbar.
2. Pferdehalter und aktive Reitbeteiligung koennen dort schreiben.
3. Der Chat ist von beiden Seiten leicht erreichbar.

Erwartung:
Die Kommunikation nach der Aufnahme laeuft ueber einen klaren Pferde-Chat.

### HP7: Reitbeteiligung entfernen

1. Eine Reitbeteiligung ist aktiv freigeschaltet.
2. Pferdehalter entzieht die Freischaltung oder loescht die Reitbeteiligung.
3. Der Reiter verschwindet aus den aktiven Reitbeteiligungen.
4. Der Reiter verliert den Zugriff auf den Pferde-Kontext.

Erwartung:
Das Entfernen ist sauber und hinterlaesst keinen halben Zustand.

## Phase 2 nach R1

Diese Tests ziehen wir erst nach dem ersten Release nach:

- operative Zeitfenster im Alltag
- Wochenkontingente
- direkte Buchung innerhalb des Kontingents
- Buchungsanfrage oberhalb des Kontingents
- der volle Management-Kalender

## Kritische Negativfaelle R1

### NG1: Pferd mit aktiver Reitbeteiligung loeschen

1. Pferd hat mindestens eine aktive `approved`-Reitbeteiligung.
2. Pferdehalter versucht zu loeschen.

Erwartung:
Loeschen wird blockiert, mit klarer Fehlermeldung.

### NG2: Probetermin-Slot ist bereits vergeben

1. Ein expliziter Probetermin wurde bereits reserviert.
2. Ein zweiter Reiter versucht denselben Slot anzufragen.

Erwartung:
FCFS greift, der Slot ist nicht mehr buchbar.

### NG3: Kalenderzugriff ohne Aufnahme

1. Reiter ist noch nicht als Reitbeteiligung aufgenommen.
2. Reiter versucht den Pferde-Kalender oder spaeteren Pferde-Kontext zu oeffnen.

Erwartung:
Der Zugriff bleibt gesperrt und zeigt nur den Hinweis auf die Freischaltung.

### NG4: Reitbeteiligung nach Entfernen noch sichtbar

1. Eine aktive Reitbeteiligung wurde entfernt.
2. Eine der beiden Seiten sieht die Beziehung noch als aktiv.

Erwartung:
Das darf nicht passieren. Beide Seiten muessen denselben bereinigten Zustand sehen.

## Manueller Smoke-Check: Pferdehalter

Vor jedem groesseren Release:

1. Pferd anlegen.
2. Probetermin-Slot pflegen.
3. Neue Probeanfrage sehen.
4. Chat pruefen.
5. Reiter aufnehmen.
6. Pferde-Chat pruefen.
7. Reitbeteiligung wieder entfernen.

## Manueller Smoke-Check: Reiter

Vor jedem groesseren Release:

1. Registrieren und Rolle setzen.
2. Pferd finden.
3. Probe anfragen.
4. Plattform-Chat pruefen.
5. Nach Aufnahme als aktive Reitbeteiligung sichtbar sein.
6. Pferde-Chat sehen.
7. Nach Entfernen nicht mehr im aktiven Pferde-Kontext sein.

## Release-Gate R1

Ein Stand gilt fuer den ersten echten Release erst als belastbar, wenn:

1. HP1 bis HP7 mindestens einmal sauber manuell durchlaufen wurden.
2. NG1 bis NG4 mit erwarteter Fehlermeldung oder sauberem Guard geprueft wurden.
3. `npm run build` gruen ist.
4. Das spaetere Pferde-Management noch nicht in den Release-Kern hineingemischt wird.
