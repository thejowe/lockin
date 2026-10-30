-- LockIn — retirar las herramientas de desarrollo de una base desplegada.
--
-- ## Qué retira y por qué
--
-- `supabase/seed.sql` define dos funciones que NO están en
-- `supabase/migrations/` a propósito, porque `migrations/` es la definición de
-- lo que llega a producción y ninguna de las dos debería estar allí:
--
-- - `dev_reset_current_user()` — borra el perfil, el modo, los swipes, los
--   matches y los mensajes del usuario de la sesión. Es `SECURITY DEFINER` y
--   solo mira `auth.uid()`, así que nadie puede apuntarla contra otra persona;
--   el problema no es ese. El problema es el daño colateral: al borrar un match
--   se llevan por delante los mensajes de la OTRA persona y los likes que esa
--   persona te dio. Un usuario cualquiera, sin confirmación de nada, destruye
--   datos que no son solo suyos.
--
-- - `seed_incoming_likes(text)` — inserta likes en nombre de tres perfiles
--   semilla. Escribe en `decisions` saltándose las políticas RLS.
--
-- ## Cuándo ejecutarlo
--
-- Gatillo: antes de entregar el primer APK/enlace a alguien fuera del equipo
-- de pruebas, o de importar la primera cuenta real (lo que ocurra antes).
-- No inferir su instalación actual de un resultado histórico del TODO.
-- Mientras siga siendo así, retirarlas rompe
-- `src/data/supabase/contract.test.ts`, que necesita `dev_reset_current_user()`
-- para no gastar un alta anónima por test. La salida correcta de ese nudo es
-- separar los dos papeles: la suite de contrato contra una base desechable
-- (`supabase start` + `db reset`, que aplica migraciones y seed), y el proyecto
-- remoto sin nada de esto. Ver `supabase/README.md` → "Deriva de esquema".
--
-- ## Cómo
--
-- Pega este archivo en el SQL Editor del dashboard y ejecútalo. Después,
-- `node supabase/drift-check.mjs` debe decir "NO está instalada" de las dos.
--
-- - `dev_set_premium(boolean)`, `dev_add_like_events(text, integer, integer)`,
--   `dev_age_last_decision(integer)` y `dev_add_boost(integer)` — siembran el
--   estado de Premium para la suite de contrato (20261030120000). La primera
--   convierte a cualquiera en Premium sin pasar por una tienda.
--
-- Borra las funciones, no los datos. Para los usuarios anónimos que deja la
-- suite de contrato, ver `supabase/README.md` → "Mantenimiento".

begin;
drop function if exists public.dev_reset_current_user();
drop function if exists public.seed_incoming_likes(text);
drop function if exists public.dev_set_premium(boolean);
drop function if exists public.dev_add_like_events(text, integer, integer);
drop function if exists public.dev_age_last_decision(integer);
drop function if exists public.dev_add_boost(integer);

-- No usar CASCADE: una dependencia inesperada debe bloquear la retirada.
-- Detectar también sobrecargas instaladas a mano, sin borrarlas a ciegas.
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'dev_reset_current_user', 'seed_incoming_likes', 'dev_set_premium',
        'dev_add_like_events', 'dev_age_last_decision', 'dev_add_boost'
      )
  ) then
    raise exception 'Quedan sobrecargas de funciones de desarrollo: revisar antes de liberar';
  end if;
end;
$$;
commit;

select 'Funciones de desarrollo retiradas; no se han borrado datos.' as resultado;
