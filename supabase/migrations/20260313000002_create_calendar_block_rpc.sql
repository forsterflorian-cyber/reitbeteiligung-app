-- =============================================================
-- Internal helper: executes the two booking cancellation data writes.
-- No auth checks, no status validation — callers are responsible.
-- No GRANT — internal use only (called by security-definer functions).
-- =============================================================
create or replace function public._cancel_booking_data(
  p_booking_id         uuid,
  p_booking_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  delete from public.bookings
  where id = p_booking_id;

  update public.booking_requests
  set status = 'canceled'
  where id = p_booking_request_id;
end;
$$;

revoke all on function public._cancel_booking_data(uuid, uuid) from public;


-- =============================================================
-- cancel_operational_booking: delegates data writes to helper.
-- Auth and status checks remain here. No second cancel path.
-- =============================================================
create or replace function public.cancel_operational_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_booking  record;
  v_owner_id uuid;
begin
  select
    bookings.id,
    bookings.booking_request_id,
    bookings.horse_id,
    bookings.rider_id,
    bookings.start_at,
    requests.status          as request_status,
    requests.recurrence_rrule
  into v_booking
  from public.bookings as bookings
  join public.booking_requests as requests
    on requests.id = bookings.booking_request_id
  where bookings.id = p_booking_id;

  if not found then
    raise exception 'NOT_FOUND';
  end if;

  select horses.owner_id into v_owner_id
  from public.horses
  where horses.id = v_booking.horse_id;

  if v_owner_id is null then
    raise exception 'NOT_FOUND';
  end if;

  if auth.uid() <> v_owner_id then
    if auth.uid() <> v_booking.rider_id then
      raise exception 'NOT_ALLOWED';
    end if;

    if not exists (
      select 1 from public.approvals
      where approvals.horse_id = v_booking.horse_id
        and approvals.rider_id = v_booking.rider_id
        and approvals.status   = 'approved'
    ) then
      raise exception 'NOT_APPROVED';
    end if;
  end if;

  if v_booking.request_status <> 'accepted' then
    raise exception 'INVALID_STATUS';
  end if;

  if v_booking.recurrence_rrule is not null then
    raise exception 'UNSUPPORTED_RECURRENCE';
  end if;

  if v_booking.start_at <= timezone('utc'::text, now()) then
    raise exception 'BOOKING_STARTED';
  end if;

  perform public._cancel_booking_data(v_booking.id, v_booking.booking_request_id);
end;
$$;

revoke all on function public.cancel_operational_booking(uuid) from public;
grant execute on function public.cancel_operational_booking(uuid) to authenticated;


-- =============================================================
-- create_calendar_block_for_horse
--
-- Consistency guarantee (all in one transaction):
--   1. Block is inserted into calendar_blocks.
--   2. All overlapping future accepted non-recurring bookings are cancelled
--      via _cancel_booking_data (stornierbar = start_at >= now()).
--   3. Domain event calendar_block_created is written to domain_events.
--
-- Bookings with start_at < now() are NOT cancelled (already started).
-- Bookings with recurrence_rrule are NOT cancelled (V1 limitation).
-- =============================================================
create or replace function public.create_calendar_block_for_horse(
  p_horse_id uuid,
  p_start_at timestamptz,
  p_end_at   timestamptz,
  p_title    text default null
)
returns table (
  block_id              uuid,
  cancelled_booking_ids uuid[]
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_owner_id  uuid;
  v_block_id  uuid;
  v_cancelled uuid[] := '{}';
  v_booking   record;
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

  -- Insert block
  insert into public.calendar_blocks (horse_id, start_at, end_at, title)
  values (p_horse_id, p_start_at, p_end_at, p_title)
  returning id into v_block_id;

  -- Find stornierbare bookings:
  --   Overlap:     b.start_at < p_end_at AND b.end_at > p_start_at
  --   Stornierbar: start_at >= now() AND status = 'accepted' AND no recurrence
  for v_booking in
    select b.id, b.booking_request_id
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
    v_cancelled := array_append(v_cancelled, v_booking.id);
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

  return query select v_block_id, v_cancelled;
end;
$$;

revoke all on function public.create_calendar_block_for_horse(uuid, timestamptz, timestamptz, text) from public;
grant execute on function public.create_calendar_block_for_horse(uuid, timestamptz, timestamptz, text) to authenticated;


-- =============================================================
-- delete_calendar_block_for_horse
--
-- Consistency guarantee (all in one transaction):
--   1. Block is deleted from calendar_blocks.
--   2. Domain event calendar_block_deleted is written to domain_events.
-- =============================================================
create or replace function public.delete_calendar_block_for_horse(
  p_block_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_block    record;
  v_owner_id uuid;
begin
  select cb.horse_id, cb.start_at, cb.end_at, cb.title
  into v_block
  from public.calendar_blocks cb
  where cb.id = p_block_id;

  if not found then
    raise exception 'NOT_FOUND';
  end if;

  select horses.owner_id into v_owner_id
  from public.horses
  where horses.id = v_block.horse_id;

  if v_owner_id is null or auth.uid() <> v_owner_id then
    raise exception 'NOT_ALLOWED';
  end if;

  delete from public.calendar_blocks
  where id = p_block_id;

  -- Domain event — same transaction as block delete
  insert into public.domain_events (event_type, horse_id, payload)
  values (
    'calendar_block_deleted',
    v_block.horse_id,
    jsonb_build_object(
      'block_id', p_block_id::text,
      'start_at', v_block.start_at::text,
      'end_at',   v_block.end_at::text,
      'title',    v_block.title
    )
  );
end;
$$;

revoke all on function public.delete_calendar_block_for_horse(uuid) from public;
grant execute on function public.delete_calendar_block_for_horse(uuid) to authenticated;
