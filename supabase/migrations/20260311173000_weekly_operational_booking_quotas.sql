create or replace function public.get_booking_week_bounds(p_reference_at timestamptz)
returns table (
  week_start timestamptz,
  week_end timestamptz
)
language sql
immutable
as $$
  select
    (date_trunc('week', timezone('Europe/Berlin', p_reference_at)) at time zone 'Europe/Berlin') as week_start,
    ((date_trunc('week', timezone('Europe/Berlin', p_reference_at)) + interval '7 days') at time zone 'Europe/Berlin') as week_end;
$$;

create or replace function public.get_rider_weekly_booking_usage_minutes(
  p_horse_id uuid,
  p_rider_id uuid,
  p_reference_at timestamptz,
  p_excluded_booking_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_booked_minutes integer;
  v_week_end timestamptz;
  v_week_start timestamptz;
begin
  select bounds.week_start, bounds.week_end
  into v_week_start, v_week_end
  from public.get_booking_week_bounds(p_reference_at) as bounds;

  select coalesce(
    sum(
      greatest(
        round(extract(epoch from least(bookings.end_at, v_week_end) - greatest(bookings.start_at, v_week_start)) / 60.0)::integer,
        0
      )
    ),
    0
  )
  into v_booked_minutes
  from public.bookings as bookings
  join public.booking_requests as requests
    on requests.id = bookings.booking_request_id
  left join public.availability_rules as rules
    on rules.id = bookings.availability_rule_id
  where bookings.horse_id = p_horse_id
    and bookings.rider_id = p_rider_id
    and (p_excluded_booking_id is null or bookings.id <> p_excluded_booking_id)
    and bookings.start_at < v_week_end
    and bookings.end_at > v_week_start
    and bookings.end_at > timezone('utc'::text, now())
    and requests.status = 'accepted'
    and requests.recurrence_rrule is null
    and coalesce(rules.is_trial_slot, false) is false;

  return coalesce(v_booked_minutes, 0);
end;
$$;

create or replace function public.assert_rider_weekly_booking_limit(
  p_horse_id uuid,
  p_rider_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_excluded_booking_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_booked_minutes integer;
  v_limit_hours integer;
  v_limit_minutes integer;
  v_requested_minutes integer;
  v_week_end timestamptz;
  v_week_start timestamptz;
begin
  if p_start_at is null or p_end_at is null or p_end_at <= p_start_at then
    raise exception 'INVALID_RANGE';
  end if;

  select bounds.week_start, bounds.week_end
  into v_week_start, v_week_end
  from public.get_booking_week_bounds(p_start_at) as bounds;

  select rider_booking_limits.weekly_hours_limit
  into v_limit_hours
  from public.rider_booking_limits
  where rider_booking_limits.horse_id = p_horse_id
    and rider_booking_limits.rider_id = p_rider_id
  for update;

  if v_limit_hours is null then
    return;
  end if;

  v_requested_minutes := greatest(
    round(extract(epoch from least(p_end_at, v_week_end) - greatest(p_start_at, v_week_start)) / 60.0)::integer,
    0
  );

  if v_requested_minutes = 0 then
    return;
  end if;

  v_booked_minutes := public.get_rider_weekly_booking_usage_minutes(
    p_horse_id,
    p_rider_id,
    p_start_at,
    p_excluded_booking_id
  );
  v_limit_minutes := v_limit_hours * 60;

  if v_booked_minutes + v_requested_minutes > v_limit_minutes then
    raise exception 'WEEKLY_LIMIT_EXCEEDED';
  end if;
end;
$$;

create or replace function public.get_rider_weekly_booking_quota(
  p_horse_id uuid,
  p_rider_id uuid,
  p_reference_at timestamptz default timezone('utc'::text, now())
)
returns table (
  horse_id uuid,
  rider_id uuid,
  week_start timestamptz,
  week_end timestamptz,
  weekly_hours_limit integer,
  booked_minutes integer,
  remaining_minutes integer
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_booked_minutes integer;
  v_limit_hours integer;
  v_reference_at timestamptz;
  v_week_end timestamptz;
  v_week_start timestamptz;
begin
  if auth.uid() is null then
    raise exception 'NOT_ALLOWED';
  end if;

  if auth.uid() <> p_rider_id and not exists (
    select 1
    from public.horses
    where horses.id = p_horse_id
      and horses.owner_id = auth.uid()
  ) then
    raise exception 'NOT_ALLOWED';
  end if;

  v_reference_at := coalesce(p_reference_at, timezone('utc'::text, now()));

  select bounds.week_start, bounds.week_end
  into v_week_start, v_week_end
  from public.get_booking_week_bounds(v_reference_at) as bounds;

  select rider_booking_limits.weekly_hours_limit
  into v_limit_hours
  from public.rider_booking_limits
  where rider_booking_limits.horse_id = p_horse_id
    and rider_booking_limits.rider_id = p_rider_id;

  v_booked_minutes := public.get_rider_weekly_booking_usage_minutes(
    p_horse_id,
    p_rider_id,
    v_reference_at,
    null
  );

  return query
  select
    p_horse_id,
    p_rider_id,
    v_week_start,
    v_week_end,
    v_limit_hours,
    v_booked_minutes,
    case
      when v_limit_hours is null then null
      else greatest(v_limit_hours * 60 - v_booked_minutes, 0)
    end;
end;
$$;

revoke all on function public.get_booking_week_bounds(timestamptz) from public;
revoke all on function public.get_rider_weekly_booking_usage_minutes(uuid, uuid, timestamptz, uuid) from public;
revoke all on function public.assert_rider_weekly_booking_limit(uuid, uuid, timestamptz, timestamptz, uuid) from public;
revoke all on function public.get_rider_weekly_booking_quota(uuid, uuid, timestamptz) from public;

grant execute on function public.get_rider_weekly_booking_quota(uuid, uuid, timestamptz) to authenticated;

create or replace function public.accept_booking_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_request record;
  v_owner_id uuid;
begin
  select
    requests.id,
    requests.slot_id,
    requests.availability_rule_id,
    requests.horse_id,
    requests.rider_id,
    requests.status,
    requests.requested_start_at,
    requests.requested_end_at,
    requests.recurrence_rrule,
    rules.start_at as rule_start_at,
    rules.end_at as rule_end_at,
    rules.active as rule_active,
    coalesce(rules.is_trial_slot, false) as rule_is_trial_slot
  into v_request
  from public.booking_requests as requests
  join public.availability_rules as rules
    on rules.id = requests.availability_rule_id
  where requests.id = p_request_id;

  if not found then
    raise exception 'NOT_FOUND';
  end if;

  select horses.owner_id
  into v_owner_id
  from public.horses as horses
  where horses.id = v_request.horse_id;

  if v_owner_id is null then
    raise exception 'HORSE_NOT_FOUND';
  end if;

  if v_owner_id <> auth.uid() then
    raise exception 'NOT_ALLOWED';
  end if;

  if v_request.status <> 'requested' then
    raise exception 'INVALID_STATUS';
  end if;

  if v_request.requested_start_at is null or v_request.requested_end_at is null or v_request.requested_end_at <= v_request.requested_start_at then
    raise exception 'INVALID_RANGE';
  end if;

  if v_request.requested_start_at <= timezone('utc'::text, now()) then
    raise exception 'BOOKING_STARTED';
  end if;

  if v_request.rule_active is distinct from true then
    raise exception 'RULE_INACTIVE';
  end if;

  if v_request.requested_start_at < v_request.rule_start_at or v_request.requested_end_at > v_request.rule_end_at then
    raise exception 'OUTSIDE_RULE';
  end if;

  if not exists (
    select 1
    from public.approvals
    where approvals.horse_id = v_request.horse_id
      and approvals.rider_id = v_request.rider_id
      and approvals.status = 'approved'
  ) then
    raise exception 'NOT_APPROVED';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('weekly_booking_limit'),
    hashtext(v_request.horse_id::text || ':' || v_request.rider_id::text)
  );

  if exists (
    select 1
    from public.bookings
    where bookings.horse_id = v_request.horse_id
      and tstzrange(bookings.start_at, bookings.end_at, '[)') && tstzrange(v_request.requested_start_at, v_request.requested_end_at, '[)')
  ) then
    raise exception 'TIME_UNAVAILABLE';
  end if;

  if exists (
    select 1
    from public.calendar_blocks
    where calendar_blocks.horse_id = v_request.horse_id
      and tstzrange(calendar_blocks.start_at, calendar_blocks.end_at, '[)') && tstzrange(v_request.requested_start_at, v_request.requested_end_at, '[)')
  ) then
    raise exception 'TIME_UNAVAILABLE';
  end if;

  if exists (
    select 1
    from public.bookings
    where bookings.booking_request_id = v_request.id
  ) then
    raise exception 'ALREADY_BOOKED';
  end if;

  if v_request.recurrence_rrule is null and v_request.rule_is_trial_slot is false then
    perform public.assert_rider_weekly_booking_limit(
      v_request.horse_id,
      v_request.rider_id,
      v_request.requested_start_at,
      v_request.requested_end_at,
      null
    );
  end if;

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
    v_request.id,
    v_request.availability_rule_id,
    v_request.slot_id,
    v_request.horse_id,
    v_request.rider_id,
    v_request.requested_start_at,
    v_request.requested_end_at
  );

  update public.booking_requests
  set status = 'accepted'
  where id = v_request.id;
exception
  when exclusion_violation then
    raise exception 'TIME_UNAVAILABLE';
  when unique_violation then
    raise exception 'ALREADY_BOOKED';
end;
$$;

create or replace function public.direct_book_operational_slot(
  p_horse_id uuid,
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
  v_rule record;
  v_request_id uuid;
begin
  if auth.uid() is null then
    raise exception 'NOT_APPROVED';
  end if;

  select
    rules.id,
    rules.horse_id,
    rules.slot_id,
    rules.start_at,
    rules.end_at,
    rules.active,
    coalesce(rules.is_trial_slot, false) as is_trial_slot
  into v_rule
  from public.availability_rules as rules
  where rules.id = p_rule_id
    and rules.horse_id = p_horse_id;

  if not found or v_rule.active is distinct from true then
    raise exception 'RULE_INACTIVE';
  end if;

  if v_rule.is_trial_slot then
    raise exception 'TRIAL_RULE';
  end if;

  if p_start_at is null or p_end_at is null or p_end_at <= p_start_at then
    raise exception 'INVALID_RANGE';
  end if;

  if p_start_at <= timezone('utc'::text, now()) then
    raise exception 'BOOKING_STARTED';
  end if;

  if p_start_at < v_rule.start_at or p_end_at > v_rule.end_at then
    raise exception 'OUTSIDE_RULE';
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

  perform pg_advisory_xact_lock(
    hashtext('weekly_booking_limit'),
    hashtext(p_horse_id::text || ':' || auth.uid()::text)
  );

  if exists (
    select 1
    from public.calendar_blocks
    where calendar_blocks.horse_id = p_horse_id
      and tstzrange(calendar_blocks.start_at, calendar_blocks.end_at, '[)') && tstzrange(p_start_at, p_end_at, '[)')
  ) then
    raise exception 'TIME_UNAVAILABLE';
  end if;

  perform public.assert_rider_weekly_booking_limit(
    p_horse_id,
    auth.uid(),
    p_start_at,
    p_end_at,
    null
  );

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
    p_rule_id,
    p_horse_id,
    auth.uid(),
    v_rule.slot_id,
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
    p_rule_id,
    v_rule.slot_id,
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

create or replace function public.cancel_operational_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_booking record;
  v_owner_id uuid;
begin
  select
    bookings.id,
    bookings.booking_request_id,
    bookings.horse_id,
    bookings.rider_id,
    bookings.start_at,
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

  if auth.uid() <> v_owner_id then
    if auth.uid() <> v_booking.rider_id then
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

  perform pg_advisory_xact_lock(
    hashtext('weekly_booking_limit'),
    hashtext(v_booking.horse_id::text || ':' || v_booking.rider_id::text)
  );

  delete from public.bookings
  where id = v_booking.id;

  update public.booking_requests
  set status = 'canceled'
  where id = v_booking.booking_request_id;
end;
$$;

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

  if p_start_at <= timezone('utc'::text, now()) then
    raise exception 'TARGET_IN_PAST';
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

  if v_booking.start_at = p_start_at and v_booking.end_at = p_end_at then
    raise exception 'SAME_SLOT';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('weekly_booking_limit'),
    hashtext(v_booking.horse_id::text || ':' || v_booking.rider_id::text)
  );

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

  perform public.assert_rider_weekly_booking_limit(
    v_booking.horse_id,
    v_booking.rider_id,
    p_start_at,
    p_end_at,
    v_booking.id
  );

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
