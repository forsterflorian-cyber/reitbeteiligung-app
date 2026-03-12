create index if not exists trial_requests_rider_created_at_idx
  on public.trial_requests (rider_id, created_at desc);

create index if not exists trial_requests_horse_rider_created_at_idx
  on public.trial_requests (horse_id, rider_id, created_at desc);

create index if not exists booking_requests_horse_created_at_idx
  on public.booking_requests (horse_id, created_at desc);

create index if not exists booking_requests_horse_rider_created_at_idx
  on public.booking_requests (horse_id, rider_id, created_at desc);

create index if not exists bookings_rider_start_at_idx
  on public.bookings (rider_id, start_at);

create index if not exists approvals_horse_rider_status_idx
  on public.approvals (horse_id, rider_id, status);

create or replace function public.get_conversation_summaries(p_conversation_ids uuid[])
returns table (
  conversation_id uuid,
  partner_name text,
  partner_email text,
  partner_phone text,
  latest_message_id uuid,
  latest_message_sender_id uuid,
  latest_message_content text,
  latest_message_created_at timestamptz
)
language sql
security definer
set search_path = public, auth
as $$
  with scoped as (
    select
      conversations.id as conversation_id,
      conversations.horse_id,
      conversations.rider_id,
      case
        when auth.uid() = conversations.rider_id then conversations.owner_id
        else conversations.rider_id
      end as partner_id
    from public.conversations
    where conversations.id = any(p_conversation_ids)
      and auth.uid() in (conversations.rider_id, conversations.owner_id)
      and public.is_relationship_conversation_visible(conversations.horse_id, conversations.rider_id)
  ), approval_state as (
    select
      scoped.conversation_id,
      scoped.partner_id,
      exists (
        select 1
        from public.approvals
        where approvals.horse_id = scoped.horse_id
          and approvals.rider_id = scoped.rider_id
          and approvals.status = 'approved'
      ) as is_approved
    from scoped
  ), latest_messages as (
    select distinct on (messages.conversation_id)
      messages.conversation_id,
      messages.id,
      messages.sender_id,
      messages.content,
      messages.created_at
    from public.messages as messages
    join scoped
      on scoped.conversation_id = messages.conversation_id
    order by messages.conversation_id, messages.created_at desc, messages.id desc
  )
  select
    scoped.conversation_id,
    coalesce(nullif(partner_profile.display_name, ''), nullif(split_part(auth_user.email, '@', 1), ''), 'Unbekannt')::text as partner_name,
    case when approval_state.is_approved then nullif(auth_user.email, '')::text else null end as partner_email,
    case when approval_state.is_approved then nullif(partner_profile.phone, '')::text else null end as partner_phone,
    latest_messages.id as latest_message_id,
    latest_messages.sender_id as latest_message_sender_id,
    latest_messages.content as latest_message_content,
    latest_messages.created_at as latest_message_created_at
  from scoped
  join approval_state
    on approval_state.conversation_id = scoped.conversation_id
    and approval_state.partner_id = scoped.partner_id
  left join public.profiles as partner_profile
    on partner_profile.id = scoped.partner_id
  left join auth.users as auth_user
    on auth_user.id = scoped.partner_id
  left join latest_messages
    on latest_messages.conversation_id = scoped.conversation_id;
$$;

revoke all on function public.get_conversation_summaries(uuid[]) from public;
grant execute on function public.get_conversation_summaries(uuid[]) to authenticated;

create or replace function public.get_latest_horse_group_messages(p_horse_ids uuid[])
returns table (
  id uuid,
  horse_id uuid,
  sender_id uuid,
  content text,
  created_at timestamptz
)
language sql
security invoker
stable
set search_path = public, auth
as $$
  select distinct on (messages.horse_id)
    messages.id,
    messages.horse_id,
    messages.sender_id,
    messages.content,
    messages.created_at
  from public.horse_group_messages as messages
  where messages.horse_id = any(p_horse_ids)
  order by messages.horse_id, messages.created_at desc, messages.id desc;
$$;

revoke all on function public.get_latest_horse_group_messages(uuid[]) from public;
grant execute on function public.get_latest_horse_group_messages(uuid[]) to authenticated;
