-- LockIn — los canales de `postgres_changes` pasan a ser privados.
--
-- Por qué (auditoría de seguridad run-1, 2026-11-06, lead
-- `realtime-public-channel-same-topic-bypasses-private-policies`):
--
-- Los canales de vídeo, presencia y salas (`lockin:video|presence|room:<uuid>`)
-- solo los protegen las políticas de `realtime.messages`, y Realtime solo las
-- mira si el cliente se une con `private: true`. Mientras el proyecto tenga
-- «Allow public access» ACTIVADO, cualquiera que conozca el uuid de una sesión
-- o sala —p. ej. un compañero que luego fue bloqueado— puede abrir el mismo
-- topic SIN `private: true` y quedarse fuera de esas políticas
-- (20260917000100). Ese ajuste seguía activado solo porque los cuatro canales
-- de `postgres_changes` del cliente (`lockin:matches`, `lockin:messages:<match>`,
-- `lockin:rooms`, `lockin:sessions:<match>`) eran públicos.
--
-- Esta migración da a esos cuatro topics la política que necesitan para unirse
-- como privados; el cliente pasa a abrirlos con `private: true` en el mismo
-- commit. Los datos que llegan por ellos los sigue filtrando la RLS de cada
-- tabla, como hasta ahora: la política solo decide quién puede UNIRSE.
--
-- Solo SELECT, sin INSERT: nadie puede emitir broadcast ni presence en estos
-- topics. Las dos extensiones van juntas por lo mismo que en 20260917000100: al
-- unirse, Realtime comprueba los permisos de ambas.
--
-- ## Lo que queda en el panel (usuario), y en qué orden
--
-- 1. Aplicar esta migración.
-- 2. Publicar la build del cliente con `private: true` y esperar a que las
--    versiones antiguas dejen de usarse: una build vieja abre estos canales como
--    públicos y, con el acceso público apagado, dejaría de recibir avisos en
--    vivo (las pantallas se siguen leyendo, pero sin refresco instantáneo).
-- 3. Desactivar «Allow public access» en Realtime → Settings. Ese paso es el que
--    cierra el hueco; sin él, esta migración no cambia nada.

create or replace function public.is_changes_topic_member(p_topic text)
returns boolean
language sql
stable
set search_path = ''
as $fn$
  select case
    -- Los avisos de matches y salas son de toda la cuenta: la RLS de
    -- `matches` y `lockin_rooms` ya filtra qué filas llegan a cada uno.
    when p_topic in ('lockin:matches', 'lockin:rooms') then (select auth.uid()) is not null
    -- Mensajes y sesiones van por match: solo sus dos miembros, sin bloqueo.
    else coalesce(
      public.is_unblocked_match(
        substring(
          p_topic
          from '^lockin:(?:messages|sessions):([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$'
        )::uuid
      ),
      false
    )
  end;
$fn$;

revoke execute on function public.is_changes_topic_member(text) from public, anon;
grant execute on function public.is_changes_topic_member(text) to authenticated;

drop policy if exists "lockin: recibes los avisos de tus datos" on realtime.messages;
create policy "lockin: recibes los avisos de tus datos"
  on realtime.messages
  for select
  to authenticated
  using (
    extension in ('broadcast', 'presence')
    and public.is_changes_topic_member((select realtime.topic()))
  );
