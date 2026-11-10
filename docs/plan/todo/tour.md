# Tour — mini tutorial de después del alta

Pedido por el usuario el 2026-11-10, con tres capturas de referencia (teléfono con una pantalla
real, tarjeta de cristal delante, título, texto, puntos y botón blanco «Siguiente» / «Empezar»):
antes de entrar a la app tras registrarse, un mini tutorial que enseñe qué funciones hay, con
imágenes reales de la app.

## Qué hay

- **Flujo:** `profile-form` → entrada animada (`WelcomeSplash`) → **`/tour`** → `/discover`, con
  `replace` en cada paso. Solo lo ve quien acaba de crear el perfil: quien inicia sesión con un
  perfil ya hecho va directo a Descubrir, como antes. No se guarda nada: el formulario solo se
  completa una vez por cuenta.
- **Páginas** (`src/features/tour/app-tour.tsx`, `TOUR_PAGES`):
  1. *Encuentra a tu cofundador* — captura de Descubrir; tarjeta con un perfil, «✓ Encajas» y los
     botones pasar / Super Like / like.
  2. *Habla con tus matches* — captura de Matches; tarjeta con dos conversaciones.
  3. *Únete a un grupo* — captura de Grupos; tarjeta con el grupo, sus miembros y los perfiles que
     busca, y «Crear grupo».
  4. *Destaca con tu perfil* — captura de Perfil; sellos de GitHub/LinkedIn, tablón y edición.
- **Fuera a propósito:** el acuerdo de socios y todo Lock-In (ocultos desde el pivote del
  2026-10-12) y Premium (el tutorial enseña qué hay, no vende).
- **Interacción:** deslizar o «Siguiente»; «Omitir» arriba a la derecha (no en la última página).
  Sin gesto de volver (`gestureEnabled: false` en `(onboarding)/_layout.tsx`).
- **Accesibilidad:** el teléfono y la tarjeta son ilustración y quedan ocultos al lector de
  pantalla; cada página se lee como «título. texto» con la pista «Paso n de 4».
- **Tamaños:** el teléfono se ajusta al hueco que dejan el texto y el botón, y la tarjeta se pega
  a su parte baja; en pantallas de menos de 720 pt de alto (iPhone SE) el título baja a `subtitle`
  y la tarjeta se compacta. Revisado en web a 375×667, 390×844 y 430×932.
- **Textos:** 15 claves nuevas en `en.json` y `ca.json`.
- **Tests:** `test/app/tour.test.tsx` (4), y `profile-form.test.tsx` / `layouts.test.tsx`
  actualizados a `/tour`.

## Las capturas

`assets/images/tour/<discover|matches|groups|profile>-<es|en|ca>.jpg`: la parte de arriba de cada
pantalla (390 × 620 pt) a 600 px de ancho, unos 45 KB cada una. Hay un juego por idioma para que la
interfaz de fondo diga lo mismo que el texto. La tarjeta de delante **no** es imagen: se pinta en
código, traducida y nítida.

Son de la app de verdad, en web y con el mock. Los perfiles del mock no traen foto (salen con
iniciales) porque las fotos de ejemplo vienen de Unsplash y el contenedor donde se hicieron no
llegaba a ese dominio. Si se quieren con caras, regenerarlas en una máquina con acceso a Unsplash
tras poner `imageUrl` a los perfiles del parche de abajo.

**Cómo regenerarlas:**

1. Parche **temporal** de `initialState()` en `src/data/mock/store.ts` (no se commitea): sesión
   `{ profileId: 'me', activeMode: 'par' }`; un perfil `me` (copia de `seed-ines` con nombre
   «Pablo Marín» e iniciales `PM`); `termsAcceptances` con `me` → `TERMS_VERSION`; tres matches
   `par` de `me` con `seed-nuria`, `seed-marc` y `seed-lucia`, y mensajes en el de Núria (el último,
   «Hecho. ¿El jueves por la tarde?») y uno en cada uno de los otros dos.
2. `CI=1 npx expo start --web --port 8081` (con `CI=1` no recarga: reinícialo si tocas el parche).
3. `node scripts/tour-screens.mjs` → escribe los JPEG en `assets/images/tour/`.
4. `git checkout src/data/mock/store.ts`.

## Estado

- [x] Pantalla, ruta, enganche tras el alta, textos en/ca, tests y capturas (2026-11-10).
  `tsc` limpio; Prettier y ESLint del alcance limpios (salvo el aviso de `require()` en
  `jest.mock`, igual que en el resto de `test/app`). Jest completo: 2177 pasan; los 10 fallos
  de `test/app/groups.test.tsx` («Found multiple elements with text: Taller Abierto») ya
  estaban antes de este cambio.
- [ ] `[comprobador]` Recorrido en el emulador: crear perfil → animación → tutorial (deslizar,
  «Siguiente», «Omitir», «Empezar») → Descubrir. Ojo en iOS 26: la tarjeta es `Frosted`, que
  allí es Liquid Glass sobre la captura.
- [ ] (Opcional) Capturas con fotos de perfil, ver arriba.
