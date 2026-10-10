-- Retención de reportes y cabos sueltos del bloqueo (bloquear/reportar,
-- 2026-10-09). Tres cosas:
--
-- 1. `user_reports` sobrevive al borrado de la cuenta de quien reporta o de la
--    persona reportada (decisión del usuario, híbrido «set null + instantánea»):
--    `reporter_id` y `reported_id` pasan a anulables con `on delete set null` y
--    el uuid queda copiado como texto en `reporter_ref` / `reported_ref`, que
--    rellena `report_profile`. Un reporte caduca 12 meses después de su
--    creación (`purge_old_user_reports`). Hasta entonces la única forma de
--    perderlo es esa caducidad: apps de tienda esperan poder actuar sobre
--    contenido reportado aunque su autor se haya dado de baja.
-- 2. `block_profile` rechaza las filas `invitada`/`aceptada` de la persona
--    bloqueada en las salas de quien bloquea que aún no han empezado; la
--    política de `room_members` oculta la fila de quien tiene un bloqueo con
--    quien mira (dos invitadas bloqueadas entre sí ya no se ven), y
--    `is_room_topic_member` cierra el canal de presencia a quien tiene un
--    bloqueo con otra persona que ha aceptado la sala.
-- 3. `match_streaks()` no calcula la racha de una pareja bloqueada.
--
-- Programación: el barrido de reportes se programa con pg_cron si la extensión
-- está disponible; si no, queda como función. No hay barrido automático de
-- cuentas por inactividad: borrar una cuenta solo por no haber entrado exige un
-- registro de última actividad propio, que no existe (ver todo/datos.md).


-- ---------------------------------------------------------------------------
-- 1. Reportes: sobreviven a la baja, caducan a los 12 meses
-- ---------------------------------------------------------------------------

alter table public.user_reports add column reporter_ref text;
alter table public.user_reports add column reported_ref text;

update public.user_reports
   set reporter_ref = reporter_id::text,
       reported_ref = reported_id::text;

alter table public.user_reports alter column reporter_ref set not null;
alter table public.user_reports alter column reported_ref set not null;

alter table public.user_reports alter column reporter_id drop not null;
alter table public.user_reports alter column reported_id drop not null;

alter table public.user_reports drop constraint user_reports_reporter_id_fkey;
alter table public.user_reports drop constraint user_reports_reported_id_fkey;
alter table public.user_reports drop constraint user_reports_check;

alter table public.user_reports
  add constraint user_reports_reporter_id_fkey
  foreign key (reporter_id) references public.profiles (id) on delete set null;
alter table public.user_reports
  add constraint user_reports_reported_id_fkey
  foreign key (reported_id) references public.profiles (id) on delete set null;
alter table public.user_reports
  add constraint user_reports_distinct_parties
  check (reporter_id is null or reported_id is null or reporter_id <> reported_id);

create index user_reports_created_at_idx on public.user_reports (created_at);

-- Última definición: 20261009224000_block_report.sql. Cambio: copia los dos ids
-- como texto en la instantánea del reporte.
create or replace function public.report_profile(p_profile_id uuid, p_reason text, p_details text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then
    raise exception 'No hay sesión autenticada.' using errcode = '28000';
  end if;
  if p_profile_id = v_actor then
    raise exception 'No puedes reportarte a ti mismo.' using errcode = 'LI008';
  end if;
  if p_reason is null or p_reason not in ('acoso', 'contenido-inapropiado', 'spam', 'suplantacion', 'otro') then
    raise exception 'Elige un motivo válido.' using errcode = 'LI009';
  end if;
  if char_length(p_details) > 500 then
    raise exception 'El texto no puede superar 500 caracteres.' using errcode = '23514';
  end if;
  insert into public.user_reports (reporter_id, reported_id, reporter_ref, reported_ref, reason, details)
  values (v_actor, p_profile_id, v_actor::text, p_profile_id::text, p_reason, nullif(btrim(p_details), ''));
end;
$fn$;

revoke execute on function public.report_profile(uuid, text, text) from public, anon;
grant execute on function public.report_profile(uuid, text, text) to authenticated;

-- Caducidad: 12 meses desde `created_at`. Solo la ejecuta el planificador (o
-- quien tenga el rol propietario): nadie más puede llamarla.
create or replace function public.purge_old_user_reports()
returns integer
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_deleted integer;
begin
  with gone as (
    delete from public.user_reports
     where created_at < now() - interval '12 months'
    returning 1
  )
  select count(*)::integer into v_deleted from gone;
  return v_deleted;
end;
$fn$;

revoke execute on function public.purge_old_user_reports() from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- 2. Bloqueo y salas
-- ---------------------------------------------------------------------------

-- Última definición: 20261009224000_block_report.sql. Cambio: además de guardar
-- el bloqueo, rechaza las filas `invitada`/`aceptada` de la persona bloqueada
-- en las salas de quien bloquea que aún no han empezado. Primero se bloquean
-- las salas (orden de id) y solo después se captura el instante de corte: el
-- patrón del reloj de PLAN.md.
create or replace function public.block_profile(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_now timestamptz;
begin
  if v_actor is null then
    raise exception 'No hay sesión autenticada.' using errcode = '28000';
  end if;
  if p_profile_id = v_actor then
    raise exception 'No puedes bloquearte a ti mismo.' using errcode = 'LI008';
  end if;
  insert into public.user_blocks (blocker_id, blocked_id)
  values (v_actor, p_profile_id)
  on conflict (blocker_id, blocked_id) do nothing;

  perform 1
    from public.lockin_rooms r
   where r.host_id = v_actor
     and r.cancelled_at is null
     and exists (
       select 1 from public.room_members rm
        where rm.room_id = r.id and rm.profile_id = p_profile_id
     )
   order by r.id
     for update;

  v_now := clock_timestamp();
  update public.room_members rm
     set status = 'rechazada',
         responded_at = coalesce(rm.responded_at, v_now)
    from public.lockin_rooms r
   where r.id = rm.room_id
     and r.host_id = v_actor
     and r.cancelled_at is null
     and r.starts_at > v_now
     and rm.profile_id = p_profile_id
     and rm.status in ('invitada', 'aceptada');
end;
$fn$;

revoke execute on function public.block_profile(uuid) from public, anon;
grant execute on function public.block_profile(uuid) to authenticated;

-- ¿Ninguna persona que ha aceptado la sala tiene un bloqueo (en cualquier
-- dirección) con quien llama? SECURITY DEFINER para ver las filas de
-- `room_members` que la RLS le oculta. PL/pgSQL por la misma razón que
-- `has_profile_block`.
create or replace function public.is_room_free_of_member_blocks(p_room_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_ok boolean;
begin
  select public.is_room_attendee(p_room_id)
     and not exists (
       select 1 from public.room_members rm
       where rm.room_id = p_room_id
         and rm.status = 'aceptada'
         and rm.profile_id <> (select auth.uid())
         and public.has_profile_block(rm.profile_id)
     ) into v_ok;
  return v_ok;
end;
$fn$;

revoke execute on function public.is_room_free_of_member_blocks(uuid) from public, anon;
grant execute on function public.is_room_free_of_member_blocks(uuid) to authenticated;

-- Última definición: 20261009231000_block_report_enforcement.sql. Cambio: la
-- fila de una persona con la que quien mira tiene un bloqueo no se ve, ni
-- siquiera para quien convoca la sala.
alter policy "room_members: tu fila, las aceptadas y, si convocas, todas" on public.room_members
  using (
    not public.has_profile_block(profile_id)
    and (
      profile_id = (select auth.uid())
      or public.is_room_host(room_id)
      or (status = 'aceptada' and public.is_room_participant(room_id) and public.is_room_unblocked(room_id))
    )
  );

-- Última definición: 20261009231000_block_report_enforcement.sql. Cambio: no hay
-- canal de presencia para quien tiene un bloqueo con otra persona que ha
-- aceptado la sala. Un único canal por sala no se puede partir por parejas: la
-- pareja bloqueada queda fuera de él, las demás siguen dentro.
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
      and public.is_room_unblocked(r.id)
      and public.is_room_free_of_member_blocks(r.id)
      and r.cancelled_at is null
      and clock_timestamp() >= r.starts_at - interval '5 minutes'
      and clock_timestamp() < public.session_ends_at(r.starts_at, r.blocks)
  );
$fn$;

revoke execute on function public.is_room_topic_member(text) from public, anon;
grant execute on function public.is_room_topic_member(text) to authenticated;


-- ---------------------------------------------------------------------------
-- 4. Rachas: sin pareja bloqueada
-- ---------------------------------------------------------------------------

-- Última definición: 20260915000200_match_streaks.sql. Cambio: el CTE `shared`
-- exige `is_unblocked_match`. El resto del cuerpo es idéntico.
create or replace function public.match_streaks()
returns table (match_id uuid, streak_count integer, alive_until timestamptz)
language sql
stable
security definer
set search_path = ''
as $fn$
  with shared as (
    select s.match_id,
           s.starts_at,
           public.session_ends_at(s.starts_at, s.blocks) as ends_at
    from public.lockin_sessions s
    join public.matches m on m.id = s.match_id
    where (select auth.uid()) in (m.profile_a, m.profile_b)
      and s.status = 'aceptada'
      and public.session_both_attended(s.id)
      and public.is_unblocked_match(s.match_id)
  ),
  marked as (
    select sh.match_id,
           sh.starts_at,
           sh.ends_at,
           case
             when sh.starts_at - lag(sh.ends_at) over w < interval '168 hours' then 0
             else 1
           end as starts_chain
    from shared sh
    window w as (partition by sh.match_id order by sh.starts_at)
  ),
  chained as (
    select mk.match_id,
           mk.ends_at,
           sum(mk.starts_chain) over (partition by mk.match_id order by mk.starts_at) as chain
    from marked mk
  ),
  last_chain as (
    select distinct on (c.match_id)
           c.match_id,
           count(*) as streak_count,
           max(c.ends_at) as last_ends_at
    from chained c
    group by c.match_id, c.chain
    order by c.match_id, c.chain desc
  )
  select lc.match_id,
         lc.streak_count::integer,
         lc.last_ends_at + interval '168 hours'
  from last_chain lc
  where now() < lc.last_ends_at + interval '168 hours';
$fn$;

revoke execute on function public.match_streaks() from public, anon;
grant execute on function public.match_streaks() to authenticated;


-- ---------------------------------------------------------------------------
-- Programación (pg_cron, si existe)
-- ---------------------------------------------------------------------------
--
-- Un fallo (o un timeout) al activar pg_cron no aborta la migración: sale un WARNING y las
-- funciones quedan listas para programarse a mano. Sin pg_cron (el PostgreSQL
-- embebido de las pruebas, o un proyecto sin la extensión) sale un NOTICE.

do $cron$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron no está disponible: purge_old_user_reports() queda sin programar';
    return;
  end if;
  create extension if not exists pg_cron with schema pg_catalog;
  perform cron.schedule('lockin-purge-old-user-reports', '20 3 * * *', 'select public.purge_old_user_reports()');
exception when others or query_canceled then
  raise warning 'no se pudo programar con pg_cron (%): programa a mano purge_old_user_reports()', sqlerrm;
end
$cron$;
