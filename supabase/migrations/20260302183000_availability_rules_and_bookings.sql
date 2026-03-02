alter table public.availability_slots enable row level security;

drop policy if exists "Jeder liest Verfuegbarkeitsfenster" on public.availability_slots;
create policy "Jeder liest Verfuegbarkeitsfenster"
  on public.availability_slots
  for select
  to public
  using (true);

drop policy if exists "Owner erstellt Verfuegbarkeitsfenster" on public.availability_slots;
create policy "Owner erstellt Verfuegbarkeitsfenster"
  on public.availability_slots
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.horses
      where horses.id = availability_slots.horse_id
        and horses.owner_id = auth.uid()
    )
  );

drop policy if exists "Owner bearbeitet Verfuegbarkeitsfenster" on public.availability_slots;
create policy "Owner bearbeitet Verfuegbarkeitsfenster"
  on public.availability_slots
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.horses
      where horses.id = availability_slots.horse_id
        and horses.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.horses
      where horses.id = availability_slots.horse_id
        and horses.owner_id = auth.uid()
    )
  );

drop policy if exists "Owner loescht Verfuegbarkeitsfenster" on public.availability_slots;
create policy "Owner loescht Verfuegbarkeitsfenster"
  on public.availability_slots
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.horses
      where horses.id = availability_slots.horse_id
        and horses.owner_id = auth.uid()
    )
  );

create table if not exists public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  horse_id uuid not null references public.horses (id) on delete cascade,
  slot_id uuid not null unique references public.availability_slots (id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint availability_rules_time_check check (end_at > start_at)
);

create index if not exists availability_rules_horse_id_start_at_idx
  on public.availability_rules (horse_id, start_at);

alter table public.availability_rules enable row level security;

drop policy if exists "Jeder liest Verfuegbarkeitsregeln" on public.availability_rules;
create policy "Jeder liest Verfuegbarkeitsregeln"
  on public.availability_rules
  for select
  to public
  using (true);

drop policy if exists "Owner erstellt Verfuegbarkeitsregeln" on public.availability_rules;
create policy "Owner erstellt Verfuegbarkeitsregeln"
  on public.availability_rules
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.horses
      where horses.id = availability_rules.horse_id
        and horses.owner_id = auth.uid()
    )
  );

drop policy if exists "Owner bearbeitet Verfuegbarkeitsregeln" on public.availability_rules;
create policy "Owner bearbeitet Verfuegbarkeitsregeln"
  on public.availability_rules
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.horses
      where horses.id = availability_rules.horse_id
        and horses.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.horses
      where horses.id = availability_rules.horse_id
        and horses.owner_id = auth.uid()
    )
  );

drop policy if exists "Owner loescht Verfuegbarkeitsregeln" on public.availability_rules;
create policy "Owner loescht Verfuegbarkeitsregeln"
  on public.availability_rules
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.horses
      where horses.id = availability_rules.horse_id
        and horses.owner_id = auth.uid()
    )
  );

alter table public.booking_requests add column if not exists availability_rule_id uuid;
alter table public.booking_requests add column if not exists requested_start_at timestamptz;
alter table public.booking_requests add column if not exists requested_end_at timestamptz;

alter table public.booking_requests drop constraint if exists booking_requests_availability_rule_id_fkey;
alter table public.booking_requests
  add constraint booking_requests_availability_rule_id_fkey
  foreign key (availability_rule_id) references public.availability_rules (id) on delete cascade;

alter table public.booking_requests enable row level security;

drop policy if exists "Teilnehmer lesen Buchungsanfragen" on public.booking_requests;
create policy "Teilnehmer lesen Buchungsanfragen"
  on public.booking_requests
  for select
  to authenticated
  using (
    auth.uid() = rider_id
    or exists (
      select 1
      from public.horses
      where horses.id = booking_requests.horse_id
        and horses.owner_id = auth.uid()
    )
  );

drop policy if exists "Freigeschalteter Reiter erstellt Buchungsanfragen" on public.booking_requests;
create policy "Freigeschalteter Reiter erstellt Buchungsanfragen"
  on public.booking_requests
  for insert
  to authenticated
  with check (
    auth.uid() = rider_id
    and status = 'requested'
    and requested_start_at is not null
    and requested_end_at is not null
    and requested_end_at > requested_start_at
    and exists (
      select 1
      from public.approvals
      where approvals.horse_id = booking_requests.horse_id
        and approvals.rider_id = booking_requests.rider_id
        and approvals.status = 'approved'
    )
    and exists (
      select 1
      from public.availability_rules
      where availability_rules.id = booking_requests.availability_rule_id
        and availability_rules.slot_id = booking_requests.slot_id
        and availability_rules.horse_id = booking_requests.horse_id
        and availability_rules.active = true
        and booking_requests.requested_start_at >= availability_rules.start_at
        and booking_requests.requested_end_at <= availability_rules.end_at
    )
  );

drop policy if exists "Owner bearbeitet Buchungsanfragen" on public.booking_requests;
create policy "Owner bearbeitet Buchungsanfragen"
  on public.booking_requests
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.horses
      where horses.id = booking_requests.horse_id
        and horses.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.horses
      where horses.id = booking_requests.horse_id
        and horses.owner_id = auth.uid()
    )
  );

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_request_id uuid not null unique references public.booking_requests (id) on delete cascade,
  availability_rule_id uuid not null references public.availability_rules (id) on delete cascade,
  slot_id uuid not null references public.availability_slots (id) on delete cascade,
  horse_id uuid not null references public.horses (id) on delete cascade,
  rider_id uuid not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint bookings_time_check check (end_at > start_at)
);

create index if not exists bookings_horse_id_start_at_idx
  on public.bookings (horse_id, start_at);

alter table public.bookings enable row level security;

drop policy if exists "Teilnehmer lesen Buchungen" on public.bookings;
create policy "Teilnehmer lesen Buchungen"
  on public.bookings
  for select
  to authenticated
  using (
    auth.uid() = rider_id
    or exists (
      select 1
      from public.horses
      where horses.id = bookings.horse_id
        and horses.owner_id = auth.uid()
    )
  );

drop policy if exists "Owner erstellt Buchungen" on public.bookings;
create policy "Owner erstellt Buchungen"
  on public.bookings
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.horses
      where horses.id = bookings.horse_id
        and horses.owner_id = auth.uid()
    )
  );

create or replace function public.get_horse_calendar_occupancy(p_horse_id uuid)
returns table (
  source text,
  start_at timestamptz,
  end_at timestamptz
)
language sql
security definer
set search_path = public, auth
as $$
  select
    'booking'::text as source,
    bookings.start_at,
    bookings.end_at
  from public.bookings as bookings
  where bookings.horse_id = p_horse_id

  union all

  select
    'block'::text as source,
    blocks.start_at,
    blocks.end_at
  from public.calendar_blocks as blocks
  where blocks.horse_id = p_horse_id
$$;

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
end;
$$;

grant execute on function public.get_horse_calendar_occupancy(uuid) to anon, authenticated;
grant execute on function public.accept_booking_request(uuid) to authenticated;