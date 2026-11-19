# design-sync — notas del repo (sistema «cristal»)

Proyecto Claude Design: «cofounder» (`projectId` en config.json). Hubo un intento previo «LockIn · cristal» que quedó vacío y sin usar.

## Cómo se construye
- La app es Expo/React Native: no hay `dist/`. `node .design-sync/build-web.mjs` (es el `buildCmd`) compila `.design-sync/ds-entry.ts` para navegador y deja un paquete interno en `.design-sync/.cache/web-pkg/` (`dist/index.mjs`, `dist/styles.css`, `types/`, `tokens/cristal.css`, `docs/`). El converter lo consume con `--entry .design-sync/.cache/web-pkg/dist/index.mjs`, y `srcDir`/`docsDir`/`cssEntry`/`extraFonts` son relativos a ese paquete.
- Orden en cada sync: `node .design-sync/build-web.mjs` → `node .ds-sync/resync.mjs --config .design-sync/config.json --node-modules ./node_modules --entry .design-sync/.cache/web-pkg/dist/index.mjs --out ./ds-bundle [--remote …]`.
- La superficie sincronizada la decide `ds-entry.ts`. Fuera a propósito: AppTabs, ExternalLink, PushBridge, SwipeBetweenTabs, AppIntro, WelcomeSplash y LocaleSwitchVeil (dependen del router, push o pager) y AmbientBackground (devuelve null). Los objetos de tokens se excluyen como componentes con `componentSrcMap: null`.
- Los grupos del selector salen del mapa `GROUPS` de `build-web.mjs`, que también genera un `.md` por componente con `category` y el JSDoc real (adyacente o, si no hay, la cabecera del archivo).

## Problemas resueltos en el prebuild (no quitarlos)
- `react-native` → `.design-sync/rn-web-shim.js` (react-native-web + `TurboModuleRegistry` inerte, que react-native-svg importa).
- `@react-native/assets-registry/registry` → shim vacío. `expo-modules-core/build/ts-declarations/global.js` → módulo vacío (son tipos compilados).
- `require('react')` desde deps CommonJS → módulo virtual ESM que reexporta, incluido `default` (Babel lee `.default`). Sin esto: «Dynamic require of "react"» o «createContext of undefined».
- Banner `var process = …`: expo lee `process.env.*` en runtime.
- react-native-web inyecta `<style id="react-native-stylesheet">`. El render check toma `[id^="r"]` como raíz de preview y daba «root empty». Se renombra a `ds-native-stylesheet`; ojo, el id nuevo no puede empezar por «r».
- `tokens/cristal.css` se genera importando el bundle en node (con `requestAnimationFrame` y `require` globales), no copiando valores. Se anexa a `dist/styles.css` porque `tokensGlob` solo funciona con un `tokensPkg` de node_modules.

## Previews
- Sistema solo oscuro: cada preview envuelve en `Screen` con `style={{ flex: 0 }}` (si no, `flex: 1` colapsa en la tarjeta). Las de pantalla completa (MessageState, LoadingState) llevan `height` fijo.
- No importar `react-native` en las previews (no pasa por el alias): maquetar con `div`.
- `Frosted`: los hijos tienen que estar posicionados. Un SVG suelto queda bajo el `BlurView` absoluto y sale borroso.
- `Button` con `href` necesita el router: en previews, siempre `onPress`.
- ThinkingLogo/LoadingState se capturan a mitad del pulso (gris): es lo esperado.

## Contratos escritos a mano (`dtsPropsFor`)
- Frosted: `RefObject<ViewInstance>` rompía el `.d.ts`.
- Icon: la unión `IconName` se aplanaba a `unknown`.
- Glass, Screen, ScalePressable: para no arrastrar todo `ViewProps` de RN.
- Si cambian las props en `src/components`, actualizar estos contratos a mano.

## Fuentes
- `.design-sync/fonts.css` declara las familias con los nombres de `FontFamily` (`InstrumentSans_500Medium`…) y también «Instrument Sans/Serif» (lo que usa `global.css`), apuntando a los `.ttf` de `@expo-google-fonts`.
- `runtimeFontPrefixes: ["SF Pro"]`: «SF Pro Text» solo aparece como respaldo de sistema en `--font-sans`, detrás de Instrument Sans, que sí se incluye.

## Entorno
- Playwright 1.63.0 instalado en `.ds-sync` con `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`; usa el Chromium 1243 que ya hay en `~/AppData/Local/ms-playwright`.
- En Windows, no dejar ninguna shell con el cwd dentro de `ds-bundle/`: el build hace `rm` de esa carpeta y falla con EPERM.

## Avisos de render conocidos
- Ninguno abierto. `Icon` usa `cardMode: "column"` por `[GRID_OVERFLOW]` de la rejilla de 24 iconos.

## Riesgos en re-sync
- `dtsPropsFor` duplica a mano las props de Frosted, Icon (lista de nombres), Glass, Screen y ScalePressable: si cambian en el código, se desincronizan sin aviso.
- `GROUPS` en `build-web.mjs` y la lista de `ds-entry.ts` también son manuales: un componente nuevo no aparece hasta añadirlo en los dos sitios.
- Los shims dependen de las versiones actuales (react-native-web 0.21, react-native-svg 15.16, expo 58). Tras subir versiones, revisar si cambia la ruta de `StyleSheet/dom/index.js` o aparecen imports solo-nativos nuevos.
- `docs/CONTEXTO-APP-PARA-CLAUDE.md` sigue diciendo acento «brasa #FF8645» y fondo grafito. El código (y lo sincronizado) usa acento blanco y negro liso; `Elevation.glow` y `onAccent` siguen pensados para el naranja.
