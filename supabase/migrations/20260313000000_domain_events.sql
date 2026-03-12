-- Domain events: append-only audit log for booking-related actions.
-- Consumed by future notification and chat automation layers.
-- No FK constraints intentionally — events are a self-contained audit trail.

create table public.domain_events (
  id         uuid        primary key default gen_random_uuid(),
  event_type text        not null,
  horse_id   uuid        not null,
  rider_id   uuid,
  payload    jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.domain_events enable row level security;

-- Server-side actions run with authenticated user sessions.
-- INSERT is the only public operation; SELECT is service-role only.
create policy "domain_events_insert"
  on public.domain_events
  for insert
  to authenticated
  with check (true);
