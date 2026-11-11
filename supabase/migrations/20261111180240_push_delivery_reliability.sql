-- La comprobación de v4 encontró timeouts de pg_net (5 s) en los avisos
-- programados. No modificar la migración aplicada ni los secretos existentes.
-- pg_timezone_names cuesta ~75 ms por llamada: validar las zonas IANA de uso
-- normal con timezone() evita recorrer el catálogo varias veces por persona.
create or replace function public.push_local_time(p_user uuid,p_at timestamptz default now())
returns timestamp language plpgsql stable security definer set search_path = '' as $fn$
declare v_zone text;
begin
  select nullif(p.timezone,'') into v_zone from public.profiles p where p.id=p_user;
  v_zone:=coalesce(v_zone,'Europe/Madrid');
  -- Conserva los alias IANA de una palabra. No aceptar offsets/expresiones POSIX
  -- arbitrarios que timezone() admite pero no constan como zona declarada.
  if position('/' in v_zone)=0 and v_zone not in ('UTC','GMT') then
    if not exists(select 1 from pg_catalog.pg_timezone_names where name=v_zone) then
      v_zone:='Europe/Madrid';
    end if;
  end if;
  return pg_catalog.timezone(v_zone,p_at);
exception when invalid_parameter_value then
  return pg_catalog.timezone('Europe/Madrid',p_at);
end;
$fn$;

create or replace function public.enqueue_push(p_body jsonb)
returns void language plpgsql security definer set search_path = '' as $fn$
declare v_url text; v_secret text;
begin
  if to_regclass('vault.decrypted_secrets') is null or not exists(select 1 from pg_catalog.pg_namespace where nspname='net') then return; end if;
  execute $q$select decrypted_secret from vault.decrypted_secrets where name='push_webhook_url'$q$ into v_url;
  execute $q$select decrypted_secret from vault.decrypted_secrets where name='push_webhook_secret'$q$ into v_secret;
  if v_url is null or v_secret is null then return; end if;
  -- Expo dispone de hasta 10 s por lote: el webhook necesita margen adicional.
  execute $q$select net.http_post(url:=$1,body:=$2,headers:=jsonb_build_object('Content-Type','application/json','x-push-secret',$3),timeout_milliseconds:=30000)$q$
    using v_url,p_body,v_secret;
exception when others then raise warning 'enqueue_push: %',sqlerrm;
end;
$fn$;

revoke execute on function public.push_local_time(uuid,timestamptz),public.enqueue_push(jsonb) from public,anon,authenticated;
grant execute on function public.push_local_time(uuid,timestamptz),public.enqueue_push(jsonb) to service_role;
