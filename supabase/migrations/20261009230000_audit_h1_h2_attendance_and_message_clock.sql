-- Auditoría de seguridad 2026-10 (docs/plan/auditoria-seguridad-2026-10.md):
-- arreglos de H1 y H2. H3 y H4 quedan fuera de esta migración.
--
-- Las migraciones anteriores ya están aplicadas: aquí solo hay CREATE OR REPLACE
-- y REVOKE/GRANT, nada que reescriba historia.


-- ---------------------------------------------------------------------------
-- H1 — `session_both_attended(uuid)` solo habla con quien es del match
-- ---------------------------------------------------------------------------
--
-- Era SECURITY DEFINER y contaba la asistencia sin mirar quién preguntaba: un
-- no-miembro que conociera el UUID de una sesión ajena averiguaba, llamándola
-- por RPC, si las dos personas entraron. Un booleano también es información.
--
-- Ahora devuelve false a quien no es de la pareja del match de la sesión, y a
-- quien llama sin sesión (`auth.uid()` NULL). Quienes la usan —`rate_session`,
-- `match_streaks`— son SECURITY DEFINER y siguen viendo el mismo `auth.uid()`
-- del actor, que es miembro de los matches que consultan, así que no cambia
-- nada para ellos. Se conservan firma, volatilidad, SECURITY DEFINER,
-- search_path vacío y la definición de «asistió»: entró antes de que la sesión
-- acabara; irse antes no lo deshace (`left_at` no se mira).
--
-- No nombra `session_ratings`: la decisión de privacidad de la valoración exige
-- que el helper de asistencia no la lea.

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
  ), false);
$fn$;

-- CREATE OR REPLACE conserva los EXECUTE; se repiten para que la migración sea
-- legible sola y no dependa de la anterior.
revoke execute on function public.session_both_attended(uuid) from public, anon;
grant execute on function public.session_both_attended(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- H2 — el cliente no escribe `messages.sent_at`
-- ---------------------------------------------------------------------------
--
-- El DEFAULT `now()` solo actúa si la columna se omite, y `authenticated`
-- conservaba el INSERT de tabla: un cliente propio podía mandar
-- `sent_at = 'infinity'` (o una fecha lejana), el trigger lo copiaba a
-- `matches.last_message_at` y `last_messages_for_matches` seguía eligiendo ese
-- mensaje por encima de los legítimos de la otra persona.
--
-- Se retira el INSERT de tabla y se concede solo lo que envía la app
-- (`MessageRepository.send`: match_id, sender_id, body; `id` tiene default y se
-- admite por si un cliente quiere generarlo). `sent_at` queda fuera: lo pone la
-- base. REVOKE de tabla ya retira también los permisos de columna del mismo
-- privilegio, así que no hace falta un revoke por columna.
--
-- La política INSERT de RLS no cambia (autor propio y pertenencia al match).
-- El RETURNING del cliente (`insert(...).select('*')`) usa el SELECT de tabla,
-- que se conserva. SELECT, UPDATE y DELETE de tabla no se tocan: UPDATE/DELETE
-- siguen sin política, así que no se pueden usar.
--
-- No repara fechas ya falsificadas: identificarlas y sanearlas es una decisión
-- aparte, sin borrar ni reordenar datos a ciegas.

revoke insert on table public.messages from public, anon, authenticated;
grant insert (id, match_id, sender_id, body) on table public.messages to authenticated;
