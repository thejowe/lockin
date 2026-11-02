-- LockIn — idiomas del perfil, más especialidades y «otra» especialidad escrita.
--
-- Petición del usuario (2026-11-02) para el formulario de alta:
--
-- 1. Qué idiomas habla la persona (`languages`) y qué idiomas debe hablar la
--    gente que busca (`seeking_languages`). Espejo de `Profile.languages` y
--    `Profile.seekingLanguages` en `src/data/types.ts`.
-- 2. Más ámbitos en `specialty`: diez valores nuevos.
-- 3. En «lo que domino» se puede escribir uno que no esté en la lista
--    (`other_specialty`). Solo ahí: lo que se busca sigue siendo de la lista,
--    porque el deck lo cruza con `specialties` y un texto libre no cruza con nada.
--
-- Va separada de la redefinición de `discovery_deck`/`incoming_likes`
-- (20261102120100): `alter type ... add value` no deja usar el valor nuevo en la
-- misma transacción, y así ninguna de las dos lo intenta.

-- ---------------------------------------------------------------------------
-- Especialidades nuevas
-- ---------------------------------------------------------------------------

alter type public.specialty add value if not exists 'ia';
alter type public.specialty add value if not exists 'hardware';
alter type public.specialty add value if not exists 'growth';
alter type public.specialty add value if not exists 'comunidad';
alter type public.specialty add value if not exists 'personas';
alter type public.specialty add value if not exists 'investigacion';
alter type public.specialty add value if not exists 'audiovisual';
alter type public.specialty add value if not exists 'seguridad';
alter type public.specialty add value if not exists 'ecommerce';
alter type public.specialty add value if not exists 'inversion';

-- ---------------------------------------------------------------------------
-- Idiomas
-- ---------------------------------------------------------------------------

-- Códigos ISO 639-1. Espejo de `Language` en `src/data/types.ts`.
create type public.language as enum (
  'es', 'en', 'ca', 'eu', 'gl', 'pt', 'fr', 'de', 'it', 'nl', 'ro', 'ar', 'zh', 'ru'
);

-- Las dos con `default` vacío: las filas que ya existen no se inventan un idioma.
-- La app pide al menos uno hablado al guardar; la base no, por esas filas.
alter table public.profiles
  add column languages public.language[] not null
    default array[]::public.language[]
    check (
      cardinality(languages) <= 14
      and not public.array_has_duplicates(languages)
    ),
  add column seeking_languages public.language[] not null
    default array[]::public.language[]
    check (
      cardinality(seeking_languages) <= 14
      and not public.array_has_duplicates(seeking_languages)
    ),
  add column other_specialty text
    check (
      other_specialty is null
      or (other_specialty = btrim(other_specialty) and char_length(other_specialty) between 2 and 40)
    );

comment on column public.profiles.languages is
  'Idiomas que habla este perfil (Profile.languages), códigos ISO 639-1.';
comment on column public.profiles.seeking_languages is
  'Idiomas que debe hablar la otra persona (Profile.seekingLanguages). Vacío = «me da igual».';
comment on column public.profiles.other_specialty is
  'Especialidad escrita a mano, fuera de la lista (Profile.otherSpecialty). Solo lo que domina.';

-- ---------------------------------------------------------------------------
-- `specialties` puede ir vacío si hay una escrita a mano
-- ---------------------------------------------------------------------------

-- El check original (20260905000200) pedía `between 1 and 10`. Quien solo
-- domina algo que no está en la lista tiene que poder guardarse.
alter table public.profiles drop constraint profiles_specialties_check;
alter table public.profiles add constraint profiles_specialties_check check (
  cardinality(specialties) <= 10
  and not public.array_has_duplicates(specialties)
  and (cardinality(specialties) >= 1 or other_specialty is not null)
);

-- Las columnas que escribe el formulario se conceden una a una (ver
-- 20260916000100 y 20261017120000).
grant insert (languages, seeking_languages, other_specialty) on public.profiles to authenticated;
grant update (languages, seeking_languages, other_specialty) on public.profiles to authenticated;
