-- Slot / Free booking schema consistency
--
-- Fachliche Regel:
--   slot_id IS NULL AND availability_rule_id IS NULL  -> Free Booking (kein Slot-Bezug)
--   slot_id IS NOT NULL AND availability_rule_id IS NOT NULL -> Slot Booking
--   Jede andere Kombination ist ein Datenfehler.
--
-- Diese Migration:
--   1. Stellt alle vier NOT NULL-Drops idempotent sicher (doppelte Runs sind sicher).
--   2. Bereinigt Altbestand mit inkonsistenten Paaren, bevor der Constraint greift.
--   3. Setzt den CHECK-Constraint auf beide Tabellen.

-- ============================================================
-- 1. NOT NULL droppen (idempotent in PostgreSQL)
-- ============================================================

alter table public.booking_requests
  alter column slot_id drop not null;

alter table public.booking_requests
  alter column availability_rule_id drop not null;

-- bookings wurde bereits in 20260314000001 gepatcht; hier nochmals zur Sicherheit.
alter table public.bookings
  alter column slot_id drop not null;

alter table public.bookings
  alter column availability_rule_id drop not null;

-- ============================================================
-- 2. Altdaten bereinigen
-- Zeilen, bei denen genau eine der beiden Spalten NULL ist,
-- verletzen die neue Konsistenzregel. Solche Zeilen koennen
-- nur aus Bugs oder halbfertigen Migrationen stammen.
-- Sicherste Korrektur: beide auf NULL setzen
-- (entspricht dann einem freien Buchungsdatensatz ohne Slotreferenz).
-- Falls in deiner Umgebung keine solchen Zeilen existieren,
-- sind diese Updates no-ops.
-- ============================================================

update public.booking_requests
set
  slot_id             = null,
  availability_rule_id = null
where
  (slot_id is null) <> (availability_rule_id is null);

update public.bookings
set
  slot_id             = null,
  availability_rule_id = null
where
  (slot_id is null) <> (availability_rule_id is null);

-- ============================================================
-- 3. CHECK-Constraints setzen
-- ============================================================

alter table public.booking_requests
  add constraint booking_requests_slot_rule_consistency
  check (
    (slot_id is null and availability_rule_id is null)
    or
    (slot_id is not null and availability_rule_id is not null)
  );

alter table public.bookings
  add constraint bookings_slot_rule_consistency
  check (
    (slot_id is null and availability_rule_id is null)
    or
    (slot_id is not null and availability_rule_id is not null)
  );

-- ============================================================
-- Verifikations-Queries (nach Apply ausfuehren):
-- ============================================================

-- A) Nullability beider Spalten in beiden Tabellen:
-- select table_name, column_name, is_nullable
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name in ('booking_requests', 'bookings')
--   and column_name in ('slot_id', 'availability_rule_id')
-- order by table_name, column_name;
-- Erwartung: alle 4 Zeilen is_nullable = YES

-- B) CHECK-Constraints vorhanden:
-- select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid)
-- from pg_constraint
-- where contype = 'c'
--   and conrelid in (
--     'public.booking_requests'::regclass,
--     'public.bookings'::regclass
--   )
--   and conname in (
--     'booking_requests_slot_rule_consistency',
--     'bookings_slot_rule_consistency'
--   );
-- Erwartung: 2 Zeilen

-- C) Inkonsistente Zeilen nach Apply (sollten 0 sein):
-- select 'booking_requests' as tbl, count(*) as violations
-- from public.booking_requests
-- where (slot_id is null) <> (availability_rule_id is null)
-- union all
-- select 'bookings', count(*)
-- from public.bookings
-- where (slot_id is null) <> (availability_rule_id is null);
