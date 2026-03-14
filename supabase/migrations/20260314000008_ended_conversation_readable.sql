-- Correct conversation visibility for 'ended' relationships.
--
-- Decision: Option B — after 'ended' the conversation is historically readable
-- but closed for new messages (enforced in the application layer via isClosed prop).
--
-- Migration 20260314000006 set 'ended' → false (hidden), matching 'revoked'.
-- This migration corrects that: 'ended' → true (visible, read-only in app).
--
-- 'revoked' remains hidden: the owner forcefully removed the rider, no shared
-- history visibility is appropriate.
-- 'ended' is consensual: both parties agreed to close, the conversation history
-- belongs to both and stays readable.

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

  -- Consensual end: conversation remains visible (read-only enforced in app layer)
  if v_approval_status = 'ended' then
    return true;
  end if;

  -- Force-removed or rejected: conversation hidden
  if v_approval_status in ('rejected', 'revoked') then
    return false;
  end if;

  -- No approval decision yet — show if trial is in active lifecycle
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
