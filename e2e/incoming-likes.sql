-- Solo se instala en el Postgres desechable de e2e/.runtime.
-- Simula al otro usuario: no crea perfil, match ni mensaje bajo prueba.
create function public.e2e_incoming_likes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.name like 'E2E-%' then
    insert into public.decisions (actor_id, target_id, decision)
    select id, new.id, 'like'::public.decision
    from public.profiles
    where id::text like '11111111-1111-4111-8111-%'
    on conflict (actor_id, target_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.e2e_incoming_likes() from public;
create trigger e2e_incoming_likes after insert on public.profiles
for each row execute function public.e2e_incoming_likes();