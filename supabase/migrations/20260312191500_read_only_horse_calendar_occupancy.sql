create or replace function public.get_horse_calendar_occupancy(p_horse_id uuid)
returns table (
  source text,
  start_at timestamptz,
  end_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  return query
  select
    'booking'::text as source,
    bookings.start_at,
    bookings.end_at
  from public.bookings as bookings
  join public.booking_requests as requests
    on requests.id = bookings.booking_request_id
  where bookings.horse_id = p_horse_id
    and requests.status = 'accepted'

  union all

  select
    'block'::text as source,
    blocks.start_at,
    blocks.end_at
  from public.calendar_blocks as blocks
  where blocks.horse_id = p_horse_id;
end;
$$;

revoke all on function public.get_horse_calendar_occupancy(uuid) from public;
grant execute on function public.get_horse_calendar_occupancy(uuid) to anon, authenticated;
