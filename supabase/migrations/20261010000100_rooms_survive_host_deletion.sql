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
