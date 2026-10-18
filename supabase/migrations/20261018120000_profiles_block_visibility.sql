-- cofounder — un bloqueo también esconde el perfil y su foto en el servidor (2026-10-18).
--
-- Hasta ahora un bloqueo solo lo aplicaba la interfaz para el perfil: la lectura
-- de `profiles` era `using (true)` (20260905000400) y la política de lectura de
-- `avatars` (20261016120000) solo pedía que la ruta fuera la foto publicada de
-- algún perfil. Con la API, una persona bloqueada podía seguir leyendo el perfil
-- de la otra y firmar su foto. Los matches, el chat, el deck, las salas y el
-- tablón ya respetaban el bloqueo (20261009224000, 20261009231000, 20261017130000).
--
-- Ahora, como en `board_posts`: el propio perfil siempre se lee; el de otra
-- persona, solo si no hay bloqueo en ningún sentido (`has_profile_block`).
--
-- Qué no cambia:
--   * Las funciones SECURITY DEFINER (`record_decision`, `delete_my_account`,
--     `block_profile`, salas…) leen `profiles` como dueño de la tabla y no pasan
--     por esta política. `discovery_deck` es de invocador, pero ya excluía los
--     bloqueos.
--   * Escritura: INSERT/UPDATE/DELETE siguen limitados al propio perfil, que
--     sigue siendo legible, así que `upsert(...).select()` no cambia.
--   * El cliente ya tolera un perfil que no se puede leer (match o miembro de
--     sala sin perfil se omite), y esos matches ya los esconde su propia RLS.
--
-- Idempotente a propósito: `drop ... if exists` + `create`, para que se pueda
-- volver a ejecutar entera (los tests de esquema lo hacen con un `storage`
-- simulado, que PGlite no tiene).

drop policy if exists "profiles: cualquier autenticado puede leer" on public.profiles;
drop policy if exists "profiles: se leen sin bloqueo" on public.profiles;
create policy "profiles: se leen sin bloqueo"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or not public.has_profile_block(id));

-- La subconsulta sobre `profiles` ya hereda la política de arriba (corre como
-- `authenticated`), pero el bloqueo va también explícito aquí: si algún día se
-- abre la lectura de perfiles, la foto no se abre con ella sin que nadie lo vea.
do $avatars$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'profiles_block_visibility: no hay esquema storage, se omite la política de avatars';
    return;
  end if;

  execute 'drop policy if exists avatars_read_published on storage.objects';
  execute $p$create policy avatars_read_published on storage.objects for select to authenticated
    using (
      bucket_id = 'avatars'
      and exists (
        select 1 from public.profiles p
        where p.avatar_url = storage.objects.name
          and (p.id = (select auth.uid()) or not public.has_profile_block(p.id))
      )
    )$p$;
end
$avatars$;
