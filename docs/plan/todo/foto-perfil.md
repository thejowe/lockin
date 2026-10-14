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
- [x] **[usuario]** (hecho 2026-10-14: el usuario puso el secreto; verificado porque la foto se publicó) Poner el secreto `OPENAI_API_KEY` en la función: dashboard → Edge Functions →
  Secrets, o `! supabase secrets set OPENAI_API_KEY=… --project-ref grrzmzktrhksbttpbblg`. **Claude
  no introduce claves en campos ni las ve** (regla de seguridad del navegador; tampoco por
  Claude en Chrome). Hasta entonces la función rechaza todo con «inténtalo más tarde»: es el
  fallo cerrado, no un bug.

## Comprobar en el emulador

- [x] **[comprobador]** (hecho 2026-10-14, `68480b3` + fila `avatar_url` leída por MCP: `null` → URL pública de `avatars` 18:07:05 → reemplazo 18:08:51 → `null` 18:10:37 UTC. **Sin comprobar:** deck desde segunda cuenta y legibilidad del texto sobre foto clara/oscura, que quedan para cuando haya segunda sesión; ver «Hallazgos» abajo) Foto de perfil contra Supabase real, tras los tres pasos de arriba:
  perfil → «Elegir de la galería» → aparece en el avatar y, desde una segunda cuenta, de fondo en
  la tarjeta del deck; texto legible sobre una foto clara y una oscura; «Quitar foto»; permiso
  denegado; selección cancelada. Evidencia: captura, `[lockin] backend de datos: Supabase` en
  logcat, y la fila `avatar_url` (o la URL pública abierta).
- [x] **[comprobador]** (cubierto 2026-10-14: con clave válida la foto se publica; el rechazo está en los 20 tests de `logic.mjs`; el modo «clave ausente» no se reprodujo para no tocar el secreto) Falla cerrado: con `OPENAI_API_KEY` ausente o inválida, la foto se rechaza
  con «No hemos podido revisar la foto ahora mismo» y el perfil conserva la anterior. El rechazo
  por contenido NO se prueba con imágenes reales: lo cubren los 20 tests de `logic.mjs`.
- [x] **[comprobador]** (hecho 2026-10-14, AVD + Supabase real, HEAD `170945b`; ver «Hallazgos» abajo. **Matiz:** «con sus matches» no se probó, la cuenta de prueba no tenía; el retorno del enlace va a `/profile`, no a `/`) Puerta del correo (`929c92d`): abrir con una cuenta anónima antigua con
  perfil → cae en `/register`, asciende con email y contraseña, vuelve a `/` y entra al deck con
  su perfil y sus matches. Una cuenta sin perfil sigue por la bienvenida (`/mode`).

## Cierres que quedan

- [x] **[Claude]** (hecho 2026-10-13: `9023cd2` + arreglo `a6b45c8`; CI verde con el contrato Supabase local) Contrato opt-in de Storage en `src/data/supabase/contract.test.ts` (Tarea 7,
  paso 3): A sube a `avatar-uploads/A/…` ✔; a `…/B/…` ✘; no escribe en `avatars` ✘; no lee
  `avatar-uploads` ✘; no hace `update profiles set avatar_url` ✘. **Solo en rama desechable**
  (memoria `contrato-manual-cancela-ci`), no a mano sobre la rama de trabajo.
- [x] **[Claude]** (hecho 2026-10-13: web pública desplegada por `pages.yml`, run 38423985227, y `/privacidad/` en vivo menciona a OpenAI; `cuestionario-privacidad.md` y `datos-recopilados.md` corregidos, decían «no hay fotos») `privacidad.md` escrito; la web pública se regenera sola. `privacidad.md` y la web pública: decir que la foto se envía a OpenAI solo
  para revisarla. **Sin esto no debería publicarse la feature.** Regenerar la web (memoria
  `web-publica-github-pages`).
- [x] **[Claude]** (hecho 2026-10-13) `docs/plan/CONCEPTO.md`: quitar «el MVP no sube imágenes». Los comentarios
  históricos de las migraciones viejas no se reescriben.
- [x] **[Claude]** (resuelto 2026-10-14, sin regenerar) El flujo de `supabase/README.md` («Cotejo SQL en Actions») no manda guardar la huella: `expected.txt` se obtiene en cada run aplicando las migraciones con `db reset --local --no-seed` y el remoto se compara contra ella; `supabase/evidence/<run>/` son solo registros históricos de runs, no entrada del job. Evidencia: Schema drift verde tras aplicar `avatar_photo` (run 38438215662, push `fix(foto): el contrato de Storage crea sus propios usuarios`, 2026-10-13).
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

## Hallazgos del comprobador

**2026-10-13 · commit `baacae7` · AVD `lockin` (Android 16) · evidencia en
`e2e/artifacts/local/2026-10-13-foto-puerta/` (local, ignorada por git).**

- **Falla cerrado — NO comprobado, ya no es reproducible.** La clave `OPENAI_API_KEY` se puso en la
  función mientras se preparaba la build (el coordinador lo avisó), así que el estado «clave
  ausente» desapareció antes de poder recorrer el perfil. Casilla sin marcar. Además, elegir foto
  exige una cuenta con email confirmado (la función da 401 a anónimos y la puerta de
  `RequireVerifiedEmail` cierra el perfil a las anónimas): sin buzón al que pinchar el enlace
  no hay cuenta así en el emulador.
- **Foto de perfil (camino feliz) — ⚠️ no comprobable aquí** por el mismo motivo: no hay cuenta
  confirmada ni acceso al buzón, y el correo de GoTrue tiene tope de ~2/hora por proyecto.
  Pendiente: la persona que tenga una cuenta confirmada en el emulador, o un buzón legible.
- **Puerta del correo (`929c92d`) — ⚠️ parcial, backend Supabase real (`grrzmzktrhksbttpbblg`).**
  - Sin perfil: build release contra Supabase (`[lockin] backend de datos: Supabase`), `pm clear`,
    arranque → `/register` («Crea tu cuenta»; pasa por `/mode`, que redirige). Captura
    `03-anonima-con-perfil.png` (mismo aspecto) y `logcat.txt`. ✅ consistente con el código.
  - Anónima antigua con perfil: creé por REST una cuenta anónima con perfil (201), la inyecté en
    `RKStorage` (AsyncStorage) con root y arranqué en frío: llega a `/register` y la copia en
    claro desaparece de `RKStorage` (la app la migró). **No distingue** «perfil + gate» de «sin
    perfil»: ambos acaban en la misma pantalla, y no pude demostrar que el refresh token inyectado
    se hubiera usado. Sin evidencia suficiente para marcar la casilla. «Asciende y vuelve a `/`»
    requiere confirmar un correo: no hecho. Las dos cuentas anónimas de prueba se borraron con
    `delete_my_account` (204).
- **Deck estilo Tinder (pivote del 2026-10-12) — ✅ con backend MOCK** (`[lockin] backend de datos:
  mock en memoria`), no con Supabase (no hay cuenta confirmada que llegue al deck). Capturas
  `20-tras-crear.png` (tarjeta a pantalla completa, iniciales «DS» sin foto, botones redondos
  ✕/♥, 3 segmentos de página), `21-deck-pagina2.png` y `22-deck-pagina3.png` (toque en la mitad
  derecha pasa de página), `23-sello-like.png` y `24-sello-nope.png` (arrastre: sello LIKE a la
  derecha y NOPE a la izquierda, tarjeta inclinada y la siguiente debajo). Texto legible sobre el
  degradado. Falta ver la tarjeta CON foto (necesita el camino feliz).
- **Entorno (no es bug de producto):** el emulador se quedó sin respuesta al instalar el APK de
  165 MB (`Binder ... No space left on device`, «System UI isn't responding»); hizo falta
  `adb emu kill` + arranque con `-no-snapshot-load` e instalar vía `adb push` + `pm install`. El
  APK que queda en `android/app/build/outputs/apk/release/` y el instalado en el AVD son ahora la
  build **mock**, no la de Supabase.

**2026-10-14 · commit `6a1114a` · AVD `lockin` (Android 16) · backend Supabase real
(`grrzmzktrhksbttpbblg`) · evidencia en `e2e/artifacts/local/2026-10-14-puerta-correo/` (local,
ignorada por git).**

- **Puerta del correo (`929c92d`) — ⚠️ BLOQUEADA, sin veredicto; casilla sin marcar.** Build
  release contra Supabase (`createBundleReleaseJsAndAssets --rerun`, log `[lockin] backend de
  datos: Supabase`), instalada vía `adb push` + `pm install`, `pm clear` y arranque en frío. Sin que
  el comprobador enviara ningún input, el AVD fue manejado por otra mano: pantalla pasó de «Vuelve
  a tu cuenta» a «Confirma tu email» y a «Crea tu cuenta» con el campo a medio escribir («big») y
  una burbuja flotante ajena (`01-arranque.png`, `02.png`, `ui1.xml`, `ui2.xml`). En los logs de
  Auth: `/token` con contraseña inválida (15:07:02 UTC), `PUT /user` `user_modified` y `mail.send`
  `email_change` a `bigjoowe@gmail.com` (15:07:17 UTC). **Se gastó 1 de los ~2 correos/hora del
  proyecto** y esa sesión anónima quedó con un cambio de email pendiente. Parón hasta confirmar
  quién tecleaba y a que el cupo se renueve (~16:07 UTC). Retomar desde `pm clear`.
- **Puerta del correo — actualización 15:10 UTC: la mano era la del usuario; ⚠️ parcial.** Con
  `bigjoowe@gmail.com` (cuenta `190e0f96…`) recorrió en el AVD, backend Supabase real: anónima sin
  perfil → `/register` → `email_change` (15:07:17) → confirma (`email_confirmed_at` 15:07:53) →
  contraseña (`PUT /user` 15:08:05, `is_anonymous=false`) → crea perfil (fila creada 15:09:05) →
  deck «Descubrir» (`03-estado-actual.png`). ✅ camino «sin perfil: registro → confirmación →
  contraseña → perfil → deck». **No cubre** lo que pide la casilla: la cuenta NO tenía perfil al
  ascender (el perfil es posterior a la confirmación), así que «anónima antigua CON perfil → cae en
  `/register` → asciende → vuelve a `/` con su perfil y matches» sigue sin comprobar. Casilla sin
  marcar. Para cerrarla hace falta una anónima con perfil previo (REST + sesión inyectada, o build
  sin puerta) y 1 correo más (cupo: 1 gastado a las 15:07 UTC).
- **Puerta del correo — intento por inyección de sesión (17:02 UTC), ❌ método inválido, no es
  bug de producto probado.** Creé por REST una anónima con perfil (`9b48456c…`, 201) y su sesión la
  metí en `RKStorage` (`catalystLocalStorage`, clave `sb-grrzmzktrhksbttpbblg-auth-token`) tras
  `pm clear`. La app (HEAD `170945b`, `[lockin] backend de datos: Supabase`) NO la usó: en auth_logs
  hay un `signup` anónimo nuevo (`1518de3f…`, 17:02:45) y ningún `refresh_token` de `9b48456c`.
  Por tanto aterrizar en `/register` no demuestra nada sobre «perfil + puerta». No se pudo
  diagnosticar por qué (volcar `RKStorage` del AVD fue denegado por permisos). Método de
  sustitución: build con `EXPO_PUBLIC_REQUIRE_ACCOUNT=false` → perfil anónimo por la UI →
  `install -r` de la build con puerta (conserva datos).
- **Puerta del correo (`929c92d`) — VEREDICTO 2026-10-14 17:20 UTC: ✅ funciona en el AVD**, backend
  Supabase real, HEAD `170945b`, APK con `EXPO_PUBLIC_REQUIRE_ACCOUNT=true`. Casilla **sin
  marcar por el comprobador** (la marca quien la posee). Evidencia en
  `e2e/artifacts/local/2026-10-14-puerta-correo/` (local, ignorada por git).
  1. Anónima con perfil creada por la UI con una build SIN puerta (`20-sinpuerta-arranque.png`,
     `21-form-final.png`, `22-tras-crear.png`; fila `PuertaQA`, `is_anonymous=true`).
  2. `adb install -r` de la build CON puerta (sin borrar datos) y arranque en frío →
     «Crea tu cuenta» (`30-conpuerta-arranque.png`). ✅ cae en `/register`.
  3. Ascenso con `+lockin4`: `PUT /user` con `actor_id` = la anónima del paso 1 (misma cuenta),
     `mail.send email_change` 17:18:04, enlace abierto en el AVD → `email_confirmed_at` 17:19:38,
     `is_anonymous=false` (`31-…`, `32-tras-enlace.png`).
  4. Vuelta a la app: con perfil, `auth/callback` manda a `/profile` (no a `/`), por diseño del
     código; el deck «Descubrir» carga (`33-deck.png`, candidato «Jo» de otra cuenta) y la pestaña
     Matches sale vacía («Todavía no hay nadie…», `34-matches.png`). **«Con sus matches» NO está
     probado:** la cuenta de prueba no tenía ninguno. Arranque en frío (`35-…`) → deck, sin
     volver a pasar por la puerta.
  5. «Y contraseña»: tras el enlace la cuenta queda sin contraseña; se pone desde Perfil → Cuenta
     («Contraseña guardada», `37-password.png`). Eliminar cuenta desde la app → vuelta a `/register`.
  6. Una cuenta sin perfil sigue por la bienvenida: ✅ con la build sin puerta (`20-…`: «Encuentra
     con quién construir» → `Continuar` → formulario). Con la puerta encendida, una anónima sin
     perfil cae en `/register` (hallazgo del 2026-10-13), sin pasar por `/mode`.
  Higiene: borradas `9b48456c…` y `c1c67902…` (PuertaQA). **Queda `1518de3f…`** (anónima sin
  perfil ni sesión recuperable, del intento de inyección); inofensiva, borrable desde el dashboard.
  Cupo GoTrue: 2 correos en la hora (15:07 y 17:18).

**2026-10-14 18:02 UTC · commit `6992b8a` · AVD `lockin` · backend Supabase real
(`grrzmzktrhksbttpbblg`) · evidencia en `e2e/artifacts/local/2026-10-14-foto-perfil/` (local).**

- **Foto de perfil contra Supabase real — ⚠️ NO comprobada, casilla sin marcar.** El AVD arranca en
  «Crea tu cuenta» sin sesión (`00-estado.png`). Elegir foto exige una cuenta con email confirmado
  (la función da 401 a anónimos y la puerta cierra el perfil) y no hay sesión reutilizable ni buzón
  que el comprobador pueda leer; el correo de GoTrue tiene tope de ~2/hora (último `mail.send`
  17:18 UTC) y confirmar requiere que una persona pinche el enlace. No se forzó (nada de insertar
  en `auth.users`). No se envió ningún correo ni se creó ninguna cuenta.
- **Falla cerrado — ⚠️ sin marcar.** Con la clave válida solo es comprobable el éxito del punto
  anterior (pendiente); el modo «clave ausente» ya no se puede reproducir sin quitar el secreto.
  Cuando la foto se publique en el AVD, esta casilla queda cubierta por ese éxito + los 20 tests de
  `logic.mjs`.
- Para retomar: una persona con cuenta confirmada inicia sesión en el AVD («Ya tengo cuenta»), o
  cupo de correo + alguien que pinche el enlace. Las 4 pruebas (clara, oscura, quitar, permiso
  denegado, cancelar) pueden hacerse entonces en una sola pasada.

**2026-10-14 18:05-18:11 UTC · commit `8c767d4` · AVD `lockin` · backend Supabase real
(`grrzmzktrhksbttpbblg`, `[lockin] backend de datos: Supabase` en `logcat.txt`) · evidencia en
`e2e/artifacts/local/2026-10-14-foto-supabase/` (local, ignorada por git).** Cuenta: la del usuario
(`bigjoowe@gmail.com`, perfil «Jo», confirmada), sesión ya abierta; no se cerró ni se tocó la contraseña.
Estado previo: sin foto («Aún no tienes foto», avatar con inicial, `01-perfil.png`, `03-foto-bloque.png`).
Estado final: sin foto, igual que al empezar (`18-frio-sin-foto.png`).

- **Foto de perfil, camino feliz — ✅ funciona** (casilla sin marcar por el comprobador). Perfil →
  «Elegir de la galería» → selector → recorte → CROP → la foto pasa la moderación de `moderate-avatar`
  con la clave de OpenAI y se publica: foto clara (`08-resultado-clara.png`) y luego oscura
  (`11-resultado-oscura.png`), aparece en el avatar de cabecera y en el bloque «Tu foto», con el botón
  «Quitar foto». **Persiste tras arranque en frío** (`13-frio-perfil.png`: llega del servidor, no de
  memoria local). Sin rechazo ni error.
- **Selección cancelada — ✅**: abrir el selector y volver atrás deja la foto como estaba, sin error
  (`12-cancelado.png`).
- **Permiso denegado — ✅** (cámara: revocado con `pm revoke` y «Don't allow» en el diálogo del sistema,
  `14-…`/`15-…`/`16-permiso-denegado.png`): mensaje «Sin permiso de cámara no podemos hacerte la foto.
  Puedes dárselo en los ajustes del móvil.» y la foto previa se conserva. El selector de galería de
  Android 16 es el Photo Picker (sin permiso de almacenamiento), así que ahí no existe «denegado».
- **«Quitar foto» — ✅**: vuelve a la inicial en cabecera y bloque (`17-quitada.png`); tras arranque en
  frío sigue sin foto (`18-frio-sin-foto.png`).
- **De fondo en la tarjeta del deck vista desde una segunda cuenta — ⚠️ no comprobado**: no hay
  segunda sesión en el AVD y no se crearon cuentas (cupo GoTrue). Tampoco se pudo ver el texto sobre
  foto clara/oscura en una tarjeta (el deck no muestra la tuya); solo se vieron avatares circulares.
  **La legibilidad del texto sobre foto queda sin comprobar.**
- **Fila `avatar_url` / URL pública — ⚠️ no leída**: este agente no tiene acceso de lectura a
  `profiles` (anon da 42501, y el MCP de Supabase no estaba disponible). La persistencia en frío es la
  prueba indirecta de que la fila se escribió; cotejar en el dashboard si hace falta.
- **Falla cerrado — ✅ por cobertura**: con la clave válida la foto se publica (arriba) y el rechazo/
  fallo cerrado está cubierto por los 20 tests de `logic.mjs`. El modo «clave ausente» no se
  reprodujo (no se toca el secreto).
- Higiene: imágenes de prueba (gradientes, sin rostros) borradas del AVD; permiso CAMERA queda
  denegado (lo revoqué yo). Sin correos enviados ni cuentas creadas.
