-- Aceptación de Términos y Normas, con versión y fecha.
--
-- Una fila por (persona, versión): aceptar una versión nueva añade fila, no
-- sustituye, así queda constancia de cada aceptación. La versión es la fecha
-- (`AAAA-MM-DD`) del documento vigente; la constante del cliente es
-- `TERMS_VERSION` en `src/constants/legal.ts`.
--
-- Referencia `auth.users` y no `profiles` a propósito: se acepta ANTES de
-- publicar el perfil, así que la fila no puede depender de que exista.
-- Escritura solo por `accept_terms()`; lectura solo de las propias filas.

create table public.terms_acceptances (
  user_id uuid not null references auth.users (id) on delete cascade,
  version text not null check (version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  accepted_at timestamptz not null default now(),
  primary key (user_id, version)
);

alter table public.terms_acceptances enable row level security;

revoke all on table public.terms_acceptances from public, anon, authenticated;
grant select on table public.terms_acceptances to authenticated;

create policy "terms_acceptances: solo lees las tuyas"
  on public.terms_acceptances for select to authenticated
  using (user_id = (select auth.uid()));

-- Idempotente: aceptar dos veces la misma versión conserva la fecha original.
-- Devuelve la fecha de la aceptación.
create function public.accept_terms(p_version text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_at timestamptz;
begin
  if v_actor is null then
    raise exception 'No hay sesión autenticada.' using errcode = '28000';
  end if;
  if p_version is null or p_version !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'Versión de términos inválida.' using errcode = '23514';
  end if;

  insert into public.terms_acceptances (user_id, version)
  values (v_actor, p_version)
  on conflict (user_id, version) do nothing;

  select accepted_at into v_at
  from public.terms_acceptances
  where user_id = v_actor and version = p_version;

  return v_at;
end;
$fn$;

revoke execute on function public.accept_terms(text) from public, anon;
grant execute on function public.accept_terms(text) to authenticated;
