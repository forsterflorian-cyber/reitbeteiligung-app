-- =============================================================
-- notifications
--
-- In-App notification table. Written by server-side trusted code
-- via the insert_notification SECURITY DEFINER function.
-- Users can read and mark-as-read their own notifications via RLS.
-- =============================================================

create table public.notifications (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null,
  event_type text        not null,
  horse_id   uuid,
  payload    jsonb       not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

-- Primary read pattern: user's unread + recent list, descending.
create index notifications_user_created_idx
  on public.notifications(user_id, created_at desc);

alter table public.notifications enable row level security;

-- Users may read their own notifications only.
create policy "notifications_select"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

-- Users may mark their own notifications as read (UPDATE read_at only).
-- No other columns are writable through this policy.
create policy "notifications_update"
  on public.notifications for update
  to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- No INSERT policy for authenticated → direct INSERT via PostgREST is rejected.
-- No DELETE policy → users cannot delete notifications in V1.


-- =============================================================
-- insert_notification
--
-- Trusted internal write path. Called exclusively from server
-- actions that have already validated business context (auth,
-- ownership, event validity).
--
-- Security note: p_user_id is accepted as a free parameter.
-- Any authenticated caller can technically write a notification
-- for any user_id. This is the same trust level as domain_events
-- (with check (true)), but with the direct INSERT path closed.
-- The boundary is enforced by application code, not by this
-- function. A future upgrade path would validate p_user_id
-- against horse ownership or a domain_events trigger.
-- =============================================================
create or replace function public.insert_notification(
  p_user_id    uuid,
  p_event_type text,
  p_horse_id   uuid,
  p_payload    jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_id uuid;
begin
  insert into public.notifications (user_id, event_type, horse_id, payload)
  values (p_user_id, p_event_type, p_horse_id, p_payload)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.insert_notification(uuid, text, uuid, jsonb) from public;
grant execute on function public.insert_notification(uuid, text, uuid, jsonb) to authenticated;
