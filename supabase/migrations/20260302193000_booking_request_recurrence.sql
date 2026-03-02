alter table public.booking_requests add column if not exists recurrence_rrule text;

alter table public.bookings drop constraint if exists bookings_booking_request_id_key;
create index if not exists bookings_booking_request_id_idx
  on public.bookings (booking_request_id);