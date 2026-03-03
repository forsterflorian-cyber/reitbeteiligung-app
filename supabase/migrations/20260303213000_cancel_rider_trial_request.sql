create or replace function public.cancel_rider_trial_request(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.trial_requests%rowtype;
begin
  select *
    into v_request
    from public.trial_requests
   where id = p_request_id
     and rider_id = auth.uid();

  if not found then
    return false;
  end if;

  if v_request.status not in ('requested', 'accepted') then
    return false;
  end if;

  delete from public.trial_requests
   where id = v_request.id;

  return found;
end;
$$;

revoke all on function public.cancel_rider_trial_request(uuid) from public;
grant execute on function public.cancel_rider_trial_request(uuid) to authenticated;
