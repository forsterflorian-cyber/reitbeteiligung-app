alter table public.booking_requests
  drop constraint if exists booking_requests_status_check;

alter table public.booking_requests
  add constraint booking_requests_status_check
  check (
    status = any (
      array[
        'requested'::text,
        'accepted'::text,
        'declined'::text,
        'canceled'::text,
        'rescheduled'::text
      ]
    )
  );

alter table public.booking_requests
  drop constraint if exists booking_requests_slot_id_rider_id_key;

drop index if exists public.booking_requests_slot_id_rider_id_key;

create unique index if not exists booking_requests_active_slot_rider_idx
  on public.booking_requests (slot_id, rider_id)
  where status in ('requested', 'accepted');
