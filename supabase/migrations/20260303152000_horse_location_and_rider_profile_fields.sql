alter table public.horses
  add column if not exists location_address text,
  add column if not exists location_notes text;

alter table public.rider_profiles
  add column if not exists preferred_days text,
  add column if not exists goals text;

alter table public.availability_rules
  add column if not exists is_trial_slot boolean not null default false;
