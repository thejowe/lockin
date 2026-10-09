# Auditoría de seguridad del esquema de LockIn — octubre de 2026

Fecha: 2026-10-09. Checkout auditado: `0cddbbbae3a894c64e2be04f2c74c081602db8e6`.
Alcance: las 20 migraciones de `supabase/migrations/`, aplicadas en orden lexicográfico, y su catálogo final. Contexto leído: `CONCEPTO.md`, `PLAN.md`, `TODO.md` y las especificaciones de acuerdo y salas. Consultada también la documentación exacta de [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/), como exige AGENTS.md.

**Resultado: 4 hallazgos: 0 críticos, 0 altos, 3 medios y 1 bajo.** No se han aplicado los arreglos propuestos. Solo se ha creado este informe; no se han modificado migraciones ni casillas de TODO. No se han consultado ni ejecutado comandos contra ningún proyecto Supabase remoto.

## Método, evidencia y límites

Se ha ejecutado SQL real sobre **PostgreSQL 17.5**, compilado a WASM por Emscripten y distribuido mediante `@electric-sql/pglite@0.3.14`; Node `v24.18.0`. La base es efímera, en memoria, sin archivos de datos. No es un mock de SQL: se ejecutan el catálogo, permisos, RLS, PL/pgSQL y los errores de PostgreSQL. Esta máquina no dispone de Docker, `psql`, `pg_ctl` ni servidor Postgres instalado: **no se ha probado contra un servidor PostgreSQL nativo ni una instancia completa de Supabase local**.

La fixture de plataforma se extrae de `supabase/schema-embedded.test.mjs`: Auth mínimo, roles `anon/authenticated/service_role`, privilegios por defecto de tabla en `public`, publicación `supabase_realtime` y `realtime.messages` con RLS. Para las sondas, `auth.uid()` lee un GUC local que representa el `sub` validado por el gateway. Cambiar ese GUC en el arnés no demuestra que un cliente HTTP pueda cambiar su JWT. Las llamadas de atacante se ejecutan con `SET LOCAL ROLE authenticated`, no como administrador.

| Comprobación ejecutada | Resultado |
|---|---|
| `node --test supabase/schema-embedded.test.mjs` | 55 pruebas pasadas, 0 fallos, 0 omitidas; incluye permisos, relojes, salas y ciego |
| Arnés específico de esta auditoría, incluido al final | 89 casos pasados; cada caso puede contener varias aserciones |
| WALRUS oficial sobre WAL sintético de asistencia | 2 controles pasados: INSERT ajeno denegado; DELETE ajeno entregado |
| Huella antes de datos y fixtures adicionales de WALRUS | `digest 38b864ba794cd4be6840c5e83e977a51`, 582 líneas de objetos |
| Catálogo final de las migraciones | 11 tablas con RLS, 41 funciones, 27 SECURITY DEFINER, 0 vistas SQL |

Para H4 se han cargado **solo en la base efímera** el SQL original de [supabase/walrus, commit 493794f1d1f7c17ec97751c2f2b66c8f02788385](https://github.com/supabase/walrus/tree/493794f1d1f7c17ec97751c2f2b66c8f02788385/sql) y sus 17 migraciones. Se ha llamado a `realtime.apply_rls` con registros WAL sintéticos. Esto verifica su decisión de autorización en PostgreSQL; no se ha generado WAL mediante un slot de replicación ni observado tráfico WebSocket. No se afirma que ese commit sea la versión desplegada en el proyecto remoto.

Para H3 se ha reproducido la autorización SQL temprana y el rechazo posterior. La retención de autorización en una conexión es una **inferencia apoyada en el comportamiento documentado de Realtime**, no una captura de una conexión viva. [Supabase documenta que los permisos se cachean hasta renovar JWT o desconectar](https://supabase.com/docs/guides/realtime/authorization#updating-rls-policies).

PGlite tiene una conexión: no se ha probado contención entre dos transacciones simultáneas. Los tests existentes cruzan plazos dentro de una transacción y examinan que el reloj se capture después del bloqueo. La huella es la de esta fixture, **no un certificado del despliegue**. Además del SQL de huella se han inspeccionado propietarios, privilegios efectivos, vistas, RLS y opciones de publicación, que esa huella no cubre completamente.

Se revisaron los cambios vigentes de plataforma: el esquema `realtime` está cerrado a modificaciones, pero las políticas de `realtime.messages` siguen admitidas. Los arreglos propuestos no crean objetos en ese esquema. [Changelog oficial](https://supabase.com/changelog/realtime-schema-locked-down-against-modification).

## Reconstrucción en orden

Todos los archivos siguientes se leyeron enteros y se ejecutaron sin editar. El resultado auditado es el estado después de la última fila.

| Migración | Efecto relevante para seguridad |
|---|---|
| `20260905000100_enums_and_helpers.sql` | Enums, dos validadores puros y trigger de timestamps; funciones con search_path vacío |
| `20260905000200_profiles_and_settings.sql` | Perfiles y ajustes; FKs a Auth; timestamps por defecto |
| `20260905000300_decisions_matches_messages.sql` | Decisiones privadas, parejas canónicas, mensajes y helper invoker de pertenencia |
| `20260905000400_rls_policies.sql` | RLS y cierre de anon en las cinco tablas; lectura pública entre autenticados solo de perfiles |
| `20260905000500_functions_and_realtime.sql` | RPC de reciprocidad; deck invoker; trigger privilegiado; publicación de matches/messages |
| `20260907000100_profiles_seeking_specialties.sql` | Añade especialidades buscadas; sin ampliación de visibilidad |
| `20260907000200_discovery_mutual_complement.sql` | Reemplaza el cuerpo del deck; conserva invoker y ACL |
| `20260913000100_lockin_sessions.sql` | Sesiones/asistencia con lectura por pertenencia; RPC y helpers; publicación de ambas tablas |
| `20260915000100_session_ratings.sql` | Valoración propia y sin Realtime; introduce helper de asistencia de H1 |
| `20260915000200_match_streaks.sql` | Rachas restringidas a los matches del actor; no lee valoraciones |
| `20260916000100_github_verification.sql` | Sello obtenido de Auth; retira INSERT/UPDATE de tabla y concede columnas concretas |
| `20260917000100_realtime_authorization.sql` | Guarda RLS de realtime.messages, topics estrictos de sesión y políticas de lectura/escritura |
| `20260918000100_deck_exclude_last_messages_active_session.sql` | Deck de cuatro argumentos, último mensaje invoker y sesión viva decidida por servidor |
| `20260923000100_revoke_trigger_function_execute.sql` | Revoca roles explícitos en triggers; todavía no cierra EXECUTE heredado de PUBLIC |
| `20260924000100_revoke_trigger_function_execute_from_public.sql` | Cierra también PUBLIC; corrige la migración anterior |
| `20260924000200_agreement_answers.sql` | Respuestas propias; escritura por RPC; revelación por tema dentro del match Par |
| `20260929000100_record_decision_deck_mode.sql` | DROP de firma antigua y recreación con modo; restablece EXECUTE solo authenticated |
| `20260929000200_drop_discovery_deck_overload.sql` | Elimina la sobrecarga antigua del deck; no queda RPC alternativo con cuerpo obsoleto |
| `20261002000100_lockin_rooms.sql` | Tablas SELECT-only; ciego por RLS; reloj del servidor; publica sala, no miembros; presencia de H3 |
| `20261003000100_harden_grants_and_clock.sql` | Retira TRUNCATE/REFERENCES/TRIGGER; sustituye validaciones temporales de sesión/rating tras bloqueo |

Los antiguos grants de TRUNCATE y el EXECUTE heredado de los triggers **no se cuentan como hallazgos presentes**: las migraciones posteriores los cierran en el estado final.

## Hallazgos

Los escenarios distinguen a **A, atacante**, de **B, víctima**. C/D son perfiles auxiliares de la fixture cuando hace falta una pareja de B que excluya a A, o una sala de al menos tres miembros; no son atacantes adicionales.

### H1 — Helper de asistencia consultable por un no-miembro

**Gravedad: baja.** Fuga de un booleano de actividad privada; exige conocer un UUID de sesión ajena. No entrega mensajes ni valoraciones y no permite escrituras.

**Objeto:** `public.session_both_attended(uuid)`, leyendo `lockin_sessions`, `matches` y `session_attendance`.
**Origen:** `supabase/migrations/20260915000100_session_ratings.sql:78–95`; EXECUTE a `authenticated` en línea 202. No lo cambia ninguna migración posterior.

La función es SECURITY DEFINER y cuenta la asistencia sin verificar `auth.uid()` ni pertenencia al match. Un booleano también es información. En contraste, `is_session_member`, `ratable_session` y `match_streaks` sí restringen al actor.

**Escenario A/B:** B comparte S con C. A no pertenece al match y conoce S, por ejemplo por un enlace compartido. A no puede leer la tabla de asistencia, pero puede llamar directamente al helper para averiguar si B y su pareja entraron. Las RPC principales no son el único punto de entrada.

**Reproducción observada**, con S = `20000000-0000-4000-8000-000000000001` y A = `00000000-0000-4000-8000-00000000aaaa`:

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub',
  '00000000-0000-4000-8000-00000000aaaa', true);

select * from public.session_attendance
where session_id = '20000000-0000-4000-8000-000000000001';
-- 0 filas

select public.is_session_member(
  '20000000-0000-4000-8000-000000000001');
-- false

select public.session_both_attended(
  '20000000-0000-4000-8000-000000000001');
-- true
rollback;
```

El arnés también obtuvo `true` bajo el rol authenticated con `auth.uid() = NULL`. Esto señala la ausencia de la guarda interna; **anon real recibe 42501**, no hay una ruta HTTP sin sesión demostrada.

**SQL del arreglo propuesto — NO aplicado.** Conservar la firma, añadir pertenencia y devolver false a no-miembros. Las funciones privilegiadas que lo usan siguen disponibles porque el actor continúa siendo el mismo `auth.uid()`.

```sql
begin;
create or replace function public.session_both_attended(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1
    from public.lockin_sessions s
    join public.matches m on m.id = s.match_id
    where s.id = p_session_id
      and (select auth.uid()) is not null
      and (select auth.uid()) in (m.profile_a, m.profile_b)
      and 2 = (
        select count(*)
        from public.session_attendance a
        where a.session_id = s.id
          and a.profile_id in (m.profile_a, m.profile_b)
          and a.joined_at < public.session_ends_at(s.starts_at, s.blocks)
      )
  );
$fn$;
revoke execute on function public.session_both_attended(uuid)
  from public, anon;
grant execute on function public.session_both_attended(uuid)
  to authenticated;
commit;
```

### H2 — El cliente puede falsificar la fecha de un mensaje

**Gravedad: media.** Manipulación persistente de la cronología y del resumen de la conversación de B, limitada a un match del atacante.

**Objetos:** `public.messages.sent_at`, `messages_touch_match()`, `matches.last_message_at`, `last_messages_for_matches(uuid[])`.
**Origen:** `20260905000300_decisions_matches_messages.sql:72–78`; política INSERT en `20260905000400_rls_policies.sql:121–127`; copia privilegiada de la fecha en `20260905000500_functions_and_realtime.sql:182–194`; orden del último mensaje en `20260918000100_deck_exclude_last_messages_active_session.sql:86–96`. Rutas bajo `supabase/migrations/`.

El DEFAULT `now()` solo actúa cuando se omite la columna. authenticated conserva INSERT de tabla y la política valida autor/pertenencia, no `sent_at`. El cliente oficial omite la fecha (`src/data/supabase/index.ts:604–611`), pero un cliente propio la puede enviar. El endurecimiento del 3 de octubre no modifica este permiso.

**Escenario A/B:** A y B tienen M. A inserta su mensaje con `sent_at = 'infinity'` —también vale una fecha lejana finita—. B ve ese mensaje en el futuro. La inserción copia la fecha a `last_message_at`. Cuando B envía un mensaje legítimo, el trigger devuelve `last_message_at` al presente, **pero la RPC del último mensaje sigue escogiendo el de A** por su `sent_at` mayor. No se afirma que el match quede fijado para siempre después del siguiente mensaje: lo persistente es la cronología y el resumen equivocados.

**Reproducción observada:**

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub',
  '00000000-0000-4000-8000-00000000aaaa', true);

insert into public.messages(match_id, sender_id, body, sent_at)
values (
  '10000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-00000000aaaa',
  'A futuro', 'infinity'
);
select last_message_at::text from public.matches
where id = '10000000-0000-4000-8000-000000000001';
-- infinity

select set_config('request.jwt.claim.sub',
  '00000000-0000-4000-8000-00000000bbbb', true);
insert into public.messages(match_id, sender_id, body)
values (
  '10000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-00000000bbbb',
  'B legitimo'
);
select body, sent_at::text
from public.last_messages_for_matches(
  array['10000000-0000-4000-8000-000000000001'::uuid]
);
-- A futuro | infinity
rollback;
```

**SQL del arreglo propuesto — NO aplicado.** Retirar INSERT de tabla y conceder solo las columnas que envía la app. El DEFAULT de la base asignará `sent_at`. Se retira también cualquier ACL previa de INSERT de esa columna para no dejar una puerta residual.

```sql
begin;
revoke insert on table public.messages from public, anon, authenticated;
revoke insert (sent_at) on table public.messages
  from public, anon, authenticated;
grant insert (id, match_id, sender_id, body)
  on table public.messages to authenticated;
commit;
```

Compatible con el envío actual, que no incluye `sent_at`. No repara las fechas ya falsificadas: su identificación y saneamiento exigirían una decisión separada, sin borrar ni reordenar datos a ciegas.

### H3 — Autorización temprana de presencia permite conservar acceso tras rechazar una sala

**Gravedad: media.** Acceso a presencia futura de B por una invitada que ya rechazó la sala. Requiere que A estuviera previamente aceptada y conserve la conexión/JWT válido.

**Objetos:** `public.is_room_topic_member(text)` y políticas de `realtime.messages` para salas.
**Origen:** `supabase/migrations/20261002000100_lockin_rooms.sql:448–463` y `468–486`. El cambio de estado todavía permitido antes de la ventana está en `246–286`, en especial `275–276`.

La política solo exige `is_room_attendee`: no exige que haya abierto la ventana de entrada. La spec asume que el cliente abre el canal dentro de esa ventana; ese comportamiento no se impone en SQL. Cerrar las respuestas al abrir la ventana no evita que un cliente malicioso se autorice antes.

**Escenario A/B:**

1. C convoca R; A acepta. Faltan 10 minutos para empezar.
2. A abre directamente el canal privado `lockin:room:<R>`. La política lo autoriza aunque falten más de 5 minutos.
3. A rechaza cuando faltan 6 minutos. La RPC lo permite y A deja de leer la sala por RLS.
4. B entra cuando faltan 5 minutos. A mantiene su conexión anterior y puede seguir recibiendo su presencia hasta que se revalide o expire el JWT. La autorización cacheada no vuelve a ejecutar RLS por mensaje. [Comportamiento oficial documentado](https://supabase.com/docs/guides/realtime/authorization#updating-rls-policies).

**Reproducción SQL observada:** en la fixture R empieza dentro de 10 minutos. Se autoriza el helper, se permite el INSERT de autorización de presence y después se permite rechazar.

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub',
  '00000000-0000-4000-8000-00000000aaaa', true);
select set_config('realtime.topic',
  'lockin:room:30000000-0000-4000-8000-000000000001', true);

select public.is_room_topic_member(
  'lockin:room:30000000-0000-4000-8000-000000000001');
-- true, antes de la ventana

insert into realtime.messages(topic, extension)
values (
  'lockin:room:30000000-0000-4000-8000-000000000001',
  'presence'
);
-- permitido

select status from public.respond_room(
  '30000000-0000-4000-8000-000000000001', 'rechazada');
-- rechazada

select public.is_room_topic_member(
  'lockin:room:30000000-0000-4000-8000-000000000001');
-- false para nuevas autorizaciones; no revoca la conexión ya autorizada
rollback;
```

No se ha probado la retención de la conexión WebSocket en vivo. Lo confirmado es la secuencia SQL que hace posible el escenario bajo la caché documentada.

**SQL del arreglo propuesto — NO aplicado.** Exigir también sala no cancelada y ventana vigente usando reloj del servidor. Se conserva SECURITY INVOKER: el SELECT de sala queda sujeto a su RLS.

```sql
begin;
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
      p_topic from
      '^lockin:room:([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$'
    )::uuid
      and (select auth.uid()) is not null
      and public.is_room_attendee(r.id)
      and r.cancelled_at is null
      and clock_timestamp() >= r.starts_at - interval '5 minutes'
      and clock_timestamp() < public.session_ends_at(r.starts_at, r.blocks)
  );
$fn$;
revoke execute on function public.is_room_topic_member(text)
  from public, anon;
grant execute on function public.is_room_topic_member(text)
  to authenticated;
commit;
```

Esto cierra la autorización previa a la ventana que permite `aceptada → rechazada` conservando canal. No expulsa conexiones preexistentes ni impone expiración del canal al final de la sala: la revocación inmediata exige soporte del servidor Realtime. Tras desplegarlo habría que invalidar/revalidar conexiones ya abiertas. No se ha ejecutado ninguna de esas acciones.

### H4 — Publicación de DELETE filtra identificadores y relaciones ajenas

**Gravedad: media.** Observación sistemática de metadatos privados desde una cuenta autenticada cualquiera. La PK compuesta de asistencia vincula una persona concreta con una sesión.

**Objetos:** publicación `supabase_realtime`; principalmente `public.session_attendance`, también IDs de `matches/messages/lockin_sessions/lockin_rooms`.
**Origen:** `supabase/migrations/20260913000100_lockin_sessions.sql:355–363`; publicación inicial de matches/messages en `20260905000500_functions_and_realtime.sql:224–232`; publicación de salas en `20261002000100_lockin_rooms.sql:429–435`. La PK de asistencia está en `20260913000100_lockin_sessions.sql:33–39`; la posibilidad de borrar el perfil propio, en `20260905000400_rls_policies.sql:50–53`.

Las migraciones añaden tablas a la publicación de plataforma sin cerrar `publish=delete`. En la fixture Supabase, `pubdelete=true`. RLS filtra los INSERT/UPDATE, pero el código oficial WALRUS entrega DELETE sin comprobar la fila eliminada. Con RLS activo reduce `old_record` a la PK: **no se ha observado fuga de body, rating ni nota**. Para asistencia la PK ya contiene `(session_id, profile_id)`. [Documentación oficial sobre DELETE](https://supabase.com/docs/guides/realtime/postgres-changes#receiving-old-records).

**Escenario A/B:** A no tiene match con B y se suscribe sin filtro a DELETE de `session_attendance`. B borra su propio perfil, una operación admitida, o un proceso administrativo retira su match/sesión. Las FKs borran la asistencia de B y de C. A recibe los IDs de la sesión y de ambas personas y puede relacionarlas. La lectura ordinaria de A devolvía cero filas. B es el usuario que desencadena la cascada; A solo escucha.

La sala tiene una fuga menor del mismo mecanismo: su DELETE entrega el ID. Escuchar solo UPDATE en el cliente oficial, como comenta la migración de salas, no impide que A construya un cliente que pida DELETE. `room_members` sí está fuera de la publicación y no filtra las identidades de invitados por este camino.

**Evidencia ejecutada en PostgreSQL:**

```text
supabase_realtime:
  pubinsert=true, pubupdate=true, pubdelete=true, pubtruncate=true
tablas:
  lockin_rooms, lockin_sessions, matches, messages, session_attendance

A SELECT asistencia de S: 0 filas
B DELETE su propio perfil: la asistencia de S desaparece por cascada

WALRUS oficial, suscripción authenticated de A a session_attendance:
  INSERT de asistencia de B:
    is_rls_enabled=true, subscription_ids=[], errors=[]
  DELETE de la misma asistencia:
    is_rls_enabled=true
    subscription_ids=["40000000-0000-4000-8000-000000000001"]  (A)
    old_record={
      "profile_id":"00000000-0000-4000-8000-00000000bbbb",
      "session_id":"20000000-0000-4000-8000-000000000001"
    }
    errors=[]
```

El arnés incluye los eventos sintéticos exactos y el commit de WALRUS fijado. La cascada se ha ejecutado por separado en PostgreSQL; no se afirma haber capturado su WAL ni un evento WebSocket. La configuración efectiva del remoto no se ha inspeccionado: si allí ya se excluyen DELETE, H4 estaría mitigado en ese despliegue, pero esa mitigación no queda declarada por las migraciones del repo.

**SQL del arreglo propuesto — NO aplicado.** Como mitigación de la publicación dedicada de LockIn, publicar únicamente INSERT/UPDATE. Impide el flujo de DELETE para las cinco tablas, sin depender del filtro que el cliente elija.

```sql
begin;
alter publication supabase_realtime
  set (publish = 'insert, update');
commit;
```

El código oficial de [Realtime list_changes, commit d46540b3a4a79113f40301d5e5cb690f41150b9b](https://github.com/supabase/realtime/blob/d46540b3a4a79113f40301d5e5cb690f41150b9b/priv/repo/tenant_schema/realtime/functions/list_changes.sql) deriva las acciones de wal2json de pubinsert/pubupdate/pubdelete; se ha revisado ese código, sin ejecutar un slot. Afecta a todas las tablas de esa publicación y deja de emitir avisos de borrado. Si otros consumidores requieren DELETE, hay que sustituir esos avisos por invalidaciones UPDATE o Broadcast privado autorizado antes de hacer el cambio. No basta con `replica identity default`: la PK sigue existiendo. Tampoco basta con un filtro/evento del cliente oficial.

## Huella y áreas sin hallazgos adicionales

### RLS y privilegios de tablas

Las 11 tablas tienen RLS activo; en la fixture su propietario es postgres. No son FORCE RLS: las funciones SECURITY DEFINER operan con privilegios del propietario y deben comprobar autorización explícitamente. Esto es el diseño previsto, no una escalada adicional.

| Tabla | Acceso efectivo permitido por RLS al cliente autenticado |
|---|---|
| `profiles` | SELECT de todos los perfiles; INSERT/UPDATE/DELETE solo del propio; sello GitHub excluido de columnas escribibles |
| `user_settings` | SELECT/INSERT/UPDATE/DELETE de la fila propia |
| `decisions` | SELECT/INSERT solo como actor; no lectura de likes entrantes ni UPDATE/DELETE directo |
| `matches` | SELECT solo siendo uno de los dos; ninguna escritura directa |
| `messages` | SELECT del match propio; INSERT con sender propio y pertenencia; sin UPDATE/DELETE |
| `lockin_sessions` | SELECT de sesiones de matches propios; mutaciones por RPC |
| `session_attendance` | SELECT siendo miembro de la sesión; mutaciones por RPC |
| `session_ratings` | SELECT solo de la valoración propia; mutaciones por RPC; no publicada |
| `agreement_answers` | SELECT propio; ninguna escritura de tabla; revelación ajena solo por RPC |
| `lockin_rooms` | SELECT con membresía no rechazada; ninguna escritura de tabla |
| `room_members` | Fila propia, todas si convocas, o aceptadas si participas; ninguna escritura de tabla; no publicada |

Los grants heredados de tabla siguen concediendo INSERT/UPDATE/DELETE en `matches`, sesiones, asistencia y valoraciones; **la ausencia de políticas de escritura impide usarlos**. `agreement_answers` y tablas de salas cierran también los grants. La mayor amplitud de ACL en tablas anteriores es defensa menos estricta, pero no una explotación demostrada bajo la RLS actual.

**Sin hallazgos adicionales:** SELECT/UPDATE de datos privados ajenos e INSERT de mensajes suplantando a B o en un match ajeno han sido denegados.

**Sin hallazgos:** TRUNCATE/REFERENCES/TRIGGER no son privilegios efectivos de anon ni authenticated en ninguna tabla después de `20261003000100`; la suite ejecutó los TRUNCATE y comprobó 42501.

**Sin hallazgos:** anon no lee ninguna de las 11 tablas y no ejecuta ninguna de las 27 funciones SECURITY DEFINER. No hay grants de tabla a PUBLIC en esta reconstrucción. No se ha auditado un GRANT manual o pertenencia a roles del remoto.

La lectura global de perfiles está expresamente autorizada por `20260905000400:27–37` y necesaria para el deck. Incluye campos del perfil y enlaces, no email/Auth, settings, mensajes o ratings: no se ha reclasificado esa decisión consciente como fuga.

### SECURITY DEFINER, sesión y códigos de error

Las 27 funciones tienen `search_path=''`, propietario postgres y referencias de tablas y helpers cualificadas. No se ha encontrado SQL dinámico controlado por cliente en ellas. Los helpers invoker y los validadores también fijan search_path. [PostgreSQL explica la necesidad de fijarlo y revocar PUBLIC](https://www.postgresql.org/docs/17/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY).

| Familia SECURITY DEFINER | Funciones y autorización final |
|---|---|
| Swipe | `record_decision`: actor de auth.uid, guarda NULL, perfiles existentes y reciprocidad; no acepta actor de parámetro |
| Pertenencia | `is_session_member`, `is_room_participant`, `is_room_host`, `is_room_attendee`: predicados del actor; NULL/no-miembro devuelve false |
| Locks internos | `lock_member_session`, `lock_room_for_member`: guarda NULL y pertenencia; EXECUTE cerrado a PUBLIC/anon/authenticated |
| Sesiones | `propose_session/respond_session/cancel_session/join_session/leave_session`: actor/pertenencia explícitos o delegados al lock interno |
| Valoración/lectura | `rate_session`, `ratable_session`, `active_session`, `match_streaks`: solo datos del actor/match; `session_both_attended` es la excepción H1 |
| Verificación | `sync_github_verification`: sin parámetros; lee Auth por auth.uid y actualiza solo ese perfil; con NULL es no-op |
| Acuerdo | `answer_agreement_topic`, `match_agreement`: guarda NULL, pertenencia y modo Par |
| Salas | `create_room/respond_room/cancel_room/join_room/leave_room`: actor y membresía; invitados deben ser matches propios; cancelación solo del convocante |
| Triggers | `messages_touch_match`, `touch_room`: EXECUTE cerrado al cliente; dependen de la escritura autorizada que dispara el trigger |

**Sin hallazgos adicionales:** los RPC de mutación ensayados contra IDs ajenos fallan con LI004; los locks internos fallan con 42501; active/ratable devuelven cero filas. Sin uid, mutaciones fallan con 28000 o LI004; las lecturas privilegiadas no entregan datos, excepto H1. La verificación GitHub no es falsificable mediante UPDATE de las columnas protegidas (42501).

Los errores siguen el contrato: `LI001` conflicto, `LI002` caducidad, `LI003` ventana/rango, `LI004` pertenencia/operación no permitida, `LI005` acuerdo fuera de Par y `LI006` invitados inválidos. Ausencia de sesión usa también `28000`; argumentos mal formados pueden usar `22023`, NOT NULL o CHECK. No se exige que todos los errores sean LI00x: los códigos generales no conceden acceso. La prueba de invitados no-match devolvió LI006.

Los únicos helpers invocables como anon por EXECUTE heredado de PUBLIC son `array_has_duplicates(anyarray)`, `is_valid_prompts(jsonb)` y `resolve_match_mode(mode_preference,mode_preference)`: son puros, invoker y no leen tablas. **Sin hallazgos** en esa superficie anónima. `touch_updated_at` también está cerrado por la migración de 24 de septiembre.

### Realtime y vistas ciegas

Hay cuatro políticas permisivas de LockIn en `realtime.messages`: SELECT/INSERT para topics de sesión y SELECT/INSERT para topics de sala. Se restringen a authenticated y a `broadcast/presence`; las expresiones regulares exigen UUID completo y prefijo exacto. Los namespaces de sesión/sala no se solapan. Un usuario ajeno no pasa los helpers. **Sin hallazgos adicionales** en el parseo de topics o pertenencia; H3 afecta al tiempo de autorización de salas.

La configuración **Only private channels / Allow public access** está fuera del SQL. Las migraciones ya declaran que debe cerrarse el acceso público (`20260917000100:31–37`). No se ha comprobado ese ajuste del remoto y no se afirma su estado. También quedan fuera de esta fixture políticas adicionales de plataforma que podrían combinarse por OR: la huella solo registra las que empiezan por lockin. Estas son limitaciones de cobertura, no hallazgos adicionales demostrados.

**Sin hallazgos:** el acuerdo ciego oculta `theirs_option/theirs_note/theirs_updated_at` hasta responder el mismo tema en el mismo match; `theirs_answered` sí se revela, como especifica el producto. No se puede obtener el acuerdo de otro match. Poder sustituir la respuesta propia después de revelarse está expresamente permitido por la spec.

**Sin hallazgos:** en SELECT de invitados, A no ve a B pendiente/rechazada; quien convoca sí la ve. `room_members` no publica DELETE, ratings y acuerdos tampoco se publican.

**Sin hallazgos:** no existen vistas SQL (`pg_class.relkind v/m`) con posible bypass de RLS. Las llamadas «vistas ciegas» son RPC/políticas, no CREATE VIEW. Se han auditado sus cuerpos y ACL, no se ha asumido SECURITY INVOKER de una vista inexistente.

### Reloj

**Sin hallazgos adicionales:** las decisiones de aceptar/cancelar/entrar/valorar sesiones y las de salas usan el reloj de Postgres; el endurecimiento captura `clock_timestamp()` después del FOR UPDATE. `p_starts_at` se acota a 5 minutos–30 días y bloques 1/2/4. Las funciones inmutables con `p_now` solo calculan reglas: el parámetro del cliente no se utiliza como autoridad en una mutación privilegiada. Los RPC de lectura active/ratable/streaks y `server_now` usan hora del servidor.

H2 es una confianza residual en un campo que el cliente puede escribir; H3 es una ventana aplicada por la UI y omitida en la política. No se ha probado contención entre conexiones ni se han contado como vulnerabilidad los relojes locales de presentación.

## Reproducción íntegra sin crear otros archivos

Desde la raíz del repo, ejecutar primero la suite existente. El segundo comando extrae y ejecuta el bloque JavaScript de este informe mediante stdin; no crea scripts en el árbol. Carga migraciones y fixtures en memoria, **no ejecuta ninguno de los arreglos SQL**. La parte WALRUS necesita acceso al código público de GitHub del commit fijado; no utiliza URLs, claves ni credenciales Supabase.

```powershell
node --test supabase/schema-embedded.test.mjs

@'
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const report = await readFile('docs/plan/auditoria-seguridad-2026-10.md', 'utf8');
const script = report.match(/<!-- auditoria-runner -->\r?\n```javascript\r?\n([\s\S]*?)\r?\n```/)[1];
const result = spawnSync(process.execPath, ['--input-type=module'], {
  input: script, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024
});
process.stdout.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
'@ | node --input-type=module
```

Salida final esperada: `AUDIT_TESTS_PASSED 89 WALRUS_INSERT_DELETE_PASSED 2`. Las sondas de ataque reproducen los fallos actuales: que pasen no significa que el esquema sea seguro. Después de arreglarlos hay que invertir las expectativas correspondientes. Los SQL propuestos no se han ejecutado ni validado como arreglos; su validación corresponde a una futura implementación autorizada.

<!-- auditoria-runner -->
```javascript
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
const db = new PGlite();
try {
const source = await readFile('supabase/schema-embedded.test.mjs','utf8');
await db.exec(source.match(/await db\.exec\(\x60(create schema auth;[\s\S]*?)\x60\);/)[1].replace('select null::uuid', "select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid"));
const files=(await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort();
for(const f of files) await db.exec(await readFile('supabase/migrations/'+f,'utf8'));
console.log('ENGINE', (await db.query('select version() as version')).rows);
const fp=(await db.exec(await readFile('supabase/schema-fingerprint.sql','utf8'))).at(-1).rows.map(r=>r.line);
console.log('FINGERPRINT',fp[0],fp.length-1);
await db.exec('set search_path = public');
const ids={A:'00000000-0000-4000-8000-00000000aaaa',B:'00000000-0000-4000-8000-00000000bbbb',C:'00000000-0000-4000-8000-00000000cccc',D:'00000000-0000-4000-8000-00000000dddd',M:'10000000-0000-4000-8000-000000000001',N:'10000000-0000-4000-8000-000000000002',S:'20000000-0000-4000-8000-000000000001',R:'30000000-0000-4000-8000-000000000001',X:'30000000-0000-4000-8000-000000000002'};
const sql=s=>s.replace(/:([ABCDMNSRX])\b/g,(_,k)=>ids[k]);
await db.exec(sql("insert into auth.users(id,email) values(':A','a@test.local'),(':B','b@test.local'),(':C','c@test.local'),(':D','d@test.local'); insert into public.profiles(id,name,age,location,timezone,avatar_initials,specialties,looking_for,starting_point,availability_hours_per_week,availability_bands,ambition) select id,split_part(email,'@',1),30,'Madrid','Europe/Madrid','X',array['dev']::public.specialty[],'ambos','solo-ganas',10,array['tarde']::public.time_band[],'equilibrado' from auth.users; insert into public.user_settings(user_id,active_mode) select id,'ambos' from auth.users; insert into public.matches(id,profile_a,profile_b,mode) values(':M',':A',':B','par'),(':N',':B',':C','par'); insert into public.lockin_sessions(id,match_id,proposed_by,starts_at,blocks,status,responded_at) values(':S',':N',':B',now()-interval '40 minutes',1,'aceptada',now()-interval '1 hour'); insert into public.session_attendance(session_id,profile_id,joined_at) values(':S',':B',now()-interval '39 minutes'),(':S',':C',now()-interval '39 minutes'); insert into public.session_ratings values(':S',':B','floja',now()); insert into public.agreement_answers(match_id,profile_id,topic,option,note) values(':M',':B','dedicacion','tiempo-completo','Nota privada B'),(':N',':B','dedicacion','parcial','Otra nota B'); insert into public.lockin_rooms(id,host_id,starts_at,blocks) values(':R',':C',now()+interval '10 minutes',1),(':X',':C',now()+interval '10 minutes',1); insert into public.room_members(room_id,profile_id,status,responded_at) values(':R',':C','aceptada',now()),(':R',':A','aceptada',now()),(':R',':B','invitada',null),(':X',':C','aceptada',now()),(':X',':B','aceptada',now()),(':X',':D','invitada',null);"));
let tests=0;
async function as(role,uid,s){
 await db.exec('begin');
 try {await db.exec('set local role '+role);await db.query("select set_config('request.jwt.claim.sub',$1,true)",[ids[uid]??'']);return await db.query(sql(s));}
 finally {await db.exec('rollback');}
}
async function ok(name,fn){await fn();tests++;console.log('PASS',name);}
async function denied(role,uid,s,code){await assert.rejects(as(role,uid,s),e=>e.code===code);}
await ok('H1 helper leaks nonmember attendance',async()=>{
 assert.equal((await as('authenticated','A',"select * from public.session_attendance where session_id=':S'")).rows.length,0);
 assert.equal((await as('authenticated','A',"select public.is_session_member(':S') v")).rows[0].v,false);
 assert.equal((await as('authenticated','A',"select public.session_both_attended(':S') v")).rows[0].v,true);
 console.log('H1_UID_NULL',(await as('authenticated',null,"select public.session_both_attended(':S') v")).rows);
 await denied('anon',null,"select public.session_both_attended(':S')",'42501');
});
await ok('H2 client sent_at infinity dominates last_messages',async()=>{
 await db.exec('begin');
 try{
 await db.exec('set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[ids.A]);
 await db.query(sql("insert into public.messages(match_id,sender_id,body,sent_at) values(':M',':A','A futuro','infinity')"));
 console.log('H2_MATCH_FUTURE',(await db.query(sql("select last_message_at::text from public.matches where id=':M'"))).rows);
 await db.query("select set_config('request.jwt.claim.sub',$1,true)",[ids.B]);
 await db.query(sql("insert into public.messages(match_id,sender_id,body) values(':M',':B','B legitimo')"));
 const out=(await db.query(sql("select body,sent_at::text from public.last_messages_for_matches(array[':M'::uuid])"))).rows;
 assert.deepEqual(out,[{body:'A futuro',sent_at:'infinity'}]);console.log('H2_LAST',out);
 }finally{await db.exec('rollback');}
});
await ok('H3 early room authorization before valid rejection',async()=>{
 assert.equal((await as('authenticated','A',"select public.is_room_topic_member('lockin:room::R') v")).rows[0].v,true);
 await db.exec('begin');
 try{
 await db.exec('set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[ids.A]);
 await db.query("select set_config('realtime.topic',$1,true)",['lockin:room:'+ids.R]);
 await db.query(sql("insert into realtime.messages(topic,extension) values('lockin:room::R','presence')"));
 assert.equal((await db.query(sql("select status from public.respond_room(':R','rechazada')"))).rows[0].status,'rechazada');
 assert.equal((await db.query(sql("select public.is_room_topic_member('lockin:room::R') v"))).rows[0].v,false);
 console.log('H3_INSERT_BEFORE_WINDOW_OK_THEN_REJECTED',true);
 }finally{await db.exec('rollback');}
});
await ok('H4 deletion publication and foreign attendance cascade',async()=>{
 const pubs=(await db.query("select pubname,pubinsert,pubupdate,pubdelete,pubtruncate from pg_publication")).rows;
 const tables=(await db.query("select tablename from pg_publication_tables where pubname='supabase_realtime' order by tablename")).rows;
 assert.equal(pubs[0].pubdelete,true);assert(tables.some(t=>t.tablename==='session_attendance'));
 console.log('H4_PUBLICATION',pubs,tables);
 console.log('H4_KEYS',(await db.query("select c.relname,c.relreplident,pg_get_indexdef(i.indexrelid) pk from pg_class c join pg_index i on i.indrelid=c.oid and i.indisprimary where c.oid in ('public.session_attendance'::regclass,'public.lockin_rooms'::regclass)")).rows);
 await db.exec('begin');
 try{
 await db.exec('set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[ids.B]);await db.query(sql("delete from public.profiles where id=':B'"));
 await db.exec('reset role');assert.equal((await db.query(sql("select * from public.session_attendance where session_id=':S'"))).rows.length,0);
 }finally{await db.exec('rollback');}
});
const tables=(await db.query("select c.oid,c.relname,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) owner from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r' order by c.relname")).rows;
const funcs=(await db.query("select p.oid,p.oid::regprocedure::text signature,p.prosecdef,p.proconfig,pg_get_userbyid(p.proowner) owner,has_function_privilege('anon',p.oid,'execute') anon,has_function_privilege('authenticated',p.oid,'execute') authenticated from pg_proc p where p.pronamespace='public'::regnamespace order by 2")).rows;
console.log('CATALOG_COUNTS',{tables:tables.length,functions:funcs.length,definers:funcs.filter(f=>f.prosecdef).length});console.log('ANON_CALLABLE',funcs.filter(f=>f.anon).map(f=>f.signature));
console.log('VIEWS',(await db.query("select relname from pg_class where relnamespace='public'::regnamespace and relkind in ('v','m')")).rows);
console.log('RT_POLICIES',(await db.query("select policyname,cmd,permissive,roles,qual,with_check from pg_policies where schemaname='realtime'")).rows);
for(const t of tables){
 assert(t.relrowsecurity);
 await ok('anon denied '+t.relname,()=>denied('anon',null,'select * from public.'+t.relname,'42501'));
 for(const role of ['anon','authenticated']) await ok(role+' no truncate/references/trigger '+t.relname,async()=>{
 const p=(await db.query("select has_table_privilege($1,$2,'TRUNCATE') t,has_table_privilege($1,$2,'REFERENCES') r,has_table_privilege($1,$2,'TRIGGER') g",[role,'public.'+t.relname])).rows[0];assert.deepEqual(p,{t:false,r:false,g:false});
 });
}
for(const f of funcs.filter(f=>f.prosecdef)) await ok('search_path '+f.signature,async()=>assert.deepEqual(f.proconfig,['search_path=""']));
await ok('unrelated A cannot SELECT B private data',async()=>{
 const criteria={matches:"id=':N'",messages:"match_id=':N'",lockin_sessions:"id=':S'",session_attendance:"session_id=':S'",session_ratings:"session_id=':S'",agreement_answers:"match_id=':N'",lockin_rooms:"id=':X'",room_members:"room_id=':X'",user_settings:"user_id=':B'"};
 for(const [t,c] of Object.entries(criteria)) assert.equal((await as('authenticated','A','select * from public.'+t+' where '+c)).rows.length,0);
});
await ok('agreement blind note/option/time and post-answer reveal',async()=>{
 const v=(await as('authenticated','A',"select * from public.match_agreement(':M')")).rows[0];
 assert.deepEqual([v.theirs_answered,v.theirs_option,v.theirs_note,v.theirs_updated_at],[true,null,null,null]);
 await db.exec('begin');
 try{await db.exec('set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[ids.A]);await db.query(sql("select public.answer_agreement_topic(':M','dedicacion','parcial')"));assert.equal((await db.query(sql("select * from public.match_agreement(':M')"))).rows[0].theirs_note,'Nota privada B');}
 finally{await db.exec('rollback');}
});
await ok('blind room pending B hidden from A and visible to host',async()=>{
 assert.equal((await as('authenticated','A',"select * from public.room_members where room_id=':R' and profile_id=':B'")).rows.length,0);
 assert.equal((await as('authenticated','C',"select * from public.room_members where room_id=':R' and profile_id=':B'")).rows.length,1);
});
const nonmember=[
["select public.propose_session(':N',now()+interval '1 hour',1::smallint)",'LI004'],
["select public.respond_session(':S','aceptada')",'LI004'],["select public.cancel_session(':S')",'LI004'],
["select public.join_session(':S')",'LI004'],["select public.leave_session(':S')",'LI004'],
["select public.rate_session(':S','genial')",'LI004'],["select public.answer_agreement_topic(':N','dedicacion','parcial')",'LI004'],
["select public.match_agreement(':N')",'LI004'],["select public.respond_room(':X','aceptada')",'LI004'],
["select public.cancel_room(':X')",'LI004'],["select public.join_room(':X')",'LI004'],["select public.leave_room(':X')",'LI004'],
["select public.lock_member_session(':S')",'42501'],["select public.lock_room_for_member(':X')",'42501']];
for(const [s,c] of nonmember) await ok('denied '+s.split('(')[0],()=>denied('authenticated','A',s,c));
for(const f of ['active_session','ratable_session']) await ok('empty '+f,async()=>assert.equal((await as('authenticated','A',"select * from public."+f+"(':N')")).rows.length,0));
await ok('helpers false for nonmember',async()=>{
 for(const [f,a] of [['is_match_member',':N'],['is_session_member',':S'],['is_room_participant',':X'],['is_room_attendee',':X'],['is_room_host',':X'],['is_room_topic_member','lockin:room::X'],['is_session_topic_member','lockin:video::S']]) assert.equal((await as('authenticated','A',"select public."+f+"('"+a+"') v")).rows[0].v,false);
});
await ok('write, impersonation, Github verification protections',async()=>{
 await denied('authenticated','A',"update public.profiles set github_handle='victim',github_verified_at=now(),link_github='https://github.com/victim' where id=':A'",'42501');
 assert.equal((await as('authenticated','A',"update public.profiles set name='Impostor' where id=':B' returning id")).rows.length,0);
 for(const s of ["insert into public.messages(match_id,sender_id,body) values(':M',':B','Impersonation')","insert into public.messages(match_id,sender_id,body) values(':N',':A','Injection')","insert into public.agreement_answers(match_id,profile_id,topic,option) values(':M',':A','x','y')","insert into public.room_members(room_id,profile_id) values(':X',':A')"]) await denied('authenticated','A',s,'42501');
});

await ok('all definers deny anon in effective ACL',async()=>{for(const f of funcs.filter(f=>f.prosecdef))assert.equal(f.anon,false);});
await ok('authenticated with null uid cannot mutate protected data',async()=>{
 for(const [s,c] of nonmember.slice(0,12)) await denied('authenticated',null,s,s.includes('agreement')?'LI004':'28000');
 await denied('authenticated',null,"select public.record_decision(':B','like')",'28000');
 await denied('authenticated',null,"select public.create_room(array[':B'::uuid,':C'::uuid],now()+interval '1 hour',1::smallint)",'28000');
});
await ok('null uid privileged reads empty or false',async()=>{
 for(const f of ['active_session','ratable_session'])assert.equal((await as('authenticated',null,"select * from public."+f+"(':N')")).rows.length,0);
 assert.equal((await as('authenticated',null,'select * from public.match_streaks()')).rows.length,0);
 for(const [f,a] of [['is_session_member',':S'],['is_room_participant',':X'],['is_room_attendee',':X'],['is_room_host',':X']])assert.equal((await as('authenticated',null,"select public."+f+"('"+a+"') v")).rows[0].v,false);
 await as('authenticated',null,'select public.sync_github_verification()');
});
await ok('create_room rejects non-match invitations',()=>denied('authenticated','A',"select public.create_room(array[':B'::uuid,':C'::uuid],now()+interval '1 hour',1::smallint)",'LI006'));
console.log('TABLE_PRIVILEGES',(await db.query("select c.relname,has_table_privilege('authenticated',c.oid,'SELECT') s,has_table_privilege('authenticated',c.oid,'INSERT') i,has_table_privilege('authenticated',c.oid,'UPDATE') u,has_table_privilege('authenticated',c.oid,'DELETE') d from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r' order by 1")).rows);


const upstream='493794f1d1f7c17ec97751c2f2b66c8f02788385';
async function getSql(name){const r=await fetch('https://raw.githubusercontent.com/supabase/walrus/'+upstream+'/sql/'+name);if(!r.ok)throw Error('Github '+r.status);return await r.text();}
await db.exec((await getSql('walrus--0.1.sql')).replace('create schema realtime;',''));
const providerFiles=['0001_support_wal2json_2_4','0002_filter_handle_nulls','0003_delete_filters_bugfix','0004_in_op','0005_delete_old_record_rls','0006_high_res_commit_timestamp','0007_commit_timestamp_utc','0008_subscription_check_array_types','0009_unchanged_toast','0010_quoted_roles','0011_delete_filters','0012_action_filter','0013_select_columns','0014_empty_select_error','0015_like_ilike_is_not_ops','0016_fix_apply_rls_role_leak','0017_empty_select_primary_keys'];
for(const f of providerFiles){ console.log('WALRUS_LOAD',f); await db.exec(await getSql('walrus_migration_'+f+'.sql')); }
await db.exec("create or replace function auth.uid() returns uuid language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$");
const sub='40000000-0000-4000-8000-000000000001';
await db.query("insert into realtime.subscription(subscription_id,entity,claims) values($1,'public.session_attendance'::regclass,$2::jsonb)",[sub,JSON.stringify({role:'authenticated',sub:ids.A})]);
const columns=[{name:'session_id',type:'uuid',typeoid:2950,value:ids.S},{name:'profile_id',type:'uuid',typeoid:2950,value:ids.B},{name:'joined_at',type:'timestamptz',typeoid:1184,value:new Date(Date.now()-39*60000).toISOString()},{name:'left_at',type:'timestamptz',typeoid:1184,value:null}];
const pk=[{name:'session_id',type:'uuid',typeoid:2950},{name:'profile_id',type:'uuid',typeoid:2950}];
for(const action of ['I','D']){
const wal={action,schema:'public',table:'session_attendance',timestamp:new Date().toISOString(),pk,columns:action==='I'?columns:[],identity:action==='D'?columns:[]};
const out=(await db.query("select * from realtime.apply_rls($1::jsonb)",[JSON.stringify(wal)])).rows;
console.log('H4_WALRUS_'+action,JSON.stringify(out));
assert.equal(out[0].is_rls_enabled,true);
assert.deepEqual(out[0].errors,[]);
if(action==='I')assert.deepEqual(out[0].subscription_ids,[]);
else {assert.deepEqual(out[0].subscription_ids,[sub]);assert.deepEqual(out[0].wal.old_record,{session_id:ids.S,profile_id:ids.B});}
}
console.log('H4_WALRUS_COMMIT',upstream);

console.log('AUDIT_TESTS_PASSED',tests,'WALRUS_INSERT_DELETE_PASSED',2);
} catch(e) { console.error('AUDIT_ERROR',e.code,e.message); process.exitCode=1; } finally {await db.close();}
```

