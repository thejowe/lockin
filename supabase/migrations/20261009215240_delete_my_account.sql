-- Borrar mi cuenta (requisito de Apple 5.1.1(v) y de Google Play).
--
-- Un único RPC sin parámetros: `delete_my_account()` borra la fila de
-- `auth.users` de quien llama, y el resto cae en cascada. Todas las claves
-- ajenas del esquema cuelgan, directa o indirectamente, de `auth.users (id)` con
-- `on delete cascade`: profiles → decisions, matches → messages, lockin_sessions
-- → session_attendance / session_ratings, agreement_answers, lockin_rooms →
-- room_members, y user_settings. Las identidades, sesiones y refresh tokens de
-- GoTrue cuelgan también de `auth.users`.
--
-- No recibe un id: borra `auth.uid()` y nada más, así que nadie puede borrar a
-- otra persona. Es irreversible; la confirmación es cosa de la pantalla.
--
-- `LI007` (nuevo): no hay sesión. Es el único error propio de la función.
--
-- `search_path` vacío y nombres cualificados, `revoke`/`grant` al final, como
-- `answer_agreement_topic()`.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'delete_my_account: no hay sesión' using errcode = 'LI007';
  end if;

  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
