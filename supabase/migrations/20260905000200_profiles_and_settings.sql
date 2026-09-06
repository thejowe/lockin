-- LockIn — `profiles` (la ficha de persona) y `user_settings` (el modo activo).
--
-- `profiles` es 1:1 con `auth.users`: el id del perfil ES el id del usuario
-- autenticado. Así `Profile.id`, `Message.senderId` y `Match.profileIds`
-- son todos `auth.uid()` y no hace falta una tabla de traducción.
--
-- Mapeo con `Profile` de `src/data/types.ts`: ver `supabase/README.md`.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,

  -- Identidad
  name text not null check (btrim(name) <> '' and char_length(name) <= 80),
  age integer not null check (age between 16 and 120),
  location text not null check (btrim(location) <> '' and char_length(location) <= 120),
  -- Identificador IANA, p. ej. `Europe/Madrid`. Se valida en la app: la lista
  -- de zonas cambia con cada release de tzdata y no queremos un CHECK que
  -- se quede obsoleto y bloquee altas de perfil.
  timezone text not null check (btrim(timezone) <> '' and char_length(timezone) <= 64),

  -- Avatar: iniciales + acento. Sin `image_url` a propósito — el MVP no sube
  -- imágenes (ver CONCEPTO.md). Añadirlo requiere coordinarlo con `arquitecto`.
  -- "1-2 letras, ya en mayúsculas". Se comprueba con `upper()` y no con una
  -- clase de caracteres latinos: un nombre en cirílico o en chino también
  -- tiene que poder crear perfil.
  avatar_initials text not null
    check (
      char_length(avatar_initials) between 1 and 2
      and avatar_initials = upper(avatar_initials)
    ),
  avatar_accent public.avatar_accent not null default 'brass',

  -- Qué aporta y qué busca
  specialties public.specialty[] not null
    check (
      cardinality(specialties) between 1 and 10
      and not public.array_has_duplicates(specialties)
    ),
  looking_for public.mode_preference not null,
  starting_point public.starting_point not null,

  -- Availability, aplanado en dos columnas
  availability_hours_per_week integer not null check (availability_hours_per_week between 1 and 168),
  availability_bands public.time_band[] not null
    check (
      cardinality(availability_bands) between 1 and 4
      and not public.array_has_duplicates(availability_bands)
    ),

  ambition public.ambition not null,

  -- ProfileLinks, aplanado. Todos opcionales.
  link_github text check (link_github is null or link_github ~* '^https?://'),
  link_portfolio text check (link_portfolio is null or link_portfolio ~* '^https?://'),
  link_linkedin text check (link_linkedin is null or link_linkedin ~* '^https?://'),

  -- ProfilePrompt[]. jsonb y no tabla aparte: son 0-2 elementos, siempre se
  -- leen enteros con el perfil, y el orden importa.
  prompts jsonb not null default '[]'::jsonb
    check (public.is_valid_prompts(prompts) and jsonb_array_length(prompts) <= 2),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Ficha de persona. 1:1 con auth.users. Espejo de `Profile` en src/data/types.ts.';
comment on column public.profiles.prompts is
  'Array jsonb de {question, answer}. Máximo 2 — la UI pide 1-2 (ver CONCEPTO.md).';

-- El deck filtra por modo y por especialidades; GIN cubre el operador `&&`.
create index profiles_specialties_idx on public.profiles using gin (specialties);
create index profiles_looking_for_idx on public.profiles (looking_for);
create index profiles_created_at_idx on public.profiles (created_at desc);

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row
  execute function public.touch_updated_at();


-- ---------------------------------------------------------------------------
-- user_settings — la parte de `Session` que no se deduce del perfil.
-- ---------------------------------------------------------------------------
--
-- `Session.activeMode` se elige en la PRIMERA pantalla del onboarding, antes de
-- que exista el perfil. Por eso no puede vivir como columna de `profiles`:
-- necesita una fila que exista sin perfil. `Session.profileId` sí se deduce
-- (es `auth.uid()` si hay fila en `profiles`, y `null` si no).

create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  /** `null` mientras el usuario no ha elegido modo. */
  active_mode public.mode_preference,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_settings is
  'Modo activo de navegación. Existe antes que el perfil: el onboarding elige modo primero.';

create trigger user_settings_touch_updated_at
  before update on public.user_settings
  for each row
  execute function public.touch_updated_at();
