# TODO — calidad

> **Estado: primera pasada completa (2026-09-05).** El repo pasa de 0 tests a 102,
> con lint, formato, tipos y CI. Lo que queda abierto está al final, en
> "Pendiente".

## Base
- [x] ESLint + Prettier configurados y sin errores (`npm run lint`)
- [x] `tsc --noEmit` limpio

## Tests
- [x] Jest + React Native Testing Library instalados y configurados
- [x] Test de la lógica de matching mock
- [x] Test de al menos una pantalla crítica (formulario de perfil o deck de swipe)

## CI
- [x] Workflow de GitHub Actions: lint + test + `expo export` en cada push/PR

## Accesibilidad
- [x] Labels en todos los inputs de formularios
- [x] Contraste de color verificado con los tokens del tema
- [x] Tamaño táctil mínimo (44×44) en botones interactivos

---

## Qué quedó montado

### Comandos

| Comando | Qué hace |
|---|---|
| `npm run lint` | ESLint (config de Expo, sin las reglas que chocan con Prettier) |
| `npm run format` / `format:check` | Prettier sobre el código; `:check` es el que corre en CI |
| `npm run typecheck` | `tsc --noEmit`, tests incluidos |
| `npm test` / `test:watch` / `test:coverage` | Jest |

### Configuración
- `.prettierrc` — `printWidth: 100`, comillas simples, `bracketSameLine: true`.
  Lo último es para respetar el estilo que ya tenían los cuatro bloques: sin eso,
  el formateo movía el `>` de cierre de 34 archivos ajenos sin cambiar nada.
- `.prettierignore` — deja fuera la prosa (`*.md`, `docs/`, `.claude/`) y
  `package-lock.json`. Reformatear tablas y listas de Markdown ensucia el diff
  sin mejorar nada, y el lock lo escribe npm.
- `eslint.config.js` — añade `eslint-config-prettier` (apaga las reglas de estilo:
  el formato lo decide Prettier, no el linter) y los globals de Jest en los tests.
- `jest.config.js` — preset `jest-expo`, alias `@/`, stub de CSS (`test/style-stub.js`,
  porque `theme.ts` importa `global.css` para web) y la lista de paquetes ESM a
  transpilar.
- `jest.setup.js` — mocks de `react-native-reanimated`, `react-native-gesture-handler`
  y `expo-font`, más los matchers de accesibilidad de RNTL (`toBeSelected`,
  `toHaveAccessibleName`…).
- `tsconfig.json` — `types: ["jest", "node"]`. Sin eso, `tsc` no ve `describe`/`expect`
  y el typecheck de los tests falla.

### Tests — 102, en 5 archivos

| Archivo | Qué cubre |
|---|---|
| `src/data/mock/store.test.ts` | `initialsFrom`, `matchesMode`, `resolveMatchMode` — las funciones puras que deciden a quién ves y bajo qué modo nace un match |
| `src/data/mock/index.test.ts` | El repositorio entero: filtrado del deck por modo/especialidad/decidido, reciprocidad, orden de matches por actividad, aislamiento de hilos, suscripciones, alta y edición de perfil |
| `src/features/discover/use-deck.test.tsx` | El estado del deck: descarte optimista, match, devolución de la tarjeta si el guardado falla, cambio de modo, `refresh` |
| `src/features/profile/profile-form.test.tsx` | Validación, normalización del `ProfileInput`, precarga al editar, error de guardado, y que todo control pulsable tenga nombre accesible |
| `src/constants/theme.test.ts` | Ratio WCAG de cada par de tokens que la app usa de verdad, en claro y oscuro |

`src/data/test-fixtures.ts` es la fábrica de `Profile`/`ProfileInput` para los
tests: si `Profile` gana un campo obligatorio, se añade ahí una vez y no en cada
test. No lo importes desde código de producción.

**Ojo con RNTL 14:** `render`, `fireEvent`, `renderHook` y `rerender` son
**asíncronos**. Sin `await`, el árbol no llega a montarse y las queries fallan con
`` `render` function has not been called ``.

### CI — `.github/workflows/ci.yml`
Cinco trabajos en paralelo sobre `npm ci` y Node 22: lint, formato, tipos, tests
y `expo export --platform web`. Sin `fail-fast`: un lint roto no debe ocultar un
test roto. `concurrency` cancela la ejecución anterior de la misma rama.

### Accesibilidad
- **Labels.** Los nueve `TextInput` del formulario de perfil y el del chat ya
  traían `accessibilityLabel`. Añadido un test que lo guarda: recorre los
  controles con rol `button`/`radio`/`checkbox` del formulario y exige que todos
  tengan nombre accesible.
- **Contraste.** `src/constants/theme.test.ts` mide los 21 pares de tokens que la
  app usa. 17 cumplen AA en claro y oscuro. Los 4 que no (`textMuted` sobre las
  dos superficies y `border` sobre las dos) están reportados en
  `docs/plan/todo/arquitecto.md` con los números medidos, porque el arreglo es una
  decisión de paleta y no de una pantalla. El test fija el ratio actual como
  suelo: no exige el arreglo, pero impide que empeore en silencio.
- **Tamaño táctil.** Cuatro controles se quedaban por debajo de 44 px de alto.
  Arreglados con `hitSlop`, que agranda el área de toque sin tocar el diseño:
  `features/profile/controls.tsx` (chip, 36 px), `features/discover/mode-filter.tsx`
  (chip de filtro, 32 px), `features/chat/icebreaker-suggestions.tsx` (sugerencia,
  36 px) y `components/app-tabs.web.tsx` (pastilla de tab, 28 px). El resto ya
  cumplía.

## Cambios en archivos de otros bloques
- **Formato.** Prettier tocó 13 archivos de `arquitecto`, `perfil`, `descubrir` y
  `chat`. Son cambios de formato puros — ninguna línea cambia de significado.
- **`hitSlop`.** Los cuatro controles de arriba. Una prop añadida cada uno, sin
  tocar estilos ni lógica.
- **`src/constants/theme.ts`.** `brassSoft` claro pasa de `#F0E3C9` a `#F2E5CB`:
  el chip de marca seleccionado estaba en 4.44:1, a un pelo de AA. Es el mismo
  color a ojo y no toca ninguno de los cinco literales de marca de `CONCEPTO.md`.
  Anotado también en el TODO de `arquitecto`.

## Verificación hecha
- `npm run lint` — 0 errores, 0 avisos.
- `npm run typecheck` — limpio.
- `npm run format:check` — todo formateado.
- `npm test` — 102 tests en 5 suites, todos en verde.
- `npx expo export --platform web` — 14 rutas generadas sin errores.

## Pendiente
- [ ] Tests del bloque `chat` (`use-conversation`, `use-matches`, `format.ts` con
      sus fechas relativas). Es el hueco de cobertura más grande que queda.
- [ ] Test de la pantalla de swipe (`swipe-deck.tsx`). `use-deck` ya está cubierto;
      falta el gesto, que necesita mockear `react-native-gesture-handler` más a
      fondo que el `jestSetup` oficial.
- [ ] Umbral de cobertura en `jest.config.js` una vez haya una línea base estable.
      Ponerlo ahora solo serviría para bloquear PRs por ruido.
- [ ] `src/components/ui/collapsible.tsx` es andamio del scaffold de Expo y no lo
      importa nadie. Es de los "andamios que hay que retirar" de `arquitecto`.
- [ ] Cuando `datos` conecte Supabase: los tests de `src/data/mock/index.test.ts`
      son la especificación de lo que el repositorio real tiene que cumplir.
      Reutilizarlos contra la implementación de Supabase, no escribir otros.
