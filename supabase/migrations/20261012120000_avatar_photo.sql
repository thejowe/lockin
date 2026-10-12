-- Foto de perfil (una por persona), publicada solo tras moderación.
--
-- `avatar_url` solo puede apuntar al bucket `avatars` del propio proyecto y a la
-- carpeta del propio `id`. NO se concede `insert`/`update` de esta columna a
-- `authenticated` —como el sello de GitHub—: la escribe solo la Edge Function
-- `moderate-avatar` con la service role, después de revisar la imagen. La
-- migración `20260916000100_github_verification.sql` explica el peaje: una
-- columna nueva de `profiles` nace sin permiso de escritura, y aquí es lo que
-- queremos. Lectura (`select`) sí: es lo que pinta la tarjeta.

alter table public.profiles
  add column avatar_url text
    check (
      avatar_url is null
      or (
        char_length(avatar_url) <= 500
        and avatar_url like 'https://%/storage/v1/object/public/avatars/' || id::text || '/%'
      )
    );

-- Buckets y políticas. `storage` no existe en el Postgres embebido de
-- `npm run test:schema` (PGlite): todo va detrás de esta guarda. En Supabase
-- real y en el local de `contract.yml` sí está.
do $avatars$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'avatar_photo: no hay esquema storage, se omiten los buckets';
    return;
  end if;

  -- Subidas pendientes de revisar: PRIVADO. Nadie las lee por la API de cliente.
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('avatar-uploads', 'avatar-uploads', false, 5242880, array['image/jpeg'])
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  -- Fotos ya revisadas: lectura pública por URL; SIN políticas de escritura.
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('avatars', 'avatars', true, 5242880, array['image/jpeg'])
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  -- El dueño solo puede insertar y borrar en SU carpeta de subidas. Sin select
  -- ni update: la función (service role) es quien lee y mueve.
  execute 'drop policy if exists avatar_uploads_insert_own on storage.objects';
  execute $p$create policy avatar_uploads_insert_own on storage.objects for insert to authenticated
    with check (bucket_id = 'avatar-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;

  execute 'drop policy if exists avatar_uploads_delete_own on storage.objects';
  execute $p$create policy avatar_uploads_delete_own on storage.objects for delete to authenticated
    using (bucket_id = 'avatar-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;
end
$avatars$;
