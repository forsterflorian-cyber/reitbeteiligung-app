alter table public.approvals
  drop constraint if exists approvals_status_check;

alter table public.approvals
  add constraint approvals_status_check
  check (
    status = any (
      array[
        'approved'::text,
        'rejected'::text,
        'revoked'::text
      ]
    )
  );

create or replace function public.is_relationship_conversation_visible(p_horse_id uuid, p_rider_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_approval_status text;
  v_trial_status text;
begin
  select approvals.status
  into v_approval_status
  from public.approvals
  where approvals.horse_id = p_horse_id
    and approvals.rider_id = p_rider_id;

  if v_approval_status = 'approved' then
    return true;
  end if;

  if v_approval_status in ('rejected', 'revoked') then
    return false;
  end if;

  select trial_requests.status
  into v_trial_status
  from public.trial_requests
  where trial_requests.horse_id = p_horse_id
    and trial_requests.rider_id = p_rider_id
  order by trial_requests.created_at desc
  limit 1;

  return v_trial_status in ('requested', 'accepted', 'completed');
end;
$$;

revoke all on function public.is_relationship_conversation_visible(uuid, uuid) from public;
grant execute on function public.is_relationship_conversation_visible(uuid, uuid) to authenticated;

drop policy if exists "Owner loescht Verfuegbarkeitsfenster" on public.availability_slots;
drop policy if exists "Owner loescht Verfuegbarkeitsregeln" on public.availability_rules;

alter table public.availability_rules
  drop constraint if exists availability_rules_slot_id_fkey;

alter table public.availability_rules
  add constraint availability_rules_slot_id_fkey
  foreign key (slot_id) references public.availability_slots (id) on delete no action;

alter table public.booking_requests
  drop constraint if exists booking_requests_slot_id_fkey;

alter table public.booking_requests
  add constraint booking_requests_slot_id_fkey
  foreign key (slot_id) references public.availability_slots (id) on delete no action;

alter table public.bookings
  drop constraint if exists bookings_slot_id_fkey;

alter table public.bookings
  add constraint bookings_slot_id_fkey
  foreign key (slot_id) references public.availability_slots (id) on delete no action;

alter table public.booking_requests
  drop constraint if exists booking_requests_availability_rule_id_fkey;

alter table public.booking_requests
  add constraint booking_requests_availability_rule_id_fkey
  foreign key (availability_rule_id) references public.availability_rules (id) on delete no action;

alter table public.bookings
  drop constraint if exists bookings_availability_rule_id_fkey;

alter table public.bookings
  add constraint bookings_availability_rule_id_fkey
  foreign key (availability_rule_id) references public.availability_rules (id) on delete no action;
