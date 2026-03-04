create table if not exists public.horse_group_messages (
  id uuid primary key default gen_random_uuid(),
  horse_id uuid not null references public.horses(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(trim(content)) > 0),
  created_at timestamptz not null default now()
);

alter table public.horse_group_messages enable row level security;

create index if not exists horse_group_messages_horse_id_created_at_idx
  on public.horse_group_messages (horse_id, created_at desc);

revoke all on public.horse_group_messages from anon, authenticated;
grant select, insert on public.horse_group_messages to authenticated;

drop policy if exists "horse_group_messages_select" on public.horse_group_messages;
create policy "horse_group_messages_select"
  on public.horse_group_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.horses h
      where h.id = horse_group_messages.horse_id
        and h.owner_id = auth.uid()
    )
    or exists (
      select 1
      from public.approvals a
      where a.horse_id = horse_group_messages.horse_id
        and a.rider_id = auth.uid()
        and a.status = 'approved'
    )
  );

drop policy if exists "horse_group_messages_insert" on public.horse_group_messages;
create policy "horse_group_messages_insert"
  on public.horse_group_messages
  for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and (
      exists (
        select 1
        from public.horses h
        where h.id = horse_group_messages.horse_id
          and h.owner_id = auth.uid()
      )
      or exists (
        select 1
        from public.approvals a
        where a.horse_id = horse_group_messages.horse_id
          and a.rider_id = auth.uid()
          and a.status = 'approved'
      )
    )
  );
