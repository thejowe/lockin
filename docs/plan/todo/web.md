# Web pública — landing de getcofounder.app

Pedido por el usuario el 2026-11-10: convertir la portada de `https://getcofounder.app` en una
landing que explique la app y lleve a las tiendas. **No es una app de escritorio**: la app se usa
en el móvil; la web convierte visitas en descargas y aloja lo legal que exigen las tiendas.

## Punto de partida (comprobado el 2026-11-10)

- La web ya existe: `web/` (fragmentos HTML + `style.css`) → `node scripts/build-web.mjs` → `_site/`.
  Tres idiomas: `es` en la raíz, `/en/` y `/ca/`, con selector, `lang` y `hreflang`.
- La portada actual (`web/_content/<idioma>/index.html`) es un párrafo y una lista de enlaces legales.
- Despliegue: GitHub Pages con HTTPS forzado; según `TODO.md`, se publica copiando `_site/` al clon de
  `thejowe/cofounder-web` (commit + push). `pages.yml` de este repo no publica solo.
- **Las URL legales no cambian** (`/privacidad/`, `/terminos/`, `/normas/`, `/seguridad-infantil/`,
  `/soporte/`, `/eliminar-cuenta/`): están en App Store, Play y dentro de la app.
- Tiendas: iOS 1.0 en revisión de Apple; Android en alpha cerrada (faltan 12 testers × 14 días).
  **Aún no hay URL pública de ninguna tienda.**

## Decisiones

- **HTML y CSS estáticos, sin framework ni dependencias nuevas.** Se amplía `build-web.mjs`. El
  móvil animado necesita JS propio (ver «El móvil que acompaña el scroll»), pero la página se lee
  entera sin él: sin JS, las capturas salen quietas al lado de cada explicación.
- **Contenido en los tres idiomas** desde el primer día, igual que el resto de la web.
- **Botones de tienda con estado «Próximamente»** mientras no haya URL: un único sitio de
  configuración (p. ej. `web/_content/stores.json` con `ios` y `android`, `null` = próximamente).
  Al publicarse cada app solo se rellena su URL y se vuelve a publicar.
- **Insignias oficiales** de App Store y Google Play (SVG de Apple y Google, con sus normas de uso y en
  el idioma de cada página), nunca dibujadas a mano.
- **QR solo en escritorio** (`@media (min-width: …)` + `pointer: fine`): apunta a
  `https://getcofounder.app/descargar/`, que redirige a la tienda según el sistema (o a la portada si no
  hay tienda todavía). El QR es un SVG generado una vez y guardado en `web/`; no cambia nunca porque
  la URL es fija.
- **Capturas reales** de la app (no maquetas inventadas), en un marco de móvil hecho con CSS.
  Las saca `comprobador` del emulador Android con datos de demostración; sin datos personales reales.
- **Premium**: lo que lista `BENEFITS` en `src/features/premium/paywall.tsx` y los precios decididos
  (4,99 €/mes, 39,99 €/año, prueba de 3 días al mes y 7 al año). Si el paywall cambia, la web también.
- Rendimiento: imágenes WebP/AVIF con `width`/`height`, `loading="lazy"` bajo el pliegue; sin fuentes
  externas bloqueantes. Objetivo Lighthouse ≥ 95 en móvil en las cuatro categorías.

## El móvil que acompaña el scroll (idea del usuario, 2026-11-10)

Es la pieza central de la landing. Un único móvil con la app de cofounder abierta acompaña al
visitante desde la portada hasta el final del recorrido:

1. **Al entrar:** a la izquierda, la frase, el subtítulo, las insignias de App Store y Google Play
   (y el QR en escritorio). A la derecha, el móvil **aparece con una animación de entrada**: sube y
   se hace visible mientras **da una vuelta completa** sobre su eje vertical, y termina de frente
   enseñando la app (el deck de Descubrir).
2. **Al bajar:** el móvil se queda fijo en pantalla (`position: sticky`) y en cada paso del recorrido:
   - **da una vuelta** y, en mitad del giro (cuando está de canto o de espaldas y no se ve la
     pantalla), **cambia a la pantalla siguiente** de la app;
   - **cruza al otro lado**: si estaba a la derecha, pasa a la izquierda, y al revés;
   - en el lado contrario aparece **la explicación** de esa pantalla.
3. **Las explicaciones siguen las instrucciones que la app enseña al terminar el registro:** la mano
   que enseña a tocar la tarjeta (`src/features/discover/tap-hint.tsx`) y el tour de botones
   (`src/features/discover/buttons-tour.tsx`), con el mismo estilo: título corto, una frase y el
   contador «1/N». Los textos se toman de ahí (y de `src/i18n/{en,ca}.json`) para no inventar otros.

### Pasos del recorrido (propuesta; se ajusta con las capturas reales)

| # | Pantalla en el móvil | Explicación al lado | Origen del texto |
|---|---|---|---|
| 0 | Deck de Descubrir | (portada: frase + tiendas) | — |
| 1 | Formulario de perfil | Crea tu perfil: qué construyes y qué buscas | onboarding |
| 2 | Tarjeta del deck con la mano | Toca la tarjeta para ver más | `tap-hint.tsx` |
| 3 | Deck con un swipe a medias | Desliza: like o pasar | deck |
| 4 | Botón Super Like marcado | Super Like | `buttons-tour.tsx` |
| 5 | Botón Deshacer / Boost marcado | Deshacer y Boost (Premium) | `buttons-tour.tsx` |
| 6 | Filtros | Filtros | `buttons-tour.tsx` |
| 7 | Pantalla de match | Si el interés es mutuo, hay match | match |
| 8 | Chat | Habla y mira si encajáis | chat |
| 9 | Grupos | Únete a un proyecto o crea el tuyo | grupos |

Los pasos 1, 3, 7 y 8 son también los «3 pasos» (perfil → deslizar → match y chat). Así que el
recorrido **sustituye** las secciones separadas de «Cómo funciona» y «Capturas»: no se repiten.
Si el recorrido queda largo, se agrupan los pasos 4–6 en uno («Los botones del deck»).

### Cómo se construye

- **Móvil en CSS 3D:** marco con `perspective` y `transform-style: preserve-3d`, cara frontal con la
  captura y **cara trasera** con el logo de cofounder (en el giro se ve la espalda, así que tiene que
  existir). El marco no copia un modelo concreto de Apple ni de Samsung: móvil genérico.
- **Animación ligada al scroll:** JS propio (~150 líneas, sin GSAP ni otra dependencia), con un
  `requestAnimationFrame` que lee el progreso de cada paso y solo cambia `transform` y `opacity`
  (`rotateY`, `translateX`, `scale`). Se puede usar `animation-timeline: view()` donde exista, pero
  el JS es la base porque Safari y Firefox aún no lo soportan bien.
- **Cambio de pantalla** al cruzar los 90°/270° del giro, cuando la cara frontal no se ve. Capturas
  precargadas (`<link rel="preload">` solo de la primera; el resto `decoding="async"`).
- **Explicaciones** como bloques normales del documento (un `<section>` por paso): el texto es HTML
  real, indexable y legible por lectores de pantalla. El móvil es decorativo (`aria-hidden`), y
  cada captura tiene su `alt` en la versión sin animación.
- **Móvil (pantalla estrecha, < 768 px):** no hay sitio para cruzar de lado. El móvil queda fijo
  arriba, más pequeño, gira y cambia de pantalla igual, y la explicación pasa por debajo.
- **«Reducir movimiento»** (`prefers-reduced-motion`): sin giros ni desplazamientos; la pantalla
  cambia con un fundido corto y el móvil se queda en su sitio.
- **Fluidez:** 60 fps en un portátil normal y en un Android de gama media (perfil de rendimiento de
  Chrome); sin saltos de maquetación (CLS 0) al entrar.
- Al terminar el recorrido, el móvil suelta el `sticky` y la página sigue con Premium.

## Secciones (en este orden)

1. **Portada (hero):** frase clara + subtítulo, insignias App Store / Google Play y QR en
   escritorio; el móvil entra por la derecha dando una vuelta.
2. **Recorrido con el móvil:** los pasos de la tabla de arriba (incluye «Cómo funciona» y las
   capturas reales).
3. *(fusionada en la 2)*
4. **Premium:** qué incluye y precios, con la nota de que se gestiona desde la tienda.
5. **Preguntas frecuentes:** `<details>` nativos (¿es gratis?, ¿qué edad?, ¿en qué países?, ¿cómo
   borro la cuenta?, ¿cómo cancelo Premium?, ¿qué hacéis con mis datos?…).
6. **Pie:** privacidad, términos, normas, seguridad infantil, soporte, eliminar cuenta,
   `soporte@getcofounder.app`, redes sociales, selector de idioma y «16+».

Además: metadatos Open Graph y Twitter Card con imagen 1200×630, `favicon` e icono táctil, Smart App
Banner de iOS (`apple-itunes-app`, cuando haya id de App Store) y datos estructurados
`MobileApplication` (JSON-LD).

## Tareas

### Fase 0 — contenido y decisiones (usuario + Claude)

- [x] [Claude] Textos de la landing en es/en/ca (frase de portada, recorrido, Premium, FAQ), en el
  tono de las fichas de tienda. 2026-11-10: escritos directamente en `web/_content/<idioma>/landing.json`
  (no en un `web-textos.md` aparte) para revisarlos ya maquetados; pendientes de la aprobación de abajo.
- [ ] **Usuario:** aprobar la frase de portada y las FAQ.
- [ ] **Usuario:** pasar las cuentas de redes sociales (o decidir que el pie va sin redes de momento).
- [ ] **Usuario:** confirmar si Brodie/Joel quieren aparecer (nombre del titular en el pie) o solo la
  marca. Ojo: el aviso legal con NIF está pendiente aparte (estado de comerciante).

### Fase 1 — capturas (`comprobador`)

- [ ] [comprobador] Capturas del emulador Android (AVD `lockin`) con backend mock y perfiles de
  demostración, una por paso del recorrido (tabla de «El móvil que acompaña el scroll»): deck,
  formulario de perfil, la mano de `tap-hint`, un swipe a medias, cada paso de `buttons-tour`,
  filtros, match, chat y grupos; además el paywall para la sección Premium. Para la mano y el tour
  hay que borrar su marca de `AsyncStorage` (o reinstalar) y que vuelvan a salir. Idioma es, en y ca
  (`EXPO_PUBLIC_FORCE_LOCALE`). Barra de estado limpia (modo demo de SystemUI). Guardar en
  `web/img/capturas/<idioma>/` en PNG a resolución nativa; la conversión a WebP va en la Fase 2.

### Fase 2 — maqueta (Claude, agente `visual` o sesión con `impeccable`/`frontend-design`)

- [x] [Claude] Plantilla de la landing. 2026-11-10: una sola plantilla `web/_content/landing.html`
  con marcadores `{{grupo.clave}}` + textos por idioma en `web/_content/<idioma>/landing.json` (un
  marcador sin texto rompe la build). Estilos propios en `web/landing.css` con la paleta e Instrument
  Serif/Sans de la app (`web/fonts/`); las legales siguen con `style.css`, intactas. Contrato visual en
  `docs/plan/DISENO-web.md` («Dos mitades»).
- [x] [Claude] `stores.json` + estado «Próximamente»: sin URL sale un botón propio «Próximamente»
  (no enlace); con URL, un enlace. Tests en `build-web.test.mjs`.
- [ ] [Claude] Insignias oficiales de App Store y Google Play (descargar los SVG de Apple y Google, con
  permiso del usuario) cuando haya URL de tienda: hoy `storeButtons` pinta un botón de texto.
- [x] [Claude] Página `/descargar/` (redirección por `navigator.userAgent`; sin tienda o en
  escritorio vuelve a la portada del idioma del navegador; enlaces visibles sin JS) y QR SVG
  (`web/img/qr-descargar.svg`, generado con `scripts/make-qr.mjs` usando `toqr`, que ya trae Expo).
- [x] [Claude] Móvil en CSS 3D (cara frontal, trasera con el símbolo y cinco láminas de canto) y su
  entrada: sube a la derecha dando una vuelta completa y queda de frente con el deck.
- [x] [Claude] Recorrido ligado al scroll (`web/landing.js`, sin dependencias): vuelta + cambio de
  pantalla a 180° + cruce de lado, explicación en el lado contrario; 7 pasos (los botones del tour
  agrupados en uno). Versión estrecha, «reducir movimiento» y sin JS hechas. Verificado en el panel de
  navegador a 1440 y 375 px; **«reducir movimiento» y sin JS, solo revisados en código**.
- [x] [Claude] 2026-11-10, a petición del usuario («parece de mala calidad»): fuera las vueltas y
  cruces entre pasos. Se queda la vuelta de entrada; luego el móvil se desliza al centro y crece un
  poco, y el recorrido es un escenario fijo donde cada tramo de scroll cambia pantalla y texto con
  fundido direccional, más un índice de pasos a la derecha. Comprobado con Playwright + Edge headless
  a 375×667, 390×844, 768×1024, 1024×768 y 1440×900: sin solapes móvil/texto ni scroll horizontal.
- [x] [Claude] 2026-11-11: el móvil termina con la última explicación y sube con ella (antes seguía fijo
  100vh de más y Premium lo tapaba); «Descargar» lleva arriba del todo; 40vh de scroll por paso (antes
  70vh); `landing.css`/`landing.js` con `?v=<hash>` para que el navegador no sirva versiones viejas.
- [ ] [Claude] Pantallas del móvil: hoy son HTML con los tokens, iconos y textos de la app (animadas por
  dentro: la mano pulsa, la tarjeta se desliza, el anillo recorre los botones, el match se junta). Con
  las capturas de la Fase 1, decidir si se sustituyen (pierden la animación interna) o se quedan.
- [x] [Claude] Textos del recorrido sacados de `tap-hint.tsx` / `buttons-tour.tsx` y sus
  traducciones (`en.json`/`ca.json`); FAQ con `<details>` (8 preguntas).
- [ ] [Claude] Pasar la animación por la skill `animate` o `review-animations` (curvas, duraciones,
  qué pasa si se hace scroll rápido o hacia atrás) antes del `codex review`.
- [x] [Claude] Open Graph (`web/og.png` 1200×630), favicon SVG, `apple-touch-icon.png`, JSON-LD
  `MobileApplication` y `hreflang` en los tres idiomas. Smart App Banner sale solo con `stores.iosAppId`.
- [ ] `codex review` del diff antes de commitear (regla fija).

### Fase 3 — verificación

- [ ] [Claude] Comprobación visual headless (playwright-core + Edge, ver memoria) a 375, 768 y 1440 px,
  en claro y oscuro, de las tres portadas y de una página legal (que no se haya roto).
- [ ] [Claude] Lighthouse móvil ≥ 95 en rendimiento, accesibilidad, buenas prácticas y SEO.
- [ ] [Claude] Grabar el recorrido (scroll de arriba abajo y de vuelta) en escritorio y en 375 px y
  revisar los fotogramas: el cambio de pantalla nunca se ve de frente, el móvil no tapa el texto y
  no hay tirones. Repetir con «reducir movimiento» activado.
- [ ] [Claude] Enlaces: ninguna URL legal cambia (`build-web.test.mjs`), ningún enlace roto.

### Fase 4 — publicar

- [ ] [Claude] `node scripts/build-web.mjs`, copiar `_site/` al clon de `cofounder-web`, commit y
  push (con permiso: es publicar contenido). Comprobar `https://getcofounder.app` en 200 y las
  `/en/` y `/ca/`.
- [ ] Cuando Apple apruebe: rellenar `stores.ios`, añadir el Smart App Banner y volver a publicar.
- [ ] Cuando Play salga de alpha a producción: rellenar `stores.android` y volver a publicar.

## Fuera de alcance (por ahora)

- Versión web de la app (`app.getcofounder.app`): solo si los usuarios la piden.
- Blog o páginas de SEO por ciudad.
- Analítica: si se añade, sin cookies o con banner de consentimiento, y declarada en `privacidad.md`.
