# Foto de perfil con fondo de tarjeta — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada persona pueda poner una foto de perfil y que, si la tiene, la tarjeta del deck la use de fondo a pantalla completa, como Tinder.

**Architecture (enmendada el 2026-10-12 con moderación):** `Avatar` gana `imageUrl?`. Una columna `profiles.avatar_url` (con check que ata la URL al bucket público `avatars` y a la carpeta del propio `id`) y un bucket de Storage con RLS por carpeta `<uid>/`. La foto no viaja por `ProfileInput`: dos métodos propios en `ProfileRepository` (`setAvatarPhoto`, `removeAvatarPhoto`), mock y Supabase. En el cliente, un helper reduce la imagen (4:5, ≤1080 px, JPEG 0,8) antes de subirla; `ProfileAvatar` y la `Portrait` del deck pintan la foto si existe y caen a color + iniciales si no.

El cliente sube a un bucket **privado** `avatar-uploads`; una Edge Function `moderate-avatar` descarga, verifica JPEG, pasa la imagen por la moderación de OpenAI y solo si pasa la publica en el bucket público `avatars` y apunta `avatar_url`. El cliente no puede escribir en `avatars` ni en `avatar_url`. Falla cerrado.

**Tech Stack:** Expo SDK 57 (`expo-image` ya instalado; `expo-image-picker` y `expo-image-manipulator` nuevos), Supabase Storage + Edge Functions (Deno), OpenAI `omni-moderation-latest`, Jest + RNTL, `node --test`, PGlite (`npm run test:schema`).

**Spec:** `docs/superpowers/specs/2026-10-12-foto-de-perfil-design.md`

## Global Constraints

- Leer los docs versionados antes de escribir código de Expo: https://docs.expo.dev/versions/v57.0.0/ (`AGENTS.md`). Instalar con `npx expo install`, nunca con una versión a mano.
- **Una sola foto** por persona; bucket público **de lectura**; sin carrusel.
- **Moderación en servidor, obligatoria y que falla cerrado**: nada llega a `avatars` sin pasar por `moderate-avatar`. El cliente nunca escribe en `avatars` ni en `profiles.avatar_url`.
- `OPENAI_API_KEY` solo como secreto de la Edge Function: nunca en el repo, en el `.env` del cliente ni en logs.
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
- Un `avatar_url` ajeno (de otra carpeta o de otro host) no se puede guardar: lo rechaza el check de la base; y un cliente autenticado ni siquiera puede intentar escribirlo (sin `grant`).
- Imagen marcada por el proveedor: no se publica, la subida pendiente se borra y el mensaje es «Esta foto no cumple las normas de la comunidad. Prueba con otra.»
- Proveedor caído, 5xx, timeout o respuesta rara: se rechaza («Inténtalo más tarde»), se borra la subida pendiente y no se publica nada.
- Un archivo que no es JPEG (un PNG o un ejecutable renombrado a `.jpg`) o que pesa más de 5 MB: se rechaza sin llamar al proveedor.
- Subir con `path` de la carpeta de otra persona: 403, sin leer nada.
- Borrar la cuenta borra la foto pública (acción `remove` de la función) y la carpeta de subidas pendientes, antes del RPC (el SQL solo borra metadatos).

> **Estado del spec:** ya recoge la moderación y el borrado por la API (enmendado el 2026-10-12). El SQL
> de `delete_my_account` no se toca: solo quita metadatos, así que los archivos se borran por la API
> (`remove` + vaciar `avatar-uploads`) antes del RPC (Tarea 3B).

---

## File Structure

| Archivo | Responsabilidad |
| --- | --- |
| `src/data/types.ts` | `Avatar.imageUrl?` |
| `src/data/repositories.ts` | contrato `setAvatarPhoto` / `removeAvatarPhoto` |
| `src/data/mock/index.ts` | implementación en memoria |
| `supabase/migrations/20261012120000_avatar_photo.sql` | columna (sin grant al cliente), check, dos buckets y políticas de subida |
| `src/data/supabase/database.types.ts`, `mappers.ts` | `avatar_url` ↔ `avatar.imageUrl` |
| `supabase/functions/moderate-avatar/logic.mjs` (nuevo) | decisión pura: JPEG, propiedad del path, umbrales, flujo set/remove con dependencias inyectadas |
| `supabase/functions/moderate-avatar/index.ts` (nuevo) | Deno: cablea Storage, `profiles` y OpenAI a `logic.mjs` |
| `src/data/supabase/avatar.ts` (nuevo) | cliente: subir a `avatar-uploads` e invocar la función |
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

### Task 2: Migración (sin grant al cliente), tipos de fila y mapper

**Files:**
- Create: `supabase/migrations/20261012120000_avatar_photo.sql`
- Modify: `src/data/supabase/database.types.ts:34-63` (`ProfileRow`, `ProfileInsert`)
- Modify: `src/data/supabase/mappers.ts:78` (`toProfile`)
- Modify: todo fixture que construya un `ProfileRow` literal (`grep -rn "avatar_accent:" src test`)
- Modify: `supabase/schema-embedded.test.mjs:866-869` (guardia de columnas cerradas)
- Test: `src/data/supabase/mappers.test.ts`, `supabase/schema-embedded.test.mjs` (se corre, no se edita salvo que la cobertura de columnas lo pida)

**Interfaces:**
- Consumes: `Avatar.imageUrl` (Tarea 1).
- Produces: `ProfileRow.avatar_url: string | null`; `toProfile()` → `avatar.imageUrl` presente solo si hay `avatar_url`. `ProfileInsert` **no** lleva `avatar_url` (la escribe solo la función `moderate-avatar`).

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
-- Foto de perfil (una por persona), publicada solo tras moderación.
--
-- `avatar_url` solo puede apuntar al bucket `avatars` del propio proyecto y a la
-- carpeta del propio `id`. NO se concede `insert`/`update` de esta columna a
-- `authenticated` —como el sello de GitHub—: la escribe solo la Edge Function
-- `moderate-avatar` con la service role, después de revisar la imagen.

alter table public.profiles
  add column avatar_url text
    check (
      avatar_url is null
      or (
        char_length(avatar_url) <= 500
        and avatar_url like 'https://%/storage/v1/object/public/avatars/' || id::text || '/%'
      )
    );

-- Buckets y políticas. `storage` no existe en el Postgres embebido de
-- `npm run test:schema` (PGlite): todo va detrás de esta guarda. En Supabase
-- real y en el local de `contract.yml` sí está.
do $avatars$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'avatar_photo: no hay esquema storage, se omiten los buckets';
    return;
  end if;

  -- Subidas pendientes de revisar: PRIVADO. Nadie las lee por la API de cliente.
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('avatar-uploads', 'avatar-uploads', false, 5242880, array['image/jpeg'])
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  -- Fotos ya revisadas: lectura pública por URL; SIN políticas de escritura.
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('avatars', 'avatars', true, 5242880, array['image/jpeg'])
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  -- El dueño solo puede insertar y borrar en SU carpeta de subidas. Sin select
  -- ni update: la función (service role) es quien lee y mueve.
  execute 'drop policy if exists avatar_uploads_insert_own on storage.objects';
  execute $p$create policy avatar_uploads_insert_own on storage.objects for insert to authenticated
    with check (bucket_id = 'avatar-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;

  execute 'drop policy if exists avatar_uploads_delete_own on storage.objects';
  execute $p$create policy avatar_uploads_delete_own on storage.objects for delete to authenticated
    using (bucket_id = 'avatar-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;
end
$avatars$;
```

`supabase/schema-embedded.test.mjs`: la guardia de columnas cerradas pasa a esperar el sello **y** `avatar_url` (orden de `attnum`: la columna nueva va la última) y su mensaje a decir «el sello y la foto…»:

```js
    assert.deepEqual(
      permisos.rows.filter((c) => !c.inserta || !c.actualiza).map((c) => c.attname),
      ['github_handle', 'github_verified_at', 'avatar_url'],
      'el sello y la foto, y solo ellos, están cerrados a authenticated'
    );
```

Y debajo, con el mismo `rechaza(...)` que usan las sondas del sello, una sonda nueva que pruebe que `authenticated` no puede escribir la columna:

```js
    await rechaza(
      `update public.profiles set avatar_url = 'https://x.supabase.co/storage/v1/object/public/avatars/${ana}/a.jpg' where id = '${ana}';`,
      /permission denied/,
      'la foto solo la pone la función de moderación'
    );
```

- [ ] **Step 4: Verificar**

Run: `npx jest src/data/supabase/mappers.test.ts && npx tsc --noEmit && npm run test:schema`
Expected: PASS. Si `test:schema` se queja de que `avatar_url` no figura en la huella esperada, es la huella de despliegue (`supabase/evidence/…/expected.txt`): **no** editarla a mano; anotarlo para la Tarea 7 (se regenera al aplicar la migración al remoto).

- [ ] **Step 5: Commit** — `feat(datos): columna avatar_url, bucket avatars y políticas por carpeta`

---

### Task 3A: Edge Function `moderate-avatar` (la puerta de moderación)

**Files:**
- Create: `supabase/functions/moderate-avatar/logic.mjs`
- Create: `supabase/functions/moderate-avatar/index.ts`
- Test: `supabase/functions/moderate-avatar/logic.test.mjs`
- Modify: `package.json` (script `test:functions`), `.github/workflows/ci.yml` (añadirlo al job de Tests, junto a `test:e2e`)

**Interfaces:**
- Produces: `handleAvatarRequest({ userId, body, deps }): Promise<{ status: number; body: object }>` con `body` = `{ action: 'set', path: string }` o `{ action: 'remove' }`. Respuestas: `200 { avatarUrl: string | null }`, `400 { error: 'bad-request' }`, `403 { error: 'forbidden' }`, `422 { error: 'invalid-image' | 'flagged' }`, `503 { error: 'unavailable' }`.
- `deps` (todo inyectado, sin red en tests): `downloadPending(path): Promise<Uint8Array | null>`, `moderate(bytes): Promise<{ flagged: boolean; scores: Record<string, number> }>` (lanza si el proveedor falla), `publish(userId, bytes): Promise<{ path: string; url: string }>`, `currentAvatarPath(userId): Promise<string | null>`, `setAvatarUrl(userId, url | null): Promise<void>`, `removePublic(path): Promise<void>`, `removePending(path): Promise<void>`.

- [ ] **Step 1: Tests que fallan** — `supabase/functions/moderate-avatar/logic.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleAvatarRequest, isJpeg, ownsPath, verdict } from './logic.mjs';

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]);

function deps(over = {}) {
  const calls = [];
  const d = {
    calls,
    downloadPending: async () => JPEG,
    moderate: async () => ({ flagged: false, scores: { sexual: 0.01 } }),
    publish: async (uid) => {
      calls.push('publish');
      return { path: `${uid}/n.jpg`, url: `https://x/storage/v1/object/public/avatars/${uid}/n.jpg` };
    },
    currentAvatarPath: async () => 'u1/old.jpg',
    setAvatarUrl: async (_uid, url) => calls.push(`setUrl:${url}`),
    removePublic: async (p) => calls.push(`removePublic:${p}`),
    removePending: async (p) => calls.push(`removePending:${p}`),
    ...over,
  };
  return d;
}

test('isJpeg mira los magic bytes, no la extensión', () => {
  assert.equal(isJpeg(JPEG), true);
  assert.equal(isJpeg(PNG), false);
  assert.equal(isJpeg(new Uint8Array(0)), false);
});

test('ownsPath solo acepta <uid>/<archivo>.jpg propio, sin escapar de la carpeta', () => {
  assert.equal(ownsPath('u1', 'u1/a-b_c.jpg'), true);
  assert.equal(ownsPath('u1', 'u2/a.jpg'), false);
  assert.equal(ownsPath('u1', 'u1/../u2/a.jpg'), false);
  assert.equal(ownsPath('u1', 'u1/a.png'), false);
  assert.equal(ownsPath('u1', 'u1/sub/a.jpg'), false);
});

test('verdict: flagged, sexual alto, menores y violencia gráfica se rechazan', () => {
  assert.equal(verdict({ flagged: false, scores: { sexual: 0.1 } }), true);
  assert.equal(verdict({ flagged: true, scores: {} }), false);
  assert.equal(verdict({ flagged: false, scores: { sexual: 0.4 } }), false);
  assert.equal(verdict({ flagged: false, scores: { 'sexual/minors': 0.001 } }), false);
  assert.equal(verdict({ flagged: false, scores: { 'violence/graphic': 0.5 } }), false);
});

test('set limpio: publica, apunta avatar_url, borra la anterior y la pendiente', async () => {
  const d = deps();
  const res = await handleAvatarRequest({ userId: 'u1', body: { action: 'set', path: 'u1/p.jpg' }, deps: d });

  assert.equal(res.status, 200);
  assert.match(res.body.avatarUrl, /avatars\/u1\/n\.jpg$/);
  assert.deepEqual(d.calls, [
    'publish',
    'setUrl:https://x/storage/v1/object/public/avatars/u1/n.jpg',
    'removePublic:u1/old.jpg',
    'removePending:u1/p.jpg',
  ]);
});

test('imagen marcada: 422 flagged, no publica y borra la pendiente', async () => {
  const d = deps({ moderate: async () => ({ flagged: true, scores: { sexual: 0.9 } }) });
  const res = await handleAvatarRequest({ userId: 'u1', body: { action: 'set', path: 'u1/p.jpg' }, deps: d });

  assert.equal(res.status, 422);
  assert.equal(res.body.error, 'flagged');
  assert.deepEqual(d.calls, ['removePending:u1/p.jpg']);
});

test('proveedor caído: falla cerrado, 503, nada publicado', async () => {
  const d = deps({ moderate: async () => { throw new Error('500'); } });
  const res = await handleAvatarRequest({ userId: 'u1', body: { action: 'set', path: 'u1/p.jpg' }, deps: d });

  assert.equal(res.status, 503);
  assert.deepEqual(d.calls, ['removePending:u1/p.jpg']);
});

test('no es JPEG: 422 invalid-image y ni se llama al proveedor', async () => {
  let called = false;
  const d = deps({
    downloadPending: async () => PNG,
    moderate: async () => { called = true; return { flagged: false, scores: {} }; },
  });
  const res = await handleAvatarRequest({ userId: 'u1', body: { action: 'set', path: 'u1/p.jpg' }, deps: d });

  assert.equal(res.status, 422);
  assert.equal(res.body.error, 'invalid-image');
  assert.equal(called, false);
});

test('más de 5 MB: 422 invalid-image', async () => {
  const big = new Uint8Array(5 * 1024 * 1024 + 1);
  big.set(JPEG);
  const d = deps({ downloadPending: async () => big });
  const res = await handleAvatarRequest({ userId: 'u1', body: { action: 'set', path: 'u1/p.jpg' }, deps: d });

  assert.equal(res.status, 422);
});

test('path de otra persona: 403 sin leer nada', async () => {
  let downloaded = false;
  const d = deps({ downloadPending: async () => { downloaded = true; return JPEG; } });
  const res = await handleAvatarRequest({ userId: 'u1', body: { action: 'set', path: 'u2/p.jpg' }, deps: d });

  assert.equal(res.status, 403);
  assert.equal(downloaded, false);
});

test('cuerpo desconocido: 400', async () => {
  const res = await handleAvatarRequest({ userId: 'u1', body: { action: 'hack' }, deps: deps() });
  assert.equal(res.status, 400);
});

test('remove: borra el archivo público y pone avatar_url a null; sin foto no falla', async () => {
  const d = deps();
  const res = await handleAvatarRequest({ userId: 'u1', body: { action: 'remove' }, deps: d });
  assert.equal(res.status, 200);
  assert.deepEqual(d.calls, ['setUrl:null', 'removePublic:u1/old.jpg']);

  const none = deps({ currentAvatarPath: async () => null });
  const again = await handleAvatarRequest({ userId: 'u1', body: { action: 'remove' }, deps: none });
  assert.equal(again.status, 200);
});
```

- [ ] **Step 2:** `node --test supabase/functions/moderate-avatar/logic.test.mjs` → FAIL (módulo inexistente).

- [ ] **Step 3: Implementar `logic.mjs`** (JS plano con ESM: lo importan Deno y `node --test` sin transpilar):

```js
/**
 * Decisión de moderación de avatares, sin Deno ni red: todo lo de fuera entra
 * por `deps`. Principio: nada se publica sin que el servidor lo haya revisado,
 * y si no se puede revisar, no se publica.
 */

export const MAX_BYTES = 5 * 1024 * 1024;

/** Umbrales sobre `category_scores` además del `flagged` del proveedor. */
const LIMITS = { sexual: 0.4, 'violence/graphic': 0.5 };

export function isJpeg(bytes) {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

/** `<uid>/<nombre>.jpg`, una sola carpeta, sin `..` ni subcarpetas. */
export function ownsPath(userId, path) {
  if (typeof path !== 'string') return false;
  const match = /^([^/]+)\/([A-Za-z0-9._-]+\.jpg)$/.exec(path);
  return match !== null && match[1] === userId && !match[2].includes('..');
}

/** `true` si la imagen puede publicarse. */
export function verdict({ flagged, scores }) {
  if (flagged) return false;
  if ((scores['sexual/minors'] ?? 0) > 0) return false;
  return Object.entries(LIMITS).every(([category, limit]) => (scores[category] ?? 0) < limit);
}

export async function handleAvatarRequest({ userId, body, deps }) {
  if (body?.action === 'remove') {
    const current = await deps.currentAvatarPath(userId);
    await deps.setAvatarUrl(userId, null);
    if (current) await deps.removePublic(current);
    return { status: 200, body: { avatarUrl: null } };
  }

  if (body?.action !== 'set') return { status: 400, body: { error: 'bad-request' } };
  if (!ownsPath(userId, body.path)) return { status: 403, body: { error: 'forbidden' } };

  const path = body.path;
  const bytes = await deps.downloadPending(path);
  if (!bytes || bytes.length === 0 || bytes.length > MAX_BYTES || !isJpeg(bytes)) {
    await deps.removePending(path);
    return { status: 422, body: { error: 'invalid-image' } };
  }

  let result;
  try {
    result = await deps.moderate(bytes);
  } catch {
    await deps.removePending(path);
    return { status: 503, body: { error: 'unavailable' } };
  }

  if (!verdict(result)) {
    await deps.removePending(path);
    return { status: 422, body: { error: 'flagged' } };
  }

  const previous = await deps.currentAvatarPath(userId);
  const published = await deps.publish(userId, bytes);
  await deps.setAvatarUrl(userId, published.url);
  if (previous && previous !== published.path) await deps.removePublic(previous);
  await deps.removePending(path);
  return { status: 200, body: { avatarUrl: published.url } };
}
```

`index.ts` (Deno; sin lógica, solo cableado — se revisa a mano y lo cubre el contrato de la Tarea 7):

```ts
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { handleAvatarRequest } from './logic.mjs';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const PUBLIC_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/avatars/`;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function moderate(bytes: Uint8Array) {
  if (!OPENAI_API_KEY) throw new Error('sin OPENAI_API_KEY');
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const response = await fetch('https://api.openai.com/v1/moderations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'omni-moderation-latest',
      input: [{ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${btoa(binary)}` } }],
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`moderación ${response.status}`);
  const payload = await response.json();
  const result = payload?.results?.[0];
  if (typeof result?.flagged !== 'boolean' || typeof result?.category_scores !== 'object') {
    throw new Error('respuesta de moderación inesperada');
  }
  return { flagged: result.flagged as boolean, scores: result.category_scores as Record<string, number> };
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'method' });

  // `verify_jwt` ya ha validado la firma; aquí se saca QUIÉN es.
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user || auth.user.is_anonymous) return json(401, { error: 'unauthorized' });

  const body = await request.json().catch(() => null);

  const result = await handleAvatarRequest({
    userId: auth.user.id,
    body,
    deps: {
      async downloadPending(path: string) {
        const { data, error } = await admin.storage.from('avatar-uploads').download(path);
        return error || !data ? null : new Uint8Array(await data.arrayBuffer());
      },
      moderate,
      async publish(userId: string, bytes: Uint8Array) {
        const path = `${userId}/${crypto.randomUUID()}.jpg`;
        const { error } = await admin.storage
          .from('avatars')
          .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
        if (error) throw error;
        return { path, url: `${PUBLIC_PREFIX}${path}` };
      },
      async currentAvatarPath(userId: string) {
        const { data } = await admin.from('profiles').select('avatar_url').eq('id', userId).single();
        const url = data?.avatar_url as string | null | undefined;
        return url?.startsWith(PUBLIC_PREFIX) ? url.slice(PUBLIC_PREFIX.length) : null;
      },
      async setAvatarUrl(userId: string, url: string | null) {
        const { error } = await admin.from('profiles').update({ avatar_url: url }).eq('id', userId);
        if (error) throw error;
      },
      async removePublic(path: string) {
        await admin.storage.from('avatars').remove([path]);
      },
      async removePending(path: string) {
        await admin.storage.from('avatar-uploads').remove([path]);
      },
    },
  });

  return json(result.status, result.body);
});
```

Nota sobre `is_anonymous`: una sesión anónima no llega aquí (la puerta del correo ya la deja fuera de la app), pero la función no se fía del cliente.

- [ ] **Step 4:** `node --test supabase/functions/moderate-avatar/logic.test.mjs` → PASS. Añadir a `package.json`: `"test:functions": "node --test \"supabase/functions/**/*.test.mjs\""` y `npm run test:functions` en el job Tests de `ci.yml`.

- [ ] **Step 5: Commit** — `feat(datos): Edge Function moderate-avatar, que falla cerrado`

---

### Task 3B: Cliente Supabase: subir a pendientes e invocar la función

**Files:**
- Create: `src/data/supabase/avatar.ts`, `src/data/supabase/avatar-file.ts`
- Test: `src/data/supabase/avatar.test.ts`
- Modify: `src/data/supabase/index.ts` (objeto `profiles`, tras `saveCurrent`; quitar el provisional de la Tarea 1)
- Modify: `src/data/supabase/auth.ts:700` (`deleteMyAccount`)
- Test: `src/data/supabase/auth.test.ts`

**Interfaces:**
- Consumes: `LockInSupabaseClient`, `toProfile`, `ProfileRow` (Tarea 2) y el contrato de la función (Tarea 3A).
- Produces: `uploadAvatar(client, userId, localUri): Promise<string>` (devuelve la URL pública), `deleteAvatar(client): Promise<void>`, `clearPendingUploads(client, userId): Promise<void>` (mejor esfuerzo, nunca lanza), `AvatarRejectedError` con `reason: 'flagged' | 'invalid-image' | 'unavailable'`, y `readLocalImage(uri): Promise<{ bytes: ArrayBuffer; contentType: string }>` en `avatar-file.ts` para poder simularlo.

- [ ] **Step 1: Tests que fallan** — `src/data/supabase/avatar.test.ts`:

```ts
import { AvatarRejectedError, clearPendingUploads, deleteAvatar, uploadAvatar } from './avatar';

import type { LockInSupabaseClient } from './client';

jest.mock('./avatar-file', () => ({
  readLocalImage: jest.fn().mockResolvedValue({ bytes: new ArrayBuffer(8), contentType: 'image/jpeg' }),
}));

function fakeClient(opts: {
  uploadError?: boolean;
  invoke?: { data: unknown; error: unknown };
  list?: string[];
} = {}) {
  const calls: string[] = [];
  const bucket = {
    upload: jest.fn(async (path: string) => {
      calls.push(`upload:${path}`);
      return opts.uploadError ? { data: null, error: { message: 'boom' } } : { data: { path }, error: null };
    }),
    remove: jest.fn(async (paths: string[]) => {
      calls.push(`remove:${paths.join(',')}`);
      return { data: [], error: null };
    }),
    list: jest.fn(async () => ({ data: (opts.list ?? []).map((name) => ({ name })), error: null })),
  };
  const invoke = jest.fn(async (_name: string, init: { body: unknown }) => {
    calls.push(`invoke:${JSON.stringify(init.body)}`);
    return opts.invoke ?? { data: { avatarUrl: 'https://x/avatars/u1/n.jpg' }, error: null };
  });
  const client = {
    storage: { from: jest.fn(() => bucket) },
    functions: { invoke },
  } as unknown as LockInSupabaseClient;
  return { client, calls, bucket, invoke };
}

describe('uploadAvatar', () => {
  it('sube a avatar-uploads/<uid>/<uuid>.jpg y pide a la función que la publique', async () => {
    const { client, calls } = fakeClient();

    const url = await uploadAvatar(client, 'u1', 'file:///a.jpg');

    expect(url).toBe('https://x/avatars/u1/n.jpg');
    expect(calls[0]).toMatch(/^upload:u1\/[\w-]+\.jpg$/);
    expect(calls[1]).toMatch(/^invoke:\{"action":"set","path":"u1\/[\w-]+\.jpg"\}$/);
  });

  it('si la subida falla no invoca la función', async () => {
    const { client, invoke } = fakeClient({ uploadError: true });

    await expect(uploadAvatar(client, 'u1', 'file:///a.jpg')).rejects.toThrow(/subir la foto/i);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('foto marcada: AvatarRejectedError flagged con mensaje de normas', async () => {
    const { client } = fakeClient({
      invoke: { data: null, error: { context: { status: 422, json: async () => ({ error: 'flagged' }) } } },
    });

    const failure = await uploadAvatar(client, 'u1', 'file:///a.jpg').catch((e) => e);

    expect(failure).toBeInstanceOf(AvatarRejectedError);
    expect(failure.reason).toBe('flagged');
    expect(failure.message).toBe('Esta foto no cumple las normas de la comunidad. Prueba con otra.');
  });

  it('proveedor caído: «inténtalo más tarde», sin culpar a la foto', async () => {
    const { client } = fakeClient({
      invoke: { data: null, error: { context: { status: 503, json: async () => ({ error: 'unavailable' }) } } },
    });

    const failure = await uploadAvatar(client, 'u1', 'file:///a.jpg').catch((e) => e);

    expect(failure.reason).toBe('unavailable');
    expect(failure.message).toMatch(/más tarde/);
  });

  it('un error de red de la invocación también falla cerrado', async () => {
    const { client } = fakeClient({ invoke: { data: null, error: new Error('Failed to fetch') } });

    const failure = await uploadAvatar(client, 'u1', 'file:///a.jpg').catch((e) => e);

    expect(failure.reason).toBe('unavailable');
  });
});

describe('deleteAvatar y clearPendingUploads', () => {
  it('deleteAvatar invoca la acción remove', async () => {
    const { client, calls } = fakeClient({ invoke: { data: { avatarUrl: null }, error: null } });
    await deleteAvatar(client);
    expect(calls).toEqual(['invoke:{"action":"remove"}']);
  });

  it('clearPendingUploads vacía la carpeta y nunca lanza', async () => {
    const { client, calls } = fakeClient({ list: ['a.jpg', 'b.jpg'] });
    await clearPendingUploads(client, 'u1');
    expect(calls).toContain('remove:u1/a.jpg,u1/b.jpg');

    const broken = fakeClient();
    broken.bucket.list.mockRejectedValueOnce(new Error('red'));
    await expect(clearPendingUploads(broken.client, 'u1')).resolves.toBeUndefined();
  });
});
```

Y en `auth.test.ts`: «`deleteMyAccount` intenta quitar la foto y vaciar las subidas pendientes **antes** del RPC y sigue aunque eso falle» (con el cliente falso de ese archivo, añadiéndole `functions.invoke` y `storage.from().list/remove`).

- [ ] **Step 2:** `npx jest src/data/supabase/avatar.test.ts` → FAIL.

- [ ] **Step 3: Implementar.**

`src/data/supabase/avatar-file.ts`:

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
 * Foto de perfil en Storage, siempre a través de la moderación del servidor.
 *
 * El cliente solo puede dejar el archivo en `avatar-uploads/<uid>/` (privado);
 * publicarlo en `avatars` y apuntar `profiles.avatar_url` es cosa de la Edge
 * Function `moderate-avatar`, que revisa la imagen antes. Si la revisión no se
 * puede hacer, la foto se rechaza: nunca se publica sin escanear.
 */

import { readLocalImage } from './avatar-file';

import type { LockInSupabaseClient } from './client';

const UPLOADS = 'avatar-uploads';
const FUNCTION = 'moderate-avatar';

export type AvatarRejectedReason = 'flagged' | 'invalid-image' | 'unavailable';

const MESSAGES: Record<AvatarRejectedReason, string> = {
  flagged: 'Esta foto no cumple las normas de la comunidad. Prueba con otra.',
  'invalid-image': 'No hemos podido usar esa imagen. Prueba con otra foto.',
  unavailable: 'No hemos podido revisar la foto ahora mismo. Inténtalo más tarde.',
};

export class AvatarRejectedError extends Error {
  constructor(readonly reason: AvatarRejectedReason) {
    super(MESSAGES[reason]);
    this.name = 'AvatarRejectedError';
  }
}

function newName(): string {
  const id =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${id}.jpg`;
}

async function reasonOf(error: unknown): Promise<AvatarRejectedReason> {
  const context = (error as { context?: { json?: () => Promise<{ error?: string }> } })?.context;
  try {
    const body = await context?.json?.();
    if (body?.error === 'flagged' || body?.error === 'invalid-image') return body.error;
  } catch {
    // Cuerpo ilegible: se trata como «no disponible».
  }
  return 'unavailable';
}

/** Devuelve la URL pública de la foto ya publicada. */
export async function uploadAvatar(
  client: LockInSupabaseClient,
  userId: string,
  localUri: string
): Promise<string> {
  const { bytes, contentType } = await readLocalImage(localUri);

  const path = `${userId}/${newName()}`;
  const { error: uploadError } = await client.storage
    .from(UPLOADS)
    .upload(path, bytes, { contentType, upsert: false });
  if (uploadError) throw new Error('No se ha podido subir la foto. Inténtalo de nuevo.');

  const { data, error } = await client.functions.invoke(FUNCTION, {
    body: { action: 'set', path },
  });
  if (error || typeof data?.avatarUrl !== 'string') {
    // Falla cerrado: sea rechazo o caída, no hay foto nueva.
    throw new AvatarRejectedError(await reasonOf(error));
  }
  return data.avatarUrl as string;
}

export async function deleteAvatar(client: LockInSupabaseClient): Promise<void> {
  const { error } = await client.functions.invoke(FUNCTION, { body: { action: 'remove' } });
  if (error) throw new AvatarRejectedError('unavailable');
}

/** Para el borrado de cuenta: vacía las subidas pendientes. Mejor esfuerzo, nunca lanza. */
export async function clearPendingUploads(
  client: LockInSupabaseClient,
  userId: string
): Promise<void> {
  try {
    const bucket = client.storage.from(UPLOADS);
    const { data } = await bucket.list(userId);
    const paths = (data ?? []).map((file) => `${userId}/${file.name}`);
    if (paths.length > 0) await bucket.remove(paths);
  } catch {
    // La cuenta se borra igual.
  }
}
```

`src/data/supabase/index.ts`, en `profiles` (recarga la fila porque la escribió la función):

```ts
    async setAvatarPhoto(localUri: string) {
      const client = getClient();
      const userId = await getUserId();
      if (!(await profiles.getCurrent())) {
        throw new Error('No hay perfil al que ponerle foto todavía.');
      }
      await uploadAvatar(client, userId, localUri);
      notify(MATCHES_TOPIC);
      return (await profiles.getCurrent()) as Profile;
    },

    async removeAvatarPhoto() {
      const client = getClient();
      await getUserId();
      if (!(await profiles.getCurrent())) {
        throw new Error('No hay perfil al que ponerle foto todavía.');
      }
      await deleteAvatar(client);
      notify(MATCHES_TOPIC);
      return (await profiles.getCurrent()) as Profile;
    },
```

`auth.ts`, `deleteMyAccount`, antes del `rpc` (mejor esfuerzo; el SQL solo quita metadatos y los archivos se borran por la API):

```ts
  const { data: session } = await target.auth.getUser();
  if (session.user) {
    await deleteAvatar(target).catch(() => undefined);
    await clearPendingUploads(target, session.user.id);
  }
```

- [ ] **Step 4:** `npx jest src/data && npx tsc --noEmit` → PASS.

- [ ] **Step 5: Commit** — `feat(datos): subir la foto a pendientes y publicarla solo tras moderar`

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
    // `AvatarRejectedError` ya trae el mensaje de normas o de «más tarde».
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
- Modify: `privacidad.md` y la web pública generada desde él
- Modify: `docs/plan/CONCEPTO.md` (quitar «sin fotos»), `docs/plan/todo/perfil.md`, `docs/plan/TODO.md`
- Modify: memoria `pivote-solo-cofundador.md` (la foto ya existe) y `MEMORY.md` si cambia la línea
- Modify: `src/data/types.ts`/migración vieja: nada (los comentarios históricos de las migraciones no se reescriben)

- [ ] **Step 1:** Suite entera: `npx tsc --noEmit && npm run lint && npx jest --ci --runInBand && npm run test:schema` → todo en verde (reportar cifras reales).

- [ ] **Step 2: Remoto — pedir permiso al usuario antes, cada acción.** (a) Aplicar `20261012120000_avatar_photo.sql` al proyecto Supabase (`mcp__claude_ai_Supabase__apply_migration`). (b) Poner el secreto `OPENAI_API_KEY` en la función: **lo pone el usuario** (dashboard de Supabase → Edge Functions → Secrets, o `! supabase secrets set OPENAI_API_KEY=…`); yo nunca veo ni escribo la clave. (c) Desplegar `moderate-avatar` (`deploy_edge_function`, `verify_jwt: true`). Cada una es una acción exterior: confirmar con el usuario. Después: `get_advisors` (seguridad), comprobar que el bucket `avatars` existe y es público, y que `Schema drift` sale verde en Actions (memoria `schema-drift-remoto-rojo-esperado`: un rojo remoto es deriva real). Regenerar la huella esperada solo si el flujo de `supabase/README.md` lo manda.

- [ ] **Step 3: Contrato de Storage.** En `src/data/supabase/contract.test.ts` (opt-in, contra Supabase local en `contract.yml`) añadir: A sube a `avatar-uploads/A/…` ✔; A sube a `avatar-uploads/B/…` ✘; A no puede escribir en `avatars/…` ✘; A no puede leer `avatar-uploads/A/…` por la API de cliente ✘; A no puede hacer `update profiles set avatar_url = …` ✘. Correr solo en rama desechable (memoria `contrato-manual-cancela-ci`).

- [ ] **Step 4: Comprobador.** Lanzar `comprobador` en el emulador (una casilla cada vez), con la función ya desplegada: perfil → elegir foto de galería → aparece en el deck de una segunda cuenta como fondo, texto legible sobre foto clara y oscura; **rechazo**: con una `OPENAI_API_KEY` inválida la foto debe **fallar cerrado** (mensaje «inténtalo más tarde», nada publicado); el rechazo por contenido lo cubren los tests de `logic.mjs` y no se prueba con imágenes reales; quitar foto; permiso denegado; cuenta anónima antigua cae en `/register` (puerta del correo, `929c92d`). Anotar hallazgos en `docs/plan/todo/perfil.md`.

- [ ] **Step 5: Docs y memoria.** Actualizar `privacidad.md` (la foto se envía a OpenAI solo para revisarla; sin esto no se publica) y regenerar la web pública (memoria `web-publica-github-pages`), actualizar `CONCEPTO.md`, marcar casillas en los TODO con evidencia real, y reescribir la memoria `pivote-solo-cofundador` («sin fotos» ya no vale; hay una foto por perfil desde el 2026-10-12).

- [ ] **Step 6: Commit y push** — `docs(foto): cierre del bloque…`; `git push` de la rama (sin `--force`).
