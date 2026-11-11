-- cofounder: preferencias, avisos y tareas periódicas. Preparada; NO aplicada.
-- Reutiliza push_webhook_url / push_webhook_secret. No crea ni modifica secretos.
alter table public.user_settings
  add column if not exists locale text check (locale in ('es','en','ca')),
  add column if not exists last_active_at timestamptz,
  add column if not exists incoming_likes_seen_at timestamptz,
  add column if not exists last_like_digest_at timestamptz,
  add column if not exists last_reengagement_at timestamptz,
  add column if not exists last_premium_expiry_notice_on date,
  add column if not exists notify_likes boolean not null default true,
  add column if not exists notify_matches boolean not null default true,
  add column if not exists notify_messages boolean not null default true,
  add column if not exists notify_group_messages boolean not null default true,
  add column if not exists notify_group_activity boolean not null default true,
  add column if not exists notify_reminders boolean not null default true,
  add column if not exists notify_premium boolean not null default true;

-- El modo sigue escribiéndose como antes; las marcas y preferencias nuevas, solo por RPC.
revoke insert, update, delete on public.user_settings from authenticated;
grant insert (user_id, active_mode), update (active_mode) on public.user_settings to authenticated;

create or replace function public.set_notification_locale(p_locale text)
returns void language plpgsql security definer set search_path = '' as $fn$
begin
  if auth.uid() is null then raise exception 'No hay sesión autenticada.' using errcode = '28000'; end if;
  if p_locale is null or p_locale not in ('es','en','ca') then
    raise exception 'Idioma no válido.' using errcode = '22023';
  end if;
  insert into public.user_settings(user_id, locale) values (auth.uid(), p_locale)
  on conflict (user_id) do update set locale = excluded.locale;
end;
$fn$;

drop function if exists public.register_push_token(text,text);
create or replace function public.register_push_token(p_token text, p_platform text, p_locale text default null)
returns void language plpgsql security definer set search_path = '' as $fn$
begin
  if auth.uid() is null then raise exception 'No hay sesión autenticada.' using errcode = '28000'; end if;
  if p_locale is not null then perform public.set_notification_locale(p_locale); end if;
  insert into public.user_settings(user_id) values (auth.uid()) on conflict do nothing;
  insert into public.push_tokens(token,user_id,platform,updated_at)
  values (p_token,auth.uid(),p_platform,now()) on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = excluded.updated_at;
end;
$fn$;

create or replace function public.notification_prefs()
returns jsonb language sql stable security definer set search_path = '' as $fn$
  select jsonb_build_object(
    'notify_likes',coalesce(s.notify_likes,true),'notify_matches',coalesce(s.notify_matches,true),
    'notify_messages',coalesce(s.notify_messages,true),'notify_group_messages',coalesce(s.notify_group_messages,true),
    'notify_group_activity',coalesce(s.notify_group_activity,true),'notify_reminders',coalesce(s.notify_reminders,true),
    'notify_premium',coalesce(s.notify_premium,true))
  from (select auth.uid() as id) u left join public.user_settings s on s.user_id = u.id
  where u.id is not null;
$fn$;

create or replace function public.set_notification_prefs(p_prefs jsonb)
returns void language plpgsql security definer set search_path = '' as $fn$
begin
  if auth.uid() is null then raise exception 'No hay sesión autenticada.' using errcode = '28000'; end if;
  if jsonb_typeof(p_prefs) is distinct from 'object' or exists (
    select 1 from jsonb_each(p_prefs) e where e.key not in (
      'notify_likes','notify_matches','notify_messages','notify_group_messages',
      'notify_group_activity','notify_reminders','notify_premium') or jsonb_typeof(e.value) <> 'boolean'
  ) then raise exception 'Preferencias no válidas.' using errcode = '22023'; end if;
  insert into public.user_settings(user_id) values (auth.uid()) on conflict do nothing;
  update public.user_settings set
    notify_likes = coalesce((p_prefs->>'notify_likes')::boolean,notify_likes),
    notify_matches = coalesce((p_prefs->>'notify_matches')::boolean,notify_matches),
    notify_messages = coalesce((p_prefs->>'notify_messages')::boolean,notify_messages),
    notify_group_messages = coalesce((p_prefs->>'notify_group_messages')::boolean,notify_group_messages),
    notify_group_activity = coalesce((p_prefs->>'notify_group_activity')::boolean,notify_group_activity),
    notify_reminders = coalesce((p_prefs->>'notify_reminders')::boolean,notify_reminders),
    notify_premium = coalesce((p_prefs->>'notify_premium')::boolean,notify_premium)
  where user_id = auth.uid();
end;
$fn$;

create or replace function public.mark_incoming_likes_seen()
returns void language plpgsql security definer set search_path = '' as $fn$
begin
  if auth.uid() is null then raise exception 'No hay sesión autenticada.' using errcode = '28000'; end if;
  insert into public.user_settings(user_id,incoming_likes_seen_at) values (auth.uid(),now())
  on conflict (user_id) do update set incoming_likes_seen_at = excluded.incoming_likes_seen_at;
end;
$fn$;
create or replace function public.touch_last_active()
returns void language plpgsql security definer set search_path = '' as $fn$
begin
  if auth.uid() is null then raise exception 'No hay sesión autenticada.' using errcode = '28000'; end if;
  insert into public.user_settings(user_id,last_active_at) values (auth.uid(),now())
  on conflict (user_id) do update set last_active_at = excluded.last_active_at
    where public.user_settings.last_active_at is null or public.user_settings.last_active_at <= now() - interval '15 minutes';
end;
$fn$;

-- Un bloqueo en cualquiera de los sentidos. No depende de auth.uid() (service role).
create or replace function public.push_pair_blocked(p_a uuid,p_b uuid)
returns boolean language sql stable security definer set search_path = '' as $fn$
  select exists(select 1 from public.user_blocks where
    (blocker_id=p_a and blocked_id=p_b) or (blocker_id=p_b and blocked_id=p_a));
$fn$;
create or replace function public.push_local_time(p_user uuid,p_at timestamptz default now())
returns timestamp language sql stable security definer set search_path = '' as $fn$
  select timezone(coalesce((select z.name from public.profiles p join pg_catalog.pg_timezone_names z
    on z.name=p.timezone where p.id=p_user),'Europe/Madrid'),p_at);
$fn$;
create or replace function public.push_unseen_likes(p_user uuid,p_since timestamptz)
returns table(like_count integer, first_name text, first_super boolean)
language sql stable security definer set search_path = '' as $fn$
  select count(*)::integer,
    case when public.is_premium(p_user) then (array_agg(p.name order by d.is_super desc,d.created_at desc,d.actor_id))[1] end,
    case when public.is_premium(p_user) then (array_agg(d.is_super order by d.is_super desc,d.created_at desc,d.actor_id))[1] end
  from public.decisions d join public.profiles p on p.id=d.actor_id
  where d.target_id=p_user and d.decision='like' and d.created_at>coalesce(p_since,'-infinity')
    and not exists(select 1 from public.decisions mine where mine.actor_id=p_user and mine.target_id=d.actor_id)
    and not public.push_pair_blocked(p_user,d.actor_id);
$fn$;

-- Arrendamiento corto: cron concurrente no duplica envíos. Las marcas avanzan SOLO
-- con ticket Expo `ok`, hasta la hora de selección (no se pierden likes llegados durante el envío).
create table if not exists public.push_notice_claims (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('like-digest','reengagement','premium-expiry')),
  notice_id uuid not null unique default gen_random_uuid(),
  claimed_at timestamptz not null default now(),
  expiry_on date,
  includes_likes boolean not null default false,
  primary key(user_id,kind)
);
alter table public.push_notice_claims enable row level security;
revoke all on public.push_notice_claims from public,anon,authenticated;
create or replace function public.claim_push_notice(p_user uuid,p_kind text,p_expiry date default null,p_likes boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $fn$
declare v_id uuid;
begin
  insert into public.push_notice_claims(user_id,kind,expiry_on,includes_likes) values(p_user,p_kind,p_expiry,p_likes)
  on conflict(user_id,kind) do update set notice_id=gen_random_uuid(),claimed_at=now(),expiry_on=excluded.expiry_on,includes_likes=excluded.includes_likes
    where public.push_notice_claims.claimed_at <= now()-interval '15 minutes'
  returning notice_id into v_id;
  return v_id;
end;
$fn$;

create or replace function public.like_digest_push_targets()
returns table(token text,user_id uuid,locale text,notice_id uuid,like_count integer,first_name text,first_super boolean)
language sql security definer set search_path = '' as $fn$
  with eligible as materialized (
    select s.user_id,s.locale,l.*,public.claim_push_notice(s.user_id,'like-digest') as notice_id
    from public.user_settings s cross join lateral public.push_unseen_likes(s.user_id,
      greatest(s.incoming_likes_seen_at,s.last_like_digest_at)) l
    where s.notify_likes and l.like_count>0
      and public.push_local_time(s.user_id)::time >= time '11:00'
      and public.push_local_time(s.user_id)::time < time '12:00'
      and (s.last_like_digest_at is null or (s.last_like_digest_at<=now()-interval '20 hours'
        and public.push_local_time(s.user_id,s.last_like_digest_at)::date<public.push_local_time(s.user_id)::date))
      and exists(select 1 from public.push_tokens t where t.user_id=s.user_id)
    order by s.last_like_digest_at nulls first,s.user_id limit 500
  ) select t.token,e.user_id,coalesce(e.locale,'en'),e.notice_id,e.like_count,e.first_name,e.first_super
    from eligible e join public.push_tokens t on t.user_id=e.user_id where e.notice_id is not null;
$fn$;

create or replace function public.push_latest_message(p_user uuid,p_since timestamptz)
returns table(url text,sent_at timestamptz)
language sql stable security definer set search_path = '' as $fn$
  select recent.url,recent.sent_at from (
    select '/chat/'||m.match_id as url,m.sent_at from public.messages m
    join public.matches mt on mt.id=m.match_id
    where p_user in (mt.profile_a,mt.profile_b) and m.sender_id<>p_user
      and m.sent_at>p_since and not public.push_pair_blocked(p_user,m.sender_id)
    union all
    select '/group/'||m.group_id,m.sent_at from public.group_messages m
    join public.group_members gm on gm.group_id=m.group_id and gm.user_id=p_user
    where m.sender_id<>p_user and m.sent_at>p_since and not public.push_pair_blocked(p_user,m.sender_id)
  ) recent order by recent.sent_at desc limit 1;
$fn$;

create or replace function public.reengagement_push_targets()
returns table(token text,user_id uuid,locale text,notice_id uuid,like_count integer,first_name text,first_super boolean,url text)
language sql security definer set search_path = '' as $fn$
  with eligible as materialized (
    select s.user_id,s.locale,l.*,coalesce(msg.url,'/(tabs)/matches') as url,
      public.claim_push_notice(s.user_id,'reengagement',null,s.notify_likes and l.like_count>0
        and (s.last_like_digest_at is null or s.last_like_digest_at<=now()-interval '20 hours')) as notice_id
    from public.user_settings s join auth.users u on u.id=s.user_id
    cross join lateral public.push_unseen_likes(s.user_id,greatest(s.incoming_likes_seen_at,s.last_like_digest_at)) l
    left join lateral public.push_latest_message(s.user_id,coalesce(s.last_active_at,u.last_sign_in_at)) msg on true
    where s.notify_reminders and coalesce(s.last_active_at,u.last_sign_in_at)<=now()-interval '3 days'
      and (s.last_reengagement_at is null or s.last_reengagement_at<=now()-interval '7 days')
      and public.push_local_time(s.user_id)::time>=time '10:00' and public.push_local_time(s.user_id)::time<time '20:00'
      -- Un resumen reciente cuenta como recordatorio: no repetir esos likes el mismo día.
      and ((s.notify_likes and l.like_count>0 and (s.last_like_digest_at is null or s.last_like_digest_at<=now()-interval '20 hours'))
        or msg.url is not null)
      and exists(select 1 from public.push_tokens t where t.user_id=s.user_id)
    order by s.last_reengagement_at nulls first,s.user_id limit 500
  ) select t.token,e.user_id,coalesce(e.locale,'en'),e.notice_id,
    case when s.notify_likes and (s.last_like_digest_at is null or s.last_like_digest_at<=now()-interval '20 hours') then e.like_count else 0 end,
    case when s.notify_likes then e.first_name end,case when s.notify_likes then e.first_super end,e.url
    from eligible e join public.user_settings s on s.user_id=e.user_id
    join public.push_tokens t on t.user_id=e.user_id where e.notice_id is not null;
$fn$;

create or replace function public.premium_expiry_push_targets()
returns table(token text,user_id uuid,locale text,notice_id uuid)
language sql security definer set search_path = '' as $fn$
  with eligible as materialized (
    select s.user_id,s.locale,public.claim_push_notice(s.user_id,'premium-expiry',(e.premium_until at time zone 'UTC')::date) as notice_id
    from public.user_settings s join public.entitlements e on e.user_id=s.user_id
    where s.notify_premium and e.premium_until>=now()+interval '20 hours' and e.premium_until<=now()+interval '28 hours'
      and e.premium_until<timestamptz '9999-01-01 UTC'
      and s.last_premium_expiry_notice_on is distinct from (e.premium_until at time zone 'UTC')::date
      and public.push_local_time(s.user_id)::time>=time '09:00' and public.push_local_time(s.user_id)::time<time '22:00'
      and exists(select 1 from public.push_tokens t where t.user_id=s.user_id)
    order by e.premium_until,s.user_id limit 500
  ) select t.token,e.user_id,coalesce(e.locale,'en'),e.notice_id from eligible e
    join public.push_tokens t on t.user_id=e.user_id where e.notice_id is not null;
$fn$;

create or replace function public.complete_push_notices(p_notice_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $fn$
begin
  update public.user_settings s set
    last_like_digest_at=greatest(c.likes_at,s.last_like_digest_at),
    last_reengagement_at=greatest(c.reminder_at,s.last_reengagement_at),
    last_premium_expiry_notice_on=coalesce(c.expiry_on,s.last_premium_expiry_notice_on)
  from (select user_id,
    max(claimed_at) filter (where kind='like-digest' or includes_likes) as likes_at,
    max(claimed_at) filter (where kind='reengagement') as reminder_at,
    max(expiry_on) filter (where kind='premium-expiry') as expiry_on
    from public.push_notice_claims where notice_id=any(p_notice_ids) group by user_id) c
  where c.user_id=s.user_id;
end;
$fn$;

create or replace function public.direct_message_push_targets(p_message_id uuid)
returns table(token text,locale text,match_id uuid,sender_name text,body text)
language sql stable security definer set search_path = '' as $fn$
  select t.token,coalesce(s.locale,'en'),mt.id,p.name,m.body from public.messages m
  join public.matches mt on mt.id=m.match_id join public.profiles p on p.id=m.sender_id
  join public.push_tokens t on t.user_id=case when mt.profile_a=m.sender_id then mt.profile_b else mt.profile_a end
  left join public.user_settings s on s.user_id=t.user_id
  where m.id=p_message_id and m.sender_id in (mt.profile_a,mt.profile_b)
    and coalesce(s.notify_messages,true) and not public.push_pair_blocked(t.user_id,m.sender_id);
$fn$;
create or replace function public.match_push_targets(p_match_id uuid)
returns table(token text,locale text,match_id uuid,other_name text)
language sql stable security definer set search_path = '' as $fn$
  select t.token,coalesce(s.locale,'en'),m.id,p.name from public.matches m
  join public.push_tokens t on t.user_id in (m.profile_a,m.profile_b)
  join public.profiles p on p.id=case when t.user_id=m.profile_a then m.profile_b else m.profile_a end
  left join public.user_settings s on s.user_id=t.user_id
  where m.id=p_match_id and coalesce(s.notify_matches,true) and not public.push_pair_blocked(m.profile_a,m.profile_b);
$fn$;
-- Conserva la firma y el copy del grupo existente.
create or replace function public.group_message_push_targets(p_message_id uuid)
returns table(token text,group_id uuid,group_name text,sender_name text,body text)
language sql stable security definer set search_path = '' as $fn$
  select t.token,g.id,g.name,coalesce(p.name,''),gm.body from public.group_messages gm
  join public.groups g on g.id=gm.group_id left join public.profiles p on p.id=gm.sender_id
  join public.group_members m on m.group_id=gm.group_id and m.user_id<>gm.sender_id
  join public.push_tokens t on t.user_id=m.user_id left join public.user_settings s on s.user_id=m.user_id
  where gm.id=p_message_id and coalesce(s.notify_group_messages,true)
    and not public.push_pair_blocked(m.user_id,gm.sender_id);
$fn$;

-- Evento persistido por el servidor: el webhook solo recibe su ID, nunca texto libre.
create table if not exists public.push_group_events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check(kind in ('joined','kicked','group-like')),
  created_at timestamptz not null default now()
);
create index if not exists push_group_events_cap_idx on public.push_group_events(actor_id,created_at) where kind='group-like';
alter table public.push_group_events enable row level security;
revoke all on public.push_group_events from public,anon,authenticated;

create or replace function public.group_activity_push_targets(p_event_id uuid)
returns table(token text,locale text,event_id uuid,event_kind text,group_id uuid,group_name text,person_name text,url text)
language sql stable security definer set search_path = '' as $fn$
  select t.token,coalesce(s.locale,'en'),e.id,
    case when e.kind='joined' and t.user_id=e.subject_id then 'joined-self' else e.kind end,
    g.id,g.name,p.name,case when e.kind='kicked' then '/(tabs)/matches' else '/group/'||g.id end
  from public.push_group_events e join public.groups g on g.id=e.group_id
  join public.profiles p on p.id=e.subject_id
  join public.push_tokens t on (
    (e.kind='joined' and exists(select 1 from public.group_members m where m.group_id=g.id and m.user_id=t.user_id))
    or (e.kind='kicked' and t.user_id=e.subject_id and not exists(select 1 from public.group_members m where m.group_id=g.id and m.user_id=t.user_id))
    or (e.kind='group-like' and t.user_id=g.admin_id and e.actor_id=g.admin_id))
  left join public.user_settings s on s.user_id=t.user_id
  where e.id=p_event_id and e.created_at>now()-interval '1 day' and coalesce(s.notify_group_activity,true)
    and not public.push_pair_blocked(t.user_id,case when e.kind='kicked' then e.actor_id else e.subject_id end);
$fn$;

create or replace function public.enqueue_push(p_body jsonb)
returns void language plpgsql security definer set search_path = '' as $fn$
declare v_url text; v_secret text;
begin
  if to_regclass('vault.decrypted_secrets') is null or not exists(select 1 from pg_catalog.pg_namespace where nspname='net') then return; end if;
  execute $q$select decrypted_secret from vault.decrypted_secrets where name='push_webhook_url'$q$ into v_url;
  execute $q$select decrypted_secret from vault.decrypted_secrets where name='push_webhook_secret'$q$ into v_secret;
  if v_url is null or v_secret is null then return; end if;
  execute $q$select net.http_post(url:=$1,body:=$2,headers:=jsonb_build_object('Content-Type','application/json','x-push-secret',$3),timeout_milliseconds:=5000)$q$
    using v_url,p_body,v_secret;
exception when others then raise warning 'enqueue_push: %',sqlerrm;
end;
$fn$;
create or replace function public.enqueue_like_digest_push()
returns void language sql security definer set search_path = '' as $fn$
  select public.enqueue_push('{"type":"like-digest"}'::jsonb);
$fn$;
create or replace function public.enqueue_hourly_push()
returns void language plpgsql security definer set search_path = '' as $fn$
begin
  perform public.enqueue_push('{"type":"reengagement"}'::jsonb);
  perform public.enqueue_push('{"type":"premium-expiry"}'::jsonb);
  delete from public.push_group_events where created_at<now()-interval '7 days';
end;
$fn$;
create or replace function public.notify_service_push()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  perform public.enqueue_push(jsonb_build_object('type',TG_ARGV[0],TG_ARGV[1],new.id));
  return new;
exception when others then raise warning 'notify_service_push: %',sqlerrm; return new;
end;
$fn$;
drop trigger if exists direct_messages_push on public.messages;
create trigger direct_messages_push after insert on public.messages for each row execute function public.notify_service_push('direct-message','message_id');
drop trigger if exists matches_push on public.matches;
create trigger matches_push after insert on public.matches for each row execute function public.notify_service_push('match','match_id');

create or replace function public.notify_group_activity_push()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare v_kind text; v_group uuid; v_subject uuid; v_actor uuid; v_id uuid;
begin
  if TG_TABLE_NAME='group_swipes' then
    if new.direction<>'user_to_group' or new.decision<>'like' then return new; end if;
    if TG_OP='UPDATE' then if old.decision='like' then return new; end if; end if;
    v_kind:='group-like'; v_group:=new.group_id; v_subject:=new.user_id;
    select admin_id into v_actor from public.groups where id=v_group;
    -- Serializa el tope de 3 por día LOCAL y admin, incluso entre grupos.
    perform 1 from public.profiles where id=v_actor for update;
    if (select count(*) from public.push_group_events e where e.kind='group-like' and e.actor_id=v_actor
      and public.push_local_time(v_actor,e.created_at)::date=public.push_local_time(v_actor)::date)>=3 then return new; end if;
  elsif TG_OP='INSERT' then
    if new.role_id is null then return new; end if; -- Crear grupo no es incorporarse por like.
    v_kind:='joined'; v_group:=new.group_id; v_subject:=new.user_id; v_actor:=new.user_id;
  else
    select admin_id into v_actor from public.groups where id=old.group_id;
    if v_actor is null or auth.uid() is distinct from v_actor or old.user_id=v_actor then return old; end if;
    v_kind:='kicked'; v_group:=old.group_id; v_subject:=old.user_id;
  end if;
  insert into public.push_group_events(group_id,actor_id,subject_id,kind) values(v_group,v_actor,v_subject,v_kind) returning id into v_id;
  perform public.enqueue_push(jsonb_build_object('type','group-activity','event_id',v_id));
  if TG_OP='DELETE' then return old; end if; return new;
exception when others then
  raise warning 'notify_group_activity_push: %',sqlerrm;
  if TG_OP='DELETE' then return old; end if; return new;
end;
$fn$;
drop trigger if exists group_members_activity_push on public.group_members;
create trigger group_members_activity_push after insert or delete on public.group_members for each row execute function public.notify_group_activity_push();
drop trigger if exists group_swipes_activity_push on public.group_swipes;
create trigger group_swipes_activity_push after insert or update on public.group_swipes for each row execute function public.notify_group_activity_push();

-- Permisos por firma, incluida la firma sustituida de registro: ninguna sobrecarga antigua.
do $permissions$
declare f record;
begin
  for f in select p.oid::regprocedure as signature,p.proname from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in (
      'set_notification_locale','register_push_token','notification_prefs','set_notification_prefs','mark_incoming_likes_seen','touch_last_active',
      'push_pair_blocked','push_local_time','push_unseen_likes','claim_push_notice','like_digest_push_targets','push_latest_message',
      'reengagement_push_targets','premium_expiry_push_targets','complete_push_notices','direct_message_push_targets','match_push_targets',
      'group_message_push_targets','group_activity_push_targets','enqueue_push','enqueue_like_digest_push','enqueue_hourly_push',
      'notify_service_push','notify_group_activity_push')
  loop
    execute format('revoke execute on function %s from public,anon,authenticated',f.signature);
    if f.proname in ('set_notification_locale','register_push_token','notification_prefs','set_notification_prefs','mark_incoming_likes_seen','touch_last_active') then
      execute format('grant execute on function %s to authenticated',f.signature);
    else execute format('grant execute on function %s to service_role',f.signature); end if;
  end loop;
end;
$permissions$;

-- cron no existe en PGlite/CI. El dueño postgres mantiene EXECUTE implícito.
do $cron$
begin
  if exists(select 1 from pg_catalog.pg_extension where extname='pg_cron') then
    perform cron.schedule('lockin-push-like-digest','*/15 * * * *','select public.enqueue_like_digest_push();');
    perform cron.schedule('lockin-push-hourly','25 * * * *','select public.enqueue_hourly_push();');
  end if;
end;
$cron$;
