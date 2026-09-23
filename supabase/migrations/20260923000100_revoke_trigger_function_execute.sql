-- `touch_updated_at()` y `messages_touch_match()` son funciones de trigger:
-- solo deben ejecutarse cuando Postgres dispara el trigger, nunca invocadas
-- directamente. Tenían EXECUTE concedido explícitamente a `anon` y
-- `authenticated` (probablemente por un `grant ... on all functions in
-- schema public` general), así que cualquiera podía llamarlas como RPC
-- (`/rest/v1/rpc/messages_touch_match`, `/rest/v1/rpc/touch_updated_at`).
-- messages_touch_match() además es SECURITY DEFINER, así que el aviso del
-- linter de Supabase es EXTERNAL/SECURITY, no solo higiene: revocar EXECUTE
-- no rompe los triggers, que no necesitan permiso de ejecución para disparar,
-- solo el privilegio de quien los crea (postgres). service_role se deja tal
-- cual: es el rol administrativo, no el que expone PostgREST a clientes.
revoke execute on function public.touch_updated_at() from anon, authenticated;
revoke execute on function public.messages_touch_match() from anon, authenticated;
