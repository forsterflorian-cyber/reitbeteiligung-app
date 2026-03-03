create table if not exists public.rider_booking_limits (
  horse_id uuid not null references public.horses(id) on delete cascade,
  rider_id uuid not null references public.profiles(id) on delete cascade,
  weekly_hours_limit integer not null check (weekly_hours_limit between 1 and 40),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (horse_id, rider_id)
);

alter table public.rider_booking_limits enable row level security;

drop policy if exists rider_booking_limits_owner_select on public.rider_booking_limits;
create policy rider_booking_limits_owner_select
on public.rider_booking_limits
for select
using (
  exists (
    select 1
    from public.horses
    where horses.id = rider_booking_limits.horse_id
      and horses.owner_id = auth.uid()
  )
);

drop policy if exists rider_booking_limits_owner_insert on public.rider_booking_limits;
create policy rider_booking_limits_owner_insert
on public.rider_booking_limits
for insert
with check (
  exists (
    select 1
    from public.horses
    where horses.id = rider_booking_limits.horse_id
      and horses.owner_id = auth.uid()
  )
);

drop policy if exists rider_booking_limits_owner_update on public.rider_booking_limits;
create policy rider_booking_limits_owner_update
on public.rider_booking_limits
for update
using (
  exists (
    select 1
    from public.horses
    where horses.id = rider_booking_limits.horse_id
      and horses.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.horses
    where horses.id = rider_booking_limits.horse_id
      and horses.owner_id = auth.uid()
  )
);

drop policy if exists rider_booking_limits_owner_delete on public.rider_booking_limits;
create policy rider_booking_limits_owner_delete
on public.rider_booking_limits
for delete
using (
  exists (
    select 1
    from public.horses
    where horses.id = rider_booking_limits.horse_id
      and horses.owner_id = auth.uid()
  )
);

drop policy if exists rider_booking_limits_rider_select on public.rider_booking_limits;
create policy rider_booking_limits_rider_select
on public.rider_booking_limits
for select
using (rider_id = auth.uid());
