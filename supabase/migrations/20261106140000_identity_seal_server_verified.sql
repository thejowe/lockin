-- LockIn — el sello de GitHub/LinkedIn lo pone el servidor tras comprobar el
-- token del proveedor; el cliente ya solo puede apagarlo.
--
-- El hueco (auditoría de seguridad run-1, 2026-11-06, lead
-- `sync_github_verification:linkIdentity-completion-not-bound-to-initiator`):
--
-- `sync_github_verification()` / `sync_linkedin_verification()` encendían el
-- sello con CUALQUIER identidad de ese proveedor que hubiera en
-- `auth.identities` para `auth.uid()`. GoTrue escribe esa identidad en su propio
-- callback, antes de devolver el code, y sin ligarla al navegador que empezó el
-- vínculo. Así que alguien podía pedir `linkIdentity` con su cuenta, mandar la
-- URL de GitHub a otra persona y, si esta la autorizaba, la identidad de la
-- víctima quedaba en la cuenta del atacante: un `rpc('sync_github_verification')`
-- y el perfil del atacante salía «Verificado en GitHub» con el usuario de la
-- víctima.
--
-- Lo que cambia:
--
-- - El sello solo se enciende con `seal_identity_verification(user, provider,
--   provider_id)`, que es de `service_role`. La llama la Edge Function
--   `verify-identity` después de preguntar a la API de GitHub/LinkedIn con el
--   `provider_token` que GoTrue devuelve AL CANJEAR el code. Ese canje solo lo
--   puede hacer quien tiene el verificador PKCE y recibe el code: en el ataque,
--   el code acaba en el navegador de la víctima y el atacante nunca tiene token.
--   Y la función exige que la identidad guardada tenga el MISMO `provider_id`
--   que el token: el token de una cuenta de GitHub no sella otra.
-- - `sync_github_verification()` / `sync_linkedin_verification()` siguen siendo
--   de `authenticated`, sin argumentos, pero ya solo APAGAN: sin identidad de
--   ese proveedor el sello cae (desvincular); con identidad no hacen nada.

-- ---------------------------------------------------------------------------
-- El cliente: solo apagar
-- ---------------------------------------------------------------------------

create or replace function public.sync_github_verification()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
begin
  if not exists (
    select 1
      from auth.identities i
     where i.user_id = (select auth.uid())
       and i.provider = 'github'
  ) then
    update public.profiles
       set github_handle = null,
           github_verified_at = null,
           link_github = null
     where id = (select auth.uid())
       and github_handle is not null;
  end if;
end;
$fn$;

create or replace function public.sync_linkedin_verification()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
begin
  if not exists (
    select 1
      from auth.identities i
     where i.user_id = (select auth.uid())
       and i.provider = 'linkedin_oidc'
  ) then
    update public.profiles
       set linkedin_name = null,
           linkedin_verified_at = null
     where id = (select auth.uid());
  end if;
end;
$fn$;

-- `create or replace` conserva los grants (authenticated sí, anon/PUBLIC no).


-- ---------------------------------------------------------------------------
-- El servidor: encender, con la identidad comprobada
-- ---------------------------------------------------------------------------
--
-- Devuelve `false` si el usuario no tiene una identidad de ese proveedor con
-- ese `provider_id` (el token era de otra cuenta, o la identidad ya no está):
-- entonces no toca nada.

create or replace function public.seal_identity_verification(
  p_user uuid,
  p_provider text,
  p_provider_id text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_data jsonb;
  v_handle text;
  v_name text;
begin
  if p_user is null or p_provider_id is null or p_provider_id = '' then
    return false;
  end if;

  select i.identity_data
    into v_data
    from auth.identities i
   where i.user_id = p_user
     and i.provider = p_provider
     and i.provider_id = p_provider_id;

  if v_data is null then
    return false;
  end if;

  if p_provider = 'github' then
    v_handle := nullif(v_data ->> 'user_name', '');
    if v_handle is null then
      return false;
    end if;
    -- `coalesce`: resellar no rejuvenece un sello que ya existía.
    update public.profiles
       set github_handle = v_handle,
           github_verified_at = coalesce(github_verified_at, now()),
           link_github = 'https://github.com/' || v_handle
     where id = p_user;
    return found;
  elsif p_provider = 'linkedin_oidc' then
    v_name := nullif(btrim(coalesce(
                v_data ->> 'name',
                concat_ws(' ', v_data ->> 'given_name', v_data ->> 'family_name')
              )), '');
    if v_name is null then
      return false;
    end if;
    update public.profiles
       set linkedin_name = v_name,
           linkedin_verified_at = coalesce(linkedin_verified_at, now())
     where id = p_user;
    return found;
  end if;

  return false;
end;
$fn$;

revoke execute on function public.seal_identity_verification(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.seal_identity_verification(uuid, text, text) to service_role;
