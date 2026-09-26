# Acuerdo de socios (a ciegas) — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que una pareja de cofundadores (match Par) responda por separado ocho temas difíciles y vea, tema por tema, en qué coincide y en qué no, sin que ninguno vea la respuesta del otro antes de dar la suya.

**Architecture:** una tabla `agreement_answers` que el cliente solo lee en sus propias filas. Escribir va por `answer_agreement_topic()` y leer la vista de la pareja por `match_agreement()`, las dos `SECURITY DEFINER` con el actor dentro, que es donde se impone el ciego. El catálogo de temas vive en el cliente (`src/features/agreement/topics.ts`); la base solo guarda claves. La tarjeta del chat lleva a una pantalla nueva, `/agreement/[matchId]`.

**Tech Stack:** Expo SDK 57 + Expo Router (rutas tipadas), `@supabase/supabase-js` v2, Postgres/Supabase, Jest + RNTL 14, PGlite 0.3.14 para el SQL, Maestro para el E2E.

**Spec:** `docs/superpowers/specs/2026-09-24-acuerdo-socios-design.md`. Léela entera antes de la Tarea 1; este plan argumenta desde ella y no la repite.

## Global Constraints

- **Expo ha cambiado**: consulta `https://docs.expo.dev/versions/v57.0.0/` antes de escribir código de Expo, no de memoria (`AGENTS.md`).
- **Cero dependencias nuevas y ninguna build nativa.** Si crees que necesitas instalar algo, para y dilo.
- **No es un contrato ni asesoría legal.** Ningún copy dice «acuerdo firmado», «pacto», «contrato» ni recomienda una opción. El aviso legal de la pantalla es fijo y no se puede cerrar.
- **El ciego lo impone el servidor.** El cliente no oculta nada por su cuenta como única defensa: si la RPC devolviera la respuesta del otro sin la tuya, eso es un fallo de la Tarea 2, no algo que la UI deba tapar.
- **Solo matches Par** (`Match.mode === 'par'`). En Lock-In no hay tarjeta, y la RPC rechaza con `LI005`.
- **Nada sale del match**: ni perfil, ni deck, ni fila de Matches.
- **Ninguna opción huele a «uno contrata al otro»** (principio innegociable de `CONCEPTO.md`).
- **Sin rojo para «distinto».** Discrepar no es un error: `distinto` va en tinta normal, nunca en `danger`.
- **No stagees nunca y no uses `git stash`** (memoria del repo: el índice se comparte entre bloques). Commitea con `git commit -m "…" -- <rutas>`. Para un archivo nuevo, antes `git add -N -- <ruta>` (intent-to-add, no stagea contenido). Comprueba `git branch --show-current` antes de cada commit.
- **No se lanza a la vez que `chat` ni que `datos`**, ni que ninguna sesión que toque `src/data/types.ts` o `repositories.ts`.
- Suelo de cobertura de `jest.config.js`: 89.82/82.56/91.49/91.38 (sentencias/ramas/funciones/líneas). No bajarlo.
- Paleta: `coincidis` en `teal`, `por-hablar` en `brass`, `distinto` en `text`. Nada de colores nuevos.
- Errores: `LI004` = match ajeno; `LI005` = match no Par (nuevo); `23514` = `check` violado.

### Cómo se verifica en esta máquina (Windows)

| Comando | ¿Vale como veredicto? |
|---|---|
| `npm test`, `npx jest <ruta>` | Sí |
| `npx tsc --noEmit`, `npm run lint` | Sí |
| `npm run test:schema` | Sí (PGlite, sin Docker) |
| `npx expo export --platform web` | Sí |
| `npm run format:check` | **No**: da ~100 falsos por CRLF. Corre `npx prettier --write` sobre lo que tocaste y lee el veredicto del job «Formato» en CI |
| `npm run test:e2e` | **No**: sus 2 fallos aquí son CRLF, no una regresión |
| E2E Android | Solo en Actions (`e2e.yml`); aquí se diagnostica con `gh run download` |

### Nombres reales, ya verificados contra el repo

No los adivines ni inventes helpers: existen con exactamente estos nombres.

| Qué | Dónde |
|---|---|
| `useQuery(key, run)` → `{ data, loading, refreshing, error, refresh }` | `src/data/provider.tsx:246` |
| `useRepositories()` | `@/data` |
| `buildProfileInput(overrides)` | `src/data/test-fixtures.ts` |
| `SEED_RECIPROCAL_IDS` (`['seed-nuria', 'seed-marc', 'seed-alba', 'seed-lucia']`); Núria es `lookingFor: 'par'`, Alba `'lockin'` | `src/data/mock/seed.ts:298` |
| `MockState`, `initialState()`, `MockStore.nowMs()` | `src/data/mock/store.ts` |
| `createMockSessionRepository(actorId, store)`, patrón a copiar | `src/data/mock/sessions.ts` |
| `createSupabaseSessionRepository(deps)`, `SessionRepositoryDeps`, `toSessionError`, patrón a copiar | `src/data/supabase/sessions.ts` |
| Registro de repositorios | `src/data/mock/index.ts:335` y `src/data/supabase/index.ts:653` |
| Fachada perezosa `repositories` | `src/data/active.ts:163` |
| `ContractFixture`, `ContractBackend`, `describeRepositoryContract` | `src/data/repositories.contract.ts:57`, `:103`, `:147` |
| Fixture del mock: `counterpartSessions`, `outsiderSessions` | `src/data/mock/index.test.ts:78-81` |
| Fixture de Supabase: `sessionRepositoryFor(actor)`, `parReciprocal`, `lockinReciprocal` | `src/data/supabase/contract.test.ts:296`, `:360`, `:437` |
| Tipos de filas y `Functions` de la RPC | `src/data/supabase/database.types.ts` |
| Test SQL único, con `errcode`/savepoints y `auth.uid()` sustituida | `supabase/schema-embedded.test.mjs:207-260` |
| Mock de router para tests (`useFocusEffect` corre al montar) | `test/routes.tsx:45` |
| `renderRoute`, `resetRepositories`, `setSearchParams`, `repositories` | `test/routes.tsx` |
| Chips con `accessibilityRole="radio"`, patrón a copiar | `src/features/session/rating-chips.tsx` |
| Hook con relectura al enfocar (salta el primer foco) | `src/features/session/use-match-streaks.ts` |
| Tarjeta del chat y su hueco | `src/app/chat/[matchId].tsx:137-139` (`styles.lockIn`) |
| `Stack.Screen` de rutas con cabecera | `src/app/_layout.tsx:81-100` |
| Siembra E2E con `service_role` | `e2e/verify.mjs:210` (`prepareSessionStreak`) |
| Encadenado de flujos E2E | `e2e/run.mjs:800-830` |

### Desviaciones respecto a la spec, decididas al escribir este plan

La spec se corrige en la Tarea 0 para que diga lo mismo:

1. **Los errores no van en `session-errors.ts`** sino en `src/data/agreement.ts` (nuevo, del bloque): `AgreementForbiddenError` (LI004), `AgreementModeError` (LI005) y `AgreementInvalidError` (23514 o validación en cliente). Así el bloque no toca un archivo de `sesiones`.
2. **`match_agreement` es `plpgsql` y lanza** `LI004`/`LI005`, igual que la escritura, en lugar de devolver cero filas. Así los dos backends leen igual y el caso de contrato «leer un match ajeno rechaza» tiene sentido.
3. **El E2E corre en la variante `supabase`, no en `mock`**. La variante mock de `e2e/run.mjs` es un control negativo que debe **romperse** al reiniciar; meter ahí un flujo en verde le cambiaría el significado. El flujo se encadena después de `session-streak.yaml`, y la respuesta de la contraparte se siembra con `service_role`, como `prepareSessionStreak`.
4. **La tabla también revoca `insert, update, delete` a `authenticated`.** Supabase los concede por defecto en `public` (lo emula la fixture de PGlite); RLS ya los bloquearía, pero se cierra también por permisos.
5. **`src/data/mock/store.ts` entra en el alcance** (`MockState` gana dos campos).

## Review Focus

Cinco entradas que la spec implica y ningún caso de su lista cubre. Cada una tiene su test en la tarea dueña:

1. **Doble toque en «Guardar»**: se espera una sola escritura, y el botón deshabilitado mientras vuela. Test en la Tarea 5 (`use-agreement.test.tsx`).
2. **Nota de solo espacios, o de 281 caracteres**: la primera se guarda como `null`; la segunda no se puede escribir (tope del campo) y el backend la rechaza. Tests en la Tarea 3 (contrato) y la Tarea 5 (`topic-row.test.tsx`).
3. **El otro cambia su respuesta con tu pantalla abierta**: al volver a enfocar se relee. Test en la Tarea 5 (`use-agreement.test.tsx`).
4. **El match deja de existir o es ajeno con la pantalla abierta** (deep link viejo): se ve `MissingMatch`, sin pantalla rota. Test en la Tarea 6 (`test/app/agreement.test.tsx`).
5. **Mi fila tiene una clave de opción desconocida** (catálogo viejo): el tema sale `pendiente`, la del otro no se enseña y puedo responder encima. Test en la Tarea 1 (`status.test.ts`).

---

### Task 0: Alta del bloque `acuerdo` [Claude]

Cruza documentos de todo el roadmap: por eso es `[Claude]`.

**Files:**
- Modify: `docs/plan/PLAN.md` (sección nueva «### 12. `acuerdo`» después de la 11)
- Modify: `docs/plan/TODO.md` (hito nuevo en «Fase 3»)
- Create: `docs/plan/todo/acuerdo.md`
- Modify: `docs/superpowers/specs/2026-09-24-acuerdo-socios-design.md` (las cinco desviaciones de arriba)

**Interfaces:**
- Consumes: nada.
- Produces: la checklist `docs/plan/todo/acuerdo.md`, que las tareas siguientes marcan.

- [ ] **Step 1: Añadir la sección 12 a `PLAN.md`**

Copia la forma de la sección 11: entrega en un párrafo, enlaces a spec, plan y checklist, la tabla de alcance de la spec (§3) **con las desviaciones 1 y 5 ya aplicadas** (fuera la fila de `session-errors.ts`; `src/data/mock/store.ts` dentro, y `e2e/verify.mjs` junto a `run.mjs`), y estas viñetas:

```markdown
- **Nunca se lanza a la vez que `chat` ni que `datos`**, ni que una sesión que
  toque `src/data/types.ts` o `repositories.ts`: pisa archivos suyos.
- **No toca Fase 2.** La tarjeta del acuerdo se monta junto a `SessionCard` sin
  importarla.
- **No es un contrato ni asesoría legal**; el copy no puede decir otra cosa.
- **Solo en matches Par**, y nada sale del match.
- Cero dependencias nuevas y ninguna build nativa.
- Depende de: nada de Fase 2. **Del usuario**: aplicar
  `20260924000200_agreement_answers.sql` en `grrzmzktrhksbttpbblg`.
```

Y corrige la frase de la sección 11 «Los otros dos no están empezados» → «Plantillas de acuerdo es el bloque 12; salas grupales no está empezado».

- [ ] **Step 2: Crear `docs/plan/todo/acuerdo.md`**

```markdown
# acuerdo — Acuerdo de socios a ciegas (Fase 3)

Spec: `docs/superpowers/specs/2026-09-24-acuerdo-socios-design.md`
Plan: `docs/superpowers/plans/2026-09-24-acuerdo-socios.md`

## Tareas

- [ ] [Codex] Tarea 1 — Catálogo y estado por tema (`src/features/agreement/topics.ts`, `status.ts`)
- [ ] [Codex] Tarea 2 — Migración SQL y cobertura en PGlite
- [ ] [Claude] Tarea 3 — Dominio, contrato y mock
- [ ] [Codex] Tarea 4 — Repositorio de Supabase
- [ ] [Codex] Tarea 5 — Hook `useAgreement` y `TopicRow`
- [ ] [Claude] Tarea 6 — Tarjeta, pantalla, ruta y cruce con `chat`
- [ ] [Claude] Tarea 7 — E2E en la variante `supabase`
- [ ] [Claude] Tarea 8 — Verificación final y cierre
- [ ] [comprobador] Recorrer el acuerdo en el emulador (mock y Supabase local)

## Pendiente del usuario

- [ ] Aplicar `supabase/migrations/20260924000200_agreement_answers.sql` en
      `grrzmzktrhksbttpbblg` por el SQL Editor. Hasta entonces, `Schema drift`
      remoto está rojo **a propósito** (excepción con fecha, ver Tarea 8).

## Hallazgos del comprobador
```

- [ ] **Step 3: Añadir el hito a `TODO.md`**

Bajo «## Fase 3 — Verificación de autoría de enlaces», una sección nueva:

```markdown
## Fase 3 — Acuerdo de socios
- [ ] Conversación guiada a ciegas en matches Par — spec y plan del 2026-09-24 (`docs/superpowers/specs/2026-09-24-acuerdo-socios-design.md`, `.../plans/2026-09-24-acuerdo-socios.md`), bloque 12 `acuerdo` en `PLAN.md`, detalle en `todo/acuerdo.md`.
```

- [ ] **Step 4: Corregir la spec con las cinco desviaciones**

En la spec: cambia la fila de `session-errors.ts` de la tabla de §3 por `src/data/mock/store.ts`. En «Contrato», los errores pasan a `src/data/agreement.ts`. En «Supabase», `match_agreement` pasa a `plpgsql` y lanza `LI004`/`LI005`. En «Tests → E2E», la variante pasa a `supabase` y se explica por qué (control negativo). En el `create table`, añade la línea `revoke insert, update, delete on table public.agreement_answers from authenticated;`.

- [ ] **Step 5: Commit**

```bash
git add -N -- docs/plan/todo/acuerdo.md
git commit -m "docs(acuerdo): alta del bloque 12 y desviaciones del plan en la spec" -- docs/plan/PLAN.md docs/plan/TODO.md docs/plan/todo/acuerdo.md docs/superpowers/specs/2026-09-24-acuerdo-socios-design.md
```

---

### Task 1: Catálogo y estado por tema [Codex]

Alcance cerrado a una carpeta nueva y criterio objetivo (tests en verde).

**Files:**
- Create: `src/features/agreement/topics.ts`
- Create: `src/features/agreement/status.ts`
- Test: `src/features/agreement/topics.test.ts`, `src/features/agreement/status.test.ts`

**Interfaces:**
- Consumes: el tipo `AgreementTopicView` de `@/data`, **que todavía no existe** (nace en la Tarea 3). En esta tarea decláralo localmente en `status.ts` con la forma exacta de abajo; la Tarea 3 lo mueve a `src/data/types.ts` y cambia el import.
- Produces:
  - `UNDECIDED = 'sin-decidir'`
  - `type AgreementSection = 'compromiso' | 'reparto' | 'salida'`
  - `interface AgreementOption { key: string; label: string }`
  - `interface AgreementTopic { key: string; section: AgreementSection; question: string; options: readonly AgreementOption[] }`
  - `AGREEMENT_CATALOG_VERSION = 1`, `AGREEMENT_CATALOG: readonly AgreementTopic[]`, `SECTION_LABELS: Record<AgreementSection, string>`
  - `topicByKey(key: string): AgreementTopic | undefined`
  - `optionsOf(topic: AgreementTopic): readonly AgreementOption[]` (las del tema + «Aún no lo sé» al final)
  - `optionLabel(topicKey: string, optionKey: string): string | undefined`
  - `isKnownAnswer(topicKey: string, optionKey: string): boolean`
  - `type TopicStatus = 'pendiente' | 'coincidis' | 'distinto' | 'por-hablar'`
  - `topicStatus(topicKey: string, view: AgreementTopicView | undefined): TopicStatus`
  - `summarize(views: readonly AgreementTopicView[]): { compared: number; different: number; theirsAhead: number; total: number }`

- [ ] **Step 1: Escribir el test del catálogo**

`src/features/agreement/topics.test.ts`:

```ts
import {
  AGREEMENT_CATALOG,
  UNDECIDED,
  isKnownAnswer,
  optionLabel,
  optionsOf,
  topicByKey,
} from './topics';

const KEY = /^[a-z0-9-]{1,40}$/;

describe('catálogo del acuerdo', () => {
  it('tiene ocho temas en el orden de la spec', () => {
    expect(AGREEMENT_CATALOG.map((topic) => topic.key)).toEqual([
      'dedicacion',
      'horizonte',
      'dinero-propio',
      'participacion',
      'consolidacion',
      'decisiones',
      'si-uno-se-va',
      'lo-creado',
    ]);
  });

  it('todas las claves cumplen el check de la base y no se repiten', () => {
    const topicKeys = AGREEMENT_CATALOG.map((topic) => topic.key);
    expect(new Set(topicKeys).size).toBe(topicKeys.length);
    for (const topic of AGREEMENT_CATALOG) {
      expect(topic.key).toMatch(KEY);
      const optionKeys = optionsOf(topic).map((option) => option.key);
      expect(new Set(optionKeys).size).toBe(optionKeys.length);
      for (const key of optionKeys) expect(key).toMatch(KEY);
    }
  });

  it('cada tema acepta «Aún no lo sé» como última opción', () => {
    for (const topic of AGREEMENT_CATALOG) {
      expect(optionsOf(topic).at(-1)).toEqual({ key: UNDECIDED, label: 'Aún no lo sé' });
      expect(isKnownAnswer(topic.key, UNDECIDED)).toBe(true);
    }
  });

  it('ninguna opción habla de contratar, sueldo ni jefe', () => {
    const text = AGREEMENT_CATALOG.flatMap((topic) => [
      topic.question,
      ...topic.options.map((option) => option.label),
    ]).join(' ');
    expect(text).not.toMatch(/contrat|sueldo|salario|jefe|empleado|trabaja para/i);
  });

  it('resuelve etiquetas y rechaza claves desconocidas', () => {
    expect(topicByKey('dedicacion')?.section).toBe('compromiso');
    expect(optionLabel('dedicacion', 'completa')).toBe('Jornada completa');
    expect(optionLabel('dedicacion', 'no-existe')).toBeUndefined();
    expect(isKnownAnswer('no-existe', 'completa')).toBe(false);
    expect(isKnownAnswer('dedicacion', 'partes-iguales')).toBe(false);
  });
});
```

- [ ] **Step 2: Ejecutarlo y ver que falla**

Run: `npx jest src/features/agreement/topics.test.ts`
Expected: FAIL con `Cannot find module './topics'`.

- [ ] **Step 3: Implementar `topics.ts`**

```ts
/**
 * Catálogo del acuerdo de socios: ocho temas difíciles en tres secciones.
 *
 * Vive en el cliente a propósito (spec § «Por qué el catálogo vive en el
 * cliente»): la base solo guarda claves y no sabe cuáles son válidas. Las
 * claves cumplen `^[a-z0-9-]{1,40}$`, el `check` de la migración; el texto
 * visible se puede pulir sin migrar.
 *
 * Nada de esto es asesoría legal ni recomienda una opción, y ninguna opción
 * huele a «uno contrata al otro» (`CONCEPTO.md`).
 */

export const AGREEMENT_CATALOG_VERSION = 1;

/** Opción comodín de todos los temas. Nunca cuenta como desacuerdo. */
export const UNDECIDED = 'sin-decidir';

export type AgreementSection = 'compromiso' | 'reparto' | 'salida';

export interface AgreementOption {
  key: string;
  label: string;
}

export interface AgreementTopic {
  key: string;
  section: AgreementSection;
  question: string;
  /** Sin «Aún no lo sé»: lo añade `optionsOf`. */
  options: readonly AgreementOption[];
}

export const SECTION_LABELS: Record<AgreementSection, string> = {
  compromiso: 'Compromiso',
  reparto: 'Reparto',
  salida: 'Salida',
};

const UNDECIDED_OPTION: AgreementOption = { key: UNDECIDED, label: 'Aún no lo sé' };

export const AGREEMENT_CATALOG: readonly AgreementTopic[] = [
  {
    key: 'dedicacion',
    section: 'compromiso',
    question: '¿Cuánto tiempo le vas a dedicar los próximos 6 meses?',
    options: [
      { key: 'menos-10h', label: 'Menos de 10 h a la semana' },
      { key: '10-25h', label: 'Entre 10 y 25 h a la semana' },
      { key: 'media-jornada', label: 'Media jornada' },
      { key: 'completa', label: 'Jornada completa' },
    ],
  },
  {
    key: 'horizonte',
    section: 'compromiso',
    question: '¿Cuánto le das antes de replantearlo?',
    options: [
      { key: '3-meses', label: 'Unos 3 meses' },
      { key: '1-ano', label: 'Un año' },
      { key: 'hasta-que-funcione', label: 'Hasta que funcione o se acabe' },
    ],
  },
  {
    key: 'dinero-propio',
    section: 'compromiso',
    question: '¿Cuánto dinero tuyo estás dispuesto a poner?',
    options: [
      { key: 'nada', label: 'Nada' },
      { key: 'gastos-pequenos', label: 'Algo para gastos pequeños' },
      { key: 'colchon-serio', label: 'Un colchón serio' },
    ],
  },
  {
    key: 'participacion',
    section: 'reparto',
    question: '¿Cómo repartiríais la participación?',
    options: [
      { key: 'partes-iguales', label: 'A partes iguales' },
      { key: 'segun-aportacion', label: 'Según lo que aporte cada uno' },
      { key: 'mas-adelante', label: 'Lo decidimos más adelante' },
    ],
  },
  {
    key: 'consolidacion',
    section: 'reparto',
    question: '¿La participación se gana con el tiempo (vesting)?',
    options: [
      { key: 'si-con-periodo', label: 'Sí, con un periodo pactado' },
      { key: 'no', label: 'No, es de cada uno desde el principio' },
    ],
  },
  {
    key: 'decisiones',
    section: 'reparto',
    question: '¿Cómo se decide cuando no estáis de acuerdo?',
    options: [
      { key: 'consenso', label: 'Hasta llegar a un consenso' },
      { key: 'cada-uno-su-area', label: 'Cada uno decide en su área' },
      { key: 'desempate-pactado', label: 'Con un desempate pactado de antemano' },
    ],
  },
  {
    key: 'si-uno-se-va',
    section: 'salida',
    question: 'Si uno lo deja en el primer año…',
    options: [
      { key: 'se-va-sin-nada', label: 'Se va sin participación' },
      { key: 'conserva-lo-ganado', label: 'Conserva lo que ya haya ganado' },
      { key: 'lo-hablamos-entonces', label: 'Lo hablamos cuando pase' },
    ],
  },
  {
    key: 'lo-creado',
    section: 'salida',
    question: 'Lo que cada uno crea antes de constituir, ¿de quién es?',
    options: [
      { key: 'del-proyecto', label: 'Del proyecto, desde el primer día' },
      { key: 'de-quien-lo-hizo', label: 'De quien lo hizo, hasta constituir' },
    ],
  },
];

export function topicByKey(key: string): AgreementTopic | undefined {
  return AGREEMENT_CATALOG.find((topic) => topic.key === key);
}

export function optionsOf(topic: AgreementTopic): readonly AgreementOption[] {
  return [...topic.options, UNDECIDED_OPTION];
}

export function optionLabel(topicKey: string, optionKey: string): string | undefined {
  const topic = topicByKey(topicKey);
  return topic && optionsOf(topic).find((option) => option.key === optionKey)?.label;
}

/** Tema y opción existen en este catálogo. Lo demás se pinta como no respondido. */
export function isKnownAnswer(topicKey: string, optionKey: string): boolean {
  return optionLabel(topicKey, optionKey) !== undefined;
}
```

- [ ] **Step 4: Ejecutar el test del catálogo**

Run: `npx jest src/features/agreement/topics.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Escribir el test del estado**

`src/features/agreement/status.test.ts`. Incluye el punto 5 del Review Focus (clave de opción desconocida en mi fila):

```ts
import { summarize, topicStatus } from './status';

import type { AgreementTopicView } from './status';

const answer = (option: string) => ({
  topic: 'dedicacion',
  option,
  note: null,
  updatedAt: '2026-09-24T10:00:00.000Z',
});
const view = (
  mine: AgreementTopicView['mine'],
  theirs: AgreementTopicView['theirs']
): AgreementTopicView => ({ topic: 'dedicacion', mine, theirs });

describe('topicStatus', () => {
  it('sin vista ni respuesta propia: pendiente', () => {
    expect(topicStatus('dedicacion', undefined)).toBe('pendiente');
    expect(topicStatus('dedicacion', view(null, 'hidden'))).toBe('pendiente');
  });

  it('con la mía y sin la suya: pendiente', () => {
    expect(topicStatus('dedicacion', view(answer('completa'), null))).toBe('pendiente');
  });

  it('misma opción: coincidis', () => {
    expect(topicStatus('dedicacion', view(answer('completa'), answer('completa')))).toBe(
      'coincidis'
    );
  });

  it('opciones distintas: distinto', () => {
    expect(topicStatus('dedicacion', view(answer('completa'), answer('10-25h')))).toBe('distinto');
  });

  it('alguna es sin-decidir: por-hablar, aunque las dos lo sean', () => {
    expect(topicStatus('dedicacion', view(answer('sin-decidir'), answer('completa')))).toBe(
      'por-hablar'
    );
    expect(topicStatus('dedicacion', view(answer('sin-decidir'), answer('sin-decidir')))).toBe(
      'por-hablar'
    );
  });

  it('hidden con respuesta propia no revela nada: pendiente', () => {
    expect(topicStatus('dedicacion', view(answer('completa'), 'hidden'))).toBe('pendiente');
  });

  it('mi opción desconocida (catálogo viejo) cuenta como no respondida', () => {
    expect(topicStatus('dedicacion', view(answer('opcion-retirada'), answer('completa')))).toBe(
      'pendiente'
    );
  });

  it('la opción desconocida del otro tampoco se compara', () => {
    expect(topicStatus('dedicacion', view(answer('completa'), answer('opcion-retirada')))).toBe(
      'pendiente'
    );
  });
});

describe('summarize', () => {
  it('cuenta comparados, distintos y los que el otro lleva por delante', () => {
    const views: AgreementTopicView[] = [
      { topic: 'dedicacion', mine: answer('completa'), theirs: answer('completa') },
      {
        topic: 'horizonte',
        mine: { ...answer('1-ano'), topic: 'horizonte' },
        theirs: { ...answer('3-meses'), topic: 'horizonte' },
      },
      { topic: 'decisiones', mine: null, theirs: 'hidden' },
      { topic: 'tema-retirado', mine: null, theirs: 'hidden' },
    ];
    expect(summarize(views)).toEqual({ compared: 2, different: 1, theirsAhead: 1, total: 8 });
  });
});
```

- [ ] **Step 6: Ejecutarlo y ver que falla**

Run: `npx jest src/features/agreement/status.test.ts`
Expected: FAIL con `Cannot find module './status'`.

- [ ] **Step 7: Implementar `status.ts`**

```ts
/**
 * Estado de un tema del acuerdo visto desde el usuario actual (spec § 1).
 *
 * El ciego lo impone el servidor. Aquí solo se repite la regla por si acaso: un
 * `'hidden'` nunca se trata como respondido, y una clave que este catálogo no
 * conoce cuenta como no respondida en los dos lados.
 */

import { AGREEMENT_CATALOG, UNDECIDED, isKnownAnswer, topicByKey } from './topics';

// Se mueve a `@/data` en la Tarea 3; hasta entonces vive aquí con esta forma exacta.
export interface AgreementAnswer {
  topic: string;
  option: string;
  note: string | null;
  updatedAt: string;
}
export interface AgreementTopicView {
  topic: string;
  mine: AgreementAnswer | null;
  theirs: AgreementAnswer | 'hidden' | null;
}

export type TopicStatus = 'pendiente' | 'coincidis' | 'distinto' | 'por-hablar';

export function topicStatus(topicKey: string, view: AgreementTopicView | undefined): TopicStatus {
  const mine = view?.mine && isKnownAnswer(topicKey, view.mine.option) ? view.mine : null;
  if (!mine) return 'pendiente';
  const theirs = view?.theirs;
  if (!theirs || theirs === 'hidden' || !isKnownAnswer(topicKey, theirs.option)) {
    return 'pendiente';
  }
  if (mine.option === UNDECIDED || theirs.option === UNDECIDED) return 'por-hablar';
  return mine.option === theirs.option ? 'coincidis' : 'distinto';
}

/** Lo que pinta la tarjeta del chat. Solo cuenta temas de este catálogo. */
export function summarize(views: readonly AgreementTopicView[]): {
  compared: number;
  different: number;
  theirsAhead: number;
  total: number;
} {
  let compared = 0;
  let different = 0;
  let theirsAhead = 0;
  for (const view of views) {
    if (!topicByKey(view.topic)) continue;
    const status = topicStatus(view.topic, view);
    if (status !== 'pendiente') compared++;
    if (status === 'distinto') different++;
    const mineKnown = view.mine !== null && isKnownAnswer(view.topic, view.mine.option);
    if (view.theirs !== null && !mineKnown) theirsAhead++;
  }
  return { compared, different, theirsAhead, total: AGREEMENT_CATALOG.length };
}
```

- [ ] **Step 8: Ejecutar los dos tests, `tsc` y lint**

Run: `npx jest src/features/agreement && npx tsc --noEmit && npm run lint`
Expected: PASS (14 tests); `tsc` y lint limpios.

- [ ] **Step 9: Commit**

```bash
npx prettier --write src/features/agreement
git add -N -- src/features/agreement/topics.ts src/features/agreement/topics.test.ts src/features/agreement/status.ts src/features/agreement/status.test.ts
git commit -m "feat(acuerdo): catálogo de ocho temas y estado por tema" -- src/features/agreement/topics.ts src/features/agreement/topics.test.ts src/features/agreement/status.ts src/features/agreement/status.test.ts
```

Marca la Tarea 1 en `docs/plan/todo/acuerdo.md` y quita su etiqueta `[Codex]` (commit aparte, con pathspec).

---

### Task 2: Migración SQL y cobertura en PGlite [Codex]

Alcance: una migración nueva y un bloque nuevo dentro del test SQL. Criterio objetivo: `npm run test:schema` en verde.

**Files:**
- Create: `supabase/migrations/20260924000200_agreement_answers.sql` (si al empezar ya existe una migración `20260924000200`, usa el siguiente sufijo libre y corrige el nombre en la spec, en el plan y en `todo/acuerdo.md`)
- Modify: `supabase/schema-embedded.test.mjs` (bloque nuevo inmediatamente **antes** de la línea `// --- Verificación de GitHub ---`, hacia la línea 425)
- Modify (solo si `npm run test:schema` lo pide): `supabase/drift-check.mjs`

**Interfaces:**
- Consumes: `public.matches (id, profile_a, profile_b, mode)` y `public.profiles`.
- Produces:
  - la tabla `public.agreement_answers (match_id, profile_id, topic, option, note, updated_at)`
  - `public.answer_agreement_topic(p_match_id uuid, p_topic text, p_option text, p_note text default null) returns public.agreement_answers`
  - `public.match_agreement(p_match_id uuid) returns table (topic text, mine_option text, mine_note text, mine_updated_at timestamptz, theirs_answered boolean, theirs_option text, theirs_note text, theirs_updated_at timestamptz)`
  - errcodes `LI004` (match ajeno) y `LI005` (match no Par)

- [ ] **Step 1: Escribir el test SQL (falla porque la tabla no existe)**

Pega este bloque justo antes de `// --- Verificación de GitHub ---` en `supabase/schema-embedded.test.mjs`. Reutiliza `ana` y `bea` y declara un tercer id `cai`. Si `cai` ya existe en el archivo, usa otro nombre y cambia sus usos en este bloque.

```js
    // --- Acuerdo de socios ---------------------------------------------------
    //
    // El test central del bloque: `match_agreement` NO enseña la respuesta del
    // otro en un tema si tú no has respondido ese tema, pero sí dice que la ha
    // dado. Es el ciego, y lo impone Postgres: si se rompe aquí, la UI no tiene
    // nada que tapar. Además: solo matches Par (LI005), solo miembros (LI004),
    // solo por RPC (un insert directo de `authenticated` falla), y los `check`.
    const cai = '00000000-0000-4000-8000-00000000000c';
    const par = '00000000-0000-4000-8000-0000000acce0';
    const lockin = '00000000-0000-4000-8000-0000000acce1';
    await db.exec(`begin;
      insert into auth.users (id, email) values
        ('${ana}', 'ana@lockin.test'), ('${bea}', 'bea@lockin.test'), ('${cai}', 'cai@lockin.test');
      insert into public.profiles (
        id, name, age, location, timezone, avatar_initials, specialties,
        looking_for, starting_point, availability_hours_per_week,
        availability_bands, ambition
      ) values
        ('${ana}', 'Ana', 30, 'Madrid', 'Europe/Madrid', 'A',
         array['dev']::public.specialty[], 'par', 'solo-ganas', 10,
         array['tarde']::public.time_band[], 'equilibrado'),
        ('${bea}', 'Bea', 31, 'Madrid', 'Europe/Madrid', 'B',
         array['diseno']::public.specialty[], 'par', 'solo-ganas', 10,
         array['tarde']::public.time_band[], 'equilibrado'),
        ('${cai}', 'Cai', 32, 'Madrid', 'Europe/Madrid', 'C',
         array['datos']::public.specialty[], 'lockin', 'solo-ganas', 10,
         array['tarde']::public.time_band[], 'equilibrado');
      insert into public.matches (id, profile_a, profile_b, mode) values
        ('${par}', '${ana}', '${bea}', 'par'),
        ('${lockin}', '${ana}', '${cai}', 'lockin');`);
    // Sustituir `auth.uid()` exige ser el dueño, no `authenticated`: se sale
    // del rol, se cambia el actor y se vuelve a entrar.
    const actingAs = (id) =>
      db.exec(`reset role;
        create or replace function auth.uid() returns uuid language sql as $$ select '${id}'::uuid $$;
        set local role authenticated;`);
    const sonda = async (sql) => {
      await db.exec('savepoint sonda;');
      try {
        await db.query(sql);
        return 'sin error';
      } catch (error) {
        return error.code ?? error.message;
      } finally {
        await db.exec('rollback to savepoint sonda;');
      }
    };
    const responde = (topic, option, note = null) =>
      db.query(
        `select * from public.answer_agreement_topic('${par}', '${topic}', '${option}', ${
          note === null ? 'null' : `'${note}'`
        })`
      );
    const vista = async () =>
      (await db.query(`select * from public.match_agreement('${par}')`)).rows;

    // Bea responde dos temas; Ana, solo uno de ellos.
    await actingAs(bea);
    await responde('dedicacion', 'completa', 'Lo dejo todo');
    await responde('decisiones', 'consenso');
    await actingAs(ana);
    await responde('dedicacion', '10-25h');
    await responde('horizonte', '1-ano');
    // Responder otra vez sustituye, no duplica.
    await responde('horizonte', '3-meses', 'Mejor corto');
    const deAna = Object.fromEntries((await vista()).map((row) => [row.topic, row]));
    assert.deepEqual(
      {
        temas: Object.keys(deAna).sort(),
        dedicacion_suya: [deAna.dedicacion.theirs_option, deAna.dedicacion.theirs_note],
        decisiones_oculta: [
          deAna.decisiones.theirs_answered,
          deAna.decisiones.theirs_option,
          deAna.decisiones.theirs_note,
          deAna.decisiones.theirs_updated_at,
        ],
        horizonte: [deAna.horizonte.mine_option, deAna.horizonte.mine_note, deAna.horizonte.theirs_answered],
      },
      {
        temas: ['decisiones', 'dedicacion', 'horizonte'],
        dedicacion_suya: ['completa', 'Lo dejo todo'],
        decisiones_oculta: [true, null, null, null],
        horizonte: ['3-meses', 'Mejor corto', false],
      },
      'el ciego: sin tu respuesta, sabes que la hay pero no cuál es'
    );
    assert.deepEqual(
      {
        lockin: await sonda(
          `select public.answer_agreement_topic('${lockin}', 'dedicacion', 'completa', null)`
        ),
        lockin_lectura: await sonda(`select * from public.match_agreement('${lockin}')`),
        clave_invalida: await sonda(
          `select public.answer_agreement_topic('${par}', 'Dedicación!', 'completa', null)`
        ),
        nota_larga: await sonda(
          `select public.answer_agreement_topic('${par}', 'dedicacion', 'completa', '${'x'.repeat(281)}')`
        ),
        nota_vacia: await sonda(
          `select public.answer_agreement_topic('${par}', 'dedicacion', 'completa', '')`
        ),
        insert_directo: await sonda(
          `insert into public.agreement_answers (match_id, profile_id, topic, option)
           values ('${par}', '${ana}', 'dinero-propio', 'nada')`
        ),
        update_directo: await sonda(
          `update public.agreement_answers set option = 'completa' where profile_id = '${bea}'`
        ),
      },
      {
        lockin: 'LI005',
        lockin_lectura: 'LI005',
        clave_invalida: '23514',
        nota_larga: '23514',
        nota_vacia: '23514',
        insert_directo: '42501',
        update_directo: '42501',
      }
    );
    // Lectura directa de la tabla: solo las tuyas.
    const directas = await db.query('select profile_id from public.agreement_answers');
    assert.deepEqual([...new Set(directas.rows.map((row) => row.profile_id))], [ana]);
    // Un tercero que no está en el match no lee ni escribe.
    await actingAs(cai);
    assert.deepEqual(
      {
        lee: await sonda(`select * from public.match_agreement('${par}')`),
        escribe: await sonda(
          `select public.answer_agreement_topic('${par}', 'dedicacion', 'completa', null)`
        ),
      },
      { lee: 'LI004', escribe: 'LI004' }
    );
    await db.exec('reset role');
    // Ni publicación en realtime, ni ejecución para anon.
    assert.doesNotMatch(expected, /publish\s+supabase_realtime agreement_answers/);
    const ejecutables = await db.query(`select
        has_function_privilege('anon', 'public.match_agreement(uuid)', 'EXECUTE') as anon_lee,
        has_function_privilege('anon', 'public.answer_agreement_topic(uuid, text, text, text)', 'EXECUTE') as anon_escribe,
        has_function_privilege('authenticated', 'public.match_agreement(uuid)', 'EXECUTE') as auth_lee`);
    assert.deepEqual(ejecutables.rows[0], { anon_lee: false, anon_escribe: false, auth_lee: true });
    await db.exec('rollback;');
```

- [ ] **Step 2: Ejecutarlo y ver que falla**

Run: `npm run test:schema`
Expected: FAIL en el bloque nuevo, con `function public.answer_agreement_topic(...) does not exist` (o `relation "public.agreement_answers" does not exist`).

- [ ] **Step 3: Escribir la migración**

`supabase/migrations/20260924000200_agreement_answers.sql`:

```sql
-- LockIn — acuerdo de socios a ciegas (Fase 3).
--
-- Diseño: docs/superpowers/specs/2026-09-24-acuerdo-socios-design.md.
-- Patrón de `20260915000100_session_ratings.sql`: SECURITY DEFINER con
-- `search_path` vacío y nombres cualificados, `revoke`/`grant` al final
-- desde `public, anon` (lección de `20260924000100`).
--
-- La tabla solo se lee en las filas propias. La vista de la pareja la da
-- `match_agreement()`, que es donde se impone el ciego: la respuesta del otro
-- en un tema solo sale si tú ya respondiste ese tema. Escribir va por
-- `answer_agreement_topic()`: authenticated no tiene insert/update/delete.
--
-- El catálogo de temas vive en el cliente (`src/features/agreement/topics.ts`).
-- Aquí solo hay claves con formato: una clave desconocida solo estropea la
-- respuesta de quien la escribió.
--
-- Sin realtime: con la política de «solo las tuyas», `postgres_changes` nunca
-- entregaría la fila del otro.


-- ---------------------------------------------------------------------------
-- Tabla
-- ---------------------------------------------------------------------------

create table public.agreement_answers (
  match_id uuid not null references public.matches (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  topic text not null check (topic ~ '^[a-z0-9-]{1,40}$'),
  option text not null check (option ~ '^[a-z0-9-]{1,40}$'),
  -- La nota vacía se normaliza a null en el cliente; aquí vacía es un error.
  note text check (note is null or char_length(note) between 1 and 280),
  updated_at timestamptz not null default now(),
  primary key (match_id, profile_id, topic)
);

comment on table public.agreement_answers is
  'Respuesta de una persona a un tema del acuerdo de socios de un match Par. Solo se leen las propias; la vista de la pareja es match_agreement().';


-- ---------------------------------------------------------------------------
-- RLS y permisos de tabla
-- ---------------------------------------------------------------------------

alter table public.agreement_answers enable row level security;

revoke all on table public.agreement_answers from anon;
-- Supabase concede insert/update/delete a authenticated por defecto en
-- `public`. RLS ya los bloquearía sin política; se cierran también por permiso.
revoke insert, update, delete on table public.agreement_answers from authenticated;

create policy "agreement_answers: solo lees las tuyas"
  on public.agreement_answers for select
  to authenticated
  using (profile_id = (select auth.uid()));


-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function public.answer_agreement_topic(
  p_match_id uuid,
  p_topic text,
  p_option text,
  p_note text default null
)
returns public.agreement_answers
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_match public.matches;
  v_row public.agreement_answers;
begin
  select * into v_match from public.matches m where m.id = p_match_id;
  if not found or v_actor is null or v_actor not in (v_match.profile_a, v_match.profile_b) then
    raise exception 'answer_agreement_topic: el match no es tuyo' using errcode = 'LI004';
  end if;
  if v_match.mode <> 'par' then
    raise exception 'answer_agreement_topic: el acuerdo es solo para matches de cofundador'
      using errcode = 'LI005';
  end if;

  insert into public.agreement_answers as a (match_id, profile_id, topic, option, note)
  values (p_match_id, v_actor, p_topic, p_option, p_note)
  on conflict (match_id, profile_id, topic) do update
    set option = excluded.option,
        note = excluded.note,
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$fn$;

-- Una fila por tema con alguna respuesta de los dos. Las columnas `theirs_*`
-- son null salvo que exista mi respuesta a ese tema: es un `case` por columna,
-- no un filtro de filas, para que `theirs_answered` salga aunque yo no haya
-- respondido. Eso es el ciego.
create or replace function public.match_agreement(p_match_id uuid)
returns table (
  topic text,
  mine_option text,
  mine_note text,
  mine_updated_at timestamptz,
  theirs_answered boolean,
  theirs_option text,
  theirs_note text,
  theirs_updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $fn$
#variable_conflict use_column
declare
  v_actor uuid := (select auth.uid());
  v_match public.matches;
begin
  select * into v_match from public.matches m where m.id = p_match_id;
  if not found or v_actor is null or v_actor not in (v_match.profile_a, v_match.profile_b) then
    raise exception 'match_agreement: el match no es tuyo' using errcode = 'LI004';
  end if;
  if v_match.mode <> 'par' then
    raise exception 'match_agreement: el acuerdo es solo para matches de cofundador'
      using errcode = 'LI005';
  end if;

  return query
    select coalesce(mine.topic, theirs.topic),
           mine.option,
           mine.note,
           mine.updated_at,
           theirs.topic is not null,
           case when mine.topic is not null then theirs.option end,
           case when mine.topic is not null then theirs.note end,
           case when mine.topic is not null then theirs.updated_at end
    from (
      select a.topic, a.option, a.note, a.updated_at
      from public.agreement_answers a
      where a.match_id = p_match_id and a.profile_id = v_actor
    ) mine
    full outer join (
      select a.topic, a.option, a.note, a.updated_at
      from public.agreement_answers a
      where a.match_id = p_match_id and a.profile_id <> v_actor
    ) theirs on theirs.topic = mine.topic
    order by 1;
end;
$fn$;

revoke execute on function public.answer_agreement_topic(uuid, text, text, text) from public, anon;
revoke execute on function public.match_agreement(uuid) from public, anon;
grant execute on function public.answer_agreement_topic(uuid, text, text, text) to authenticated;
grant execute on function public.match_agreement(uuid) to authenticated;
```

- [ ] **Step 4: Ejecutar `test:schema`**

Run: `npm run test:schema`
Expected: PASS entero, incluidos `drift-check.test.mjs` y `cleanup.test.mjs`.

Si falla:
- **`drift-check.test.mjs` o el teardown** no conocen la tabla o las funciones nuevas: enséñale a `supabase/drift-check.mjs` lo mínimo para parsearlas, igual que se hizo con `alter table … add column` (ver la nota del 2026-09-07 en `TODO.md`), y vuelve a correr.
- **El parser de Postgres se queja de `option` como nombre de columna**: para y dilo. No lo renombres por tu cuenta: el nombre sale de la spec y lo usan las Tareas 3 y 4.
- **`insert_directo` da un código que no es `42501`**: para y dilo. Significa que la emulación de privilegios por defecto no es la que este plan supone.

- [ ] **Step 5: Commit**

```bash
npx prettier --write supabase/schema-embedded.test.mjs
git add -N -- supabase/migrations/20260924000200_agreement_answers.sql
git commit -m "feat(acuerdo): tabla agreement_answers y RPCs a ciegas, cubiertas en PGlite" -- supabase/migrations/20260924000200_agreement_answers.sql supabase/schema-embedded.test.mjs
```

Si tocaste `drift-check.mjs`, añádelo al pathspec. Marca la Tarea 2 en `todo/acuerdo.md`.

---

### Task 3: Dominio, contrato y mock [Claude]

Cruza `arquitecto` (tipos, interfaz, contrato, fachada) y toca el mock de los dos backends: por eso es `[Claude]`.

**Aviso de orden:** esta tarea añade `agreement` a `Repositories`, así que `npx tsc --noEmit` queda **rojo solo en `src/data/supabase/`** hasta la Tarea 4. No hagas push entre la 3 y la 4. Si trabajas en una rama compartida con otros, haz las dos seguidas.

**Files:**
- Modify: `src/data/types.ts` (tipos al final del archivo)
- Create: `src/data/agreement.ts` + `src/data/agreement.test.ts`
- Modify: `src/data/repositories.ts` (`AgreementRepository` y el campo `agreement` en `Repositories`)
- Modify: `src/data/index.ts` (`export * from './agreement';`)
- Modify: `src/data/active.ts` (getter `agreement`)
- Modify: `src/data/mock/store.ts` (`agreementAnswers`, `agreementSeeded`)
- Modify: `src/data/mock/seed.ts` (`SEED_AGREEMENT_ANSWERS`)
- Create: `src/data/mock/agreement.ts`
- Modify: `src/data/mock/index.ts` (registro y re-export)
- Modify: `src/data/repositories.contract.ts` (dos métodos en `ContractFixture` y el `describe('acuerdo de socios')`)
- Modify: `src/data/mock/index.test.ts` (fixture)
- Modify: `src/features/agreement/status.ts` (quita los tipos locales e importa de `@/data`)

**Interfaces:**
- Consumes: `AgreementTopicView` con la forma de la Tarea 1.
- Produces:
  - `@/data`: `AgreementAnswer`, `AgreementTopicView`, `AgreementAnswerInput`, `AgreementRepository`, `AgreementForbiddenError`, `AgreementModeError`, `AgreementInvalidError`, `AGREEMENT_NOTE_MAX = 280`, `normalizeNote(note?: string | null): string | null`, `validateAnswerInput(input: AgreementAnswerInput): void`, `StoredAgreementAnswer`, `agreementViews(rows: readonly StoredAgreementAnswer[], actorId: string): AgreementTopicView[]`
  - `Repositories.agreement: AgreementRepository` con `get(matchId): Promise<AgreementTopicView[]>` y `answer(input): Promise<AgreementTopicView>`
  - `@/data/mock`: `createMockAgreementRepository(actorId: string, store?: MockStore): AgreementRepository`
  - `ContractFixture.counterpartAgreement(): AgreementRepository` y `ContractFixture.outsiderAgreement(): AgreementRepository`

- [ ] **Step 1: Tipos de dominio**

Al final de `src/data/types.ts`:

```ts
/** Respuesta de una persona a un tema del acuerdo de socios (Fase 3). */
export interface AgreementAnswer {
  /** Clave del tema. El dominio no conoce el catálogo: vive en `features/agreement`. */
  topic: string;
  option: string;
  /** Nota libre opcional, 1–280 caracteres. `null` si no hay. */
  note: string | null;
  updatedAt: string;
}

/** Un tema del acuerdo visto desde el usuario actual. */
export interface AgreementTopicView {
  topic: string;
  mine: AgreementAnswer | null;
  /**
   * La respuesta de la otra persona. `'hidden'` = ya respondió pero tú aún no
   * (el ciego); `null` = no ha respondido.
   */
  theirs: AgreementAnswer | 'hidden' | null;
}

/** Datos para responder un tema. El repositorio pone autor y fecha. */
export interface AgreementAnswerInput {
  matchId: string;
  topic: string;
  option: string;
  /** Se recorta; vacía o solo espacios se guarda como `null`. */
  note?: string | null;
}
```

- [ ] **Step 2: Test de las piezas puras de `src/data/agreement.ts`**

`src/data/agreement.test.ts`:

```ts
import {
  AGREEMENT_NOTE_MAX,
  AgreementInvalidError,
  agreementViews,
  normalizeNote,
  validateAnswerInput,
} from './agreement';

import type { StoredAgreementAnswer } from './agreement';

const row = (profileId: string, topic: string, option: string): StoredAgreementAnswer => ({
  matchId: 'm1',
  profileId,
  topic,
  option,
  note: null,
  updatedAt: '2026-09-24T10:00:00.000Z',
});

describe('normalizeNote', () => {
  it('recorta y convierte lo vacío en null', () => {
    expect(normalizeNote('  hola  ')).toBe('hola');
    expect(normalizeNote('   ')).toBeNull();
    expect(normalizeNote('')).toBeNull();
    expect(normalizeNote(null)).toBeNull();
    expect(normalizeNote(undefined)).toBeNull();
  });
});

describe('validateAnswerInput', () => {
  const ok = { matchId: 'm1', topic: 'dedicacion', option: 'completa' };

  it('acepta claves con formato y nota hasta el máximo', () => {
    expect(() => validateAnswerInput({ ...ok, note: 'x'.repeat(AGREEMENT_NOTE_MAX) })).not.toThrow();
  });

  it('rechaza claves con formato inválido', () => {
    expect(() => validateAnswerInput({ ...ok, topic: 'Dedicación!' })).toThrow(
      AgreementInvalidError
    );
    expect(() => validateAnswerInput({ ...ok, option: '' })).toThrow(AgreementInvalidError);
  });

  it('rechaza una nota de más de 280 caracteres, contada tras recortar', () => {
    expect(() => validateAnswerInput({ ...ok, note: 'x'.repeat(281) })).toThrow(
      AgreementInvalidError
    );
    expect(() =>
      validateAnswerInput({ ...ok, note: `  ${'x'.repeat(AGREEMENT_NOTE_MAX)}  ` })
    ).not.toThrow();
  });
});

describe('agreementViews: el ciego del mock, espejo de match_agreement()', () => {
  it('sin mi respuesta, la del otro sale hidden', () => {
    expect(agreementViews([row('bea', 'decisiones', 'consenso')], 'ana')).toEqual([
      { topic: 'decisiones', mine: null, theirs: 'hidden' },
    ]);
  });

  it('con las dos, se ven las dos; con solo la mía, theirs es null', () => {
    const views = agreementViews(
      [
        row('ana', 'dedicacion', '10-25h'),
        row('bea', 'dedicacion', 'completa'),
        row('ana', 'horizonte', '1-ano'),
      ],
      'ana'
    );
    expect(views.find((view) => view.topic === 'dedicacion')?.theirs).toMatchObject({
      option: 'completa',
    });
    expect(views.find((view) => view.topic === 'horizonte')?.theirs).toBeNull();
  });
});
```

- [ ] **Step 3: Ejecutarlo y ver que falla**

Run: `npx jest src/data/agreement.test.ts`
Expected: FAIL con `Cannot find module './agreement'`.

- [ ] **Step 4: Implementar `src/data/agreement.ts`**

```ts
/**
 * Reglas del acuerdo de socios compartidas por los dos backends.
 *
 * `agreementViews` es el espejo en memoria de `match_agreement()`
 * (`supabase/migrations/20260924000200_agreement_answers.sql`): si cambia la
 * regla del ciego allí, cambia aquí, y al revés.
 *
 * Errores: la UI decide qué decir mirando la clase, nunca el mensaje. En
 * Supabase salen de los `errcode` LI004, LI005 y 23514.
 */

import type { AgreementAnswer, AgreementAnswerInput, AgreementTopicView } from './types';

export const AGREEMENT_NOTE_MAX = 280;
const KEY = /^[a-z0-9-]{1,40}$/;

/** Match ajeno o inexistente. LI004. */
export class AgreementForbiddenError extends Error {
  override name = 'AgreementForbiddenError';
}

/** El match no es de Modo Par. LI005. */
export class AgreementModeError extends Error {
  override name = 'AgreementModeError';
}

/** Clave con formato inválido o nota demasiado larga. 23514, o validación previa. */
export class AgreementInvalidError extends Error {
  override name = 'AgreementInvalidError';
}

export function normalizeNote(note?: string | null): string | null {
  const trimmed = note?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

/** Lanza `AgreementInvalidError` antes de tocar la red. La base lo comprueba igual. */
export function validateAnswerInput(input: AgreementAnswerInput): void {
  if (!KEY.test(input.topic) || !KEY.test(input.option)) {
    throw new AgreementInvalidError('agreement: clave de tema u opción con formato inválido');
  }
  const note = normalizeNote(input.note);
  if (note !== null && note.length > AGREEMENT_NOTE_MAX) {
    throw new AgreementInvalidError(`agreement: la nota pasa de ${AGREEMENT_NOTE_MAX} caracteres`);
  }
}

/** Fila guardada: lo que en Postgres es `agreement_answers`. */
export interface StoredAgreementAnswer extends AgreementAnswer {
  matchId: string;
  profileId: string;
}

const strip = ({ topic, option, note, updatedAt }: StoredAgreementAnswer): AgreementAnswer => ({
  topic,
  option,
  note,
  updatedAt,
});

/** Filas de UN match → vista del actor, con el ciego aplicado. Ordenada por tema. */
export function agreementViews(
  rows: readonly StoredAgreementAnswer[],
  actorId: string
): AgreementTopicView[] {
  const topics = [...new Set(rows.map((row) => row.topic))].sort();
  return topics.map((topic) => {
    const mine = rows.find((row) => row.topic === topic && row.profileId === actorId) ?? null;
    const other = rows.find((row) => row.topic === topic && row.profileId !== actorId) ?? null;
    return {
      topic,
      mine: mine && strip(mine),
      theirs: other === null ? null : mine === null ? 'hidden' : strip(other),
    };
  });
}
```

Y en `src/data/index.ts`, después de `export * from './session-errors';`:

```ts
export * from './agreement';
```

- [ ] **Step 5: Ejecutar el test**

Run: `npx jest src/data/agreement.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Interfaz del repositorio y fachada**

En `src/data/repositories.ts`, añade `AgreementAnswerInput` y `AgreementTopicView` al `import type` de `./types`, y antes de `export interface Repositories`:

```ts
/**
 * Acuerdo de socios de un match Par (Fase 3). A ciegas por tema: la respuesta
 * de la otra persona en un tema solo se ve si tú ya respondiste ese tema.
 *
 * Errores: `AgreementForbiddenError` (match ajeno), `AgreementModeError` (match
 * no Par), `AgreementInvalidError` (clave o nota inválidas). Ver
 * `src/data/agreement.ts`.
 */
export interface AgreementRepository {
  /** Un `AgreementTopicView` por tema con alguna respuesta de los dos, por orden de tema. */
  get(matchId: string): Promise<AgreementTopicView[]>;
  /** Crea o sustituye tu respuesta a un tema. Devuelve la vista ya actualizada de ese tema. */
  answer(input: AgreementAnswerInput): Promise<AgreementTopicView>;
}
```

En `Repositories`, después de `sessions: LockInSessionRepository;`:

```ts
  agreement: AgreementRepository;
```

En `src/data/active.ts`, dentro de `export const repositories`, después del getter `sessions`:

```ts
  get agreement() {
    return resolveActive().repositories.agreement;
  },
```

- [ ] **Step 7: Estado y semilla del mock**

En `src/data/mock/store.ts`, importa el tipo (`import type { StoredAgreementAnswer } from '../agreement';`) y añade a `MockState`, después de `ratings`:

```ts
  /** Respuestas del acuerdo de socios. Cada una la ve entera solo quien la escribió. */
  agreementAnswers: StoredAgreementAnswer[];
  /** Matches en los que ya se volcaron las respuestas semilla de la contraparte. */
  agreementSeeded: Set<string>;
```

y a `initialState()`, después de `ratings: [],`:

```ts
    agreementAnswers: [],
    agreementSeeded: new Set(),
```

En `src/data/mock/seed.ts`, al final:

```ts
/**
 * Respuestas del acuerdo de socios que trae de fábrica un perfil semilla. Se
 * vuelcan en cuanto el usuario abre el acuerdo de un match Par con él, para que
 * la revelación se pueda ver sin Supabase: una que coincide con lo que el E2E y
 * los tests responden (`dedicacion` → `completa`), una distinta y una
 * `sin-decidir`. Núria es la única recíproca de Modo Par.
 */
export const SEED_AGREEMENT_ANSWERS: Record<
  string,
  readonly { topic: string; option: string; note: string | null }[]
> = {
  'seed-nuria': [
    { topic: 'dedicacion', option: 'completa', note: 'Lo dejo todo por esto.' },
    { topic: 'participacion', option: 'segun-aportacion', note: null },
    { topic: 'si-uno-se-va', option: 'sin-decidir', note: 'Nunca lo había pensado.' },
  ],
};
```

- [ ] **Step 8: El repositorio mock**

`src/data/mock/agreement.ts`:

```ts
/**
 * Acuerdo de socios del backend mock.
 *
 * Como `sessions.ts`, se construye para un actor: la suite de contrato necesita
 * a la otra persona del match respondiendo, con el mismo store.
 */

import {
  AgreementForbiddenError,
  AgreementModeError,
  agreementViews,
  normalizeNote,
  validateAnswerInput,
} from '../agreement';
import { SEED_AGREEMENT_ANSWERS } from './seed';
import { defaultMockStore } from './store';

import type { MockStore } from './store';
import type { AgreementRepository } from '../repositories';
import type { Match } from '../types';

export function createMockAgreementRepository(
  actorId: string,
  store: MockStore = defaultMockStore
): AgreementRepository {
  const nowIso = () => new Date(store.nowMs()).toISOString();

  const seedOnce = (match: Match) => {
    const state = store.state;
    if (state.agreementSeeded.has(match.id)) return;
    state.agreementSeeded.add(match.id);
    for (const profileId of match.profileIds) {
      for (const seed of SEED_AGREEMENT_ANSWERS[profileId] ?? []) {
        state.agreementAnswers.push({ ...seed, matchId: match.id, profileId, updatedAt: nowIso() });
      }
    }
  };

  /** Mismas puertas y en el mismo orden que las RPC: primero LI004, luego LI005. */
  const guard = (matchId: string) => {
    const match = store.state.matches.find((candidate) => candidate.id === matchId);
    if (!match || !match.profileIds.includes(actorId)) {
      throw new AgreementForbiddenError('agreement: el match no es tuyo');
    }
    if (match.mode !== 'par') {
      throw new AgreementModeError('agreement: el acuerdo es solo para matches de cofundador');
    }
    seedOnce(match);
  };

  const viewsOf = (matchId: string) =>
    agreementViews(
      store.state.agreementAnswers.filter((row) => row.matchId === matchId),
      actorId
    );

  return {
    async get(matchId) {
      guard(matchId);
      return viewsOf(matchId);
    },

    async answer(input) {
      validateAnswerInput(input);
      guard(input.matchId);
      const rows = store.state.agreementAnswers;
      const note = normalizeNote(input.note);
      const existing = rows.find(
        (row) =>
          row.matchId === input.matchId && row.profileId === actorId && row.topic === input.topic
      );
      if (existing) {
        existing.option = input.option;
        existing.note = note;
        existing.updatedAt = nowIso();
      } else {
        rows.push({
          matchId: input.matchId,
          profileId: actorId,
          topic: input.topic,
          option: input.option,
          note,
          updatedAt: nowIso(),
        });
      }
      return viewsOf(input.matchId).find((view) => view.topic === input.topic)!;
    },
  };
}
```

En `src/data/mock/index.ts`: importa `createMockAgreementRepository` desde `./agreement`, añade al objeto que devuelve `createMockRepositories`, después de `sessions: …`:

```ts
    agreement: createMockAgreementRepository(CURRENT_USER_ID, store),
```

y junto al `export { createMockSessionRepository, sessionsTopic } from './sessions';`:

```ts
export { createMockAgreementRepository } from './agreement';
```

- [ ] **Step 9: Casos de contrato**

En `src/data/repositories.contract.ts`:

1. Añade `AgreementForbiddenError`, `AgreementInvalidError` y `AgreementModeError` a los imports (de `./agreement`), y `AgreementRepository` y `AgreementTopicView` a los `import type`.
2. En `ContractFixture`, después de `outsiderSessions()`:

```ts
  /** Acuerdo actuando como `reciprocalAId`: la otra persona del match Par de los casos. */
  counterpartAgreement(): AgreementRepository;
  /** Acuerdo actuando como `reciprocalBId`, que no está en ese match. */
  outsiderAgreement(): AgreementRepository;
```

3. Dentro de `describeRepositoryContract`, después del `describe('sessions', …)` entero:

```ts
    describe('acuerdo de socios', () => {
      let matchId: string;
      let mine: AgreementRepository;
      let theirs: AgreementRepository;
      const topicOf = (views: AgreementTopicView[], topic: string) =>
        views.find((view) => view.topic === topic);

      // Los temas de estos casos son a propósito los que la semilla del mock NO
      // responde (`SEED_AGREEMENT_ANSWERS`): así valen igual en los dos backends.
      beforeEach(async () => {
        await fixture.prepareSwiper();
        const { match } = await repositories.discovery.recordDecision(
          fixture.reciprocalAId,
          'like'
        );
        expect(match?.mode).toBe('par');
        matchId = match!.id;
        mine = repositories.agreement;
        theirs = fixture.counterpartAgreement();
      });

      it('respondo yo y el otro no: veo la mía, y la suya es null', async () => {
        await mine.answer({ matchId, topic: 'horizonte', option: '1-ano', note: 'Y revisamos' });

        const view = topicOf(await mine.get(matchId), 'horizonte');
        expect(view?.mine).toMatchObject({ option: '1-ano', note: 'Y revisamos' });
        expect(view?.theirs).toBeNull();
      });

      it('responde el otro y yo no: sé que ha respondido, no qué (el ciego)', async () => {
        await theirs.answer({ matchId, topic: 'decisiones', option: 'consenso', note: 'secreto' });

        const views = await mine.get(matchId);
        expect(topicOf(views, 'decisiones')).toEqual({
          topic: 'decisiones',
          mine: null,
          theirs: 'hidden',
        });
        expect(JSON.stringify(views)).not.toMatch(/consenso|secreto/);
      });

      it('respondemos los dos: los dos vemos las dos, notas incluidas', async () => {
        await theirs.answer({ matchId, topic: 'lo-creado', option: 'del-proyecto', note: 'Todo' });
        await mine.answer({ matchId, topic: 'lo-creado', option: 'de-quien-lo-hizo' });

        const seen = topicOf(await mine.get(matchId), 'lo-creado');
        expect(seen?.theirs).toMatchObject({ option: 'del-proyecto', note: 'Todo' });
        const seenByThem = topicOf(await theirs.get(matchId), 'lo-creado');
        expect(seenByThem?.theirs).toMatchObject({ option: 'de-quien-lo-hizo', note: null });
      });

      it('responder otra vez sustituye, no duplica', async () => {
        const first = await mine.answer({ matchId, topic: 'horizonte', option: '1-ano' });
        await fixture.elapse(1_000);
        const second = await mine.answer({ matchId, topic: 'horizonte', option: '3-meses' });

        const views = (await mine.get(matchId)).filter((view) => view.topic === 'horizonte');
        expect(views).toHaveLength(1);
        expect(views[0].mine?.option).toBe('3-meses');
        expect(Date.parse(second.mine!.updatedAt)).toBeGreaterThanOrEqual(
          Date.parse(first.mine!.updatedAt)
        );
      });

      it('una nota de solo espacios se guarda como null', async () => {
        const view = await mine.answer({ matchId, topic: 'horizonte', option: '1-ano', note: '   ' });
        expect(view.mine?.note).toBeNull();
      });

      it('clave inválida o nota de más de 280 caracteres: AgreementInvalidError', async () => {
        await expect(
          mine.answer({ matchId, topic: 'Horizonte!', option: '1-ano' })
        ).rejects.toBeInstanceOf(AgreementInvalidError);
        await expect(
          mine.answer({ matchId, topic: 'horizonte', option: '1-ano', note: 'x'.repeat(281) })
        ).rejects.toBeInstanceOf(AgreementInvalidError);
      });

      it('en un match Lock-In: AgreementModeError al leer y al responder', async () => {
        await repositories.session.setActiveMode('lockin');
        const { match } = await repositories.discovery.recordDecision(
          fixture.openToBothReciprocalId,
          'like'
        );
        expect(match?.mode).toBe('lockin');

        await expect(mine.get(match!.id)).rejects.toBeInstanceOf(AgreementModeError);
        await expect(
          mine.answer({ matchId: match!.id, topic: 'horizonte', option: '1-ano' })
        ).rejects.toBeInstanceOf(AgreementModeError);
      });

      it('fuera del match: AgreementForbiddenError al leer y al responder', async () => {
        const outsider = fixture.outsiderAgreement();

        await expect(outsider.get(matchId)).rejects.toBeInstanceOf(AgreementForbiddenError);
        await expect(
          outsider.answer({ matchId, topic: 'horizonte', option: '1-ano' })
        ).rejects.toBeInstanceOf(AgreementForbiddenError);
      });
    });
```

Si `expect(match?.mode).toBe('lockin')` falla en algún backend, **para y dilo**. No toques la fixture ni el modo del usuario: significa que `openToBothReciprocalId` no se comporta como documenta `ContractFixture` («el match nace en el modo de la sesión»), y eso es de `arquitecto`, no de este bloque.

4. En `src/data/mock/index.test.ts`, importa `createMockAgreementRepository` de `./agreement` y añade al fixture, después de `outsiderSessions`:

```ts
      counterpartAgreement: () => createMockAgreementRepository(RECIPROCAL_NURIA),
      outsiderAgreement: () => createMockAgreementRepository(RECIPROCAL_ALBA),
```

- [ ] **Step 10: Mover los tipos de `status.ts` a `@/data`**

En `src/features/agreement/status.ts`, borra las interfaces locales `AgreementAnswer` y `AgreementTopicView` y su comentario, y pon:

```ts
import type { AgreementTopicView } from '@/data';

export type { AgreementTopicView };
```

(el re-export mantiene válido el `import type { AgreementTopicView } from './status'` del test de la Tarea 1).

- [ ] **Step 11: Ejecutar lo tocado**

Run: `npx jest src/data src/features/agreement`
Expected: PASS, incluidos los 8 casos nuevos del contrato contra el mock. El contrato de Supabase sale como `skipped` (es opt-in).

Run: `npx tsc --noEmit`
Expected: errores **solo** en `src/data/supabase/index.ts` (falta `agreement`) y `src/data/supabase/contract.test.ts` (faltan `counterpartAgreement`/`outsiderAgreement`). Cualquier otro error es de esta tarea: arréglalo.

- [ ] **Step 12: Commit (sin push hasta la Tarea 4)**

```bash
npx prettier --write src/data/types.ts src/data/agreement.ts src/data/agreement.test.ts src/data/repositories.ts src/data/repositories.contract.ts src/data/index.ts src/data/active.ts src/data/mock src/features/agreement/status.ts
git add -N -- src/data/agreement.ts src/data/agreement.test.ts src/data/mock/agreement.ts
git commit -m "feat(acuerdo): dominio, contrato y repositorio mock del acuerdo a ciegas" -- src/data/types.ts src/data/agreement.ts src/data/agreement.test.ts src/data/repositories.ts src/data/repositories.contract.ts src/data/index.ts src/data/active.ts src/data/mock/store.ts src/data/mock/seed.ts src/data/mock/agreement.ts src/data/mock/index.ts src/data/mock/index.test.ts src/features/agreement/status.ts
```

Marca la Tarea 3 en `todo/acuerdo.md`.

---

### Task 4: Repositorio de Supabase [Codex]

Alcance cerrado a `src/data/supabase/` contra una interfaz ya congelada (la de la Tarea 3). Criterio objetivo: `tsc` limpio y tests en verde.

**Files:**
- Create: `src/data/supabase/agreement.ts`
- Test: `src/data/supabase/agreement.test.ts`
- Modify: `src/data/supabase/database.types.ts` (`MatchAgreementRow`, `AgreementAnswerRow`, tabla y dos `Functions`)
- Modify: `src/data/supabase/index.ts` (registro)
- Modify: `src/data/supabase/contract.test.ts` (fixture)

**Interfaces:**
- Consumes: `AgreementRepository`, `AgreementTopicView`, `AgreementForbiddenError`, `AgreementModeError`, `AgreementInvalidError`, `normalizeNote`, `validateAnswerInput` (Tarea 3); las RPC `match_agreement` y `answer_agreement_topic` (Tarea 2).
- Produces: `createSupabaseAgreementRepository(deps?: AgreementRepositoryDeps): AgreementRepository`, `toAgreementViews(rows: MatchAgreementRow[]): AgreementTopicView[]`, `toAgreementError(error: { code?: string; message: string }): unknown`.

- [ ] **Step 1: Tipos de filas**

En `src/data/supabase/database.types.ts`, junto a `MatchStreakRow`:

```ts
/** Fila de `public.agreement_answers`. Solo se leen las propias (RLS). */
export type AgreementAnswerRow = {
  match_id: string;
  profile_id: string;
  topic: string;
  option: string;
  note: string | null;
  updated_at: string;
};

/**
 * Fila de `match_agreement()`. Las `theirs_*` son null salvo que el actor haya
 * respondido ese tema (el ciego); `theirs_answered` sale siempre.
 */
export type MatchAgreementRow = {
  topic: string;
  mine_option: string | null;
  mine_note: string | null;
  mine_updated_at: string | null;
  theirs_answered: boolean;
  theirs_option: string | null;
  theirs_note: string | null;
  theirs_updated_at: string | null;
};
```

En `Tables`, después de `session_ratings`:

```ts
      // La escribe `answer_agreement_topic` y nadie más; el select directo
      // solo devuelve las propias. La vista de la pareja es `match_agreement`.
      agreement_answers: {
        Row: AgreementAnswerRow;
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
```

En `Functions`, después de `rate_session`:

```ts
      answer_agreement_topic: {
        Args: { p_match_id: string; p_topic: string; p_option: string; p_note: string | null };
        Returns: AgreementAnswerRow;
      };
      /** `match_agreement(p_match_id)` → una fila por tema con alguna respuesta. */
      match_agreement: { Args: { p_match_id: string }; Returns: MatchAgreementRow[] };
```

- [ ] **Step 2: Test del mapeo y de los errores**

`src/data/supabase/agreement.test.ts`:

```ts
import { AgreementForbiddenError, AgreementInvalidError, AgreementModeError } from '../agreement';
import { createSupabaseAgreementRepository, toAgreementError, toAgreementViews } from './agreement';

import type { MatchAgreementRow } from './database.types';

const base: MatchAgreementRow = {
  topic: 'dedicacion',
  mine_option: null,
  mine_note: null,
  mine_updated_at: null,
  theirs_answered: false,
  theirs_option: null,
  theirs_note: null,
  theirs_updated_at: null,
};

describe('toAgreementViews', () => {
  it('sin respuesta del otro: theirs null', () => {
    const [view] = toAgreementViews([
      { ...base, mine_option: 'completa', mine_updated_at: '2026-09-24T10:00:00+00:00' },
    ]);
    expect(view).toEqual({
      topic: 'dedicacion',
      mine: {
        topic: 'dedicacion',
        option: 'completa',
        note: null,
        updatedAt: '2026-09-24T10:00:00.000Z',
      },
      theirs: null,
    });
  });

  it('respondida por el otro pero oculta: hidden', () => {
    const [view] = toAgreementViews([{ ...base, theirs_answered: true }]);
    expect(view).toEqual({ topic: 'dedicacion', mine: null, theirs: 'hidden' });
  });

  it('las dos reveladas', () => {
    const [view] = toAgreementViews([
      {
        ...base,
        mine_option: '10-25h',
        mine_updated_at: '2026-09-24T10:00:00+00:00',
        theirs_answered: true,
        theirs_option: 'completa',
        theirs_note: 'Todo',
        theirs_updated_at: '2026-09-24T09:00:00+00:00',
      },
    ]);
    expect(view.theirs).toEqual({
      topic: 'dedicacion',
      option: 'completa',
      note: 'Todo',
      updatedAt: '2026-09-24T09:00:00.000Z',
    });
  });
});

describe('toAgreementError', () => {
  it('traduce LI004, LI005 y 23514; deja pasar lo demás', () => {
    expect(toAgreementError({ code: 'LI004', message: 'x' })).toBeInstanceOf(
      AgreementForbiddenError
    );
    expect(toAgreementError({ code: 'LI005', message: 'x' })).toBeInstanceOf(AgreementModeError);
    expect(toAgreementError({ code: '23514', message: 'x' })).toBeInstanceOf(
      AgreementInvalidError
    );
    const other = { code: '08006', message: 'red' };
    expect(toAgreementError(other)).toBe(other);
  });
});

describe('createSupabaseAgreementRepository', () => {
  function fakeClient(responses: Record<string, { data: unknown; error: unknown }>) {
    const rpc = jest.fn((name: string) => Promise.resolve(responses[name]));
    return { rpc, client: { rpc } as never };
  }

  it('answer normaliza la nota, llama a la RPC y relee la vista del tema', async () => {
    const { rpc, client } = fakeClient({
      answer_agreement_topic: { data: {}, error: null },
      match_agreement: {
        data: [{ ...base, mine_option: 'completa', mine_updated_at: '2026-09-24T10:00:00+00:00' }],
        error: null,
      },
    });
    const repo = createSupabaseAgreementRepository({
      getClient: () => client,
      getUserId: async () => 'ana',
    });

    const view = await repo.answer({ matchId: 'm1', topic: 'dedicacion', option: 'completa', note: '  ' });

    expect(rpc).toHaveBeenCalledWith('answer_agreement_topic', {
      p_match_id: 'm1',
      p_topic: 'dedicacion',
      p_option: 'completa',
      p_note: null,
    });
    expect(view.mine?.option).toBe('completa');
  });

  it('valida antes de tocar la red', async () => {
    const { rpc, client } = fakeClient({});
    const repo = createSupabaseAgreementRepository({
      getClient: () => client,
      getUserId: async () => 'ana',
    });

    await expect(
      repo.answer({ matchId: 'm1', topic: 'Mal!', option: 'completa' })
    ).rejects.toBeInstanceOf(AgreementInvalidError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('get traduce el error de la RPC', async () => {
    const { client } = fakeClient({
      match_agreement: { data: null, error: { code: 'LI005', message: 'solo par' } },
    });
    const repo = createSupabaseAgreementRepository({
      getClient: () => client,
      getUserId: async () => 'ana',
    });

    await expect(repo.get('m1')).rejects.toBeInstanceOf(AgreementModeError);
  });
});
```

- [ ] **Step 3: Ejecutarlo y ver que falla**

Run: `npx jest src/data/supabase/agreement.test.ts`
Expected: FAIL con `Cannot find module './agreement'`.

- [ ] **Step 4: Implementar `src/data/supabase/agreement.ts`**

```ts
/**
 * Acuerdo de socios contra Supabase.
 *
 * Todo pasa por RPC (`supabase/migrations/20260924000200_agreement_answers.sql`):
 * el ciego lo impone `match_agreement()`, y aquí solo se traduce. Las
 * dependencias se inyectan por lo mismo que en `sessions.ts`: la suite de
 * contrato necesita el mismo repositorio actuando como otra persona.
 */

import {
  AgreementForbiddenError,
  AgreementInvalidError,
  AgreementModeError,
  normalizeNote,
  validateAnswerInput,
} from '../agreement';
import { ensureUserId } from './auth';
import { getSupabaseClient } from './client';

import type { LockInSupabaseClient } from './client';
import type { MatchAgreementRow } from './database.types';
import type { AgreementRepository } from '../repositories';
import type { AgreementAnswer, AgreementTopicView } from '../types';

/** PostgREST serializa `timestamptz` como `…+00:00`; el dominio usa ISO con `Z`. */
const toIso = (value: string) => new Date(value).toISOString();

const answerOf = (
  topic: string,
  option: string | null,
  note: string | null,
  updatedAt: string | null
): AgreementAnswer | null =>
  option === null || updatedAt === null ? null : { topic, option, note, updatedAt: toIso(updatedAt) };

export function toAgreementViews(rows: MatchAgreementRow[]): AgreementTopicView[] {
  return rows.map((row) => ({
    topic: row.topic,
    mine: answerOf(row.topic, row.mine_option, row.mine_note, row.mine_updated_at),
    theirs: !row.theirs_answered
      ? null
      : (answerOf(row.topic, row.theirs_option, row.theirs_note, row.theirs_updated_at) ??
        'hidden'),
  }));
}

const DOMAIN_ERRORS: Record<string, new (message: string) => Error> = {
  LI004: AgreementForbiddenError,
  LI005: AgreementModeError,
  '23514': AgreementInvalidError,
};

/** `errcode` de las RPC del acuerdo → error de dominio. Cualquier otro sale intacto. */
export function toAgreementError(error: { code?: string; message: string }): unknown {
  const DomainError = error.code ? DOMAIN_ERRORS[error.code] : undefined;
  return DomainError ? new DomainError(error.message) : error;
}

export interface AgreementRepositoryDeps {
  getClient(): LockInSupabaseClient;
  /** Abre sesión si hace falta y devuelve el id del usuario. */
  getUserId(): Promise<string>;
}

const defaultDeps: AgreementRepositoryDeps = {
  getClient: getSupabaseClient,
  getUserId: ensureUserId,
};

export function createSupabaseAgreementRepository(
  deps: AgreementRepositoryDeps = defaultDeps
): AgreementRepository {
  async function get(matchId: string): Promise<AgreementTopicView[]> {
    await deps.getUserId();
    const { data, error } = await deps.getClient().rpc('match_agreement', { p_match_id: matchId });
    if (error) throw toAgreementError(error);
    return toAgreementViews((data ?? []) as MatchAgreementRow[]);
  }

  return {
    get,

    async answer(input) {
      validateAnswerInput(input);
      await deps.getUserId();
      const { error } = await deps.getClient().rpc('answer_agreement_topic', {
        p_match_id: input.matchId,
        p_topic: input.topic,
        p_option: input.option,
        p_note: normalizeNote(input.note),
      });
      if (error) throw toAgreementError(error);
      // Se relee la vista: la fila escrita no dice nada de la respuesta del otro.
      const view = (await get(input.matchId)).find((candidate) => candidate.topic === input.topic);
      if (!view) throw new Error('agreement: la respuesta recién escrita no aparece en la vista');
      return view;
    },
  };
}
```

- [ ] **Step 5: Ejecutar el test**

Run: `npx jest src/data/supabase/agreement.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Registro y fixture de contrato**

En `src/data/supabase/index.ts`, importa `createSupabaseAgreementRepository` de `./agreement` y añade, después de `sessions: createSupabaseSessionRepository(),`:

```ts
    agreement: createSupabaseAgreementRepository(),
```

En `src/data/supabase/contract.test.ts`, junto a `sessionRepositoryFor` (línea ~296):

```ts
function agreementRepositoryFor(actor: Reciprocal): AgreementRepository {
  const { createSupabaseAgreementRepository } =
    require('./agreement') as typeof import('./agreement');
  return createSupabaseAgreementRepository({
    getClient: () => actor.client,
    getUserId: async () => actor.id,
  });
}
```

(importa el tipo `AgreementRepository` de `../repositories` junto a `LockInSessionRepository`), y en el fixture, después de `counterpartSessions`/`outsiderSessions`:

```ts
      counterpartAgreement: () => agreementRepositoryFor(parReciprocal),
      outsiderAgreement: () => agreementRepositoryFor(lockinReciprocal),
```

- [ ] **Step 7: Verificar todo lo local**

Run: `npx tsc --noEmit && npm run lint && npx jest --coverage`
Expected: `tsc` y lint limpios; todas las suites en verde y cobertura por encima del suelo.

- [ ] **Step 8: Commit y push de las Tareas 3 y 4**

```bash
npx prettier --write src/data/supabase
git add -N -- src/data/supabase/agreement.ts src/data/supabase/agreement.test.ts
git commit -m "feat(acuerdo): repositorio de Supabase sobre match_agreement y answer_agreement_topic" -- src/data/supabase/agreement.ts src/data/supabase/agreement.test.ts src/data/supabase/database.types.ts src/data/supabase/index.ts src/data/supabase/contract.test.ts
```

Haz push y espera a que `CI` esté en verde en Actions, **incluido el job «Formato»**. El contrato contra Supabase real es opt-in: lánzalo con `gh workflow run contract.yml` y anota el run en `todo/acuerdo.md`. Si falla de forma intermitente en realtime, es el join de `postgres_changes` (memoria del repo), no este bloque: el acuerdo no usa realtime. Marca la Tarea 4.

---

### Task 5: Hook `useAgreement` y `TopicRow` [Codex]

Carpeta propia; criterio objetivo (tests de RNTL). Aquí no se navega a ningún sitio: la navegación y la ruta son de la Tarea 6.

**Files:**
- Create: `src/features/agreement/use-agreement.ts` + `use-agreement.test.tsx`
- Create: `src/features/agreement/topic-row.tsx` + `topic-row.test.tsx`
- Create: `src/features/agreement/index.ts`

**Interfaces:**
- Consumes: `useQuery`, `useRepositories`, `AgreementTopicView`, `AGREEMENT_NOTE_MAX` (`@/data`); `topicStatus`, `optionsOf`, `optionLabel`, `AgreementTopic` (Tarea 1).
- Produces:
  - `useAgreement(matchId: string): { views: AgreementTopicView[]; loading: boolean; error: Error | null; savingTopic: string | null; saveError: Error | null; answer(topic: string, option: string, note: string | null): Promise<boolean>; refresh(): void }`
  - `<TopicRow topic={AgreementTopic} view={AgreementTopicView | undefined} counterpartName={string} saving={boolean} onSave={(option: string, note: string | null) => void} />`
  - `index.ts` exporta todo lo anterior más `topics.ts` y `status.ts`.

- [ ] **Step 1: Test del hook**

Incluye los puntos 1 (doble toque) y 3 (relectura al enfocar) del Review Focus. `src/features/agreement/use-agreement.test.tsx`:

```tsx
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { DataProvider } from '@/data';
import { createMockAgreementRepository, createMockRepositories, resetState } from '@/data/mock';
import { SEED_RECIPROCAL_IDS } from '@/data/mock/seed';
import { buildProfileInput } from '@/data/test-fixtures';

import { useAgreement } from './use-agreement';

import type { Repositories } from '@/data';

let focus: (() => void) | null = null;
jest.mock('expo-router', () => ({
  // El primer foco es el montaje; el test llama a `focus()` para simular volver.
  useFocusEffect: (effect: () => void) => {
    const react = jest.requireActual('react');
    react.useEffect(() => {
      focus = effect;
      effect();
    }, [effect]);
  },
}));

const NURIA = SEED_RECIPROCAL_IDS[0];
let repositories: Repositories;
let matchId: string;

beforeEach(async () => {
  resetState();
  repositories = createMockRepositories();
  await repositories.profiles.saveCurrent(buildProfileInput({ lookingFor: 'par' }));
  const { match } = await repositories.discovery.recordDecision(NURIA, 'like');
  expect(match?.mode).toBe('par');
  matchId = match!.id;
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <DataProvider value={repositories}>{children}</DataProvider>
);

it('lee la vista con la semilla de Núria oculta', async () => {
  const { result } = await renderHook(() => useAgreement(matchId), { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.views.find((view) => view.topic === 'dedicacion')?.theirs).toBe('hidden');
});

it('responder relee y revela', async () => {
  const { result } = await renderHook(() => useAgreement(matchId), { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));

  await act(async () => {
    await result.current.answer('dedicacion', 'completa', null);
  });

  await waitFor(() =>
    expect(result.current.views.find((view) => view.topic === 'dedicacion')?.theirs).toMatchObject(
      { option: 'completa' }
    )
  );
});

it('un doble toque escribe una sola vez', async () => {
  const spy = jest.spyOn(repositories.agreement, 'answer');
  const { result } = await renderHook(() => useAgreement(matchId), { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));

  let results: boolean[] = [];
  await act(async () => {
    results = await Promise.all([
      result.current.answer('horizonte', '1-ano', null),
      result.current.answer('horizonte', '3-meses', null),
    ]);
  });

  expect(spy).toHaveBeenCalledTimes(1);
  expect(results).toEqual([true, false]);
});

it('al volver a enfocar relee: ve el cambio del otro', async () => {
  const { result } = await renderHook(() => useAgreement(matchId), { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    await result.current.answer('horizonte', '1-ano', null);
  });
  await createMockAgreementRepository(NURIA).answer({
    matchId,
    topic: 'horizonte',
    option: '3-meses',
  });

  await act(async () => focus?.());

  await waitFor(() =>
    expect(result.current.views.find((view) => view.topic === 'horizonte')?.theirs).toMatchObject({
      option: '3-meses',
    })
  );
});

it('un fallo al guardar queda en saveError y devuelve false', async () => {
  jest.spyOn(repositories.agreement, 'answer').mockRejectedValueOnce(new Error('sin red'));
  const { result } = await renderHook(() => useAgreement(matchId), { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));

  let ok = true;
  await act(async () => {
    ok = await result.current.answer('horizonte', '1-ano', null);
  });

  expect(ok).toBe(false);
  expect(result.current.saveError?.message).toBe('sin red');
});
```

Si `buildProfileInput` no acepta `lookingFor`, o `expect(match?.mode).toBe('par')` falla, mira cómo decide el modo `resolveMatchMode` (`src/data/mock/store.ts:199`) y ajusta **solo** el override de `buildProfileInput` de este test. Los demás archivos no se tocan.

- [ ] **Step 2: Ejecutarlo y ver que falla**

Run: `npx jest src/features/agreement/use-agreement.test.tsx`
Expected: FAIL con `Cannot find module './use-agreement'`.

- [ ] **Step 3: Implementar el hook**

`src/features/agreement/use-agreement.ts`:

```ts
/**
 * El acuerdo de un match, con escritura y relectura.
 *
 * Sin realtime (spec § «Sin realtime»): se relee al volver a enfocar la
 * pantalla y después de cada respuesta. El primer foco coincide con el
 * montaje, donde `useQuery` ya lee, y se salta, como en `useMatchStreaks`.
 *
 * Una sola escritura en vuelo: el candado es un ref, no estado, para que dos
 * toques en el mismo tic no pasen los dos antes del re-render.
 */

import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { useQuery, useRepositories } from '@/data';

import type { AgreementTopicView } from '@/data';

export function useAgreement(matchId: string): {
  views: AgreementTopicView[];
  loading: boolean;
  error: Error | null;
  savingTopic: string | null;
  saveError: Error | null;
  answer(topic: string, option: string, note: string | null): Promise<boolean>;
  refresh(): void;
} {
  const repositories = useRepositories();
  const { data, loading, error, refresh } = useQuery(`agreement:${matchId}`, () =>
    repositories.agreement.get(matchId)
  );
  const [savingTopic, setSavingTopic] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<Error | null>(null);
  const inFlight = useRef(false);
  const focusedOnce = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!focusedOnce.current) {
        focusedOnce.current = true;
        return;
      }
      refresh();
    }, [refresh])
  );

  const answer = useCallback(
    async (topic: string, option: string, note: string | null) => {
      if (inFlight.current) return false;
      inFlight.current = true;
      setSavingTopic(topic);
      setSaveError(null);
      try {
        await repositories.agreement.answer({ matchId, topic, option, note });
        refresh();
        return true;
      } catch (caught) {
        setSaveError(caught instanceof Error ? caught : new Error(String(caught)));
        return false;
      } finally {
        inFlight.current = false;
        setSavingTopic(null);
      }
    },
    [repositories, matchId, refresh]
  );

  return { views: data ?? [], loading, error, savingTopic, saveError, answer, refresh };
}
```

- [ ] **Step 4: Ejecutar el test del hook**

Run: `npx jest src/features/agreement/use-agreement.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Test de `TopicRow`**

Incluye el punto 2 del Review Focus (tope de la nota). `src/features/agreement/topic-row.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';

import { TopicRow } from './topic-row';
import { topicByKey } from './topics';

import type { AgreementTopicView } from '@/data';

const topic = topicByKey('dedicacion')!;
const at = '2026-09-24T10:00:00.000Z';
const answer = (option: string, note: string | null = null) => ({
  topic: 'dedicacion',
  option,
  note,
  updatedAt: at,
});
const row = (view: AgreementTopicView | undefined, onSave = jest.fn()) =>
  render(
    <TopicRow topic={topic} view={view} counterpartName="Núria" saving={false} onSave={onSave} />
  );

it('pendiente sin la mía: «Falta tu respuesta», aunque ella ya haya respondido', async () => {
  await row({ topic: 'dedicacion', mine: null, theirs: 'hidden' });
  expect(screen.getByText('Falta tu respuesta')).toBeTruthy();
  expect(screen.getByText('Núria ya ha respondido')).toBeTruthy();
});

it('pendiente con la mía: dice que falta la suya y enseña la mía', async () => {
  await row({ topic: 'dedicacion', mine: answer('completa'), theirs: null });
  expect(screen.getByText('Núria aún no ha respondido')).toBeTruthy();
  expect(screen.getByText('Tú: Jornada completa')).toBeTruthy();
});

it('coincidís: la opción común, con estado en texto', async () => {
  await row({ topic: 'dedicacion', mine: answer('completa'), theirs: answer('completa', 'Todo') });
  expect(screen.getByText('Coincidís')).toBeTruthy();
  expect(screen.getByText('Jornada completa')).toBeTruthy();
  expect(screen.getByText('Núria: «Todo»')).toBeTruthy();
});

it('distinto: las dos opciones, cada una con su nombre, y una etiqueta que las lee', async () => {
  await row({ topic: 'dedicacion', mine: answer('10-25h'), theirs: answer('completa') });
  expect(screen.getByText('Distinto')).toBeTruthy();
  expect(screen.getByText('Tú: Entre 10 y 25 h a la semana')).toBeTruthy();
  expect(screen.getByText('Núria: Jornada completa')).toBeTruthy();
  expect(
    screen.getByLabelText(
      /dedicar.*Distinto.*tú: Entre 10 y 25 h a la semana.*Núria: Jornada completa/
    )
  ).toBeTruthy();
});

it('por hablar: lo dice en texto', async () => {
  await row({ topic: 'dedicacion', mine: answer('sin-decidir'), theirs: answer('completa') });
  expect(screen.getByText('Lo tenéis que hablar')).toBeTruthy();
});

it('al tocar se despliega; elegir y guardar llama a onSave con la nota', async () => {
  const onSave = jest.fn();
  await row(undefined, onSave);

  await fireEvent.press(screen.getByText(topic.question));
  await fireEvent.press(screen.getByRole('radio', { name: 'Jornada completa' }));
  await fireEvent.changeText(screen.getByLabelText('Nota opcional'), 'Lo dejo todo');
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar respuesta' }));

  expect(onSave).toHaveBeenCalledWith('completa', 'Lo dejo todo');
});

it('la nota tiene tope de 280 y sin opción elegida no se puede guardar', async () => {
  await row(undefined);
  await fireEvent.press(screen.getByText(topic.question));

  expect(screen.getByLabelText('Nota opcional').props.maxLength).toBe(280);
  expect(
    screen.getByRole('button', { name: 'Guardar respuesta' }).props.accessibilityState
  ).toMatchObject({ disabled: true });
});
```

- [ ] **Step 6: Ejecutarlo y ver que falla**

Run: `npx jest src/features/agreement/topic-row.test.tsx`
Expected: FAIL con `Cannot find module './topic-row'`.

- [ ] **Step 7: Implementar `TopicRow`**

`src/features/agreement/topic-row.tsx`:

```tsx
/**
 * Un tema del acuerdo: enunciado, estado y, al tocarlo, el editor en su sitio.
 *
 * El estado nunca va solo en color: siempre lleva texto. `distinto` va en tinta
 * normal, sin `danger`: discrepar es para lo que existe la pantalla (spec § 2).
 * Sin modal: el editor se despliega en la propia fila.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { AGREEMENT_NOTE_MAX } from '@/data';
import { useTheme } from '@/hooks/use-theme';

import { topicStatus } from './status';
import { optionLabel, optionsOf } from './topics';

import type { AgreementTopic } from './topics';
import type { AgreementAnswer, AgreementTopicView } from '@/data';

const STATUS_TEXT = {
  coincidis: 'Coincidís',
  distinto: 'Distinto',
  'por-hablar': 'Lo tenéis que hablar',
  pendiente: 'Pendiente',
} as const;

export function TopicRow({
  topic,
  view,
  counterpartName,
  saving,
  onSave,
}: {
  topic: AgreementTopic;
  view: AgreementTopicView | undefined;
  counterpartName: string;
  saving: boolean;
  onSave: (option: string, note: string | null) => void;
}) {
  const theme = useTheme();
  const status = topicStatus(topic.key, view);
  const mine = view?.mine ?? null;
  const theirs = view?.theirs && view.theirs !== 'hidden' ? view.theirs : null;
  const labelOf = (answer: AgreementAnswer) => optionLabel(topic.key, answer.option) ?? '';

  const [open, setOpen] = useState(false);
  const [option, setOption] = useState<string | null>(mine?.option ?? null);
  const [note, setNote] = useState(mine?.note ?? '');

  const statusColor =
    status === 'coincidis' ? theme.teal : status === 'por-hablar' ? theme.brass : theme.text;

  const lines: string[] = [];
  if (status === 'pendiente') {
    if (!mine) {
      lines.push('Falta tu respuesta');
      if (view?.theirs) lines.push(`${counterpartName} ya ha respondido`);
    } else {
      lines.push(`${counterpartName} aún no ha respondido`, `Tú: ${labelOf(mine)}`);
    }
  } else if (status === 'coincidis') {
    lines.push(labelOf(mine!));
  } else {
    lines.push(`Tú: ${labelOf(mine!)}`, `${counterpartName}: ${labelOf(theirs!)}`);
  }
  if (status !== 'pendiente') {
    if (mine?.note) lines.push(`Tú: «${mine.note}»`);
    if (theirs?.note) lines.push(`${counterpartName}: «${theirs.note}»`);
  }

  const a11y = `${topic.question}. ${STATUS_TEXT[status]}. ${
    status === 'distinto'
      ? `tú: ${labelOf(mine!)}; ${counterpartName}: ${labelOf(theirs!)}`
      : lines.join('. ')
  }`;

  return (
    <View style={[styles.card, { borderColor: theme.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={a11y}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
      >
        <ThemedText type="bodyStrong">{topic.question}</ThemedText>
        {status !== 'pendiente' && (
          <ThemedText type="small" style={{ color: statusColor }}>
            {STATUS_TEXT[status]}
          </ThemedText>
        )}
        {lines.map((line) => (
          <ThemedText key={line} type="small" themeColor="textSecondary">
            {line}
          </ThemedText>
        ))}
      </Pressable>

      {open && (
        <View style={styles.editor}>
          <View style={styles.chips}>
            {optionsOf(topic).map((candidate) => {
              const checked = candidate.key === option;
              return (
                <Pressable
                  key={candidate.key}
                  accessibilityRole="radio"
                  accessibilityLabel={candidate.label}
                  accessibilityState={{ selected: checked }}
                  onPress={() => setOption(candidate.key)}
                  style={[
                    styles.chip,
                    {
                      borderColor: checked ? theme.brass : theme.border,
                      backgroundColor: checked ? theme.brassSoft : 'transparent',
                    },
                  ]}
                >
                  <ThemedText type="small">{candidate.label}</ThemedText>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            accessibilityLabel="Nota opcional"
            placeholder="Nota opcional"
            placeholderTextColor={theme.textSecondary}
            value={note}
            onChangeText={setNote}
            maxLength={AGREEMENT_NOTE_MAX}
            multiline
            style={[styles.note, { borderColor: theme.border, color: theme.text }]}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {note.length}/{AGREEMENT_NOTE_MAX}
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Guardar respuesta"
            accessibilityState={{ disabled: option === null || saving }}
            disabled={option === null || saving}
            onPress={() => {
              onSave(option!, note.trim() === '' ? null : note.trim());
              setOpen(false);
            }}
            style={[styles.save, { backgroundColor: theme.brass, opacity: option === null || saving ? 0.5 : 1 }]}
          >
            <ThemedText type="bodyStrong" style={{ color: theme.onAccent }}>
              Guardar
            </ThemedText>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: Radii.medium, padding: Spacing.three, gap: Spacing.one },
  editor: { gap: Spacing.two, marginTop: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: Radii.medium,
    paddingHorizontal: Spacing.three,
  },
  note: { minHeight: 72, borderWidth: 1, borderRadius: Radii.medium, padding: Spacing.two },
  save: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.medium,
  },
});
```

Antes de ejecutar, comprueba en `src/constants/theme.ts` que existen `Radii.medium`, `Spacing.one/two/three` y `theme.brassSoft` (y en `themed-text.tsx`, los `type` `bodyStrong` y `small`). Si alguno se llama distinto, usa el nombre real que usa `rating-chips.tsx`, sin inventar tokens.

`src/features/agreement/index.ts`:

```ts
export * from './topics';
export * from './status';
export { useAgreement } from './use-agreement';
export { TopicRow } from './topic-row';
```

- [ ] **Step 8: Ejecutar todo lo del bloque, `tsc` y lint**

Run: `npx jest src/features/agreement && npx tsc --noEmit && npm run lint`
Expected: PASS; `tsc` y lint limpios.

- [ ] **Step 9: Commit**

```bash
npx prettier --write src/features/agreement
git add -N -- src/features/agreement/use-agreement.ts src/features/agreement/use-agreement.test.tsx src/features/agreement/topic-row.tsx src/features/agreement/topic-row.test.tsx src/features/agreement/index.ts
git commit -m "feat(acuerdo): hook useAgreement y fila de tema con editor en su sitio" -- src/features/agreement/use-agreement.ts src/features/agreement/use-agreement.test.tsx src/features/agreement/topic-row.tsx src/features/agreement/topic-row.test.tsx src/features/agreement/index.ts
```

Marca la Tarea 5.

---

### Task 6: Tarjeta, pantalla, ruta y cruce con `chat` [Claude]

Cruza `chat` (`[matchId].tsx`) y `arquitecto` (`_layout.tsx`), y fija copy visible con criterio subjetivo (aviso legal, estados vacíos): por eso es `[Claude]`.

**Files:**
- Create: `src/features/agreement/agreement-card.tsx` + `agreement-card.test.tsx`
- Modify: `src/features/agreement/index.ts` (exporta `AgreementCard`)
- Create: `src/app/agreement/[matchId].tsx`
- Create: `test/app/agreement.test.tsx`
- Modify: `src/app/_layout.tsx` (un `Stack.Screen`)
- Modify: `src/app/chat/[matchId].tsx` (una línea)

**Interfaces:**
- Consumes: `useAgreement`, `TopicRow`, `summarize`, `AGREEMENT_CATALOG`, `SECTION_LABELS` (Tareas 1 y 5); `MatchWithProfile`, `AgreementForbiddenError` (`@/data`).
- Produces: `<AgreementCard match={MatchWithProfile} />` (devuelve `null` si `match.mode !== 'par'`), y la ruta `/agreement/[matchId]`.

- [ ] **Step 1: Test de la tarjeta**

`src/features/agreement/agreement-card.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';

import { DataProvider } from '@/data';
import { createMockAgreementRepository, createMockRepositories, resetState } from '@/data/mock';
import { SEED_RECIPROCAL_IDS } from '@/data/mock/seed';
import { buildProfileInput } from '@/data/test-fixtures';

import { AgreementCard } from './agreement-card';

import type { MatchWithProfile, Repositories } from '@/data';

const mockRouter = { push: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useFocusEffect: (effect: () => void) => jest.requireActual('react').useEffect(effect, [effect]),
}));

const NURIA = SEED_RECIPROCAL_IDS[0];
let repositories: Repositories;
let match: MatchWithProfile;

beforeEach(async () => {
  mockRouter.push.mockClear();
  resetState();
  repositories = createMockRepositories();
  await repositories.profiles.saveCurrent(buildProfileInput({ lookingFor: 'par' }));
  const { match: created } = await repositories.discovery.recordDecision(NURIA, 'like');
  match = (await repositories.matches.getById(created!.id))!;
});

const renderCard = (value: MatchWithProfile = match) =>
  render(
    <DataProvider value={repositories}>
      <AgreementCard match={value} />
    </DataProvider>
  );

it('sin respuestas mías: invita y dice cuántas lleva ella por delante', async () => {
  await renderCard();
  expect(await screen.findByText('Acuerdo de socios')).toBeTruthy();
  expect(screen.getByText('8 temas difíciles, a ciegas hasta que respondáis los dos.')).toBeTruthy();
  expect(screen.getByText('Núria Bosch ha respondido 3 que tú aún no.')).toBeTruthy();
});

it('con respuestas: recuento de comparados y distintos', async () => {
  const mine = createMockAgreementRepository('me');
  await mine.answer({ matchId: match.id, topic: 'dedicacion', option: 'completa' });
  await mine.answer({ matchId: match.id, topic: 'participacion', option: 'partes-iguales' });

  await renderCard();
  expect(await screen.findByText('2 de 8 comparados · 1 distinto')).toBeTruthy();
});

it('toda la tarjeta lleva a la pantalla del acuerdo', async () => {
  await renderCard();
  await fireEvent.press(await screen.findByRole('button', { name: /Acuerdo de socios/ }));
  expect(mockRouter.push).toHaveBeenCalledWith({
    pathname: '/agreement/[matchId]',
    params: { matchId: match.id },
  });
});

it('en un match Lock-In no se pinta', async () => {
  await renderCard({ ...match, mode: 'lockin' });
  expect(screen.queryByText('Acuerdo de socios')).toBeNull();
});
```

(Si `CURRENT_USER_ID` no es `'me'`, importa `CURRENT_USER_ID` de `@/data/mock` en lugar del literal.)

- [ ] **Step 2: Ejecutarlo y ver que falla**

Run: `npx jest src/features/agreement/agreement-card.test.tsx`
Expected: FAIL con `Cannot find module './agreement-card'`.

- [ ] **Step 3: Implementar la tarjeta**

`src/features/agreement/agreement-card.tsx`:

```tsx
/**
 * Entrada al acuerdo de socios desde el chat, debajo de `SessionCard`.
 *
 * Solo en matches Par: en Lock-In devuelve `null`, así el chat la monta sin
 * condición y la regla vive en un solo sitio. No importa nada de
 * `@/features/session`.
 */

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { summarize } from './status';
import { useAgreement } from './use-agreement';

import type { MatchWithProfile } from '@/data';

export function AgreementCard({ match }: { match: MatchWithProfile }) {
  if (match.mode !== 'par') return null;
  return <ParAgreementCard match={match} />;
}

function ParAgreementCard({ match }: { match: MatchWithProfile }) {
  const theme = useTheme();
  const router = useRouter();
  const { views } = useAgreement(match.id);
  const { compared, different, theirsAhead, total } = summarize(views);

  const headline =
    compared === 0
      ? `${total} temas difíciles, a ciegas hasta que respondáis los dos.`
      : `${compared} de ${total} comparados · ${different} ${different === 1 ? 'distinto' : 'distintos'}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Acuerdo de socios. ${headline}`}
      onPress={() =>
        router.push({ pathname: '/agreement/[matchId]', params: { matchId: match.id } })
      }
      style={[styles.card, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
    >
      <ThemedText type="bodyStrong">Acuerdo de socios</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {headline}
      </ThemedText>
      {theirsAhead > 0 && (
        <ThemedText type="small" style={{ color: theme.brass }}>
          {`${match.counterpart.name} ha respondido ${theirsAhead} que tú aún no.`}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: Radii.medium, padding: Spacing.three, gap: Spacing.one },
});
```

Comprueba que `theme.backgroundElement` existe en `src/constants/theme.ts`. Si no, usa el token de superficie que use `session-card.tsx`. Añade a `index.ts`: `export { AgreementCard } from './agreement-card';`.

La ruta tipada `/agreement/[matchId]` no existe hasta el Step 5, así que `tsc` puede quejarse del `pathname` hasta entonces. No lo tapes con un `as`: sigue al Step 5.

- [ ] **Step 4: Test de la pantalla**

Incluye el punto 4 del Review Focus (match ajeno o inexistente). `test/app/agreement.test.tsx`:

```tsx
/**
 * La pantalla del acuerdo de socios.
 *
 * Se llama `agreement.test.tsx` y no `[matchId].test.tsx` por lo mismo que
 * `matchId.test.tsx`: los corchetes no son sintaxis de Jest.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { SEED_RECIPROCAL_IDS } from '@/data/mock/seed';
import { buildProfileInput } from '@/data/test-fixtures';

import {
  renderRoute,
  repositories,
  resetRepositories,
  resetRouter,
  setSearchParams,
} from '../routes';

import AgreementScreen from '../../src/app/agreement/[matchId]';

jest.mock('expo-router', () => require('../routes').expoRouterMock());

const [NURIA, , ALBA] = SEED_RECIPROCAL_IDS;

beforeEach(() => {
  resetRouter();
  resetRepositories();
});

async function openWith(counterpartId: string, lookingFor: 'par' | 'lockin' = 'par') {
  await repositories.profiles.saveCurrent(buildProfileInput({ lookingFor }));
  const { match } = await repositories.discovery.recordDecision(counterpartId, 'like');
  setSearchParams({ matchId: match!.id });
  await renderRoute(<AgreementScreen />);
  return match!;
}

it('el aviso legal está siempre, arriba y sin botón de cerrar', async () => {
  await openWith(NURIA);
  expect(
    await screen.findByText(/Esto no es un contrato ni asesoría legal/)
  ).toBeTruthy();
  expect(screen.queryByRole('button', { name: /cerrar/i })).toBeNull();
});

it('pinta las tres secciones y los ocho temas', async () => {
  await openWith(NURIA);
  for (const section of ['Compromiso', 'Reparto', 'Salida']) {
    expect(await screen.findByText(section)).toBeTruthy();
  }
  expect(screen.getByText('¿Cuánto tiempo le vas a dedicar los próximos 6 meses?')).toBeTruthy();
  expect(screen.getByText('Lo que cada uno crea antes de constituir, ¿de quién es?')).toBeTruthy();
});

it('responder el tema que Núria ya respondió lo revela: Coincidís', async () => {
  await openWith(NURIA);
  await fireEvent.press(
    await screen.findByText('¿Cuánto tiempo le vas a dedicar los próximos 6 meses?')
  );
  await fireEvent.press(screen.getByRole('radio', { name: 'Jornada completa' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar respuesta' }));

  await waitFor(() => expect(screen.getByText('Coincidís')).toBeTruthy());
  expect(screen.getByText('Núria Bosch: «Lo dejo todo por esto.»')).toBeTruthy();
});

it('un match Lock-In dice que el acuerdo es solo para cofundadores', async () => {
  await openWith(ALBA, 'lockin');
  expect(
    await screen.findByText('El acuerdo es solo para matches de cofundador.')
  ).toBeTruthy();
});

it('un match que no existe (deep link viejo) enseña el estado de match perdido', async () => {
  setSearchParams({ matchId: 'no-existe' });
  await renderRoute(<AgreementScreen />);
  expect(await screen.findByText('Esta conversación ya no está')).toBeTruthy();
});
```

Antes de ejecutar, abre `MissingMatch` en `src/app/chat/[matchId].tsx:201` y copia su titular **real** en la última aserción si no es «Esta conversación ya no está». Si la línea de Alba no da un match Lock-In (`resolveMatchMode`), usa como contraparte el recíproco que en el mock lo dé, y dilo en el commit.

- [ ] **Step 5: Implementar la pantalla y registrar la ruta**

`src/app/agreement/[matchId].tsx`:

```tsx
/**
 * Acuerdo de socios de un match Par: ocho temas a ciegas (spec § 2).
 *
 * El aviso legal va arriba, fijo y sin forma de cerrarlo. `distinto` no se
 * pinta como error. A esta pantalla se puede llegar por deep link, así que
 * resuelve sola el match ajeno o inexistente y el match Lock-In.
 */

import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { AgreementForbiddenError, AgreementModeError, useQuery, useRepositories } from '@/data';
import { AGREEMENT_CATALOG, SECTION_LABELS, TopicRow, useAgreement } from '@/features/agreement';
import { useTheme } from '@/hooks/use-theme';

import type { AgreementSection } from '@/features/agreement';

const LEGAL_NOTICE =
  'Esto no es un contrato ni asesoría legal. Sirve para hablar de lo difícil antes de que salga caro. Cuando vayáis en serio, id a un profesional.';

export default function AgreementScreen() {
  const theme = useTheme();
  const repositories = useRepositories();
  const params = useLocalSearchParams<{ matchId: string }>();
  const matchId = Array.isArray(params.matchId) ? params.matchId[0] : (params.matchId ?? '');

  const matchQuery = useQuery(`match:${matchId}`, () => repositories.matches.getById(matchId));
  const agreement = useAgreement(matchId);
  const match = matchQuery.data;

  const blocked =
    agreement.error instanceof AgreementModeError || (match !== null && match.mode !== 'par');
  const missing =
    !matchQuery.loading &&
    (match === null || agreement.error instanceof AgreementForbiddenError);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: 'Acuerdo de socios' }} />
      {matchQuery.loading || agreement.loading ? (
        <Centered text="Cargando…" />
      ) : missing ? (
        <Centered text="Esta conversación ya no está" link="Volver a Matches" href="/matches" />
      ) : blocked ? (
        <Centered
          text="El acuerdo es solo para matches de cofundador."
          link="Volver a Matches"
          href="/matches"
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.notice, { backgroundColor: theme.brassSoft }]}>
            <ThemedText type="small">{LEGAL_NOTICE}</ThemedText>
          </View>
          {(Object.keys(SECTION_LABELS) as AgreementSection[]).map((section) => (
            <View key={section} style={styles.section}>
              <ThemedText type="subtitle">{SECTION_LABELS[section]}</ThemedText>
              {AGREEMENT_CATALOG.filter((topic) => topic.section === section).map((topic) => (
                <TopicRow
                  key={topic.key}
                  topic={topic}
                  view={agreement.views.find((view) => view.topic === topic.key)}
                  counterpartName={match!.counterpart.name}
                  saving={agreement.savingTopic === topic.key}
                  onSave={(option, note) => void agreement.answer(topic.key, option, note)}
                />
              ))}
            </View>
          ))}
          {agreement.saveError && (
            <ThemedText type="small" themeColor="danger">
              No se ha podido guardar. Inténtalo de nuevo.
            </ThemedText>
          )}
          <Link href={{ pathname: '/chat/[matchId]', params: { matchId } }} asChild>
            <Pressable accessibilityRole="link" style={styles.back}>
              <ThemedText type="bodyStrong" style={{ color: theme.brass }}>
                Habladlo en el chat
              </ThemedText>
            </Pressable>
          </Link>
        </ScrollView>
      )}
    </View>
  );
}

function Centered({ text, link, href }: { text: string; link?: string; href?: '/matches' }) {
  const theme = useTheme();
  return (
    <View style={styles.centered}>
      <ThemedText type="body" themeColor="textSecondary">
        {text}
      </ThemedText>
      {link && href && (
        <Link href={href} asChild>
          <Pressable accessibilityRole="link">
            <ThemedText type="bodyStrong" style={{ color: theme.brass }}>
              {link}
            </ThemedText>
          </Pressable>
        </Link>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.four },
  notice: { borderRadius: Radii.medium, padding: Spacing.three },
  section: { gap: Spacing.two },
  back: { alignItems: 'center', paddingVertical: Spacing.three },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
});
```

`useAgreement` se llama con el match todavía sin resolver; si el match no es tuyo, el `get` lanza `AgreementForbiddenError` y la pantalla lo lee como `missing`. Si `matches.getById` del mock **no** devuelve `null` para un id inexistente (léelo en `src/data/mock/index.ts`), ajusta la condición de `missing` a lo que devuelva, sin tocar el mock.

En `src/app/_layout.tsx`, después del `Stack.Screen` de `session/[sessionId]`, añade uno igual con `name="agreement/[matchId]"` y las mismas `options`.

- [ ] **Step 6: La línea del chat**

En `src/app/chat/[matchId].tsx`, importa `AgreementCard` de `@/features/agreement` y, dentro de `<View style={styles.lockIn}>`, justo debajo de `<SessionCard match={match} me={me} />`:

```tsx
              <AgreementCard match={match} />
```

- [ ] **Step 7: Ejecutar lo tocado y lo que puede romper**

Run: `npx jest src/features/agreement test/app/agreement.test.tsx test/app/matchId.test.tsx test/app/layouts.test.tsx`
Expected: PASS. Si `matchId.test.tsx` falla por un `getByText` que ahora encuentra dos nodos, es la tarjeta nueva: acota esa consulta en el test (`getAllBy…[0]` no; usa `within` sobre la zona que el test quería mirar).

Run: `npx tsc --noEmit && npm run lint && npx expo export --platform web`
Expected: los tres limpios.

- [ ] **Step 8: Commit**

```bash
npx prettier --write src/features/agreement "src/app/agreement/[matchId].tsx" src/app/_layout.tsx "src/app/chat/[matchId].tsx" test/app/agreement.test.tsx
git add -N -- src/features/agreement/agreement-card.tsx src/features/agreement/agreement-card.test.tsx "src/app/agreement/[matchId].tsx" test/app/agreement.test.tsx
git commit -m "feat(acuerdo): tarjeta en el chat y pantalla del acuerdo a ciegas" -- src/features/agreement/agreement-card.tsx src/features/agreement/agreement-card.test.tsx src/features/agreement/index.ts "src/app/agreement/[matchId].tsx" test/app/agreement.test.tsx src/app/_layout.tsx "src/app/chat/[matchId].tsx"
```

Si tocaste `test/app/matchId.test.tsx`, añádelo al pathspec y dilo en el mensaje. Marca la Tarea 6.

---

### Task 7: E2E en la variante `supabase` [Claude]

`e2e/run.mjs` tiene más de 1.200 líneas y es de `calidad`, y el E2E solo da señal en Actions: hace falta criterio. Por eso es `[Claude]`.

**Files:**
- Create: `e2e/agreement.yaml`
- Modify: `e2e/verify.mjs` (`prepareAgreement`, `verifyAgreementAnswer`)
- Modify: `e2e/run.mjs` (encadenar después de `session-streak.yaml`)
- Modify: `e2e/session.test.mjs` o un `e2e/agreement.test.mjs` nuevo (cotejo del `.yaml` contra el código, como hacen los demás)

**Interfaces:**
- Consumes: la migración (Tarea 2), la pantalla y sus textos (Tarea 6).
- Produces: `prepareAgreement(status, profileName): Promise<void>` y `verifyAgreementAnswer(status, profileName): Promise<void>` en `e2e/verify.mjs`.

- [ ] **Step 1: Comprobar el modo del match del recorrido**

`full-journey.yaml` elige «Ambos» (línea 19), y el modo del match sale de `record_decision`/`resolve_match_mode`. Lee `resolve_match_mode` en `supabase/migrations/20260905000500_functions_and_realtime.sql:10` y el perfil con el que se hace match en la variante `supabase` (`DECK_FIXTURE=postgres`, `e2e/run.mjs:667`). **Si ese match no es `par`, para y dilo**: no cambies el recorrido ni el orden del deck para meter este caso; entonces el E2E de este bloque queda declarado como ausencia en la spec, igual que el OAuth de verificación.

- [ ] **Step 2: La siembra y el oráculo**

En `e2e/verify.mjs`, después de `prepareSessionStreak`:

```js
/**
 * Siembra la respuesta de la contraparte al tema `dedicacion` del acuerdo de
 * socios del match del recorrido, con `service_role` (se salta la RPC: aquí se
 * prepara el mundo, no se prueba la escritura). `agreement.yaml` responde lo
 * mismo y espera «Coincidís».
 */
export async function prepareAgreement(status, profileName) {
  assert.equal(status.API_URL, 'http://127.0.0.1:54321');
  const client = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id')
    .eq('name', profileName)
    .single();
  assert.ifError(profileError);
  const { data: match, error: matchError } = await client
    .from('matches')
    .select('id, profile_a, profile_b, mode')
    .or(`profile_a.eq.${profile.id},profile_b.eq.${profile.id}`)
    .single();
  assert.ifError(matchError);
  assert.equal(match.mode, 'par', 'el acuerdo solo existe en matches Par');
  const counterpartId = match.profile_a === profile.id ? match.profile_b : match.profile_a;
  const { error } = await client.from('agreement_answers').insert({
    match_id: match.id,
    profile_id: counterpartId,
    topic: 'dedicacion',
    option: 'completa',
    note: 'Lo dejo todo por esto.',
  });
  assert.ifError(error);
}

/** Oráculo de `agreement.yaml`: la respuesta del usuario llegó a Postgres. */
export async function verifyAgreementAnswer(status, profileName) {
  const client = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id')
    .eq('name', profileName)
    .single();
  assert.ifError(profileError);
  const { data, error } = await client
    .from('agreement_answers')
    .select('topic, option')
    .eq('profile_id', profile.id);
  assert.ifError(error);
  assert.deepEqual(data, [{ topic: 'dedicacion', option: 'completa' }]);
}
```

(Si el match del recorrido no es el único del perfil, filtra por el que usa `prepareSessionStreak`, igual que hace él.)

- [ ] **Step 3: El flujo de Maestro**

`e2e/agreement.yaml`:

```yaml
# Acuerdo de socios: abre el acuerdo desde el chat del match del recorrido,
# responde el tema que `prepareAgreement` ya dejó respondido por la contraparte
# y espera la revelación. Solo en la variante con credenciales, encadenado
# después de session-streak.yaml. `e2e/agreement.test.mjs` fija las etiquetas
# contra el código.
appId: app.lockin.mobile
name: Acuerdo de socios a ciegas desde el chat
---
- assertTrue: ${MESSAGE}
- launchApp:
    clearState: false
- extendedWaitUntil:
    visible: 'Descubrir'
    timeout: 60000
- tapOn: 'Matches'
- tapOn: 'Conversación con .*${MESSAGE}'
- extendedWaitUntil:
    visible: 'Acuerdo de socios.*'
    timeout: 30000
- tapOn: 'Acuerdo de socios.*'
- extendedWaitUntil:
    visible: '.*Esto no es un contrato ni asesoría legal.*'
    timeout: 30000
- tapOn: '¿Cuánto tiempo le vas a dedicar los próximos 6 meses?.*'
- tapOn: 'Jornada completa'
- tapOn: 'Guardar respuesta'
- extendedWaitUntil:
    visible: 'Coincidís'
    timeout: 30000
```

- [ ] **Step 4: Encadenarlo en `run.mjs`**

En `e2e/run.mjs`: declara `const agreementFile = join(root, 'e2e/agreement.yaml');` con un comentario («Quinto caso, encadenado al anterior…»), junto a `streakFile`; importa `prepareAgreement` y `verifyAgreementAnswer`. Justo después del `if (streakRun.status !== 0) { … }` (línea ~830), copia el bloque de la valoración (`ratingDir`/`ratingRun`, líneas ~770-800) con estos cambios: `await prepareAgreement(status, profileName)` antes; directorio `agreement`; `-e MESSAGE=<message>`; fichero `agreementFile`; motivo `'agreement.yaml: '`; y `await verifyAgreementAnswer(status, profileName)` después.

- [ ] **Step 5: Cotejo del `.yaml` contra el código**

`e2e/agreement.test.mjs`, con la misma forma que `e2e/session.test.mjs`. Afirma que:
- `agreement.yaml` contiene los textos `Acuerdo de socios`, `Esto no es un contrato ni asesoría legal`, `Jornada completa`, `Guardar respuesta` y `Coincidís`, y que cada uno aparece literalmente en `src/features/agreement/*.tsx`, `topics.ts` o `src/app/agreement/[matchId].tsx`;
- `run.mjs` lanza `e2e/agreement.yaml` **después** de `e2e/session-streak.yaml` (índices de `indexOf` en el texto del runner).

Añádelo a la lista del script `test:e2e` de `package.json`, junto a `session.test.mjs`. Es el único cambio a `package.json` y es de `calidad`: nómbralo en el commit.

- [ ] **Step 6: Verificar en Actions**

`npm run test:e2e` **no vale aquí** (CRLF). Haz push y lee `e2e.yml` en Actions: variante `supabase` en verde, con `agreement/maestro.xml` en los artefactos; y `mock` (control negativo) sin cambios. Diagnostica con `gh run download` (memoria del repo). Si la variante `supabase` sale roja **antes** del paso del acuerdo, compárala con el run del commit anterior antes de culpar a este bloque.

- [ ] **Step 7: Commit**

```bash
npx prettier --write e2e/agreement.test.mjs e2e/verify.mjs e2e/run.mjs
git add -N -- e2e/agreement.yaml e2e/agreement.test.mjs
git commit -m "test(acuerdo): E2E del acuerdo a ciegas en la variante supabase" -- e2e/agreement.yaml e2e/agreement.test.mjs e2e/verify.mjs e2e/run.mjs package.json
```

Anota los runs en `todo/acuerdo.md` y marca la Tarea 7.

---

### Task 8: Verificación final y cierre [Claude]

**Files:**
- Modify: `docs/plan/todo/acuerdo.md`, `docs/plan/TODO.md`, `docs/plan/PLAN.md` (si algo cambió)
- Modify: memoria del repo (`schema-drift-remoto-rojo-esperado.md`), si hay excepción vigente

- [ ] **Step 1: Suite local completa**

Run: `npx tsc --noEmit && npm run lint && npx jest --coverage && npm run test:schema && npx expo export --platform web`
Expected: todo verde; cobertura por encima de 89.82/82.56/91.49/91.38. Copia las cifras al `todo/acuerdo.md`.

- [ ] **Step 2: CI**

Con el último commit subido, lee `CI` entero en Actions (**incluido «Formato»**, único veredicto válido para Prettier), `E2E Android` en las dos variantes y `Schema drift`. En `Schema drift`, el job remoto **debe** salir rojo mientras el usuario no aplique la migración: comprueba en `remote.diff` que la diferencia es exactamente `agreement_answers`, su política y las dos funciones, y nada más.

- [ ] **Step 3: Registrar la excepción de `Schema drift`**

Actualiza la memoria `schema-drift-remoto-rojo-esperado.md` (y su línea en `MEMORY.md`): excepción vigente desde la fecha de hoy, causa = `20260924000200_agreement_answers.sql` sin aplicar, y cómo se cierra (el usuario la aplica y el siguiente run da «Sin diferencias.»). Lo mismo en `todo/acuerdo.md` → «Pendiente del usuario».

- [ ] **Step 4: Lanzar al `comprobador`**

Con el agente `comprobador`: APK sin credenciales (mock) → match con Núria → chat → tarjeta «Acuerdo de socios» → pantalla → responder «Jornada completa» en dedicación → «Coincidís» y la nota de Núria; y un match Lock-In sin tarjeta. Pide captura y `uiautomator dump` de cada paso en `e2e/artifacts/local/`. Sus hallazgos van a «Hallazgos del comprobador» de `todo/acuerdo.md`.

- [ ] **Step 5: Cerrar el tablero**

Marca las casillas en `todo/acuerdo.md` quitando las etiquetas, marca el hito de `TODO.md` con el mismo tipo de resumen que el de verificación (commits, runs, cifras, qué queda del usuario), y commitea:

```bash
git commit -m "docs(acuerdo): bloque 12 cerrado a falta de aplicar la migración" -- docs/plan/todo/acuerdo.md docs/plan/TODO.md
```

---

## Pendiente del usuario

1. Aplicar `supabase/migrations/20260924000200_agreement_answers.sql` en `grrzmzktrhksbttpbblg` por el SQL Editor. Hasta entonces, `Schema drift` remoto está rojo a propósito (Tarea 8, Step 3); en cuanto se aplique, un rojo ahí vuelve a ser deriva real.
2. Nada más: sin credenciales, sin dashboard y sin build nativa.
