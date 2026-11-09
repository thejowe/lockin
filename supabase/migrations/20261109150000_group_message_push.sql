-- cofounder — Notificaciones push del chat de grupo (2026-11-09).
--
-- Tres piezas:
--
--   1. `push_tokens`: el token de Expo de cada dispositivo, ligado a la cuenta
--      que lo registró. Un token es de un dispositivo: si otra cuenta inicia
--      sesión en ese móvil, el token pasa a ella. Nadie lo lee desde la app:
--      solo `register_push_token` / `unregister_push_token`.
--   2. `group_message_push_targets(message_id)`: a quién avisar de un mensaje y
--      con qué texto. Solo `service_role` (la Edge Function). Excluye a quien
--      lo envía y a quien tenga un bloqueo, en cualquier sentido, con él.
--   3. Un trigger AFTER INSERT en `group_messages` que avisa a la Edge Function
--      `notify-group-message` por `pg_net`. La URL y el secreto compartido viven
--      en Vault (`push_webhook_url`, `push_webhook_secret`), nunca en el repo.
--      Sin Vault, sin `pg_net` o sin esos secretos (local, PGlite, CI), el
--      trigger no hace nada; y si la llamada falla, el mensaje se guarda igual.

create table public.push_tokens (
  token text primary key,
  -- `auth.users` y no `profiles`: el permiso se puede pedir antes de tener perfil.
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null,
  updated_at timestamptz not null default now(),
  constraint push_tokens_token_check check (
    char_length(token) between 20 and 200 and token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$'
  ),
  constraint push_tokens_platform_check check (platform in ('ios', 'android'))
);

create index push_tokens_user_idx on public.push_tokens (user_id);

comment on table public.push_tokens is
  'Tokens de Expo por dispositivo. Sin políticas: solo las funciones SECURITY DEFINER.';

alter table public.push_tokens enable row level security;
revoke all on table public.push_tokens from public, anon, authenticated;

create function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'No hay sesión autenticada.' using errcode = '28000';
  end if;

  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (p_token, v_uid, p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = excluded.updated_at;
end;
$fn$;

revoke execute on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;

-- Al cerrar sesión: el dispositivo deja de recibir los avisos de esta cuenta.
create function public.unregister_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  delete from public.push_tokens
   where token = p_token and user_id = (select auth.uid());
end;
$fn$;

revoke execute on function public.unregister_push_token(text) from public, anon;
grant execute on function public.unregister_push_token(text) to authenticated;

create function public.group_message_push_targets(p_message_id uuid)
returns table (
  token text,
  group_id uuid,
  group_name text,
  sender_name text,
  body text
)
language sql
stable
security definer
set search_path = ''
as $fn$
  select t.token, g.id, g.name, coalesce(p.name, ''), gm.body
  from public.group_messages gm
  join public.groups g on g.id = gm.group_id
  left join public.profiles p on p.id = gm.sender_id
  join public.group_members m on m.group_id = gm.group_id and m.user_id <> gm.sender_id
  join public.push_tokens t on t.user_id = m.user_id
  where gm.id = p_message_id
    and not exists (
      select 1 from public.user_blocks b
      where (b.blocker_id = m.user_id and b.blocked_id = gm.sender_id)
         or (b.blocker_id = gm.sender_id and b.blocked_id = m.user_id)
    );
$fn$;

revoke execute on function public.group_message_push_targets(uuid) from public, anon, authenticated;
grant execute on function public.group_message_push_targets(uuid) to service_role;

-- Tokens que Expo da por muertos (`DeviceNotRegistered`).
create function public.forget_push_tokens(p_tokens text[])
returns void
language sql
security definer
set search_path = ''
as $fn$
  delete from public.push_tokens where token = any(p_tokens);
$fn$;

revoke execute on function public.forget_push_tokens(text[]) from public, anon, authenticated;
grant execute on function public.forget_push_tokens(text[]) to service_role;

create function public.notify_group_message_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_url text;
  v_secret text;
begin
  -- Dinámico a propósito: sin Vault o sin `pg_net` (local, PGlite) la función
  -- compila y aquí sale sin hacer nada.
  if to_regclass('vault.decrypted_secrets') is null
     or not exists (select 1 from pg_catalog.pg_namespace where nspname = 'net') then
    return new;
  end if;

  execute $q$select decrypted_secret from vault.decrypted_secrets where name = 'push_webhook_url'$q$
    into v_url;
  execute $q$select decrypted_secret from vault.decrypted_secrets where name = 'push_webhook_secret'$q$
    into v_secret;
  if v_url is null or v_secret is null then
    return new;
  end if;

  execute $q$select net.http_post(
      url := $1,
      body := jsonb_build_object('message_id', $2),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', $3),
      timeout_milliseconds := 5000
    )$q$
    using v_url, new.id, v_secret;
  return new;
exception when others then
  -- Un aviso que no sale nunca impide que el mensaje se guarde.
  raise warning 'notify_group_message_push: %', sqlerrm;
  return new;
end;
$fn$;

revoke execute on function public.notify_group_message_push() from public, anon, authenticated;

create trigger group_messages_push
  after insert on public.group_messages
  for each row execute function public.notify_group_message_push();
