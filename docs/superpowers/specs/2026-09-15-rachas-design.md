# Rachas de pareja — diseño

Fecha: 2026-09-15. Estado: decidido con el usuario en brainstorming (titular,
periodo, zona horaria y dónde se ve); escrito a partir de la descomposición de
Fase 2 de `docs/superpowers/specs/2026-09-13-sesiones-lockin-design.md`.

## Contexto

`docs/plan/CONCEPTO.md` pone las rachas en Fase 2, junto a las sesiones y el
Pomodoro. La spec de sesiones las declaró como la tercera pieza ("cuenta
sesiones asistidas por persona y periodo") y les dejó el dato hecho:

- `session_attendance`, con la semántica que esta spec **no redefine**: asistió
  = tiene fila con `joinedAt < endsAt`; abandonó = `leftAt` no nulo y
  `leftAt < endsAt`; un `leftAt` nulo **no** distingue "se quedó hasta el final"
  de "cerró la app".
- La valoración (`docs/superpowers/specs/2026-09-15-valoracion-post-sesion-design.md`)
  ya añadió `public.session_both_attended(session_id)`, que es exactamente la
  condición de "sesión compartida" que necesita una racha de pareja.

La pista de la spec de sesiones decía "por persona". **Se descarta a
propósito** (§ Decisiones): la racha es de la pareja.

Sesiones y valoración están fusionadas, y la migración de la valoración ya está
aplicada en el proyecto real (`0430117`, `Schema drift` remoto en verde). Esta
pieza no depende de la casilla abierta de sesiones (verificación con dos
móviles): avanza contra el mock, PGlite y la Supabase local de `contract.yml`.

## Qué problema resuelve, y cuál no

Resuelve **dar un motivo para la siguiente sesión**. Una sesión Lock-In termina,
se valora (o no) y el chat vuelve a "Agendar sesión Lock-In" como si no hubiera
pasado nada. La racha convierte las sesiones sueltas en algo que se sostiene
entre dos, y hace visible en la lista de Matches con quién lo estás sosteniendo.
Es la respuesta directa al "problema de graduación" de `CONCEPTO.md`.

No resuelve reputación ni hábito individual. **No hay racha personal, ni
visible a terceros, ni en el perfil, ni en el deck.** Una cifra personal
visible sería la nota pública que la valoración evitó a propósito: convierte a
las dos personas de un match en evaluador y evaluado. Una racha de pareja no
crea esa asimetría porque es de los dos por construcción.

## Decisiones tomadas

| Pregunta | Decisión |
|---|---|
| De quién es | **De la pareja (el match).** Las dos personas ven el mismo número |
| Qué cuenta | Sesión `aceptada` a la que **entraron las dos** (`joinedAt < endsAt` en las dos filas) |
| Cuándo suma | En cuanto entra la segunda persona. No espera a que la sesión termine |
| Periodo | **Ventana móvil de 7 días**: dos sesiones son seguidas si `siguiente.startsAt − anterior.endsAt < 7 días` |
| Zona horaria | **Ninguna.** Todo se mide en `timestamptz`; no hay cortes de día ni de semana |
| Cuándo se rompe | Cuando `now ≥ última.endsAt + 7 días` |
| Plantón | No cuenta, **pero no rompe**: solo el tiempo rompe una racha |
| Valoración | **No se lee nunca.** La racha sale solo de sesiones y asistencia |
| Desde cuándo se ve | Desde 2 sesiones seguidas. Con 1 no se pinta nada |
| Dónde se ve | Tarjeta "Sesión Lock-In" del chat, y etiqueta en la fila de Matches |
| Se guarda | No. Se calcula al leer (enfoque A) |

### Por qué de la pareja y no de la persona

Porque lo que evita la graduación no es que tú abras la app, sino que la
relación con alguien concreto siga teniendo un siguiente paso. Una racha
personal premia volver a la app con quien sea; la de pareja premia volver con
esa persona, que es lo que un producto de cofundadores y compañeros de enfoque
quiere. Y si la personal fuera visible a otros sería reputación; si fuera
privada, perdería casi todo el empuje.

### Por qué ventana móvil y no semanas naturales

Un match Madrid–Bogotá no comparte medianoche. Con semanas en la zona de cada
uno, la misma pareja vería números distintos, que contradice que la racha sea
de los dos. Con semanas en UTC el número es común, pero el corte cae el domingo
por la noche para unos y el lunes de madrugada para otros, y una sesión a esa
hora "cuenta para la semana equivocada". La ventana móvil no tiene corte: la
racha sigue viva mientras la siguiente sesión empiece menos de 7 días después
de acabar la anterior, y eso se lee igual desde cualquier zona.

La elección de 7 días (y no 3 o 14) sigue el ritmo realista de dos personas que
cuadran agendas: una vez por semana es sostenible; más exigente se rompe casi
siempre y deja de motivar.

### Por qué suma al entrar y no al terminar

La recompensa llega mientras la sesión ocurre, que es cuando se mira la
tarjeta. Y es coherente con la semántica heredada: asistir es haber entrado
antes del final, y salirse antes no lo deshace — tampoco aquí.

### Por qué un plantón no rompe la racha

Si un plantón la rompiera, la racha sería el sitio donde se castiga a la otra
persona por no venir — lo mismo que la valoración se negó a ser. El plantón ya
está registrado (falta la fila de asistencia) y queda para quien lo lea con su
propia spec. Aquí la sesión fallida simplemente no suma, y la racha sigue su
reloj: si os veis antes de que pasen 7 días desde la última compartida, sigue.

### Por qué no lee la valoración

`session_ratings` es privada de quien la escribe. Si la racha solo contara
sesiones valoradas como `bien` o `genial`, la otra persona deduciría tu
valoración viendo si el número sube. La única forma de que la racha no filtre
la valoración es no mirarla. La asistencia, en cambio, ya la leen las dos
personas del match (política de `session_attendance`): la racha no revela nada
que no fuera ya visible.

### Por qué desde 2

"Racha 1" no dice nada que la tarjeta no diga ya — es "habéis hecho una sesión".
El número empieza a significar algo cuando hay continuidad.

### Por qué no se guarda

La caducidad depende del tiempo, y ningún trigger la dispara: aunque se
guardara el número, habría que compararlo con `now` al leer. Y guardar un dato
derivado lo desincroniza cada vez que la historia cambia (una sesión cancelada,
el envejecido de filas del E2E). Calcularlo al leer, con el mismo patrón de
`ratable_session`, no deja nada que mantener.

## 1. Modelo, reglas y contrato

### Dominio — `src/data/types.ts`

```ts
/** Racha de una pareja: sesiones compartidas seguidas, viva o nada. */
export interface MatchStreak {
  matchId: string;
  /** Sesiones compartidas seguidas de la cadena viva. Siempre ≥ 1. */
  count: number;
  /** ISO. Fin de la última sesión que cuenta + 7 días. */
  aliveUntil: string;
}
```

Una racha rota **no se representa**: el repositorio solo devuelve matches con
racha viva. Un match ausente de la lista es un match sin racha.

### Reglas puras — `src/data/streaks.ts` (nuevo)

Constante `STREAK_GAP_DAYS = 7`, y `pairStreak(shared, nowMs)`: recibe las
sesiones **ya filtradas** como compartidas (en cualquier orden) y devuelve
`{ count, aliveUntilMs } | null`. El filtro de "compartida" no vive aquí porque
cada backend ya lo tiene: el mock con `bothAttended`, Supabase con
`session_both_attended`.

### Reglas

Las diez, con el criterio de las specs anteriores — se cumplen igual en el mock
y en Supabase, y la suite de contrato las prueba en los dos:

1. Cuenta una sesión con `status = 'aceptada'` en la que **las dos** personas
   del match tienen asistencia con `joinedAt < endsAt`.
2. Suma desde que entra la segunda persona, aunque la sesión siga en curso.
3. Dos sesiones que cuentan son seguidas si
   `siguiente.startsAt − anterior.endsAt < 7 días` (estricto: 7 días exactos
   rompen).
4. La racha es la longitud de la **última** cadena de sesiones seguidas, y está
   viva mientras `now < última.endsAt + 7 días`. Si no, no hay racha.
5. Las sesiones que no cuentan (plantón, cancelada, rechazada, propuesta
   caducada) ni suman ni rompen.
6. Nunca se lee `session_ratings`.
7. Solo la leen las dos personas del match. Un tercero no ve rachas ajenas.
8. Las dos personas ven el mismo número y la misma `aliveUntil`.
9. No depende de zona horaria.
10. Que haya o no racha nunca bloquea nada.

### Contrato — `src/data/repositories.ts`

Un método nuevo en `LockInSessionRepository`. **Sin repositorio nuevo**, por lo
mismo que la valoración: es estado derivado de las sesiones.

```ts
export interface LockInSessionRepository {
  // … los trece métodos que ya existen …

  /**
   * Rachas vivas de tus matches: una entrada por match con al menos una sesión
   * compartida en la cadena viva. Un match que no aparece no tiene racha.
   */
  listStreaks(): Promise<MatchStreak[]>;
}
```

Una sola llamada para todos los matches porque la lista de Matches la necesita
de golpe; la tarjeta del chat usa la misma y se queda con la de su match. Pedir
por match multiplicaría las llamadas en la lista.

**Errores: ninguno de dominio.** `listStreaks` no valida nada; un fallo de red se
propaga tal cual y la UI lo trata como "sin racha" (§ 2).

### Supabase — migración nueva en `supabase/migrations/`

Archivo `20260915000200_match_streaks.sql`, continuación de las dos anteriores
y con su mismo patrón (cabecera que dice de qué spec sale, `set search_path =
''`, `revoke`/`grant` al final):

- **Sin tablas, sin enums, sin políticas.** Solo una función.
- RPC `public.match_streaks()` → `table (match_id uuid, streak_count integer,
  alive_until timestamptz)`, `language sql`, `stable`, `security definer`.
  Filtra por matches del actor (`auth.uid()` en `profile_a`/`profile_b`),
  `status = 'aceptada'` y `public.session_both_attended(s.id)`; marca con
  `lag(ends_at)` dónde empieza cada cadena (`starts_at − lag ≥ 7 días`), numera
  las cadenas con una suma acumulada, se queda con la última de cada match y la
  devuelve solo si `now() < último_fin + 7 días`.
- **No lee `session_ratings`.** Lo fija una aserción del test embebido, además
  del comentario.
- `revoke execute … from public, anon` y `grant execute … to authenticated`.
- **Realtime: nada nuevo.** La racha cambia cuando cambian `lockin_sessions` o
  `session_attendance`, que ya publican.
- `supabase/seed.sql` no se toca.

**Cotejo de esquema.** Como en la valoración, `drift-check.mjs` y
`schema-fingerprint.sql` no se tocan: la función nueva sale de parsear
`create or replace function public.match_streaks(`. Si no aparece en su salida,
el arreglo es la forma de la migración, no el script.

## 2. Pantallas

### Alcance de archivos

Dueño: el bloque `sesiones` (`src/features/session/`, piezas de sesiones de
`src/data/**`, `supabase/migrations/`, y los archivos de esquema y E2E que ya
tocaron las dos piezas anteriores). **Con tres cruces declarados**, que son la
diferencia con la valoración:

| Archivo | Bloque dueño | Qué cambia |
|---|---|---|
| `src/app/(tabs)/matches.tsx` (+ `test/app/matches.test.tsx`) | `chat` | Llama a `useMatchStreaks()`, pasa `streak` a `MatchRow`, añade `extraData` |
| `src/features/chat/match-row.tsx` (+ su test) | `chat` | Prop opcional `streak?: number \| null`: etiqueta y `accessibilityLabel` |
| `test/routes.tsx` | `calidad` | `useFocusEffect` en `expoRouterMock()` (una línea) |

`MatchRow` recibe un número y no sabe nada de sesiones: el bloque `chat` no
importa de `@/features/session`. Quien compone las dos cosas es la ruta.

Archivos nuevos en `src/features/session/`: `streak.ts` (reglas de qué pintar y
textos) y `use-match-streaks.ts`. Se modifican `use-active-session.ts`,
`session-card.tsx` e `index.ts`. `src/app/session/[sessionId].tsx` **no se
toca**: la pantalla de sesión es de la valoración, y un número ahí competiría
con "solo lo ves tú".

### Qué se pinta

`visibleStreak(streak, nowMs)` devuelve el número a pintar o `null`: `null` si
no hay racha, si `count < 2` o si `nowMs ≥ aliveUntil`. Esta última comprobación
es la que hace que una racha caduque en pantalla sin volver a pedir datos.

### Tarjeta del chat

```
┌─ SESIÓN LOCK-IN ─────────────────┐
│ Racha de 3 sesiones seguidas      │
│ Sin sesión, se rompe en 6 días    │   ← solo en `agendar`
│ [ Agendar sesión Lock-In ]        │
└──────────────────────────────────┘
```

| Estado de `cardView` | Líneas de racha |
|---|---|
| `agendar` | "Racha de N sesiones seguidas" · "Sin sesión, se rompe {formatStartsIn(aliveUntil − now)}" |
| `esperando`, `recibida`, `aceptada`, `entrar` | Solo "Racha de N sesiones seguidas" |
| `valorar` | **Nada.** La valoración no se pinta junto a la racha, para no sugerir que una afecta a la otra |

La segunda línea usa `formatStartsIn` ("en 6 días", "en 5 h") y no una fecha:
`formatSessionWhen` pinta el día de la semana, y una racha que acaba de sumar
caduca el mismo día de la semana siguiente, que se leería como hoy. Solo sale en
`agendar` porque es el único estado donde el aviso lleva a una acción.

`useActiveSession` pide también `listStreaks()` con su `useQuery` y la mete en el
mismo `refresh` combinado (el `subscribe` del match y el tic de 30 s), y
devuelve `streak: MatchStreak | null` — la de ese match. Entrar la segunda
persona dispara el `subscribe` de asistencia, así que la tarjeta sube el número
sola.

### Fila de Matches

```
┌────────────────────────────────────┐
│ (NB) Núria Bosch           hace 2 h │
│ LOCK-IN · RACHA 3                   │
│ Tú: nos vemos el viernes            │
└────────────────────────────────────┘
```

Etiqueta `· Racha N` en `themeColor="brass"`, en la línea de tags y después del
modo (y de `· Nuevo`, si lo hubiera). El `accessibilityLabel` pasa a
`Conversación con {nombre}. Racha de N sesiones seguidas. {preview}` — con la
racha antes del preview, que es donde la lee un lector de pantalla sin tener
que oír el mensaje entero.

`useMatchStreaks()` hace **una** llamada a `listStreaks()` y devuelve
`streakFor(matchId): number | null`, ya pasado por `visibleStreak`. Refresca con
`useFocusEffect` —la racha cambia dentro de una sesión, y al volver a la pestaña
tiene que estar al día— y también desde el `RefreshControl` que ya tiene la
pantalla. La `FlatList` necesita `extraData` con las rachas: sin él no repinta
las filas cuando llegan después que los matches.

Si `listStreaks` falla, no se pinta ninguna racha y **no** hay mensaje: la
pantalla ya tiene su propio error de carga, y la racha es un añadido, no un dato
del que dependa nada (regla 10).

## 3. Casos límite

| Caso | Comportamiento |
|---|---|
| Primera sesión compartida | Racha 1: el repositorio la devuelve, la UI no la pinta |
| Segunda persona entra en la segunda sesión | Racha 2 en la tarjeta al momento (`subscribe`); en Matches al volver a la pestaña |
| Sesión en curso con los dos dentro | Ya cuenta; `aliveUntil` = su final + 7 días |
| Siguiente sesión empieza 7 días exactos después del final anterior | Rompe: la regla es estricta (`<`) |
| Plantón entre dos sesiones compartidas | No suma ni rompe; la cadena sigue si el hueco entre compartidas es < 7 días |
| Plantón como única sesión reciente | La racha anterior caduca por tiempo, como sin sesión |
| Cancelada o rechazada | No cuenta, no rompe |
| Una sola persona entra y se va, la otra entra después (antes del final) | Cuenta: las dos tienen `joinedAt < endsAt` |
| Una valoración `floja` | No cambia nada. La racha no mira valoraciones |
| Racha caduca con la app abierta | `visibleStreak` compara con `now` y la oculta sin pedir datos |
| Reloj del dispositivo desviado | Solo afecta a cuándo desaparece en pantalla (minutos sobre 7 días); el servidor ya filtra con `now()` |
| Match Madrid–Bogotá | Mismo número y misma `aliveUntil` para los dos |
| Tercero sin acceso | `listStreaks` no devuelve matches ajenos |
| Se borra un perfil | `on delete cascade` ya borra sesiones y asistencia; la racha desaparece sola |
| `listStreaks` falla | Sin racha pintada, sin mensaje |

## 4. Tests

| Nivel | Qué |
|---|---|
| Unitarios | `pairStreak`: vacía, una, cadena de tres, hueco de 7 días exactos (rompe) y de 7 días − 1 ms (sigue), la última cadena gana a una anterior más larga, frontera de caducidad (`aliveUntil − 1 ms` viva, `aliveUntil` muerta), entrada desordenada. `visibleStreak`: `null`, count 1, count 2, caducada. Textos de `streak.ts` |
| Contrato (`src/data/repositories.contract.ts`) | En mock y contra Supabase con `LOCKIN_SUPABASE_CONTRACT=1`. Con `it` normal (una sesión de 1 bloque se puede proponer, aceptar y entrar en segundos): los dos dentro → racha 1 para ese match, **igual vista desde los dos lados**; solo uno dentro → sin entrada; un tercero no la ve. Con `itWithTimeTravel`: dos seguidas → 2; hueco ≥ 7 días → 1; pasados 7 días del final → sin entrada; plantón en medio no rompe; cancelada no cuenta; valorar `floja` una sesión no cambia la racha de ninguno de los dos |
| Esquema (PGlite, `supabase/schema-embedded.test.mjs`) | `match_streaks()` con `auth.uid()` sustituida y filas con `starts_at` en el pasado: cadena de tres, corte a 7 días, caducada, plantón en medio, cancelada, match ajeno invisible, y que añadir filas en `session_ratings` no cambia el resultado. Aserción sobre la definición de la función: no menciona `session_ratings` |
| Componentes (RNTL) | `SessionCard`: las dos líneas en `agendar`, una en los otros estados vivos, ninguna en `valorar` y ninguna con racha 1. `MatchRow`: etiqueta y `accessibilityLabel` con y sin racha. `matches.tsx`: pasa la racha a la fila correcta y refresca al enfocar |
| E2E Android | Flujo nuevo `e2e/session-streak.yaml` tras `session-rate.yaml`. `prepareSessionStreak` en `e2e/verify.mjs` inserta con `service_role` una sesión aceptada anterior del mismo match (hace 3 días, fuera de la ventana de valoración) con las dos asistencias; el flujo comprueba "Racha de 2 sesiones seguidas" en la fila de Matches y en la tarjeta. **No hay oráculo de Postgres**: la racha no se guarda, así que la evidencia es la UI |

El suelo de cobertura de `jest.config.js` no baja.

## Fuera de alcance de esta spec

Racha personal, racha visible en perfil o deck, récord histórico ("vuestra mejor
racha"), aviso o notificación de racha a punto de romperse, recompensas o
insignias, efecto de la racha en el deck, que la valoración module la racha, y
cualquier contador de plantones.

## Dependencias

- `sesiones` entregado (su casilla abierta, verificación con dos móviles, no
  toca nada de esto).
- `valoracion` entregado: la migración usa `public.session_both_attended`, que
  nace en `20260915000100_session_ratings.sql`.
- **Aplicar la migración en `grrzmzktrhksbttpbblg` es del usuario.** La de la
  valoración, de la que depende, ya está aplicada (`0430117`). Hoy el job
  remoto de `schema-drift.yml` está en verde; en cuanto se fusione esta
  migración pasará a rojo hasta que se aplique, y ese rojo —solo ese— será
  esperado. Todo lo demás avanza igual.
