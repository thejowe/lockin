-- LockIn — datos de desarrollo.
--
-- Es el catálogo de `src/data/mock/seed.ts` traducido a filas reales, para que
-- la app conectada a Supabase enseñe exactamente el mismo deck que el mock. Si
-- alguien añade un perfil allí, se añade aquí: dos catálogos que cuentan
-- historias distintas hacen que "funciona con el mock" deje de significar nada.
--
-- SOLO PARA DESARROLLO. Lo ejecuta `supabase db reset` (o `db push
-- --include-seed`) contra una base local o de staging. NO lo ejecutes contra
-- producción: crea ocho usuarios con contraseña conocida.
--
-- Los ids son UUID fijos porque `profiles.id` referencia `auth.users(id)`: sin
-- ids estables no se podría volver a sembrar de forma idempotente.

begin;

-- ---------------------------------------------------------------------------
-- Usuarios de `auth.users`
-- ---------------------------------------------------------------------------
--
-- Se insertan a mano porque el seed corre como superusuario, sin pasar por la
-- API de auth. Van con el email ya confirmado para poder entrar sin buzón.
--
-- Insertar en `auth.users` a mano tiene una trampa: GoTrue mapea sus columnas
-- de token a `string` de Go, no a punteros, así que una sola de ellas en NULL
-- hace que TODO login con ese usuario devuelva `500 Database error querying
-- schema`. Por eso van las ocho explícitas a cadena vacía. Si vuelves a sembrar
-- sobre una base donde ya se insertaron sin ellas, el `on conflict do nothing`
-- NO lo arregla: hay que reparar las filas existentes con
--
--     update auth.users set
--       confirmation_token = coalesce(confirmation_token, ''),
--       recovery_token = coalesce(recovery_token, ''),
--       email_change = coalesce(email_change, ''),
--       email_change_token_new = coalesce(email_change_token_new, ''),
--       email_change_token_current = coalesce(email_change_token_current, ''),
--       phone_change = coalesce(phone_change, ''),
--       phone_change_token = coalesce(phone_change_token, ''),
--       reauthentication_token = coalesce(reauthentication_token, '')
--     where email like '%@seed.lockin.app';

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  -- GoTrue lee estas columnas como `string`, no como `*string`: si van NULL,
  -- cualquier login con estos usuarios muere con un 500 opaco
  -- ("Database error querying schema"). Se rellenan con cadena vacía porque
  -- es lo que escribe la propia API de auth cuando crea una cuenta.
  confirmation_token,
  recovery_token,
  email_change,
  email_change_token_new,
  email_change_token_current,
  phone_change,
  phone_change_token,
  reauthentication_token
)
values
  ('11111111-1111-4111-8111-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nuria@seed.lockin.app', extensions.crypt('lockin-dev', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', '', '', '', '', ''),
  ('11111111-1111-4111-8111-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'marc@seed.lockin.app',  extensions.crypt('lockin-dev', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', '', '', '', '', ''),
  ('11111111-1111-4111-8111-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alba@seed.lockin.app',  extensions.crypt('lockin-dev', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', '', '', '', '', ''),
  ('11111111-1111-4111-8111-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'diego@seed.lockin.app', extensions.crypt('lockin-dev', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', '', '', '', '', ''),
  ('11111111-1111-4111-8111-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ines@seed.lockin.app',  extensions.crypt('lockin-dev', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', '', '', '', '', ''),
  ('11111111-1111-4111-8111-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tomas@seed.lockin.app', extensions.crypt('lockin-dev', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', '', '', '', '', ''),
  ('11111111-1111-4111-8111-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lucia@seed.lockin.app', extensions.crypt('lockin-dev', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', '', '', '', '', ''),
  ('11111111-1111-4111-8111-000000000008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'omar@seed.lockin.app',  extensions.crypt('lockin-dev', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', '', '', '', '', '')
on conflict (id) do nothing;


-- ---------------------------------------------------------------------------
-- Perfiles
-- ---------------------------------------------------------------------------
--
-- El catálogo cubre a propósito los tres valores de `looking_for`, los tres
-- puntos de partida, los tres niveles de ambición y las cuatro franjas: así
-- cualquier filtro del deck encuentra algo que enseñar.

insert into public.profiles (
  id, name, age, location, timezone,
  avatar_initials, avatar_accent,
  specialties, looking_for, starting_point,
  availability_hours_per_week, availability_bands,
  ambition, link_github, link_portfolio, link_linkedin, prompts
)
values
  (
    '11111111-1111-4111-8111-000000000001', 'Núria Bosch', 29, 'Barcelona', 'Europe/Madrid',
    'NB', 'teal',
    array['dev', 'datos']::public.specialty[], 'par', 'idea-sin-empezar',
    25, array['tarde', 'noche']::public.time_band[],
    'todo-o-nada', 'https://github.com/example-nuria', null, null,
    '[{"question":"Lo que quiero construir es…","answer":"Herramientas para equipos pequeños que odian las hojas de cálculo."}]'::jsonb
  ),
  (
    '11111111-1111-4111-8111-000000000002', 'Marc Oller', 34, 'Valencia', 'Europe/Madrid',
    'MO', 'brass',
    array['diseno', 'producto']::public.specialty[], 'ambos', 'algo-empezado',
    15, array['manana']::public.time_band[],
    'equilibrado', null, 'https://example.com/marc', null,
    '[{"question":"Mi mejor sesión de trabajo empieza…","answer":"A las siete de la mañana, con el café todavía hirviendo."}]'::jsonb
  ),
  (
    '11111111-1111-4111-8111-000000000003', 'Alba Ferrer', 26, 'Ciudad de México', 'America/Mexico_City',
    'AF', 'teal',
    array['marketing', 'contenido']::public.specialty[], 'lockin', 'solo-ganas',
    10, array['noche']::public.time_band[],
    'lifestyle', null, null, null,
    '[{"question":"Necesito compañía para…","answer":"Sentarme a escribir sin abrir otra pestaña. Dos horas, sin excusas."}]'::jsonb
  ),
  (
    '11111111-1111-4111-8111-000000000004', 'Diego Salas', 31, 'Bogotá', 'America/Bogota',
    'DS', 'brass',
    array['ventas', 'marketing']::public.specialty[], 'par', 'solo-ganas',
    30, array['manana', 'tarde']::public.time_band[],
    'todo-o-nada', null, null, 'https://linkedin.com/in/example-diego',
    '[{"question":"Lo que aporto desde el día uno es…","answer":"Conseguir los diez primeros clientes antes de que exista el producto."},{"question":"Busco a alguien que…","answer":"Sepa construir lo que yo ya sé vender."}]'::jsonb
  ),
  (
    '11111111-1111-4111-8111-000000000005', 'Inés Aranda', 24, 'Sevilla', 'Europe/Madrid',
    'IA', 'teal',
    array['producto', 'dev']::public.specialty[], 'ambos', 'idea-sin-empezar',
    20, array['noche', 'madrugada']::public.time_band[],
    'equilibrado', 'https://github.com/example-ines', 'https://example.com/ines', null,
    '[{"question":"Lo que quiero construir es…","answer":"Algo aburrido y necesario para gremios que aún trabajan por WhatsApp."},{"question":"Mi mejor sesión de trabajo empieza…","answer":"Cuando el resto del mundo ya se ha ido a dormir."}]'::jsonb
  ),
  (
    '11111111-1111-4111-8111-000000000006', 'Tomás Ruiz', 38, 'Buenos Aires', 'America/Argentina/Buenos_Aires',
    'TR', 'brass',
    array['finanzas', 'operaciones']::public.specialty[], 'lockin', 'algo-empezado',
    8, array['manana']::public.time_band[],
    'lifestyle', null, null, null,
    '[{"question":"Necesito compañía para…","answer":"Las dos horas de antes del trabajo. Solo no las cumplo nunca."}]'::jsonb
  ),
  (
    '11111111-1111-4111-8111-000000000007', 'Lucía Pardo', 27, 'Lisboa', 'Europe/Lisbon',
    'LP', 'teal',
    array['diseno', 'contenido']::public.specialty[], 'par', 'algo-empezado',
    35, array['tarde', 'noche']::public.time_band[],
    'todo-o-nada', null, 'https://example.com/lucia', null,
    '[{"question":"Lo que ya intenté y no salió…","answer":"Una marca de cerámica preciosa que no vendió nada. Aprendí a validar antes."},{"question":"Busco a alguien que…","answer":"Se enfade conmigo cuando me pase tres días puliendo un icono."}]'::jsonb
  ),
  (
    '11111111-1111-4111-8111-000000000008', 'Omar Chaib', 33, 'Madrid', 'Europe/Madrid',
    'OC', 'brass',
    array['legal', 'producto']::public.specialty[], 'ambos', 'idea-sin-empezar',
    12, array['noche']::public.time_band[],
    'equilibrado', null, null, 'https://linkedin.com/in/example-omar',
    '[{"question":"Lo que aporto desde el día uno es…","answer":"Que el pacto entre nosotros esté escrito antes de que haga falta."}]'::jsonb
  )
on conflict (id) do nothing;

commit;


-- ---------------------------------------------------------------------------
-- Likes entrantes — el equivalente de `SEED_RECIPROCAL_IDS`
-- ---------------------------------------------------------------------------
--
-- En el mock, tres perfiles ya han dado like al usuario: darles like devuelve
-- match al instante, y eso es lo que hace demostrable el flujo de `descubrir`.
-- Aquí no se puede sembrar en el seed porque el usuario todavía no existe: se
-- crea al registrarse desde la app. Esta función lo hace después.
--
-- Uso: entra en la app con Supabase conectado, crea tu perfil, y luego, desde
-- el SQL editor o `psql`, ejecuta
--
--     select public.seed_incoming_likes('tu@email');
--
-- Hay uno de cada modo (`par`, `ambos`, `lockin`) a propósito: elijas el modo
-- que elijas en el onboarding, tu deck tiene al menos un match posible.
--
-- Igual que el seed, esto es una herramienta de desarrollo: vive fuera de
-- `supabase/migrations/` para que no llegue nunca a producción.

create or replace function public.seed_incoming_likes(p_email text)
returns integer
language plpgsql
as $fn$
declare
  v_target uuid;
  v_count integer;
begin
  select id into v_target from auth.users where email = p_email;
  if not found then
    raise exception 'seed_incoming_likes: no hay usuario con email %', p_email;
  end if;

  if not exists (select 1 from public.profiles where id = v_target) then
    raise exception 'seed_incoming_likes: % todavía no ha creado su perfil', p_email;
  end if;

  insert into public.decisions (actor_id, target_id, decision)
  select id, v_target, 'like'
  from unnest(array[
    '11111111-1111-4111-8111-000000000001',  -- Núria  (par)
    '11111111-1111-4111-8111-000000000002',  -- Marc   (ambos)
    '11111111-1111-4111-8111-000000000003'   -- Alba   (lockin)
  ]::uuid[]) as id
  on conflict (actor_id, target_id) do update set decision = 'like';

  get diagnostics v_count = row_count;
  return v_count;
end;
$fn$;

comment on function public.seed_incoming_likes(text) is
  'Solo desarrollo: hace que los tres perfiles semilla den like al usuario indicado, replicando SEED_RECIPROCAL_IDS del mock.';


-- ---------------------------------------------------------------------------
-- dev_reset_current_user — el "resetState()" del backend real
-- ---------------------------------------------------------------------------
--
-- Borra TODO lo que el usuario de la sesión ha generado: su perfil, su modo
-- activo, sus swipes, los swipes que le han hecho a él, sus matches y los
-- mensajes de esos matches. Lo deja como recién registrado.
--
-- Existe para `src/data/supabase/contract.test.ts`. Esa suite necesita estado
-- limpio entre tests y las políticas RLS no dan DELETE sobre `decisions`,
-- `matches` ni `messages` a nadie — con razón: un swipe no se deshace. Sin esta
-- función, la única forma de empezar limpio era registrar un usuario anónimo
-- nuevo por test, y eso agota el límite de altas por IP (30/hora) en una sola
-- pasada de la suite.
--
-- SOLO DESARROLLO, y por eso vive aquí y no en `supabase/migrations/`: en
-- producción esto es un botón de "bórrame los datos" para cualquier usuario
-- autenticado, y el daño no se queda en él — al borrar un match se van los
-- mensajes de la OTRA persona y los likes que esa persona le dio. Si alguna vez
-- hace falta esa función de verdad, se diseña como borrado de cuenta, con
-- confirmación, no como esto.
--
-- La decisión completa (y las dos alternativas descartadas: una migración con
-- guardia de entorno, y un archivo aparte fuera de `seed.sql`) está en
-- `supabase/README.md` → "Deriva de esquema". Que esté instalada o no en un
-- proyecto concreto lo dice `node supabase/drift-check.mjs`, y
-- `supabase/dev-teardown.sql` la retira.
--
-- Es `SECURITY DEFINER` porque tiene que saltarse las políticas, pero no toma
-- parámetros y solo mira `auth.uid()`: no se puede apuntar contra otra persona.

create or replace function public.dev_reset_current_user()
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'dev_reset_current_user: no hay sesión autenticada'
      using errcode = '28000';
  end if;

  -- El orden lo imponen las claves ajenas: mensajes -> matches -> decisiones
  -- -> perfil. `decisions` se borra por los dos lados para que los likes
  -- entrantes tampoco sobrevivan al reset.
  delete from public.messages
   where match_id in (
     select id from public.matches
      where profile_a = v_user or profile_b = v_user
   );

  delete from public.matches
   where profile_a = v_user or profile_b = v_user;

  delete from public.decisions
   where actor_id = v_user or target_id = v_user;

  delete from public.user_settings where user_id = v_user;
  delete from public.profiles where id = v_user;
end;
$fn$;

revoke execute on function public.dev_reset_current_user() from public, anon;
grant execute on function public.dev_reset_current_user() to authenticated;

comment on function public.dev_reset_current_user() is
  'Solo desarrollo: deja al usuario de la sesion como recien registrado. Lo usa src/data/supabase/contract.test.ts.';
