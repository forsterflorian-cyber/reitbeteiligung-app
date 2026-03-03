alter table if exists public.profiles
  add column if not exists trial_started_at timestamptz null;