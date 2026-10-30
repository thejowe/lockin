// Fixture mínima de Supabase (auth, roles, realtime y privilegios por defecto) para
// probar las migraciones en PGlite sin Docker. La comparten schema-embedded.test.mjs
// y premium-embedded.test.mjs.
export const SUPABASE_FIXTURE_SQL = `create schema auth;
      create table auth.users (
        id uuid primary key,
        email text,
        created_at timestamptz not null default now(),
        last_sign_in_at timestamptz
      );
      -- Tabla mínima de GoTrue; refreshed_at es timestamp sin zona, como allí.
      create table auth.sessions (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references auth.users (id) on delete cascade,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        refreshed_at timestamp
      );
      create table auth.identities (
        provider_id text not null,
        user_id uuid not null,
        identity_data jsonb not null,
        provider text not null,
        primary key (provider, provider_id)
      );
      create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
      create role anon; create role authenticated; create role service_role;
      -- Supabase concede esto de fábrica fuera de cualquier migración —
      -- auth es un esquema gestionado por la plataforma, no por este repo.
      -- Hasta ahora ningún caso de esta fixture ejercitaba una política RLS
      -- SECURITY INVOKER llamando a auth.uid() directamente bajo el rol
      -- authenticated (las que sí lo hacían pasaban antes por una función
      -- SECURITY DEFINER, que ya eleva el privilegio); sin este grant esa
      -- ruta falla aquí con «permission denied for schema auth», y en el
      -- proyecto real no falla nunca, así que sin él la fixture mentiría.
      grant usage on schema auth to anon, authenticated, service_role;
      grant execute on function auth.uid() to anon, authenticated, service_role;
      alter default privileges in schema public
        grant all on tables to anon, authenticated, service_role;
      create publication supabase_realtime;
      -- Fixture de Realtime, por el mismo motivo que la de Auth: sin ella,
      -- la migración 20260917000100_realtime_authorization.sql ni se ejecuta. En
      -- Supabase el esquema realtime viene puesto y CERRADO —crear cosas dentro
      -- falla con permiso denegado—, así que aquí se emula lo justo que esa
      -- migración toca: la tabla, su RLS (que allí viene activada de fábrica, y
      -- la migración se niega a seguir si no lo está), los permisos con los que
      -- nace el rol authenticated y el helper realtime.topic(), que es de donde
      -- sale el nombre del canal al que el cliente se está uniendo.
      create schema realtime;
      create table realtime.messages (
        id uuid primary key default gen_random_uuid(),
        topic text not null,
        extension text not null,
        payload jsonb,
        event text,
        private boolean default false,
        inserted_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
      alter table realtime.messages enable row level security;
      grant usage on schema realtime to anon, authenticated;
      grant select, insert on realtime.messages to authenticated;
      create function realtime.topic() returns text language sql stable
        as $$ select nullif(current_setting('realtime.topic', true), '') $$;`;
