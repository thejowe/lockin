-- LockIn — salas Lock-In grupales (Fase 3).
--
-- Diseño: docs/superpowers/specs/2026-10-02-salas-grupales-design.md.
-- Espejo de `src/data/rooms.ts`; las reglas de tiempo son las de
-- `20260913000100_lockin_sessions.sql` (`session_ends_at`).
--
-- Nadie escribe estas tablas directamente: sin políticas de escritura y con
-- todos los privilegios revocados salvo SELECT (TRUNCATE incluido: RLS no lo
-- filtra). Todo pasa por los RPC SECURITY DEFINER de abajo, que validan con la
-- sala bloqueada y con `clock_timestamp()` tomado DESPUÉS del bloqueo: `now()`
-- es la hora de inicio de la transacción y se queda atrás si la RPC espera.
--
-- El ciego de invitados vive en la política de `room_members`: quien convoca
-- ve todas las filas; el resto, la suya y las `aceptada`. Por eso
-- `room_members` NO va a la publicación de Realtime: Supabase no aplica RLS a
-- los DELETE y entregaría la PK (room_id, profile_id) a cualquier suscriptor.
-- Los cambios de miembros se avisan tocando `lockin_rooms.updated_at`.

create type public.room_member_status as enum ('invitada', 'aceptada', 'rechazada');

create table public.lockin_rooms (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  starts_at timestamptz not null,
  blocks smallint not null,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  -- Lo toca `touch_room()` en cada cambio de miembros: es la invalidación que
  -- reciben, por la RLS de la sala, quienes participan.
  updated_at timestamptz not null default now(),
  constraint lockin_rooms_blocks_valid check (blocks in (1, 2, 4))
);

comment on table public.lockin_rooms is
  'Salas Lock-In grupales (3-5 personas). Viva/terminada salen de starts_at y blocks, no se guardan.';

create index lockin_rooms_host_idx on public.lockin_rooms (host_id, starts_at desc);

create table public.room_members (
  room_id uuid not null references public.lockin_rooms (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status public.room_member_status not null default 'invitada',
  responded_at timestamptz,
  joined_at timestamptz,
  -- NULL = no salió de forma explícita. Misma semántica que session_attendance.
  left_at timestamptz,
  primary key (room_id, profile_id),
  constraint room_members_responded_iff_not_invited
    check ((status = 'invitada') = (responded_at is null)),
  constraint room_members_left_after_join
    check (left_at is null or joined_at is not null)
);

create index room_members_profile_idx on public.room_members (profile_id);


-- ---------------------------------------------------------------------------
-- Helpers de pertenencia (SECURITY DEFINER: las políticas los llaman sin
-- recursión, y deparsean en una sola línea, que la huella necesita).
-- ---------------------------------------------------------------------------

create or replace function public.is_room_participant(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.room_members rm
    where rm.room_id = p_room_id
      and rm.profile_id = (select auth.uid())
      and rm.status <> 'rechazada'
  );
$fn$;

create or replace function public.is_room_host(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.lockin_rooms r
    where r.id = p_room_id and r.host_id = (select auth.uid())
  );
$fn$;

create or replace function public.is_room_attendee(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.room_members rm
    where rm.room_id = p_room_id
      and rm.profile_id = (select auth.uid())
      and rm.status = 'aceptada'
  );
$fn$;


-- ---------------------------------------------------------------------------
-- Invalidación: cualquier cambio de miembros toca la sala.
-- ---------------------------------------------------------------------------
--
-- En un borrado en cascada desde `lockin_rooms` la sala ya no existe cuando
-- este trigger corre: el `update` afecta a cero filas y no falla.

create or replace function public.touch_room()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  update public.lockin_rooms
     set updated_at = clock_timestamp()
   where id = coalesce(new.room_id, old.room_id);
  return null;
end;
$fn$;

create trigger room_members_touch_room
  after insert or update or delete on public.room_members
  for each row execute function public.touch_room();


-- ---------------------------------------------------------------------------
-- Permisos de tabla y RLS
-- ---------------------------------------------------------------------------

alter table public.lockin_rooms enable row level security;
alter table public.room_members enable row level security;

-- `revoke all` y no solo insert/update/delete: los privilegios por defecto de
-- Supabase conceden ALL en `public`, y eso incluye TRUNCATE, que RLS no filtra.
revoke all on table public.lockin_rooms from anon, authenticated;
revoke all on table public.room_members from anon, authenticated;
grant select on table public.lockin_rooms to authenticated;
grant select on table public.room_members to authenticated;

create policy "lockin_rooms: lees las salas en las que estás"
  on public.lockin_rooms for select
  to authenticated
  using (public.is_room_participant(id));

-- El ciego de invitados: una invitada no ve a las demás invitadas.
create policy "room_members: tu fila, las aceptadas y, si convocas, todas"
  on public.room_members for select
  to authenticated
  using (profile_id = (select auth.uid()) or public.is_room_host(room_id) or (status = 'aceptada' and public.is_room_participant(room_id)));


-- ---------------------------------------------------------------------------
-- RPC
-- ---------------------------------------------------------------------------

create or replace function public.create_room(
  p_invitee_ids uuid[],
  p_starts_at timestamptz,
  p_blocks smallint
)
returns public.lockin_rooms
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_count integer := coalesce(cardinality(p_invitee_ids), 0);
  v_now timestamptz := clock_timestamp();
  v_room public.lockin_rooms;
begin
  if v_actor is null then
    raise exception 'create_room: no hay sesión autenticada' using errcode = '28000';
  end if;

  if v_count < 2 or v_count > 4
     or array_position(p_invitee_ids, null) is not null
     or (select count(distinct i) from unnest(p_invitee_ids) as i) <> v_count
     or v_actor = any (p_invitee_ids)
     or exists (
       select 1 from unnest(p_invitee_ids) as i(id)
       where not exists (
         select 1 from public.matches m
         where (m.profile_a = v_actor and m.profile_b = i.id)
            or (m.profile_b = v_actor and m.profile_a = i.id)
       )
     ) then
    raise exception 'create_room: invitados inválidos' using errcode = 'LI006';
  end if;

  if p_blocks is null or p_blocks not in (1, 2, 4)
     or p_starts_at is null
     or p_starts_at < v_now + interval '5 minutes'
     or p_starts_at > v_now + interval '30 days' then
    raise exception 'create_room: hora o duración fuera de rango' using errcode = 'LI003';
  end if;

  insert into public.lockin_rooms (host_id, starts_at, blocks)
  values (v_actor, p_starts_at, p_blocks)
  returning * into v_room;

  insert into public.room_members (room_id, profile_id, status, responded_at)
  values (v_room.id, v_actor, 'aceptada', v_now);

  insert into public.room_members (room_id, profile_id)
  select v_room.id, i from unnest(p_invitee_ids) as i;

  return v_room;
end;
$fn$;

-- Bloquea la sala y exige que el actor tenga fila no rechazada. Uso interno.
-- Quien la llama toma `clock_timestamp()` DESPUÉS, nunca antes.
create or replace function public.lock_room_for_member(p_room_id uuid)
returns public.lockin_rooms
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_room public.lockin_rooms;
begin
  if v_actor is null then
    raise exception 'sala Lock-In: no hay sesión autenticada' using errcode = '28000';
  end if;

  select * into v_room from public.lockin_rooms where id = p_room_id for update;
  if not found or not exists (
    select 1 from public.room_members rm
    where rm.room_id = p_room_id and rm.profile_id = v_actor and rm.status <> 'rechazada'
  ) then
    raise exception 'sala Lock-In: no existe o no estás en ella' using errcode = 'LI004';
  end if;

  return v_room;
end;
$fn$;

create or replace function public.respond_room(
  p_room_id uuid,
  p_answer public.room_member_status
)
returns public.room_members
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_room public.lockin_rooms;
  v_now timestamptz;
  v_row public.room_members;
begin
  if p_answer is null or p_answer not in ('aceptada', 'rechazada') then
    raise exception 'respond_room: la respuesta es aceptada o rechazada' using errcode = '22023';
  end if;

  v_room := public.lock_room_for_member(p_room_id);
  v_now := clock_timestamp();

  if v_room.host_id = (select auth.uid()) then
    raise exception 'respond_room: quien convoca no responde' using errcode = 'LI004';
  end if;
  if v_room.cancelled_at is not null then
    raise exception 'respond_room: la sala se canceló' using errcode = 'LI001';
  end if;
  -- Las respuestas se cierran al abrir la ventana de entrada: así nadie pasa de
  -- aceptada a rechazada con el canal de presencia ya autorizado.
  if v_now >= v_room.starts_at - interval '5 minutes' then
    raise exception 'respond_room: la ventana de entrada ya está abierta' using errcode = 'LI002';
  end if;

  update public.room_members
     set status = p_answer,
         responded_at = case when status = p_answer then responded_at else v_now end
   where room_id = p_room_id and profile_id = (select auth.uid())
  returning * into v_row;

  return v_row;
end;
$fn$;

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
  if v_room.host_id <> (select auth.uid()) then
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

create or replace function public.join_room(p_room_id uuid)
returns public.room_members
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_room public.lockin_rooms := public.lock_room_for_member(p_room_id);
  v_now timestamptz := clock_timestamp();
  v_row public.room_members;
begin
  if not public.is_room_attendee(p_room_id) then
    raise exception 'join_room: no has aceptado la invitación' using errcode = 'LI004';
  end if;
  if v_room.cancelled_at is not null
     or v_now < v_room.starts_at - interval '5 minutes'
     or v_now >= public.session_ends_at(v_room.starts_at, v_room.blocks) then
    raise exception 'join_room: fuera de la ventana de entrada' using errcode = 'LI003';
  end if;

  update public.room_members
     set joined_at = coalesce(joined_at, v_now), left_at = null
   where room_id = p_room_id and profile_id = (select auth.uid())
  returning * into v_row;

  return v_row;
end;
$fn$;

create or replace function public.leave_room(p_room_id uuid)
returns public.room_members
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_room public.lockin_rooms := public.lock_room_for_member(p_room_id);
  v_now timestamptz := clock_timestamp();
  v_row public.room_members;
begin
  update public.room_members
     set left_at = v_now
   where room_id = v_room.id
     and profile_id = (select auth.uid())
     and joined_at is not null
  returning * into v_row;

  if not found then
    raise exception 'leave_room: no habías entrado en la sala' using errcode = 'LI003';
  end if;

  return v_row;
end;
$fn$;

-- Salas vivas en las que estás, con el reloj de Postgres. SECURITY INVOKER:
-- la RLS de `lockin_rooms` ya limita a las tuyas no rechazadas. Sin `limit`:
-- el cliente pagina con `range()` (como `matches.list()`), y un tope aquí
-- haría desaparecer salas de Matches y de los avisos en silencio.
create or replace function public.live_rooms()
returns setof public.lockin_rooms
language sql
stable
set search_path = ''
as $fn$
  select r.*
  from public.lockin_rooms r
  where r.cancelled_at is null
    and clock_timestamp() < public.session_ends_at(r.starts_at, r.blocks)
  order by r.starts_at, r.id;
$fn$;


-- ---------------------------------------------------------------------------
-- Permisos de ejecución
-- ---------------------------------------------------------------------------

revoke execute on function public.is_room_participant(uuid) from public, anon;
revoke execute on function public.is_room_host(uuid) from public, anon;
revoke execute on function public.is_room_attendee(uuid) from public, anon;
revoke execute on function public.touch_room() from public, anon, authenticated;
revoke execute on function public.create_room(uuid[], timestamptz, smallint) from public, anon;
revoke execute on function public.lock_room_for_member(uuid) from public, anon, authenticated;
revoke execute on function public.respond_room(uuid, public.room_member_status) from public, anon;
revoke execute on function public.cancel_room(uuid) from public, anon;
revoke execute on function public.join_room(uuid) from public, anon;
revoke execute on function public.leave_room(uuid) from public, anon;
revoke execute on function public.live_rooms() from public, anon;

grant execute on function public.is_room_participant(uuid) to authenticated;
grant execute on function public.is_room_host(uuid) to authenticated;
grant execute on function public.is_room_attendee(uuid) to authenticated;
grant execute on function public.create_room(uuid[], timestamptz, smallint) to authenticated;
grant execute on function public.respond_room(uuid, public.room_member_status) to authenticated;
grant execute on function public.cancel_room(uuid) to authenticated;
grant execute on function public.join_room(uuid) to authenticated;
grant execute on function public.leave_room(uuid) to authenticated;
grant execute on function public.live_rooms() to authenticated;


-- ---------------------------------------------------------------------------
-- Realtime — sostiene `RoomRepository.subscribe`.
-- ---------------------------------------------------------------------------
--
-- SOLO `lockin_rooms`. Un UPDATE de la sala pasa por su RLS (lo reciben quienes
-- participan) y no lleva ids de miembros; el trigger `touch_room` lo provoca en
-- cada cambio de miembros. Un DELETE de la sala llega sin RLS con su `id`, un
-- UUID que no abre nada. `room_members` NO se publica: sus DELETE (borrados en
-- cascada de un perfil) entregarían (room_id, profile_id) a cualquiera.
-- Replica identity por defecto: los suscriptores releen, no miran la fila.

do $do$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.lockin_rooms;
  end if;
end;
$do$;


-- ---------------------------------------------------------------------------
-- Presencia — topic privado `lockin:room:<uuid>`, solo para quien ha aceptado.
-- Mismo diseño que `20260917000100_realtime_authorization.sql`; su guarda de
-- RLS en `realtime.messages` ya corrió allí.
--
-- Realtime evalúa estas políticas al unirse y no al recibir cada mensaje. No
-- hace falta expulsar a nadie porque nadie puede dejar de estar `aceptada` con
-- la ventana abierta: `respond_room` cierra las respuestas justo al abrirla.
-- ---------------------------------------------------------------------------

create or replace function public.is_room_topic_member(p_topic text)
returns boolean
language sql
stable
set search_path = ''
as $fn$
  select coalesce(
    public.is_room_attendee(
      substring(
        p_topic
        from '^lockin:room:([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$'
      )::uuid
    ),
    false
  );
$fn$;

revoke execute on function public.is_room_topic_member(text) from public, anon;
grant execute on function public.is_room_topic_member(text) to authenticated;

drop policy if exists "lockin: recibes de los canales de tus salas" on realtime.messages;
create policy "lockin: recibes de los canales de tus salas"
  on realtime.messages
  for select
  to authenticated
  using (
    extension in ('broadcast', 'presence')
    and public.is_room_topic_member((select realtime.topic()))
  );

drop policy if exists "lockin: envías a los canales de tus salas" on realtime.messages;
create policy "lockin: envías a los canales de tus salas"
  on realtime.messages
  for insert
  to authenticated
  with check (
    extension in ('broadcast', 'presence')
    and public.is_room_topic_member((select realtime.topic()))
  );
