# Kernworkflows

Stand: 2026-03-12

Diese Datei ist der verbindliche fachliche Contract fuer den aktuellen Produktstand von `reitbeteiligung.app`.
Bei Konflikten gilt diese Datei vor `README.md`, `PROJEKTSTATUS.md` und `docs/status-modelle.md`.

## Aktueller Release-Stand

Aktuell live und release-relevant sind:

1. Registrierung, Login und Rollenstart
2. Pferd anlegen und als aktives Profil sichtbar machen
3. Probetermin-Slots pflegen
4. Pferde mit konkreten Probeterminen finden
5. Probetermin anfragen
6. Probeanfrage annehmen oder ablehnen
7. Probetermin als durchgefuehrt markieren
8. 1:1-Chat waehrend der Probephase
9. Reiter nach durchgefuehrter Probe aufnehmen oder nicht aufnehmen
10. Aktive Reitbeteiligung spaeter wieder entfernen
11. Pferde-Gruppenchat fuer aktive Reitbeteiligungen
12. Aktive-Reitbeteiligung-Kalender V1 fuer Owner und freigeschaltete Rider
13. Rider-/Owner-Workspaces fuer aktives Tagesgeschaeft
14. Trennung zwischen aktiven Faellen, Klaerung, Nachrichten und Archiv

## Bewusst nicht Teil des aktuellen Stands

Nicht Teil des aktuellen Contracts sind:

- Wochen- oder Monatsansichten als eigener Produktmodus
- wiederholende operative Buchungen
- sonstiges erweitertes Horse-Management ausserhalb des aktuellen Kalender-V1

Hinweis:

- Technische Guardrails wie Wochenlimits koennen im Kalender V1 bereits greifen.
- Sie aendern nichts daran, dass der aktuelle Produktvertrag bei operativen Einzelterminen bleibt.

## Statusvertrag

### Trial Requests

`trial_requests.status`

- `requested`: Anfrage gestellt, noch offen
- `accepted`: Probetermin bestaetigt oder geplant
- `completed`: Probetermin durchgefuehrt, fachliche Entscheidung steht noch aus
- `declined`: Anfrage oder Probe vor einer Aufnahmeentscheidung abgelehnt
- `withdrawn`: Rider hat den Fall zurueckgezogen

### Relationships / Approvals

`approvals.status`

- `approved`: aktive Reitbeteiligung
- `rejected`: nach durchgefuehrter Probe nicht aufgenommen, nie aktive Beziehung geworden
- `revoked`: vorher aktive Reitbeteiligung spaeter entzogen

Wichtige Regel:

- `rejected` und `revoked` beschreiben zwei verschiedene fachliche Wahrheiten.
- `revoked` darf nur fuer ehemals aktive Beziehungen verwendet werden.
- `rejected` ist der Endstatus fuer "nach Probe nicht aufgenommen".

### Booking Requests

`booking_requests.status`

- `requested`: operative Anfrage offen
- `accepted`: operative Einzelbuchung aktiv
- `declined`: operative Anfrage abgelehnt
- `canceled`: aktive operative Buchung storniert oder bei Relationship-Cleanup beendet
- `rescheduled`: Alttermin einer erfolgreichen Umbuchung

## Sichtbarkeit und Rechte

### Probephase

- Solange keine Relationship-Entscheidung vorliegt, bleibt der Fall in Klaerung.
- Der 1:1-Chat bleibt in der Probephase sichtbar fuer `requested`, `accepted` und `completed`.

### Aktive Beziehung

- Nur `approved` zaehlt als aktive Reitbeteiligung.
- Nur `approved` eroeffnet Gruppenchat und operativen Kalender fuer Rider.
- Owner behalten Kalenderzugriff immer fuer eigene Pferde.

### Endzustaende

- `rejected` beendet den Fall ohne aktive Folge.
- `revoked` beendet eine vorher aktive Beziehung.
- Sowohl `rejected` als auch `revoked` schliessen den 1:1-Chat als aktiven Arbeitskontext.

## Kalender V1

Der aktuelle Kalendervertrag fuer aktive Reitbeteiligungen ist:

- Owner pflegen operative Zeitfenster und Probetermin-Slots getrennt im selben Kalenderkontext.
- Rider mit `approved` koennen offene operative Einzeltermine direkt uebernehmen.
- Rider koennen innerhalb offener Fenster auch einen eigenen operativen Zeitraum anfragen.
- Owner koennen offene operative Anfragen annehmen oder ablehnen.
- Aktive operative Einzeltermine koennen storniert oder umgebucht werden.
- Vergangene operative Historie bleibt als Historie bestehen.

Nicht Bestandteil dieses Vertrags:

- wiederholende operative Termine
- alternative Wochen-/Monatsmodule ausserhalb des aktuellen Kalenders

## Historisierung

Historie bleibt erhalten ueber Status und Deaktivierung, nicht ueber physisches Loeschen:

- Trial-Historie bleibt in `trial_requests`
- Relationship-Enden bleiben in `approvals`
- operative Historie und Lifecycle liegen in `booking_requests`
- `bookings` halten nur aktuell wirksame operative Belegung (`accepted` plus vorhandene `booking`-Zeile)
- technische Repair-Pfade duerfen nur inkonsistente oder orphaned `bookings` entfernen, nicht Statushistorie fachlich auswerten
- Verfuegbarkeitsfenster werden fachlich beendet, nicht als Historienpfad physisch geloescht
- Bei `revoked` werden nur zukuenftige oder laufende operative Zuordnungen bereinigt; vergangene Historie bleibt bestehen

## Workspace-Zuordnung

### Rider

- `Aktiv`: nur `approved`
- `In Klaerung`: Trial-Faelle ohne Relationship-Entscheidung
- `Archiv`: `withdrawn`, Trial-`declined`, `completed + rejected`, `revoked`

### Owner

- `Probetermine`: nur Probephase bis zur fachlichen Entscheidung
- `Reitbeteiligungen`: aktive Beziehungen und spaeteres Entfernen
- `Nachrichten`: separater Kommunikationskontext
- `Dashboard`: Uebersicht ueber Probe, aktive Beziehungen, Nachrichten und operatives Tagesgeschaeft

## Entwicklerhinweis

Die fachliche Einsortierung soll aus zentralen Helpern kommen:

- `lib/relationship-state.ts`
- `lib/trial-lifecycle.ts`
- `lib/status-display.ts`
- `lib/booking-guards.ts`
