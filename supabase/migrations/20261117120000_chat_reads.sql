-- Mensajes sin leer: el globo rojo de la pestaña Matches y de cada chat.
--
-- `chat_reads` guarda, por persona y chat (1:1 o grupo), hasta cuándo ha leído.
-- Sin lo leído en el servidor el contador no sobreviviría a reinstalar la app
-- ni sería el mismo en dos dispositivos.
--
-- La tabla no se toca desde el cliente: todo pasa por dos RPC SECURITY DEFINER.
--   * `mark_chat_read(kind, id)` mueve la marca a ahora (reloj del servidor,
--     nunca del teléfono) y solo hacia delante.
--   * `unread_message_counts()` devuelve una fila por chat con algo sin leer.
-- Son DEFINER y no INVOKER por rendimiento: con INVOKER la RLS de `messages`
-- (`is_match_member` fila a fila) obligaba a recorrer la tabla entera. Aquí se
-- filtra primero por los matches de quien llama (índices de `matches`) y se
-- repiten a mano las mismas reglas que la RLS:
--   * 1:1 — solo matches tuyos y sin bloqueo entre las dos personas (como
--     "matches: solo los tuyos").
--   * grupo — solo grupos de los que eres miembro, y sin los mensajes de
--     alguien bloqueado (como "group_messages: lees los de tu grupo").
-- Tus propios mensajes nunca cuentan.
--
-- Sin fila de lectura:
--   * 1:1 — todo lo que te ha escrito la otra persona está sin leer.
--   * grupo — cuenta desde que entraste (`joined_at`), no el historial previo.
-- Al aplicar la migración se siembra una fila con `now()` para cada chat ya
-- existente: si no, todo el historial aparecería de golpe como no leído.

create table if not exists public.chat_reads (
  user_id uuid not null references public.profiles (id) on delete cascade,
  chat_kind text not null check (chat_kind in ('match', 'group')),
  -- Id del match o del grupo. Sin FK: apunta a una tabla u otra según el tipo.
  -- Si el chat desaparece, la fila se queda huérfana y no cuenta para nada.
  chat_id uuid not null,
  last_read_at timestamptz not null default now(),
  primary key (user_id, chat_kind, chat_id)
);

comment on table public.chat_reads is
  'Hasta cuándo ha leído cada persona cada chat (1:1 o grupo). Solo se escribe con mark_chat_read().';

alter table public.chat_reads enable row level security;
-- `revoke all` y no solo las escrituras: si no, queda TRUNCATE.
revoke all on table public.chat_reads from public, anon, authenticated;

-- Siembra: lo que ya existe al desplegar cuenta como leído.
insert into public.chat_reads (user_id, chat_kind, chat_id, last_read_at)
select p.user_id, 'match', p.match_id, now()
from (
  select profile_a as user_id, id as match_id from public.matches
  union all
  select profile_b, id from public.matches
) p
on conflict do nothing;

insert into public.chat_reads (user_id, chat_kind, chat_id, last_read_at)
select gm.user_id, 'group', gm.group_id, now()
from public.group_members gm
on conflict do nothing;


create or replace function public.mark_chat_read(p_kind text, p_chat_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Sin sesión' using errcode = '42501';
  end if;

  if p_kind = 'match' then
    if not public.is_match_member(p_chat_id) then
      raise exception 'No es un chat tuyo' using errcode = '42501';
    end if;
  elsif p_kind = 'group' then
    if not public.is_group_member(p_chat_id) then
      raise exception 'No es un chat tuyo' using errcode = '42501';
    end if;
  else
    raise exception 'Tipo de chat inválido' using errcode = '22023';
  end if;

  insert into public.chat_reads (user_id, chat_kind, chat_id, last_read_at)
  values (v_uid, p_kind, p_chat_id, clock_timestamp())
  on conflict (user_id, chat_kind, chat_id) do update
    set last_read_at = greatest(public.chat_reads.last_read_at, excluded.last_read_at);
end;
$fn$;

revoke execute on function public.mark_chat_read(text, uuid) from public, anon;
grant execute on function public.mark_chat_read(text, uuid) to authenticated;


create or replace function public.unread_message_counts()
returns table (chat_kind text, chat_id uuid, unread integer)
language sql
stable
security definer
set search_path = ''
as $fn$
  with me as (
    select (select auth.uid()) as uid
  ),
  my_matches as (
    select m.id
    from public.matches m, me
    where me.uid in (m.profile_a, m.profile_b)
      and not public.has_profile_block(m.profile_a)
      and not public.has_profile_block(m.profile_b)
  ),
  match_counts as (
    select 'match'::text as chat_kind, msg.match_id as chat_id, count(*)::integer as unread
    from my_matches mm
    join public.messages msg on msg.match_id = mm.id
    cross join me
    left join public.chat_reads r
      on r.user_id = me.uid and r.chat_kind = 'match' and r.chat_id = mm.id
    where msg.sender_id <> me.uid
      and (r.last_read_at is null or msg.sent_at > r.last_read_at)
    group by msg.match_id
  ),
  group_counts as (
    select 'group'::text as chat_kind, gm.group_id as chat_id, count(*)::integer as unread
    from me
    join public.group_members mem on mem.user_id = me.uid
    join public.group_messages gm on gm.group_id = mem.group_id
    left join public.chat_reads r
      on r.user_id = me.uid and r.chat_kind = 'group' and r.chat_id = mem.group_id
    where gm.sender_id <> me.uid
      and not public.has_profile_block(gm.sender_id)
      and gm.sent_at > coalesce(r.last_read_at, mem.joined_at)
    group by gm.group_id
  )
  select * from match_counts
  union all
  select * from group_counts;
$fn$;

revoke execute on function public.unread_message_counts() from public, anon;
grant execute on function public.unread_message_counts() to authenticated;
