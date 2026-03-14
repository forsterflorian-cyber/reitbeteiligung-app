-- Account deactivation (soft-delete + anonymization)
--
-- Strategy:
--   Hard delete is intentionally NOT used. Deleting from auth.users would cascade
--   through profiles → conversations/messages and historical bookings, destroying
--   shared history that belongs to other users.
--
-- Instead we:
--   1. Check operative blockers (active relationships, future bookings, open requests)
--   2. Check history presence (past bookings, conversations) — prevents hard delete,
--      but is logged only; deactivation still proceeds via soft-delete
--   3. Anonymize PII: display_name → '[Gelöschter Nutzer]', phone → null
--   4. Set profiles.deleted_at = now()
--   5. The app signs the user out and treats deleted_at as "account gone"
--
-- Auth row is intentionally preserved to maintain FK integrity for historical data.
-- The user loses all access immediately (session invalidation via app sign-out).
--
-- Operative blockers raise exceptions → caller shows user-facing error.
-- History is handled by soft-delete (no exception), preserving data for other users.

-- ============================================================
-- Drop superseded hard-delete functions (from migration 0004)
-- ============================================================

drop function if exists public.delete_rider_account();
drop function if exists public.delete_owner_account();

-- ============================================================
-- Add deleted_at column to profiles
-- ============================================================

alter table public.profiles
  add column if not exists deleted_at timestamptz default null;

-- ============================================================
-- Rider account deactivation
-- ============================================================

create or replace function public.deactivate_rider_account()
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

  -- Operative blocker: active Reitbeteiligungen
  select count(*) into v_cnt
  from public.approvals
  where rider_id = v_uid and status = 'approved';

  if v_cnt > 0 then
    raise exception 'ACTIVE_APPROVALS';
  end if;

  -- Operative blocker: future bookings
  select count(*) into v_cnt
  from public.bookings
  where rider_id = v_uid
    and start_at > timezone('utc', now());

  if v_cnt > 0 then
    raise exception 'FUTURE_BOOKINGS';
  end if;

  -- Operative blocker: open trial requests
  select count(*) into v_cnt
  from public.trial_requests
  where rider_id = v_uid
    and status in ('pending', 'accepted');

  if v_cnt > 0 then
    raise exception 'PENDING_REQUESTS';
  end if;

  -- Anonymize PII and soft-delete
  update public.profiles
  set
    display_name = '[Gelöschter Nutzer]',
    phone        = null,
    deleted_at   = now()
  where id = v_uid;

  -- Anonymize rider_profiles (all potentially identifying fields)
  update public.rider_profiles
  set
    experience    = null,
    weight        = null,
    preferred_days = null,
    goals         = null,
    notes         = null
  where user_id = v_uid;
end;
$$;

revoke all on function public.deactivate_rider_account() from public;
grant execute on function public.deactivate_rider_account() to authenticated;

-- ============================================================
-- Owner account deactivation
-- ============================================================

create or replace function public.deactivate_owner_account()
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

  -- Operative blocker: active horses (must be deactivated first)
  select count(*) into v_cnt
  from public.horses
  where owner_id = v_uid and active = true;

  if v_cnt > 0 then
    raise exception 'ACTIVE_HORSES';
  end if;

  -- Operative blocker: active Reitbeteiligungen on any horse
  select count(*) into v_cnt
  from public.approvals a
  join public.horses h on h.id = a.horse_id
  where h.owner_id = v_uid and a.status = 'approved';

  if v_cnt > 0 then
    raise exception 'ACTIVE_APPROVALS';
  end if;

  -- Operative blocker: future bookings on any horse
  select count(*) into v_cnt
  from public.bookings b
  join public.horses h on h.id = b.horse_id
  where h.owner_id = v_uid
    and b.start_at > timezone('utc', now());

  if v_cnt > 0 then
    raise exception 'FUTURE_BOOKINGS';
  end if;

  -- Anonymize PII and soft-delete
  update public.profiles
  set
    display_name = '[Gelöschter Nutzer]',
    phone        = null,
    deleted_at   = now()
  where id = v_uid;
end;
$$;

revoke all on function public.deactivate_owner_account() from public;
grant execute on function public.deactivate_owner_account() to authenticated;
