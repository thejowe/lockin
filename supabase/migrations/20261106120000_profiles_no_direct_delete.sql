-- LockIn — el perfil ya no se borra a pelo desde el cliente.
--
-- Hasta ahora `authenticated` podía hacer `DELETE` de su propia fila de
-- `profiles` (policy «profiles: solo borras el tuyo» + el privilegio DELETE que
-- 20260916000100 dejó a propósito) y volver a crearla con el mismo `auth.uid()`
-- (el INSERT por columnas incluye `id`). Como `user_blocks`, `like_events`,
-- `boosts` y `board_posts` cuelgan de `profiles` con ON DELETE CASCADE, ese
-- borrar-y-recrear:
--
--   - se llevaba por delante los bloqueos que OTROS le habían puesto: quien
--     estaba bloqueado reaparecía en el deck de quien le bloqueó, podía volver a
--     ver su perfil y darle like, sin que esa persona se enterase;
--   - ponía a cero los contadores del límite de likes gratis, del tope
--     antiabuso (que también ata a Premium), de Super Likes y del cooldown de
--     Boost.
--
-- Auditoría de seguridad run-1 (2026-11-06), lead
-- `supabase/profiles:direct-delete-own-row-cascade-resets-blocks-and-quotas`.
--
-- La app nunca borra el perfil así: «Borrar mi cuenta» va por
-- `delete_my_account()`, que borra `auth.users` (el uid desaparece para
-- siempre y no se puede recrear el perfil). Ese RPC es SECURITY DEFINER y
-- sigue funcionando; la cascada desde `auth.users` sigue pasando por el
-- trigger `cancel_hosted_rooms_before_profile_delete` (20261010000100).

drop policy if exists "profiles: solo borras el tuyo" on public.profiles;

revoke delete on public.profiles from public, anon, authenticated;
