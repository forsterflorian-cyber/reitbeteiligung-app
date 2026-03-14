-- Approval "ended" status
--
-- Adds a consensual end flow separate from the existing "revoked" (force-remove) flow:
--
--   revoked  — Owner forcefully removes rider; future bookings cleaned up automatically.
--   ended    — Either party ends the relationship orderly; future bookings must be
--              canceled by the user first (hard blocker, no auto-cleanup).
--
-- New columns:
--   ended_at  timestamptz — when the relationship was ended (null unless status='ended')
--   ended_by  text        — who initiated the end: 'rider' | 'owner'
--
-- Consistency constraint:
--   ended_at / ended_by must both be set iff status = 'ended'.

-- ============================================================
-- Status check constraint — add 'ended'
-- ============================================================

alter table public.approvals
  drop constraint if exists approvals_status_check;

alter table public.approvals
  add constraint approvals_status_check
  check (
    status = any (
      array[
        'approved'::text,
        'rejected'::text,
        'revoked'::text,
        'ended'::text
      ]
    )
  );

-- ============================================================
-- New columns
-- ============================================================

alter table public.approvals
  add column if not exists ended_at  timestamptz default null,
  add column if not exists ended_by  text        default null;

alter table public.approvals
  drop constraint if exists approvals_ended_by_check;

alter table public.approvals
  add constraint approvals_ended_by_check
  check (ended_by is null or ended_by in ('rider', 'owner'));

-- Consistency: ended_at and ended_by must be set together with status='ended'
alter table public.approvals
  drop constraint if exists approvals_ended_fields_consistency;

alter table public.approvals
  add constraint approvals_ended_fields_consistency
  check (
    (status = 'ended' and ended_at is not null and ended_by is not null)
    or
    (status <> 'ended' and ended_at is null and ended_by is null)
  );

-- ============================================================
-- Update is_relationship_conversation_visible
-- 'ended' closes the conversation, same as 'revoked'
-- ============================================================

create or replace function public.is_relationship_conversation_visible(p_horse_id uuid, p_rider_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_approval_status text;
  v_trial_status text;
begin
  select approvals.status
  into v_approval_status
  from public.approvals
  where approvals.horse_id = p_horse_id
    and approvals.rider_id = p_rider_id;

  if v_approval_status = 'approved' then
    return true;
  end if;

  if v_approval_status in ('rejected', 'revoked', 'ended') then
    return false;
  end if;

  select trial_requests.status
  into v_trial_status
  from public.trial_requests
  where trial_requests.horse_id = p_horse_id
    and trial_requests.rider_id = p_rider_id
  order by trial_requests.created_at desc
  limit 1;

  return v_trial_status in ('requested', 'accepted', 'completed');
end;
$$;

revoke all on function public.is_relationship_conversation_visible(uuid, uuid) from public;
grant execute on function public.is_relationship_conversation_visible(uuid, uuid) to authenticated;
