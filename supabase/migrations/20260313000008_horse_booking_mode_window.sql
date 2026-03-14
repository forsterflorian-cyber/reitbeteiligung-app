-- Extend booking_mode to support three distinct modes and change the default
-- to 'window' (the middle-ground option for new horses).
--
-- Modes:
--   'slots'  — riders may only book exact pre-defined slots.
--   'window' — riders may pick any start/end within an owner-defined window.
--   'free'   — riders may book any free time (conflict detection still applies).

alter table horses
  drop constraint horses_booking_mode_check;

alter table horses
  add constraint horses_booking_mode_check
  check (booking_mode in ('free', 'slots', 'window'));

alter table horses
  alter column booking_mode set default 'window';
