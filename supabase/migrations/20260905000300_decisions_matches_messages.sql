-- LockIn — `decisions` (swipes), `matches` y `messages`.

-- ---------------------------------------------------------------------------
-- decisions — un swipe. Es lo que sostiene `DiscoveryRepository`.
-- ---------------------------------------------------------------------------
--
-- No está en la lista de tablas de `.claude/agents/datos.md`, pero el contrato
-- de `arquitecto` la exige: `recordDecision` necesita saber si el otro lado ya
-- dio like, y `listDecided`/`getDeck` necesitan excluir lo ya swipeado. En el
-- mock esto vive en `state.decisions` + `state.incomingLikes`; aquí ambas cosas
-- son la misma tabla leída en dos direcciones.
--
-- Ningún usuario puede leer las filas donde él es el `target` (ver RLS): saber
-- quién te ha dado like antes de corresponder rompería el producto. La
-- reciprocidad solo se resuelve dentro de `public.record_decision()`.

create table public.decisions (
  actor_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  decision public.decision not null,
  created_at timestamptz not null default now(),

  primary key (actor_id, target_id),
  constraint decisions_no_self_swipe check (actor_id <> target_id)
);

comment on table public.decisions is
  'Swipes. Se lee como "lo que he decidido" (actor_id) y, solo desde record_decision(), como "quién me ha dado like" (target_id).';

-- Lookup de reciprocidad: ¿me ha dado like esta persona?
create index decisions_reciprocity_idx on public.decisions (target_id, actor_id)
  where decision = 'like';


-- ---------------------------------------------------------------------------
-- matches
-- ---------------------------------------------------------------------------
--
-- El par se guarda canónicamente ordenado (`profile_a < profile_b`) para que
-- UNIQUE impida dos matches entre las mismas dos personas. `Match.profileIds`
-- del contrato es una tupla `[propio, otro]`: el orden se reconstruye en la
-- capa de mapeo de `src/data/supabase/`, no aquí.
--
-- Los usuarios NO insertan en esta tabla (ver RLS). Un match solo nace dentro
-- de `public.record_decision()`, que es la única que puede ver ambos lados.

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  profile_a uuid not null references public.profiles (id) on delete cascade,
  profile_b uuid not null references public.profiles (id) on delete cascade,
  mode public.mode not null,
  created_at timestamptz not null default now(),
  /** `null` hasta el primer mensaje. Lo mantiene un trigger sobre `messages`. */
  last_message_at timestamptz,

  constraint matches_pair_is_ordered check (profile_a < profile_b),
  constraint matches_pair_unique unique (profile_a, profile_b)
);

comment on table public.matches is
  'Match entre dos perfiles. Par ordenado canónicamente; la tupla [propio, otro] se reconstruye en el cliente.';

-- `MatchRepository.list()` ordena por coalesce(last_message_at, created_at) desc.
create index matches_profile_a_idx on public.matches (profile_a, coalesce(last_message_at, created_at) desc);
create index matches_profile_b_idx on public.matches (profile_b, coalesce(last_message_at, created_at) desc);


-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (btrim(body) <> '' and char_length(body) <= 4000),
  sent_at timestamptz not null default now()
);

comment on table public.messages is
  'Mensaje 1:1 dentro de un match. Sin edición ni borrado en el MVP (ver políticas RLS).';

-- `listByMatch` devuelve la conversación en orden cronológico.
create index messages_match_sent_at_idx on public.messages (match_id, sent_at, id);


-- ---------------------------------------------------------------------------
-- Helper de pertenencia — se usa en las políticas RLS de `messages`.
-- ---------------------------------------------------------------------------
--
-- SECURITY INVOKER a propósito: el usuario ya puede leer sus propios matches,
-- así que no hace falta elevar privilegios para responder a esta pregunta.

create or replace function public.is_match_member(p_match_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.matches m
    where m.id = p_match_id
      and (select auth.uid()) in (m.profile_a, m.profile_b)
  );
$$;
