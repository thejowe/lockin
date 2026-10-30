-- LockIn — Premium (suscripción), parte 1: tablas y helpers.
-- Spec: docs/superpowers/specs/2026-10-26-premium-design.md (§3). Plan: Tarea 2.
--
-- Migración NUEVA: no reescribe ninguna de las ya aplicadas. Las funciones que
-- gastan los cupos (`record_decision`, `undo_last_decision`, `activate_boost`,
-- `premium_quotas`, likes recibidos) están en 20261030120100, y el deck con los
-- filtros premium en 20261030120200.
--
-- Principio: cada límite y cada permiso se comprueba EN EL SERVIDOR. El cliente
-- solo pinta. Ninguna de las tablas nuevas admite escritura desde el cliente:
-- `entitlements` y `revenuecat_events` los escribe la service role (Edge
-- Functions de la fase 3), y `like_events` y `boosts` solo los escriben los RPC
-- `security definer`.

-- ---------------------------------------------------------------------------
-- entitlements: hasta cuándo es Premium cada persona
-- ---------------------------------------------------------------------------
--
-- Una fila por cuenta. `premium_until` lo escribe la service role a partir de lo
-- que diga RevenueCat; las tiendas ya tienen su propio periodo de gracia por
-- cobro fallido y lo reflejan alargando esa fecha, así que aquí no hay margen.
-- La persona solo puede leer SU fila.

create table public.entitlements (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  premium_until timestamptz,
  product_id text,
  store text check (store in ('app_store', 'play_store')),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- like_events: registro de likes gastados, SOLO de inserción
-- ---------------------------------------------------------------------------
--
-- `decisions` hace upsert y guarda solo la última decisión; contar ahí abriría
-- el truco de dar like, cambiarlo a pass y repetir sin gastar nada. Esta tabla
-- recuerda cada like (y cada Super Like) aunque la decisión cambie o se deshaga.
--
-- `target_id` va SIN clave ajena a propósito: si se borra el perfil destino, el
-- like gastado no se devuelve. Sí cae con el actor (cascade).

create table public.like_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null,
  kind text not null check (kind in ('like', 'super')),
  created_at timestamptz not null default now()
);
create index like_events_actor_kind_created_idx
  on public.like_events (actor_id, kind, created_at desc);
create index like_events_created_idx on public.like_events (created_at);

-- ---------------------------------------------------------------------------
-- decisions.is_super: el Super Like es un like con marca
-- ---------------------------------------------------------------------------
--
-- No es un valor nuevo del enum `decision`: sigue siendo 'like' | 'pass', así
-- que no se rompen mappers ni fixtures. La RLS de `decisions` NO cambia: quién
-- te ha dado like solo sale por los RPC de 20261030120100.

alter table public.decisions add column is_super boolean not null default false;

-- ---------------------------------------------------------------------------
-- boosts: 30 minutos delante en el deck de los demás
-- ---------------------------------------------------------------------------

create table public.boosts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at)
);
create index boosts_ends_at_idx on public.boosts (ends_at);
create index boosts_user_starts_idx on public.boosts (user_id, starts_at desc);

-- ---------------------------------------------------------------------------
-- revenuecat_events: idempotencia del webhook (fase 3)
-- ---------------------------------------------------------------------------

create table public.revenuecat_events (
  event_id text primary key,
  received_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS y permisos
-- ---------------------------------------------------------------------------
--
-- Supabase concede ALL a `authenticated` sobre toda tabla nueva de `public`: de
-- ahí el `revoke all`. Solo `entitlements` se puede leer, y solo la fila propia.

alter table public.entitlements enable row level security;
alter table public.like_events enable row level security;
alter table public.boosts enable row level security;
alter table public.revenuecat_events enable row level security;

revoke all on table public.entitlements from public, anon, authenticated;
revoke all on table public.like_events from public, anon, authenticated;
revoke all on table public.boosts from public, anon, authenticated;
revoke all on table public.revenuecat_events from public, anon, authenticated;

grant select on table public.entitlements to authenticated;

create policy "entitlements: solo lees el tuyo"
  on public.entitlements for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- is_premium(uid) y premium_limits()
-- ---------------------------------------------------------------------------
--
-- Las dos son internas: las llaman los RPC `security definer` (que corren como
-- dueño) y no se conceden a nadie. Dejar `is_premium(uid)` abierta permitiría
-- averiguar quién es Premium preguntando por su id.

create function public.is_premium(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce(
    (select e.premium_until > now() from public.entitlements e where e.user_id = p_user),
    false
  );
$fn$;

revoke execute on function public.is_premium(uuid) from public, anon, authenticated;

-- Los siete límites en un solo sitio. `src/data/premium-limits.ts` los repite y
-- un test de `supabase/premium-embedded.test.mjs` compara los dos.
create function public.premium_limits()
returns table (
  free_likes_per_day integer,
  abuse_likes_per_day integer,
  free_supers_per_week integer,
  premium_supers_per_week integer,
  boost_minutes integer,
  boost_cooldown_days integer,
  undo_window_minutes integer
)
language sql
immutable
set search_path = ''
as $fn$
  select 25, 300, 1, 5, 30, 30, 10;
$fn$;

revoke execute on function public.premium_limits() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Purga (pg_cron, si existe)
-- ---------------------------------------------------------------------------
--
-- El cupo más largo es de 7 días, así que 30 sobran en `like_events`; los
-- eventos del webhook solo sirven para no procesar dos veces el mismo.

create function public.purge_old_premium_records()
returns void
language sql
security definer
set search_path = ''
as $fn$
  delete from public.like_events where created_at < now() - interval '30 days';
  delete from public.revenuecat_events where received_at < now() - interval '90 days';
$fn$;

revoke execute on function public.purge_old_premium_records() from public, anon, authenticated;

-- Un fallo (o un timeout) al activar pg_cron no aborta la migración: sale un
-- WARNING y la función queda lista para programarse a mano. Sin pg_cron (el
-- PostgreSQL embebido de las pruebas) sale un NOTICE.

do $cron$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron no está disponible: purge_old_premium_records() queda sin programar';
    return;
  end if;
  create extension if not exists pg_cron with schema pg_catalog;
  perform cron.schedule('lockin-purge-old-premium-records', '40 3 * * *', 'select public.purge_old_premium_records()');
exception when others or query_canceled then
  raise warning 'no se pudo programar con pg_cron (%): programa a mano purge_old_premium_records()', sqlerrm;
end
$cron$;
