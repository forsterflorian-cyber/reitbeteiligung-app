-- booking_requests: make slot_id and availability_rule_id nullable
-- Required for free-mode bookings which have no slot/rule.
-- bookings was already patched in 20260314000001.
-- Confirmed root cause: 23502 not-null violation on booking_requests.slot_id.

alter table public.booking_requests
  alter column slot_id drop not null;

alter table public.booking_requests
  alter column availability_rule_id drop not null;

-- Verify (informational, runs in transaction context):
-- select column_name, is_nullable
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name in ('booking_requests', 'bookings')
--   and column_name in ('slot_id', 'availability_rule_id')
-- order by table_name, column_name;
