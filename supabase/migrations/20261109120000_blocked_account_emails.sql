-- cofounder — una cuenta eliminada bloquea su correo (2026-11-09).
--
-- Decisión de producto del 2026-11-09: al eliminar la cuenta, su correo queda
-- bloqueado. No se puede volver a entrar ni a crear otra cuenta con él (email
-- y contraseña, vincular el email a una cuenta anónima, Google, Apple,
-- LinkedIn, GitHub…). Para recuperarlo hay que mandar una solicitud de
-- desbloqueo explicando por qué; la revisa una persona.
--
-- Qué se guarda:
--
--   * `blocked_account_emails`: SOLO el SHA-256 del correo normalizado
--     (minúsculas, sin espacios), no el correo. Basta para reconocerlo si
--     vuelve y no deja una lista legible de quién tuvo cuenta.
--   * `account_unblock_requests`: el correo en claro y el motivo, porque hay
--     que poder contestar a quien lo pide. Lo escribe la propia persona.
--
-- Cómo se hace cumplir:
--
--   * `delete_my_account()` apunta los correos de la cuenta (el de `auth.users`
--     y los de sus identidades) ANTES de borrarla.
--   * Un trigger en `auth.users` rechaza crear un usuario, o ponerle/cambiarle
--     el email, si el correo está bloqueado. Otro en `auth.identities` rechaza
--     vincular un proveedor que traiga un correo bloqueado. Es la red de
--     seguridad: GoTrue devuelve «Database error…» sin más, así que la app
--     pregunta antes con `is_email_blocked()` para poder enseñar la pantalla
--     de desbloqueo.
--
-- Desbloquear (a mano, desde el editor SQL, tras leer la solicitud):
--
--   select public.resolve_account_unblock('<id de la solicitud>', true);
--
-- Códigos propios nuevos: LI011 (correo bloqueado), LI012 (ese correo no está
-- bloqueado), LI013 (ya hay una solicitud pendiente), LI014 (motivo o correo
-- no válidos).

-- ---------------------------------------------------------------------------
-- Huella del correo
-- ---------------------------------------------------------------------------

create or replace function public.email_block_hash(p_email text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.lower(pg_catalog.btrim(p_email)), 'UTF8')),
    'hex'
  );
$$;

revoke execute on function public.email_block_hash(text) from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- Correos bloqueados
-- ---------------------------------------------------------------------------

create table public.blocked_account_emails (
  email_hash text primary key,
  blocked_at timestamptz not null default now(),
  constraint blocked_account_emails_hash_check check (email_hash ~ '^[0-9a-f]{64}$')
);

comment on table public.blocked_account_emails is
  'SHA-256 del correo de cada cuenta eliminada. Sin políticas: solo lo tocan funciones SECURITY DEFINER.';

alter table public.blocked_account_emails enable row level security;
revoke all on table public.blocked_account_emails from public, anon, authenticated;


-- ¿Está bloqueado este correo? La app lo pregunta antes de entrar o de vincular
-- un email, para enseñar la pantalla de desbloqueo en vez de un error genérico.
create or replace function public.is_email_blocked(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_email is not null
    and pg_catalog.btrim(p_email) <> ''
    and exists (
      select 1 from public.blocked_account_emails
      where email_hash = public.email_block_hash(p_email)
    );
$$;

revoke execute on function public.is_email_blocked(text) from public;
grant execute on function public.is_email_blocked(text) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- Red de seguridad en GoTrue
-- ---------------------------------------------------------------------------

create or replace function public.enforce_blocked_account_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  if tg_table_name = 'identities' then
    v_email := new.identity_data ->> 'email';
  else
    v_email := new.email;
    if tg_op = 'UPDATE' and v_email is not distinct from old.email then
      v_email := null;
    end if;
  end if;

  if public.is_email_blocked(v_email) then
    raise exception 'cuenta eliminada: el correo está bloqueado' using errcode = 'LI011';
  end if;

  -- Cambio de email pendiente de confirmar (GoTrue lo guarda aparte).
  if tg_table_name = 'users'
    and to_jsonb(new) ? 'email_change'
    and public.is_email_blocked(to_jsonb(new) ->> 'email_change')
    and (tg_op = 'INSERT' or (to_jsonb(new) ->> 'email_change') is distinct from (to_jsonb(old) ->> 'email_change'))
  then
    raise exception 'cuenta eliminada: el correo está bloqueado' using errcode = 'LI011';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_blocked_account_email() from public, anon, authenticated;

drop trigger if exists enforce_blocked_account_email on auth.users;
create trigger enforce_blocked_account_email
  before insert or update on auth.users
  for each row execute function public.enforce_blocked_account_email();

-- Algunas fixtures de prueba no traen `auth.identities`; GoTrue siempre la tiene.
do $identities$
begin
  if to_regclass('auth.identities') is null then
    raise notice 'blocked_account_emails: no hay auth.identities, se omite su trigger';
    return;
  end if;
  execute 'drop trigger if exists enforce_blocked_account_email on auth.identities';
  execute 'create trigger enforce_blocked_account_email
    before insert on auth.identities
    for each row execute function public.enforce_blocked_account_email()';
end
$identities$;


-- ---------------------------------------------------------------------------
-- Solicitudes de desbloqueo
-- ---------------------------------------------------------------------------

create table public.account_unblock_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  reason text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint account_unblock_requests_email_check check (
    char_length(email) between 3 and 320 and email like '%_@_%'
  ),
  constraint account_unblock_requests_reason_check check (
    char_length(pg_catalog.btrim(reason)) between 30 and 2000
  ),
  constraint account_unblock_requests_status_check check (
    status in ('pending', 'approved', 'rejected')
  )
);

comment on table public.account_unblock_requests is
  'Solicitudes para recuperar un correo bloqueado al eliminar su cuenta. Las revisa una persona.';

-- Una sola solicitud pendiente por correo.
create unique index account_unblock_requests_one_pending
  on public.account_unblock_requests (public.email_block_hash(email))
  where status = 'pending';

alter table public.account_unblock_requests enable row level security;
revoke all on table public.account_unblock_requests from public, anon, authenticated;


-- La manda quien intenta entrar con un correo bloqueado (sin sesión, o con la
-- anónima del dispositivo).
create or replace function public.request_account_unblock(p_email text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, '')));
  v_reason text := pg_catalog.btrim(coalesce(p_reason, ''));
begin
  if char_length(v_email) not between 3 and 320 or v_email not like '%_@_%' then
    raise exception 'request_account_unblock: correo no válido' using errcode = 'LI014';
  end if;
  if char_length(v_reason) not between 30 and 2000 then
    raise exception 'request_account_unblock: el motivo necesita entre 30 y 2000 caracteres'
      using errcode = 'LI014';
  end if;
  if not public.is_email_blocked(v_email) then
    raise exception 'request_account_unblock: ese correo no está bloqueado' using errcode = 'LI012';
  end if;
  if exists (
    select 1 from public.account_unblock_requests
    where status = 'pending' and public.email_block_hash(email) = public.email_block_hash(v_email)
  ) then
    raise exception 'request_account_unblock: ya hay una solicitud pendiente' using errcode = 'LI013';
  end if;

  insert into public.account_unblock_requests (email, reason) values (v_email, v_reason);
end;
$$;

revoke execute on function public.request_account_unblock(text, text) from public;
grant execute on function public.request_account_unblock(text, text) to anon, authenticated;


-- La resuelve una persona del equipo desde el editor SQL. Aprobar borra el
-- bloqueo; rechazar solo cierra la solicitud.
create or replace function public.resolve_account_unblock(p_request uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  update public.account_unblock_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         resolved_at = now()
   where id = p_request and status = 'pending'
  returning email into v_email;

  if v_email is null then
    raise exception 'resolve_account_unblock: no hay solicitud pendiente con ese id';
  end if;

  if p_approve then
    delete from public.blocked_account_emails
    where email_hash = public.email_block_hash(v_email);
  end if;
end;
$$;

revoke execute on function public.resolve_account_unblock(uuid, boolean) from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- Eliminar la cuenta bloquea sus correos
-- ---------------------------------------------------------------------------
--
-- Igual que `20261017130000_board_posts.sql`, más el apunte de los correos
-- antes del borrado (después ya no quedan filas de las que leerlos).

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'delete_my_account: no hay sesión' using errcode = 'LI007';
  end if;

  perform 1 from public.profiles where id = v_uid for update;

  insert into public.blocked_account_emails (email_hash)
  select distinct public.email_block_hash(e)
  from (
    select email as e from auth.users where id = v_uid
    union
    select identity_data ->> 'email' from auth.identities where user_id = v_uid
  ) s
  where e is not null and pg_catalog.btrim(e) <> ''
  on conflict (email_hash) do nothing;

  -- Fotos: primero, mientras el id aún existe. Mismo criterio de carpeta que las
  -- políticas de storage (`<uid>/...`).
  if to_regclass('storage.objects') is not null then
    perform set_config('storage.allow_delete_query', 'true', true);
    execute $q$
      delete from storage.objects
      where bucket_id in ('avatars', 'avatar-uploads', 'board')
        and (storage.foldername(name))[1] = $1
    $q$ using v_uid::text;
  end if;

  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
