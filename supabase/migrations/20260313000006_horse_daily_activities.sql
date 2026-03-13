-- =============================================================
-- horse_daily_activities
--
-- Logs what actually happened with a horse on a given calendar day.
-- This is contextual information only — it does NOT affect
-- bookings, availability rules, blocks, or occupancy calculations.
--
-- Who can write: horse owner, riders with an active (approved)
--               relationship to the horse.
-- Who can read:  same set.
-- No hard deletes. Soft-correction via status = 'corrected'.
-- =============================================================

create table public.horse_daily_activities (
  id            uuid        primary key default gen_random_uuid(),
  horse_id      uuid        not null references public.horses(id),
  user_id       uuid        not null,
  activity_type text        not null check (activity_type in (
                              'ride', 'groundwork', 'hack', 'lunge',
                              'free_movement', 'care', 'other'
                            )),
  activity_date date        not null,
  activity_time time        null,
  comment       text        null,
  status        text        not null default 'active'
                            check (status in ('active', 'corrected')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Primary read pattern: all active entries for a horse on a given day.
create index horse_daily_activities_horse_date_idx
  on public.horse_daily_activities(horse_id, activity_date);

-- Secondary pattern: filter by status when showing only active entries.
create index horse_daily_activities_horse_date_status_idx
  on public.horse_daily_activities(horse_id, activity_date, status);

alter table public.horse_daily_activities enable row level security;

-- =============================================================
-- SELECT
-- Visible to the horse owner and any rider with an active
-- (approved) relationship to the horse.
-- =============================================================
create policy "horse_daily_activities_select"
  on public.horse_daily_activities for select
  to authenticated
  using (
    exists (
      select 1 from public.horses
      where horses.id = horse_daily_activities.horse_id
        and horses.owner_id = auth.uid()
    )
    or
    exists (
      select 1 from public.approvals
      where approvals.horse_id = horse_daily_activities.horse_id
        and approvals.rider_id = auth.uid()
        and approvals.status = 'approved'
    )
  );

-- =============================================================
-- INSERT
-- Caller must be the owner or an approved rider, and must set
-- user_id = auth.uid() and status = 'active'.
-- =============================================================
create policy "horse_daily_activities_insert"
  on public.horse_daily_activities for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and status = 'active'
    and (
      exists (
        select 1 from public.horses
        where horses.id = horse_daily_activities.horse_id
          and horses.owner_id = auth.uid()
      )
      or
      exists (
        select 1 from public.approvals
        where approvals.horse_id = horse_daily_activities.horse_id
          and approvals.rider_id = auth.uid()
          and approvals.status = 'approved'
      )
    )
  );

-- =============================================================
-- UPDATE
-- Only the creator of the row may update it, and only while they
-- still have owner/approved-rider access.
-- Application code further restricts this to status-only changes
-- (soft-correction). The DB enforces that user_id stays the same.
-- =============================================================
create policy "horse_daily_activities_update"
  on public.horse_daily_activities for update
  to authenticated
  using (
    user_id = auth.uid()
    and (
      exists (
        select 1 from public.horses
        where horses.id = horse_daily_activities.horse_id
          and horses.owner_id = auth.uid()
      )
      or
      exists (
        select 1 from public.approvals
        where approvals.horse_id = horse_daily_activities.horse_id
          and approvals.rider_id = auth.uid()
          and approvals.status = 'approved'
      )
    )
  )
  with check (
    user_id = auth.uid()
  );

-- No DELETE policy — rows are never hard-deleted.
