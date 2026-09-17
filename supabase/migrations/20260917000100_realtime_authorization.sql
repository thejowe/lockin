-- LockIn — Realtime Authorization de los canales de sesión.
--
-- ## Qué agujero tapa
--
-- `src/data/supabase/video-signal.ts` abre `lockin:video:<sessionId>` y
-- `src/data/supabase/presence.ts` abre `lockin:presence:<sessionId>`. Hasta esta
-- migración eran canales PÚBLICOS: Realtime no evaluaba ninguna política, así
-- que cualquier cuenta autenticada —y darse de alta es anónimo e instantáneo—
-- que conociera o adivinara un `sessionId` podía unirse a la señalización WebRTC
-- de una sesión ajena, inyectar una `offer` o leer la presencia de la pareja.
--
-- Todo el resto del esquema está cerrado tabla por tabla con RLS,
-- `is_match_member()` y RPCs `SECURITY DEFINER`. Este camino los esquivaba
-- enteros. Es la excepción, no una laguna menor.
--
-- ## Cómo se cierra
--
-- Realtime deriva los permisos de un cliente con las políticas RLS de
-- `realtime.messages`: al unirse a un topic PRIVADO inserta un mensaje, intenta
-- leerlo y revierte la transacción. Lo que esas políticas dejen pasar es lo que
-- el cliente puede hacer. `realtime.topic()` devuelve el nombre del topic al que
-- se está uniendo, que es de donde sacamos el `sessionId`.
--
-- Hacen falta LAS DOS MITADES, y una sin la otra no protege nada:
--
--   1. Estas políticas.
--   2. `config: { private: true }` en los dos `channel(...)` del cliente — sin
--      ese flag el servidor ni siquiera evalúa las políticas. Va en el mismo
--      commit que este archivo.
--
-- ## Lo que esta migración NO puede hacer (pendiente del usuario, en el panel)
--
-- Desactivar «Allow public access» en los ajustes de Realtime del proyecto. Un
-- topic es un topic: mientras el acceso público siga permitido, alguien puede
-- abrir `lockin:video:<sessionId>` SIN `private: true` y quedarse fuera del
-- alcance de estas políticas. No es una opción que se pueda tocar por SQL.
-- Está anotado en `docs/plan/todo/datos.md`.
--
-- ## Por qué el helper vive en `public`
--
-- El esquema `realtime` está cerrado: crear tablas o funciones dentro falla con
-- permiso denegado. Lo único que Supabase permite es gestionar las políticas de
-- `realtime.messages`. Así que la lógica va en `public`, como una función más
-- del bloque, y la política solo la llama.


-- ---------------------------------------------------------------------------
-- Guarda: sin RLS en `realtime.messages`, las políticas de abajo son adorno
-- ---------------------------------------------------------------------------
--
-- Supabase la trae activada de fábrica. Si algún día no lo estuviera, esta
-- migración debe MORIR en vez de dejar creado un candado que no cierra nada.
-- No se activa desde aquí a propósito: `alter table` sobre `realtime` es
-- justamente lo que el esquema bloqueado no permite.

do $do$
begin
  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'realtime'
      and c.relname = 'messages'
      and c.relrowsecurity
  ) then
    raise exception
      'realtime.messages no existe o no tiene RLS activo: las políticas de esta migración no protegerían nada'
      using errcode = '0A000';
  end if;
end;
$do$;


-- ---------------------------------------------------------------------------
-- is_session_topic_member — ¿el topic es de una sesión mía?
-- ---------------------------------------------------------------------------
--
-- El `sessionId` sale del nombre del topic y se comprueba contra
-- `lockin_sessions` → `matches` con `is_session_member()`, que ya es
-- `SECURITY DEFINER` y ya está concedida a `authenticated`. Esta envoltura no
-- necesita serlo: solo parsea y delega.
--
-- La expresión regular exige un UUID completo y el topic entero (`^…$`). Es
-- deliberadamente estricta por dos motivos: un patrón laxo como `[0-9a-f-]{36}`
-- aceptaría cadenas que no son UUID y el `::uuid` reventaría dentro de una
-- política —un error, no un «no»—, y cualquier topic que no sea nuestro debe
-- caer en el `null` y denegarse sin ruido.
--
-- `substring` sin coincidencia devuelve NULL, y `is_session_member(null)` es un
-- `exists` vacío, o sea `false`. El `coalesce` está por si esa función cambiara
-- de forma: aquí, NULL nunca puede significar «pasa».

create or replace function public.is_session_topic_member(p_topic text)
returns boolean
language sql
stable
set search_path = ''
as $fn$
  select coalesce(
    public.is_session_member(
      substring(
        p_topic
        from '^lockin:(?:video|presence):([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$'
      )::uuid
    ),
    false
  );
$fn$;

revoke execute on function public.is_session_topic_member(text) from public, anon;
grant execute on function public.is_session_topic_member(text) to authenticated;


-- ---------------------------------------------------------------------------
-- Políticas sobre realtime.messages
-- ---------------------------------------------------------------------------
--
-- Los nombres empiezan por `lockin` a propósito: `supabase/schema-fingerprint.sql`
-- solo mete en la huella las políticas de `realtime.messages` que empiezan así.
-- Las que traiga Supabase de fábrica dependen de la versión de Realtime
-- desplegada y compararlas pondría `Schema drift` en rojo por algo que este repo
-- ni pone ni puede quitar.
--
-- `drop policy if exists` antes de cada `create` para que el archivo se pueda
-- pegar dos veces en el SQL Editor sin romperse.
--
-- Las dos extensiones (`broadcast` y `presence`) van juntas en la misma política
-- en vez de una por canal: al unirse, Realtime comprueba los permisos de ambas
-- para decidir qué puede hacer la conexión, y afinar por topic aquí solo
-- serviría para que un `join` legítimo fallara por el lado que no usa.
-- La puerta que importa —de quién es la sesión— es la misma para los dos.

drop policy if exists "lockin: recibes de los canales de tus sesiones" on realtime.messages;
create policy "lockin: recibes de los canales de tus sesiones"
  on realtime.messages
  for select
  to authenticated
  using (
    extension in ('broadcast', 'presence')
    and public.is_session_topic_member((select realtime.topic()))
  );

drop policy if exists "lockin: envías a los canales de tus sesiones" on realtime.messages;
create policy "lockin: envías a los canales de tus sesiones"
  on realtime.messages
  for insert
  to authenticated
  with check (
    extension in ('broadcast', 'presence')
    and public.is_session_topic_member((select realtime.topic()))
  );
