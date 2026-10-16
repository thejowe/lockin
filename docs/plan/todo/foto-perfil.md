# Foto de perfil y puerta del correo — detalle

Dos cosas del 2026-10-12, pedidas por el usuario. Spec:
`docs/superpowers/specs/2026-10-12-foto-de-perfil-design.md`. Plan:
`docs/superpowers/plans/2026-10-12-foto-de-perfil.md` (Tareas 1-6 hechas; la 7 es esta lista).
Memoria: `foto-de-perfil-con-moderacion`.

**Estado consolidado, 2026-10-14:** código y despliegue completados en Supabase `lockin`
(`grrzmzktrhksbttpbblg`): migración aplicada, `moderate-avatar` desplegada y secreto
configurado, con publicación de fotos demostrada el 2026-10-14. La pasada de las
**19:37–20:09 UTC** cierra el fondo del deck desde otra cuenta con foto clara/oscura y la
conservación de uid, perfil y un match previo al confirmar correo y tras reinicio en frío.
El fallo cerrado también está comprobado en dispositivo con clave **ausente e inválida**
(21:32–21:35 UTC): función y módulos de producto sin modificar, con Auth/perfil/Storage como
fixtures HTTP locales. No vuelve a comprobar el gateway ni la RLS de Supabase alojado.
Se comprobó el canje del enlace y la vuelta a la app, **no la entrega a un buzón externo**.
Las evidencias históricas y la observación de contraste se conservan abajo.

**Consolidó:** Codex, por encargo del usuario, tras cotejar `65-veredicto-foto.json`, las seis
capturas del deck, `97-comparacion-verificada.json` y `99-veredicto-puerta.json` en
`e2e/artifacts/local/2026-10-14-foto-match-secuencia/`. El cierre posterior del fallo de moderación
añade su propia pasada y evidencia aislada; se preservan la corrección previa y los hallazgos.

## Orden al retomar

1. Las tres comprobaciones de esta lista están cerradas con sus límites registrados: deck desde
   otra cuenta, conservación de identidad/perfil/match y fallo de moderación en un arnés aislado.
   La entrega a un buzón externo no forma parte del cierre demostrado.
2. El arreglo del contraste de barras y menú está commiteado en `codex/contraste-deck`, pendiente
   de revisión de Claude antes de fusionar. Ver `TODO.md` y el `todo/descubrir.md` de esa rama.

## Producción — completada (registro histórico)

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

### Ya demostrado (alcance limitado a la evidencia existente)

- [x] Foto en perfil propio contra Supabase real: elegir, publicar clara, reemplazar por oscura,
  persistencia en frío, quitar, cancelar y permiso de cámara denegado. Pasada 18:05–18:11 UTC,
  `8c767d4`; anotación de cierre anterior cita `68480b3` para el cotejo SQL de `avatar_url`
  (`null` → URL 18:07:05 → reemplazo 18:08:51 → `null` 18:10:37). **No demuestra el deck**.
- [x] Cobertura unitaria del rechazo/fallo cerrado: 20 tests de `logic.mjs`, según el registro
  previo. El éxito con clave válida está demostrado en el AVD. **No demuestra el escenario
  «clave ausente/inválida» en dispositivo**; se conserva `OPENAI_API_KEY`.
- [x] Puerta con anónima y perfil previo **sin matches**: `/register` → confirmar enlace →
  `/profile` → deck; persiste tras reinicio en frío (`170945b`, 17:20 UTC). Contraseña guardada
  después desde Perfil. Sin perfil: bienvenida con puerta apagada; `/register` con puerta activa.

### Comprobaciones de dispositivo — las tres cerradas con evidencia

- [x] Foto clara y oscura de una cuenta de prueba visibles de fondo en el deck
  desde otra cuenta; texto legible en **todas** las páginas de cada tarjeta. Capturas, jerarquía,
  logcat de Supabase y cotejo de `avatar_url`. **Cerrada por Codex:** `65-veredicto-foto.json`
  (PASS), capturas `51-clara-deck-pagina1.png`, `52-clara-deck-pagina2.png`,
  `53-clara-deck-pagina3.png`, `61-oscura-deck-pagina1.png`, `62-oscura-deck-pagina2.png` y
  `63-oscura-deck-pagina3.png`. Barras de página y `⋯` con poco contraste en la foto clara;
  el texto de perfil se lee en todas las páginas.
- [x] Anónima con perfil y **match previo**: mismo uid, perfil y match
  después de confirmar correo y de reiniciar en frío. Preparada por la UI sin puerta y actualizada
  con `install -r` a la build con puerta; sin inyección en almacenamiento. **Cerrada por Codex:**
  `97-comparacion-verificada.json` y `99-veredicto-puerta.json` (PASS), cuatro snapshots con
  perfil y match completos iguales y capturas tras confirmación/reinicio. Solo canje del enlace
  y retorno a la app; no entrega a buzón externo ni contraseña nueva.
- [x] Escenario de fallo cerrado en dispositivo con clave ausente/inválida. **Cerrada por Codex,
  2026-10-14, HEAD `72c1425`:** AVD `lockin`, APK aislado, módulos reales de foto/cliente y función
  real en Deno; Auth/perfil/Storage son fixtures locales. Ambos casos muestran el error previsto,
  responden 503 y conservan URL, archivo y foto visible tras reinicio. La clave inválida recibe
  un 401 real de OpenAI; sin clave no llama al proveedor. `verdict.json` = PASS en
  `e2e/artifacts/local/2026-10-14-avatar-fallo-cerrado/`. Producción y su secreto sin cambios.
  El rechazo por contenido sigue cubierto por tests, sin imágenes reales inapropiadas.

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


**2026-10-14 19:37–20:03 UTC · comprobación directa por Codex (sin delegación) · HEAD
`7df6285c8a7d04217c5a4b17330ac694491d74ec` · AVD `lockin`, Android 16 x86_64 · Supabase real
`grrzmzktrhksbttpbblg`. Evidencia base: `e2e/artifacts/local/2026-10-14-foto-match-secuencia/`
(local, ignorada por git). Esta pasada resuelve las dos comprobaciones pendientes anteriores;
el comprobador registra los veredictos y deja las casillas al responsable.**

- **1. Foto clara y oscura desde otra cuenta — ✅ funciona.** Cuenta de fotos `FFotoQA1410`,
  uid `00b5f1ff-ac4f-454e-ac8a-40d11cdc6acb`; observadora `AnonQA1410`, uid
  `a4cc5551-7aaf-4bcd-bbe3-7d69d87ee60c`. Ambos perfiles se crearon por la UI, con
  `EXPO_PUBLIC_REQUIRE_ACCOUNT=false`; la cuenta de fotos confirmó su correo antes de publicar.
  Galería → imagen clara → recorte → CROP → publicación; después el mismo recorrido para
  reemplazarla por la oscura. Fixtures JPEG con gradientes grises claros y oscuros, sin rostros.
  En el deck de la observadora se revisaron visualmente **las tres páginas de ambas fotos**:
  nombre/edad/ubicación y especialidades; jornada/punto de partida/ambición; pregunta/respuesta.
  El texto de perfil es legible y completo en las seis capturas. Evidencia: `51-clara-deck-pagina1`,
  `52-clara-deck-pagina2`, `53-clara-deck-pagina3`, `61-oscura-deck-pagina1`,
  `62-oscura-deck-pagina2`, `63-oscura-deck-pagina3` (cada nombre tiene `.png` y `.xml`).
  `64-observador-perfil-propio.png` identifica a la cuenta observadora. `36-avatar-clara-supabase.json`
  y `58-avatar-oscura-supabase.json` cotejan `avatar_url`: objeto `da0253a1-04b8-4a9a-9f3e-61edb708f75f.jpg`
  → `53c82f6d-5b60-40eb-83c0-e97444038bcd.jpg`, ambos bajo `avatars/<uid de la cuenta de fotos>/`.
  Los logs `06-clara-deck-logcat.txt` y `08-oscura-deck-logcat.txt` identifican Supabase.
  Resumen de la primera comprobación, guardado **antes de crear el match**: `65-veredicto-foto.json`.
  Observación visual: las barras y el botón `⋯` de arriba contrastan poco con la foto clara;
  el contenido de las tres páginas sí se lee. No se modificó código de producto.
- **2. Anónima con perfil y match previo — ✅ funciona.** La misma `AnonQA1410` se mantuvo anónima
  hasta esta segunda comprobación. Perfil creado por la UI (`45-observador-formulario.png`,
  `48-observador-form-final.png`, `64-observador-perfil-propio.png`); likes recíprocos desde las
  dos cuentas por la UI (`70-antes-like-anonima.png`, `75-antes-like-reciproco.png`) → modal
  `76-match-creado-ui.png`. La RPC real creó el match `d75ef5e6-5f23-4f53-8588-b3159c6c5061`
  a las 19:52:10 UTC, modo `par`; ya aparecía en la UI de la anónima (`79-anonima-match-previo.png`).
  Después se recompiló con `EXPO_PUBLIC_REQUIRE_ACCOUNT=true`, forzando
  `:app:createBundleReleaseJsAndAssets --rerun` al cambiar la variable, y se instaló **encima**
  con `adb install -r` (`82-install-r-conpuerta.txt`: Success), sin borrar datos.
  Arranque → `/register` (`83-anonima-con-puerta.png`) → petición de correo por la UI
  (`87-anonima-pendiente.png`) → confirmación a las **20:01:02 UTC** → perfil previo
  (`89-anonima-tras-confirmar.png`) y match previo (`91-match-tras-confirmar.png`).
  Reinicio en frío real con `am force-stop --user 11` + `am start --user 11`: entra al deck
  (`93-frio-deck.png`), conserva el perfil (`94-frio-perfil.png`) y el match (`95-frio-match.png`).
  Las cuatro lecturas administrativas `77-antes-puerta-supabase.json`, `84-con-puerta-supabase.json`,
  `90-tras-confirmar-supabase.json` y `96-frio-supabase.json` mantienen **el mismo uid, todos los
  campos del perfil y la misma fila completa del match**; solo cambia Auth de anónima a confirmada.
  Comparación ejecutada y verificable: `verify-state.py` → `97-comparacion-verificada.json` (PASS).
  `98-auth-server-confirmacion.json` registra `user_modified` y `login` del mismo uid en GoTrue.
  `12-conpuerta-logcat.txt`, `13-tras-confirmar-logcat.txt` y `14-frio-logcat.txt` identifican Supabase;
  el proceso ReactNativeJS cambia de **3263 a 6467** tras el reinicio. Resumen: `99-veredicto-puerta.json`.
  No se configuró contraseña nueva en esta pasada; el alcance comprobado es la confirmación de
  correo y conservación de identidad, perfil y match.
- **Método de confirmación y límites:** la petición de correo nació en la UI; su hash pendiente
  se leyó en Supabase solo en memoria y se consumió en `/auth/v1/verify`. GoTrue devolvió HTTP 303
  con el callback PKCE original, abierto mediante un intent Android VIEW (`30-foto-confirmacion.json`
  y `88-anonima-confirmacion.json`, código oculto). No se escribió en Auth por SQL ni se inyectaron
  sesiones en `RKStorage`. Se comprueba el canje y la vuelta a la app, no la entrega a un buzón externo.
- **Aislamiento y alcance:** un solo emulador; usuarios Android de prueba 10 y 11, separados del
  usuario personal 0. Su sesión no se cerró ni se borraron sus datos. Las builds y sus hashes están
  junto a las evidencias; `environment.json` registra el entorno. El arranque inicial con RAM
  reducida produjo un ANR y volcados terminados con 137; se conservan las capturas iniciales,
  y los veredictos se basan en el recorrido estable con los 4 GB habituales del AVD y Gradle detenido.
  La corrección previa de este documento se conserva íntegra como prefijo, cotejada por SHA-256
  y `secret-scan.json`; solo se añaden estas anotaciones. No hay cambios de código ni casillas ajenas.
- **Clave ausente/inválida — sigue pendiente:** `OPENAI_API_KEY` no se leyó ni alteró.
- **Limpieza posterior a los veredictos, 20:09 UTC:** las dos cuentas de prueba se eliminaron
  desde la UI. `107-limpieza-supabase.json` confirma cero filas para sus uids en Auth/perfiles,
  cero match/decisiones de prueba y cero objetos de foto bajo sus rutas. Después se retiraron
  los usuarios Android 10 y 11 creados para esta pasada. El AVD queda encendido en el usuario
  personal 0, con la build con puerta instalada y sus datos conservados (`108-android-final.txt`).

**2026-10-14 21:32–21:35 UTC · fallo cerrado, comprobación directa por Codex · HEAD
`72c1425` · AVD `lockin`, Android 16/API 36 x86_64 · ✅ ambos escenarios.**
Evidencia local, ignorada: `e2e/artifacts/local/2026-10-14-avatar-fallo-cerrado/`.

- **Entorno y alcance:** APK separado `app.cofounder.avatarfailureqa`. Importa los módulos
  originales `PhotoSection`, selector/recorte, repositorio Supabase y cliente de avatar, cotejados
  con el source map; `index.ts` y `logic.mjs` de `moderate-avatar` se ejecutan sin modificar en
  Deno 2.9.6 (dependencias fijadas en el `deno.lock` de la evidencia). Auth, perfil y Storage
  son **fixtures HTTP locales**, con una foto verde previa preparada. Esto comprueba el error
  y la conservación de la foto al recorrer cliente + función, no la RLS, el gateway o los
  servicios alojados de Supabase. No se leyeron credenciales de producción: los únicos destinos
  permitidos al servidor son localhost y `api.openai.com`, con clave ficticia o ausente.
  `source-verification.json`, `*-runtime.json`, APK y source map conservados.
- **Clave inválida — ✅:** galería → JPEG naranja de prueba → recorte → CROP. La subida real
  llega al Storage local y la función la descarga. OpenAI devuelve **401 real**, no simulado
  (`invalid-provider.jsonl`, 21:34:02 UTC); la función responde **503 `unavailable`** y elimina
  el pendiente. La UI enseña «No hemos podido revisar la foto ahora mismo. Inténtalo más tarde.»
  y conserva la foto verde (`08-clave-invalida-error-final.png` + XML). El perfil completo, URL
  y archivo publicado siguen iguales; ninguna llamada a publicar/borrar foto pública o escribir
  el perfil (`09-clave-invalida-server-final.json`). Reinicio en frío: misma foto (`12-…`).
- **Clave ausente — ✅:** nuevo proceso Deno sin `OPENAI_API_KEY` (confirmado en
  `missing-runtime.json`), mismo recorrido de galería y recorte. **Cero llamadas al proveedor**,
  respuesta **503 `unavailable`**, mismo error visible y foto verde intacta
  (`18-clave-ausente-error.png` + XML, `19-clave-ausente-server.json`). Pendientes vacíos y cero
  escrituras públicas/de perfil. Tras `am force-stop` + relanzar, vuelve a leer el perfil y
  conserva la foto (`22-frio-foto-anterior.png`, `23-server-final.json`; PID 4580 → 4932).
  Al reiniciar, el rótulo del selector del arnés vuelve por defecto a «inválida»; el backend
  sigue en «ausente», como registra la lectura, y no se hace otra subida durante ese reinicio.
- **Oráculo — PASS:** `verify-result.py` coteja perfil/URL completos, hash del archivo previo,
  ausencia de escrituras, retirada del pendiente, HTTP 401/503, error en las jerarquías,
  botones recuperados y píxeles idénticos del avatar en las cinco capturas inicial/error/frío.
  Resultado en `verdict.json`; los seis archivos de producto conservaron su SHA-256.
- **Incidencias del entorno:** primer build falló por MAX_PATH; el segundo compiló en una ruta
  corta, sin cambiar producto. System UI mostró un ANR al terminar el arranque; «Wait» lo cerró
  y los dos recorridos posteriores fueron estables. Se conservan logs y captura inicial.
- **Limpieza:** APK de prueba desinstalado, imagen del selector retirada, reverse ADB eliminado
  y ambos servidores detenidos. `cleanup.json` confirma mismo paquete personal y usuarios Android;
  no se cerró sesión ni se borraron sus datos. AVD encendido en usuario 0. El arnés anterior de
  contraste se restauró desde su copia previa; producción y su secreto permanecen intactos.

Comprobó y cerró Codex por encargo del usuario: ambos errores quedaron demostrados en dispositivo,
con función y cliente reales, conservación verificable de la foto y límites del backend explícitos.

### Bucket `avatars` privado — implementado 2026-10-16, SIN aplicar en producción

- [x] **[datos]** Migración `supabase/migrations/20261016120000_avatars_private.sql`: `avatars.public = false`,
  política `avatars_read_published` (select para `authenticated` solo si el objeto es el `avatar_url`
  de algún perfil), `profiles.avatar_url` guarda la RUTA (CHECK `profiles_avatar_url_check` nuevo; el
  original se llamaba `profiles_check`), filas con URL antigua a null, índice parcial en `avatar_url`.
  `moderate-avatar` ya no usa `PUBLIC_PREFIX`/`pathOfPublicUrl`: `publish`→`{ path }`,
  `setAvatarPath`, respuesta `{ avatarPath }` (hay que **redesplegarla junto con la migración**).
  Cliente: `src/data/supabase/avatar-urls.ts` firma por lote (`createSignedUrls`, 1 h, caché en memoria
  con renovación a 10 min del final) y `index.ts`/`rooms.ts` lo aplican en perfil, lista, deck,
  matches y salas; `avatar.imageUrl` sigue siendo la URL a pintar. Mock sin cambios. Tests: jest,
  `test:functions`, `test:schema` (111) en verde; contrato opt-in con dos negativos nuevos.
  Pendiente tras aplicar: **orden de despliegue** (migración y función a la vez; entre una y otra
  las fotos nuevas fallan cerrado), y con la clave de servicio comprobar a mano que una foto
  publicada se firma y que la ruta pública da 400/404. `cacheKey` por ruta en `expo-image` queda
  como mejora (la URL firmada es estable mientras dure la caché del signer).

## Auditoría de Storage y diseño de bucket privado (2026-10-14, T4 de tiendas-cumplimiento)

Migración nueva, SIN aplicar: `supabase/migrations/20261014140000_avatar_storage_cleanup.sql`.

### Borrado de `avatar-uploads` en `moderate-avatar`

- Aprobar, rechazar por contenido, imagen inválida/inexistente, proveedor caído o
  respuesta incompleta, fallo al leer la foto actual y carrera (409): en todos el
  `finally` borra la pendiente (`removePending`). Cubierto por tests nuevos en
  `logic.test.mjs` (tabla de desenlaces).
- `remove` barre además todo `avatar-uploads/<uid>/`.
- Huecos que quedan, por diseño: (a) subida que el cliente nunca notificó
  (app cerrada entre subir y llamar), (b) `removePending` que falla (es de mejor
  esfuerzo; el resultado al usuario no cambia, también testeado). No se barre toda
  la carpeta tras un `set` porque podría matar una subida concurrente legítima.
- Retención: `public.purge_stale_avatar_uploads()` borra objetos de
  `avatar-uploads` con más de 24 h; pg_cron cada hora (`10 * * * *`) si la
  extensión existe; si no, se programa a mano. Sin permisos para
  `public/anon/authenticated`.

### Borrado en servidor al eliminar la cuenta

`delete_my_account()` borra ahora de `storage.objects` los objetos de
`avatars` y `avatar-uploads` bajo `<uid>/` antes de borrar `auth.users` (mantiene
el bloqueo de perfil de `rooms_survive_host_deletion`). El cliente sigue llamando
a `deleteAvatar` como primer intento. Límite: SQL elimina el objeto para la API
(la URL pública deja de resolver) pero no los bytes del backend S3; es un residuo
sin URL ni metadatos. Si hiciera falta borrado físico garantizado, el camino es
la Storage API con service role (Edge Function disparada por webhook de
`auth.users` delete o job), no SQL. Sin verificar contra Supabase real (el
Postgres embebido no tiene `storage`): comprobar tras aplicar que el
`delete` por SQL no lo bloquea `storage.protect_delete` (se fija
`storage.allow_delete_query`) y que la URL devuelve 404.

### Bucket `avatars` privado con URLs firmadas — NO implementado

Valorado; no es acotado, se deja el diseño:

- `profiles.avatar_url` hoy es una URL pública permanente y su CHECK exige
  `.../object/public/avatars/<id>/...`. Con bucket privado habría que guardar la
  ruta (`<uid>/<uuid>.jpg`), no una URL: migración de columna y CHECK, y
  retrocompatibilidad con filas existentes.
- Cada lectura (deck, perfil, chat, salas, matches) necesitaría
  `createSignedUrls` por lote al mapear filas (`mappers.ts`), con TTL y
  regeneración al caducar; hoy `imageUrl` es estático.
- Caché de imagen: la URL firmada cambia en cada emisión; hay que fijar
  `cacheKey` por ruta en expo-image o se pierde la caché y el prefetch del deck.
- Realtime: los cambios llegan con la ruta, no con URL usable; cada cliente debe
  re-firmar tras un evento.
- Qué ganaría: solo conocedores de la URL dejan de poder verla indefinidamente y
  la revocación pasa a ser real. Hoy el UUID aleatorio de la ruta ya la hace
  inadivinable, y las fotos pasan moderación.
- Coste estimado: migración + `mappers`, `avatar.ts`, la Edge Function (devolver
  ruta), deck/prefetch y tests de contrato: un bloque propio, no una tarea de T4.
