alter table public.horses
  add column if not exists height_cm integer,
  add column if not exists breed text,
  add column if not exists color text,
  add column if not exists sex text,
  add column if not exists birth_year integer;

do $$
declare
  current_year integer := extract(year from timezone('utc'::text, now()))::integer;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'horses'
      and column_name = 'stockmass_cm'
  ) then
    execute 'update public.horses set height_cm = coalesce(height_cm, stockmass_cm) where stockmass_cm is not null';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'horses'
      and column_name = 'rasse'
  ) then
    execute 'update public.horses set breed = coalesce(breed, rasse) where rasse is not null';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'horses'
      and column_name = 'farbe'
  ) then
    execute 'update public.horses set color = coalesce(color, farbe) where farbe is not null';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'horses'
      and column_name = 'geschlecht'
  ) then
    execute 'update public.horses set sex = coalesce(sex, geschlecht) where geschlecht is not null';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'horses'
      and column_name = 'alter'
  ) then
    execute format(
      'update public.horses set birth_year = coalesce(birth_year, %s - "alter") where "alter" is not null',
      current_year
    );
  end if;
end
$$;