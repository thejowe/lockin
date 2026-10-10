-- Las salas sobreviven a que quien las convocó borre su cuenta.
--
-- Hasta ahora `lockin_rooms.host_id` era `not null … on delete cascade`: al
-- borrar la cuenta de quien convoca, la sala y todas las filas de `room_members`
-- caían con ella, y las personas invitadas (aunque ya hubieran aceptado) veían
-- desaparecer una sesión agendada sin saber por qué.
--
-- Ahora `host_id` es anulable y la clave ajena es `on delete set null`: la fila
-- de la sala se queda, sin convocante. `delete_my_account()` cancela antes las
-- salas futuras de esa persona (`cancelled_at`), así que quienes participan la
-- ven como cancelada y reciben la invalidación de Realtime. Las salas ya
-- empezadas o terminadas se conservan tal cual, con `host_id` nulo.
--
-- `cancel_room()` comparaba con `<>`: con `host_id` nulo la comparación da NULL,
-- el `if` no salta y cualquier participante podría cancelar. Pasa a
-- `is distinct from`, que trata el nulo como «no eres tú».

alter table public.lockin_rooms alter column host_id drop not null;

alter table public.lockin_rooms drop constraint lockin_rooms_host_id_fkey;
alter table public.lockin_rooms
  add constraint lockin_rooms_host_id_fkey
  foreign key (host_id) references public.profiles (id) on delete set null;

-- Última definición: 20261002000100_lockin_rooms.sql. Solo cambia el `<>`.
create or replace function public.cancel_room(p_room_id uuid)
returns public.lockin_rooms
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_room public.lockin_rooms := public.lock_room_for_member(p_room_id);
  v_now timestamptz := clock_timestamp();
begin
  if v_room.host_id is distinct from (select auth.uid()) then
    raise exception 'cancel_room: solo cancela quien convoca' using errcode = 'LI004';
  end if;
  if v_room.cancelled_at is not null then
    raise exception 'cancel_room: ya estaba cancelada' using errcode = 'LI001';
  end if;
  if v_now >= v_room.starts_at then
    raise exception 'cancel_room: ya ha empezado' using errcode = 'LI002';
  end if;

  update public.lockin_rooms set cancelled_at = v_now, updated_at = v_now where id = p_room_id
  returning * into v_room;

  return v_room;
end;
$fn$;

-- Última definición: 20261009215240_delete_my_account.sql. Añade el paso de
-- cancelar las salas futuras antes de borrar la cuenta.
--
-- Orden de bloqueos (importa, son dos carreras reales):
--
-- 1. La fila del perfil, `for update`, lo primero. `create_room` inserta una
--    sala con `host_id` apuntando a ese perfil, y la clave ajena toma
--    `FOR KEY SHARE` sobre él, que choca con `FOR UPDATE`: una `create_room`
--    de esta misma cuenta (otro dispositivo) o bien termina antes del barrido
--    —y entonces se ve y se cancela— o bien espera a que esta transacción
--    acabe y falla la clave ajena porque el perfil ya no existe. Sin esto, una
--    sala confirmada entre el barrido y el borrado quedaba futura, sin
--    cancelar y con `host_id` nulo: nadie podría cancelarla.
-- 2. Cada sala que convoca, `for update`, en orden de id (sin interbloqueos
--    entre dos barridos) y ANTES de capturar el instante de corte: es el
--    patrón del reloj de PLAN.md. Si otro RPC de sala sostiene el bloqueo
--    mientras se espera y `starts_at` se cruza, un instante capturado antes
--    seguiría cumpliendo `starts_at > v_now` al reanudarse y se cancelaría una
--    sala que ya empezó, con asistentes dentro.
-- 3. Solo entonces `clock_timestamp()`, y el UPDATE de cancelación.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz;
begin
  if v_uid is null then
    raise exception 'delete_my_account: no hay sesión' using errcode = 'LI007';
  end if;

  perform 1 from public.profiles where id = v_uid for update;

  perform 1
    from public.lockin_rooms
   where host_id = v_uid and cancelled_at is null
   order by id
     for update;

  v_now := clock_timestamp();
  update public.lockin_rooms
     set cancelled_at = v_now, updated_at = v_now
   where host_id = v_uid
     and cancelled_at is null
     and starts_at > v_now;

  delete from auth.users where id = v_uid;
end;
$$;

-- CREATE OR REPLACE conserva los privilegios, pero se repiten por si esta
-- migración se ejecuta sobre una base donde la anterior no corrió.
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
