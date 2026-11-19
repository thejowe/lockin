-- Jornadas locales del perfil. Los intervalos están ordenados y el fin es exclusivo.
alter table public.profiles add column work_ranges jsonb;

create function public.is_valid_work_ranges(ranges jsonb)
returns boolean
language plpgsql immutable strict
set search_path = ''
as $$
declare
  part jsonb;
  start_min numeric;
  end_min numeric;
  previous_end numeric := 0;
begin
  if jsonb_typeof(ranges) <> 'array' then return false; end if;
  if jsonb_array_length(ranges) not between 1 and 2 then return false; end if;
  for part in select value from jsonb_array_elements(ranges) loop
    if jsonb_typeof(part -> 'start_min') is distinct from 'number'
       or jsonb_typeof(part -> 'end_min') is distinct from 'number' then
      return false;
    end if;
    if part - array['start_min', 'end_min'] <> '{}'::jsonb then return false; end if;
    start_min := (part ->> 'start_min')::numeric;
    end_min := (part ->> 'end_min')::numeric;
    if start_min < previous_end or end_min > 1440 or end_min - start_min < 60
       or start_min % 30 <> 0 or end_min % 30 <> 0 then
      return false;
    end if;
    previous_end := end_min;
  end loop;
  return true;
end;
$$;
revoke all on function public.is_valid_work_ranges(jsonb) from public, anon;
grant execute on function public.is_valid_work_ranges(jsonb) to authenticated, service_role;

create function public.sync_profile_work_ranges()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  bands constant public.time_band[] := array['madrugada','manana','tarde','noche']::public.time_band[];
  minutes constant integer[] := array[0,360,720,1200,1440];
begin
  if tg_argv[0] = 'bands' or (tg_op = 'INSERT' and new.work_ranges is null) then
    if new.availability_bands is null or cardinality(new.availability_bands) = 0
       or public.array_has_duplicates(new.availability_bands) then
      raise exception 'Invalid availability bands' using errcode = '23514';
    end if;
    -- Reordenar la misma selección desde un cliente antiguo conserva los minutos exactos.
    if tg_op = 'UPDATE' and old.work_ranges is not null
       and new.availability_bands @> old.availability_bands
       and new.availability_bands <@ old.availability_bands then
      new.availability_bands := old.availability_bands;
      return new;
    end if;
    -- La unión multirrango de PostgreSQL agrupa las franjas contiguas y conserva los huecos.
    select jsonb_agg(jsonb_build_object('start_min', lower(span), 'end_min', upper(span))
                     order by lower(span))
      into new.work_ranges
      from unnest((
        select range_agg(int4range(minutes[i], minutes[i + 1], '[)'))
        from generate_subscripts(bands, 1) as s(i)
        where bands[i] = any(new.availability_bands)
      )) as spans(span);
  end if;

  new.availability_bands := array(
    select bands[i] from generate_subscripts(bands, 1) as s(i)
    where jsonb_path_exists(new.work_ranges,
      'strict $[*] ? (@.start_min < $hi && @.end_min > $lo)',
      jsonb_build_object('lo', minutes[i], 'hi', minutes[i + 1]), true)
    order by i
  );
  return new;
end;
$$;
revoke all on function public.sync_profile_work_ranges() from public, anon, authenticated;

-- PostgreSQL ejecuta los BEFORE triggers en orden alfabético. Si el cliente envía
-- ambos formatos, el rango exacto manda incluso cuando coincide con el anterior.
create trigger profiles_apply_work_ranges
  before insert or update of work_ranges on public.profiles
  for each row execute function public.sync_profile_work_ranges('ranges');
create trigger profiles_read_legacy_work_bands
  before update of availability_bands on public.profiles
  for each row when (
    old.work_ranges is not distinct from new.work_ranges
    and (old.work_ranges is null or old.availability_bands is distinct from new.availability_bands)
  ) execute function public.sync_profile_work_ranges('bands');

-- Rellena mediante el mismo camino que el cliente antiguo y conserva la fecha de edición.
alter table public.profiles disable trigger profiles_touch_updated_at;
update public.profiles set availability_bands = availability_bands;
alter table public.profiles enable trigger profiles_touch_updated_at;

alter table public.profiles alter column work_ranges set not null;
alter table public.profiles add constraint profiles_valid_work_ranges
  check (public.is_valid_work_ranges(work_ranges));

grant insert (work_ranges) on public.profiles to authenticated;
grant update (work_ranges) on public.profiles to authenticated;
