# Statusmodelle

Stand: 2026-03-12

Diese Datei ist eine abgeleitete Kurzuebersicht.
Bei Konflikten gilt immer `docs/kernworkflows.md`.

## Trial Requests

`trial_requests.status`

- `requested`: Anfrage offen
- `accepted`: Probe bestaetigt
- `completed`: Probe durchgefuehrt, Entscheidung noch offen
- `declined`: Anfrage oder Probe vor Aufnahme abgelehnt
- `withdrawn`: Rider hat zurueckgezogen

## Relationships / Approvals

`approvals.status`

- `approved`: aktive Reitbeteiligung
- `rejected`: nach Probe nicht aufgenommen
- `revoked`: spaeter entzogene ehemals aktive Reitbeteiligung

Merksatz:

- `rejected` ist nie eine ehemalige aktive Beziehung.
- `revoked` ist immer eine ehemalige aktive Beziehung.

## Booking Requests

`booking_requests.status`

- `requested`: operative Anfrage offen
- `accepted`: aktive operative Einzelbuchung
- `declined`: operative Anfrage abgelehnt
- `canceled`: aktive operative Buchung beendet
- `rescheduled`: Alttermin einer Umbuchung

## Aktiv vs. Historie

Aktiv:

- Relationship nur bei `approved`
- operative Belegung nur bei `booking_requests.status = accepted` plus vorhandener `bookings`-Zeile

Historie:

- Trial-Enden ueber `trial_requests`
- Relationship-Enden ueber `approvals`
- operative Altfaelle ueber `booking_requests` und `bookings`
- Verfuegbarkeitsfenster werden beendet oder deaktiviert, nicht als Historienpfad physisch geloescht
