-- Add booking_mode to horses.
-- Determines how approved riders may create bookings for this horse.
--   'slots' (default) — riders may only book pre-defined, explicitly released slots.
--   'free'            — riders may create bookings freely within availability windows,
--                       subject to all existing block and conflict rules.
--
-- The default is 'slots' (more restrictive) so existing horses keep their current
-- behaviour after the migration.

alter table horses
  add column booking_mode text not null default 'slots';

alter table horses
  add constraint horses_booking_mode_check
  check (booking_mode in ('free', 'slots'));
