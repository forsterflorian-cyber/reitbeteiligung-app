# Kalender V1: Staging-Verifikation

Stand: 2026-03-11

Diese Notiz beschreibt den echten Staging-Pfad fuer die drei neuen Migrationen, den vorgelagerten Daten-Preflight und die Go/No-Go-Kriterien fuer den Rollout der neuen RPC-/Policy-Semantik.

## Relevante Migrationen

- `20260311103000_booking_request_delete_policy.sql`
- `20260311121500_booking_guardrails.sql`
- `20260311124500_relationship_conversation_visibility.sql`

Abhaengigkeiten:

- `20260302113000_internal_chat.sql`
- `20260302170000_calendar_blocks.sql`
- `20260302183000_availability_rules_and_bookings.sql`
- `20260302193000_booking_request_recurrence.sql`
- `20260303013000_profiles_chat_and_public_image_access.sql`
- `20260304123000_horse_group_chat.sql`

Die Guardrail-Migration ist die kritischste, weil sie den Exclusion-Constraint `bookings_horse_time_no_overlap` auf `public.bookings` einfuehrt und `accept_booking_request` fachlich ersetzt.

## Preflight

### Ziel

Vor `db push` muessen wir sichtbar machen, ob Bestandsdaten den neuen Constraint oder die neue RLS-Sicht verletzen.

### Automatischer Preflight

Im Repo:

```powershell
npm run verify:db
```

Das Skript macht gegen das verlinkte Supabase-Projekt:

1. `migration list`
2. `db push --dry-run`
3. direkten DB-Preflight gegen Live-Daten

Es nutzt die Linked-DB-Verbindung aus dem Supabase-CLI-Dry-Run und prueft:

- ueberlappende bestehende `bookings`
- `approved`-Relationships ohne `completed` Trial
- `conversations.owner_id` ungleich `horses.owner_id`
- mehrere sichtbare Trial-Datensaetze pro `horse_id + rider_id`
- Conversations, die nach neuer RLS unsichtbar werden

### Manuelle SQL-Checkliste

Fuer manuelle Freigaben oder Review in Supabase SQL Editor:

- [calendar_v1_preflight.sql](/E:/Verwaltung/07_IT%20&%20Identit%C3%A4t/IT%20Projekte/reitbeteiligung.app/supabase/preflight/calendar_v1_preflight.sql)

### Blocker vs. Warning

Blocker:

- Ueberlappende `bookings`
- `approved` ohne `completed` Trial
- Conversation-Owner-Mismatch zum aktuellen Pferde-Owner

Warnings:

- mehrere sichtbare Trial-Datensaetze pro Beziehung
- Conversations, die nach neuer RLS unsichtbar werden

Warnings stoppen den Push nicht automatisch, muessen aber vor Freigabe bewusst bestaetigt werden.

## Reale Staging-Schrittfolge

### 1. Backup-/Export-Hinweis

Vor dem Write-Lauf mindestens einen dieser Wege sichern:

- Supabase Managed Backup / Branch-Snapshot bestaetigen
- oder SQL-/Data-Export ausserhalb dieses Repo-Laufs ziehen

Wichtig:

- Dieser Repo-Workflow erstellt selbst keinen vollwertigen Backup-Dump.
- Ohne bestaetigten Snapshot ist ein echter Push fachlich `No-Go`.

### 2. Preflight ausfuehren

```powershell
npm run verify:db
```

Erwartung:

- Exit-Code `0`
- keine `[fail]`-Checks

### 3. Migration push

```powershell
npm run verify:db:staging
```

Der Staging-Runner macht:

1. erneuten Dry-Run
2. echten DB-Preflight
3. `supabase db push`
4. erneuten `migration list`-Check
5. Live-Smoke gegen die echte Staging-DB

### 4. RPC-/Policy-Smoke live

Der Live-Smoke prueft nach dem Push mit echten temporaeren Testnutzern und echter DB:

- aktive Beziehung kann `direct_book_operational_slot` nutzen
- Rider-Direktbuchung scheitert bei Konflikt mit `TIME_UNAVAILABLE`
- `accept_booking_request` erzeugt keine Doppelbelegung
- alte Chat-URL wird nach `revoked` fachlich gesperrt
- `revoked` entzieht operative Rechte sofort wieder

### 5. Abbruch-/Rollback-Hinweise

Push sofort abbrechen oder Rollout stoppen, wenn:

- Preflight-Blocker auftauchen
- `db push` fehlschlaegt
- Live-Smoke fehlschlaegt
- `migration list` nach dem Push noch Pending-Migrationen zeigt

Rollback-Hinweise:

- zuerst App-Deploy mit neuer RPC-/Policy-Semantik stoppen
- dann DB-Rollback nur bewusst und gemeinsam mit App-Rollback planen
- beim Exclusion-Constraint vorher neu entstandene Datenkonflikte pruefen

## Exit-Codes des Verify-Skripts

- `0`: erfolgreich
- `10`: Voraussetzung fehlt
- `20`: Preflight-Blocker
- `30`: Migration push fehlgeschlagen
- `40`: Live-Smoke fehlgeschlagen

## Go/No-Go

### Kalender-V1 ist staging-ready, wenn

- `npm run verify:db` ohne Blocker endet
- Backup-/Snapshot bestaetigt ist
- die drei Zielmigrationen im Dry-Run exakt wie erwartet pending sind
- lokale Verifikation weiter gruen ist:
  - `npm test`
  - `next build`

### App-Code mit neuer RPC-/Policy-Semantik darf deployed werden, wenn

- `npm run verify:db:staging` erfolgreich mit Exit-Code `0` endet
- `migration list` danach keine Pending-Migrationen mehr zeigt
- Live-Smoke fuer Booking-Konflikte, revoked und Chat-Sperre erfolgreich war

### Diese Befunde stoppen den Rollout

- irgendein Preflight-Blocker
- fehlender bestaetigter Backup-/Snapshot
- Push-Fehler oder teilweise angewendeter Migrationslauf
- Live-Smoke-Fehler
- Conversation-/Relationship-Bestand, der fachlich unerwartet unsichtbar werden wuerde und noch nicht freigegeben ist

## Was aktuell real verifiziert ist

Gegen das verlinkte Supabase-Projekt wurden bereits real ausgefuehrt:

- `migration list`
- `db push --dry-run`

Nach Einfuehrung des neuen Preflight-/Staging-Runners gilt zusaetzlich:

- `npm run verify:db` ist der verbindliche read-only Staging-Preflight
- `npm run verify:db:staging` ist der verbindliche Write- und Smoke-Lauf

## Was nur durch lokale Tests abgedeckt ist

- UI-nahe Auswertung der Relationship-Helper
- Server-Action-Orchestrierung ausserhalb des echten DB-Smoke-Pfads

## app/actions.ts nur beobachtet

Kein weiterer Umbau in diesem Schritt. Nach erfolgreicher Staging-Verifikation sind als naechste sichere Kandidaten fuer Auslagerung sichtbar:

- restliche Horse-/Profile-CRUD-Orchestrierung
- grosse Kalender-Owner-Actions ausserhalb der bereits ausgelagerten Booking-/Trial-/Limit-Pfade
- verbleibende Auth-/Password-Reset-nahe Form-Wrapper
