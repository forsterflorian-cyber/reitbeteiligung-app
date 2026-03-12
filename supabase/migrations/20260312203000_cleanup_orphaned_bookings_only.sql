create or replace function public.cleanup_inactive_operational_bookings(p_horse_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_deleted integer;
begin
  -- Legacy function name retained; this repair path now only clears true orphan rows.
  with deleted as (
    delete from public.bookings as bookings
    where (p_horse_id is null or bookings.horse_id = p_horse_id)
      and not exists (
        select 1
        from public.booking_requests as requests
        where requests.id = bookings.booking_request_id
      )
    returning 1
  )
  select count(*)
  into v_deleted
  from deleted;

  return coalesce(v_deleted, 0);
end;
$$;

revoke all on function public.cleanup_inactive_operational_bookings(uuid) from public;
grant execute on function public.cleanup_inactive_operational_bookings(uuid) to authenticated;
