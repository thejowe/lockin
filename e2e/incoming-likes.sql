-- Solo se instala en el Postgres desechable de e2e/.runtime.
-- Simula al otro usuario: no crea perfil, match ni mensaje bajo prueba.

-- Orden del deck determinista.
--
-- El recorrido afirma quién está DELANTE —la fila "Busca" y el ✓ de
-- complementariedad son datos de ESA persona—, así que la tarjeta de delante no
-- puede depender de nada que no esté fijado aquí.
--
-- Hasta el 2026-09-07 se fijaba separando los `created_at`, porque
-- `discovery_deck` ordenaba por `created_at desc`. La migración
-- `20260907000200_discovery_mutual_complement` cambió ese criterio: ahora ordena
-- por complementariedad mutua y desempata por `id asc`; `created_at` ya no
-- interviene. Aquella línea dejó de fijar nada y el deck se reordenó sin que
-- nadie lo notara, hasta que el oráculo lo cazó — run 34276300168: el like cayó
-- sobre ...0002 (Marc Oller, puntuación 2) en vez de sobre ...0001.
--
-- Se fija por el criterio que de verdad decide. El perfil del recorrido domina
-- dev y marketing y busca diseño, así que la puntuación de una tarjeta es
--   (mis especialidades ∩ lo que ella busca) + (sus especialidades ∩ lo que yo busco)
-- con máximo 2. A Núria le faltaba el segundo sumando: busca marketing (1) pero
-- domina dev y datos, que no es lo que busco. Con `diseno` añadido llega a 2, el
-- máximo posible, y su id es el más bajo del seed, así que gana también
-- cualquier empate. Su fila "Busca" no se toca: el ✓ que afirma el recorrido
-- sale de ahí.
update public.profiles
set specialties = array['dev', 'datos', 'diseno']::public.specialty[]
where id = '11111111-1111-4111-8111-000000000001';

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