-- Operative Slot-/Occupancy-Diagnose fuer ein konkretes Pferd, einen Rider und ein Zeitfenster.
-- Standard-Parameter sind auf den aktuell live beobachteten Fall gesetzt.
-- Vor Ausfuehrung bei Bedarf nur die Werte im params-CTE anpassen.

with params as (
  select
    '7f862928-d561-41ea-9a8a-1a97f3489358'::uuid as horse_id,
    '81e079e0-c530-4e2f-89b6-3549f0d05407'::uuid as rider_id,
    timestamptz '2026-03-13 00:00:00+00' as window_start,
    timestamptz '2026-03-15 00:00:00+00' as window_end
)
select * from params;

-- 1. Alle operativen availability_rules im Fenster.
with params as (
  select
    '7f862928-d561-41ea-9a8a-1a97f3489358'::uuid as horse_id,
    timestamptz '2026-03-13 00:00:00+00' as window_start,
    timestamptz '2026-03-15 00:00:00+00' as window_end
)
select
  rules.id as rule_id,
  rules.slot_id,
  rules.active,
  coalesce(rules.is_trial_slot, false) as is_trial_slot,
  rules.start_at,
  rules.end_at
from public.availability_rules as rules
cross join params
where rules.horse_id = params.horse_id
  and tstzrange(rules.start_at, rules.end_at, '[)')
      && tstzrange(params.window_start, params.window_end, '[)')
order by rules.start_at;

-- 2. Alle booking_requests im Fenster fuer das Pferd.
with params as (
  select
    '7f862928-d561-41ea-9a8a-1a97f3489358'::uuid as horse_id,
    timestamptz '2026-03-13 00:00:00+00' as window_start,
    timestamptz '2026-03-15 00:00:00+00' as window_end
)
select
  requests.id as request_id,
  requests.slot_id,
  requests.rider_id,
  requests.status,
  requests.availability_rule_id,
  requests.rescheduled_from_booking_request_id,
  requests.requested_start_at,
  requests.requested_end_at,
  requests.created_at
from public.booking_requests as requests
cross join params
where requests.horse_id = params.horse_id
  and tstzrange(
    coalesce(requests.requested_start_at, requests.created_at),
    coalesce(requests.requested_end_at, requests.created_at + interval '1 second'),
    '[)'
  ) && tstzrange(params.window_start, params.window_end, '[)')
order by requests.requested_start_at nulls first, requests.created_at;

-- 3. Alle bookings im Fenster fuer das Pferd.
with params as (
  select
    '7f862928-d561-41ea-9a8a-1a97f3489358'::uuid as horse_id,
    timestamptz '2026-03-13 00:00:00+00' as window_start,
    timestamptz '2026-03-15 00:00:00+00' as window_end
)
select
  bookings.id as booking_id,
  bookings.booking_request_id,
  bookings.slot_id,
  bookings.rider_id,
  bookings.start_at,
  bookings.end_at,
  bookings.created_at
from public.bookings as bookings
cross join params
where bookings.horse_id = params.horse_id
  and tstzrange(bookings.start_at, bookings.end_at, '[)')
      && tstzrange(params.window_start, params.window_end, '[)')
order by bookings.start_at;

-- 4. Join booking_requests <-> bookings inklusive fehlender Gegenstuecke.
with params as (
  select
    '7f862928-d561-41ea-9a8a-1a97f3489358'::uuid as horse_id,
    timestamptz '2026-03-13 00:00:00+00' as window_start,
    timestamptz '2026-03-15 00:00:00+00' as window_end
)
select
  requests.id as request_id,
  requests.status as request_status,
  requests.slot_id as request_slot_id,
  requests.rider_id,
  requests.requested_start_at,
  requests.requested_end_at,
  bookings.id as booking_id,
  bookings.slot_id as booking_slot_id,
  bookings.start_at as booking_start_at,
  bookings.end_at as booking_end_at
from public.booking_requests as requests
left join public.bookings as bookings
  on bookings.booking_request_id = requests.id
cross join params
where requests.horse_id = params.horse_id
  and tstzrange(
    coalesce(requests.requested_start_at, requests.created_at),
    coalesce(requests.requested_end_at, requests.created_at + interval '1 second'),
    '[)'
  ) && tstzrange(params.window_start, params.window_end, '[)')
order by requests.requested_start_at nulls first, requests.created_at;

-- 5. Orphaned bookings oder bookings mit inaktiven Requests.
with params as (
  select
    '7f862928-d561-41ea-9a8a-1a97f3489358'::uuid as horse_id,
    timestamptz '2026-03-13 00:00:00+00' as window_start,
    timestamptz '2026-03-15 00:00:00+00' as window_end
)
select
  bookings.id as booking_id,
  bookings.booking_request_id,
  bookings.slot_id,
  bookings.start_at,
  bookings.end_at,
  requests.status as request_status,
  case
    when requests.id is null then 'orphan_booking'
    when requests.status <> 'accepted' then 'inactive_request_booking'
    else 'active_booking'
  end as anomaly_type
from public.bookings as bookings
left join public.booking_requests as requests
  on requests.id = bookings.booking_request_id
cross join params
where bookings.horse_id = params.horse_id
  and tstzrange(bookings.start_at, bookings.end_at, '[)')
      && tstzrange(params.window_start, params.window_end, '[)')
  and (
    requests.id is null
    or requests.status <> 'accepted'
  )
order by bookings.start_at;

-- 6. Doppelte aktive Requests pro Slot + Rider.
select
  requests.horse_id,
  requests.rider_id,
  requests.slot_id,
  count(*) as active_request_count,
  array_agg(requests.id order by requests.created_at) as request_ids,
  array_agg(requests.status order by requests.created_at) as statuses
from public.booking_requests as requests
where requests.status in ('requested', 'accepted')
group by requests.horse_id, requests.rider_id, requests.slot_id
having count(*) > 1
order by active_request_count desc, requests.horse_id, requests.rider_id, requests.slot_id;

-- 7. Slots, die im Loader frei erscheinen, aber fuer den Rider durch historische slot_id+rider_id-Requests
--    auf dem Legacy-Schema dennoch blockieren wuerden.
with params as (
  select
    '7f862928-d561-41ea-9a8a-1a97f3489358'::uuid as horse_id,
    '81e079e0-c530-4e2f-89b6-3549f0d05407'::uuid as rider_id,
    timestamptz '2026-03-13 00:00:00+00' as window_start,
    timestamptz '2026-03-15 00:00:00+00' as window_end
),
loader_visible_slots as (
  select
    rules.id as rule_id,
    rules.slot_id,
    rules.start_at,
    rules.end_at
  from public.availability_rules as rules
  cross join params
  where rules.horse_id = params.horse_id
    and rules.active = true
    and coalesce(rules.is_trial_slot, false) = false
    and tstzrange(rules.start_at, rules.end_at, '[)')
        && tstzrange(params.window_start, params.window_end, '[)')
    and not exists (
      select 1
      from public.get_horse_calendar_occupancy(params.horse_id) as occupancy
      where tstzrange(occupancy.start_at, occupancy.end_at, '[)')
            && tstzrange(rules.start_at, rules.end_at, '[)')
    )
)
select
  loader_visible_slots.rule_id,
  loader_visible_slots.slot_id,
  loader_visible_slots.start_at,
  loader_visible_slots.end_at,
  legacy_requests.id as blocking_request_id,
  legacy_requests.status as blocking_request_status,
  legacy_requests.requested_start_at as blocking_request_start_at,
  legacy_requests.requested_end_at as blocking_request_end_at
from loader_visible_slots
join params on true
join public.booking_requests as legacy_requests
  on legacy_requests.horse_id = params.horse_id
 and legacy_requests.rider_id = params.rider_id
 and legacy_requests.slot_id = loader_visible_slots.slot_id
 and legacy_requests.status in ('canceled', 'declined', 'rescheduled')
order by loader_visible_slots.start_at, legacy_requests.created_at;

-- 8. Live-Schemazustand fuer die beiden relevanten Constraints/Indizes.
select
  constraints.conname as object_name,
  constraints.contype as object_type,
  pg_get_constraintdef(constraints.oid, true) as definition
from pg_constraint as constraints
where constraints.conrelid = 'public.booking_requests'::regclass
  and constraints.conname in (
    'booking_requests_status_check',
    'booking_requests_slot_id_rider_id_key'
  )
union all
select
  indexes.indexname as object_name,
  'i' as object_type,
  indexes.indexdef as definition
from pg_indexes as indexes
where indexes.schemaname = 'public'
  and indexes.tablename = 'booking_requests'
  and indexes.indexname = 'booking_requests_active_slot_rider_idx'
order by object_name;
