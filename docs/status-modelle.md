# Statusmodelle

## Trial Requests

`trial_requests.status`

- `requested`: Anfrage gestellt, noch offen
- `accepted`: Probetermin bestaetigt oder geplant
- `completed`: Probetermin durchgefuehrt, fachliche Entscheidung kann noch offen sein
- `declined`: Anfrage oder Probetermin abgelehnt
- `withdrawn`: Rider hat den Fall zurueckgezogen

Fachliche Quelle:

- Lifecycle: `lib/trial-lifecycle.ts`
- Rider-/Archiv-Zuordnung: `lib/relationship-state.ts`
- Anzeige: `lib/status-display.ts`

## Relationships / Approvals

`approvals.status`

- `approved`: aktive Reitbeteiligung
- `revoked`: Freischaltung entzogen, keine aktive Beziehung mehr

Fachliche Quelle:

- Aktiv-/Zugriffslogik: `lib/relationship-state.ts`

## Booking Requests

`booking_requests.status`

- `requested`: operative Anfrage offen
- `accepted`: operative Einzelbuchung aktiv
- `declined`: Anfrage abgelehnt oder bei Relationship-Cleanup bereinigt
- `canceled`: aktive operative Buchung storniert oder bei Revoked-Bereinigung beendet
- `rescheduled`: Alttermin einer erfolgreichen Umbuchung

Fachliche Quelle:

- Guardrails und Fehlermeldungen: `lib/booking-guards.ts`
- Serverpfade: `lib/server-actions/bookings.ts`
- Anzeige: `lib/status-display.ts`

## Booking Lifecycle

Operative Einzelbuchung V1:

1. Rider bucht direkt oder Owner nimmt eine `requested`-Anfrage an.
2. Eine aktive operative Belegung besteht nur, wenn `booking_requests.status = accepted` und dazu ein Datensatz in `bookings` existiert.
3. Storno setzt den Request auf `canceled` und entfernt die aktive `bookings`-Zeile.
4. Umbuchung setzt den Alttermin auf `rescheduled`, entfernt die alte aktive `bookings`-Zeile und erzeugt genau eine neue aktive Buchung.
5. Bei `revoked` werden zukuenftige/noch laufende operative Buchungen bereinigt; vergangene Historie bleibt erhalten.

Wochenkontingent:

- Zaehlt nur aktive operative Einzeltermine mit `accepted`
- Zaehlt nicht fuer `canceled`, `rescheduled`, Trial-Slots oder vergangene aktive Belegungen
- Woche ist zentral als Kalenderwoche in `Europe/Berlin` definiert, Start Montag 00:00

DB-Quelle:

- `supabase/migrations/20260311173000_weekly_operational_booking_quotas.sql`

## Trial Lifecycle

Probephase V1:

1. `requested`
2. `accepted`
3. `completed`
4. Danach fachliche Entscheidung ueber `approvals.status`

Erneut anfragbar fuer Rider:

- `declined`
- `withdrawn`

Archivfaehige Enden ohne aktive Beziehung:

- `declined`
- `withdrawn`
- `completed` ohne Folgeverwendung
- `completed` plus `revoked`

## Archivregeln

Rider-Archiv in `Meine Reitbeteiligungen` enthaelt nur Historie:

- Trial-Faelle mit `withdrawn`
- Trial-Faelle mit `declined`
- Beziehungen mit `revoked`
- operative Alttermine mit `rescheduled`
- stornierte operative Termine mit `canceled`

Nicht im Archiv:

- aktive Reitbeteiligungen (`approved`)
- offene Trial-Faelle in der Klaerung
- aktive operative Buchungen (`accepted`)

Hinweis:

- UI soll Status nur anzeigen. Fachliche Einsortierung kommt aus den zentralen Helpern in `lib/relationship-state.ts`, `lib/trial-lifecycle.ts`, `lib/booking-guards.ts` und `lib/status-display.ts`.
