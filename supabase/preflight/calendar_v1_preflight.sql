-- Kalender V1 Preflight fuer Staging vor 20260311103000 / 20260311121500 / 20260311124500
-- Erwartung:
-- 1. Blocker-Queries liefern 0 Zeilen.
-- 2. Warning-Queries werden bewusst geprueft und dokumentiert.

-- BLOCKER: Ueberlappende bestehende bookings brechen den Exclusion-Constraint.
select
  left_booking.id as left_booking_id,
  right_booking.id as right_booking_id,
  left_booking.horse_id,
  left_booking.start_at as left_start_at,
  left_booking.end_at as left_end_at,
  right_booking.start_at as right_start_at,
  right_booking.end_at as right_end_at
from public.bookings as left_booking
join public.bookings as right_booking
  on left_booking.horse_id = right_booking.horse_id
 and left_booking.id < right_booking.id
 and tstzrange(left_booking.start_at, left_booking.end_at, '[)')
     && tstzrange(right_booking.start_at, right_booking.end_at, '[)')
order by left_booking.horse_id, left_booking.start_at;

-- BLOCKER: Approved approvals ohne completed trial brechen den fachlichen Lifecycle.
with latest_trial as (
  select distinct on (trial_requests.horse_id, trial_requests.rider_id)
    trial_requests.horse_id,
    trial_requests.rider_id,
    trial_requests.status,
    trial_requests.created_at
  from public.trial_requests
  order by trial_requests.horse_id, trial_requests.rider_id, trial_requests.created_at desc
)
select
  approvals.horse_id,
  approvals.rider_id,
  approvals.status as approval_status,
  latest_trial.status as latest_trial_status,
  latest_trial.created_at as latest_trial_created_at
from public.approvals
left join latest_trial
  on latest_trial.horse_id = approvals.horse_id
 and latest_trial.rider_id = approvals.rider_id
where approvals.status = 'approved'
  and coalesce(latest_trial.status, 'missing') <> 'completed'
order by approvals.horse_id, approvals.rider_id;

-- BLOCKER: Conversation owner_id muss zum aktuellen horse.owner_id passen.
select
  conversations.id as conversation_id,
  conversations.horse_id,
  conversations.owner_id as conversation_owner_id,
  horses.owner_id as horse_owner_id,
  conversations.rider_id
from public.conversations
join public.horses
  on horses.id = conversations.horse_id
where conversations.owner_id <> horses.owner_id
order by conversations.created_at desc;

-- WARNING: Mehrere sichtbare Trial-Datensaetze pro Beziehung machen Altbestand mehrdeutig.
select
  trial_requests.horse_id,
  trial_requests.rider_id,
  count(*) as visible_trial_count
from public.trial_requests
where trial_requests.status in ('requested', 'accepted', 'completed')
group by trial_requests.horse_id, trial_requests.rider_id
having count(*) > 1
order by visible_trial_count desc, trial_requests.horse_id, trial_requests.rider_id;

-- WARNING: Diese Conversations werden nach neuer RLS unsichtbar.
with latest_trial as (
  select distinct on (trial_requests.horse_id, trial_requests.rider_id)
    trial_requests.horse_id,
    trial_requests.rider_id,
    trial_requests.status,
    trial_requests.created_at
  from public.trial_requests
  order by trial_requests.horse_id, trial_requests.rider_id, trial_requests.created_at desc
)
select
  conversations.id as conversation_id,
  conversations.horse_id,
  conversations.rider_id,
  conversations.owner_id,
  approvals.status as approval_status,
  latest_trial.status as latest_trial_status,
  latest_trial.created_at as latest_trial_created_at
from public.conversations
left join public.approvals
  on approvals.horse_id = conversations.horse_id
 and approvals.rider_id = conversations.rider_id
left join latest_trial
  on latest_trial.horse_id = conversations.horse_id
 and latest_trial.rider_id = conversations.rider_id
where not (
  approvals.status = 'approved'
  or (
    coalesce(approvals.status, '') <> 'revoked'
    and latest_trial.status in ('requested', 'accepted', 'completed')
  )
)
order by conversations.created_at desc;
