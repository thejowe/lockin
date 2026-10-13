# Foto de perfil y puerta del correo — detalle

Dos cosas del 2026-10-12, pedidas por el usuario. Spec:
`docs/superpowers/specs/2026-10-12-foto-de-perfil-design.md`. Plan:
`docs/superpowers/plans/2026-10-12-foto-de-perfil.md` (Tareas 1-6 hechas; la 7 es esta lista).
Memoria: `foto-de-perfil-con-moderacion`.

**Estado en una frase:** el código está terminado, revisado con `codex review` y empujado
(`07a3881`); **no está en producción**. Faltan tres pasos que exigen permiso del usuario sobre el
proyecto Supabase `lockin` (ref `grrzmzktrhksbttpbblg`) y, después, comprobarlo en el emulador.

## Orden al retomar

1. Mira si el usuario ya aplicó la migración y desplegó la función: `list_migrations` (¿está
   `avatar_photo`?) y `list_edge_functions` (¿está `moderate-avatar`?). Si no, no sigas con el
   resto: sin ellos no hay foto que comprobar, y **Schema drift saldrá rojo en Actions por
   `avatar_url`, y eso es esperado hasta que se aplique** (no es deriva real).
2. Con la función desplegada y el secreto puesto, lanza el `comprobador` (casillas de abajo).
3. Luego los cierres de documentación.

## Producción — lo bloquea un permiso, no el código

El clasificador del modo automático bloqueó `apply_migration` contra producción («Production
Deploy»). Se resuelve de dos maneras; las dos son decisión del usuario.

- [x] **[usuario]** ~~Aplicar `supabase/migrations/20261012120000_avatar_photo.sql`~~ — **aplicada el 2026-10-13** (SQL Editor, por el usuario; el clasificador bloqueó `apply_migration` y el Run por Chrome). Verificado por SQL: `UPDATE` sobre `avatar_url` = false, `avatars` público, `avatar-uploads` privado, 2 políticas; `get_advisors` sin hallazgos nuevos. Falta regenerar huella si procede. Original: aplicar `supabase/migrations/20261012120000_avatar_photo.sql` al proyecto
  `lockin`. O bien añade una regla de permiso para `mcp__claude_ai_Supabase__apply_migration`
  en su `settings.json` y lo aplica Claude, o bien lo corre él:
  `! supabase db push --project-ref grrzmzktrhksbttpbblg`. Después, comprobar que
  `has_column_privilege('authenticated','public.profiles','avatar_url','UPDATE')` es `false`, que el
  bucket `avatars` es público y `avatar-uploads` privado, y pasar `get_advisors` (seguridad).
- [x] **[Claude]** (hecho 2026-10-13, tras añadir el usuario la regla de permiso; `deploy_edge_function`, versión 1, `ACTIVE`, `verify_jwt: true`, archivos tal cual del repo) Desplegar `supabase/functions/moderate-avatar/` (`index.ts` + `logic.mjs`) con
  `verify_jwt: true` (`deploy_edge_function`), o `! supabase functions deploy moderate-avatar
  --project-ref grrzmzktrhksbttpbblg`. Necesita el mismo permiso que la migración.
- [ ] **[usuario]** (**único bloqueo real que queda**) Poner el secreto `OPENAI_API_KEY` en la función: dashboard → Edge Functions →
  Secrets, o `! supabase secrets set OPENAI_API_KEY=… --project-ref grrzmzktrhksbttpbblg`. **Claude
  no introduce claves en campos ni las ve** (regla de seguridad del navegador; tampoco por
  Claude en Chrome). Hasta entonces la función rechaza todo con «inténtalo más tarde»: es el
  fallo cerrado, no un bug.

## Comprobar en el emulador

- [ ] **[comprobador]** Foto de perfil contra Supabase real, tras los tres pasos de arriba:
  perfil → «Elegir de la galería» → aparece en el avatar y, desde una segunda cuenta, de fondo en
  la tarjeta del deck; texto legible sobre una foto clara y una oscura; «Quitar foto»; permiso
  denegado; selección cancelada. Evidencia: captura, `[lockin] backend de datos: Supabase` en
  logcat, y la fila `avatar_url` (o la URL pública abierta).
- [ ] **[comprobador]** Falla cerrado: con `OPENAI_API_KEY` ausente o inválida, la foto se rechaza
  con «No hemos podido revisar la foto ahora mismo» y el perfil conserva la anterior. El rechazo
  por contenido NO se prueba con imágenes reales: lo cubren los 20 tests de `logic.mjs`.
- [ ] **[comprobador]** Puerta del correo (`929c92d`): abrir con una cuenta anónima antigua con
  perfil → cae en `/register`, asciende con email y contraseña, vuelve a `/` y entra al deck con
  su perfil y sus matches. Una cuenta sin perfil sigue por la bienvenida (`/mode`).

## Cierres que quedan

- [ ] **[Claude]** Contrato opt-in de Storage en `src/data/supabase/contract.test.ts` (Tarea 7,
  paso 3): A sube a `avatar-uploads/A/…` ✔; a `…/B/…` ✘; no escribe en `avatars` ✘; no lee
  `avatar-uploads` ✘; no hace `update profiles set avatar_url` ✘. **Solo en rama desechable**
  (memoria `contrato-manual-cancela-ci`), no a mano sobre la rama de trabajo.
- [~] **[Claude]** `privacidad.md` escrito (2026-10-13); **falta regenerar la web pública** y publicarla. `privacidad.md` y la web pública: decir que la foto se envía a OpenAI solo
  para revisarla. **Sin esto no debería publicarse la feature.** Regenerar la web (memoria
  `web-publica-github-pages`).
- [x] **[Claude]** (hecho 2026-10-13) `docs/plan/CONCEPTO.md`: quitar «el MVP no sube imágenes». Los comentarios
  históricos de las migraciones viejas no se reescriben.
- [ ] **[Claude]** Si el flujo de `supabase/README.md` lo manda, regenerar la huella esperada
  (`supabase/evidence/…/expected.txt`) tras aplicar la migración. No editarla a mano.
- [x] **[decisión del usuario]** (resuelto 2026-10-13 con tests del paginador, `baacae7`; CI y Schema drift verdes) CI rojo desde antes de este trabajo: `Tests` falla el suelo de
  cobertura de funciones (93,6 % < 94,27 %) por `src/components/swipe-between-tabs.tsx`
  (42 % de funciones, commit `971ed17`). El código de la foto está casi al 100 %. O se escriben
  tests de los gestos de ese componente, o se baja el suelo de `jest.config.js` a propósito.

## Hecho (no rehacer)

- [x] Contrato `setAvatarPhoto`/`removeAvatarPhoto` + `avatar.imageUrl`, con el mock (`8698f5a`).
- [x] Migración, tipos de fila y mapper; guardia de `schema-embedded` y `drift-check` actualizadas
  (`b8688bc`).
- [x] Edge Function `moderate-avatar` con 20 tests de `logic.mjs` (`cc4b275`, endurecida en
  `07a3881`).
- [x] Cliente Supabase: sube a pendientes e invoca la función; `deleteMyAccount` la invoca antes
  del RPC (`2ade60a`).
- [x] Selector con recorte 4:5 y JPEG 0,8; `expo-image-picker` y `expo-image-manipulator`
  instalados con `expo install` (`a4f3145`).
- [x] Bloque «Foto» en el perfil y avatares con foto (`793892f`); foto de fondo en la tarjeta del
  deck (`822e62e`).
- [x] `codex review` del rango completo: 1 crítico, 5 importantes y 1 menor, todos arreglados con
  test rojo antes (`07a3881`). `--base` y prompt son excluyentes en `codex review`.
- [x] Puerta del correo en toda la app: `RequireVerifiedEmail` en pestañas y rutas apiladas,
  `index` manda a `/register` a quien tiene perfil sin email confirmado (`929c92d`).
- [x] Verificación local: `tsc`, `eslint` (0 errores), Jest 1539 pasan, `test:functions` 20,
  `test:schema` 106, `expo export --platform web`.
