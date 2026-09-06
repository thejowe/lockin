-- LockIn — tipos enumerados y helpers inmutables.
--
-- Cada enum refleja literalmente una unión de tipos de `src/data/types.ts`.
-- Si cambia un tipo allí, hace falta una migración `alter type ... add value`
-- aquí — avisa al bloque `arquitecto` antes de tocar cualquiera de los dos.
--
-- Nota deliberada: NO existe el valor 'talento'. El Modo Talento es Fase 4
-- (ver `docs/plan/CONCEPTO.md`) y no debe poder representarse en la base.

-- Mode
create type public.mode as enum ('par', 'lockin');

-- ModePreference
create type public.mode_preference as enum ('par', 'lockin', 'ambos');

-- Specialty
create type public.specialty as enum (
  'diseno',
  'dev',
  'marketing',
  'ventas',
  'datos',
  'legal',
  'producto',
  'finanzas',
  'operaciones',
  'contenido'
);

-- StartingPoint
create type public.starting_point as enum (
  'solo-ganas',
  'idea-sin-empezar',
  'algo-empezado'
);

-- Ambition
create type public.ambition as enum ('lifestyle', 'equilibrado', 'todo-o-nada');

-- TimeBand
create type public.time_band as enum ('madrugada', 'manana', 'tarde', 'noche');

-- Avatar['accent'] — el MVP no sube imágenes, solo iniciales sobre un acento.
create type public.avatar_accent as enum ('brass', 'teal');

-- Decision
create type public.decision as enum ('like', 'pass');


-- ---------------------------------------------------------------------------
-- Helpers inmutables (usables dentro de CHECK constraints)
-- ---------------------------------------------------------------------------

/**
 * ¿Tiene el array valores repetidos? Se usa para que un perfil no declare
 * dos veces la misma especialidad o la misma franja horaria.
 */
create or replace function public.array_has_duplicates(arr anyarray)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select cardinality(arr) <> (select count(distinct v) from unnest(arr) as v);
$$;

/**
 * Valida el jsonb de `prompts` contra `ProfilePrompt[]` de `types.ts`:
 * array de objetos con `question` y `answer` de texto, ambos no vacíos.
 * El límite de cantidad se comprueba aparte, en el CHECK de la tabla.
 */
create or replace function public.is_valid_prompts(prompts jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    jsonb_typeof(prompts) = 'array'
    and not exists (
      select 1
      from jsonb_array_elements(prompts) as element
      where jsonb_typeof(element) <> 'object'
         or jsonb_typeof(element -> 'question') <> 'string'
         or jsonb_typeof(element -> 'answer') <> 'string'
         or btrim(element ->> 'question') = ''
         or btrim(element ->> 'answer') = ''
    );
$$;

/** Mantiene `updated_at` sin que el cliente tenga que enviarlo. */
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
