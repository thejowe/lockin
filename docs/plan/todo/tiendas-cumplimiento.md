# Bloque `tiendas-cumplimiento` — envío a App Store y Google Play

Origen: encargo del 2026-10-14 (fuente: `docs/tiendas-revisadas/INFORME.md`, 39 hallazgos).
Regla de `pilar`: todo agente que escribe código pasa por `codex review` antes de fusionar.
Nada se aplica en producción (migraciones, secretos, borrados) sin permiso expreso del usuario.

## Hechos verificados contra el código (2026-10-14)

- Ya existen: baja de cuenta (`delete_my_account` + `deleteAvatar` previo, mejor esfuerzo),
  bloquear y reportar **perfiles** (`user_blocks`, `user_reports`, `report_profile`), páginas web
  `soporte`, `eliminar-cuenta`, `normas`, `privacidad` (generada desde `docs/tiendas/privacidad.md`).
- NO existen: Términos, seguridad infantil, aceptación obligatoria con versión/fecha, enlaces
  legales dentro de la app, reporte de **mensajes**, filtro de contenido objetable.
- `app.json` conserva webrtc, RECORD_AUDIO, SCHEDULE_EXACT_ALARM, expo-notifications, expo-secure-store
  (secure-store SÍ se usa: `secure-storage.ts`; notifications solo por Lock-In).
- Producción, tablas Lock-In (solo lectura): `lockin_sessions` 4, `session_attendance` 4,
  `lockin_rooms` 4, resto 0; `user_reports` 1; buckets de fotos 0 objetos; `profiles` 15.

## Reparto

| Agente | Tarea | Alcance de archivos |
|---|---|---|
| A `[Claude]` docs-legal | T1 docs/tiendas ← revisadas, cotejo con código; marcadores; Términos, Normas, Seguridad infantil; cuestionario/Data safety/notas de revisor | `docs/tiendas/*`, `web/*`, `scripts/build-web.mjs` |
| B `[Claude]` perfil | T3a aceptación Términos+Normas (versión y fecha en Supabase), enlaces legales en Perfil | `src/app/(onboarding)`, `src/features/profile`, `src/data/*` (acceptance), nueva migración |
| C `[Claude]` chat | T3b reportar mensajes (`report_message`), filtro básico de texto objetable en perfil y chat | `src/features/safety`, `src/features/chat`, `src/data/*` (report), nueva migración |
| D `[Claude]` datos | T4 retención `avatar-uploads`, bucket `avatars` privado + URLs firmadas (valoración), borrado en servidor al eliminar cuenta | `supabase/functions/moderate-avatar`, `src/data/supabase/avatar*`, migración |
| E `[Claude]` arquitecto | T5 app.json, quitar webrtc/permisos/plugins, sacar Lock-In de la build de tienda, manifiesto AAB | `app.json`, `package.json`, `plugins/`, rutas Lock-In |
| F `[comprobador]` | verificación en emulador de B, C, D, E y manifiesto | sin código |

Orden: A, B, C, D en paralelo (worktrees distintos; migraciones con timestamps distintos);
E después de fusionar B–D (toca rutas y `package.json`); F al final.

## Decisiones que necesito del usuario

1. Plazo de conservación de fotos rechazadas/pendientes (propuesta: borrado inmediato al aprobar o rechazar).
2. Proveedor SMTP y fecha de publicación.
3. Bucket `avatars` privado con URLs firmadas: cambia que la foto deje de ser URL pública (propuesta: sí).
4. Lock-In en la build: quitar el código del binario (propuesta) o dejarlo tras flag apagado.
5. 4 `lockin_sessions`/4 `lockin_rooms` de prueba en producción: ¿borrar? (no se toca sin tu orden).
6. Aplicar en producción las migraciones nuevas y desplegar la función.
7. Correo de contacto: hoy `cofounder.soporte@gmail.com`.

## Casillas

- [x] T1 documentos y páginas (A) — hecho; páginas públicas 200 el 2026-10-16 (Web pública verde sobre `0f32094`); siguen visibles los `[pendiente: …]` (6 en privacidad)
- [x] T3a aceptación y enlaces (B) — hecho 2026-10-14; falta gate en chat y aplicar migración 20261014120000
- [x] T3b reporte de mensajes y filtro (C) — migración 20261014130000 sin aplicar en producción; pendiente codex review
- [x] T4 fotos: retención (D) — migración `20261014140000` aplicada en producción el 2026-10-16 (cron horario `lockin-purge-stale-avatar-uploads`); docs de privacidad ya dicen «borrado en servidor». Sigue abierto, como bloque propio: bucket `avatars` privado con URLs firmadas, y probar que `storage.protect_delete` no bloquea el borrado (T7 contra Supabase real)
- [x] T5 app.json y binario (E) — hecho 2026-10-15, ver «T5 hecho»
- [x] T6 declaraciones y notas de revisor (A) — hecho 2026-10-15, ver «T6 hecho»; abiertos los marcadores `[pendiente: ...]`
- [x] T7 verificación en dispositivo (F) — cerrada el 2026-10-16: mock + Supabase real, ver «T7 veredicto» y «T7 cierre». Abierto fuera de T7: Info.plist real en macOS/CI, bucket `avatars` privado

## ▶ Estado del 2026-10-16: push hecho, migraciones aplicadas, CI verde

- Push de 17 commits + `0f32094` (arreglos de CI). CI, Schema drift, E2E Android y Web pública **verdes** sobre `0f32094`.
- Aplicadas en producción por MCP a orden del usuario: `terms_acceptances`, `report_message`, `avatar_storage_cleanup`. Primera aplicación quitó comentarios de dentro de los cuerpos y Schema drift salió rojo (huella md5); se reaplicó con `create or replace` y el texto exacto de los archivos. **Lección: al aplicar por MCP, pegar el cuerpo de la función byte a byte, comentarios incluidos.**
- `moderate-avatar` v2 ya estaba desplegada (`verify_jwt: true`); no comparada con el código del repo.
- Arreglos de CI: `acceptTerms` de Supabase lanza `Error` real (el contrato usa `rejects.toThrow`, que no acepta objetos planos); prettier en 3 archivos.
- Cron `purge_old_user_reports()` confirmado activo (03:20).
- Siguen siendo del usuario: fecha de publicación, SMTP, titular/NIF, DPA de OpenAI, categoría secundaria, cuenta de prueba de Apple, filas de prueba de Lock-In, revisión jurídica, bucket privado.

## ▶ Al retomar — estado del 2026-10-14 (parado a petición del usuario; histórico)

**Hecho y fusionado en la rama principal (local, SIN push):** T1 `42c7ba4`, T4 `383fd66`, T3a `d319482`,
T3b `207b512`, gate de chat `12ad442`. Suite: 141 suites / 1583 tests verdes, `tsc` limpio.
**No se empujó a propósito:** `pages.yml` publica `web/**` y los documentos aún llevan marcadores
(`[fecha de publicación]`, SMTP, OpenAI). Empujar solo tras cerrar los marcadores.
Ningún worktree de agente retirado todavía (`.claude/worktrees/agent-a33ce…`, `a6af8…`, `ab2bb…`, `a51e2…`):
sus ramas ya están fusionadas; comprobar con `git cherry` y retirar con la receta PowerShell de la memoria
`worktree-remove-sigue-junctions`.

**`codex review --base 7a1a7b0` — hallazgos ARREGLADOS (agente perfil, 2026-10-15; pendiente de re-review):**
Los 5 están resueltos: ScrollView en `terms.tsx`; pasos de aceptación en `full-journey.yaml` (`register-confirm.yaml`
termina en la bienvenida y nunca llega al formulario, no necesita pasos; solo cambiarlo si la puerta se mueve); `PhotoSection`
solo con términos aceptados; `useTermsGate` acepta versión >= vigente; `pages.yml` vigila los 3 docs. Lista original:
1. [P1] `src/features/profile/terms.tsx`: pantalla de aceptación sin scroll; en pantallas cortas o con
   texto grande la casilla/botón quedan fuera. Envolver en `ScrollView`.
2. [P1] `e2e/full-journey.yaml` (y `register-confirm`): no aceptan los términos; el gate rompe el
   recorrido positivo y el control negativo. Añadir los pasos de aceptación.
3. [P2] `(tabs)/profile.tsx`: `PhotoSection` publica foto sin aceptación. Gatearla (sin bloquear cuenta/baja).
4. [P2] `useTermsGate`: compara igualdad con `TERMS_VERSION`; una versión más nueva aceptada en otro
   dispositivo atrapa al cliente viejo en bucle. Aceptar versión >= vigente o consultar por versión.
5. [P2] `.github/workflows/pages.yml`: paths solo vigilan `privacidad.md`; añadir `docs/tiendas/{terminos,normas,seguridad-infantil}.md`.

**Casillas que siguen abiertas:**
- [x] T5 `app.json`/binario — hecho 2026-10-15 (ver «T5 hecho»); manifiesto leído en T7 (solo CAMERA).
- [x] T6 declaraciones — hecho 2026-10-15 (ver «T6 hecho»); quedan solo los marcadores `[pendiente: …]` del usuario.
- [x] T7 `comprobador` — cerrada 2026-10-16 con mock y Supabase real (ver «T7 veredicto» y «T7 cierre»).
- [x] Texto de `privacidad.md`/`eliminar-cuenta` sobre fotos — ya dice «borrado en servidor» (migración `20261014140000` aplicada el 2026-10-16; ver T4).
- [ ] Subir `TERMS_VERSION` si cambia la fecha final de `terminos.md` (hoy ambas 2026-10-14).

**Migraciones (aplicadas en producción el 2026-10-16; lista histórica)** (`grrzmzktrhksbttpbblg`; requieren permiso del usuario):
`20261014120000_terms_acceptances`, `20261014130000_report_message`, `20261014140000_avatar_storage_cleanup`.
Tras aplicar: Schema drift, comprobar que `storage.protect_delete` no bloquea el borrado y que la URL da 404.

**Datos de producción de Lock-In (solo lectura, 2026-10-14):** `lockin_sessions` 4, `session_attendance` 4,
`lockin_rooms` 4; resto 0; `user_reports` 1; buckets de fotos 0. **No borrar sin orden del usuario.**

**Decisiones pendientes del usuario:** (1) plazo de fotos rechazadas/pendientes (propuesta: borrado
inmediato + purga de huérfanos a 24 h, ya implementada en la migración); (2) proveedor SMTP y fecha de
publicación; (3) bucket `avatars` privado con URLs firmadas — diseño en `foto-perfil.md`, es un bloque propio;
(4) Lock-In: quitar código del binario (propuesta) o dejarlo tras flag; (5) borrar o no las filas de prueba;
(6) permiso para aplicar migraciones/desplegar; (7) correo de soporte `cofounder.soporte@gmail.com`
y aceptar ser contacto de seguridad infantil; (8) revisión jurídica de `terminos.md`;
(9) gate duro en servidor (`send_message` exigiendo aceptación) — hoy solo en cliente; (10) categoría
secundaria de App Store y condiciones/DPA de OpenAI.

## T5 hecho (2026-10-15, arquitecto) — Lock-In fuera del binario por borrado

- `app.json`: fuera `@config-plugins/react-native-webrtc`, `expo-notifications`, RECORD_AUDIO y SCHEDULE_EXACT_ALARM;
  `expo-image-picker` con `microphonePermission: false` (por defecto el plugin AÑADE RECORD_AUDIO y NSMicrophoneUsageDescription);
  `ios.infoPlist.ITSAppUsesNonExemptEncryption=false`. Permisos Android resultantes por app.json: solo CAMERA (+INTERNET y
  los que traigan las librerías; `expo prebuild` no se ejecutó: razonado desde plugins, falta mirar el manifiesto del AAB).
- `package.json`/lockfile: fuera `react-native-webrtc`, `@config-plugins/react-native-webrtc`, `expo-notifications`.
- Borrados: `src/features/session`, `src/features/room`, `src/app/session`, `src/app/room`, sus entradas en `_layout.tsx`,
  `ClearLockInReminders` del layout de tabs, mocks de webrtc/notifications en `jest.setup.js`, tests huérfanos
  `test/app/{room-new,roomId,sessionId}.test.tsx`. `match-row.test` lleva copia local de los textos de racha.
- Se queda (no se toca producción): capa `src/data` (repos sessions/rooms, mock y Supabase), migraciones, funciones Edge,
  `video-signal.ts` (sin dependencia nativa).
- Riesgo: ya no se cancelan avisos Lock-In programados en instalaciones antiguas (`ClearLockInReminders`); irrelevante en
  primera publicación. Recuperar Lock-In = restaurar desde git (commit anterior) y reinstalar las 3 dependencias.
- Fuera: auditar `src/data` Lock-In muerto (se puede podar luego), docs `.claude/agents/{salas,video,sesiones}.md`, e2e CI/Gradle comments.

## T6 hecho (2026-10-15, docs-legal)

- Actualizados contra el binario final tras T5: `cuestionario-privacidad.md` (inventario del binario, requisitos de tienda, marcadores abiertos), `datos-recopilados.md` (permisos, Lock-In fuera del binario), `ficha-app-store.md` (notas de revisor en inglés con UGC/moderación y cuenta de prueba como `[cuenta de prueba: pendiente]`, categoría secundaria), `ficha-google-play.md` (permisos, políticas UGC, trader) y la nota editorial de `privacidad.md`.
- Texto publicado de `terminos`/`normas`/`privacidad` NO cambiado; `TERMS_VERSION` sin tocar.
- Marcadores abiertos (usuario): fecha de publicación; proveedor SMTP; datos de titular/NIF (trader DSA); DPA y condiciones de OpenAI (de ello depende marcar Fotos como «compartidas» en Google); categoría secundaria de App Store; cuenta de prueba de Apple; permiso para aplicar migraciones `20261014120000/130000/140000` y desplegar `moderate-avatar`; confirmar job `purge_old_user_reports()`; datos de prueba de Lock-In en producción.
- Pendiente de verificar en T7: manifiesto del AAB e Info.plist (solo CAMERA, sin micrófono).
- Aviso: `privacidad.md` publicado aún dice que la foto puede quedar huérfana («mejor esfuerzo»); cambiarlo a «garantizado» solo tras aplicar `20261014140000`.


## T7 veredicto (2026-10-16, comprobador) — backend: MOCK, commit 0f32094

APK release x86_64 de un `expo prebuild --platform android` limpio (carpeta `android/` regenerada), `EXPO_PUBLIC_SUPABASE_*` vacías + `EXPO_PUBLIC_LOCKIN_ALLOW_MOCK=1`, Gradle `--rerun`; logcat: «backend de datos: mock en memoria». Emulador `lockin` (Android 16). Evidencia: `e2e/artifacts/local/2026-10-16-tiendas-t7/`.

| Punto | Veredicto | Evidencia |
|---|---|---|
| Manifiesto: sin RECORD_AUDIO / SCHEDULE_EXACT_ALARM / READ_MEDIA_* / AD_ID | PASS | `aapt-badging.txt`, `dumpsys-permissions.txt`, `AndroidManifest-prebuild.xml`. targetSdk 36, compileSdk 36. Permisos finales: CAMERA, INTERNET, ACCESS_NETWORK_STATE, VIBRATE, USE_BIOMETRIC, USE_FINGERPRINT, SYSTEM_ALERT_WINDOW, READ/WRITE_EXTERNAL_STORAGE (maxSdk 32) |
| Info.plist: sin NSMicrophoneUsageDescription | PASS parcial | `expo-introspect.json` (no hay prebuild iOS en Windows): solo NSCamera/NSPhotoLibrary; ITSAppUsesNonExemptEncryption=false. Falta mirar el .plist real en macOS/CI |
| Aceptación en onboarding (casilla + botón deshabilitado hasta marcar; luego pasa al formulario) | PASS | `03-tap-disabled.png/.xml` (enabled=false), `05-checked`, `06-after-accept` |
| Enlaces legales en el gate y en Perfil (Privacidad, Términos, Normas → Chrome con la URL correcta) | PASS | `11-perfil-legal.png`; `dumpsys` dat=`https://thejowe.github.io/lockin/{privacidad,terminos,normas}`. No se comprobó que las páginas carguen (Chrome en blanco en primer arranque) |
| Filtro de contenido en perfil | PASS | `07-filtro-perfil.png` (respuesta con insulto bloqueada con el aviso; limpia → perfil creado) |
| Filtro de contenido en chat | PASS | `09-filtro-chat.png` (mensaje con insulto no se envía; «Hola Marc» sí) |
| Aceptación en chat y en perfil existente (gate `required`) | NO COMPROBABLE con mock | el mock siempre acepta en el onboarding y pierde todo al reiniciar; no hay forma de tener perfil sin aceptación. Solo Jest (`terms.test`) o Supabase con perfil previo |
| Reporte de mensaje | NO COMPROBABLE con mock | el mock no genera mensajes entrantes y «Reportar» solo sale en mensajes ajenos. Hace falta Supabase + 2.º dispositivo o fixture |
| Baja de cuenta | NO COMPROBABLE con mock | `AccountSection` devuelve null con el mock (`account.kind==='none'`); en Perfil no existe «Eliminar mi cuenta». Hace falta Supabase (y probar `storage.protect_delete` con fotos) |

Hallazgos / avisos (no bloquean):
- SYSTEM_ALERT_WINDOW sigue en el APK release (llega de expo-dev-launcher/dev-menu): superflua para Play; plantearse quitarla (`tools:node="remove"`) o excluir dev-client del build de tienda.
- USE_BIOMETRIC/USE_FINGERPRINT (iOS: NSFaceIDUsageDescription) vienen de `expo-secure-store`; la app no usa biometría. Declarar en Data safety/cuestionario o desactivar `faceIDPermission`. En iOS introspect aparece además ATS `NSAllowsArbitraryLoads` y Bonjour de dev-launcher: confirmar que no llegan al IPA de tienda.
- ANR de `app.cofounder.mobile` (Input dispatching timed out) una vez, al volver a la app desde Chrome con el emulador cargado por Gradle; no reprodujo tras parar el daemon (`logcat-anr-full.txt`). Anotado, no concluyente.
- `android/` (gitignored) quedó regenerado por el prebuild limpio; el prebuild iOS no se puede en Windows.

## T7 veredicto, parte Supabase (2026-10-16, comprobador) — backend: SUPABASE real (grrzmzktrhksbttpbblg), HEAD 53d156a

APK release x86_64, `EXPO_PUBLIC_SUPABASE_*` de `.env.local`, `EXPO_PUBLIC_REQUIRE_ACCOUNT=false` (sin la puerta de correo, para no gastar el límite de GoTrue), Gradle `--rerun`; logcat «backend de datos: Supabase». Usuario Android 10 aislado. Evidencia: `e2e/artifacts/local/2026-10-16-tiendas-t7-supabase/`. Cuentas anónimas de prueba: A `d1a9a739-b6ce-4ce9-9dcd-2e61618377e9` (perfil AlfaT7Rest, en el emulador), B `924e376c-5a7e-4f21-aaa4-0959384f97bf` (REST, perfil BetaT7Rest, mensaje `d2bcd679-24df-46d7-a809-cba60ce7a0a4`, match `3f65afd3-b9d7-482b-8ef4-13b99916aa5e`). B2 `0592d83d-...` ya borrada.

| Punto | Veredicto | Evidencia |
|---|---|---|
| 1a. Cuenta nueva: pantalla de Términos antes del formulario; tras aceptar pasa al formulario; al reentrar (sin pedirla de nuevo) la lectura de `terms_acceptances` devuelve la fila | PASS (cliente) | `03-modo`, `05-tras-aceptar`, `06-reentrada` (tras volver atrás y «Continuar» salta directo a «Cuéntate»). Hora de aceptar: `accept-time-A.txt` |
| 1b. Fila con versión y fecha | PENDIENTE de lectura SQL | `terms_acceptances` solo es legible por su dueño (no tengo la sesión de A). Esperado: `user_id=d1a9a739…`, `version='2026-10-14'`, `accepted_at` ≈ hora de `accept-time-A.txt` |
| 1c. Perfil ya existente SIN fila → debe pedir aceptación (chat y Perfil) | NO COMPROBADO | Con la app no se llega a perfil sin fila, y no puedo borrar filas (sin SELECT/DELETE). Para cerrarlo: borrar por SQL la fila de A (`delete from terms_acceptances where user_id='d1a9a739-b6ce-4ce9-9dcd-2e61618377e9'`), relanzar al comprobador: A sigue en el emulador con perfil y match |
| 2. Reportar mensaje ajeno (UI) | PASS en cliente; fila PENDIENTE de lectura SQL | `22-chat` (mensaje de B con «Reportar»), `23-reportar-form`, `24-tras-reporte` («Reporte enviado.»), motivo «Contenido inapropiado» (`contenido-inapropiado`), hora en `report-time.txt`. Esperado en `user_reports`: reporter_id=A, reported_id=B, `message_id=message_ref='d2bcd679-24df-46d7-a809-cba60ce7a0a4'`, `message_excerpt='Hola desde Beta T7 mensaje reportable'` |
| 3a. Baja con foto publicada: perfil+Storage+URL 404 | NO COMPROBADO | `moderate-avatar` devuelve 401 `unauthorized` a cuentas anónimas (`auth.user.is_anonymous`); publicar foto exige cuenta con correo confirmado, y la confirmación necesita leer el token en la base (límite de correo ~2/h). Ver hallazgo |
| 3b. `storage.protect_delete` no bloquea `delete_my_account()` | PASS parcial | `40-baja-sql-b2.json`: B2 subió 2 objetos a `avatar-uploads/<uid>/` (HTTP 200), `delete_my_account()` → 204 sin error, perfil y usuario desaparecen (`user_not_found`). Falta leer `storage.objects where name like '0592d83d%'` = 0 (el bucket no deja listar con la sesión del dueño) y probar el bucket `avatars` con foto real |

Hallazgos:
- Con la puerta de cuenta apagada (`REQUIRE_ACCOUNT=false`) una cuenta anónima ve «Elegir de la galería», sube el archivo a `avatar-uploads` y la función responde 401; la app muestra «No hemos podido revisar la foto ahora mismo. Inténtalo más tarde.» (`30-publicada`, `32-reintento`) y deja el archivo huérfano (purga a las 24 h). Con la puerta activa (producción) no debería darse; mensaje engañoso si se diera.
- Eventual: el selector `adb push` a otro usuario Android no funciona; se inserta con `content insert/write --user 10`.

Pendiente del usuario/MCP para cerrar 1b, 1c, 2 y 3a: (a) leer `terms_acceptances` y `user_reports` de A/B; (b) borrar la fila de términos de A y relanzarme; (c) una cuenta con correo confirmado para la foto. Cuentas A y B siguen vivas: borrarlas al terminar (A desde la app, «Eliminar mi cuenta»; B con `delete_my_account()` o `auth.users`).

### T7 — lecturas SQL de cierre (Claude, 2026-10-16, solo lectura sobre producción)

- ✅ `terms_acceptances`: fila de la cuenta A con `version = 2026-10-14` y `accepted_at = 2026-10-16 16:57:48 UTC`.
- ✅ Reporte de mensaje: fila en `user_reports` con `message_id = message_ref = d2bcd679-…`, `message_excerpt` = «Hola desde Beta T7 mensaje reportable» y `reported_id` = B. **El motivo guardado es `spam`, no `contenido-inapropiado`**: el mapeo `report-form.tsx` → `toMessageReportArgs` → `report_message` es correcto en código; lo más probable es un toque del agente sobre la opción vecina (≈70 px). No concluyente; repetir con un test que compruebe el valor.
- ✅ `storage.protect_delete` no bloquea: tras `delete_my_account()` de B2, 0 objetos en `storage.objects` con su uid y el usuario no existe.
- ⚠️ Restos de prueba en producción: cuentas A (`d1a9a739…`) y B (`924e376c…`) vivas, 2 huérfanos de A y 1 `diag.jpg` de B en `avatar-uploads` (la purga horaria los retira a las 24 h), 1 fila nueva de `user_reports`.
- ⚠️ Abiertos: perfil existente SIN fila de términos exige aceptar en chat y Perfil (hay que borrar la fila de A; el clasificador bloqueó el `delete` sin orden expresa del usuario); baja con foto publicada y URL 404 (exige cuenta con correo confirmado, `moderate-avatar` rechaza anónimas); hallazgo de UX: con la puerta de cuenta apagada una anónima ve «Elegir de la galería» y recibe «No hemos podido revisar la foto» (engañoso), sin efecto con la puerta activa.

### T7 — segunda pasada, Supabase real (2026-10-16, comprobador, commit b6d17b6)

Cuenta A `d1a9a739-b6ce-4ce9-9dcd-2e61618377e9` (sin fila de términos, `is_anonymous=false` puesto por el usuario). Evidencia: `e2e/artifacts/local/2026-10-16-tiendas-t7-supabase/r2/`. Backend: Supabase `grrzmzktrhksbttpbblg`.

| Punto | Veredicto | Evidencia |
|---|---|---|
| 1. Perfil existente SIN aceptación: pide Términos en Chat y en Perfil; aceptar desbloquea | PASS | `04-chat` y `07-editar` (pantalla «Antes de continuar», checkbox + «Aceptar y continuar»), `09-tras-aceptar` (abre el formulario), `20-chat` (chat sin gate tras aceptar). Aceptación a las 2026-10-16T17:38:53Z (`accept-time-A2.txt`). Matiz: al abrir la app el deck y la lista de Matches cargan sin gate; el gate sale al abrir un chat y al pulsar «Editar perfil» (Perfil muestra el aviso «Para publicar una foto acepta antes…»). Lectura de `terms_acceptances` pendiente del usuario |
| 2. Publicar foto (galería → recorte) | PASS | `16.png` (avatar + «Quitar foto»). `avatar_url` leído con la sesión de B: `.../storage/v1/object/public/avatars/d1a9a739-.../e5997c6d-1bb6-4264-bc79-2834cc9eed06.jpg`; `avatar-url.txt`; GET público 200 `image/jpeg` 7715 B (`avatar-http-antes.txt`, `avatar-before.jpg`). Publicada ≈17:42:10Z (`photo-time.txt`). Imagen: degradado gris |
| 4. Reporte con «Contenido inapropiado» | PASS en cliente; fila pendiente de lectura | `22-seleccion.png` (✓ en «Contenido inapropiado»; xml: checked=true solo en esa) y `23-tras` («Reporte enviado.»). Enviado 2026-10-16T17:44:28Z (`report-time2.txt`). Esperado `reason` de «contenido inapropiado» (la vez anterior salió `spam`) sobre mensaje `d2bcd679-24df-46d7-a809-cba60ce7a0a4` |
| 3. Baja con foto publicada: URL pública → 404 | PASS | «Eliminar mi cuenta para siempre» a las 17:45:39Z (`baja-time.txt`); la app vuelve al onboarding (`32-tras-baja`). La URL guardada devuelve cuerpo `{"statusCode":"404","error":"not_found","message":"Object not found"}` pero **HTTP 400** (`avatar-http-despues.txt`, `avatar-despues-completo.txt`); una ruta inexistente cualquiera da también 400: es el comportamiento de Storage, no un fallo. Con sesión de B: perfil de A y match ya no existen (`[]`) |

Hallazgo menor: en Perfil, con `is_anonymous=false` y sin email en sesión, la tarjeta Cuenta dice «Te hemos mandado un correo a .» (email vacío) — artefacto de forzar el flag por servidor, no del flujo real.

### T7 cierre (Claude, 2026-10-16, a orden expresa del usuario)

- Preparación: borrada la fila de términos de la cuenta A y puesta `is_anonymous=false` (solo para que `moderate-avatar` la aceptase).
- ✅ Perfil existente sin aceptación: pide aceptar en chat y en «Editar perfil»; aviso en Perfil antes de publicar foto. Aceptación 17:38:53Z. Matiz: deck y Matches cargan sin gate (el gate está donde se publica o se chatea).
- ✅ Foto publicada (200, image/jpeg, 7715 B) y baja con foto: de la cuenta A no quedó NINGÚN objeto en `avatars` ni `avatar-uploads` (los huérfanos antiguos también), perfil y match desaparecen. La URL pública responde cuerpo 404 con HTTP **400** (así responde Storage a un objeto inexistente; una ruta cualquiera da lo mismo).
- ✅ Reporte con «Contenido inapropiado» marcado: fila con `reason = contenido-inapropiado`. El `spam` anterior fue un toque equivocado del agente, no un bug.
- ℹ️ `storage.protect_delete` SÍ bloquea el borrado directo desde una sesión SQL normal («Direct deletion from storage tables is not allowed»); `delete_my_account()` y la purga lo evitan con `storage.allow_delete_query`, y funcionan (probado). No borrar a mano `storage.objects` sin ese ajuste.
- Limpieza hecha: cuentas A y B, sus fotos y las 2 filas de `user_reports` de prueba borradas; producción vuelve a 1 fila en `user_reports` (la preexistente).
- Hallazgo menor: con `is_anonymous=false` forzado y sin correo, la tarjeta Cuenta muestra «Te hemos mandado un correo a .»: artefacto de forzar el flag.

### Info.plist real de iOS (Claude, 2026-10-16) — workflow `ios-plist.yml`, run 38942726635 verde

- `expo prebuild --platform ios --no-install` en Ubuntu genera `ios/cofounder/Info.plist`. Contiene **solo** `NSCameraUsageDescription` («cofounder necesita la cámara para hacerte la foto de perfil.») y `NSPhotoLibraryUsageDescription` (galería, foto de perfil). Sin micrófono ni Face ID. `NSAllowsArbitraryLoads = false`. `ITSAppUsesNonExemptEncryption` presente.
- ⚠️ Decisión abierta: `expo-dev-client` deja `NSLocalNetworkUsageDescription` («Expo Dev Launcher uses the local network…») y `NSBonjourServices` en el plist de release, y `SYSTEM_ALERT_WINDOW` en el manifiesto Android. Quitarlo del build de tienda afecta a los builds E2E (que son release con dev-client). El workflow avisa de ello sin fallar y falla ante cualquier otro permiso `NS*UsageDescription`.
