-- Solo se instala en el Postgres desechable de e2e/.runtime.
-- Simula a la otra persona: cuando el recorrido envía su mensaje, deja en ese
-- match una sesión ya ACEPTADA que empieza 3 minutos después. La ventana de
-- entrada abre 5 minutos antes, así que al llegar `session.yaml` ya se puede
-- entrar: con el reinicio y el oráculo de por medio, la pantalla puede verla
-- todavía en cuenta atrás o ya en el primer bloque, y el recorrido acepta las dos.
--
-- Inserta directamente y no por `propose_session`: la regla de 5 minutos de
-- margen no deja proponer algo que empieza en 3, y lo que se prueba aquí es
-- entrar y salir desde la app, no proponer.

create function public.e2e_session_now() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_other uuid;
begin
  if new.body like 'Mensaje E2E %' then
    select case when m.profile_a = new.sender_id then m.profile_b else m.profile_a end
      into v_other
    from public.matches m
    where m.id = new.match_id;

    insert into public.lockin_sessions (match_id, proposed_by, starts_at, blocks, status, responded_at)
    values (new.match_id, v_other, now() + interval '3 minutes', 1, 'aceptada', now());
  end if;
  return new;
end;
$$;
revoke all on function public.e2e_session_now() from public;
create trigger e2e_session_now after insert on public.messages
for each row execute function public.e2e_session_now();
