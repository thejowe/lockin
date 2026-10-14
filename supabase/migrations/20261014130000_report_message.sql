-- LockIn — reportar un mensaje concreto (UGC, requisito de tiendas; T3b).
--
-- `user_reports` ya guardaba reportes de perfiles. Aquí un reporte puede
-- apuntar además a un mensaje:
--   * `message_id` (nullable, `on delete set null`): referencia viva mientras el
--     mensaje exista.
--   * `message_ref` / `message_excerpt`: instantánea (id como texto y los
--     primeros 500 caracteres del cuerpo). Un mensaje cae en cascada con el
--     match o con la cuenta de su autor; sin la instantánea el reporte
--     perdería lo único que lo hace accionable. Misma lógica que
--     `reporter_ref`/`reported_ref` y misma retención: caduca a los 12 meses
--     con `purge_old_user_reports()` (no se toca aquí).
-- La tabla sigue sin políticas SELECT ni escritura directa: solo RPC.

alter table public.user_reports
  add column message_id uuid references public.messages (id) on delete set null;
alter table public.user_reports add column message_ref text;
alter table public.user_reports
  add column message_excerpt text check (message_excerpt is null or char_length(message_excerpt) <= 500);

create index user_reports_message_id_idx on public.user_reports (message_id)
  where message_id is not null;

create function public.report_message(p_message_id uuid, p_reason text, p_details text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_sender uuid;
  v_body text;
begin
  if v_actor is null then
    raise exception 'No hay sesión autenticada.' using errcode = '28000';
  end if;
  if p_reason is null or p_reason not in ('acoso', 'contenido-inapropiado', 'spam', 'suplantacion', 'otro') then
    raise exception 'Elige un motivo válido.' using errcode = 'LI009';
  end if;
  if char_length(p_details) > 500 then
    raise exception 'El texto no puede superar 500 caracteres.' using errcode = '23514';
  end if;

  -- Solo quien es parte del match del mensaje puede reportarlo. Un bloqueo no
  -- lo impide: quien bloquea también debe poder reportar lo que recibió.
  select m.sender_id, m.body
    into v_sender, v_body
    from public.messages m
    join public.matches mt on mt.id = m.match_id
   where m.id = p_message_id
     and v_actor in (mt.profile_a, mt.profile_b);
  if not found then
    raise exception 'El mensaje no está disponible.' using errcode = '42501';
  end if;
  if v_sender = v_actor then
    raise exception 'No puedes reportar tus propios mensajes.' using errcode = 'LI008';
  end if;

  insert into public.user_reports
    (reporter_id, reported_id, reporter_ref, reported_ref, reason, details,
     message_id, message_ref, message_excerpt)
  values
    (v_actor, v_sender, v_actor::text, v_sender::text, p_reason, nullif(btrim(p_details), ''),
     p_message_id, p_message_id::text, left(v_body, 500));
end;
$fn$;

revoke execute on function public.report_message(uuid, text, text) from public, anon;
grant execute on function public.report_message(uuid, text, text) to authenticated;
