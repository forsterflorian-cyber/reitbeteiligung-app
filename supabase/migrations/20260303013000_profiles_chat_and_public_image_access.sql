alter table public.profiles
  add column if not exists display_name text,
  add column if not exists phone text;

update public.profiles
set display_name = coalesce(
  nullif(display_name, ''),
  nullif(split_part(auth_users.email, '@', 1), '')
)
from auth.users as auth_users
where auth_users.id = profiles.id
  and (profiles.display_name is null or profiles.display_name = '');

alter table public.profiles enable row level security;

drop policy if exists "Nutzer lesen eigenes Profil" on public.profiles;
create policy "Nutzer lesen eigenes Profil"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Nutzer erstellen eigenes Profil" on public.profiles;
create policy "Nutzer erstellen eigenes Profil"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "Nutzer aktualisieren eigenes Profil" on public.profiles;
create policy "Nutzer aktualisieren eigenes Profil"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

alter table public.conversations
  add column if not exists rider_last_read_at timestamptz default timezone('utc'::text, now()),
  add column if not exists owner_last_read_at timestamptz default timezone('utc'::text, now());

update public.conversations
set rider_last_read_at = coalesce(rider_last_read_at, created_at),
    owner_last_read_at = coalesce(owner_last_read_at, created_at)
where rider_last_read_at is null
   or owner_last_read_at is null;

alter table public.conversations alter column rider_last_read_at set default timezone('utc'::text, now());
alter table public.conversations alter column owner_last_read_at set default timezone('utc'::text, now());

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
    and auth.uid() in (rider_id, owner_id);
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

alter table public.horse_images enable row level security;

drop policy if exists "Jeder liest Pferdebilder" on public.horse_images;
create policy "Jeder liest Pferdebilder"
  on public.horse_images
  for select
  to public
  using (
    exists (
      select 1
      from public.horses
      where horses.id = horse_images.horse_id
        and horses.active = true
    )
  );

drop policy if exists "Owner liest Pferdebilder" on public.horse_images;
create policy "Owner liest Pferdebilder"
  on public.horse_images
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.horses
      where horses.id = horse_images.horse_id
        and horses.owner_id = auth.uid()
    )
  );

drop policy if exists "Jeder liest horse-images" on storage.objects;
drop policy if exists "Owner liest horse-images" on storage.objects;

create policy "Jeder liest horse-images"
  on storage.objects
  for select
  to public
  using (
    bucket_id = 'horse-images'
    and split_part(name, '/', 1) = 'horses'
    and split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and exists (
      select 1
      from public.horses
      where horses.id = split_part(name, '/', 2)::uuid
        and horses.active = true
    )
  );

create policy "Owner liest horse-images"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'horse-images'
    and split_part(name, '/', 1) = 'horses'
    and split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and exists (
      select 1
      from public.horses
      where horses.id = split_part(name, '/', 2)::uuid
        and horses.owner_id = auth.uid()
    )
  );