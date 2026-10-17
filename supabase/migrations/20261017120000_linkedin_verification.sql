-- cofounder — sello de LinkedIn verificado (2026-10-17).
--
-- El mismo diseño que el de GitHub (`20260916000100_github_verification.sql`),
-- y por las mismas razones: el sello NO lo puede escribir el cliente.
--
--   * Las dos columnas nuevas no se conceden a `authenticated`: desde aquella
--     migración, `profiles` tiene el INSERT/UPDATE concedido columna a columna,
--     y lo que no se concede queda cerrado. Que no se concedan aquí ES el
--     permiso: no hay ningún `grant` que añadir.
--   * Solo las escribe una función SECURITY DEFINER SIN PARÁMETROS, que lee la
--     verdad de `auth.identities` (la escribe GoTrue al terminar el OAuth de
--     LinkedIn, proveedor `linkedin_oidc`) en vez de recibirla.
--
-- LinkedIn con OpenID Connect no entrega la URL pública del perfil, solo nombre,
-- foto y email. Por eso el sello guarda el nombre de la cuenta de LinkedIn y no
-- toca `link_linkedin`, que sigue siendo un campo libre del formulario.
--
-- Si alguna vez le añades un parámetro a la función, has reabierto el agujero.


alter table public.profiles
  add column linkedin_name text,
  add column linkedin_verified_at timestamptz;

-- Las dos van juntas o ninguna: un sello a medias no debe poder existir.
alter table public.profiles
  add constraint profiles_linkedin_verification_complete
  check (num_nonnulls(linkedin_name, linkedin_verified_at) <> 1);


-- ---------------------------------------------------------------------------
-- El único camino de escritura del sello
-- ---------------------------------------------------------------------------
--
-- Enciende y apaga por el mismo sitio: si la identidad de LinkedIn ya no está
-- —el usuario la desvinculó—, el sello se cae.

create or replace function public.sync_linkedin_verification()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_name text;
begin
  select nullif(btrim(coalesce(
           i.identity_data ->> 'name',
           concat_ws(' ', i.identity_data ->> 'given_name', i.identity_data ->> 'family_name')
         )), '')
    into v_name
    from auth.identities i
   where i.user_id = (select auth.uid())
     and i.provider = 'linkedin_oidc'
   limit 1;

  if v_name is null then
    update public.profiles
       set linkedin_name = null,
           linkedin_verified_at = null
     where id = (select auth.uid());
  else
    -- `coalesce`: resincronizar no rejuvenece un sello que ya existía.
    update public.profiles
       set linkedin_name = v_name,
           linkedin_verified_at = coalesce(linkedin_verified_at, now())
     where id = (select auth.uid());
  end if;
end;
$fn$;


-- ---------------------------------------------------------------------------
-- Permisos de ejecución
-- ---------------------------------------------------------------------------

revoke execute on function public.sync_linkedin_verification() from public, anon;

grant execute on function public.sync_linkedin_verification() to authenticated;


-- ---------------------------------------------------------------------------
-- Enlaces a Instagram y TikTok (2026-10-17)
-- ---------------------------------------------------------------------------
--
-- Campos libres del formulario, como `link_portfolio` y `link_linkedin`: los
-- escribe el usuario. Desde `20260916000100` una columna nueva de `profiles`
-- nace SIN permiso de escritura para `authenticated`; estas sí lo necesitan, y
-- se conceden aquí columna a columna (`schema-embedded.test.mjs` se pone rojo
-- si alguna columna que no sea un sello o la foto queda cerrada).

alter table public.profiles
  add column link_instagram text,
  add column link_tiktok text;

grant insert (link_instagram, link_tiktok) on public.profiles to authenticated;
grant update (link_instagram, link_tiktok) on public.profiles to authenticated;
