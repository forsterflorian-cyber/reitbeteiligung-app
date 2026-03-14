-- Account deletion with safety guards
--
-- Two security-definer functions validate blockers and then hard-delete
-- from auth.users, which cascades through profiles and all dependent rows.
--
-- Blocker semantics (conservative / beta-safe):
--
--   Rider:
--     ACTIVE_APPROVALS  - at least one approved Reitbeteiligung still active
--     FUTURE_BOOKINGS   - at least one booking with start_at > now()
--     PENDING_REQUESTS  - at least one trial_request in status pending/accepted
--
--   Owner:
--     ACTIVE_HORSES     - at least one horse with active = true
--     ACTIVE_APPROVALS  - at least one approved Reitbeteiligung on any of owner's horses
--     FUTURE_BOOKINGS   - at least one booking in the future on any of owner's horses
--
-- Caller receives a PostgreSQL exception with one of the codes above
-- if deletion is blocked. On success the function returns void and the
-- auth.users row (+ all cascaded rows) is gone.

-- ============================================================
-- Rider account deletion
-- ============================================================

create or replace function public.delete_rider_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid  uuid := auth.uid();
  v_cnt  int;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  -- Active Reitbeteiligungen
  select count(*) into v_cnt
  from public.approvals
  where rider_id = v_uid and status = 'approved';

  if v_cnt > 0 then
    raise exception 'ACTIVE_APPROVALS';
  end if;

  -- Future bookings
  select count(*) into v_cnt
  from public.bookings
  where rider_id = v_uid
    and start_at > timezone('utc', now());

  if v_cnt > 0 then
    raise exception 'FUTURE_BOOKINGS';
  end if;

  -- Open trial requests
  select count(*) into v_cnt
  from public.trial_requests
  where rider_id = v_uid
    and status in ('pending', 'accepted');

  if v_cnt > 0 then
    raise exception 'PENDING_REQUESTS';
  end if;

  -- All clear: delete auth user, cascades through profiles → related rows
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_rider_account() from public;
grant execute on function public.delete_rider_account() to authenticated;

-- ============================================================
-- Owner account deletion
-- ============================================================

create or replace function public.delete_owner_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid  uuid := auth.uid();
  v_cnt  int;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  -- Active horses (must be fully deactivated before deletion)
  select count(*) into v_cnt
  from public.horses
  where owner_id = v_uid and active = true;

  if v_cnt > 0 then
    raise exception 'ACTIVE_HORSES';
  end if;

  -- Active Reitbeteiligungen on any of the owner's horses
  select count(*) into v_cnt
  from public.approvals a
  join public.horses h on h.id = a.horse_id
  where h.owner_id = v_uid and a.status = 'approved';

  if v_cnt > 0 then
    raise exception 'ACTIVE_APPROVALS';
  end if;

  -- Future bookings on any of the owner's horses
  select count(*) into v_cnt
  from public.bookings b
  join public.horses h on h.id = b.horse_id
  where h.owner_id = v_uid
    and b.start_at > timezone('utc', now());

  if v_cnt > 0 then
    raise exception 'FUTURE_BOOKINGS';
  end if;

  -- All clear: delete auth user, cascades through profiles + horses + their data
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_owner_account() from public;
grant execute on function public.delete_owner_account() to authenticated;
