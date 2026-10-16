-- Bucket `avatars` PRIVADO. Las fotos dejan de tener URL pública permanente.
--
-- Antes: `avatars` era público y `profiles.avatar_url` guardaba su URL pública
-- (`https://<proyecto>/storage/v1/object/public/avatars/<uid>/<uuid>.jpg`): quien
-- tuviera la URL veía la foto para siempre, tuviera o no sesión.
--
-- Ahora:
-- 1. `avatars.public = false`: la ruta pública deja de servir.
-- 2. `profiles.avatar_url` guarda la RUTA del objeto (`<uid>/<uuid>.jpg`), no una
--    URL. La sigue escribiendo solo la Edge Function `moderate-avatar` (service
--    role); el cliente no tiene permiso de escritura sobre la columna. El
--    nombre de la columna se conserva a propósito (privilegios de columna,
--    tipos generados, guardias de drift): solo cambia lo que contiene.
-- 3. Los clientes leen la foto con una URL firmada de 1 h (`createSignedUrls`),
--    que Storage solo emite si la política de lectura de abajo lo permite.
--
-- Política de lectura (`avatars_read_published`): cualquier `authenticated` puede
-- leer un objeto de `avatars` SI es la foto publicada de algún perfil
-- (`profiles.avatar_url = name`). Es lo más restrictivo que no rompe el producto:
-- los perfiles ya son legibles por cualquier autenticado (deck, matches, salas,
-- chat), así que su foto también; en cambio una foto sustituida o quitada deja
-- de poder firmarse al instante y no hay lectura anónima. Límite honesto: una URL
-- ya firmada sigue valiendo hasta que caduque (1 h).
-- Sin políticas de insert/update/delete en `avatars`: escribe solo la función.
--
-- `storage` no existe en el Postgres embebido de `npm run test:schema` (PGlite):
-- todo lo de Storage va detrás de la guarda, como en 20261012120000.

-- El CHECK original (20261012120000) nació sin nombre y, al mirar dos columnas
-- (`id` y `avatar_url`), Postgres lo llamó `profiles_check`.
-- Filas con una URL antigua: la ruta nueva no admite URLs. En producción no
-- había objetos ni filas con foto; si las hubiera, la foto se vuelve a subir.
alter table public.profiles drop constraint if exists profiles_check;

update public.profiles set avatar_url = null where avatar_url is not null;

alter table public.profiles
  add constraint profiles_avatar_url_check
    check (
      avatar_url is null
      or (
        char_length(avatar_url) <= 200
        and avatar_url like id::text || '/%.jpg'
        and avatar_url not like '%/%/%'
        and avatar_url not like '%..%'
      )
    );

comment on column public.profiles.avatar_url is
  'Ruta del objeto en el bucket privado avatars (<uid>/<uuid>.jpg), no una URL. La escribe solo moderate-avatar; los clientes la firman con createSignedUrls.';

-- La política de lectura busca por esta columna con cada firma.
create index if not exists profiles_avatar_url_idx
  on public.profiles (avatar_url)
  where avatar_url is not null;

do $avatars$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'avatars_private: no hay esquema storage, se omiten el bucket y la política';
    return;
  end if;

  update storage.buckets set public = false where id = 'avatars';

  -- Con el bucket privado, sin esta política nadie (salvo la service role) podría
  -- firmar una foto. `storage.objects.name` va calificado: `profiles` también
  -- tiene una columna `name` y, sin calificar, ganaría la de la subconsulta.
  execute 'drop policy if exists avatars_read_published on storage.objects';
  execute $p$create policy avatars_read_published on storage.objects for select to authenticated
    using (
      bucket_id = 'avatars'
      and exists (
        select 1 from public.profiles p where p.avatar_url = storage.objects.name
      )
    )$p$;
end
$avatars$;
