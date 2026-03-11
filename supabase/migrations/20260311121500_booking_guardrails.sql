create extension if not exists btree_gist;

drop policy if exists "Owner loescht Buchungen" on public.bookings;
create policy "Owner loescht Buchungen"
  on public.bookings
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.horses
      where horses.id = bookings.horse_id
        and horses.owner_id = auth.uid()
    )
  );

alter table public.bookings
  drop constraint if exists bookings_horse_time_no_overlap;

alter table public.bookings
  add constraint bookings_horse_time_no_overlap
  exclude using gist (
    horse_id with =,
    tstzrange(start_at, end_at, '[)') with &&
  );

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
    rules.start_at as rule_start_at,
    rules.end_at as rule_end_at,
    rules.active as rule_active
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

revoke all on function public.direct_book_operational_slot(uuid, uuid, timestamptz, timestamptz) from public;
grant execute on function public.direct_book_operational_slot(uuid, uuid, timestamptz, timestamptz) to authenticated;
