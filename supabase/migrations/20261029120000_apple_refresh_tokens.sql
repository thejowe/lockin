-- Refresh token de Apple, para poder revocarlo al borrar la cuenta (App Store,
-- norma 5.1.1(v)).
--
-- «Continuar con Apple» en iOS entra con `signInWithIdToken`, y en ese flujo
-- GoTrue no guarda ningún token de Apple. La Edge Function `apple-token` canjea
-- el `authorizationCode` de la hoja nativa y deja aquí el refresh token; antes
-- de `delete_my_account` la misma función lo revoca en Apple y borra la fila.
--
-- Una fila por cuenta. Cuelga de `auth.users` con `on delete cascade`: si la
-- cuenta se borra sin haber revocado (Apple caído, función sin secretos), la
-- fila no se queda huérfana.
--
-- PRIVADA: es una credencial. Ni `anon` ni `authenticated` tienen ningún
-- permiso (Supabase se los concede de fábrica sobre toda tabla nueva de
-- `public`, de ahí el `revoke all`), RLS activada y sin políticas. Solo la lee
-- y escribe la service role, desde la función.

create table public.apple_refresh_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null check (char_length(refresh_token) between 1 and 1024),
  updated_at timestamptz not null default now()
);

alter table public.apple_refresh_tokens enable row level security;

revoke all on table public.apple_refresh_tokens from public, anon, authenticated;
