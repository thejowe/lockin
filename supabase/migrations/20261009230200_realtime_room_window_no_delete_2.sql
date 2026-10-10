-- Auditoría de seguridad 2026-10, hallazgos H3 y H4.
--
-- H3. `is_room_topic_member` solo exigía `is_room_attendee`: una invitada
-- aceptada podía abrir el canal de presencia de la sala MUCHO antes de la
-- ventana y, ya autorizada (Realtime cachea la decisión hasta renovar el JWT),
-- rechazar después y seguir viendo la presencia. Ahora la autorización exige lo
-- mismo que `join_room`: sala no cancelada y dentro de la ventana de entrada
-- (de 5 minutos antes del inicio hasta el fin de la sesión), con el reloj del
-- servidor. SECURITY INVOKER, como antes: el SELECT de sala sigue sujeto a su
-- RLS. Es VOLATILE porque lee `clock_timestamp()`.
--
-- H4. Las tablas que LockIn publica por `supabase_realtime` salieron con
-- `publish = insert, update, delete, truncate`. RLS filtra INSERT/UPDATE pero
-- Realtime entrega los DELETE sin comprobar la fila: quien escuche
-- `session_attendance` recibía `(session_id, profile_id)` de gente ajena al
-- borrarse una cuenta o un match. Se publica solo INSERT y UPDATE: ningún
-- cliente de la app escucha DELETE (los canales piden INSERT/UPDATE
-- explícitos; las suscripciones están en `src/data/supabase/`).
--
-- Efecto lateral a conocer: la publicación es de toda la base, así que
-- cualquier tabla futura que la use tampoco emitirá DELETE ni TRUNCATE; hay
-- que avisar con UPDATE (borrado lógico) o Broadcast privado.
--
-- Idempotente: `create or replace` y `alter publication ... set` se pueden
-- repetir.

create or replace function public.is_room_topic_member(p_topic text)
returns boolean
language sql
volatile
set search_path = ''
as $fn$
  select exists (
    select 1
    from public.lockin_rooms r
    where r.id = substring(
      p_topic
      from '^lockin:room:([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$'
    )::uuid
      and (select auth.uid()) is not null
      and public.is_room_attendee(r.id)
      and r.cancelled_at is null
      and clock_timestamp() >= r.starts_at - interval '5 minutes'
      and clock_timestamp() < public.session_ends_at(r.starts_at, r.blocks)
  );
$fn$;

revoke execute on function public.is_room_topic_member(text) from public, anon;
grant execute on function public.is_room_topic_member(text) to authenticated;

alter publication supabase_realtime set (publish = 'insert, update');
