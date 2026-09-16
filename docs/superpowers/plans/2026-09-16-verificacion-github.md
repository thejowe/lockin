# Verificación de autoría de GitHub — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que el enlace de GitHub de un perfil pueda probarse suyo, con un sello que el cliente no puede encenderse solo.

**Architecture:** el usuario linka una identidad OAuth de GitHub a la cuenta de Supabase que ya tiene (`linkIdentity()` sobre la sesión anónima existente). El sello no lo escribe el cliente: una función `SECURITY DEFINER` sin parámetros lee `auth.identities` y escribe dos columnas nuevas de `profiles` que el rol `authenticated` **no tiene permiso de escribir** (`revoke update` de columna). El enlace se deriva de la identidad, así que no hay que normalizar URLs ni comparar nada.

**Tech Stack:** Expo SDK 57 (`expo-web-browser` y `expo-linking`, ya instalados), `@supabase/supabase-js` v2, Postgres/Supabase, Jest + RNTL, PGlite 0.3.14 para el SQL.

**Spec:** `docs/superpowers/specs/2026-09-16-verificacion-github-design.md` — léela entera antes de la Tarea 1. Este plan argumenta desde ella y no la repite.

## Global Constraints

- **Expo ha cambiado**: consulta `https://docs.expo.dev/versions/v57.0.0/` antes de escribir código de Expo. No de memoria (`AGENTS.md`).
- **Cero dependencias nuevas.** `expo-web-browser` (~57.0.2), `expo-linking` (~57.0.9) y `"scheme": "lockin"` ya están. Si crees que necesitas instalar algo, para y dilo.
- **El cliente nunca declara su propia verificación.** Cualquier camino en el que el cliente mande el handle, la fecha o un booleano de verificado es un fallo de la tarea, no un atajo.
- **El sello certifica autoría del enlace y nada más.** Ni «perfil verificado», ni «persona verificada», ni un check a secas junto al nombre sin decir de qué. El copy dice GitHub.
- **Es señal, no puerta:** no filtra el deck, no lo ordena, no condiciona el match.
- **Nunca `git add .`** — otros bloques pueden tener trabajo sin commitear en este mismo worktree. Añade rutas explícitas.
- **No se lanza a la vez que `perfil`, `descubrir` ni `datos`**: este bloque pisa archivos suyos (ver la tabla de la spec).
- Suelo de cobertura de `jest.config.js`: 89.82/82.56/91.49/91.38 (sentencias/ramas/funciones/líneas). No bajarlo.
- Paleta: el sello va en `brass`, el acento que `descubrir` ya usa para lo comprobado. Nada de verde ni de azul nuevos.

### Cómo se verifica en esta máquina (Windows)

| Comando | Vale como veredicto |
|---|---|
| `npm test`, `npx jest <ruta>` | Sí |
| `npx tsc --noEmit`, `npm run lint` | Sí |
| `npm run test:schema` | Sí (PGlite, sin Docker) |
| `npx expo export --platform web` | Sí |
| `npm run format:check` | **No** — da ~100 archivos falsos por CRLF. Corre `npx prettier --write` sobre lo que tocaste y lee el veredicto del job «Formato» en CI |
| `npm run test:e2e` | **No** — sus 2 fallos aquí son CRLF, no regresión |

### Nombres reales, ya verificados contra el repo

No los adivines ni inventes helpers nuevos: existen con exactamente estos nombres.

| Qué | Dónde |
|---|---|
| `buildProfile(overrides)`, `buildProfileInput(overrides)` | `src/data/test-fixtures.ts` |
| `buildProfileRow(overrides)` | `src/data/supabase/mappers.test.ts` (local del archivo) |
| `SEED_PROFILES` | `src/data/mock/seed.ts` |
| `describeRepositoryContract(backend)`, con `fixture = await backend.reset()` | `src/data/repositories.contract.ts` |
| Patrón de capacidad: `const itWithTimeTravel = backend.canTimeTravel ? it : it.skip;` | `src/data/repositories.contract.ts:540` |
| Declaración de capacidades del backend | `src/data/mock/index.test.ts:32` (mock) y `src/data/supabase/contract.test.ts:306` (Supabase) |
| Ficha ajena | `src/features/profile/profile-details.tsx` + `.test.tsx` |
| Formulario | `src/features/profile/profile-form.tsx` + `.test.tsx` |
| Tarjeta del deck | `src/features/discover/profile-card.tsx` + `.test.tsx` |
| Perfil propio (pantalla) | `src/app/(tabs)/profile.tsx`, con `src/features/profile/controls.tsx` |

`canLinkIdentityWithoutBrowser` es **nuevo**: añádelo a la interfaz
`ContractBackend` y decláralo en los dos sitios de la tabla, junto a
`canTimeTravel`.

---

### Task 1: Confirmar el flujo OAuth y fijar `flowType`

Es la única incógnita técnica de la spec, y va primero a propósito: todo lo demás es igual se resuelva como se resuelva, pero el código del callback no.

**Files:**
- Modify: `src/data/supabase/client.ts`
- Test: `src/data/supabase/client.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `getSupabaseClient()` con `flowType: 'pkce'` fijado explícitamente. Las tareas 5 y 6 asumen que el canje del callback es el que confirmes aquí.

- [ ] **Step 1: Leer la documentación viva, no la memoria**

Lee, en este orden:
- https://supabase.com/docs/guides/auth/auth-identity-linking (qué devuelve `linkIdentity`, y que «Enable Manual Linking» está desactivado por defecto)
- https://supabase.com/docs/guides/auth/native-mobile-deep-linking (el callback en nativo)
- https://docs.expo.dev/versions/v57.0.0/sdk/webbrowser/ (`openAuthSessionAsync`, qué resuelve al cancelar)

Contesta por escrito estas tres, que son las que bloquean:
1. Con `flowType: 'pkce'`, ¿el callback de `linkIdentity` trae `?code=` que haya que canjear con `exchangeCodeForSession`, o lo resuelve el SDK?
2. ¿`linkIdentity` acepta `skipBrowserRedirect` y devuelve la URL, como `signInWithOAuth`?
3. ¿Cambiar `flowType` a `'pkce'` afecta a `signInAnonymously()` y a `signInWithPassword()`, que ya funcionan?

- [ ] **Step 2: Si la respuesta a la 3 es que sí afecta, PARA**

Eso es complejidad oculta: rompería el arranque de la app, que hoy está verde. No improvises una migración de sesiones dentro de esta tarea. Escribe lo que encontraste y dilo.

- [ ] **Step 3: Escribir el test que falla**

En `src/data/supabase/client.test.ts`, añade al bloque que ya prueba la configuración del cliente:

```ts
it('usa PKCE: el callback de OAuth trae un code de un solo uso, no un token en la URL', () => {
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://ref.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  resetSupabaseClient();

  getSupabaseClient();

  const [, , options] = (createClient as jest.Mock).mock.calls.at(-1);
  expect(options.auth.flowType).toBe('pkce');
});
```

Si `client.test.ts` no mockea `createClient` todavía, mockéalo (`jest.mock('@supabase/supabase-js')`) siguiendo el patrón de mocks que ya usan los tests de `src/data/supabase/`.

- [ ] **Step 4: Verlo fallar**

Run: `npx jest src/data/supabase/client.test.ts`
Expected: FAIL — `flowType` es `undefined`.

- [ ] **Step 5: Fijarlo**

En `src/data/supabase/client.ts`, dentro de `auth`:

```ts
      // La app es un cliente público: su código lo tiene quien la ejecuta, así
      // que no hay secreto que guardar y el flujo implícito dejaría un token de
      // acceso en la URL de vuelta. PKCE devuelve un `code` de un solo uso
      // ligado a un verificador que solo conoce este dispositivo.
      // Lo necesita `verifyGithub()`; ver la spec de verificación.
      flowType: 'pkce',
```

- [ ] **Step 6: Verde y sin regresión**

Run: `npx jest src/data/supabase/ && npx tsc --noEmit`
Expected: PASS las dos.

- [ ] **Step 7: Commit**

```bash
git add src/data/supabase/client.ts src/data/supabase/client.test.ts
git commit -m "feat(verificacion): fija PKCE en el cliente de Supabase"
```

---

### Task 2: Dominio y contrato

**Files:**
- Modify: `src/data/types.ts`, `src/data/repositories.ts`, `src/data/repositories.contract.ts`, `src/data/test-fixtures.ts`

**Interfaces:**
- Consumes: nada de la Tarea 1.
- Produces: `GithubVerification { handle: string; verifiedAt: string }`; `Profile.githubVerification: GithubVerification | null`; `ProfileRepository.verifyGithub(): Promise<Profile>` y `.unverifyGithub(): Promise<Profile>`. Las tareas 3, 5, 6 y 7 usan exactamente estos nombres.

- [ ] **Step 1: El tipo de dominio**

En `src/data/types.ts`, justo después de `ProfileLinks`:

```ts
/**
 * Prueba de que el enlace de GitHub del perfil pertenece a quien controla la
 * cuenta. Se obtiene linkando una identidad OAuth real; el cliente no puede
 * encenderla escribiendo en su propia fila, porque las columnas que la guardan
 * están fuera de su permiso de escritura. Ver
 * `docs/superpowers/specs/2026-09-16-verificacion-github-design.md`.
 *
 * Certifica autoría del enlace y NADA más: ni competencia, ni identidad legal,
 * ni que exista una persona detrás. No la uses como antifraude ni escribas
 * copy que prometa más que eso.
 */
export interface GithubVerification {
  /** El `user_name` de la identidad. `github.com/<handle>` es su perfil. */
  handle: string;
  /** Cuándo se verificó, en ISO. */
  verifiedAt: string;
}
```

y dentro de `Profile`, después de `links`:

```ts
  /**
   * Sello de GitHub, o `null` si esta persona no lo ha verificado.
   *
   * **No está en `ProfileInput` a propósito**: si el formulario pudiera
   * mandarlo, cualquiera se lo encendería. Solo se mueve con `verifyGithub()` y
   * `unverifyGithub()`.
   */
  githubVerification: GithubVerification | null;
```

- [ ] **Step 2: Ver cuánto se rompe**

Run: `npx tsc --noEmit`
Expected: FAIL. Errores en todos los sitios que construyen un `Profile` literal (mock, fixtures, mappers). Es la lista de trabajo de esta tarea y de las siguientes: anótala.

- [ ] **Step 3: Los dos métodos del contrato**

En `src/data/repositories.ts`, dentro de `ProfileRepository`, después de `list`:

```ts
  /**
   * Abre el flujo de OAuth de GitHub y, al volver, sincroniza el sello del
   * perfil propio. Devuelve el perfil ya actualizado.
   *
   * **Sobrescribe `links.github`** con la URL derivada de la identidad: quien
   * la llama debe haber avisado al usuario si ya había una distinta.
   *
   * Lanza si el usuario cancela el flujo o si el proveedor lo rechaza.
   */
  verifyGithub(): Promise<Profile>;

  /** Desvincula la identidad, apaga el sello y vacía `links.github`. */
  unverifyGithub(): Promise<Profile>;
```

- [ ] **Step 4: Arreglar las fixtures**

En `src/data/test-fixtures.ts`, añade `githubVerification: null` a cada `Profile` literal. Si hay un helper que construye perfiles, ponlo solo ahí con `githubVerification: null` por defecto y un override opcional.

- [ ] **Step 5: Los casos de contrato**

En `src/data/repositories.contract.ts`, un bloque nuevo. Los dos primeros corren contra los dos backends; los otros dependen de poder verificar sin humano, y por eso preguntan por una capacidad en vez de asumirla — mismo patrón que los tres tests que ya se saltan por reloj simulado.

```ts
describe('verificación de GitHub', () => {
  it('un perfil nuevo no está verificado', async () => {
    const profile = await repositories.profiles.saveCurrent(buildProfileInput());
    expect(profile.githubVerification).toBeNull();
  });

  it('guardar el perfil no enciende ni apaga el sello', async () => {
    // La invariante que sostiene todo lo demás: el formulario no puede
    // tocar la verificación ni por accidente ni a propósito.
    await repositories.profiles.saveCurrent(buildProfileInput());
    const before = await repositories.profiles.getCurrent();

    await repositories.profiles.saveCurrent({
      ...buildProfileInput(),
      name: 'Nombre Cambiado',
    });
    const after = await repositories.profiles.getCurrent();

    expect(after?.githubVerification).toEqual(before?.githubVerification ?? null);
  });

  const itIfLinkable = backend.canLinkIdentityWithoutBrowser ? it : it.skip;

  itIfLinkable('al verificar, el enlace se deriva de la identidad', async () => {
    await repositories.profiles.saveCurrent(buildProfileInput());

    const verified = await repositories.profiles.verifyGithub();

    expect(verified.githubVerification).not.toBeNull();
    const handle = verified.githubVerification!.handle;
    expect(verified.links.github).toBe(`https://github.com/${handle}`);
  });

  itIfLinkable('desverificar apaga el sello y vacía el enlace', async () => {
    await repositories.profiles.saveCurrent(buildProfileInput());
    await repositories.profiles.verifyGithub();

    const plain = await repositories.profiles.unverifyGithub();

    expect(plain.githubVerification).toBeNull();
    expect(plain.links.github).toBeUndefined();
  });

  it('el sello de otra persona se lee, pero de solo lectura', async () => {
    const others = await repositories.profiles.list();
    for (const other of others) {
      expect(
        other.githubVerification === null || typeof other.githubVerification.handle === 'string'
      ).toBe(true);
    }
  });
});
```

`canLinkIdentityWithoutBrowser` es un flag nuevo del objeto de capacidades que `repositories.contract.ts` ya recibe de cada backend (mira cómo se declara el del reloj simulado y sigue ese patrón exacto). El mock lo pone `true`; el backend de Supabase, `false`, con el motivo escrito: **un OAuth real necesita un navegador y un humano**.

- [ ] **Step 6: Verlo fallar**

Run: `npx jest src/data/`
Expected: FAIL — `verifyGithub is not a function` en el mock, más los errores de tipo del Step 2.

- [ ] **Step 7: Commit**

```bash
git add src/data/types.ts src/data/repositories.ts src/data/repositories.contract.ts src/data/test-fixtures.ts
git commit -m "feat(verificacion): dominio y contrato del sello de GitHub"
```

---

### Task 3: El mock

**Files:**
- Modify: `src/data/mock/index.ts`, `src/data/mock/seed.ts`, `src/data/mock/store.ts`
- Test: `src/data/mock/index.test.ts`, `src/data/mock/seed.test.ts`

**Interfaces:**
- Consumes: `GithubVerification`, `Profile.githubVerification`, los dos métodos de la Tarea 2.
- Produces: el mock cumpliendo el contrato entero, incluidos los dos casos `itIfLinkable`.

- [ ] **Step 1: El test que falla (y la trampa de esta tarea)**

En `src/data/mock/index.test.ts`:

```ts
it('saveCurrent conserva el sello: no viene del input y no se puede perder', async () => {
  // `saveCurrent` hace `...input`, y `ProfileInput` no tiene el sello. Sin
  // preservarlo a mano, cada edición del perfil desverificaría al usuario.
  await repositories.profiles.saveCurrent(buildProfileInput());
  await repositories.profiles.verifyGithub();

  const edited = await repositories.profiles.saveCurrent({
    ...buildProfileInput(),
    name: 'Otro Nombre',
  });

  expect(edited.githubVerification).not.toBeNull();
});
```

- [ ] **Step 2: Verlo fallar**

Run: `npx jest src/data/mock/index.test.ts`
Expected: FAIL — `githubVerification` es `null` tras editar, o `undefined`.

- [ ] **Step 3: Implementar en `src/data/mock/index.ts`**

En `saveCurrent`, el objeto `profile` lleva ahora, después de `createdAt`/`updatedAt`:

```ts
      // NO sale de `input` — `ProfileInput` no lo tiene, y ese es el diseño.
      // Se hereda del perfil que ya estaba: editar la ficha no desverifica.
      githubVerification: existing?.githubVerification ?? null,
```

y los dos métodos nuevos:

```ts
  /**
   * Simulación, NO una verificación. No habla con GitHub: inventa un handle a
   * partir del nombre para que las pantallas tengan los dos estados que pintar
   * sin credenciales. El sello real solo lo puede encender Postgres, en
   * `src/data/supabase/`. Mismo espíritu que el aviso de `store.ts` sobre que
   * el MVP no promete persistencia.
   */
  async verifyGithub() {
    const state = getState();
    const existing = currentProfile();
    if (!existing) throw new Error('No hay perfil que verificar todavía.');

    const handle = existing.name.trim().toLowerCase().split(/\s+/)[0] || 'usuario';
    const profile: Profile = {
      ...existing,
      links: { ...existing.links, github: `https://github.com/${handle}` },
      githubVerification: {
        handle,
        verifiedAt: existing.githubVerification?.verifiedAt ?? nowIso(),
      },
    };

    state.profiles.set(profile.id, profile);
    return profile;
  },

  async unverifyGithub() {
    const state = getState();
    const existing = currentProfile();
    if (!existing) throw new Error('No hay perfil que desverificar todavía.');

    const links = { ...existing.links };
    delete links.github;

    const profile: Profile = { ...existing, links, githubVerification: null };
    state.profiles.set(profile.id, profile);
    return profile;
  },
```

Ojo con `verifiedAt`: se conserva si ya existía, igual que hará el `coalesce` del SQL. Reverificar no rejuvenece un sello.

- [ ] **Step 4: Dos perfiles del seed nacen verificados**

En `src/data/mock/seed.ts`, a **dos** de los ocho perfiles (elige uno con `dev` entre sus especialidades y otro que no, para que las pantallas enseñen que el sello no es cosa solo de programadores):

```ts
    githubVerification: { handle: 'nuriabosch', verifiedAt: '2026-08-01T10:00:00.000Z' },
```

con su `links.github` puesto a `https://github.com/<handle>` para que cuadren. A los otros seis, `githubVerification: null`.

- [ ] **Step 5: Fijar la coherencia del seed con un test**

En `src/data/mock/seed.test.ts`:

```ts
it('todo perfil verificado del seed tiene su enlace derivado del handle', () => {
  for (const profile of SEED_PROFILES) {
    if (!profile.githubVerification) continue;
    expect(profile.links.github).toBe(`https://github.com/${profile.githubVerification.handle}`);
  }
});

it('el seed tiene perfiles de los dos estados', () => {
  expect(SEED_PROFILES.some((p) => p.githubVerification)).toBe(true);
  expect(SEED_PROFILES.some((p) => !p.githubVerification)).toBe(true);
});
```

- [ ] **Step 6: Verde, contrato incluido**

Run: `npx jest src/data/ && npx tsc --noEmit`
Expected: PASS. Los cinco casos de contrato pasan contra el mock, ninguno saltado.

- [ ] **Step 7: Commit**

```bash
git add src/data/mock/
git commit -m "feat(verificacion): sello simulado en el backend mock"
```

---

### Task 4: Migración SQL y cobertura en PGlite

La tarea con más valor de seguridad del plan. Su test central no es que el sello se encienda: es que **no se pueda encender a mano**.

**Files:**
- Create: `supabase/migrations/20260916000100_github_verification.sql`
- Modify: `supabase/schema-embedded.test.mjs`, `supabase/seed.sql`, `supabase/drift-check.mjs`

**Interfaces:**
- Consumes: nada de las tareas anteriores (el SQL es independiente).
- Produces: columnas `profiles.github_handle` y `profiles.github_verified_at`; RPC `public.sync_github_verification()` sin parámetros. La Tarea 5 las consume.

- [ ] **Step 1: `auth.identities` en el fixture de PGlite**

Sin esto la migración ni siquiera se ejecuta: el fixture de `schema-embedded.test.mjs` crea `auth.users` y `auth.uid()`, pero **no `auth.identities`**, y la función nueva la lee. En el `db.exec` del fixture, junto a `create table auth.users`:

```sql
      create table auth.identities (
        provider_id text not null,
        user_id uuid not null,
        identity_data jsonb not null,
        provider text not null,
        primary key (provider, provider_id)
      );
```

- [ ] **Step 2: Escribir la migración**

`supabase/migrations/20260916000100_github_verification.sql`, con cabecera al estilo de `20260915000200_match_streaks.sql`:

```sql
-- LockIn — verificación de autoría de GitHub (Fase 3).
--
-- Diseño: docs/superpowers/specs/2026-09-16-verificacion-github-design.md.
--
-- El punto entero de este archivo es que el sello NO lo pueda escribir el
-- cliente. La política "profiles: solo editas el tuyo" de
-- `20260905000400_rls_policies.sql` es de FILA: deja a cada usuario escribir
-- cualquier columna de la suya. Si el sello fuera una columna normal, un
-- `update profiles set github_verified_at = now()` con la clave anon —que viaja
-- en el bundle, y así debe ser— lo encendería sin pasar por GitHub.
--
-- Por eso hacen falta las dos piezas de abajo, y ninguna sobra:
--   * `revoke update (...)` — permiso DE COLUMNA, que RLS no sabe expresar.
--   * una función SECURITY DEFINER SIN PARÁMETROS, propiedad de postgres, que
--     no acepta el resultado del cliente sino que lo lee de auth.identities.
--
-- Si alguna vez le añades un parámetro a esa función, has reabierto el agujero.

alter table public.profiles
  add column github_handle text,
  add column github_verified_at timestamptz;

-- Las dos van juntas o ninguna: un sello a medias no debe poder existir.
alter table public.profiles
  add constraint profiles_github_verification_complete
  check (num_nonnulls(github_handle, github_verified_at) <> 1);

-- Con sello, el enlace ES el de la identidad. Hace la discrepancia
-- irrepresentable en vez de vigilarla: sin esto, quien está verificado podría
-- quedarse el sello y apuntar `link_github` a la cuenta de otro, que es el
-- ataque original entrando por la ventana.
alter table public.profiles
  add constraint profiles_github_link_matches_handle
  check (
    github_handle is null
    or link_github = 'https://github.com/' || github_handle
  );

-- **Ojo con la forma**: `revoke update (col, col) … from authenticated` es un
-- NO-OP, porque Postgres ignora la revocación de columna cuando el rol tiene el
-- privilegio de TABLA, y `authenticated` lo tiene (huella del despliegue:
-- `grant profiles authenticated UPDATE`). Hay que quitar el privilegio ancho y
-- devolverlo columna a columna, dejando fuera solo las dos del sello. `insert`
-- se cierra igual que `update` porque el perfil se crea con `.upsert()`.
-- `link_github` SÍ se concede: sin sello es un campo del formulario.
revoke insert, update on public.profiles from authenticated;
grant insert (/* todas las columnas menos las dos del sello */)
  on public.profiles to authenticated;
grant update (/* todas las columnas menos las dos del sello */)
  on public.profiles to authenticated;


create or replace function public.sync_github_verification()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_handle text;
begin
  select i.identity_data ->> 'user_name'
    into v_handle
    from auth.identities i
   where i.user_id = (select auth.uid())
     and i.provider = 'github'
   limit 1;

  if v_handle is null or v_handle = '' then
    update public.profiles
       set github_handle = null,
           github_verified_at = null,
           link_github = null
     where id = (select auth.uid());
  else
    -- `coalesce`: resincronizar no rejuvenece un sello que ya existía.
    update public.profiles
       set github_handle = v_handle,
           github_verified_at = coalesce(github_verified_at, now()),
           link_github = 'https://github.com/' || v_handle
     where id = (select auth.uid());
  end if;
end;
$fn$;

revoke execute on function public.sync_github_verification() from public, anon;
grant execute on function public.sync_github_verification() to authenticated;
```

- [ ] **Step 3: El test que de verdad importa**

En `supabase/schema-embedded.test.mjs`, dentro del bloque de mutaciones (el que ya sustituye `auth.uid()` por un usuario concreto dentro de una transacción con rollback), añade:

```js
    // --- Verificación de GitHub -------------------------------------------
    // El test central del bloque: el sello NO se puede encender a mano.
    await db.exec('begin');
    await db.exec(
      `create or replace function auth.uid() returns uuid language sql as $$ select '${ana}'::uuid $$;`
    );
    await db.exec('set local role authenticated');

    await assert.rejects(
      () => db.exec(`update public.profiles set github_verified_at = now() where id = '${ana}';`),
      /permission denied|no privileges/i,
      'authenticated no debe poder encenderse el sello a mano'
    );

    await assert.rejects(
      () => db.exec(`update public.profiles set github_handle = 'torvalds' where id = '${ana}';`),
      /permission denied|no privileges/i,
      'authenticated no debe poder escribir el handle a mano'
    );

    // Pero el enlace sin sello SÍ se escribe: es un campo del formulario.
    await db.exec(
      `update public.profiles set link_github = 'https://github.com/loquesea' where id = '${ana}';`
    );

    await db.exec('reset role');

    // Con identidad, la función enciende el sello y deriva el enlace.
    await db.exec(`insert into auth.identities (provider_id, user_id, identity_data, provider)
      values ('12345', '${ana}', '{"user_name":"anagarcia"}'::jsonb, 'github');`);
    await db.exec('select public.sync_github_verification();');

    const sello = await db.query(
      `select github_handle, github_verified_at, link_github from public.profiles where id = '${ana}';`
    );
    assert.equal(sello.rows[0].github_handle, 'anagarcia');
    assert.equal(sello.rows[0].link_github, 'https://github.com/anagarcia');
    assert.ok(sello.rows[0].github_verified_at, 'la fecha debe quedar puesta');

    // Y sin identidad, lo apaga: un solo camino de escritura para las dos cosas.
    await db.exec(`delete from auth.identities where user_id = '${ana}';`);
    await db.exec('select public.sync_github_verification();');

    const apagado = await db.query(
      `select github_handle, github_verified_at, link_github from public.profiles where id = '${ana}';`
    );
    assert.equal(apagado.rows[0].github_handle, null);
    assert.equal(apagado.rows[0].github_verified_at, null);
    assert.equal(apagado.rows[0].link_github, null);

    // Un sello a medias no debe poder existir ni desde postgres.
    await assert.rejects(
      () =>
        db.exec(
          `update public.profiles set github_handle = 'solo-handle' where id = '${ana}';`
        ),
      /profiles_github_verification_complete|profiles_github_link_matches_handle/i,
      'el sello no puede quedar a medias'
    );

    await db.exec('rollback');
```

Ajusta `ana` al nombre de variable que ya use ese bloque para el UUID del usuario simulado.

- [ ] **Step 4: Correrlo**

Run: `npm run test:schema`
Expected: PASS, y la huella del esquema cambia (objetos nuevos). Si el test de huella falla por eso, regenera la referencia por el camino que ya documenta `supabase/README.md`, no editándola a mano.

- [ ] **Step 5: Enseñar a `drift-check.mjs` lo nuevo**

`drift-check.mjs` parsea el SQL para cotejar contra el proyecto real. Hoy entiende `create table` y `alter table … add column` (esto último hubo que enseñárselo para `seeking_specialties`; sin ello era ciego a la columna). Ahora necesita también `alter table … add constraint` y `revoke update (col, col) on … from …`.

Este es el falso negativo más caro posible del repo: si el cotejo no ve el `revoke`, el job `Schema drift` saldría **verde** con el permiso abierto en producción, o sea con el sello falsificable y nadie mirando. Añade las dos reglas y un caso a su test.

- [ ] **Step 6: El seed**

En `supabase/seed.sql`, a los dos mismos perfiles que elegiste en la Tarea 3, `github_handle` y `github_verified_at` escritos a pelo, con su `link_github` coherente (si no, salta la constraint nueva). Es un seed de desarrollo y ahí sí se escribe la columna directamente.

- [ ] **Step 7: Verde entero y commit**

Run: `npm run test:schema`
Expected: PASS.

```bash
git add supabase/migrations/20260916000100_github_verification.sql supabase/schema-embedded.test.mjs supabase/drift-check.mjs supabase/seed.sql
git commit -m "feat(verificacion): migración del sello, con el permiso de columna que lo protege"
```

---

### Task 5: El repositorio de Supabase

**Files:**
- Modify: `src/data/supabase/database.types.ts`, `src/data/supabase/mappers.ts`, `src/data/supabase/index.ts`, `src/data/supabase/auth.ts`
- Test: `src/data/supabase/mappers.test.ts`, `src/data/supabase/auth.test.ts`

**Interfaces:**
- Consumes: `flowType: 'pkce'` (Tarea 1), los dos métodos del contrato (Tarea 2), la RPC `sync_github_verification` (Tarea 4).
- Produces: `verifyGithub()` y `unverifyGithub()` reales. La Tarea 6 los llama desde la pantalla.

- [ ] **Step 1: Tipos de fila**

En `database.types.ts`, a `ProfileRow` (y a `ProfileInsert` **no**, que el cliente no los escribe):

```ts
      github_handle: string | null;
      github_verified_at: string | null;
```

y la función a la sección de `Functions`:

```ts
      sync_github_verification: {
        Args: Record<string, never>;
        Returns: undefined;
      };
```

- [ ] **Step 2: El test del mapeo**

En `src/data/supabase/mappers.test.ts`:

```ts
it('mapea el sello cuando las dos columnas vienen puestas', () => {
  const profile = toProfile({
    ...buildProfileRow(),
    github_handle: 'anagarcia',
    github_verified_at: '2026-09-16T10:00:00.000Z',
    link_github: 'https://github.com/anagarcia',
  });

  expect(profile.githubVerification).toEqual({
    handle: 'anagarcia',
    verifiedAt: '2026-09-16T10:00:00.000Z',
  });
});

it('sin columnas, el perfil no está verificado', () => {
  const profile = toProfile({
    ...buildProfileRow(),
    github_handle: null,
    github_verified_at: null,
  });

  expect(profile.githubVerification).toBeNull();
});
```

- [ ] **Step 3: Verlo fallar, luego mapear**

Run: `npx jest src/data/supabase/mappers.test.ts` → FAIL.

En `mappers.ts`, junto a `toLinks`:

```ts
/**
 * Las dos columnas van juntas o ninguna (lo fija la constraint
 * `profiles_github_verification_complete`). Se exigen las dos igualmente: una
 * fila a medias sería un sello sin fecha, y preferimos leerlo como «no
 * verificado» antes que pintar medio sello.
 */
function toGithubVerification(row: ProfileRow): GithubVerification | null {
  if (!row.github_handle || !row.github_verified_at) return null;
  return { handle: row.github_handle, verifiedAt: row.github_verified_at };
}
```

y en `toProfile`, después de `links`: `githubVerification: toGithubVerification(row),`.

- [ ] **Step 4: El link de identidad en `auth.ts`**

Dos funciones nuevas, con el mismo tono de las que ya hay (que nombran el ajuste del dashboard cuando falla — «Anonymous sign-ins», «Confirm email»):

```ts
/**
 * Abre GitHub en el navegador del sistema y linka esa identidad a la cuenta
 * actual, conservando perfil, matches y mensajes: el `auth.uid()` no cambia.
 *
 * Requiere "Enable Manual Linking" en Authentication → Settings del dashboard.
 * Está DESACTIVADO por defecto y sin él esto falla siempre, así que el error lo
 * dice por su nombre en vez de propagar el mensaje crudo del servidor.
 *
 * @returns `true` si el usuario completó el flujo; `false` si lo canceló.
 */
export async function linkGithubIdentity(): Promise<boolean> {
  const client = getSupabaseClient();
  const redirectTo = Linking.createURL('/auth/callback');

  const { data, error } = await client.auth.linkIdentity({
    provider: 'github',
    options: { redirectTo, skipBrowserRedirect: true },
  });

  if (error) {
    if (/manual linking/i.test(error.message)) {
      throw new Error(
        'Falta activar "Enable Manual Linking" en Authentication → Settings del ' +
          'dashboard de Supabase: sin él no se puede verificar GitHub.'
      );
    }
    if (/already/i.test(error.message)) {
      throw new Error('Esa cuenta de GitHub ya está verificada en otro perfil de LockIn.');
    }
    throw error;
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return false;

  await completeOAuthCallback(result.url);
  return true;
}

/** Desvincula la identidad de GitHub de la cuenta actual. */
export async function unlinkGithubIdentity(): Promise<void> {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.getUserIdentities();
  if (error) throw error;

  const github = data.identities.find((identity) => identity.provider === 'github');
  if (!github) return;

  const { error: unlinkError } = await client.auth.unlinkIdentity(github);
  if (unlinkError) throw unlinkError;
}
```

`completeOAuthCallback(url)` es el canje que confirmaste en la Tarea 1. **Escríbelo como lo confirmaste ahí, no como lo recuerdes**: si el SDK ya resuelve el `code`, esta función se reduce a nada y lo dices en un comentario; si hay que canjearlo, extrae `code` de la URL y llama a `exchangeCodeForSession`.

- [ ] **Step 5: Los dos métodos del repositorio**

En `src/data/supabase/index.ts`, dentro del objeto `profiles`:

```ts
  async verifyGithub() {
    const completed = await linkGithubIdentity();
    if (!completed) throw new Error('Verificación cancelada.');

    // La verdad la escribe Postgres leyendo auth.identities. Aquí no viaja
    // ningún handle: si viajara, sería falsificable.
    const { error } = await getSupabaseClient().rpc('sync_github_verification');
    if (error) throw error;

    const profile = await profiles.getCurrent();
    if (!profile) throw new Error('No hay perfil que verificar todavía.');
    return profile;
  },

  async unverifyGithub() {
    await unlinkGithubIdentity();

    const { error } = await getSupabaseClient().rpc('sync_github_verification');
    if (error) throw error;

    const profile = await profiles.getCurrent();
    if (!profile) throw new Error('No hay perfil que desverificar todavía.');
    return profile;
  },
```

- [ ] **Step 6: Declarar la capacidad del contrato**

Donde el backend de Supabase declara sus capacidades para `repositories.contract.ts`, `canLinkIdentityWithoutBrowser: false`, con el motivo en un comentario: un OAuth real necesita navegador y humano, así que esos dos casos se saltan aquí y se cierran a mano en la Tarea 8.

- [ ] **Step 7: Verde y commit**

Run: `npx jest src/data/ && npx tsc --noEmit && npm run lint`
Expected: PASS las tres.

```bash
git add src/data/supabase/
git commit -m "feat(verificacion): verificación real contra Supabase e identidades de GitHub"
```

---

### Task 6: La pantalla de perfil propio (cruce con `perfil`)

**Files:**
- Modify: `src/features/profile/` (la ficha propia y el formulario), `src/app/(tabs)/profile.tsx`
- Test: los `.test.tsx` vecinos de esos archivos

**Interfaces:**
- Consumes: `verifyGithub()`, `unverifyGithub()`, `Profile.githubVerification`.
- Produces: el único punto de la app con acción de verificar. La Tarea 7 solo muestra.

- [ ] **Step 1: Los tests que fallan**

```tsx
it('sin sello, ofrece verificar', () => {
  renderOwnProfile({ ...buildProfile(), githubVerification: null });
  expect(screen.getByText('Verificar con GitHub')).toBeTruthy();
});

it('con sello, lo anuncia y ofrece quitarlo', () => {
  renderOwnProfile({
    ...buildProfile(),
    links: { github: 'https://github.com/anagarcia' },
    githubVerification: { handle: 'anagarcia', verifiedAt: '2026-09-16T10:00:00.000Z' },
  });

  // No puede ser solo un icono: sin label, un lector de pantalla no lo lee.
  expect(screen.getByLabelText('GitHub verificado: anagarcia')).toBeTruthy();
  expect(screen.getByText('Quitar verificación')).toBeTruthy();
});

it('avisa antes de sobrescribir un enlace escrito a mano', async () => {
  renderOwnProfile({
    ...buildProfile(),
    links: { github: 'https://github.com/otracosa' },
    githubVerification: null,
  });

  fireEvent.press(screen.getByText('Verificar con GitHub'));

  // En la pantalla, no en un diálogo del sistema: un modal bloqueante deja la
  // app sin responder a nada más.
  expect(await screen.findByText(/otracosa/)).toBeTruthy();
  expect(verifyGithub).not.toHaveBeenCalled();
});

it('con sello, el campo de GitHub no se puede editar', () => {
  renderProfileForm({
    ...buildProfile(),
    links: { github: 'https://github.com/anagarcia' },
    githubVerification: { handle: 'anagarcia', verifiedAt: '2026-09-16T10:00:00.000Z' },
  });

  expect(screen.getByLabelText('GitHub')).toBeDisabled();
});

it('cancelar en GitHub no es un error', async () => {
  (verifyGithub as jest.Mock).mockRejectedValue(new Error('Verificación cancelada.'));
  renderOwnProfile({ ...buildProfile(), githubVerification: null });

  fireEvent.press(screen.getByText('Verificar con GitHub'));

  expect(await screen.findByText(/no se completó/i)).toBeTruthy();
  expect(screen.queryByText(/error/i)).toBeNull();
});
```

- [ ] **Step 2: Verlos fallar**

Run: `npx jest src/features/profile/`
Expected: FAIL en los cinco.

- [ ] **Step 3: Implementar**

Sigue los componentes y tokens que `perfil` ya usa — no estrenes un sistema de botones ni un color. El sello en `brass`; el campo deshabilitado con el mismo estilo que el resto del formulario usa para lo no editable. El aviso de sobrescritura se pinta en la propia pantalla, con las dos URLs a la vista y un botón de continuar.

- [ ] **Step 4: Resincronizar al abrir el perfil propio**

Caso límite de la spec que no cubre ninguna otra tarea: **si el usuario cambia
su nombre de usuario en GitHub**, el sello queda apuntando al viejo. Se
resincroniza al abrir el perfil propio — ahí y no en cada arranque, que sería
una llamada de red en el camino crítico de inicio para un caso raro.

El test primero:

```tsx
it('al abrir el perfil propio, resincroniza el sello', async () => {
  renderOwnProfile({
    ...buildProfile(),
    githubVerification: { handle: 'viejo', verifiedAt: '2026-08-01T10:00:00.000Z' },
  });

  await waitFor(() => expect(syncGithubVerification).toHaveBeenCalled());
});

it('no resincroniza si no hay sello que refrescar', async () => {
  renderOwnProfile({ ...buildProfile(), githubVerification: null });

  await waitFor(() => expect(syncGithubVerification).not.toHaveBeenCalled());
});
```

Necesita un tercer método de solo lectura en `ProfileRepository` — añádelo al
contrato aquí, no en la Tarea 2, porque es esta pantalla la que lo justifica:

```ts
  /**
   * Relee el sello del proveedor y actualiza el perfil propio si cambió (p. ej.
   * el usuario se renombró en GitHub). No abre navegador ni pide nada al
   * usuario: solo sincroniza lo que ya está linkado. Devuelve el perfil.
   */
  refreshGithubVerification(): Promise<Profile>;
```

En Supabase es la RPC a secas más releer el perfil; en el mock, devolver el
perfil tal cual (no hay proveedor del que releer nada) con un comentario que lo
diga. Añade también el caso al contrato: llamarlo sin sello no lo enciende.

- [ ] **Step 5: Verde**

Run: `npx jest src/features/profile/ src/app/ src/data/`
Expected: PASS.

- [ ] **Step 6: Contraste**

Run: `npx jest src/constants/theme.test.ts`
Expected: PASS con `KNOWN_GAPS` vacío. Si el par del sello no llega a AA, **no lo añadas a `KNOWN_GAPS`**: cambia el tono. Esa lista se vació a propósito el 2026-09-06 y volver a llenarla es deshacer trabajo cerrado.

- [ ] **Step 7: Commit**

```bash
git add src/features/profile/ src/app/\(tabs\)/profile.tsx
git commit -m "feat(verificacion): verificar y quitar el sello desde el perfil propio"
```

---

### Task 7: El sello en la ficha y en el deck (cruce con `descubrir`)

**Files:**
- Modify: `src/features/profile/profile-details.tsx` (o donde viva `ProfileDetails`), `src/features/discover/` (la tarjeta)
- Test: los `.test.tsx` vecinos

**Interfaces:**
- Consumes: `Profile.githubVerification`.
- Produces: nada que consuma nadie. Es la última pieza de producto.

- [ ] **Step 1: Los tests que fallan**

```tsx
it('la tarjeta enseña el sello de quien lo tiene', () => {
  render(
    <ProfileCard
      profile={{
        ...buildProfile(),
        githubVerification: { handle: 'anagarcia', verifiedAt: '2026-09-16T10:00:00.000Z' },
      }}
    />
  );
  expect(screen.getByLabelText('GitHub verificado: anagarcia')).toBeTruthy();
});

it('sin sello, la tarjeta no dice nada: no hay marca de "sin verificar"', () => {
  render(<ProfileCard profile={{ ...buildProfile(), githubVerification: null }} />);
  expect(screen.queryByLabelText(/GitHub verificado/)).toBeNull();
  // Marcar lo NO verificado castiga a las nueve especialidades que no tienen
  // GitHub, y es filtrar por profesión por la puerta del copy. Ver la spec.
  expect(screen.queryByText(/sin verificar/i)).toBeNull();
});

it('el deck no cambia de orden ni de contenido por el sello', async () => {
  // Es señal, no puerta. Mismo precedente que la complementariedad.
  const conSello = await repositories.discovery.getDeck();
  // ...verifica a uno de los candidatos y recarga...
  const despues = await repositories.discovery.getDeck();
  expect(despues.map((p) => p.id)).toEqual(conSello.map((p) => p.id));
});
```

- [ ] **Step 2: Verlos fallar, implementar, verde**

Run: `npx jest src/features/discover/ src/features/profile/`
Expected: FAIL primero, PASS después. El sello en la tarjeta va pequeño, junto al nombre; en `ProfileDetails`, junto al enlace.

- [ ] **Step 3: Commit**

```bash
git add src/features/discover/ src/features/profile/
git commit -m "feat(verificacion): sello visible en la ficha y en la tarjeta del deck"
```

---

### Task 8: Verificación final y cierre

**Files:**
- Create: `docs/plan/todo/verificacion.md`
- Modify: `docs/plan/PLAN.md`, `docs/plan/TODO.md`

- [ ] **Step 1: La suite entera**

```bash
npx tsc --noEmit
npm run lint
npm test
npm run test:schema
npx expo export --platform web
```

Expected: las cinco verdes. Cobertura por encima de 89.82/82.56/91.49/91.38. Si `expo export` se rompe: el flujo es de navegador y no usa módulo nativo, así que **no** hace falta ningún `.web.ts` — si lo necesitas, algo se importó mal y eso es el bug.

- [ ] **Step 2: Formato, con el cuidado de esta máquina**

```bash
npx prettier --write <solo los archivos que tocaste>
```

No corras `npm run format:check` para juzgar: aquí da ~100 falsos por CRLF. El veredicto se lee del job «Formato» en CI.

- [ ] **Step 3: El bloque 11 en `PLAN.md`**

Sección `### 11. verificacion — Verificación de autoría de enlaces (Fase 3)`, con: qué entrega, la tabla de archivos y a quién pisa (cópiala de la spec), que **no se lanza a la vez que `perfil`, `descubrir` ni `datos`**, y que Fase 3 son tres sub-proyectos de los que este es el primero.

- [ ] **Step 4: `docs/plan/todo/verificacion.md`**

Con el formato de los demás: una casilla por tarea, marcada con su evidencia. Y una sección **«Pendiente del usuario»** con las cuatro que ningún agente puede cerrar:

```markdown
## Pendiente del usuario

- [ ] Crear una GitHub OAuth App y poner client ID y secret en
      Authentication → Providers → GitHub del dashboard de Supabase.
- [ ] Activar **Enable Manual Linking** en Authentication → Settings. Está
      desactivado por defecto y sin él `linkIdentity()` falla siempre.
- [ ] Aplicar `20260916000100_github_verification.sql` en
      `grrzmzktrhksbttpbblg` por el SQL Editor.
- [ ] Verificar el flujo en un dispositivo con el dev client de EAS: el OAuth
      necesita un navegador de verdad y un deep link de vuelta.
```

- [ ] **Step 5: El aviso del rojo esperado**

En `todo/verificacion.md` y en la línea de `TODO.md`, escribe esto donde se vea:

> Hasta que la migración se aplique en el proyecto real, el job remoto de
> `Schema drift` **debe salir rojo**, y eso no es deriva: es esta migración
> esperando. Es la única vez que un rojo ahí es el estado correcto. En cuanto
> se aplique, vuelve a ser deriva real.

Esto contradice temporalmente lo que dice `TODO.md` desde el 2026-09-13 («desde aquí, un rojo del job remoto es deriva real»), y por eso se escribe explícitamente en vez de dejar que alguien lo descubra con un rojo confuso.

- [ ] **Step 6: Commit y empuje**

```bash
git add docs/plan/PLAN.md docs/plan/TODO.md docs/plan/todo/verificacion.md
git commit -m "docs(verificacion): cierra el bloque y abre Fase 3 en el plan"
git push
```

- [ ] **Step 7: El veredicto real está en Actions**

Espera a `CI` y `E2E Android` sobre el commit empujado y anota los números de run en `todo/verificacion.md`. Una pasada local no es el veredicto: lo aprendió este repo a base de tres commits con CI rojo que nadie miró porque «en local iba».
