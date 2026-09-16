# Verificación de autoría de enlaces (GitHub) — diseño

> Fase 3, primer sub-proyecto. Spec escrita el 2026-09-16.
>
> Bloque: `verificacion` (bloque 11 de `docs/plan/PLAN.md`).
> Plan de implementación: `docs/superpowers/plans/2026-09-16-verificacion-github.md`.
> Checklist: `docs/plan/todo/verificacion.md`.

## Contexto

`CONCEPTO.md` deja Fase 3 escrita como una línea de tres palabras: «Salas
grupales, verificación, plantillas de acuerdo entre cofundadores». Son tres
subsistemas independientes, no una feature, y esta spec cubre **solo el
segundo**, que es además el único de los tres que no toca nada de Fase 2.

El perfil de hoy tiene esto (`src/data/types.ts`):

```ts
export interface ProfileLinks {
  github?: string;
  portfolio?: string;
  linkedin?: string;
}
```

y en Postgres (`20260905000200_profiles_and_settings.sql`) son tres columnas
`text` con un `check` que solo exige que empiecen por `http://` o `https://`:

```sql
link_github text check (link_github is null or link_github ~* '^https?://'),
```

O sea: **texto libre sin comprobar**. Cualquiera puede escribir el GitHub de
otra persona en su propio perfil, y hoy la app lo pinta igual que si fuera
suyo. En un producto donde el match es «monta una empresa conmigo», ese enlace
es la única evidencia comprobable que hay en toda la ficha — todo lo demás
(especialidades, ambición, punto de partida) es autodeclarado y no se puede
verificar ni en principio.

## Qué problema resuelve, y cuál no

**Resuelve**: que el enlace que enseñas sea tuyo. Después de verificar, el
sello dice exactamente «esta cuenta de GitHub pertenece a quien controla este
perfil», ni una palabra más.

**No resuelve**, y conviene decirlo antes de que alguien lo lea de más:

- **No dice que la persona sea buena.** Un GitHub verificado y vacío sigue
  siendo un GitHub vacío. El sello certifica autoría, no competencia.
- **No dice que sea una persona real.** GitHub no exige identidad; una cuenta
  se abre con un email desechable. Un sello de GitHub no es un antifraude.
- **No dice que se llame como dice.** Nombre, edad y ubicación siguen siendo
  autodeclarados y esta spec no los toca.
- **No es identidad legal.** Eso era la cuarta opción del abanico y se
  descartó: proveedor externo de pago, y documento de identidad (y según el
  método, biometría) es categoría especial bajo GDPR — implica política de
  retención y encargado de tratamiento, no solo código.

Si algún día el copy del sello dice más que «este GitHub es suyo», el sello
está mintiendo. Está escrito aquí para que se pueda citar en la revisión.

## Decisiones tomadas

1. **Solo GitHub en v1.** LinkedIn queda fuera por una razón técnica, no por
   preferencia — ver abajo. Portfolio queda fuera por coste.
2. **La verificación se enciende linkando una identidad OAuth real** a la
   cuenta de Supabase que ya tiene el usuario, con `linkIdentity()`.
3. **El cliente nunca declara su propia verificación.** La verdad se deriva en
   el servidor de `auth.identities`, y las columnas del sello están fuera del
   alcance de escritura del rol `authenticated`.
4. **Al verificar, el handle deja de ser editable** y pasa a derivarse de la
   identidad. Es lo que elimina la clase entera de «verifico como `alice` pero
   enseño `torvalds`».
5. **El sello es señal, no puerta.** No filtra el deck, no condiciona el match,
   no ordena las tarjetas.
6. **Se puede quitar.** Desverificar es un derecho, no un caso límite.

### Por qué GitHub sí y LinkedIn no

No es que LinkedIn sea menos útil: es que **no se puede verificar con OIDC**.
El `profile` scope de Sign In with LinkedIn devuelve `sub`, nombre y foto; el
`vanityName` —lo que forma `linkedin.com/in/<vanityName>`, o sea justo lo que
el usuario escribe en su perfil de LockIn— vive en la Profile API y no sale
del OIDC estándar ([Sign In with LinkedIn v2][li-oidc], [Profile API][li-profile]).

Sin `vanityName` podríamos saber que *alguien* entró con *una* cuenta de
LinkedIn, pero no que sea **la del enlace que enseña**. Un sello así no
distingue al honesto del que pega la URL de otro, que es exactamente el ataque
que queremos cerrar. Un sello que no cierra su ataque es peor que ninguno,
porque el usuario le da crédito.

GitHub no tiene ese problema: su identidad trae el `user_name`, y
`github.com/<user_name>` **es** la URL del perfil. La comparación es total.

### Por qué el portfolio queda fuera de v1

Un dominio propio se verifica bien y sin proveedor: un registro `TXT` en el DNS
o un archivo en `/.well-known/`, comprobado desde el servidor. El problema es
el «desde el servidor»: hoy este repo **no tiene un solo trozo de backend
propio** — ni Edge Functions, ni servidor, ni un secreto fuera del dashboard.
Todo se resuelve con RLS y funciones `SECURITY DEFINER` en Postgres, y Postgres
no puede resolver DNS ni hacer una petición HTTP saliente.

Hacerlo desde el cliente no vale: el cliente es de quien lo ejecuta, y si el
cliente dice «he comprobado el TXT», el sello lo pone el atacante. Verificar
dominio significa estrenar backend, y estrenar backend no se hace de rebote
dentro de otra feature.

### Por qué la verdad se deriva en el servidor

La política RLS de hoy es esta:

```sql
create policy "profiles: solo editas el tuyo"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
```

Es correcta para lo que existe hoy, pero es **de fila, no de columna**: deja a
cada usuario escribir cualquier columna de su propia fila. Si el sello fuera
una columna más, `update profiles set github_verified_at = now()` desde la
clave `anon` con una sesión normal lo encendería sin pasar por GitHub. Y la
clave `anon` viaja en el bundle, como dice `client.ts` — no hay nada que
esconder ahí.

De ahí las dos piezas que sí cierran esto:

- `revoke update (link_github, github_verified_at) on public.profiles from
  authenticated;` — permiso **de columna**, que RLS no sabe expresar y los
  `GRANT` de Postgres sí.
- Una función `SECURITY DEFINER` propiedad de `postgres`, que es quien sí puede
  escribirlas, y que no acepta el valor del cliente: lo **lee** de
  `auth.identities`.

El cliente puede pedir «sincroniza mi verificación». No puede decir cuál es el
resultado. Es la misma forma que ya tienen `record_decision()` y
`match_streaks()`: el actor va dentro de la función, no delegado en las
políticas.

### Por qué el handle se deriva y no se compara

La alternativa era dejar `link_github` editable y encender el sello solo cuando
coincida con la identidad. Se descartó: obliga a mantener una comparación de
URLs de GitHub (`github.com/alice`, `www.github.com/alice/`, `GitHub.com/Alice`,
con `.git`, con query string…) cuya normalización es un nido de casos límite, y
cada agujero de esa normalización es un sello falso.

Derivar es más corto y no tiene agujeros: al verificar, `link_github` pasa a ser
`https://github.com/<user_name de la identidad>`, escrito por la función. El
formulario enseña el campo deshabilitado con el sello al lado. Para cambiarlo,
desverificas.

Efecto secundario aceptado: si alguien tenía escrita a mano una URL de GitHub
distinta, verificar **se la sobrescribe**. La pantalla lo advierte antes.

### Por qué es señal y no puerta

Mismo argumento —y mismo precedente explícito— que la complementariedad de
especialidades, que ya se decidió así el 2026-09-07:

> **La lógica de matching no cambia: un match sigue siendo un like recíproco**
> — la complementariedad es señal para quien decide, no una puerta.

Un filtro de «solo verificados» parece una mejora de confianza y en realidad es
un impuesto sobre quien no tiene GitHub: alguien de ventas, de legal o de
finanzas no tiene ninguno, y `Specialty` tiene diez valores de los que uno solo
es `dev`. Filtrar por el sello sería **filtrar por profesión sin decirlo**, y
encima en un producto cuyo modo principal se llama Par y va justo de juntar
perfiles complementarios. El sello informa a quien desliza; no decide por él.

Por la misma razón el sello **no ordena el deck**: rankear por verificado es un
filtro suave con otro nombre, y tocaría `discovery_deck`, que es de `datos`.

### Por qué se puede quitar

Vincular una identidad de GitHub a una cuenta es un dato personal que el
usuario debe poder retirar sin borrar la cuenta entera. Además hay un caso
mundano y frecuente: verificaste con la cuenta de GitHub del trabajo anterior.
`unlinkIdentity()` lo deshace; la función apaga el sello y devuelve
`link_github` a editable, vacío.

## 1. Modelo y contrato

### Dominio — `src/data/types.ts` (cruce con `arquitecto`)

```ts
/**
 * Prueba de que el enlace de GitHub del perfil pertenece a quien controla la
 * cuenta. Se obtiene linkando una identidad OAuth real: el cliente no puede
 * encenderla escribiendo en su propia fila (ver la spec, "Por qué la verdad se
 * deriva en el servidor").
 *
 * Certifica autoría del enlace y NADA más — ni competencia, ni identidad
 * legal, ni que exista una persona detrás. No lo uses como antifraude ni
 * escribas copy que prometa más que eso.
 */
export interface GithubVerification {
  /** El `user_name` de la identidad. `github.com/<handle>` es su perfil. */
  handle: string;
  /** Cuándo se verificó, en ISO. */
  verifiedAt: string;
}
```

y en `Profile`:

```ts
  /** Sello de GitHub, o `null` si esta persona no lo ha verificado. */
  githubVerification: GithubVerification | null;
```

**No entra en `ProfileInput`.** Es deliberado y es la mitad del diseño: si
estuviera en el input, el formulario podría mandarlo, y todo lo de arriba sobra.
El sello solo se mueve por los dos métodos del repositorio.

### Contrato — `src/data/repositories.ts`

Dos métodos nuevos en `ProfileRepository`:

```ts
  /**
   * Abre el flujo de OAuth de GitHub y, al volver, sincroniza el sello del
   * perfil propio. Devuelve el perfil ya actualizado.
   *
   * Sobrescribe `links.github` con la URL derivada de la identidad: quien la
   * llama debe haber avisado al usuario si ya había una distinta.
   *
   * Lanza si el usuario cancela el flujo o si el proveedor lo rechaza.
   */
  verifyGithub(): Promise<Profile>;

  /** Desvincula la identidad y apaga el sello. Vacía `links.github`. */
  unverifyGithub(): Promise<Profile>;
```

Van en `ProfileRepository` y no en uno nuevo porque el resultado observable es
un `Profile` distinto, que es exactamente lo que ese repositorio ya gobierna.

### Casos de contrato — `src/data/repositories.contract.ts`

El contrato corre contra el mock **y** contra Supabase real, así que no puede
exigir un flujo de navegador. Lo que sí exige, y vale para los dos:

1. Un perfil recién creado tiene `githubVerification === null`.
2. `updateProfile` con un `ProfileInput` cualquiera **no enciende ni apaga** el
   sello (la invariante que protege todo lo demás).
3. Después de `verifyGithub()`, `links.github` es
   `https://github.com/<handle>` y `handle` coincide con el del sello.
4. `unverifyGithub()` deja `githubVerification` en `null` y `links.github` sin
   valor.
5. Los perfiles de otras personas exponen su sello de solo lectura.

Los casos 3 y 4 se saltan (`test.skip` con motivo, como los tres que ya se
saltan por reloj simulado en `contract.yml`) cuando el backend real no puede
abrir un navegador sin humano. Contra el mock corren enteros.

### Supabase — migración nueva

`supabase/migrations/20260916000100_github_verification.sql`, en el estilo de
`20260915000200_match_streaks.sql`: `SECURITY DEFINER`, `set search_path = ''`,
nombres cualificados, `revoke`/`grant` al final, y la cabecera explicando el
porqué.

Contenido:

```sql
alter table public.profiles
  add column github_handle text,
  add column github_verified_at timestamptz;

-- Las dos van juntas o ninguna: un sello a medias no debe poder existir.
alter table public.profiles
  add constraint profiles_github_verification_complete
  check (num_nonnulls(github_handle, github_verified_at) <> 1);

-- Con sello, el enlace ES el de la identidad. Hace la discrepancia
-- irrepresentable en vez de vigilarla: sin esto, quien está verificado podría
-- dejarse el sello y apuntar `link_github` a la cuenta de otro, que es el
-- ataque original entrando por la ventana.
alter table public.profiles
  add constraint profiles_github_link_matches_handle
  check (
    github_handle is null
    or link_github = 'https://github.com/' || github_handle
  );

-- Permiso DE COLUMNA. RLS es de fila y no sabe expresar esto: sin esto,
-- "profiles: solo editas el tuyo" deja a cualquiera encenderse el sello con un
-- update normal desde la clave anon.
--
-- **Ojo con la forma.** Lo intuitivo sería `revoke update (github_handle,
-- github_verified_at) … from authenticated`, y es un NO-OP: Postgres ignora la
-- revocación de un privilegio de columna cuando el rol tiene el privilegio de
-- TABLA, y `authenticated` lo tiene por los `alter default privileges` que
-- Supabase deja sobre `public` (verificado en la huella capturada del
-- despliegue: `grant profiles authenticated UPDATE`). Esa versión entraría en
-- producción PARECIENDO la protección, con el sello falsificable.
--
-- La forma que sí cierra es quitar el privilegio ancho y devolverlo columna a
-- columna, dejando fuera solo las dos del sello:
revoke insert, update on public.profiles from authenticated;

grant insert (id, name, age, /* …el resto de columnas… */ link_github)
  on public.profiles to authenticated;
grant update (id, name, age, /* …el resto de columnas… */ link_github)
  on public.profiles to authenticated;
```

`insert` se cierra igual que `update`, y no es simetría decorativa: el perfil se
crea con `.upsert()`, así que con el INSERT abierto el sello se mandaría ya
encendido en el alta.

`link_github` **sí** se concede: sin sello sigue siendo un campo del formulario
y el usuario debe poder escribirlo. Quien lo sujeta cuando sí hay sello es la
constraint de arriba, no el permiso.

El peaje de esta forma, que hay que saber antes de aceptarla: **una columna
nueva de `profiles` nacerá sin permiso de escritura para `authenticated`** hasta
que alguien la añada a las dos listas. Se paga con una guardia en los tests que
recorre las columnas reales y se pone roja si las cerradas dejan de ser
exactamente las dos del sello.

Y la función que sí puede escribirlas:

```sql
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
  -- La verdad, y el único sitio de donde puede salir. El cliente no manda
  -- ningún parámetro justamente para que no haya nada que falsificar.
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

Tres detalles que no son accidentales:

- **Sin parámetros.** Es lo que hace que no haya nada que falsificar. Un
  `p_handle text` convertiría la función en el agujero que intenta tapar.
- **`coalesce(github_verified_at, now())`** — resincronizar no rejuvenece un
  sello ya existente. Si no, cada arranque de la app movería la fecha.
- **La rama `null` apaga el sello**, así que la misma función sirve para
  verificar y para desverificar. Un solo camino de escritura, una sola cosa que
  auditar.

La columna `github_handle` se añade en lugar de reutilizar `link_github` porque
`link_github` sigue siendo editable a mano cuando **no** hay sello, y mezclar
en una columna «lo que el usuario escribió» con «lo que el servidor certificó»
es precisamente la confusión que causa sellos falsos.

Hay que enseñar a `drift-check.mjs` las `constraint` y el `revoke` de columna,
igual que en su día hubo que enseñarle `alter table … add column` para
`seeking_specialties` — si no, es ciego a ellos y el cotejo de esquema daría
verde con el permiso abierto, que es el peor falso negativo posible aquí.

## 2. El flujo de OAuth

### Lo que ya está y no hay que instalar

- `expo-web-browser` (~57.0.2) y `expo-linking` (~57.0.9) **ya son
  dependencias** del repo.
- `app.json` ya declara `"scheme": "lockin"`, así que el deep link de vuelta
  existe sin tocar el plugin nativo.
- `client.ts` ya pone `detectSessionInUrl: false`, que es lo correcto en nativo.

O sea: **cero dependencias nuevas y ninguna build nativa nueva**. A diferencia
del bloque `video`, esto no necesita un `eas build` para existir; el flujo es
una pantalla de navegador del sistema.

### Forma

1. `supabase.auth.linkIdentity({ provider: 'github', options: { redirectTo,
   skipBrowserRedirect: true } })` devuelve la URL de autorización.
2. `WebBrowser.openAuthSessionAsync(url, redirectTo)` la abre en la pestaña del
   sistema y resuelve cuando GitHub redirige a `lockin://…`.
3. La app cierra la sesión del navegador y consuma el callback.
4. `rpc('sync_github_verification')`, y se relee el perfil propio.

El paso 3 es el único con letra pequeña: con `flowType: 'pkce'` el callback
trae un `?code=` que hay que canjear, y con el flujo implícito trae un
fragmento `#access_token=…`. `client.ts` **no fija `flowType` hoy**, así que
hereda el de la librería.

Decisión: **fijar `flowType: 'pkce'` explícitamente** en `client.ts`. PKCE es
lo correcto en un cliente público (la app es de quien la ejecuta, no hay
secreto que guardar) y deja el callback con un `code` de un solo uso en vez de
un token en la barra de direcciones.

> **Esto es lo único de la spec que la Tarea 1 del plan debe confirmar contra
> la documentación viva antes de construir encima**, incluido si `linkIdentity`
> en PKCE se cierra con `exchangeCodeForSession` o si el SDK ya lo resuelve.
> El resto del diseño no depende de cuál sea la respuesta — la función SQL, el
> permiso de columna y el contrato son iguales en los dos casos—, pero el
> código del paso 3 sí, y prefiero que esté verificado a que esté adivinado.
> Si al confirmarlo resulta que cambiar `flowType` afecta a las sesiones
> anónimas y de dispositivo que ya funcionan, para y dilo: eso sería
> complejidad oculta y cambia el plan, no se improvisa.

### Mock — `src/data/mock/`

El mock no habla con GitHub: `verifyGithub()` enciende el sello con un handle
derivado del perfil y un `verifiedAt` de `now()`. Va marcado en el JSDoc como
lo que es —**una simulación, no una verificación**— con el mismo tono con el
que `store.ts` dice que el MVP no promete persistencia.

Dos de los ocho perfiles de `seed.ts` nacen con sello, para que las pantallas
tengan los dos estados que pintar sin que nadie toque nada. Los mismos dos en
`supabase/seed.sql`, con `github_handle` y `github_verified_at` a pelo — es un
seed de desarrollo y ahí sí se escribe la columna directamente.

## 3. Pantallas

### Alcance de archivos, y a quién pisa

Este bloque **cruza cuatro bloques**, y se declara aquí entero para que nadie
lo descubra a mitad:

| Archivo | Dueño original | Qué se toca |
|---|---|---|
| `src/data/types.ts` | `arquitecto` | `GithubVerification` + un campo en `Profile` |
| `src/data/repositories.ts`, `repositories.contract.ts` | `arquitecto` | dos métodos y sus casos |
| `src/data/supabase/client.ts` | `datos` | una línea: `flowType` |
| `src/data/mock/`, `src/data/supabase/` | `arquitecto`/`datos` | implementación |
| `supabase/migrations/`, `seed.sql`, `drift-check.mjs`, `schema-embedded.test.mjs` | `datos`/`calidad` | migración y cotejo |
| `src/features/profile/` | `perfil` | el botón y el sello en la ficha |
| `src/features/discover/` | `descubrir` | el sello en la tarjeta |

**No se lanza a la vez que `perfil`, `descubrir` ni `datos`.** Regla de oro de
`PLAN.md`: por turnos, no en paralelo.

### Qué se pinta

**Sello**, allí donde ya se pinta el enlace: el icono de verificado en latón
sólido (`brass`, el acento que `descubrir` ya usa para lo comprobado) y el
texto `@handle · verificado`. Sin sello, el enlace se pinta como hoy, sin
adorno y **sin ningún negativo** — nada de «sin verificar» en rojo. Marcar lo
verificado informa; marcar lo no verificado castiga a las siete especialidades
que no tienen GitHub, y es el filtro por profesión otra vez, por la puerta de
atrás del copy.

Tres sitios, ni uno más:

1. **Perfil propio** (`src/features/profile/`): el sello, y debajo el botón
   «Verificar con GitHub» o «Quitar verificación». Es el único sitio con
   acción; los otros dos solo muestran.
2. **Ficha de otra persona** (`ProfileDetails`): el sello junto al enlace.
3. **Tarjeta del deck** (`src/features/discover/`): el sello, pequeño, junto al
   nombre. Es donde de verdad cambia una decisión, porque es donde se decide.

Accesibilidad, que en este repo no es opcional: el sello **no puede ser solo un
icono**. Lleva `accessibilityLabel` explícito («GitHub verificado: alice»), y
el par de color contra el fondo pasa por el test de contraste que dejó
`arquitecto` con `KNOWN_GAPS` vacío.

### Antes de sobrescribir

Si hay un `links.github` escrito a mano y distinto, el botón avisa antes de
abrir el navegador: qué URL hay, con cuál se va a quedar. Un diálogo del
sistema no — la nota de Claude en Chrome de este repo vale igual aquí: los
modales bloqueantes son un problema. Se pinta en la propia pantalla.

## 4. Casos límite

| Caso | Qué pasa |
|---|---|
| El usuario cancela en GitHub | `openAuthSessionAsync` resuelve `dismiss`; no se llama al RPC, no cambia nada, la pantalla lo dice sin tratarlo como error |
| La cuenta de GitHub ya está linkada a **otro** usuario de LockIn | Supabase rechaza el link; se traduce a un mensaje claro («ese GitHub ya está verificado en otra cuenta»), no a un volcado del error |
| «Manual linking» desactivado en el dashboard | El link falla siempre; el mensaje debe nombrar el ajuste, como ya hace `auth.ts` con «Anonymous sign-ins» y con «Confirm email» |
| Identidad linkada pero el perfil aún no existe | El `update` no toca ninguna fila y no falla; al crear el perfil se resincroniza |
| El usuario cambia su nombre de usuario en GitHub | El sello queda apuntando al viejo hasta la siguiente sincronización. Se resincroniza al abrir el perfil propio, no en cada arranque |
| Sin credenciales de Supabase | Va contra el mock, como todo lo demás; el botón funciona y el JSDoc dice que es simulado |
| Web (`expo export --platform web`) | El flujo es de navegador y no usa módulo nativo: no hace falta ningún `.web.ts`. La build web debe seguir verde igual |

## 5. Tests

- **Unitarios** del mapeo (`mappers.ts`) y de los dos métodos del mock.
- **Contrato** (`repositories.contract.ts`), los cinco casos de arriba.
- **SQL en PGlite** (`schema-embedded.test.mjs`), y aquí está el test que más
  vale de todo el bloque: que un `update` del rol `authenticated` sobre
  `github_verified_at` **falla por permisos**. Eso es lo que impide que el
  sello se pueda encender a mano, y sin test se puede perder en cualquier
  migración futura sin que nadie lo note. Más las dos `constraint` —que el
  sello no puede quedar a medias, y que con sello `link_github` no puede
  apuntar a otro sitio—, que `link_github` **sí** se deja escribir sin sello
  (si no, habríamos roto el formulario de `perfil` y el test lo dice), y que
  `sync_github_verification()` apaga cuando no hay identidad.
- **Componentes** (RNTL): el sello aparece con verificación y no aparece sin
  ella, en los tres sitios, y su `accessibilityLabel`.
- **E2E**: no hay. Un flujo de OAuth abre el navegador del sistema y sale del
  alcance de Maestro; forzarlo sería un test que prueba a GitHub. Se declara
  aquí para que la ausencia sea una decisión y no un olvido.

## Fuera de alcance de esta spec

- LinkedIn y portfolio (ver arriba: el primero no se puede, el segundo necesita
  backend).
- Filtrar u ordenar el deck por sello.
- Verificación de identidad legal, de persona real, o antifraude.
- Sellos derivados de comportamiento (sesiones cumplidas) — era otra de las
  opciones del abanico y es una spec distinta, con su propia tensión contra la
  privacidad de `session_ratings`.
- Los otros dos sub-proyectos de Fase 3.

## Dependencias

Del código: nada. No depende de Fase 2 y no la toca.

**Del usuario, y bloquea la verificación de verdad** (no el desarrollo, que
avanza entero contra el mock y contra PGlite):

1. Crear una **GitHub OAuth App** y poner su client ID y secret en
   Authentication → Providers → GitHub del dashboard de Supabase, con la
   callback URL que indique el propio dashboard.
2. Activar **Enable Manual Linking** en Authentication → Settings. Está
   **desactivado por defecto** y sin él `linkIdentity()` falla siempre
   ([Identity Linking][sb-linking]).
3. Aplicar `20260916000100_github_verification.sql` en
   `grrzmzktrhksbttpbblg` por el SQL Editor, como las cuatro anteriores. Ojo:
   hasta que se aplique, `Schema drift` **debe** salir rojo en el job remoto —
   y eso no es deriva, es esta migración esperando. Es la única vez que un rojo
   ahí es esperado; en cuanto se aplique, vuelve a ser deriva real.
4. Probar el flujo en un dispositivo con el dev client de EAS que ya existe.
   El OAuth necesita un navegador de verdad y un deep link de vuelta: ningún
   agente puede cerrar esta casilla, mismo precedente que la Tarea 11 de
   `sesiones` y las dos pendientes de `video`.

[li-oidc]: https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2
[li-profile]: https://learn.microsoft.com/en-us/linkedin/shared/integrations/people/profile-api
[sb-linking]: https://supabase.com/docs/guides/auth/auth-identity-linking
