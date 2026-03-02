create table if not exists public.calendar_blocks (
  id uuid primary key default gen_random_uuid(),
  horse_id uuid not null references public.horses (id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint calendar_blocks_time_check check (end_at > start_at)
);

create index if not exists calendar_blocks_horse_id_start_at_idx
  on public.calendar_blocks (horse_id, start_at);

alter table public.calendar_blocks enable row level security;

drop policy if exists "Jeder liest Kalender-Sperren" on public.calendar_blocks;
create policy "Jeder liest Kalender-Sperren"
  on public.calendar_blocks
  for select
  to public
  using (true);

drop policy if exists "Owner erstellt Kalender-Sperren" on public.calendar_blocks;
create policy "Owner erstellt Kalender-Sperren"
  on public.calendar_blocks
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.horses
      where horses.id = calendar_blocks.horse_id
        and horses.owner_id = auth.uid()
    )
  );

drop policy if exists "Owner loescht Kalender-Sperren" on public.calendar_blocks;
create policy "Owner loescht Kalender-Sperren"
  on public.calendar_blocks
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.horses
      where horses.id = calendar_blocks.horse_id
        and horses.owner_id = auth.uid()
    )
  );

create or replace function public.get_horse_calendar_occupancy(p_horse_id uuid)
returns table (
  source text,
  start_at timestamptz,
  end_at timestamptz
)
language sql
security definer
set search_path = public, auth
as $$
  select
    'booking'::text as source,
    slots.start_at,
    slots.end_at
  from public.booking_requests as requests
  join public.availability_slots as slots
    on slots.id = requests.slot_id
  where requests.horse_id = p_horse_id
    and requests.status = 'accepted'

  union all

  select
    'block'::text as source,
    blocks.start_at,
    blocks.end_at
  from public.calendar_blocks as blocks
  where blocks.horse_id = p_horse_id
$$;

grant execute on function public.get_horse_calendar_occupancy(uuid) to anon, authenticated;