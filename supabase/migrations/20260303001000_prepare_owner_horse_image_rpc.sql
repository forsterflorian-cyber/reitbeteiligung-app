drop function if exists public.prepare_owner_horse_image(uuid, uuid, text, integer);

create or replace function public.prepare_owner_horse_image(
  p_horse_id uuid,
  p_image_id uuid,
  p_path text,
  p_position integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  has_storage_path boolean;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.horses
    where id = p_horse_id
      and owner_id = auth.uid()
  ) then
    raise exception 'Nur der Pferdehalter darf Bilder anlegen.' using errcode = '42501';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'horse_images'
      and column_name = 'storage_path'
  ) into has_storage_path;

  if has_storage_path then
    execute
      'insert into public.horse_images (id, horse_id, path, position, storage_path)
       values ($1, $2, $3, $4, $3)'
    using p_image_id, p_horse_id, p_path, coalesce(p_position, 0);
  else
    execute
      'insert into public.horse_images (id, horse_id, path, position)
       values ($1, $2, $3, $4)'
    using p_image_id, p_horse_id, p_path, coalesce(p_position, 0);
  end if;
end;
$$;

revoke all on function public.prepare_owner_horse_image(uuid, uuid, text, integer) from public;
grant execute on function public.prepare_owner_horse_image(uuid, uuid, text, integer) to authenticated;