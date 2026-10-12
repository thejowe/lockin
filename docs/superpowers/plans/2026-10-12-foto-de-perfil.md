# Foto de perfil con fondo de tarjeta — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada persona pueda poner una foto de perfil y que, si la tiene, la tarjeta del deck la use de fondo a pantalla completa, como Tinder.

**Architecture:** `Avatar` gana `imageUrl?`. Una columna `profiles.avatar_url` (con check que ata la URL al bucket público `avatars` y a la carpeta del propio `id`) y un bucket de Storage con RLS por carpeta `<uid>/`. La foto no viaja por `ProfileInput`: dos métodos propios en `ProfileRepository` (`setAvatarPhoto`, `removeAvatarPhoto`), mock y Supabase. En el cliente, un helper reduce la imagen (4:5, ≤1080 px, JPEG 0,8) antes de subirla; `ProfileAvatar` y la `Portrait` del deck pintan la foto si existe y caen a color + iniciales si no.

**Tech Stack:** Expo SDK 57 (`expo-image` ya instalado; `expo-image-picker` y `expo-image-manipulator` nuevos), Supabase Storage, Jest + RNTL, PGlite (`npm run test:schema`).

**Spec:** `docs/superpowers/specs/2026-10-12-foto-de-perfil-design.md`

## Global Constraints

- Leer los docs versionados antes de escribir código de Expo: https://docs.expo.dev/versions/v57.0.0/ (`AGENTS.md`). Instalar con `npx expo install`, nunca con una versión a mano.
- **Una sola foto** por persona; **bucket público**; sin moderación automática; sin carrusel.
- Sin foto, todo sigue como hoy: color de acento + iniciales. Nunca debe romperse un perfil sin `imageUrl`.
- La foto **no** entra en `ProfileInput` (mismo criterio que `githubVerification`).
- Una columna nueva de `profiles` nace **sin permiso de escritura** para `authenticated`: hay que concederla en la migración (peaje documentado en `20260916000100_github_verification.sql`).
- Texto de la UI en español, con tildes. Contraste del texto sobre la foto ≥ 4,5:1.
- Worktree compartido: **nunca** `git add` ni `git stash`. Commit con `git hash-object -w` + `git update-index --add --cacheinfo` (ver memoria `commit-solo-mis-archivos-con-cacheinfo`). `format:check` local es ruido CRLF; no ejecutar `prettier --write src`.
- Commits terminan con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Perfil sin foto en todas las pantallas (deck, chat, matches, perfil): sigue viéndose igual que hoy.
- Subida que falla a mitad (red, 413, permiso de Storage): el perfil conserva la foto anterior; no queda `avatar_url` apuntando a un archivo inexistente.
- Reemplazar la foto: la anterior se borra del bucket; si ese borrado falla, la nueva igualmente queda puesta (el huérfano es el mal menor).
- Quitar la foto sin tenerla: no es un error.
- Permiso de galería/cámara denegado, o selección cancelada: sin excepción, sin cambios, mensaje claro solo en el caso «denegado».
- `saveCurrent` (editar la ficha) **no** borra la foto: el `upsert` no manda `avatar_url`.
- Un `avatar_url` ajeno (de otra carpeta o de otro host) no se puede guardar: lo rechaza el check de la base.
- Borrar la cuenta borra la foto del bucket (el SQL solo borra metadatos; el archivo se borra por la API de Storage antes del RPC).

> **Desviación del spec (§1 y §4):** el spec decía que `delete_my_account` borra `storage.objects`
> por SQL. Eso solo quita la fila de metadatos y deja el archivo en el almacenamiento. El borrado
> real va por la API de Storage, desde el cliente, antes del RPC (Tarea 3). Se corrige el spec en la Tarea 7.

---

## File Structure

| Archivo | Responsabilidad |
| --- | --- |
| `src/data/types.ts` | `Avatar.imageUrl?` |
| `src/data/repositories.ts` | contrato `setAvatarPhoto` / `removeAvatarPhoto` |
| `src/data/mock/index.ts` | implementación en memoria |
| `supabase/migrations/20261012120000_avatar_photo.sql` | columna, check, grants, bucket y políticas |
| `src/data/supabase/database.types.ts`, `mappers.ts` | `avatar_url` ↔ `avatar.imageUrl` |
| `src/data/supabase/avatar.ts` (nuevo) | subir/borrar en Storage, sin tocar el resto del repositorio |
| `src/data/supabase/index.ts`, `auth.ts` | cableado en `profiles.*` y en `deleteMyAccount` |
| `src/features/profile/avatar-photo.ts` (nuevo) | elegir y reducir la foto en el dispositivo |
| `src/features/profile/photo-section.tsx` (nuevo) | bloque «Foto» del perfil |
| `src/features/profile/profile-avatar.tsx`, `src/features/chat/profile-avatar.tsx` | avatar con foto |
| `src/features/discover/profile-card.tsx` | `Portrait` con foto de fondo |

---

### Task 1: Tipo y contrato, con el mock

**Files:**
- Modify: `src/data/types.ts:105-114` (`Avatar`)
- Modify: `src/data/repositories.ts:68-96` (`ProfileRepository`)
- Modify: `src/data/mock/index.ts` (junto a `saveCurrent`, ~l. 232)
- Test: `src/data/mock/index.test.ts`

**Interfaces:**
- Produces: `Avatar.imageUrl?: string`; `ProfileRepository.setAvatarPhoto(localUri: string): Promise<Profile>`; `ProfileRepository.removeAvatarPhoto(): Promise<Profile>`. Ambos lanzan `Error('No hay perfil al que ponerle foto todavía.')` sin perfil.

- [ ] **Step 1: Escribir los tests que fallan** — añadir en `src/data/mock/index.test.ts` (seguir el patrón de `createMockRepositories` / `resetState` del propio archivo):

```ts
describe('foto de perfil (mock)', () => {
  it('sin perfil no hay a quién ponerle foto', async () => {
    resetState();
    const { profiles } = createMockRepositories();
    await expect(profiles.setAvatarPhoto('file:///a.jpg')).rejects.toThrow(/No hay perfil/);
    await expect(profiles.removeAvatarPhoto()).rejects.toThrow(/No hay perfil/);
  });

  it('setAvatarPhoto guarda imageUrl y conserva iniciales y acento', async () => {
    resetState();
    const { profiles } = createMockRepositories();
    const saved = await profiles.saveCurrent(buildProfileInput({ name: 'Núria Bosch' }));

    const updated = await profiles.setAvatarPhoto('file:///a.jpg');

    expect(updated.avatar).toEqual({
      initials: saved.avatar.initials,
      accent: saved.avatar.accent,
      imageUrl: 'file:///a.jpg',
    });
    expect((await profiles.getCurrent())?.avatar.imageUrl).toBe('file:///a.jpg');
  });

  it('editar la ficha no borra la foto', async () => {
    resetState();
    const { profiles } = createMockRepositories();
    await profiles.saveCurrent(buildProfileInput());
    await profiles.setAvatarPhoto('file:///a.jpg');

    const edited = await profiles.saveCurrent(buildProfileInput({ location: 'Girona' }));

    expect(edited.avatar.imageUrl).toBe('file:///a.jpg');
  });

  it('removeAvatarPhoto la quita y es idempotente', async () => {
    resetState();
    const { profiles } = createMockRepositories();
    await profiles.saveCurrent(buildProfileInput());
    await profiles.setAvatarPhoto('file:///a.jpg');

    const removed = await profiles.removeAvatarPhoto();
    expect(removed.avatar.imageUrl).toBeUndefined();
    await expect(profiles.removeAvatarPhoto()).resolves.toMatchObject({ id: removed.id });
  });
});
```

Si el archivo no importa `buildProfileInput`, añadir `import { buildProfileInput } from '../test-fixtures';`.

- [ ] **Step 2: Ver que falla**

Run: `npx jest src/data/mock/index.test.ts -t "foto de perfil"`
Expected: FAIL (`profiles.setAvatarPhoto is not a function`) y errores de tipo.

- [ ] **Step 3: Implementar**

`src/data/types.ts` — sustituir el docblock y la interfaz `Avatar`:

```ts
/**
 * Avatar: iniciales sobre un color derivado del perfil y, opcionalmente, una
 * foto. Sin `imageUrl` se pinta el color con las iniciales, como siempre.
 */
export interface Avatar {
  /** 1-2 letras, ya en mayúsculas. */
  initials: string;
  /** Token de acento con el que pintar el fondo. */
  accent: 'brass' | 'teal';
  /**
   * Foto de perfil: URL pública del bucket `avatars` (Supabase) o URI local en
   * el mock. Ausente si la persona no ha puesto ninguna. No entra en
   * `ProfileInput`: se mueve solo con `setAvatarPhoto()`/`removeAvatarPhoto()`.
   */
  imageUrl?: string;
}
```

`src/data/repositories.ts` — dentro de `ProfileRepository`, tras `refreshGithubVerification()`:

```ts
  /**
   * Pone la foto de perfil propia a partir de un archivo local ya reducido
   * (ver `features/profile/avatar-photo.ts`). Sustituye la anterior y la borra
   * del almacenamiento. Devuelve el perfil actualizado.
   *
   * Lanza si no hay perfil o si la subida falla; en ese caso el perfil
   * conserva la foto que tuviera.
   */
  setAvatarPhoto(localUri: string): Promise<Profile>;

  /** Quita la foto propia y la borra del almacenamiento. Idempotente. */
  removeAvatarPhoto(): Promise<Profile>;
```

`src/data/mock/index.ts` — dentro del objeto `profiles`, justo después de `saveCurrent` (y en `saveCurrent`, heredar la foto):

```ts
        avatar: {
          initials: input.avatar?.initials ?? initialsFrom(input.name),
          accent: input.avatar?.accent ?? existing?.avatar.accent ?? 'brass',
          // La foto no viene del formulario: se hereda, como `githubVerification`.
          ...(existing?.avatar.imageUrl ? { imageUrl: existing.avatar.imageUrl } : {}),
        },
```

```ts
    async setAvatarPhoto(localUri: string) {
      const existing = currentProfile();
      if (!existing) throw new Error('No hay perfil al que ponerle foto todavía.');

      const profile: Profile = {
        ...existing,
        avatar: { ...existing.avatar, imageUrl: localUri },
        updatedAt: nowIso(),
      };
      getState().profiles.set(profile.id, profile);
      notify(MATCHES_TOPIC);
      return profile;
    },

    async removeAvatarPhoto() {
      const existing = currentProfile();
      if (!existing) throw new Error('No hay perfil al que ponerle foto todavía.');

      const { imageUrl: _removed, ...avatar } = existing.avatar;
      const profile: Profile = { ...existing, avatar, updatedAt: nowIso() };
      getState().profiles.set(profile.id, profile);
      notify(MATCHES_TOPIC);
      return profile;
    },
```

- [ ] **Step 4: Ver que pasa y que tsc no se queja**

Run: `npx jest src/data/mock && npx tsc --noEmit`
Expected: PASS. Si tsc marca otros implementadores de `ProfileRepository` (dobles en tests), añadirles ambos métodos con `jest.fn()`; si marca el Supabase real, es esperado hasta la Tarea 3: añadir allí un `async setAvatarPhoto() { throw new Error('pendiente'); }` provisional y quitarlo en la Tarea 3.

- [ ] **Step 5: Commit**

```bash
# sin git add (worktree compartido): hash-object + update-index --cacheinfo de cada ruta, y luego
git commit -m "feat(foto): contrato setAvatarPhoto/removeAvatarPhoto y avatar.imageUrl, con el mock"
```

---

### Task 2: Migración, tipos de fila y mapper

**Files:**
- Create: `supabase/migrations/20261012120000_avatar_photo.sql`
- Modify: `src/data/supabase/database.types.ts:34-63` (`ProfileRow`, `ProfileInsert`)
- Modify: `src/data/supabase/mappers.ts:78` (`toProfile`)
- Modify: todo fixture que construya un `ProfileRow` literal (`grep -rn "avatar_accent:" src test`)
- Test: `src/data/supabase/mappers.test.ts`, `supabase/schema-embedded.test.mjs` (se corre, no se edita salvo que la cobertura de columnas lo pida)

**Interfaces:**
- Consumes: `Avatar.imageUrl` (Tarea 1).
- Produces: `ProfileRow.avatar_url: string | null`; `toProfile()` → `avatar.imageUrl` presente solo si hay `avatar_url`. `ProfileInsert` **no** lleva `avatar_url` (la foto se escribe solo por `avatar.ts`).

- [ ] **Step 1: Test del mapper que falla** — en `src/data/supabase/mappers.test.ts`, con la fixture de fila que ya use el archivo:

```ts
describe('toProfile: foto', () => {
  it('sin avatar_url no hay imageUrl', () => {
    const profile = toProfile({ ...ROW, avatar_url: null });
    expect(profile.avatar).toEqual({ initials: ROW.avatar_initials, accent: ROW.avatar_accent });
    expect('imageUrl' in profile.avatar).toBe(false);
  });

  it('con avatar_url expone imageUrl', () => {
    const url = 'https://x.supabase.co/storage/v1/object/public/avatars/u1/a.jpg';
    expect(toProfile({ ...ROW, avatar_url: url }).avatar.imageUrl).toBe(url);
  });
});

it('toProfileInsert no manda avatar_url: editar la ficha no puede borrar la foto', () => {
  expect(toProfileInsert('u1', buildProfileInput(), null)).not.toHaveProperty('avatar_url');
});
```

(Sustituir `ROW` por el nombre real de la fixture del archivo.)

- [ ] **Step 2:** `npx jest src/data/supabase/mappers.test.ts` → FAIL.

- [ ] **Step 3: Implementar**

`database.types.ts`: en `ProfileRow` tras `avatar_accent`: `avatar_url: string | null;`. En `ProfileInsert`, añadir `'avatar_url'` a la lista del `Omit`.

`mappers.ts`, `toProfile`:

```ts
    avatar: {
      initials: row.avatar_initials,
      accent: row.avatar_accent,
      ...(row.avatar_url ? { imageUrl: row.avatar_url } : {}),
    },
```

Arreglar con `avatar_url: null` los `ProfileRow` literales que `npx tsc --noEmit` señale.

Migración `supabase/migrations/20261012120000_avatar_photo.sql`:

```sql
-- Foto de perfil (una por persona), pública.
--
-- `avatar_url` solo puede apuntar al bucket `avatars` del propio proyecto y a la
-- carpeta del propio `id`: un perfil no puede enseñar el archivo de otra
-- persona ni una URL de fuera. Se rellena por UPDATE de esa columna (ver
-- `src/data/supabase/avatar.ts`); `profileInput` no la manda nunca, así que el
-- upsert del formulario no la toca.

alter table public.profiles
  add column avatar_url text
    check (
      avatar_url is null
      or (
        char_length(avatar_url) <= 500
        and avatar_url like 'https://%/storage/v1/object/public/avatars/' || id::text || '/%'
      )
    );

-- Peaje de la migración del sello de GitHub: toda columna nueva nace sin
-- permiso de escritura para `authenticated`.
grant insert (avatar_url) on public.profiles to authenticated;
grant update (avatar_url) on public.profiles to authenticated;

-- Bucket y políticas. `storage` no existe en el Postgres embebido de
-- `npm run test:schema` (PGlite), así que todo va detrás de esta guarda; en
-- Supabase real —y en el local de `contract.yml`— sí está.
do $avatars$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'avatar_photo: no hay esquema storage, se omite el bucket';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  -- La lectura pública no necesita política (URL pública); SELECT propio hace
  -- falta para que `remove()` y el reemplazo vean el objeto.
  execute 'drop policy if exists avatars_select_own on storage.objects';
  execute $p$create policy avatars_select_own on storage.objects for select to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;

  execute 'drop policy if exists avatars_insert_own on storage.objects';
  execute $p$create policy avatars_insert_own on storage.objects for insert to authenticated
    with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;

  execute 'drop policy if exists avatars_update_own on storage.objects';
  execute $p$create policy avatars_update_own on storage.objects for update to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
    with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;

  execute 'drop policy if exists avatars_delete_own on storage.objects';
  execute $p$create policy avatars_delete_own on storage.objects for delete to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;
end
$avatars$;
```

- [ ] **Step 4: Verificar**

Run: `npx jest src/data/supabase/mappers.test.ts && npx tsc --noEmit && npm run test:schema`
Expected: PASS. Si `test:schema` se queja de que `avatar_url` no figura en la huella esperada, es la huella de despliegue (`supabase/evidence/…/expected.txt`): **no** editarla a mano; anotarlo para la Tarea 7 (se regenera al aplicar la migración al remoto).

- [ ] **Step 5: Commit** — `feat(datos): columna avatar_url, bucket avatars y políticas por carpeta`

---

### Task 3: Repositorio Supabase y borrado de cuenta

**Files:**
- Create: `src/data/supabase/avatar.ts`
- Test: `src/data/supabase/avatar.test.ts`
- Modify: `src/data/supabase/index.ts` (objeto `profiles`, tras `saveCurrent`; quitar el provisional de la Tarea 1)
- Modify: `src/data/supabase/auth.ts:700` (`deleteMyAccount`)
- Test: `src/data/supabase/auth.test.ts`

**Interfaces:**
- Consumes: `LockInSupabaseClient`, `toProfile`, `ProfileRow` (Tarea 2).
- Produces: `uploadAvatar(client, userId, localUri): Promise<ProfileRow>`, `deleteAvatar(client, userId): Promise<ProfileRow>`, `removeAllAvatarFiles(client, userId): Promise<void>` (mejor esfuerzo, nunca lanza), y `readLocalImage(uri): Promise<{ bytes: ArrayBuffer; contentType: string }>` exportado para poder simularlo.

- [ ] **Step 1: Tests que fallan** — `src/data/supabase/avatar.test.ts`. Cliente falso mínimo (misma idea que `rooms.test.ts`):

```ts
import { deleteAvatar, removeAllAvatarFiles, uploadAvatar } from './avatar';

import type { LockInSupabaseClient } from './client';

jest.mock('./avatar-file', () => ({
  readLocalImage: jest.fn().mockResolvedValue({ bytes: new ArrayBuffer(8), contentType: 'image/jpeg' }),
}));

const PUBLIC = 'https://x.supabase.co/storage/v1/object/public/avatars/u1/new.jpg';

function fakeClient(opts: { uploadError?: boolean; list?: string[]; currentUrl?: string | null } = {}) {
  const calls: string[] = [];
  const bucket = {
    upload: jest.fn(async (path: string) => {
      calls.push(`upload:${path}`);
      return opts.uploadError ? { data: null, error: { message: 'boom' } } : { data: { path }, error: null };
    }),
    getPublicUrl: jest.fn((path: string) => ({
      data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/avatars/${path}` },
    })),
    remove: jest.fn(async (paths: string[]) => {
      calls.push(`remove:${paths.join(',')}`);
      return { data: [], error: null };
    }),
    list: jest.fn(async () => ({ data: (opts.list ?? []).map((name) => ({ name })), error: null })),
  };
  const update = jest.fn((patch: Record<string, unknown>) => {
    calls.push(`update:${JSON.stringify(patch)}`);
    return {
      eq: () => ({
        select: () => ({
          single: async () => ({ data: { id: 'u1', avatar_url: patch.avatar_url }, error: null }),
        }),
      }),
    };
  });
  const select = jest.fn(() => ({
    eq: () => ({
      single: async () => ({ data: { avatar_url: opts.currentUrl ?? null }, error: null }),
    }),
  }));
  const client = {
    storage: { from: jest.fn(() => bucket) },
    from: jest.fn(() => ({ update, select })),
  } as unknown as LockInSupabaseClient;
  return { client, calls, bucket };
}

describe('uploadAvatar', () => {
  it('sube a <uid>/<uuid>.jpg, apunta avatar_url y borra la foto anterior', async () => {
    const old = 'https://x.supabase.co/storage/v1/object/public/avatars/u1/old.jpg';
    const { client, calls } = fakeClient({ currentUrl: old });

    await uploadAvatar(client, 'u1', 'file:///a.jpg');

    expect(calls[0]).toMatch(/^upload:u1\/[\w-]+\.jpg$/);
    expect(calls[1]).toMatch(/^update:\{"avatar_url":"https:\/\/x\.supabase\.co\/.*\/u1\/[\w-]+\.jpg"\}$/);
    expect(calls[2]).toBe('remove:u1/old.jpg');
  });

  it('si la subida falla no toca avatar_url', async () => {
    const { client, calls } = fakeClient({ uploadError: true });

    await expect(uploadAvatar(client, 'u1', 'file:///a.jpg')).rejects.toThrow(/foto/i);
    expect(calls.some((c) => c.startsWith('update:'))).toBe(false);
  });
});

describe('deleteAvatar', () => {
  it('pone avatar_url a null y borra el archivo; sin foto no falla', async () => {
    const { client, calls } = fakeClient({ currentUrl: PUBLIC });
    await deleteAvatar(client, 'u1');
    expect(calls).toContain('update:{"avatar_url":null}');
    expect(calls).toContain('remove:u1/new.jpg');

    const none = fakeClient({ currentUrl: null });
    await expect(deleteAvatar(none.client, 'u1')).resolves.toBeDefined();
  });
});

describe('removeAllAvatarFiles', () => {
  it('borra todo lo de la carpeta y nunca lanza', async () => {
    const { client, calls } = fakeClient({ list: ['a.jpg', 'b.jpg'] });
    await removeAllAvatarFiles(client, 'u1');
    expect(calls).toContain('remove:u1/a.jpg,u1/b.jpg');

    const broken = fakeClient();
    broken.bucket.list.mockRejectedValueOnce(new Error('red'));
    await expect(removeAllAvatarFiles(broken.client, 'u1')).resolves.toBeUndefined();
  });
});
```

Y en `auth.test.ts`, un caso: «`deleteMyAccount` intenta borrar las fotos antes del RPC y sigue aunque eso falle» — con el cliente falso que ya use ese archivo, añadir `storage.from().list/remove` y comprobar el orden (storage antes que `rpc('delete_my_account')`).

- [ ] **Step 2:** `npx jest src/data/supabase/avatar.test.ts` → FAIL (módulo inexistente).

- [ ] **Step 3: Implementar**

`src/data/supabase/avatar-file.ts` (separado para poder simularlo en Jest):

```ts
/** Lee un archivo local y lo devuelve como bytes. Solo JPEG: el cliente ya lo reduce. */
export async function readLocalImage(
  uri: string
): Promise<{ bytes: ArrayBuffer; contentType: string }> {
  const response = await fetch(uri);
  if (!response.ok) throw new Error('No se ha podido leer la foto.');
  return { bytes: await response.arrayBuffer(), contentType: 'image/jpeg' };
}
```

`src/data/supabase/avatar.ts`:

```ts
/**
 * Foto de perfil en Storage. Un archivo por subida, `<uid>/<uuid>.jpg`: la URL
 * cambia con cada foto (sin cachés viejas) y no se puede adivinar.
 *
 * Orden de `uploadAvatar`: subir → apuntar `avatar_url` → borrar la anterior.
 * Si falla subir, no se toca nada; si falla borrar la anterior, la nueva ya
 * está puesta y el huérfano es el mal menor.
 */

import { readLocalImage } from './avatar-file';

import type { LockInSupabaseClient } from './client';
import type { ProfileRow } from './database.types';

const BUCKET = 'avatars';
const MARKER = `/${BUCKET}/`;

function newName(): string {
  const id =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${id}.jpg`;
}

/** `https://…/avatars/<uid>/<archivo>` → `<uid>/<archivo>`, o `null` si no es de este bucket. */
function pathOf(url: string | null): string | null {
  if (!url) return null;
  const at = url.indexOf(MARKER);
  return at === -1 ? null : url.slice(at + MARKER.length);
}

async function currentUrl(client: LockInSupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await client
    .from('profiles')
    .select('avatar_url')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return (data as { avatar_url: string | null }).avatar_url;
}

async function point(
  client: LockInSupabaseClient,
  userId: string,
  url: string | null
): Promise<ProfileRow> {
  const { data, error } = await client
    .from('profiles')
    .update({ avatar_url: url })
    .eq('id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data as ProfileRow;
}

export async function uploadAvatar(
  client: LockInSupabaseClient,
  userId: string,
  localUri: string
): Promise<ProfileRow> {
  const previous = pathOf(await currentUrl(client, userId));
  const { bytes, contentType } = await readLocalImage(localUri);

  const path = `${userId}/${newName()}`;
  const bucket = client.storage.from(BUCKET);
  const { error: uploadError } = await bucket.upload(path, bytes, { contentType, upsert: false });
  if (uploadError) throw new Error('No se ha podido subir la foto. Inténtalo de nuevo.');

  const { data } = bucket.getPublicUrl(path);
  let row: ProfileRow;
  try {
    row = await point(client, userId, data.publicUrl);
  } catch (cause) {
    await bucket.remove([path]).catch(() => undefined);
    throw cause;
  }

  if (previous && previous !== path) await bucket.remove([previous]).catch(() => undefined);
  return row;
}

export async function deleteAvatar(
  client: LockInSupabaseClient,
  userId: string
): Promise<ProfileRow> {
  const previous = pathOf(await currentUrl(client, userId));
  const row = await point(client, userId, null);
  if (previous) await client.storage.from(BUCKET).remove([previous]).catch(() => undefined);
  return row;
}

/** Para el borrado de cuenta: vacía la carpeta. Mejor esfuerzo, nunca lanza. */
export async function removeAllAvatarFiles(
  client: LockInSupabaseClient,
  userId: string
): Promise<void> {
  try {
    const bucket = client.storage.from(BUCKET);
    const { data } = await bucket.list(userId);
    const paths = (data ?? []).map((file) => `${userId}/${file.name}`);
    if (paths.length > 0) await bucket.remove(paths);
  } catch {
    // La cuenta se borra igual: un archivo huérfano es el mal menor.
  }
}
```

`src/data/supabase/index.ts`, en `profiles`:

```ts
    async setAvatarPhoto(localUri: string) {
      const client = getClient();
      const userId = await getUserId();
      if (!(await profiles.getCurrent())) {
        throw new Error('No hay perfil al que ponerle foto todavía.');
      }
      const row = await uploadAvatar(client, userId, localUri);
      notify(MATCHES_TOPIC);
      return toProfile(row);
    },

    async removeAvatarPhoto() {
      const client = getClient();
      const userId = await getUserId();
      if (!(await profiles.getCurrent())) {
        throw new Error('No hay perfil al que ponerle foto todavía.');
      }
      const row = await deleteAvatar(client, userId);
      notify(MATCHES_TOPIC);
      return toProfile(row);
    },
```

(import `uploadAvatar`, `deleteAvatar` de `./avatar`.)

`auth.ts`, `deleteMyAccount`, antes del `rpc`:

```ts
  // El SQL de `delete_my_account` solo se lleva los metadatos del bucket: los
  // archivos se borran por la API, y antes de que la sesión deje de valer.
  const { data: session } = await target.auth.getUser();
  if (session.user) await removeAllAvatarFiles(target, session.user.id);
```

- [ ] **Step 4:** `npx jest src/data && npx tsc --noEmit` → PASS.

- [ ] **Step 5: Commit** — `feat(datos): subir, reemplazar y borrar la foto en Storage; borrar cuenta limpia la carpeta`

---

### Task 4: Elegir y reducir la foto en el dispositivo

**Files:**
- Modify: `package.json`, `package-lock.json` (por `expo install`)
- Modify: `app.json` (plugin `expo-image-picker`)
- Create: `src/features/profile/avatar-photo.ts`
- Test: `src/features/profile/avatar-photo.test.ts`

**Interfaces:**
- Produces: `type PickedPhoto = { status: 'picked'; uri: string } | { status: 'cancelled' } | { status: 'denied' }` y `pickAvatarPhoto(source: 'library' | 'camera'): Promise<PickedPhoto>`. La `uri` ya viene recortada 4:5 y con lado largo ≤ 1080 px, en JPEG.

- [ ] **Step 1: Leer los docs v57** de `expo-image-picker` y `expo-image-manipulator` y confirmar la API (en particular el contexto `ImageManipulator.manipulate(uri).resize(...).renderAsync()` → `.saveAsync({ format, compress })` y `mediaTypes: ['images']`). Ajustar el código de abajo si difiere.

- [ ] **Step 2: Instalar**

Run: `npx expo install expo-image-picker expo-image-manipulator`
Y en `app.json` → `plugins`, antes de `"expo-secure-store"`:

```json
[
  "expo-image-picker",
  {
    "photosPermission": "cofounder necesita tu galería para que elijas tu foto de perfil.",
    "cameraPermission": "cofounder necesita la cámara para hacerte la foto de perfil."
  }
],
```

(El plugin de `react-native-webrtc` ya declara el permiso de cámara en Android; no se pisa: el de `expo-image-picker` coincide.)

- [ ] **Step 3: Tests que fallan** — `avatar-photo.test.ts`:

```ts
import * as ImagePicker from 'expo-image-picker';

import { pickAvatarPhoto } from './avatar-photo';

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}));
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: jest.fn(() => ({
      resize: jest.fn().mockReturnThis(),
      renderAsync: jest.fn().mockResolvedValue({
        saveAsync: jest.fn().mockResolvedValue({ uri: 'file:///reducida.jpg' }),
      }),
    })),
  },
}));

const picker = ImagePicker as jest.Mocked<typeof ImagePicker>;
const granted = { granted: true } as never;

describe('pickAvatarPhoto', () => {
  beforeEach(() => jest.clearAllMocks());

  it('devuelve la foto reducida al elegir de la galería', async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue(granted);
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///grande.jpg', width: 3000, height: 4000 }],
    } as never);

    await expect(pickAvatarPhoto('library')).resolves.toEqual({
      status: 'picked',
      uri: 'file:///reducida.jpg',
    });
  });

  it('permiso denegado: status denied, sin abrir el selector', async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: false } as never);

    await expect(pickAvatarPhoto('library')).resolves.toEqual({ status: 'denied' });
    expect(picker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it('selección cancelada: status cancelled', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue(granted);
    picker.launchCameraAsync.mockResolvedValue({ canceled: true, assets: null } as never);

    await expect(pickAvatarPhoto('camera')).resolves.toEqual({ status: 'cancelled' });
  });
});
```

- [ ] **Step 4:** `npx jest src/features/profile/avatar-photo.test.ts` → FAIL.

- [ ] **Step 5: Implementar** `src/features/profile/avatar-photo.ts`:

```ts
/**
 * Elegir la foto de perfil y dejarla lista para subir: recorte 4:5 (el de la
 * tarjeta del deck), lado largo ≤ 1080 px y JPEG al 0,8. Una foto de 12 MB del
 * móvil no tiene por qué viajar entera.
 */

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export type PickedPhoto =
  | { status: 'picked'; uri: string }
  | { status: 'cancelled' }
  | { status: 'denied' };

const MAX_LONG_SIDE = 1080;
const JPEG_QUALITY = 0.8;

const OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [4, 5],
  quality: 1,
};

export async function pickAvatarPhoto(source: 'library' | 'camera'): Promise<PickedPhoto> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: 'denied' };

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(OPTIONS)
      : await ImagePicker.launchImageLibraryAsync(OPTIONS);
  const asset = result.canceled ? null : result.assets?.[0];
  if (!asset) return { status: 'cancelled' };

  const portrait = asset.height >= asset.width;
  const context = ImageManipulator.manipulate(asset.uri).resize(
    portrait ? { height: MAX_LONG_SIDE } : { width: MAX_LONG_SIDE }
  );
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });

  return { status: 'picked', uri: saved.uri };
}
```

- [ ] **Step 6:** `npx jest src/features/profile/avatar-photo.test.ts && npx tsc --noEmit && npx expo export --platform web` → PASS (el export web comprueba que los dos paquetes no rompen el bundle web, como pasó con webrtc).

- [ ] **Step 7: Commit** — `feat(perfil): elegir y reducir la foto de perfil en el dispositivo`

---

### Task 5: Bloque «Foto» en el perfil y avatares con foto

**Files:**
- Create: `src/features/profile/photo-section.tsx`
- Test: `src/features/profile/photo-section.test.tsx`
- Modify: `src/features/profile/profile-avatar.tsx` (imagen circular), `src/features/chat/profile-avatar.tsx`
- Modify: `src/features/profile/index.ts` (exportar `PhotoSection`)
- Modify: `src/app/(tabs)/profile.tsx` (montar el bloque entre `ProfileDetails` y `GithubVerification`)
- Test: `src/features/profile/profile-avatar.test.tsx` (nuevo si no existe), `test/app/profile.test.tsx`

**Interfaces:**
- Consumes: `pickAvatarPhoto` (Tarea 4), `repositories.profiles.setAvatarPhoto/removeAvatarPhoto` (Tareas 1-3), `Avatar.imageUrl`.
- Produces: `<PhotoSection profile={Profile} onChange={() => void} />`.

- [ ] **Step 1: Tests que fallan.**

`profile-avatar.test.tsx` — con foto pinta una imagen y no las iniciales; sin foto, las iniciales:

```tsx
import { render, screen } from '@testing-library/react-native';

import { ProfileAvatar } from './profile-avatar';

it('con imageUrl pinta la foto y no las iniciales', async () => {
  await render(<ProfileAvatar avatar={{ initials: 'NB', accent: 'teal', imageUrl: 'https://x/a.jpg' }} />);
  expect(screen.getByTestId('avatar-photo')).toBeTruthy();
  expect(screen.queryByText('NB')).toBeNull();
});

it('sin imageUrl pinta las iniciales como siempre', async () => {
  await render(<ProfileAvatar avatar={{ initials: 'NB', accent: 'teal' }} />);
  expect(screen.getByText('NB')).toBeTruthy();
  expect(screen.queryByTestId('avatar-photo')).toBeNull();
});
```

(Repetir los dos casos para `src/features/chat/profile-avatar.tsx` en su propio test.)

`photo-section.test.tsx` (RNTL 14: `render` y `fireEvent` son asíncronos; el `DataProvider` con `createMockRepositories`, como `account-section.test.tsx`):

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { DataProvider } from '@/data';
import { createMockRepositories, resetState } from '@/data/mock';
import { buildProfileInput } from '@/data/test-fixtures';

import { pickAvatarPhoto } from './avatar-photo';
import { PhotoSection } from './photo-section';

import type { Profile, Repositories } from '@/data';

jest.mock('./avatar-photo', () => ({ pickAvatarPhoto: jest.fn() }));
const pick = pickAvatarPhoto as jest.Mock;

let repositories: Repositories;
let profile: Profile;
const onChange = jest.fn();

async function setup(withPhoto = false) {
  resetState();
  repositories = createMockRepositories();
  profile = await repositories.profiles.saveCurrent(buildProfileInput());
  if (withPhoto) profile = await repositories.profiles.setAvatarPhoto('file:///vieja.jpg');
  onChange.mockClear();
  pick.mockReset();
  await render(
    <DataProvider value={repositories}>
      <PhotoSection profile={profile} onChange={onChange} />
    </DataProvider>
  );
}

it('elegir de la galería sube la foto y avisa con onChange', async () => {
  await setup();
  pick.mockResolvedValue({ status: 'picked', uri: 'file:///nueva.jpg' });

  await fireEvent.press(screen.getByRole('button', { name: 'Elegir de la galería' }));

  await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
  expect(pick).toHaveBeenCalledWith('library');
  expect((await repositories.profiles.getCurrent())?.avatar.imageUrl).toBe('file:///nueva.jpg');
});

it('permiso denegado enseña el mensaje y no sube nada', async () => {
  await setup();
  pick.mockResolvedValue({ status: 'denied' });

  await fireEvent.press(screen.getByRole('button', { name: 'Hacer una foto' }));

  expect(await screen.findByText(/Sin permiso de cámara/)).toBeTruthy();
  expect(onChange).not.toHaveBeenCalled();
  expect((await repositories.profiles.getCurrent())?.avatar.imageUrl).toBeUndefined();
});

it('cancelar no cambia nada ni enseña error', async () => {
  await setup();
  pick.mockResolvedValue({ status: 'cancelled' });

  await fireEvent.press(screen.getByRole('button', { name: 'Elegir de la galería' }));

  await waitFor(() => expect(pick).toHaveBeenCalled());
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.queryByRole('alert')).toBeNull();
});

it('si la subida falla enseña el error y deja reintentar', async () => {
  await setup();
  pick.mockResolvedValue({ status: 'picked', uri: 'file:///nueva.jpg' });
  jest
    .spyOn(repositories.profiles, 'setAvatarPhoto')
    .mockRejectedValueOnce(new Error('No se ha podido subir la foto. Inténtalo de nuevo.'));

  await fireEvent.press(screen.getByRole('button', { name: 'Elegir de la galería' }));

  expect(await screen.findByText('No se ha podido subir la foto. Inténtalo de nuevo.')).toBeTruthy();
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Elegir de la galería' })).not.toBeDisabled();
});

it('«Quitar foto» solo aparece con foto y la quita', async () => {
  await setup();
  expect(screen.queryByRole('button', { name: 'Quitar foto' })).toBeNull();
});

it('con foto, «Quitar foto» llama a removeAvatarPhoto y avisa', async () => {
  await setup(true);

  await fireEvent.press(screen.getByRole('button', { name: 'Quitar foto' }));

  await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
  expect((await repositories.profiles.getCurrent())?.avatar.imageUrl).toBeUndefined();
});
```

- [ ] **Step 2:** `npx jest src/features/profile/photo-section.test.tsx src/features/profile/profile-avatar.test.tsx` → FAIL.

- [ ] **Step 3: Implementar.**

Ambos `ProfileAvatar`: tras calcular el círculo, si `avatar.imageUrl`:

```tsx
import { Image } from 'expo-image';
// …
if (avatar.imageUrl) {
  return (
    <Image
      testID="avatar-photo"
      accessible={false}
      source={{ uri: avatar.imageUrl }}
      contentFit="cover"
      transition={120}
      style={{
        width: box, // `size` en la versión de chat
        height: box,
        borderRadius: Radii.pill,
        borderWidth: Stroke.hairline,
        borderColor: theme.border,
        backgroundColor: accent + TINT_ALPHA, // mientras carga, el color de siempre
      }}
    />
  );
}
```

`photo-section.tsx`: avatar grande (`ProfileAvatar size="large"`), texto «Tu foto» / «Aún no tienes foto», tres controles (`SecondaryButton` de `./controls`): «Elegir de la galería», «Hacer una foto», «Quitar foto» (solo con foto). Estado `busy` (deshabilita y muestra «Subiendo…») y `error`. Lógica:

```tsx
async function run(source: 'library' | 'camera') {
  setError(null);
  const picked = await pickAvatarPhoto(source);
  if (picked.status === 'cancelled') return;
  if (picked.status === 'denied') {
    setError(
      source === 'camera'
        ? 'Sin permiso de cámara no podemos hacerte la foto. Puedes dárselo en los ajustes del móvil.'
        : 'Sin permiso de galería no podemos leer tu foto. Puedes dárselo en los ajustes del móvil.'
    );
    return;
  }
  setBusy(true);
  try {
    await repositories.profiles.setAvatarPhoto(picked.uri);
    onChange();
  } catch (cause) {
    setError(cause instanceof Error ? cause.message : 'No se ha podido subir la foto. Inténtalo de nuevo.');
  } finally {
    setBusy(false);
  }
}
```

Mensajes de error con `accessibilityRole="alert"`. `profile.tsx`: envolver `<PhotoSection profile={profile} onChange={refresh} />` en `Animated.View entering={enterUp(1)}` y subir en uno los índices de `GithubVerification`, «Editar perfil» y `AccountSection`.

- [ ] **Step 4:** `npx jest src/features test/app/profile.test.tsx && npx tsc --noEmit && npx eslint src` → PASS. En `profile.test.tsx` añadir un caso: perfil sin foto muestra «Aún no tienes foto» y no «Quitar foto».

- [ ] **Step 5: Commit** — `feat(perfil): poner y quitar la foto de perfil; avatares con foto`

---

### Task 6: La foto de fondo de la tarjeta del deck

**Files:**
- Modify: `src/features/discover/profile-card.tsx:268-318` (`Portrait`)
- Test: `src/features/discover/profile-card.test.tsx`

**Interfaces:**
- Consumes: `profile.avatar.imageUrl` (Tarea 1).
- Produces: con foto, la tarjeta pinta `testID="portrait-photo"`; sin ella, el monograma y el tinte actuales (`testID` ausente).

- [ ] **Step 1: Tests que fallan** — añadir al test existente (usar su `buildProfile`/fixture):

```tsx
it('con foto la pinta de fondo y no pinta el monograma', async () => {
  await render(<ProfileCard {...props} profile={{ ...profile, avatar: { ...profile.avatar, imageUrl: 'https://x/a.jpg' } }} />);
  expect(screen.getByTestId('portrait-photo')).toBeTruthy();
  expect(screen.queryByText(profile.avatar.initials)).toBeNull();
});

it('sin foto sigue el retrato de color con las iniciales', async () => {
  await render(<ProfileCard {...props} profile={profile} />);
  expect(screen.queryByTestId('portrait-photo')).toBeNull();
  expect(screen.getByText(profile.avatar.initials)).toBeTruthy();
});
```

(Sustituir `props`/`profile` por los nombres reales del archivo.)

- [ ] **Step 2:** `npx jest src/features/discover/profile-card.test.tsx` → FAIL.

- [ ] **Step 3: Implementar** — en `Portrait`, con `imageUrl` se sustituyen el SVG de tinte y el monograma por la foto; el fundido a negro de abajo **se queda** (es lo que mantiene el texto legible), con un tramo medio algo más opaco para fotos claras:

```tsx
import { Image } from 'expo-image';
// …
const imageUrl = profile.avatar.imageUrl;
// …
{imageUrl ? (
  <Image
    testID="portrait-photo"
    source={{ uri: imageUrl }}
    contentFit="cover"
    transition={150}
    // Es decorado: el nombre ya se lee en el texto.
    accessible={false}
    style={StyleSheet.absoluteFill}
  />
) : (
  <>
    {/* …el <Svg> del tinte y el <View style={styles.monogramSlot}> actuales… */}
  </>
)}
```

y, en el degradado de abajo, con foto: `stopOpacity` 0 en `0.3`, `0.55` en `0.55`, `0.88` en `0.75`, `0.96` en `1` (sin foto, los valores de siempre). Comprobar el contraste del texto contra una foto clara en la Tarea 7 (comprobador).

- [ ] **Step 4:** `npx jest src/features/discover test/app/discover.test.tsx && npx tsc --noEmit && npx eslint src` → PASS.

- [ ] **Step 5: Commit** — `feat(descubrir): la foto de perfil de fondo de la tarjeta, estilo Tinder`

---

### Task 7: Cierre — docs, remoto y comprobación en dispositivo

**Files:**
- Modify: `docs/superpowers/specs/2026-10-12-foto-de-perfil-design.md` (§1 y §4: borrado por la API, no por SQL)
- Modify: `docs/plan/CONCEPTO.md` (quitar «sin fotos»), `docs/plan/todo/perfil.md`, `docs/plan/TODO.md`
- Modify: memoria `pivote-solo-cofundador.md` (la foto ya existe) y `MEMORY.md` si cambia la línea
- Modify: `src/data/types.ts`/migración vieja: nada (los comentarios históricos de las migraciones no se reescriben)

- [ ] **Step 1:** Suite entera: `npx tsc --noEmit && npm run lint && npx jest --ci --runInBand && npm run test:schema` → todo en verde (reportar cifras reales).

- [ ] **Step 2: Remoto — pedir permiso al usuario antes.** Aplicar `20261012120000_avatar_photo.sql` al proyecto Supabase (`mcp__claude_ai_Supabase__apply_migration`) es una acción exterior: confirmar con el usuario. Después: `get_advisors` (seguridad), comprobar que el bucket `avatars` existe y es público, y que `Schema drift` sale verde en Actions (memoria `schema-drift-remoto-rojo-esperado`: un rojo remoto es deriva real). Regenerar la huella esperada solo si el flujo de `supabase/README.md` lo manda.

- [ ] **Step 3: Contrato de Storage.** En `src/data/supabase/contract.test.ts` (opt-in, contra Supabase local en `contract.yml`) añadir: A sube a `A/…` ✔; A sube a `B/…` ✘; B no puede poner `avatar_url` apuntando a la carpeta de A (check). Correr solo en rama desechable (memoria `contrato-manual-cancela-ci`).

- [ ] **Step 4: Comprobador.** Lanzar `comprobador` en el emulador (una casilla cada vez): perfil → elegir foto de galería → aparece en el deck de una segunda cuenta como fondo, texto legible sobre foto clara y oscura; quitar foto; permiso denegado; cuenta anónima antigua cae en `/register` (puerta del correo, `929c92d`). Anotar hallazgos en `docs/plan/todo/perfil.md`.

- [ ] **Step 5: Docs y memoria.** Corregir el spec (borrado de archivos por la API de Storage antes del RPC), actualizar `CONCEPTO.md`, marcar casillas en los TODO con evidencia real, y reescribir la memoria `pivote-solo-cofundador` («sin fotos» ya no vale; hay una foto por perfil desde el 2026-10-12).

- [ ] **Step 6: Commit y push** — `docs(foto): cierre del bloque…`; `git push` de la rama (sin `--force`).
