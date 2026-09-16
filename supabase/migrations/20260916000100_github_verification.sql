-- LockIn — verificación de autoría de GitHub (Fase 3).
--
-- Diseño: docs/superpowers/specs/2026-09-16-verificacion-github-design.md.
--
-- El punto entero de este archivo es que el sello NO lo pueda escribir el
-- cliente. La política "profiles: solo editas el tuyo" de
-- `20260905000400_rls_policies.sql` es de FILA: deja a cada usuario escribir
-- cualquier columna de la suya. Si el sello fuera una columna normal, un
-- `update profiles set github_verified_at = now()` con la clave anon —que viaja
-- en el bundle, y así debe ser— lo encendería sin pasar por GitHub.
--
-- Por eso hacen falta las dos piezas de abajo, y ninguna sobra:
--   * el permiso DE COLUMNA, que RLS no sabe expresar.
--   * una función SECURITY DEFINER SIN PARÁMETROS, propiedad de postgres, que
--     no acepta el resultado del cliente sino que lo lee de auth.identities.
--
-- Si alguna vez le añades un parámetro a esa función, has reabierto el agujero.


alter table public.profiles
  add column github_handle text,
  add column github_verified_at timestamptz;

-- Las dos van juntas o ninguna: un sello a medias no debe poder existir.
alter table public.profiles
  add constraint profiles_github_verification_complete
  check (num_nonnulls(github_handle, github_verified_at) <> 1);

-- Con sello, el enlace ES el de la identidad. Hace la discrepancia
-- irrepresentable en vez de vigilarla: sin esto, quien está verificado podría
-- quedarse el sello y apuntar `link_github` a la cuenta de otro, que es el
-- ataque original entrando por la ventana.
alter table public.profiles
  add constraint profiles_github_link_matches_handle
  check (
    github_handle is null
    or link_github = 'https://github.com/' || github_handle
  );


-- ---------------------------------------------------------------------------
-- El permiso de columna
-- ---------------------------------------------------------------------------
--
-- OJO, y esto es lo único no obvio del archivo: **`revoke update (col) … from
-- authenticated` NO sirve por sí solo aquí**. Es lo primero que uno escribe, y
-- es un no-op silencioso. PostgreSQL lo dice en la referencia de REVOKE:
--
--   > if a role has been granted privileges on a table, then revoking the same
--   > privileges from individual columns will have no effect.
--
-- Y `authenticated` SÍ tiene el UPDATE de tabla sobre `public.profiles`: se lo
-- dan los `alter default privileges … grant all on tables` que Supabase deja
-- puestos en el esquema `public` de todo proyecto. Está capturado en la huella
-- real del despliegue (`supabase/evidence/…/expected.txt`, línea
-- `grant    profiles authenticated UPDATE`). Con el privilegio de tabla en la
-- mano, el revoke de columna no cambia ni `relacl` ni `attacl`: el sello
-- seguiría encendiéndose con un PATCH desde el bundle, y la migración parecería
-- protegerlo.
--
-- Lo que sí funciona —y es la forma canónica de la seguridad por columna en
-- PostgreSQL— es quitar el privilegio ANCHO y devolverlo columna a columna:
-- lo que no se vuelve a conceder es lo que queda cerrado.
--
-- Las dos únicas columnas que NO se vuelven a conceder son `github_handle` y
-- `github_verified_at`. En particular `link_github` SÍ se concede: sin sello
-- sigue siendo un campo del formulario y el usuario debe poder escribirlo.
-- Quien lo sujeta cuando sí hay sello es la constraint de arriba, no el
-- permiso.
--
-- INSERT va con UPDATE y no es de adorno: el perfil se crea y se edita con un
-- `.upsert()` desde el cliente (`src/data/supabase/index.ts`), o sea un
-- `insert … on conflict do update`. Dejar el INSERT abierto sería el mismo
-- agujero por la otra puerta: en el alta del perfil se mandaría el sello ya
-- encendido, con su `link_github` a juego para contentar a las constraints.
--
-- SELECT y DELETE se quedan como estaban: el sello se lee (es lo que pinta la
-- insignia) y borrar el perfil es cosa de RLS, no de columnas.
--
-- PEAJE, y hay que saberlo: a partir de aquí una columna nueva de `profiles`
-- nace SIN permiso de escritura para `authenticated`. La migración que la añada
-- tiene que concederla aquí también. No se queda en el aire: la cobertura de
-- `supabase/schema-embedded.test.mjs` recorre las columnas reales de la tabla y
-- se pone roja si alguna que no sea el sello deja de ser escribible.

revoke insert, update on public.profiles from authenticated;

grant insert (
  id,
  name,
  age,
  location,
  timezone,
  avatar_initials,
  avatar_accent,
  specialties,
  seeking_specialties,
  looking_for,
  starting_point,
  availability_hours_per_week,
  availability_bands,
  ambition,
  link_github,
  link_portfolio,
  link_linkedin,
  prompts,
  created_at,
  updated_at
) on public.profiles to authenticated;

grant update (
  id,
  name,
  age,
  location,
  timezone,
  avatar_initials,
  avatar_accent,
  specialties,
  seeking_specialties,
  looking_for,
  starting_point,
  availability_hours_per_week,
  availability_bands,
  ambition,
  link_github,
  link_portfolio,
  link_linkedin,
  prompts,
  created_at,
  updated_at
) on public.profiles to authenticated;


-- ---------------------------------------------------------------------------
-- El único camino de escritura del sello
-- ---------------------------------------------------------------------------
--
-- SIN PARÁMETROS, y eso no es estilo. Es lo que hace que no haya nada que
-- falsificar: la verdad la LEE de `auth.identities` —que la escribe GoTrue al
-- terminar el OAuth y el cliente no toca—, no la recibe. Un `p_handle text`
-- por comodidad reabriría exactamente el agujero que este archivo cierra.
--
-- SECURITY DEFINER y propiedad de postgres, como `match_streaks`: por eso
-- puede escribir las dos columnas que acaban de quedar cerradas, y por eso
-- `search_path = ''` con todos los nombres cualificados.
--
-- Enciende y apaga por el mismo sitio: si la identidad de GitHub ya no está
-- —el usuario la desvinculó—, el sello se cae y el enlace derivado con él.

create or replace function public.sync_github_verification()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_handle text;
begin
  select i.identity_data ->> 'user_name'
    into v_handle
    from auth.identities i
   where i.user_id = (select auth.uid())
     and i.provider = 'github'
   limit 1;

  if v_handle is null or v_handle = '' then
    update public.profiles
       set github_handle = null,
           github_verified_at = null,
           link_github = null
     where id = (select auth.uid());
  else
    -- `coalesce`: resincronizar no rejuvenece un sello que ya existía.
    update public.profiles
       set github_handle = v_handle,
           github_verified_at = coalesce(github_verified_at, now()),
           link_github = 'https://github.com/' || v_handle
     where id = (select auth.uid());
  end if;
end;
$fn$;


-- ---------------------------------------------------------------------------
-- Permisos de ejecución
-- ---------------------------------------------------------------------------

revoke execute on function public.sync_github_verification() from public, anon;

grant execute on function public.sync_github_verification() to authenticated;
