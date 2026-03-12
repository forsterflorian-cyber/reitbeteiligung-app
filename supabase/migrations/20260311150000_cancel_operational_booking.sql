create or replace function public.cancel_operational_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_booking record;
  v_owner_id uuid;
begin
  select
    bookings.id,
    bookings.booking_request_id,
    bookings.horse_id,
    bookings.rider_id,
    bookings.start_at,
    requests.status as request_status,
    requests.recurrence_rrule
  into v_booking
  from public.bookings as bookings
  join public.booking_requests as requests
    on requests.id = bookings.booking_request_id
  where bookings.id = p_booking_id;

  if not found then
    raise exception 'NOT_FOUND';
  end if;

  select horses.owner_id
  into v_owner_id
  from public.horses as horses
  where horses.id = v_booking.horse_id;

  if v_owner_id is null then
    raise exception 'NOT_FOUND';
  end if;

  if auth.uid() <> v_owner_id then
    if auth.uid() <> v_booking.rider_id then
      raise exception 'NOT_ALLOWED';
    end if;

    if not exists (
      select 1
      from public.approvals
      where approvals.horse_id = v_booking.horse_id
        and approvals.rider_id = v_booking.rider_id
        and approvals.status = 'approved'
    ) then
      raise exception 'NOT_APPROVED';
    end if;
  end if;

  if v_booking.request_status <> 'accepted' then
    raise exception 'INVALID_STATUS';
  end if;

  if v_booking.recurrence_rrule is not null then
    raise exception 'UNSUPPORTED_RECURRENCE';
  end if;

  if v_booking.start_at <= timezone('utc'::text, now()) then
    raise exception 'BOOKING_STARTED';
  end if;

  delete from public.bookings
  where id = v_booking.id;

  update public.booking_requests
  set status = 'canceled'
  where id = v_booking.booking_request_id;
end;
$$;

revoke all on function public.cancel_operational_booking(uuid) from public;
grant execute on function public.cancel_operational_booking(uuid) to authenticated;
