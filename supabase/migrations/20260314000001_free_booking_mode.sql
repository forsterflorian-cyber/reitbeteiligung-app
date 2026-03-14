-- Free booking mode support
-- Allows direct booking without slot/rule boundaries when horse.booking_mode = 'free'

-- 1. Make availability_rule_id and slot_id nullable in bookings
--    Free-mode bookings have no rule and no slot.
alter table public.bookings
  alter column availability_rule_id drop not null;

alter table public.bookings
  alter column slot_id drop not null;

-- 2. Direct-book RPC for free mode (no rule required)
create or replace function public.direct_book_free(
  p_horse_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_booking_mode text;
  v_request_id uuid;
begin
  if auth.uid() is null then
    raise exception 'NOT_APPROVED';
  end if;

  select booking_mode into v_booking_mode
  from public.horses
  where id = p_horse_id;

  if v_booking_mode is distinct from 'free' then
    raise exception 'NOT_ALLOWED';
  end if;

  if p_start_at is null or p_end_at is null or p_end_at <= p_start_at then
    raise exception 'INVALID_RANGE';
  end if;

  if not exists (
    select 1
    from public.approvals
    where approvals.horse_id = p_horse_id
      and approvals.rider_id = auth.uid()
      and approvals.status = 'approved'
  ) then
    raise exception 'NOT_APPROVED';
  end if;

  if exists (
    select 1
    from public.calendar_blocks
    where calendar_blocks.horse_id = p_horse_id
      and tstzrange(calendar_blocks.start_at, calendar_blocks.end_at, '[)') && tstzrange(p_start_at, p_end_at, '[)')
  ) then
    raise exception 'TIME_UNAVAILABLE';
  end if;

  insert into public.booking_requests (
    availability_rule_id,
    horse_id,
    rider_id,
    slot_id,
    status,
    requested_start_at,
    requested_end_at,
    recurrence_rrule
  )
  values (
    null,
    p_horse_id,
    auth.uid(),
    null,
    'accepted',
    p_start_at,
    p_end_at,
    null
  )
  returning id into v_request_id;

  insert into public.bookings (
    booking_request_id,
    availability_rule_id,
    slot_id,
    horse_id,
    rider_id,
    start_at,
    end_at
  )
  values (
    v_request_id,
    null,
    null,
    p_horse_id,
    auth.uid(),
    p_start_at,
    p_end_at
  );

  return v_request_id;
exception
  when exclusion_violation then
    raise exception 'TIME_UNAVAILABLE';
  when unique_violation then
    raise exception 'TIME_UNAVAILABLE';
end;
$$;

revoke all on function public.direct_book_free(uuid, timestamptz, timestamptz) from public;
grant execute on function public.direct_book_free(uuid, timestamptz, timestamptz) to authenticated;

-- 3. Reschedule RPC for free mode (no rule required)
create or replace function public.reschedule_free_booking(
  p_booking_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_booking record;
  v_new_request_id uuid;
begin
  if p_start_at is null or p_end_at is null or p_end_at <= p_start_at then
    raise exception 'INVALID_RANGE';
  end if;

  select
    bookings.id,
    bookings.booking_request_id,
    bookings.horse_id,
    bookings.rider_id,
    bookings.start_at,
    bookings.end_at,
    requests.status as request_status,
    requests.recurrence_rrule,
    horses.owner_id,
    horses.booking_mode
  into v_booking
  from public.bookings as bookings
  join public.booking_requests as requests
    on requests.id = bookings.booking_request_id
  join public.horses as horses
    on horses.id = bookings.horse_id
  where bookings.id = p_booking_id;

  if not found then
    raise exception 'NOT_FOUND';
  end if;

  if v_booking.booking_mode is distinct from 'free' then
    raise exception 'NOT_ALLOWED';
  end if;

  if auth.uid() <> v_booking.owner_id and auth.uid() <> v_booking.rider_id then
    raise exception 'NOT_ALLOWED';
  end if;

  if not exists (
    select 1
    from public.approvals
    where approvals.horse_id = v_booking.horse_id
      and approvals.rider_id = v_booking.rider_id
      and approvals.status = 'approved'
  ) then
    raise exception 'NOT_APPROVED';
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

  if v_booking.start_at = p_start_at and v_booking.end_at = p_end_at then
    raise exception 'SAME_SLOT';
  end if;

  if exists (
    select 1
    from public.bookings
    where bookings.horse_id = v_booking.horse_id
      and bookings.id <> v_booking.id
      and tstzrange(bookings.start_at, bookings.end_at, '[)') && tstzrange(p_start_at, p_end_at, '[)')
  ) then
    raise exception 'TIME_UNAVAILABLE';
  end if;

  if exists (
    select 1
    from public.calendar_blocks
    where calendar_blocks.horse_id = v_booking.horse_id
      and tstzrange(calendar_blocks.start_at, calendar_blocks.end_at, '[)') && tstzrange(p_start_at, p_end_at, '[)')
  ) then
    raise exception 'TIME_UNAVAILABLE';
  end if;

  insert into public.booking_requests (
    availability_rule_id,
    horse_id,
    rider_id,
    slot_id,
    status,
    requested_start_at,
    requested_end_at,
    recurrence_rrule,
    rescheduled_from_booking_request_id
  )
  values (
    null,
    v_booking.horse_id,
    v_booking.rider_id,
    null,
    'accepted',
    p_start_at,
    p_end_at,
    null,
    v_booking.booking_request_id
  )
  returning id into v_new_request_id;

  update public.booking_requests
  set status = 'rescheduled'
  where id = v_booking.booking_request_id;

  delete from public.bookings
  where id = v_booking.id;

  insert into public.bookings (
    booking_request_id,
    availability_rule_id,
    slot_id,
    horse_id,
    rider_id,
    start_at,
    end_at
  )
  values (
    v_new_request_id,
    null,
    null,
    v_booking.horse_id,
    v_booking.rider_id,
    p_start_at,
    p_end_at
  );

  return v_new_request_id;
exception
  when exclusion_violation then
    raise exception 'TIME_UNAVAILABLE';
  when unique_violation then
    raise exception 'TIME_UNAVAILABLE';
end;
$$;

revoke all on function public.reschedule_free_booking(uuid, timestamptz, timestamptz) from public;
grant execute on function public.reschedule_free_booking(uuid, timestamptz, timestamptz) to authenticated;
