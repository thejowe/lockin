-- LockIn — Row Level Security.
--
-- Regla base: cada usuario ve solo sus propios matches y mensajes, y solo
-- puede escribir en su nombre. Las excepciones están comentadas una a una.
--
-- `auth.uid()` va envuelto en `(select ...)` en todas las políticas: así el
-- planificador lo evalúa una vez como InitPlan en lugar de por fila.

alter table public.profiles      enable row level security;
alter table public.user_settings enable row level security;
alter table public.decisions     enable row level security;
alter table public.matches       enable row level security;
alter table public.messages      enable row level security;

-- Nada de esto es público. `anon` solo necesita el endpoint de auth.
revoke all on table public.profiles      from anon;
revoke all on table public.user_settings from anon;
revoke all on table public.decisions     from anon;
revoke all on table public.matches       from anon;
revoke all on table public.messages      from anon;


-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
--
-- Lectura abierta a cualquier usuario autenticado: es lo que hace posible el
-- deck de swipe (`ProfileRepository.list` / `getDeck` devuelven perfiles
-- ajenos). Decisión consciente: un usuario registrado puede enumerar todos los
-- perfiles. Es aceptable en el MVP porque el perfil no contiene datos de
-- contacto — nombre de pila, edad, zona y texto libre. Si en el futuro se
-- añade cualquier dato sensible, esta política tiene que estrecharse.

create policy "profiles: cualquier autenticado puede leer"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles: solo creas el tuyo"
  on public.profiles for insert
  to authenticated
  with check (id = (select auth.uid()));

create policy "profiles: solo editas el tuyo"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "profiles: solo borras el tuyo"
  on public.profiles for delete
  to authenticated
  using (id = (select auth.uid()));


-- ---------------------------------------------------------------------------
-- user_settings — estrictamente privado.
-- ---------------------------------------------------------------------------

create policy "user_settings: solo los tuyos"
  on public.user_settings for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));


-- ---------------------------------------------------------------------------
-- decisions
-- ---------------------------------------------------------------------------
--
-- Solo ves las decisiones que TÚ has tomado. Deliberadamente no hay política
-- que permita leer por `target_id`: si pudieras consultar quién te ha dado
-- like, el swipe dejaría de tener sentido. La reciprocidad la resuelve
-- `public.record_decision()`, que es SECURITY DEFINER y salta estas políticas.
--
-- Sin UPDATE ni DELETE: un swipe no se deshace en el MVP. `record_decision()`
-- hace upsert saltándose RLS, que es el único camino para cambiar de opinión
-- si más adelante se añade "deshacer".

create policy "decisions: solo lees las tuyas"
  on public.decisions for select
  to authenticated
  using (actor_id = (select auth.uid()));

create policy "decisions: solo swipeas en tu nombre"
  on public.decisions for insert
  to authenticated
  with check (actor_id = (select auth.uid()));


-- ---------------------------------------------------------------------------
-- matches
-- ---------------------------------------------------------------------------
--
-- Solo lectura, y solo de los tuyos. No hay INSERT/UPDATE/DELETE para el
-- usuario: los matches los crea `record_decision()` y `last_message_at` lo
-- mueve el trigger de `messages`, ambos SECURITY DEFINER.

create policy "matches: solo los tuyos"
  on public.matches for select
  to authenticated
  using ((select auth.uid()) in (profile_a, profile_b));


-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------
--
-- Lees los mensajes de un match si eres parte de ese match. Escribes solo
-- en tu nombre y solo dentro de un match tuyo — las dos condiciones hacen
-- falta: sin la segunda podrías escribir en la conversación de otros.
--
-- Sin UPDATE ni DELETE: el MVP no edita ni borra mensajes. Añadirlos más
-- adelante es una política nueva, no un cambio de esquema.

create policy "messages: lees los de tus matches"
  on public.messages for select
  to authenticated
  using (public.is_match_member(match_id));

create policy "messages: escribes en tu nombre en tus matches"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.is_match_member(match_id)
  );
