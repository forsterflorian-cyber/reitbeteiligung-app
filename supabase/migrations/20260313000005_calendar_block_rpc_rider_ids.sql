-- =============================================================
-- create_calendar_block_for_horse  (extended return)
--
-- Adds cancelled_rider_ids, cancelled_start_ats, cancelled_end_ats
-- to the return table so the JS layer can build consistent
-- booking_cancelled payloads (with start_at, end_at, rider_id)
-- for both domain events and notifications.
--
-- All other logic is identical to the previous version.
-- BLOCK_OVERLAP guard (exclusion_violation) is preserved.
-- =============================================================
create or replace function public.create_calendar_block_for_horse(
  p_horse_id uuid,
  p_start_at timestamptz,
  p_end_at   timestamptz,
  p_title    text default null
)
returns table (
  block_id              uuid,
  cancelled_booking_ids uuid[],
  cancelled_rider_ids   uuid[],
  cancelled_start_ats   timestamptz[],
  cancelled_end_ats     timestamptz[]
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_owner_id         uuid;
  v_block_id         uuid;
  v_cancelled        uuid[]        := '{}';
  v_cancelled_riders uuid[]        := '{}';
  v_cancelled_starts timestamptz[] := '{}';
  v_cancelled_ends   timestamptz[] := '{}';
  v_booking          record;
begin
  -- Explicit time range validation
  if p_end_at <= p_start_at then
    raise exception 'INVALID_TIME_RANGE';
  end if;

  -- Ownership check
  select horses.owner_id into v_owner_id
  from public.horses
  where horses.id = p_horse_id;

  if v_owner_id is null or auth.uid() <> v_owner_id then
    raise exception 'NOT_ALLOWED';
  end if;

  -- Insert block — exclusion constraint fires here on overlap
  insert into public.calendar_blocks (horse_id, start_at, end_at, title)
  values (p_horse_id, p_start_at, p_end_at, p_title)
  returning id into v_block_id;

  -- Find stornierbare bookings and collect full info before deletion:
  --   Overlap:     b.start_at < p_end_at AND b.end_at > p_start_at
  --   Stornierbar: start_at >= now() AND status = 'accepted' AND no recurrence
  for v_booking in
    select b.id, b.booking_request_id, b.rider_id, b.start_at, b.end_at
    from public.bookings b
    join public.booking_requests br on br.id = b.booking_request_id
    where b.horse_id          = p_horse_id
      and br.status           = 'accepted'
      and br.recurrence_rrule is null
      and b.start_at          >= now()
      and b.start_at          <  p_end_at
      and b.end_at            >  p_start_at
  loop
    perform public._cancel_booking_data(v_booking.id, v_booking.booking_request_id);
    v_cancelled        := array_append(v_cancelled,        v_booking.id);
    v_cancelled_riders := array_append(v_cancelled_riders, v_booking.rider_id);
    v_cancelled_starts := array_append(v_cancelled_starts, v_booking.start_at);
    v_cancelled_ends   := array_append(v_cancelled_ends,   v_booking.end_at);
  end loop;

  -- Domain event — same transaction as block insert and cancellations
  insert into public.domain_events (event_type, horse_id, payload)
  values (
    'calendar_block_created',
    p_horse_id,
    jsonb_build_object(
      'block_id',              v_block_id::text,
      'start_at',              p_start_at::text,
      'end_at',                p_end_at::text,
      'title',                 p_title,
      'cancelled_booking_ids', to_jsonb(v_cancelled)
    )
  );

  return query select v_block_id, v_cancelled, v_cancelled_riders, v_cancelled_starts, v_cancelled_ends;

exception
  when exclusion_violation then
    raise exception 'BLOCK_OVERLAP';
end;
$$;

revoke all on function public.create_calendar_block_for_horse(uuid, timestamptz, timestamptz, text) from public;
grant execute on function public.create_calendar_block_for_horse(uuid, timestamptz, timestamptz, text) to authenticated;
