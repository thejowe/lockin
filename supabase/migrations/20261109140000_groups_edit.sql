-- cofounder — Grupos: editar un grupo ya creado (2026-11-09).
--
-- Sin esto, un grupo cuyos perfiles buscados se llenan o dejan de tener
-- sentido se queda bloqueado. El admin puede cambiar el nombre, el proyecto y
-- los perfiles que buscan (añadir, quitar y cambiar cuántas personas).
--
-- `p_roles` es el conjunto completo deseado, como en `create_group`:
-- `[{"specialty": "dev", "slots": 2}, …]`. Por especialidad:
--
--   * ya existía → se cambian sus plazas; nunca por debajo de las ocupadas
--     (para eso está expulsar);
--   * es nueva → se crea vacía;
--   * no viene → se borra, solo si nadie la ocupa.
--
-- El aforo (`max_members`) no cambia, y la suma de plazas más el admin sigue
-- sin poder pasar de él. Los likes del admin que apuntaban a un perfil borrado
-- se quedan con `role_id` nulo (`on delete set null`): si la persona responde,
-- `join_group_if_possible` busca otro perfil abierto que encaje.

create function public.update_group(p_name text, p_description text, p_roles jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_name, ''));
  v_description text := btrim(coalesce(p_description, ''));
  v_group public.groups;
  v_total integer;
begin
  if v_uid is null then
    raise exception 'No hay sesión autenticada.' using errcode = '28000';
  end if;

  select g.* into v_group from public.groups g where g.admin_id = v_uid for update;
  if v_group.id is null then
    raise exception 'update_group: no administras ningún grupo' using errcode = 'LG004';
  end if;

  if char_length(v_name) not between 2 and 60
     or char_length(v_description) not between 10 and 500
     or p_roles is null or jsonb_typeof(p_roles) <> 'array'
     or jsonb_array_length(p_roles) not between 1 and 5 then
    raise exception 'update_group: datos no válidos' using errcode = 'LG001';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_roles) e
    where jsonb_typeof(e) <> 'object'
       or (e ->> 'specialty') is null
       or not (e ->> 'specialty' = any(enum_range(null::public.specialty)::text[]))
       or (e ->> 'slots') is null
       or (e ->> 'slots') !~ '^[0-9]{1,2}$'
       or (e ->> 'slots')::integer not between 1 and 5
  ) or (
    select count(distinct e ->> 'specialty') <> count(*) from jsonb_array_elements(p_roles) e
  ) then
    raise exception 'update_group: perfiles no válidos' using errcode = 'LG001';
  end if;

  select sum((e ->> 'slots')::integer) into v_total from jsonb_array_elements(p_roles) e;
  if v_total + 1 > v_group.max_members then
    raise exception 'update_group: demasiadas plazas para % miembros', v_group.max_members
      using errcode = 'LG001';
  end if;

  -- Ni quitar un perfil ocupado ni dejarlo con menos plazas que personas.
  if exists (
    select 1
    from public.group_roles r
    left join jsonb_array_elements(p_roles) e on e ->> 'specialty' = r.specialty::text
    where r.group_id = v_group.id
      and r.filled > 0
      and (e is null or (e ->> 'slots')::integer < r.filled)
  ) then
    raise exception 'update_group: hay personas en ese perfil' using errcode = 'LG001';
  end if;

  delete from public.group_roles r
   where r.group_id = v_group.id
     and not exists (
       select 1 from jsonb_array_elements(p_roles) e where e ->> 'specialty' = r.specialty::text
     );

  insert into public.group_roles (group_id, specialty, slots)
  select v_group.id, (e ->> 'specialty')::public.specialty, (e ->> 'slots')::smallint
  from jsonb_array_elements(p_roles) e
  on conflict (group_id, specialty) do update set slots = excluded.slots;

  update public.groups
     set name = v_name, description = v_description, updated_at = clock_timestamp()
   where id = v_group.id;
end;
$fn$;

revoke execute on function public.update_group(text, text, jsonb) from public, anon;
grant execute on function public.update_group(text, text, jsonb) to authenticated;
