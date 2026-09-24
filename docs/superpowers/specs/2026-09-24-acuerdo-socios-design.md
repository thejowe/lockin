# Acuerdo de socios (conversación guiada a ciegas) — diseño

> Fase 3, segundo sub-proyecto. Spec escrita el 2026-09-24.
>
> Bloque: `acuerdo` (bloque 12 de `docs/plan/PLAN.md`).
> Plan de implementación: `docs/superpowers/plans/2026-09-24-acuerdo-socios.md`.
> Checklist: `docs/plan/todo/acuerdo.md`.

## Contexto

`CONCEPTO.md` deja Fase 3 en tres palabras: «salas grupales, verificación,
plantillas de acuerdo entre cofundadores». Verificación está hecha (bloque 11).
De las dos que quedan se eligió esta, con el usuario, el 2026-09-24, por una
razón de coste: **salas grupales rompe la suposición «match = 2 personas»** en
la que se apoyan chat, sesiones, rachas, valoración y vídeo (WebRTC 1:1), y
tocaría casi todo Fase 2. El acuerdo, en cambio, cuelga de algo que ya existe
—un match de Modo Par— y no toca Fase 2.

El problema que ataca es el de siempre entre cofundadores: las conversaciones
difíciles (cuánto se dedica cada uno, cómo se reparte, qué pasa si uno se va)
se aplazan hasta que salen caras. Dos personas que se acaban de conocer en una
app de swipe son exactamente las que menos se atreven a sacarlas.

## Qué problema resuelve, y cuál no

**Resuelve**: que una pareja de cofundadores sepa, tema por tema, **en qué
coinciden y en qué no**, sin que ninguno ancle al otro. Cada uno responde por
su cuenta; la respuesta del otro solo se ve cuando has dado la tuya.

**No resuelve**, y el copy tiene que decirlo:

- **No es un contrato.** No genera un documento, no se firma, no obliga a nada.
  «Coincidís» significa que habéis elegido la misma opción, no que hayáis
  pactado nada.
- **No es asesoría legal.** Los temas y las opciones son para abrir la
  conversación, no una recomendación de qué elegir. Cuando la pareja vaya en
  serio, necesita un profesional, y la pantalla lo dice siempre, sin poder
  cerrarse.
- **No exporta nada en v1.** Un «borrador para abogado» era otra opción del
  abanico y se descartó: acerca el producto a lo legal sin que haya nadie
  detrás que responda de ese texto.

Si algún copy de este bloque dice «acuerdo firmado», «pacto», «contrato» o
recomienda una opción sobre otra, está mintiendo. Está escrito aquí para que
se pueda citar en la revisión.

## Decisiones tomadas

1. **Conversación guiada, no documento.** Decidido con el usuario.
2. **A ciegas por tema.** No ves la respuesta del otro en un tema hasta que tú
   has respondido ese tema. Lo impone Postgres, no el cliente.
3. **Opción cerrada + nota libre corta.** Cada tema tiene 3-4 opciones fijas,
   más `sin-decidir`, y una nota opcional de hasta 280 caracteres. Así la app
   puede decir «coincidís» sin interpretar texto.
4. **Solo en matches Par.** `Match.mode === 'par'`. Un compañero de lock-in no
   monta una empresa contigo.
5. **Un solo catálogo fijo, en código.** Ocho temas en tres secciones. Sin
   plantillas a elegir ni temas propios.
6. **Por match, no por persona.** Tus respuestas viven en ese match y solo las
   ve esa otra persona.
7. **Editable siempre, sin estado de «firmado».** Si no coincidís, lo habláis
   en el chat y alguien cambia su respuesta.
8. **Nada sale del match.** Ni perfil, ni deck, ni fila de Matches.

### Por qué a ciegas

Si ves primero que la otra persona ha puesto «a partes iguales», ponerte en
«según aportación» se siente como una acusación, y la mayoría no lo hace. Ese
desacuerdo que nadie dice es justo el que revienta una empresa al año. El ciego
es lo que hace que la pantalla descubra algo que el chat no descubriría solo.

Es **por tema** y no «todo junto al final» para que una persona lenta no
bloquee las siete respuestas que ya estarían listas.

### Por qué por match y no en el perfil

Responder una vez en el perfil y compararlo con cada match parece más cómodo,
pero rompe el ciego: tu respuesta quedaría revelada a **cualquiera** que
respondiera ese tema en **cualquier** match. Y la respuesta depende de con
quién y para qué: tu dedicación a un proyecto no es tu dedicación a otro.

### Por qué la lectura va por RPC y no por RLS

Una política de `select` del tipo «ves la fila del otro si existe la tuya»
consulta la misma tabla que protege. Postgres la rechaza por recursión, salvo
que se meta un helper `SECURITY DEFINER`, así que la función aparece igual.
Además, RLS solo sabe enseñar u ocultar una fila entera. No puede decir «ya ha
respondido» sin enseñar **qué** ha respondido, y la pantalla necesita decir
eso.

Así que la tabla se queda con una sola política —**solo lees las tuyas**, la
misma forma que `session_ratings`—, y la vista de la pareja la da
`match_agreement(p_match_id)`, `SECURITY DEFINER` con el actor dentro, como
`match_streaks()` y `ratable_session()`.

### Por qué la escritura también va por RPC

Por el mismo patrón que `rate_session()`: el rol `authenticated` no tiene
`insert` ni `update` sobre la tabla. La función comprueba que eres del match
y que el match es Par, y escribe con `auth.uid()` como autor. El cliente no
puede escribir en nombre del otro ni en un match Lock-In, aunque lo intente con
la clave `anon` a mano.

### Por qué el catálogo vive en el cliente

El catálogo es texto de producto que se va a pulir, y meterlo en una tabla
obligaría a hacer una migración por cada coma. La base solo guarda **claves**
(`dedicacion`, `completa`) con un `check` de formato. No conoce qué claves son
válidas, y no le hace falta: una clave desconocida —de un catálogo viejo o de
un cliente malicioso— solo estropea la respuesta **de quien la escribió**, y el
cliente la pinta como no respondida. Nadie puede usarla para ver ni tocar la
respuesta de otro.

## 1. Modelo y contrato

### Catálogo — `src/features/agreement/topics.ts` (nuevo)

`AGREEMENT_CATALOG`, versionado con `AGREEMENT_CATALOG_VERSION = 1` solo como
documentación: la base no lo guarda. El orden del array es el orden en
pantalla. Las claves son `kebab-case` ASCII; el texto visible va aparte.

| Sección | Tema (`topic`) | Opciones (`option`) |
|---|---|---|
| Compromiso | `dedicacion` — «¿Cuánto tiempo le vas a dedicar los próximos 6 meses?» | `menos-10h` · `10-25h` · `media-jornada` · `completa` |
| Compromiso | `horizonte` — «¿Cuánto le das antes de replantearlo?» | `3-meses` · `1-ano` · `hasta-que-funcione` |
| Compromiso | `dinero-propio` — «¿Cuánto dinero tuyo estás dispuesto a poner?» | `nada` · `gastos-pequenos` · `colchon-serio` |
| Reparto | `participacion` — «¿Cómo repartiríais la participación?» | `partes-iguales` · `segun-aportacion` · `mas-adelante` |
| Reparto | `consolidacion` — «¿La participación se gana con el tiempo (vesting)?» | `si-con-periodo` · `no` |
| Reparto | `decisiones` — «¿Cómo se decide cuando no estáis de acuerdo?» | `consenso` · `cada-uno-su-area` · `desempate-pactado` |
| Salida | `si-uno-se-va` — «Si uno lo deja en el primer año…» | `se-va-sin-nada` · `conserva-lo-ganado` · `lo-hablamos-entonces` |
| Salida | `lo-creado` — «Lo que cada uno ha creado antes de constituir, ¿de quién es?» | `del-proyecto` · `de-quien-lo-hizo` |

Todos los temas llevan además `sin-decidir` («Aún no lo sé»), que no se repite
en la tabla. **Ninguna opción huele a «uno contrata al otro»**: no hay sueldo,
ni «tú trabajas para mí», ni reparto por rol jerárquico. Es el principio
innegociable de `CONCEPTO.md`. El copy exacto de cada opción se cierra en el
plan (tarea `[Claude]`: es criterio subjetivo); las claves de esta tabla, no.

### Estado por tema — `src/features/agreement/status.ts` (nuevo)

Función pura `topicStatus(mine, theirs)`, donde cada lado es `null`, `'hidden'`
o una respuesta:

| Mi respuesta | La del otro | Estado |
|---|---|---|
| `null` o clave desconocida | cualquiera | `pendiente` (falta la tuya) |
| respondida | `null` | `pendiente` (falta la suya) |
| alguna es `sin-decidir` | respondida | `por-hablar` |
| misma opción | | `coincidis` |
| distinta | | `distinto` |

`'hidden'` no puede salir de la RPC cuando yo ya he respondido (es la
invariante del ciego). Si aun así llega, el estado es `pendiente`: el cliente
no revela aunque el servidor falle.

### Dominio — `src/data/types.ts` (cruce con `arquitecto`)

```ts
/** Respuesta de una persona a un tema del acuerdo de socios. */
export interface AgreementAnswer {
  topic: string;
  option: string;
  /** Nota libre opcional, ≤ 280 caracteres. `null` si no hay. */
  note: string | null;
  updatedAt: string;
}

/** Un tema del acuerdo visto desde el usuario actual. */
export interface AgreementTopicView {
  topic: string;
  mine: AgreementAnswer | null;
  /**
   * La respuesta del otro. `'hidden'` = ya respondió pero tú aún no;
   * `null` = no ha respondido.
   */
  theirs: AgreementAnswer | 'hidden' | null;
}

export interface AgreementAnswerInput {
  matchId: string;
  topic: string;
  option: string;
  note?: string | null;
}
```

`topic` y `option` son `string` y no uniones literales **a propósito**: el
dominio no conoce el catálogo (vive en `features`), igual que la base.

### Contrato — `src/data/repositories.ts`

```ts
export interface AgreementRepository {
  /** Un `AgreementTopicView` por tema con alguna respuesta de los dos. Los temas sin ninguna no vienen. */
  get(matchId: string): Promise<AgreementTopicView[]>;
  /** Crea o sustituye tu respuesta a un tema. Idempotente. */
  answer(input: AgreementAnswerInput): Promise<AgreementTopicView>;
}
```

Colgado de `Repositories` como `agreement`, y expuesto en `src/data/active.ts`
e `index.ts` igual que `sessions`.

Errores (`src/data/agreement.ts`, nuevo — no reutiliza
`src/data/session-errors.ts` para no tocar un archivo de `sesiones`):

- Match ajeno o inexistente → `AgreementForbiddenError` (`LI004`), el mismo
  código que ya existe.
- Match Lock-In → `AgreementModeError` (**`LI005` (nuevo)**): «el acuerdo es
  solo para matches de cofundador».
- Nota > 280 o clave con formato inválido → `AgreementInvalidError`
  (violación de `check`, `23514`, o validación en cliente), traducida a un
  mensaje de validación.

### Casos de contrato — `src/data/repositories.contract.ts`

Contra el mock y contra Supabase:

1. Respondo un tema y el otro no → yo veo `mine` y `theirs: null`.
2. El otro responde un tema y yo no → veo `mine: null`, `theirs: 'hidden'`.
   **Este es el caso del ciego**, y el que más vale del bloque.
3. Los dos respondemos → los dos vemos las dos respuestas, notas incluidas.
4. Responder dos veces el mismo tema sustituye la respuesta (no duplica) y
   actualiza `updatedAt`.
5. Responder en un match Lock-In rechaza con `LI005`.
6. Leer o responder en un match ajeno rechaza con `LI004` (`match_agreement`
   lo lanza directamente; ya no cero filas).

La fixture del contrato necesita un match Par con respuestas de la contraparte
sembradas. El mock la tiene de fábrica; Supabase la siembra con la misma
maquinaria que ya usa el contrato para las sesiones (el plan concreta cuál,
leyendo `contract.test.ts`).

### Supabase — migración nueva

`supabase/migrations/20260924000200_agreement_answers.sql`. El sufijo `000200`
es porque `20260924000100` ya existe. Si al implementar ya hay otra con esa
fecha, se toma la siguiente libre. Sigue el patrón de
`20260915000100_session_ratings.sql`: `search_path` vacío, nombres
cualificados, `revoke`/`grant` al final **desde `public, anon`** (lección de
`20260924000100`).

```sql
create table public.agreement_answers (
  match_id uuid not null references public.matches (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  topic text not null check (topic ~ '^[a-z0-9-]{1,40}$'),
  option text not null check (option ~ '^[a-z0-9-]{1,40}$'),
  note text check (note is null or char_length(note) between 1 and 280),
  updated_at timestamptz not null default now(),
  primary key (match_id, profile_id, topic)
);

alter table public.agreement_answers enable row level security;
revoke all on table public.agreement_answers from anon;
revoke insert, update, delete on table public.agreement_answers from authenticated;

create policy "agreement_answers: solo lees las tuyas"
  on public.agreement_answers for select
  to authenticated
  using (profile_id = (select auth.uid()));
-- Sin política de insert/update/delete: solo se escribe por RPC (revocados
-- explícitos arriba, aunque RLS ya los bloquearía).
```

La nota vacía se normaliza a `null` en el cliente, no en SQL.

**`answer_agreement_topic(p_match_id uuid, p_topic text, p_option text, p_note text)`**
— `plpgsql`, `security definer`, devuelve la fila escrita:

1. Si el match no existe o `auth.uid()` no es `profile_a`/`profile_b` →
   `LI004`.
2. Si `mode <> 'par'` → `LI005`.
3. `insert … on conflict (match_id, profile_id, topic) do update set option,
   note, updated_at = now()`.

**`match_agreement(p_match_id uuid)`** — `plpgsql`, `stable`, `security
definer`, devuelve `table (topic text, mine_option text, mine_note text,
mine_updated_at timestamptz, theirs_answered boolean, theirs_option text,
theirs_note text, theirs_updated_at timestamptz)`:

- Si el match no existe o `auth.uid()` no es `profile_a`/`profile_b` →
  `LI004`. Si `mode <> 'par'` → `LI005`. Igual que `answer_agreement_topic`,
  en lugar de devolver cero filas: así los dos backends leen igual y el caso
  de contrato «leer un match ajeno rechaza» tiene sentido también con el mock.
- Una fila por tema con alguna respuesta de los dos (`full outer join` de la
  mía con la del otro sobre `topic`).
- `theirs_option`, `theirs_note` y `theirs_updated_at` son `null` **salvo que
  exista mi respuesta a ese tema**. Es un `case when mine.topic is not null`
  sobre cada columna, no un filtro de filas: `theirs_answered` sale aunque yo
  no haya respondido.

Permisos al final:

```sql
revoke execute on function public.answer_agreement_topic(uuid, text, text, text) from public, anon;
revoke execute on function public.match_agreement(uuid) from public, anon;
grant execute on function public.answer_agreement_topic(uuid, text, text, text) to authenticated;
grant execute on function public.match_agreement(uuid) to authenticated;
```

**Sin realtime.** La tabla no se añade a la publicación: con la política de
«solo las tuyas», `postgres_changes` nunca entregaría la fila del otro, que es
justo la que interesa. Además, el join de realtime ya tiene carreras en este
repo. La pantalla vuelve a leer al enfocarse y después de cada respuesta.

## 2. Pantallas

### Entrada — tarjeta en el chat

`AgreementCard` (`src/features/agreement/agreement-card.tsx`), montada en
`src/app/chat/[matchId].tsx` debajo de `SessionCard`, **solo si
`match.mode === 'par'`**. Es la única línea que este bloque toca en esa
pantalla. `AgreementCard` recibe `match` y no importa nada de
`@/features/session`.

- Sin respuestas de nadie: «Acuerdo de socios» + «8 temas difíciles, a ciegas
  hasta que respondáis los dos.»
- Con alguna: «Acuerdo de socios · 3 de 8 comparados · 1 distinto». Se
  cuentan como «comparados» los temas en `coincidis`, `distinto` o
  `por-hablar`.
- Si el otro ha respondido temas que tú no: «[Nombre] ha respondido 2 que tú
  aún no.» Es lo único que empuja a volver, y no revela nada.
- La tarjeta entera navega a `/agreement/[matchId]`.

### Pantalla — `src/app/agreement/[matchId].tsx` (nueva)

Ruta nueva registrada con un `Stack.Screen` en `src/app/_layout.tsx`, igual que
`session/[sessionId]`.

1. **Aviso fijo arriba**, que no se puede cerrar: «Esto no es un contrato ni
   asesoría legal. Sirve para hablar de lo difícil antes de que salga caro.
   Cuando vayáis en serio, id a un profesional.»
2. **Tres secciones** (Compromiso, Reparto, Salida) con sus temas. Cada fila
   (`TopicRow`) enseña el enunciado y el estado:
   - `pendiente`: «Falta tu respuesta», o «[Nombre] aún no ha respondido»
     (y entonces se ve tu respuesta).
   - `coincidis`: la opción común, con el acento verde azulado (`teal`).
   - `distinto`: las dos opciones una al lado de la otra, cada una con su
     nombre, en tinta normal. **Sin rojo ni `danger`**: discrepar no es un
     error, es para lo que existe la pantalla.
   - `por-hablar`: «Lo tenéis que hablar», en latón (`brass`).
   - Una vez revelado, las notas de los dos debajo.
3. **Al tocar una fila se despliega** en su sitio: chips con las opciones, más
   «Aún no lo sé», y el campo de nota con contador. Guardar llama a
   `agreement.answer` y vuelve a leer. Sin modal ni diálogo del sistema (los
   diálogos bloqueantes rompen la automatización del repo y son peor
   experiencia).
4. Al pie, «Habladlo en el chat», que vuelve a `/chat/[matchId]`.

**Match Lock-In o inexistente** (a la pantalla se puede llegar por deep link):
un estado vacío con «El acuerdo es solo para matches de cofundador» o el
`MissingMatch` que ya usa el chat, y un enlace a Matches.

**Accesibilidad**: el estado nunca va solo en color. Siempre lleva texto
(`coincidís`, `distinto`, `por hablar`, `pendiente`). Los chips llevan
`accessibilityRole="radio"` y `accessibilityState.selected`, y cada fila
revelada, un `accessibilityLabel` que lee las dos respuestas. Los pares de
color pasan el test de contraste de `arquitecto` con `KNOWN_GAPS` vacío.

### Mock — `src/data/mock/agreement.ts` (nuevo)

Implementa el ciego con la misma regla que la RPC: `theirs` sale `'hidden'`
si no hay respuesta propia en ese tema. Para que la revelación se pueda probar
sin Supabase, los perfiles semilla que dan match recíproco en Modo Par traen
ya respondidos **tres temas** en `seed.ts`: uno que coincidirá con la opción
que elige el E2E, uno distinto y uno `sin-decidir`. Así se ven los tres
estados revelados.

## 3. Alcance de archivos, y a quién pisa

Bloque nuevo **12 `acuerdo`**. Archivos propios, todos nuevos:

- `src/features/agreement/`: `topics.ts`, `status.ts`, `use-agreement.ts`,
  `agreement-card.tsx`, `topic-row.tsx`, `index.ts`, y sus tests.
- `src/app/agreement/[matchId].tsx` + `test/app/agreement.test.tsx`.
- `src/data/mock/agreement.ts`, `src/data/supabase/agreement.ts` y sus tests.
- `supabase/migrations/20260924000200_agreement_answers.sql`.
- `e2e/agreement.yaml`.

Archivos de otros bloques que toca, declarados enteros para que nadie los
descubra a mitad:

| Archivo | Dueño original | Qué se toca |
|---|---|---|
| `src/data/types.ts` | `arquitecto` | `AgreementAnswer`, `AgreementTopicView`, `AgreementAnswerInput` |
| `src/data/repositories.ts`, `repositories.contract.ts` | `arquitecto` | `AgreementRepository` y sus seis casos |
| `src/data/mock/store.ts` | `arquitecto` | `MockState` gana dos campos |
| `src/data/active.ts`, `src/data/index.ts` | `arquitecto` | Exponer `agreement` |
| `src/data/mock/index.ts`, `seed.ts` | `arquitecto`/`perfil` | Registrar el repositorio y las tres respuestas semilla |
| `src/data/supabase/index.ts`, `database.types.ts` | `datos` | Registrar el repositorio y los tipos de las dos RPC |
| `supabase/schema-embedded.test.mjs`, `drift-check.mjs` (si no parsea la tabla nueva) | `datos`/`calidad` | Los tests en PGlite |
| `src/app/chat/[matchId].tsx` | `chat` | Una línea: `<AgreementCard match={match} />` |
| `src/app/_layout.tsx` | `arquitecto` | Un `Stack.Screen` para `agreement/[matchId]` |
| `e2e/run.mjs`, `verify.mjs` | `calidad` | Dar de alta el flujo nuevo, solo en la variante `mock` |

- **No se lanza a la vez que `chat` ni que `datos`**, ni que ninguna sesión que
  esté tocando `src/data/types.ts` o `repositories.ts`. Va por turnos, no en
  paralelo.
- **No toca Fase 2**: sesiones, rachas, valoración y vídeo quedan intactos.
  `src/data/agreement.ts` es un archivo nuevo del bloque; no toca
  `session-errors.ts`.
- **Cero dependencias nuevas y ninguna build nativa.**

## 4. Casos límite

| Caso | Qué pasa |
|---|---|
| Match Lock-In | No hay tarjeta en el chat. Por deep link, la pantalla dice que es solo para cofundadores. La RPC rechaza con `LI005` aunque se llame a mano |
| Match ajeno | `match_agreement` rechaza con `LI004` (ya no cero filas) y `answer_agreement_topic` también. La pantalla pinta `MissingMatch` |
| Clave desconocida (catálogo viejo o cliente malicioso) | El cliente la trata como no respondida. Si es mía, el tema sale `pendiente` y puedo responderlo encima (misma clave de tema, se sustituye) |
| Tema que desaparece del catálogo | Sus filas se quedan en la base, pero no se pintan ni cuentan en la tarjeta |
| El otro cambia su respuesta después de revelada | Se ve el cambio en la siguiente lectura. Sin aviso ni historial en v1 |
| Nota con solo espacios | El cliente la recorta y manda `null` |
| El match se borra | Las respuestas caen con él (`on delete cascade`) |
| Sin credenciales de Supabase | Va contra el mock, como todo lo demás |
| Web (`expo export --platform web`) | Solo React Native y datos: sin `.web.ts`. La build web sigue verde |

## 5. Tests

- **Unitarios**: `topicStatus` con los cinco casos de su tabla, más
  `'hidden'` con respuesta propia (no revela). Y `topics.ts`: claves únicas,
  todas cumplen `^[a-z0-9-]{1,40}$` y cada tema acepta `sin-decidir`.
- **Contrato** (`repositories.contract.ts`): los seis casos de arriba.
- **SQL en PGlite** (`schema-embedded.test.mjs`). El test que más vale del
  bloque es que `match_agreement` **no devuelve** `theirs_option` ni
  `theirs_note` si el actor no ha respondido ese tema, pero sí
  `theirs_answered = true`. Además: un `insert` directo de `authenticated`
  falla por permisos, `answer_agreement_topic` rechaza en un match Lock-In
  (`LI005`) y en uno ajeno (`LI004`), un tercero no ve nada con
  `match_agreement`, los `check` de clave y de nota, y el `upsert` sustituye
  en vez de duplicar.
- **Componentes** (RNTL): `AgreementCard` (sin respuestas, con recuento y con
  «ha respondido N que tú aún no»; y que no se monta en Lock-In), y `TopicRow`
  en los cuatro estados, con sus etiquetas de accesibilidad.
- **Pantalla** (`test/app/agreement.test.tsx`): el aviso legal siempre visible,
  responder un tema, y el estado de match Lock-In.
- **E2E** (Maestro, variante `supabase`): la variante `mock` de `e2e/run.mjs`
  es el control negativo que debe **romperse** al reiniciar sin credenciales;
  meter ahí un flujo en verde le cambiaría el significado. El flujo va
  encadenado después de `session-streak.yaml`: desde el chat de un match Par,
  abrir el acuerdo, responder un tema y ver «Coincidís» tras sembrar la
  respuesta de la contraparte con `service_role`, como `prepareSessionStreak`.

## Fuera de alcance de esta spec

- Exportar el acuerdo (PDF, texto, «borrador para abogado»).
- Varias plantillas o temas propios de la pareja.
- Realtime, notificaciones o avisos cuando el otro responde.
- Historial de cambios de una respuesta.
- Cualquier señal del acuerdo fuera del match: perfil, deck o Matches.
- Salas grupales, que es el tercer sub-proyecto de Fase 3.

## Dependencias

Del código: ninguna. Va sobre el MVP y los matches Par que ya existen, y no
toca Fase 2.

**Del usuario**, que no bloquea el desarrollo (avanza entero contra el mock y
contra PGlite):

1. Aplicar `20260924000200_agreement_answers.sql` en `grrzmzktrhksbttpbblg`
   por el SQL Editor. Mientras no se aplique, `Schema drift` remoto **saldrá
   rojo a propósito**, y eso se anota con fecha como excepción en
   `todo/acuerdo.md` y en la memoria del repo, igual que se hizo con
   verificación. En cuanto se aplique, un rojo ahí vuelve a ser deriva real.
2. Nada más: sin credenciales, sin dashboard y sin build nativa. Recorrer la
   pantalla en el emulador lo hace el agente `comprobador`.
