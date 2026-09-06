# TODO — arquitecto

> **Estado: bloque completado (2026-09-05).** El contrato de `src/data/` queda
> **congelado**: `perfil`, `descubrir`, `chat` y `datos` construyen sobre él.
> Cualquier cambio de tipos o de firmas de repositorio debe avisarse antes,
> porque rompe pantallas de otros bloques.

## Proyecto base
- [x] Scaffold Expo + TypeScript + Expo Router (SDK 57)
- [x] Eliminar el contenido de demo de Expo (pantalla "Welcome to Expo", `animated-icon`, `web-badge`, `hint-row`) una vez sustituido por el shell real

## Sistema de diseño
- [x] Sustituir `src/constants/theme.ts`: colores de marca (latón / grafito-salvia / verde-azulado, claro y oscuro — ver `docs/plan/CONCEPTO.md`)
- [x] Cargar tipografías Fraunces / IBM Plex Sans / IBM Plex Mono (`expo-font` + `@expo-google-fonts/*` o Google Fonts)
- [x] Escala tipográfica y espaciado consistente (reusar `Spacing` existente o redefinir)

## Navegación
- [x] Grupo de rutas `(onboarding)`: selección de modo → formulario de perfil
- [x] Shell de tabs: Descubrir / Matches / Perfil (sustituir Home/Explore actuales)
- [x] Ruta `chat/[matchId]` fuera de las tabs

## Capa de datos
- [x] Definir tipos: `Profile`, `Mode` (`par` | `lockin`), `Match`, `Message`
- [x] Definir interfaz de repositorio (p. ej. `ProfileRepository`, `MatchRepository`, `MessageRepository`)
- [x] Implementación mock en memoria con datos de ejemplo mínimos
- [x] Punto único de acceso (p. ej. `src/data/index.ts`) que expone la implementación activa — para que `datos` pueda sustituirla por Supabase sin tocar pantallas

## Entrega
- [x] Confirmar que `npx expo start --web` levanta sin errores
- [x] Dejar constancia (en este archivo y avisando en el chat) de cuándo el contrato de `src/data/` queda congelado — los demás bloques dependen de que no cambie sin avisar

---

## Qué quedó montado

### Sistema de diseño — `src/constants/`
- `theme.ts`: `Colors` (claro/oscuro con los cinco tokens de marca más superficies,
  texto secundario, bordes y variantes suaves de cada acento), `Typography`
  (escala cerrada de 12 roles), `FontFamily`, `Spacing`, `Radii`, `Duration`.
  Ningún componente debe declarar un color literal: si falta un token, se añade aquí.
- `fonts.ts`: mapa que carga `src/app/_layout.tsx` con `expo-font`.
- `ThemedText` consume `Typography` — usa `<ThemedText type="label">` etc.,
  no `fontSize` sueltos.

### Navegación — `src/app/`
```
_layout.tsx            Stack raíz: fuentes, tema, DataProvider, GestureHandlerRootView
index.tsx              Puerta: pregunta a la capa de datos y redirige a /mode o /discover
(onboarding)/mode.tsx          → perfil
(onboarding)/profile-form.tsx  → perfil
(tabs)/discover.tsx            → descubrir
(tabs)/matches.tsx             → chat
(tabs)/profile.tsx             → perfil
chat/[matchId].tsx             → chat
```
Las tabs nativas viven en `src/components/app-tabs.tsx` (SF Symbols en iOS,
Material Symbols en Android — sin assets propios) y la variante web en
`app-tabs.web.tsx`.

### Capa de datos — `src/data/`
| Archivo | Qué es |
|---|---|
| `types.ts` | `Profile`, `Mode`, `Match`, `Message` y demás tipos de dominio |
| `repositories.ts` | Interfaces: `session`, `profiles`, `discovery`, `matches`, `messages` |
| `mock/` | Implementación en memoria + semillas |
| `active.ts` | **El único sitio que elige backend.** Aquí entra Supabase |
| `provider.tsx` | `DataProvider`, `useRepositories()`, `useQuery(key, run)` |
| `index.ts` | Lo que importan las pantallas: `import { ... } from '@/data'` |

Regla: las pantallas importan siempre de `@/data`, nunca de `@/data/mock`.

## Andamios que hay que retirar
- `src/components/screen-placeholder.tsx` y las 6 pantallas que lo usan son
  **temporales**: existen para que las rutas resuelvan. Cada bloque sustituye las
  suyas (el `owner` está anotado en cada archivo). Cuando no quede ninguna,
  borra el componente.
- Los perfiles semilla de `src/data/mock/seed.ts` son 3, el mínimo para que el
  shell enseñe algo. `perfil` es el dueño del catálogo: amplía esa lista hasta
  los 6-8 perfiles, sin crear otra aparte. `SEED_RECIPROCAL_IDS` marca quién da
  match recíproco.
- ~~`src/components/ui/collapsible.tsx`~~ — retirado por `calidad` el 2026-09-06.
  No lo importaba nadie. Con él desaparece el único uso de `expo-symbols` en el
  código: **queda decidir si se quita la dependencia de `package.json`**. Es tuya
  esa llamada — puede que la quieras para los iconos de las tabs nativas.

## Archivos tocados fuera del alcance declarado
Se avisa por si choca con otra sesión:
- `src/components/themed-text.tsx`, `src/components/app-tabs.web.tsx`,
  `src/hooks/use-theme.ts`, `src/global.css` — primitivas compartidas del
  scaffold; sin actualizarlas el sistema de diseño quedaba a medias.
- `src/hooks/use-color-scheme.web.ts` — la detección de hidratación usaba un
  `setState` dentro de un efecto, que el lint de React marca como error. Ahora
  usa `useSyncExternalStore`; el comportamiento es el mismo.
- `eslint.config.js` + devDeps de ESLint — los creó `npx expo lint` al ejecutarlo
  para validar este bloque. **Es territorio de `calidad`**: quédatelo y amplíalo
  (Prettier, reglas propias, CI) o rehazlo, pero no lo dupliques.

## Verificación hecha
- `npx tsc --noEmit`: limpio.
- `npx eslint src`: 0 errores, 0 avisos.
- `npx expo export --platform web`: 14 rutas generadas sin errores.
- `npx expo start --web`: levanta sin errores; `/`, `/discover`, `/matches`,
  `/profile`, `/mode`, `/profile-form` y `/chat/[matchId]` responden 200, y el
  HTML servido lleva ya los colores de marca y las `@font-face` de Fraunces e
  IBM Plex.
- Capa de datos: 23 comprobaciones de comportamiento sobre el mock (onboarding,
  filtrado del deck por modo, pass, like recíproco, lista de matches con
  contraparte resuelta, mensajería y suscripciones) — todas en verde. Se hicieron
  con un script desechable: los tests de verdad son de `calidad`.

---

## Reportado por `calidad` (2026-09-05) — contraste de la paleta

`src/constants/theme.test.ts` mide el ratio WCAG de cada par de tokens que la app
usa de verdad. Casi todo cumple AA. Estos cuatro pares no, y el arreglo es una
decisión de paleta, no de una pantalla:

| Par | Claro | Oscuro | Umbral | Dónde se ve |
|---|---|---|---|---|
| `textMuted` sobre `background` | 3.42 | 4.84 | 4.5 | metadatos, marcas de tiempo |
| `textMuted` sobre `backgroundElement` | 3.14 | 4.26 | 4.5 | placeholder y contador de campo |
| `border` sobre `background` | 1.28 | 1.53 | 3 | borde de tarjeta y de campo |
| `border` sobre `backgroundElement` | 1.17 | 1.34 | 3 | separador dentro de tarjeta |

- [x] **`textMuted` — decidido (2026-09-06): en claro se retira el tercer nivel.**
      Se comprobó numéricamente que no hay salida: para llegar a 4.5:1 sobre la
      superficie más oscura, `textMuted` tiene que caer en torno a `#646F60`, que
      queda a 1.17 de `textSecondary` — la misma tinta a ojo. Subir las dos
      superficies tampoco abre hueco (se probaron tres pares, ninguno pasa). Así
      que en claro `textMuted` vale `#5A6459`, igual que `textSecondary`: 5.38 y
      4.93, ambos AA. En oscuro el tercer nivel sí cabe y se conserva,
      `#7D8874` → `#828D79`: 5.17 y 4.56, manteniendo la separación con
      `textSecondary` (1.47, frente a 1.57 de antes). El token sigue existiendo en
      los dos temas para que ninguna pantalla tenga que ramificar por tema.

- [x] **`border` — decidido (2026-09-06): no aplica, no es deuda.**
      El planteamiento original era demasiado amplio. La regla WCAG 1.4.11 cubre
      los componentes de interfaz cuyo límite hace falta para identificarlos: el
      borde de una tarjeta es decoración y está exento, y los campos del
      formulario se identifican por su etiqueta visible permanente
      (`src/features/profile/controls.tsx`), no por el trazo. De los cuatro pares
      reportados, los dos de `border` no aplicaban. No se cambia ningún color.
      Si algún día un control depende solo del borde para distinguirse, ese
      control sí entra en la lista.

Con las dos decisiones aplicadas, `KNOWN_GAPS` en `theme.test.ts` queda vacío:
los dos pares de `textMuted` subieron a `AA_PAIRS` y los dos de `border` se
retiraron por no aplicar. El razonamiento completo vive en el comentario de
`KNOWN_GAPS`, para que quien lo lea dentro de un año no lo reabra sin contexto.

**Ya arreglado por `calidad`:** `brassSoft` claro pasa de `#F0E3C9` a `#F2E5CB`
(el chip de marca seleccionado estaba en 4.44:1, a un pelo de AA). Es el mismo
color a ojo y no toca ninguno de los cinco literales de marca de `CONCEPTO.md`.
