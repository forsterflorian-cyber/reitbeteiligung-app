-- =============================================================
-- calendar_blocks_no_overlap
--
-- Enforces at the DB level that no two calendar_blocks for the
-- same horse may have overlapping time ranges.
--
-- Uses an EXCLUSION CONSTRAINT with a GiST index so the
-- guarantee is atomic and cannot be bypassed by any write path.
-- =============================================================


-- btree_gist is required to use uuid equality (=) inside a
-- GiST exclusion constraint together with range overlap (&&).
create extension if not exists btree_gist;


-- Pre-flight: abort loudly if existing data already violates
-- the invariant. We never auto-correct data.
do $$
begin
  if exists (
    select 1
    from public.calendar_blocks a
    join public.calendar_blocks b
      on  a.horse_id = b.horse_id
      and a.id       < b.id
      and tstzrange(a.start_at, a.end_at) && tstzrange(b.start_at, b.end_at)
  ) then
    raise exception
      'MIGRATION_ABORTED: overlapping calendar_blocks exist. '
      'Remove or adjust conflicting rows before applying this constraint.';
  end if;
end;
$$;


-- Exclusion constraint: same horse_id + overlapping tstzrange → rejected.
alter table public.calendar_blocks
  add constraint calendar_blocks_no_overlap
  exclude using gist (
    horse_id      with =,
    tstzrange(start_at, end_at) with &&
  );


-- =============================================================
-- create_calendar_block_for_horse  (updated)
--
-- Identical to the previous version except that it catches
-- exclusion_violation (SQLSTATE 23P01) from the INSERT and
-- re-raises it as the domain error BLOCK_OVERLAP.
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

  -- Insert block — exclusion constraint fires here on overlap
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

exception
  when exclusion_violation then
    raise exception 'BLOCK_OVERLAP';
end;
$$;

revoke all on function public.create_calendar_block_for_horse(uuid, timestamptz, timestamptz, text) from public;
grant execute on function public.create_calendar_block_for_horse(uuid, timestamptz, timestamptz, text) to authenticated;
