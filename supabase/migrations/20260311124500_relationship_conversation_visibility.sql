create or replace function public.is_relationship_conversation_visible(
  p_horse_id uuid,
  p_rider_id uuid
)
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

  if v_approval_status = 'revoked' then
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

drop policy if exists "Teilnehmer lesen Gespraeche" on public.conversations;
create policy "Teilnehmer lesen Gespraeche"
  on public.conversations
  for select
  to authenticated
  using (
    (auth.uid() = rider_id or auth.uid() = owner_id)
    and public.is_relationship_conversation_visible(horse_id, rider_id)
  );

drop policy if exists "Teilnehmer erstellen Gespraeche" on public.conversations;
create policy "Teilnehmer erstellen Gespraeche"
  on public.conversations
  for insert
  to authenticated
  with check (
    (auth.uid() = rider_id or auth.uid() = owner_id)
    and public.is_relationship_conversation_visible(horse_id, rider_id)
  );

drop policy if exists "Teilnehmer lesen Nachrichten" on public.messages;
create policy "Teilnehmer lesen Nachrichten"
  on public.messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.conversations
      where conversations.id = messages.conversation_id
        and (conversations.rider_id = auth.uid() or conversations.owner_id = auth.uid())
        and public.is_relationship_conversation_visible(conversations.horse_id, conversations.rider_id)
    )
  );

drop policy if exists "Teilnehmer schreiben Nachrichten" on public.messages;
create policy "Teilnehmer schreiben Nachrichten"
  on public.messages
  for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.conversations
      where conversations.id = messages.conversation_id
        and (conversations.rider_id = auth.uid() or conversations.owner_id = auth.uid())
        and public.is_relationship_conversation_visible(conversations.horse_id, conversations.rider_id)
    )
  );

drop function if exists public.mark_conversation_read(uuid);
create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  update public.conversations
  set rider_last_read_at = case when auth.uid() = rider_id then timezone('utc'::text, now()) else rider_last_read_at end,
      owner_last_read_at = case when auth.uid() = owner_id then timezone('utc'::text, now()) else owner_last_read_at end
  where id = p_conversation_id
    and auth.uid() in (rider_id, owner_id)
    and public.is_relationship_conversation_visible(horse_id, rider_id);
end;
$$;

revoke all on function public.mark_conversation_read(uuid) from public;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

drop function if exists public.get_conversation_contact_info(uuid);
create or replace function public.get_conversation_contact_info(p_conversation_id uuid)
returns table (
  partner_name text,
  partner_email text,
  partner_phone text
)
language sql
security definer
set search_path = public, auth
as $$
  with scoped as (
    select
      conversations.horse_id,
      conversations.rider_id,
      case
        when auth.uid() = conversations.rider_id then conversations.owner_id
        else conversations.rider_id
      end as partner_id
    from public.conversations
    where conversations.id = p_conversation_id
      and auth.uid() in (conversations.rider_id, conversations.owner_id)
      and public.is_relationship_conversation_visible(conversations.horse_id, conversations.rider_id)
  ), approval_state as (
    select
      scoped.partner_id,
      exists (
        select 1
        from public.approvals
        where approvals.horse_id = scoped.horse_id
          and approvals.rider_id = scoped.rider_id
          and approvals.status = 'approved'
      ) as is_approved
    from scoped
  )
  select
    coalesce(nullif(partner_profile.display_name, ''), nullif(split_part(auth_user.email, '@', 1), ''), 'Unbekannt')::text as partner_name,
    case when approval_state.is_approved then nullif(auth_user.email, '')::text else null end as partner_email,
    case when approval_state.is_approved then nullif(partner_profile.phone, '')::text else null end as partner_phone
  from scoped
  join approval_state on approval_state.partner_id = scoped.partner_id
  left join public.profiles as partner_profile on partner_profile.id = scoped.partner_id
  left join auth.users as auth_user on auth_user.id = scoped.partner_id;
$$;

grant execute on function public.get_conversation_contact_info(uuid) to authenticated;
