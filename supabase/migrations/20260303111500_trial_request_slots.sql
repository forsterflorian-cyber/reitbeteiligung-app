alter table public.trial_requests
  add column if not exists availability_rule_id uuid null references public.availability_rules (id) on delete set null,
  add column if not exists requested_start_at timestamptz null,
  add column if not exists requested_end_at timestamptz null;

create index if not exists trial_requests_horse_availability_rule_idx
  on public.trial_requests (horse_id, availability_rule_id);

create index if not exists trial_requests_horse_requested_start_idx
  on public.trial_requests (horse_id, requested_start_at);