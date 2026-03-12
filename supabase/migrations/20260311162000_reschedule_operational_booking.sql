alter table public.booking_requests
  add column if not exists rescheduled_from_booking_request_id uuid references public.booking_requests (id) on delete set null;

create index if not exists booking_requests_rescheduled_from_idx
  on public.booking_requests (rescheduled_from_booking_request_id);

create or replace function public.reschedule_operational_booking(
  p_booking_id uuid,
  p_rule_id uuid,
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
  v_owner_id uuid;
  v_rule record;
  v_new_request_id uuid;
begin
  if p_start_at is null or p_end_at is null or p_end_at <= p_start_at then
    raise exception 'INVALID_RANGE';
  end if;

  select
    bookings.id,
    bookings.booking_request_id,
    bookings.availability_rule_id,
    bookings.horse_id,
    bookings.rider_id,
    bookings.start_at,
    bookings.end_at,
    requests.status as request_status,
    requests.recurrence_rrule
  into v_booking
  from public.bookings as bookings
  join public.booking_requests as requests
    on requests.id = bookings.booking_request_id
  where bookings.id = p_booking_id;

  if not found then
    raise exception 'NOT_FOUND';
  end if;

  select horses.owner_id
  into v_owner_id
  from public.horses as horses
  where horses.id = v_booking.horse_id;

  if v_owner_id is null then
    raise exception 'NOT_FOUND';
  end if;

  if auth.uid() <> v_owner_id and auth.uid() <> v_booking.rider_id then
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

  select
    rules.id,
    rules.slot_id,
    rules.start_at,
    rules.end_at,
    rules.active,
    coalesce(rules.is_trial_slot, false) as is_trial_slot
  into v_rule
  from public.availability_rules as rules
  where rules.id = p_rule_id
    and rules.horse_id = v_booking.horse_id;

  if not found or v_rule.active is distinct from true then
    raise exception 'RULE_INACTIVE';
  end if;

  if v_rule.is_trial_slot then
    raise exception 'TRIAL_RULE';
  end if;

  if p_start_at < v_rule.start_at or p_end_at > v_rule.end_at then
    raise exception 'OUTSIDE_RULE';
  end if;

  if v_booking.availability_rule_id = p_rule_id and v_booking.start_at = p_start_at and v_booking.end_at = p_end_at then
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
    p_rule_id,
    v_booking.horse_id,
    v_booking.rider_id,
    v_rule.slot_id,
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
    p_rule_id,
    v_rule.slot_id,
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

revoke all on function public.reschedule_operational_booking(uuid, uuid, timestamptz, timestamptz) from public;
grant execute on function public.reschedule_operational_booking(uuid, uuid, timestamptz, timestamptz) to authenticated;
