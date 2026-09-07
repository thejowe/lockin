-- LockIn — `profiles.seeking_specialties`.
--
-- Espejo de `Profile.seekingSpecialties`, añadido al contrato por `arquitecto`
-- el 2026-09-07 (ver `docs/plan/todo/arquitecto.md` → "Especialidades
-- buscadas"). `specialties` es lo que la persona **domina**; esto es lo que
-- quiere que domine la otra. Simétrico: las dos personas de un match lo
-- declaran y ninguna «ofrece» nada a la otra.
--
-- Va en migración nueva y no editando `20260905000200_profiles_and_settings.sql`
-- porque esa ya está aplicada contra `grrzmzktrhksbttpbblg` (a mano, por el SQL
-- Editor: no hay CLI enlazado, ver `docs/plan/todo/datos.md`). Reescribir una
-- migración aplicada deja el repo diciendo una cosa y el despliegue otra, que
-- es justo la deriva que `supabase/drift-check.mjs` existe para cazar.

alter table public.profiles
  add column seeking_specialties public.specialty[] not null
    default array[]::public.specialty[]
    check (
      cardinality(seeking_specialties) <= 10
      and not public.array_has_duplicates(seeking_specialties)
    );

-- Diferencias deliberadas con el CHECK de `specialties`, que pide `between 1
-- and 10`:
--
-- - **El vacío es válido.** En el dominio significa «abierto a cualquiera», y
--   es además el ÚNICO valor legal cuando `looking_for` es `'lockin'`: un
--   compañero de enfoque se elige por franja horaria y compromiso, no por
--   skills complementarias.
-- - **La invariante de lockin NO se fuerza aquí.** Un `check (looking_for <>
--   'lockin' or cardinality(seeking_specialties) = 0)` es tentador y es
--   exactamente lo que `arquitecto` decidió no hacer: la regla la mantiene
--   quien escribe el perfil (formulario o seed), no el almacenamiento. Meterla
--   en la base la duplicaría en un sitio donde el mock no puede seguirla, y los
--   dos backends tienen que cumplir el mismo contrato — hoy el mock guarda
--   `seekingSpecialties` tal cual, sin vaciarlo por su cuenta. Si algún día la
--   regla se endurece, se endurece en los dos a la vez y con un caso de
--   contrato que lo pida.
-- - **Tiene `default`.** Hace la columna retrocompatible sin backfill: las filas
--   que ya existen (los ocho de `seed.sql`, más cualquier perfil creado desde
--   la app) quedan con `{}`, que es un valor con significado y no un hueco. Y
--   deja escribir un perfil sin nombrar la columna, igual que `ProfileInput`
--   deja no enviar el campo.

comment on column public.profiles.seeking_specialties is
  'Lo que este perfil busca que domine la otra persona (Profile.seekingSpecialties). '
  'Vacío = «abierto a cualquiera», y siempre vacío si looking_for = ''lockin''. '
  'NO es un rol vacante: nada de sueldo, equity ni seniority — eso sería Modo Talento (Fase 4).';

-- Sin índice GIN, a propósito.
--
-- `specialties` lo tiene porque el deck filtra por él: `discovery_deck` hace
-- `p.specialties && p_specialties` y `ProfileFilter.specialties` se traduce a un
-- `overlaps('specialties', …)` en `src/data/supabase/index.ts`. Sobre
-- `seeking_specialties` no hay hoy ninguna consulta — `arquitecto` dejó escrito
-- en `types.ts` que un filtro sobre lo buscado sería un campo distinto de
-- `ProfileFilter` y hay que hablarlo con `descubrir` antes de añadirlo.
--
-- Un GIN que nadie consulta solo cuesta: cada insert y cada update de perfil lo
-- mantienen. Cuando `descubrir` añada el filtro, esto es lo que hace falta, en
-- su propia migración y junto al cambio de `discovery_deck`:
--
--     create index profiles_seeking_specialties_idx
--       on public.profiles using gin (seeking_specialties);
