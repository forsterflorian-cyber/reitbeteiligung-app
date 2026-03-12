# Performance Hardening

## Optimierte Datenpfade

### Workspace-Loader

- `lib/rider-workspace.ts`
  - Pferde-Select auf die fuer Rider wirklich benoetigten Felder reduziert (`id`, `title`, `plz`)
  - keine Einzel-RPC pro Conversation mehr
- `lib/owner-workspace.ts`
  - ungenutzte `booking_requests`- und `rider_booking_limits`-Loads entfernt
  - Pferde-Select auf die fuer Owner-Workspace-Seiten benoetigten Felder reduziert
  - keine Einzel-RPC pro Conversation mehr

### Nachrichten

- `lib/message-summaries.ts`
  - zentrale Ladehelfer fuer Conversation-Summaries und letzte Gruppenchat-Nachrichten
- `app/nachrichten/page.tsx`
- `app/owner/nachrichten/page.tsx`
  - keine Voll-Loads aller Gruppenchat-Nachrichten pro Pferd mehr
  - stattdessen nur die letzte Nachricht pro Pferd

### Kalender

- `app/pferde/[id]/kalender/page.tsx`
  - aktive Availability Rules direkt in der Query gefiltert
  - Owner-Profil wird nicht mehr zusaetzlich geladen, wenn der Owner die Seite selbst sieht
  - stornierte und umgebuchte Historie je Rolle in einer Query statt in zwei separaten Loads
  - Rider-Namen fuer naechsten Trial und Booking-Historie in einem Batch geholt

### Operative Direktbuchung

- `lib/server-actions/bookings.ts`
  - der Hot Path fuer operative Direktbuchung verlaesst sich auf die zentrale RPC-Wahrheit
  - redundante Vorab-Queries fuer Approval, Rule-Load und Kalender-Konfliktpruefung entfallen auf dem Direktpfad

## Neue Query-/Index-Haertungen

Migration:

- `supabase/migrations/20260311190000_query_hardening.sql`

Enthaelt:

- Batch-RPC `get_conversation_summaries(uuid[])`
  - ersetzt N+1-Contact-Info-RPCs und Voll-Loads aller Nachrichten je Conversation-Liste
- RPC `get_latest_horse_group_messages(uuid[])`
  - liefert nur die letzte Gruppenchat-Nachricht pro Pferd
- gezielte Indizes fuer haeufige Listen- und Pair-Queries:
  - `trial_requests (rider_id, created_at desc)`
  - `trial_requests (horse_id, rider_id, created_at desc)`
  - `booking_requests (horse_id, created_at desc)`
  - `booking_requests (horse_id, rider_id, created_at desc)`
  - `bookings (rider_id, start_at)`
  - `approvals (horse_id, rider_id, status)`

## Verbleibende Hotspots

- `app/pferde/[id]/kalender/page.tsx`
  - weiterhin die groesste Einzelseite mit mehreren Modus-Branches und entsprechend mehreren voneinander getrennten Datenpfaden
- Workspace-Loader
  - Trial-/Approval-Zuordnung wird weiterhin lokal materialisiert, weil die UI gleichzeitig Aktiv, Klaerung, Archiv und Visibility braucht
- `app/chat/[conversation_id]/page.tsx`
  - laedt bewusst weiterhin die komplette Nachrichtenhistorie einer einzelnen Conversation

## Bewusst nicht gemacht

- kein Caching-Layer
- keine breite RPC-Neuarchitektur fuer den gesamten Kalender
- keine Denormalisierung von Trial-/Approval-/Conversation-Status
- keine UI-Aenderung
- keine Aenderung an Fachlogik oder Features

## Rollout-Hinweis

- Die neuen Loader profitieren erst vollstaendig, wenn `20260311190000_query_hardening.sql` in der Datenbank ausgerollt ist.
