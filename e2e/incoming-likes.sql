-- Solo se instala en el Postgres desechable de e2e/.runtime.
-- Simula al otro usuario: no crea perfil, match ni mensaje bajo prueba.

-- Orden del deck determinista.
--
-- `discovery_deck` ordena por `created_at desc` y `supabase/seed.sql` inserta
-- los ocho perfiles en la misma transacción: los ocho `created_at` son iguales
-- y el desempate lo elige el planificador. El recorrido afirma qué tarjeta está
-- arriba —la fila "Busca" y el ✓ de complementariedad son datos de ESA
-- persona—, así que aquí se separan las fechas y el deck queda en el orden del
-- catálogo, con Núria Bosch primero: el mismo que da `src/data/mock/seed.ts` en
-- el control negativo, para que las dos variantes vean la misma tarjeta.
update public.profiles
set created_at = created_at - (right(id::text, 2)::integer * interval '1 minute')
where id::text like '11111111-1111-4111-8111-%';

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