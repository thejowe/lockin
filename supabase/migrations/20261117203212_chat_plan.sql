create table public.chat_plan_items (
  id uuid primary key,
  match_id uuid references public.matches (id) on delete cascade,
  group_id uuid references public.groups (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (btrim(title) <> '' and char_length(title) <= 160),
  starts_at timestamptz,
  place text check (char_length(place) <= 240),
  closed boolean not null default false,
  created_at timestamptz not null default now(),
  constraint chat_plan_one_conversation check (num_nonnulls(match_id, group_id) = 1),
  constraint chat_plan_place_for_meeting check (place is null or starts_at is not null)
);

create index chat_plan_match_idx on public.chat_plan_items (match_id, created_at, id) where match_id is not null;
create index chat_plan_group_idx on public.chat_plan_items (group_id, created_at, id) where group_id is not null;
create index chat_plan_author_idx on public.chat_plan_items (author_id);

alter table public.chat_plan_items enable row level security;
revoke all on table public.chat_plan_items from public, anon, authenticated;
grant select on table public.chat_plan_items to authenticated;
grant insert (id, match_id, group_id, title, starts_at, place) on table public.chat_plan_items to authenticated;
grant update (closed) on table public.chat_plan_items to authenticated;

create policy "chat_plan: miembros de la conversación" on public.chat_plan_items
  for all to authenticated using (
    (match_id is not null and public.is_unblocked_match(match_id))
    or (group_id is not null and public.is_group_member(group_id) and not public.has_profile_block(author_id))
  );

create policy "chat_plan: nuevas reuniones futuras" on public.chat_plan_items
  as restrictive for insert to authenticated with check (starts_at is null or starts_at > now());
