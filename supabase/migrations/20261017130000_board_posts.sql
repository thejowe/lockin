-- cofounder — tablón personal (2026-10-17).
--
-- Cada persona tiene en su perfil un tablón de fotos (su trabajo, más fotos
-- suyas) con un pie corto. Mismo modelo que la foto de perfil
-- (`20261012120000_avatar_photo.sql`, `20261016120000_avatars_private.sql`):
--
--   * El cliente NO escribe nada: sube la foto a su carpeta de `avatar-uploads`
--     (pendientes, ya con sus políticas) y la Edge Function `moderate-board` la
--     modera con OpenAI y, si pasa, la copia al bucket privado `board` e inserta
--     la fila con la service role. Ni INSERT, ni UPDATE, ni DELETE para
--     `authenticated`: quitar una foto también pasa por la función.
--   * Se lee con URLs firmadas: el bucket es privado y solo se firma lo que
--     tiene fila (como `avatars_read_published`).
--   * Un bloqueo, en cualquier sentido, esconde el tablón del otro.


create table public.board_posts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  -- Ruta del objeto en `board` (`<owner>/<uuid>.jpg`), no una URL.
  image_path text not null,
  caption text not null default '',
  created_at timestamptz not null default now(),
  constraint board_posts_image_path_check check (
    char_length(image_path) <= 200
    and image_path like owner_id::text || '/%.jpg'
    and image_path not like '%/%/%'
    and image_path not like '%..%'
  ),
  constraint board_posts_caption_check check (char_length(caption) <= 280),
  constraint board_posts_image_path_key unique (image_path)
);

create index board_posts_owner_created_idx
  on public.board_posts (owner_id, created_at desc);

alter table public.board_posts enable row level security;

revoke all on table public.board_posts from public, anon, authenticated;
grant select on table public.board_posts to authenticated;

create policy "board_posts: se leen sin bloqueo" on public.board_posts
  for select to authenticated
  using (owner_id = (select auth.uid()) or not public.has_profile_block(owner_id));


-- ---------------------------------------------------------------------------
-- El tope de 12 fotos, sin carreras
-- ---------------------------------------------------------------------------
--
-- La función cuenta antes de moderar para no gastar en balde, pero dos subidas
-- a la vez pasarían las dos de 11 a 13. El candado por dueño serializa las
-- inserciones de una misma persona y la cuenta se hace dentro.

create or replace function public.board_posts_enforce_max()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  perform pg_advisory_xact_lock(hashtextextended('board_posts:' || new.owner_id::text, 0));
  if (select count(*) from public.board_posts where owner_id = new.owner_id) >= 12 then
    raise exception 'board_posts: el tablón ya tiene 12 fotos' using errcode = 'LI010';
  end if;
  return new;
end;
$fn$;

revoke execute on function public.board_posts_enforce_max() from public, anon, authenticated;

create trigger board_posts_enforce_max
  before insert on public.board_posts
  for each row execute function public.board_posts_enforce_max();


-- ---------------------------------------------------------------------------
-- Bucket y lectura
-- ---------------------------------------------------------------------------

do $board$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'board_posts: no hay esquema storage, se omiten el bucket y la política';
    return;
  end if;

  -- Fotos ya revisadas: PRIVADO, SIN políticas de escritura.
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('board', 'board', false, 5242880, array['image/jpeg'])
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  -- Solo se firma lo que tiene fila, y la fila ya respeta los bloqueos (RLS de
  -- `board_posts` también aplica dentro de esta subconsulta).
  execute 'drop policy if exists board_read_published on storage.objects';
  execute $p$create policy board_read_published on storage.objects for select to authenticated
    using (
      bucket_id = 'board'
      and exists (
        select 1 from public.board_posts b where b.image_path = storage.objects.name
      )
    )$p$;
end
$board$;


-- ---------------------------------------------------------------------------
-- Eliminar la cuenta también borra el tablón
-- ---------------------------------------------------------------------------
--
-- Igual que `20261014140000_avatar_storage_cleanup.sql`, con `board` en la
-- lista de buckets. Las filas se van solas por el `on delete cascade`.

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

  perform 1 from public.profiles where id = v_uid for update;

  -- Fotos: primero, mientras el id aún existe. Mismo criterio de carpeta que las
  -- políticas de storage (`<uid>/...`).
  if to_regclass('storage.objects') is not null then
    perform set_config('storage.allow_delete_query', 'true', true);
    execute $q$
      delete from storage.objects
      where bucket_id in ('avatars', 'avatar-uploads', 'board')
        and (storage.foldername(name))[1] = $1
    $q$ using v_uid::text;
  end if;

  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
