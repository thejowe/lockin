-- A project uses the existing plan. Old mobile clients only toggle closed.
alter table public.chat_plan_items
  add column assignee_id uuid,
  add column due_at timestamptz,
  add column status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'done')),
  add constraint chat_plan_task_fields check (
    starts_at is null or (assignee_id is null and due_at is null and status = 'pending')
  );

update public.chat_plan_items set status = 'done' where starts_at is null and closed;
grant insert (assignee_id, due_at, status), update (assignee_id, due_at, status)
  on public.chat_plan_items to authenticated;

create function public.sync_project_task() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare enhanced boolean;
begin
  if tg_op = 'INSERT' then
    enhanced := new.assignee_id is not null or new.due_at is not null or new.status <> 'pending';
  else
    enhanced := (new.assignee_id, new.due_at, new.status)
      is distinct from (old.assignee_id, old.due_at, old.status);
  end if;
  -- RLS on workspaces and authors is also applied to this lookup.
  if enhanced and not exists (
    select 1 from public.project_workspaces w
    where w.match_id = new.match_id and new.starts_at is null
      and (new.assignee_id is null or exists (
        select 1 from public.project_authors a
        where a.project_id = w.project_id and a.user_id = new.assignee_id
      ))
  ) then
    raise exception 'Invalid project task' using errcode = '23514';
  end if;
  if new.starts_at is null then
    if tg_op = 'INSERT' and new.closed and new.status = 'pending' then
      new.status := 'done';
    elsif tg_op = 'UPDATE' and new.closed is distinct from old.closed
       and new.status is not distinct from old.status then
      new.status := case when new.closed then 'done' else 'pending' end;
    else
      new.closed := new.status = 'done';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.sync_project_task() from public, anon, authenticated;
create trigger sync_project_task before insert or update on public.chat_plan_items
  for each row execute function public.sync_project_task();

create index project_due_tasks on public.chat_plan_items(due_at)
  where match_id is not null and due_at is not null and not closed;
create index project_upcoming_meetings on public.chat_plan_items(starts_at)
  where match_id is not null and starts_at is not null and not closed;
create index project_recent_events on public.project_events(created_at);

-- One delivery lease per recipient device, event (or task/meeting), and occurrence.
-- A moved deadline is a new occurrence. An accepted ticket completes only its device.
create table public.project_push_deliveries (
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null references public.push_tokens(token) on delete cascade,
  source_id uuid not null,
  kind text not null,
  occurrence timestamptz not null,
  lease_id uuid not null unique default gen_random_uuid(),
  claimed_at timestamptz not null default now(),
  delivered boolean not null default false,
  primary key (user_id, token, source_id, kind, occurrence)
);
alter table public.project_push_deliveries enable row level security;
revoke all on public.project_push_deliveries from public, anon, authenticated;

create function public.project_push_candidates(p_event_id uuid)
returns table (token text, user_id uuid, locale text, match_id uuid, source_id uuid,
  event_kind text, occurrence timestamptz, item_title text)
language sql stable security definer set search_path = '' as $$
  with notices as (
    select e.match_id, e.id as source_id, e.kind, e.created_at as occurrence,
           null::text as item_title,
           case when m.profile_a = e.actor_id then m.profile_b else m.profile_a end as recipient
    from public.project_events e
    join public.matches m on m.id = e.match_id and e.actor_id in (m.profile_a, m.profile_b)
    left join public.project_workspaces w on w.project_id = e.project_id and w.match_id = m.id
    where (p_event_id is null or e.id = p_event_id) and e.created_at >= now() - interval '1 day'
      and (e.kind = 'deleted' or (w.project_id is not null and (
        e.kind = 'created' or (e.kind = 'proposed' and w.proposed_by = e.actor_id and not exists (
          select 1 from public.project_events newer where newer.project_id = e.project_id
            and newer.kind = 'proposed' and (newer.created_at, newer.id) > (e.created_at, e.id)
        ))
      )))
    union all
    select i.match_id, i.id, case when i.starts_at is null then 'task' else 'meeting' end,
           coalesce(i.starts_at, i.due_at), i.title, a.user_id
    from public.chat_plan_items i
    join public.project_workspaces w on w.match_id = i.match_id
    join public.project_authors a on a.project_id = w.project_id
      and (i.assignee_id is null or i.assignee_id = a.user_id)
    where p_event_id is null and not i.closed and (
      (i.due_at > now() and i.due_at <= now() + interval '24 hours') or
      (i.starts_at > now() and i.starts_at <= now() + interval '15 minutes')
    )
  )
  select t.token, n.recipient, coalesce(s.locale,'en'), n.match_id, n.source_id,
         n.kind, n.occurrence, n.item_title
  from notices n
  join public.matches m on m.id = n.match_id and n.recipient in (m.profile_a,m.profile_b)
  join public.push_tokens t on t.user_id = n.recipient
  left join public.user_settings s on s.user_id = n.recipient
  left join public.project_push_deliveries d on
    (d.user_id,d.token,d.source_id,d.kind,d.occurrence) =
    (n.recipient,t.token,n.source_id,n.kind,n.occurrence)
  where not public.push_pair_blocked(m.profile_a, m.profile_b)
    and coalesce(case when n.kind in ('task','meeting') then s.notify_reminders else s.notify_messages end, true)
    and (d.lease_id is null or (not d.delivered and d.claimed_at <= now() - interval '3 minutes'));
$$;

create function public.project_push_targets(p_event_id uuid)
returns table (token text, locale text, match_id uuid, source_id uuid,
  event_kind text, item_title text, notice_id uuid)
language sql volatile security definer set search_path = '' as $$
  with batch as materialized (
    select * from public.project_push_candidates(p_event_id)
    order by occurrence, source_id, user_id, token limit 300
  ), claimed as (
    insert into public.project_push_deliveries as d(user_id,token,source_id,kind,occurrence)
    select b.user_id,b.token,b.source_id,b.event_kind,b.occurrence from batch b
    on conflict (user_id,token,source_id,kind,occurrence) do update
      set lease_id = gen_random_uuid(), claimed_at = now()
      where not d.delivered and d.claimed_at <= now() - interval '3 minutes'
    returning user_id,token,source_id,kind,occurrence,lease_id
  )
  select b.token,b.locale,b.match_id,b.source_id,b.event_kind,b.item_title,c.lease_id
  from batch b join claimed c on (c.user_id,c.token,c.source_id,c.kind,c.occurrence) =
    (b.user_id,b.token,b.source_id,b.event_kind,b.occurrence);
$$;

create function public.complete_project_push(p_notice_ids uuid[])
returns void language sql security definer set search_path = '' as $$
  update public.project_push_deliveries set delivered = true where lease_id = any(p_notice_ids);
$$;

create trigger project_events_push after insert on public.project_events
  for each row execute function public.notify_service_push('project-event','event_id');

create function public.enqueue_project_reminders() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.project_push_deliveries where occurrence < now() - interval '2 days';
  -- Also recover event webhooks that failed or were interrupted before an Expo ticket.
  if exists (select 1 from public.project_push_candidates(null)) then
    perform public.enqueue_push('{"type":"project-reminders"}'::jsonb);
  end if;
end;
$$;

revoke all on function public.project_push_candidates(uuid), public.project_push_targets(uuid),
  public.complete_project_push(uuid[]), public.enqueue_project_reminders() from public, anon, authenticated;
grant execute on function public.project_push_targets(uuid), public.complete_project_push(uuid[])
  to service_role;

do $cron$
begin
  if exists (select 1 from pg_catalog.pg_extension where extname = 'pg_cron') then
    perform cron.schedule('lockin-project-reminders', '*/5 * * * *', 'select public.enqueue_project_reminders();');
  end if;
end;
$cron$;
