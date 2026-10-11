-- `session_both_attended(uuid)` cierra por bloqueo.
--
-- Última definición: 20261009230000_audit_h1_h2_attendance_and_message_clock.sql
-- (auditoría H1: solo contesta a quien es del match). Cambio: si el match tiene
-- un bloqueo entre las dos personas —en cualquier dirección— devuelve false.
--
-- Hueco que cierra: la política `lockin_sessions: lees las de tus matches` usa
-- `is_match_member` (sin bloqueo), así que una pareja bloqueada aún puede leer
-- los ids de sesión y llamar a la función por RPC para averiguar «entraron los
-- dos». Sus consumidores SQL (`match_streaks`, `ratable_session`,
-- `rate_session`) y `session_attendance` ya cierran por bloqueo; esto alinea el
-- helper con ellos.
--
-- `is_unblocked_match` es PL/pgSQL a propósito (ver 20261009224000): un helper
-- SQL no inlinable conservaría el `auth.uid()` del primer actor durante toda la
-- transacción del arnés. Aquí solo se llama; no cambia nada para parejas sin
-- bloqueo. Se conservan firma, volatilidad, SECURITY DEFINER, search_path vacío
-- y la definición de «asistió». No nombra `session_ratings`.

create or replace function public.session_both_attended(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce((
    select 2 = (
      select count(*)
      from public.session_attendance a
      where a.session_id = s.id
        and a.profile_id in (m.profile_a, m.profile_b)
        and a.joined_at < public.session_ends_at(s.starts_at, s.blocks)
    )
    from public.lockin_sessions s
    join public.matches m on m.id = s.match_id
    where s.id = p_session_id
      and (select auth.uid()) is not null
      and (select auth.uid()) in (m.profile_a, m.profile_b)
      and public.is_unblocked_match(m.id)
  ), false);
$fn$;

revoke execute on function public.session_both_attended(uuid) from public, anon;
grant execute on function public.session_both_attended(uuid) to authenticated;
