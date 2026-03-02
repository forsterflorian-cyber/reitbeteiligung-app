alter table public.horse_images
  add column if not exists path text,
  add column if not exists position integer;

alter table public.horse_images alter column position set default 0;

update public.horse_images
set position = 0
where position is null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'horse_images'
      and column_name = 'storage_path'
  ) then
    execute '
      update public.horse_images
      set path = coalesce(path, storage_path)
      where path is null
    ';
  end if;
end
$$;

create unique index if not exists horse_images_path_idx
  on public.horse_images (path)
  where path is not null;

create index if not exists horse_images_horse_position_idx
  on public.horse_images (horse_id, position, created_at);

alter table public.horse_images alter column path set not null;
alter table public.horse_images alter column position set not null;
alter table public.horse_images enable row level security;

drop policy if exists "Jeder liest Pferdebilder" on public.horse_images;
drop policy if exists "Owner liest Pferdebilder" on public.horse_images;
create policy "Owner liest Pferdebilder"
  on public.horse_images
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.horses
      where horses.id = horse_images.horse_id
        and horses.owner_id = auth.uid()
    )
  );

drop policy if exists "Owner erstellt Pferdebilder" on public.horse_images;
create policy "Owner erstellt Pferdebilder"
  on public.horse_images
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.horses
      where horses.id = horse_images.horse_id
        and horses.owner_id = auth.uid()
    )
  );

drop policy if exists "Owner loescht Pferdebilder" on public.horse_images;
create policy "Owner loescht Pferdebilder"
  on public.horse_images
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.horses
      where horses.id = horse_images.horse_id
        and horses.owner_id = auth.uid()
    )
  );

insert into storage.buckets (id, name, public)
values ('horse-images', 'horse-images', false)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "Jeder liest horse-images" on storage.objects;
drop policy if exists "Owner liest horse-images" on storage.objects;
create policy "Owner liest horse-images"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'horse-images'
    and split_part(name, '/', 1) = 'horses'
    and split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and exists (
      select 1
      from public.horses
      where horses.id = split_part(name, '/', 2)::uuid
        and horses.owner_id = auth.uid()
    )
  );

drop policy if exists "Owner erstellt horse-images" on storage.objects;
create policy "Owner erstellt horse-images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'horse-images'
    and split_part(name, '/', 1) = 'horses'
    and split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and exists (
      select 1
      from public.horses
      where horses.id = split_part(name, '/', 2)::uuid
        and horses.owner_id = auth.uid()
    )
  );

drop policy if exists "Owner loescht horse-images" on storage.objects;
create policy "Owner loescht horse-images"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'horse-images'
    and split_part(name, '/', 1) = 'horses'
    and split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and exists (
      select 1
      from public.horses
      where horses.id = split_part(name, '/', 2)::uuid
        and horses.owner_id = auth.uid()
    )
  );