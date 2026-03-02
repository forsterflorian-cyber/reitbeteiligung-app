create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  horse_id uuid not null references public.horses (id) on delete cascade,
  rider_id uuid not null references public.profiles (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists conversations_horse_rider_owner_key
  on public.conversations (horse_id, rider_id, owner_id);

create index if not exists conversations_rider_id_idx
  on public.conversations (rider_id);

create index if not exists conversations_owner_id_idx
  on public.conversations (owner_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists messages_conversation_created_at_idx
  on public.messages (conversation_id, created_at);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Teilnehmer lesen Gespraeche" on public.conversations;
create policy "Teilnehmer lesen Gespraeche"
  on public.conversations
  for select
  to authenticated
  using (auth.uid() = rider_id or auth.uid() = owner_id);

drop policy if exists "Teilnehmer erstellen Gespraeche" on public.conversations;
create policy "Teilnehmer erstellen Gespraeche"
  on public.conversations
  for insert
  to authenticated
  with check (auth.uid() = rider_id or auth.uid() = owner_id);

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
    )
  );

create or replace function public.get_conversation_contact_info(p_conversation_id uuid)
returns table (
  partner_email text,
  partner_phone text
)
language sql
security definer
set search_path = public, auth
as $$
  select
    nullif(other_user.email, '')::text as partner_email,
    nullif(other_user.phone, '')::text as partner_phone
  from public.conversations
  join auth.users as other_user
    on other_user.id = case
      when auth.uid() = conversations.rider_id then conversations.owner_id
      else conversations.rider_id
    end
  where conversations.id = p_conversation_id
    and auth.uid() in (conversations.rider_id, conversations.owner_id);
$$;

grant execute on function public.get_conversation_contact_info(uuid) to authenticated;
