alter table public.trial_requests drop constraint if exists trial_requests_horse_id_fkey;
alter table public.trial_requests
  add constraint trial_requests_horse_id_fkey
  foreign key (horse_id) references public.horses (id) on delete cascade;

alter table public.approvals drop constraint if exists approvals_horse_id_fkey;
alter table public.approvals
  add constraint approvals_horse_id_fkey
  foreign key (horse_id) references public.horses (id) on delete cascade;

alter table public.availability_slots drop constraint if exists availability_slots_horse_id_fkey;
alter table public.availability_slots
  add constraint availability_slots_horse_id_fkey
  foreign key (horse_id) references public.horses (id) on delete cascade;

alter table public.conversations drop constraint if exists conversations_horse_id_fkey;
alter table public.conversations
  add constraint conversations_horse_id_fkey
  foreign key (horse_id) references public.horses (id) on delete cascade;

alter table public.messages drop constraint if exists messages_conversation_id_fkey;
alter table public.messages
  add constraint messages_conversation_id_fkey
  foreign key (conversation_id) references public.conversations (id) on delete cascade;

alter table public.booking_requests drop constraint if exists booking_requests_horse_id_fkey;
alter table public.booking_requests
  add constraint booking_requests_horse_id_fkey
  foreign key (horse_id) references public.horses (id) on delete cascade;

alter table public.booking_requests drop constraint if exists booking_requests_slot_id_fkey;
alter table public.booking_requests
  add constraint booking_requests_slot_id_fkey
  foreign key (slot_id) references public.availability_slots (id) on delete cascade;

create or replace function public.delete_owner_horse(p_horse_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not exists (
    select 1
    from public.horses
    where id = p_horse_id
      and owner_id = auth.uid()
  ) then
    raise exception 'NOT_ALLOWED';
  end if;

  delete from public.horses
  where id = p_horse_id;
end;
$$;

grant execute on function public.delete_owner_horse(uuid) to authenticated;