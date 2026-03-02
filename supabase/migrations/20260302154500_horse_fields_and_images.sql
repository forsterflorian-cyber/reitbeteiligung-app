alter table public.horses add column if not exists stockmass_cm integer;
alter table public.horses add column if not exists rasse text;
alter table public.horses add column if not exists farbe text;
alter table public.horses add column if not exists geschlecht text;
alter table public.horses add column if not exists alter integer;

create table if not exists public.horse_images (
  id uuid primary key default gen_random_uuid(),
  horse_id uuid not null references public.horses (id) on delete cascade,
  storage_path text not null unique,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists horse_images_horse_id_idx
  on public.horse_images (horse_id, created_at);

alter table public.horse_images enable row level security;

drop policy if exists "Jeder liest Pferdebilder" on public.horse_images;
create policy "Jeder liest Pferdebilder"
  on public.horse_images
  for select
  to public
  using (true);

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
values ('horse-images', 'horse-images', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "Jeder liest horse-images" on storage.objects;
create policy "Jeder liest horse-images"
  on storage.objects
  for select
  to public
  using (bucket_id = 'horse-images');

drop policy if exists "Owner erstellt horse-images" on storage.objects;
create policy "Owner erstellt horse-images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'horse-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Owner loescht horse-images" on storage.objects;
create policy "Owner loescht horse-images"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'horse-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
