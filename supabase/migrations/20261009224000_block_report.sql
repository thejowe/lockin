-- LockIn — bloqueo bilateral y reportes privados (UGC).
-- No se publica ninguna de estas tablas en Realtime: el bloqueo no genera avisos.

create table public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index user_blocks_blocked_id_idx on public.user_blocks (blocked_id);

create table public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('acoso', 'contenido-inapropiado', 'spam', 'suplantacion', 'otro')),
  details text check (details is null or char_length(details) <= 500),
  created_at timestamptz not null default now(),
  check (reporter_id <> reported_id)
);
create index user_reports_reporter_id_idx on public.user_reports (reporter_id);
create index user_reports_reported_id_idx on public.user_reports (reported_id);

alter table public.user_blocks enable row level security;
alter table public.user_reports enable row level security;

-- Cierra también los permisos que Supabase concede por defecto a tablas nuevas.
revoke all on table public.user_blocks from public, anon, authenticated;
revoke all on table public.user_reports from public, anon, authenticated;
grant select on table public.user_blocks to authenticated;
create policy "user_blocks: solo lees los que hiciste"
  on public.user_blocks for select to authenticated
  using (blocker_id = (select auth.uid()));
-- user_reports NO tiene políticas SELECT ni escritura directa; solo report_profile.

create function public.block_profile(p_profile_id uuid)
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
    raise exception 'No puedes bloquearte a ti mismo.' using errcode = 'LI008';
  end if;
  insert into public.user_blocks (blocker_id, blocked_id)
  values (v_actor, p_profile_id)
  on conflict (blocker_id, blocked_id) do nothing;
end;
$fn$;

create function public.report_profile(p_profile_id uuid, p_reason text, p_details text default null)
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
  insert into public.user_reports (reporter_id, reported_id, reason, details)
  values (v_actor, p_profile_id, p_reason, nullif(btrim(p_details), ''));
end;
$fn$;

-- Helper para RLS y deck. Solo consulta el par del actor autenticado con el perfil
-- indicado: no permite consultar bloqueos entre terceros ni revela filas entrantes.
-- SECURITY DEFINER permite comprobar la dirección inversa sin abrir SELECT sobre ella.
--
-- Son PL/pgSQL y no SQL a propósito: un helper SQL no inlinable que se llama desde
-- otra función PL/pgSQL conserva su plan —con el cuerpo de `auth.uid()` ya
-- inlinado— mientras dure la transacción, y en una transacción larga con varias
-- identidades (el arnés de `schema-embedded.test.mjs`) respondería con la del
-- primer actor. En PL/pgSQL la consulta pasa por la caché de planes, que sí se
-- invalida al cambiar `auth.uid()`.
create function public.has_profile_block(p_profile_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_blocked boolean;
begin
  select exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = (select auth.uid()) and b.blocked_id = p_profile_id)
       or (b.blocked_id = (select auth.uid()) and b.blocker_id = p_profile_id)
  ) into v_blocked;
  return v_blocked;
end;
$fn$;

create function public.is_unblocked_match(p_match_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_ok boolean;
begin
  select exists (
    select 1 from public.matches m
    where m.id = p_match_id
      and (select auth.uid()) in (m.profile_a, m.profile_b)
      and not public.has_profile_block(m.profile_a)
      and not public.has_profile_block(m.profile_b)
  ) into v_ok;
  return v_ok;
end;
$fn$;

revoke execute on function public.block_profile(uuid) from public, anon;
revoke execute on function public.report_profile(uuid, text, text) from public, anon;
revoke execute on function public.has_profile_block(uuid) from public, anon;
revoke execute on function public.is_unblocked_match(uuid) from public, anon;
grant execute on function public.block_profile(uuid) to authenticated;
grant execute on function public.report_profile(uuid, text, text) to authenticated;
grant execute on function public.has_profile_block(uuid) to authenticated;
grant execute on function public.is_unblocked_match(uuid) to authenticated;

alter policy "matches: solo los tuyos" on public.matches
  using (
    (select auth.uid()) in (profile_a, profile_b)
    and not public.has_profile_block(profile_a)
    and not public.has_profile_block(profile_b)
  );

-- No cambia los permisos de columna (H2 queda fuera de esta tarea).
-- El INSERT se rechaza en la base incluso si el cliente conserva un chat abierto.
alter policy "messages: escribes en tu nombre en tus matches" on public.messages
  with check (
    sender_id = (select auth.uid())
    and public.is_unblocked_match(match_id)
  );

-- MISMA firma de cuatro argumentos que 20260918000100; 20260929000200 retiró
-- la sobrecarga antigua. Se preservan ranking, filtros y límite después de filtrar.
create or replace function public.discovery_deck(
  p_mode public.mode_preference default null,
  p_specialties public.specialty[] default null,
  p_limit integer default 50,
  p_exclude_ids uuid[] default null
)
returns setof public.profiles
language sql
stable
set search_path = ''
as $fn$
  with viewer as (
    select coalesce(
      p_mode,
      (select s.active_mode from public.user_settings s where s.user_id = (select auth.uid())),
      (select p.looking_for from public.profiles p where p.id = (select auth.uid()))
    ) as mode
  )
  select p.*
  from public.profiles p
  cross join viewer v
  left join public.profiles me on me.id = (select auth.uid())
  where p.id <> (select auth.uid())
    and not public.has_profile_block(p.id)
    and not exists (
      select 1 from public.decisions d
      where d.actor_id = (select auth.uid()) and d.target_id = p.id
    )
    and (p_exclude_ids is null or not (p.id = any(p_exclude_ids)))
    and (v.mode is null or v.mode = 'ambos' or p.looking_for = 'ambos' or p.looking_for = v.mode)
    and (p_specialties is null or cardinality(p_specialties) = 0 or p.specialties && p_specialties)
  order by
    case when me.id is null or v.mode = 'lockin'
      or me.looking_for = 'lockin' or p.looking_for = 'lockin' then 0
    else (me.specialties && p.seeking_specialties)::integer
       + (p.specialties && me.seeking_specialties)::integer end desc,
    p.id asc
  limit greatest(coalesce(p_limit, 50), 1);
$fn$;
revoke execute on function public.discovery_deck(public.mode_preference, public.specialty[], integer, uuid[]) from public, anon;
grant execute on function public.discovery_deck(public.mode_preference, public.specialty[], integer, uuid[]) to authenticated;
