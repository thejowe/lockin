-- Limpieza de Storage de fotos de perfil: retención de huérfanos y borrado en
-- servidor al eliminar la cuenta.
--
-- 1. `purge_stale_avatar_uploads()`: `avatar-uploads` solo debería tener
--    archivos durante los segundos que dura la moderación (la función
--    `moderate-avatar` borra la pendiente al aprobar, al rechazar y al fallar el
--    proveedor). Quedan huérfanos si el cliente subió y nunca llamó a la
--    función, o si el borrado de la función falló. Se purgan los de más de 24 h.
--    Se programa con pg_cron si existe (cada hora); si no, queda como función.
-- 2. `delete_my_account()` borra además, en servidor, los objetos de la persona
--    en `avatars` y `avatar-uploads`. Antes solo lo hacía el cliente (`deleteAvatar`),
--    a mejor esfuerzo.
--
-- Límite honesto: borrar filas de `storage.objects` por SQL elimina el objeto
-- para la API (la URL pública deja de resolver), pero Supabase documenta que los
-- bytes del backend S3 no se retiran con SQL. Se aceptan como residuo opaco, sin
-- URL ni metadatos. El camino que retira también los bytes es la Storage API
-- (cliente `deleteAvatar`, que se mantiene, o la Edge Function).
--
-- `storage` no existe en el Postgres embebido de `npm run test:schema`: todo va
-- detrás de `to_regclass('storage.objects')`.

create or replace function public.purge_stale_avatar_uploads()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer := 0;
begin
  if to_regclass('storage.objects') is null then
    return 0;
  end if;
  -- Algunas versiones de Storage protegen el borrado directo con este ajuste.
  perform set_config('storage.allow_delete_query', 'true', true);
  execute $q$
    with gone as (
      delete from storage.objects
      where bucket_id = 'avatar-uploads'
        and created_at < now() - interval '24 hours'
      returning 1
    )
    select count(*)::integer from gone
  $q$ into v_deleted;
  return v_deleted;
end;
$$;

revoke execute on function public.purge_stale_avatar_uploads() from public, anon, authenticated;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'delete_my_account: no hay sesión' using errcode = 'LI007';
  end if;

  perform 1 from public.profiles where id = v_uid for update;

  -- Fotos: primero, mientras el id aún existe. Mismo criterio de carpeta que las
  -- políticas de storage (`<uid>/...`).
  if to_regclass('storage.objects') is not null then
    perform set_config('storage.allow_delete_query', 'true', true);
    execute $q$
      delete from storage.objects
      where bucket_id in ('avatars', 'avatar-uploads')
        and (storage.foldername(name))[1] = $1
    $q$ using v_uid::text;
  end if;

  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

do $cron$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron no está disponible: purge_stale_avatar_uploads() queda sin programar';
    return;
  end if;
  create extension if not exists pg_cron with schema pg_catalog;
  perform cron.schedule('lockin-purge-stale-avatar-uploads', '10 * * * *', 'select public.purge_stale_avatar_uploads()');
exception when others or query_canceled then
  raise warning 'no se pudo programar con pg_cron (%): programa a mano purge_stale_avatar_uploads()', sqlerrm;
end
$cron$;
