-- LockIn — acuerdo de socios a ciegas (Fase 3).
--
-- Diseño: docs/superpowers/specs/2026-09-24-acuerdo-socios-design.md.
-- Patrón de `20260915000100_session_ratings.sql`: SECURITY DEFINER con
-- `search_path` vacío y nombres cualificados, `revoke`/`grant` al final
-- desde `public, anon` (lección de `20260924000100`).
--
-- La tabla solo se lee en las filas propias. La vista de la pareja la da
-- `match_agreement()`, que es donde se impone el ciego: la respuesta del otro
-- en un tema solo sale si tú ya respondiste ese tema. Escribir va por
-- `answer_agreement_topic()`: authenticated no tiene insert/update/delete.
--
-- El catálogo de temas vive en el cliente (`src/features/agreement/topics.ts`).
-- Aquí solo hay claves con formato: una clave desconocida solo estropea la
-- respuesta de quien la escribió.
--
-- Sin realtime: con la política de «solo las tuyas», `postgres_changes` nunca
-- entregaría la fila del otro.


-- ---------------------------------------------------------------------------
-- Tabla
-- ---------------------------------------------------------------------------

create table public.agreement_answers (
  match_id uuid not null references public.matches (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  topic text not null check (topic ~ '^[a-z0-9-]{1,40}$'),
  option text not null check (option ~ '^[a-z0-9-]{1,40}$'),
  -- La nota vacía se normaliza a null en el cliente; aquí vacía es un error.
  note text check (note is null or char_length(note) between 1 and 280),
  updated_at timestamptz not null default now(),
  primary key (match_id, profile_id, topic)
);

comment on table public.agreement_answers is
  'Respuesta de una persona a un tema del acuerdo de socios de un match Par. Solo se leen las propias; la vista de la pareja es match_agreement().';


-- ---------------------------------------------------------------------------
-- RLS y permisos de tabla
-- ---------------------------------------------------------------------------

alter table public.agreement_answers enable row level security;

revoke all on table public.agreement_answers from anon;
-- Supabase concede insert/update/delete a authenticated por defecto en
-- `public`. RLS ya los bloquearía sin política; se cierran también por permiso.
revoke insert, update, delete on table public.agreement_answers from authenticated;

create policy "agreement_answers: solo lees las tuyas"
  on public.agreement_answers for select
  to authenticated
  using (profile_id = (select auth.uid()));


-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function public.answer_agreement_topic(
  p_match_id uuid,
  p_topic text,
  p_option text,
  p_note text default null
)
returns public.agreement_answers
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_match public.matches;
  v_row public.agreement_answers;
begin
  select * into v_match from public.matches m where m.id = p_match_id;
  if not found or v_actor is null or v_actor not in (v_match.profile_a, v_match.profile_b) then
    raise exception 'answer_agreement_topic: el match no es tuyo' using errcode = 'LI004';
  end if;
  if v_match.mode <> 'par' then
    raise exception 'answer_agreement_topic: el acuerdo es solo para matches de cofundador'
      using errcode = 'LI005';
  end if;

  insert into public.agreement_answers as a (match_id, profile_id, topic, option, note)
  values (p_match_id, v_actor, p_topic, p_option, p_note)
  on conflict (match_id, profile_id, topic) do update
    set option = excluded.option,
        note = excluded.note,
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$fn$;

-- Una fila por tema con alguna respuesta de los dos. Las columnas `theirs_*`
-- son null salvo que exista mi respuesta a ese tema: es un `case` por columna,
-- no un filtro de filas, para que `theirs_answered` salga aunque yo no haya
-- respondido. Eso es el ciego.
create or replace function public.match_agreement(p_match_id uuid)
returns table (
  topic text,
  mine_option text,
  mine_note text,
  mine_updated_at timestamptz,
  theirs_answered boolean,
  theirs_option text,
  theirs_note text,
  theirs_updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $fn$
#variable_conflict use_column
declare
  v_actor uuid := (select auth.uid());
  v_match public.matches;
begin
  select * into v_match from public.matches m where m.id = p_match_id;
  if not found or v_actor is null or v_actor not in (v_match.profile_a, v_match.profile_b) then
    raise exception 'match_agreement: el match no es tuyo' using errcode = 'LI004';
  end if;
  if v_match.mode <> 'par' then
    raise exception 'match_agreement: el acuerdo es solo para matches de cofundador'
      using errcode = 'LI005';
  end if;

  return query
    select coalesce(mine.topic, theirs.topic),
           mine.option,
           mine.note,
           mine.updated_at,
           theirs.topic is not null,
           case when mine.topic is not null then theirs.option end,
           case when mine.topic is not null then theirs.note end,
           case when mine.topic is not null then theirs.updated_at end
    from (
      select a.topic, a.option, a.note, a.updated_at
      from public.agreement_answers a
      where a.match_id = p_match_id and a.profile_id = v_actor
    ) mine
    full outer join (
      select a.topic, a.option, a.note, a.updated_at
      from public.agreement_answers a
      where a.match_id = p_match_id and a.profile_id <> v_actor
    ) theirs on theirs.topic = mine.topic
    order by 1;
end;
$fn$;

revoke execute on function public.answer_agreement_topic(uuid, text, text, text) from public, anon;
revoke execute on function public.match_agreement(uuid) from public, anon;
grant execute on function public.answer_agreement_topic(uuid, text, text, text) to authenticated;
grant execute on function public.match_agreement(uuid) to authenticated;
