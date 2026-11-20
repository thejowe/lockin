# Grupos — detalle

Desde el 17 de noviembre de 2026 cada chat de grupo tiene su propio [plan de tareas y reuniones](chat.md). Cualquier miembro puede actualizarlo, con los mismos permisos para el admin y el resto del equipo.

Pedido por el usuario el 2026-11-09: además del deck de cofundador, Descubrir gana una sección
«Grupos». Un grupo es un proyecto con admin, puestos (especialidad + plazas) y hasta 6 personas.
Quien administra recluta; quien no tiene grupo ve los grupos que buscan lo que domina.

**Tensión con el concepto:** `CONCEPTO.md` dice «nadie contrata a nadie». Los grupos introducen
puestos y plazas por decisión expresa del usuario. Se mantiene lo esencial: la entrada exige like
de los dos lados y dentro no hay jerarquía más allá de administrar (expulsar, y heredar al salir).

## Grupos de proyecto

- [x] El grupo conserva su nombre, descripción y plazas. Una referencia opcional al proyecto distingue los dos tipos y clasifica los grupos anteriores como «Buscar gente».
- [x] Descubrir ofrece «Crear grupo» bajo el selector y en el estado vacío. La pestaña de reclutamiento aparece al crear el grupo. La tarjeta del proyecto usa su portada y mantiene una pestaña por integrante.
- [x] La función `moderate-project` revisa el proyecto y crea grupo, ficha y autoría en una sola transacción. Un reintento del mismo borrador devuelve el grupo creado. Los cambios de miembros y de admin sincronizan autores y permisos. El proyecto se ve dentro del grupo y en las tarjetas elegibles de Descubrir. La publicación en perfiles personales sigue su propio flujo.
- [x] La pestaña Proyecto reutiliza las tareas y reuniones del chat. Las tareas admiten estado, responsable y fecha límite. Al salir la persona responsable queda libre la asignación.
- Al disolver el grupo, la RLS retira el acceso a las fotos en la misma transacción. Las claves quedan en una cola persistente y `moderate-project` las elimina de Storage por lotes al recibir nuevas solicitudes autenticadas.
- [x] Los dos decks de grupos ordenan primero tarjetas nuevas y después pases caducados, con `pass_cooldown()`. Los likes, bloqueos, grupos llenos y membresías quedan fuera.
- [x] Contraste sobre una portada blanca en el tema oscuro. El nombre de la cabecera da 7,18:1, la píldora inactiva 4,68:1 y la descripción 5,02:1. La cabecera compartida con Cofundador conserva el fundido por debajo de los controles. El selector respeta «reducir movimiento».
- [x] Verificación local de la rama. TypeScript pasa. ESLint termina con cero errores y cinco avisos preexistentes. Jest en serie, con un límite de 30 segundos por prueba, pasa 2.360 pruebas en 177 suites. Hay 243 pruebas omitidas por la configuración, incluida la suite de contrato HTTP optativa contra una instancia Supabase. El contrato compartido se ejecutó contra el mock. Pasan las 331 pruebas de esquema/RLS en PGlite y las 124 de funciones.
- [x] En Android 36 con el mock se comprobaron el botón de cristal, la tarjeta del deck vacío, el cambio de píldora a un miembro y el alta de ambos tipos de grupo. «Buscar gente» se creó con el movimiento reducido. En el grupo de proyecto se abrió el deck de reclutamiento y se editó la portada desde el chat sobre tareas y reuniones. La comparación de píxeles confirmó que desapareció la línea de un píxel en las cabeceras del grupo y del miembro. La tarjeta de Cofundador también pasó la comprobación. Las capturas y `comprobacion-degradado.json` están en `e2e/artifacts/local/2026-11-19-grupo-proyecto/`.
- La migración distingue los bloqueos y las salidas históricos con los registros que dejó el esquema anterior. Cuando ambas direcciones tenían un pase y ya no hay membresía, conserva la exclusión para evitar reintroducir una expulsión. Esto también conserva fuera dos pases simultáneos de clientes antiguos. Si un bloqueo histórico perdió tanto el vínculo con el admin anterior como su registro de bloqueo, ya no se puede reconstruir. El esquema nuevo guarda el motivo explícitamente.
- [x] Revisión de Claude Code (2026-11-19) y fusión en la principal. Arreglado tras `codex review`: solo se entra con dos likes guardados y vigentes; el pass hacia un grupo cuyo admin actual bloqueaste cuenta como bloqueo permanente; la salida del admin fundador queda anotada (también en el mock). Pruebas nuevas en `group-deck-passes-embedded.test.mjs`.
- [x] Un reintento con el borrador cambiado tras perder la respuesta guarda el borrador actual en el mismo grupo (`20261120100000_shared_projects_followups.sql`). Con el interruptor de fotos apagado, un grupo de proyecto no lleva fotos.
- [ ] Pendiente (codex review 2026-11-20): un reintento antiguo que llega después de uno nuevo puede restaurar el borrador viejo (falta una generación del borrador); si el interruptor de fotos se apaga con grupos con foto ya creados, esos grupos ocupan hueco en los 30 del deck y el cliente los descarta; el id del borrador vive en `ProjectEditor` y se pierde si se cierra la hoja para cambiar el grupo tras perder la respuesta.
- [ ] Producción, pendiente de autorización: aplicar por orden `20261119233232_group_projects.sql` y `20261119233421_group_deck_passes.sql` (tras las dos del proyecto conjunto), desplegar `moderate-project` y distribuir el cliente.

## Estado

- [x] Migraciones `20261109130000_groups.sql`, `20261109140000_groups_edit.sql` y
  `20261109150000_group_message_push.sql`. **Aplicadas en producción**: verificadas el
  2026-11-09 en `grrzmzktrhksbttpbblg`; detalle de versiones remotas abajo.
- [x] Capa de datos: `GroupRepository` en `src/data/repositories.ts`, mock
  (`src/data/mock/groups.ts`) y Supabase (`src/data/supabase/groups.ts`), reglas puras en
  `src/data/groups.ts`.
- [x] UI: `src/features/groups/`, rutas `src/app/group/{new,edit,info,[groupId]}.tsx`, selector
  Cofundador/Grupos en `src/app/(tabs)/discover.tsx`, fila del chat de grupo en Matches.
- [x] i18n: 84 claves nuevas en `en.json` y `ca.json`.
- [x] Tests: `supabase/groups-embedded.test.mjs` (dentro de `npm run test:schema`),
  `src/data/groups.test.ts`, `src/data/mock/groups.test.ts`, `src/data/supabase/groups.test.ts`,
  `src/features/groups/decision-deck.test.tsx`, `test/app/groups.test.tsx`,
  `test/app/group-routes.test.tsx`, `test/app/group-premium.test.tsx`.
- [x] Editar grupo: nombre, proyecto y perfiles buscados; solo el admin. No se puede quitar un
  perfil ocupado ni reducir sus plazas por debajo de las personas dentro; el formulario lo explica.
- [x] Push de chat: repositorio de tokens por dispositivo y RPC, trigger por `pg_net` y Edge Function
  `notify-group-message` (7 tests). Excluye al remitente y los bloqueos en los dos sentidos;
  elimina tokens rechazados en los tickets con `DeviceNotRegistered`. **Faltan los recibos posteriores**.
  En la app se pide permiso al entrar en el grupo o su chat, se abre el chat al tocar el aviso y se
  silencia solo mientras tiene el foco. La baja del token al salir es de mejor esfuerzo.
- [x] Suite de contrato extendida con cinco casos compartidos: like en ambos órdenes, dos
  aceptaciones simultáneas a la última plaza, editar sin quitar perfiles ocupados, herencia al
  borrar la cuenta del admin y expulsar sin reentrada automática. Mock verificado; Supabase pendiente
  de CI (sin Docker local). El cierre limpia canales incluso si el caso ya borró la cuenta.
- [x] Texto: «Perfiles que buscamos», «Buscando gente para…», «Encajas como» y «Tu sitio queda libre»;
  traducciones en inglés y catalán, sin cambiar reglas de negocio.
- [x] Prettier en los archivos nuevos y modificados del bloque; comprobación de formato en verde.
- [x] ESLint del alcance de Grupos/push sin errores ni avisos (`--max-warnings 0`).
- [x] Revisión por Codex del trabajo recibido (2026-11-09); hallazgos corregidos y pendiente
  de recibos de Expo anotado abajo.
- [x] El usuario autoriza aplicar migraciones, commitear y hacer push (2026-11-09).
- [ ] `[comprobador]` Recorrido en el emulador: crear grupo, like recíproco, chat de grupo,
  salir/expulsar. No se ha hecho.
- [x] **Varios grupos por persona (2026-11-11, pedido por el usuario).** Hasta 3 grupos por
  persona (`GROUP_MAX_MEMBERSHIPS` / `group_max_memberships()`) y como mucho uno administrado
  (`groups_admin_key` único; crear otro da LG006 `already-admin`; LG002 pasa a `group-limit`).
  Migración `20261111120000_groups_multi_membership.sql`: quita `group_members_one_group_per_user`,
  `leave_group(p_group_id)`, decks sin el tope «ya tienes grupo» y sin tus propios grupos,
  liderazgo al miembro más antiguo que no administre otro (si no hay, el grupo se disuelve),
  borrar la cuenta sale de todos. API: `getMine()` → `listMine()` (admin primero), `leave(groupId)`.
  UI: Descubrir = `Cofundador | Grupos | <nombre de tu grupo>`; «Grupos» es el deck para unirse
  (para todos, también admins y miembros, hasta el tope) y la pestaña con el nombre, solo si
  administras, es el deck de reclutamiento. Los grupos propios se abren desde Matches (una fila
  por grupo); `/group/info?id=`. Tests: mock, Supabase, contrato (+1 caso), PGlite (+3 casos) y
  pantallas; suite completa en verde. De paso, `test/app/groups.test.tsx` vuelve a verde (estaba
  rojo en CI desde el rediseño de la tarjeta del 2026-11-10).
- [x] Aplicar `20261111120000_groups_multi_membership.sql` en producción: aplicada por MCP el
  2026-11-11, archivo entero byte a byte (`groups_multi_membership`).
- [x] ~~`[comprobador]` Recorrido multi-grupo en emulador~~: no se lanza; lo comprueba el
  usuario a mano (2026-11-11).
- [x] Textos legales de Grupos (2026-11-09): Privacidad v1.7, Términos v1.5 (§10 Grupos,
  Premium pasa a §11) y Normas v1.2 en es/en/ca; `TERMS_VERSION = 2026-11-09`.
  Fichas de ambas tiendas en los tres idiomas, cuestionario e inventario actualizados también
  con chat de grupo, controles UGC y tokens push. Generado con `build-legal.mjs`, sin publicar web.
- [ ] Diferencia entre Privacidad v1.7 solicitada y código push: al revocar el permiso,
  `registerForPush()` devuelve `denied` pero no elimina el token del servidor; el texto promete
  borrarlo al desactivar notificaciones. Resolver antes de publicar. La baja al cerrar sesión
  es de mejor esfuerzo; borrar la cuenta sí elimina sus tokens por cascada. Sin cambios de
  producto en esta actualización documental.
- [ ] Push: guardar los ids de los tickets aceptados y consultar sus recibos para retirar también
  los tokens que APNs/FCM rechazan después. Ver hallazgo P2 de la revisión.
- [x] Configuración Android de Firebase: `google-services.json` de `cofounder-512013`
  (número `187078015966`), cliente `app.cofounder.android`, enlazado por
  `expo.android.googleServicesFile` en `app.json`. Credencial FCM V1 del mismo proyecto
  asignada en EAS y comprobada el 2026-11-09, sin descargar la clave privada.
- [x] Activación del servidor push comprobada el 2026-11-09: `notify-group-message` v3
  activa con `verify_jwt: false`; sus cuatro archivos coinciden con las fuentes locales.
  Vault contiene `push_webhook_url` y `push_webhook_secret`. Una llamada por `pg_net` con
  el secreto de Vault y un UUID de mensaje inexistente devuelve **HTTP 200**,
  `{"sent":0,"forgotten":0}`: acredita autenticación/configuración sin enviar avisos.
- [x] Build Android nativa: EAS `preview`, versión 1.0.0, `versionCode` 4,
  [`e0517c91-216e-4ac9-a58c-584d2eca91e9`](https://expo.dev/accounts/thejowe/projects/lockin/builds/e0517c91-216e-4ac9-a58c-584d2eca91e9)
  **FINISHED**. [APK](https://expo.dev/artifacts/eas/CiLD2vWLBA1gw9J5wDxY8CydUCcfLRJl5flddQAHaq0.apk)
  descargado; `aapt2` confirma el número/proyecto/app id de Firebase dentro del binario.
  SHA256 y recursos en `e2e/artifacts/local/2026-11-09-group-push/apk-verification.json`.
- [x] Prueba push en Android API 36 con Google Play Services y Supabase producción: login y
  permiso por UI, token Android guardado, mensaje de otro miembro dispara aviso en segundo
  plano, tocarlo abre el chat correcto con el mensaje. Un segundo mensaje con ese chat abierto
  llega por FCM, se ve en el chat y no crea aviso visible en la bandeja. Evidencia abajo.
- [x] Limpieza de la prueba Android: cerrar sesión por UI deja cero tokens del receptor.
  Cuentas temporales eliminadas por `delete_my_account`; SQL confirma cero usuarios,
  perfiles, sesiones, tokens, grupo y mensajes de la prueba. Contraseñas retiradas del archivo local.
- [x] Firma iOS preparada para push (2026-11-09): clave APNs asignada en EAS, capacidad
  Push Notifications activada en `app.cofounder.mobile` y perfil App Store `LH75W5YXBR`
  actualizado en Apple y EAS. La primera build de TestFlight
  [42718513493](https://github.com/thejowe/lockin/actions/runs/42718513493) falló porque
  el perfil anterior no incluía `aps-environment`; corregido mediante `eas credentials`.
- [ ] Build iOS y subida a TestFlight sobre `02d5414`, con todos los commits nuevos:
  [42721314523](https://github.com/thejowe/lockin/actions/runs/42721314523) en curso.
- [ ] Prueba de recepción y apertura de push en dispositivo iOS.

## Prueba push Android (2026-11-09)

Build EAS `preview` 1.0.0 (4), sobre `02d5414` más `app.json` y `google-services.json`
locales. Emulador AVD `lockin`, Android 16/API 36 x86_64 con Google Play Services, backend
**Supabase producción** `grrzmzktrhksbttpbblg`.

Las dos cuentas temporales y la unión al grupo «Prueba Push Android» se prepararon mediante
las API normales y las RPC de creación/likes recíprocos. El receptor inició sesión y concedió
el permiso en la UI. El emisor insertó los mensajes autenticado, igual que
`GroupRepository.sendMessage`; el trigger real invocó la función desplegada y esta envió a Expo.

Evidencia en `e2e/artifacts/local/2026-11-09-group-push/`:

- `report.md` y `verdict.json`: pasos, entorno y veredicto **PASS** del comprobador.
- `apk-verification.json`: SHA256 y sender/app/project id extraídos del APK con `aapt2`.
- `08-notification-visible.png`: aviso con grupo, emisor y texto tras el primer envío.
- `09-notification-opened-chat.png` y XML: tocar el aviso abre el chat correcto con el mensaje.
- `10-foreground.png`, `10-foreground-dumpsys.txt`, `11-foreground-tray.png` y
  `app-logcat.txt`: segundo mensaje visible, FCM recibido a las 23:35:26 UTC y cero
  notificaciones activas de la app mientras el chat tiene el foco.
- `message-verification.json`: peticiones `pg_net` 2 y 3, ambas HTTP 200 con `sent: 1`,
  sin timeout. La entrega la acreditan además las capturas y logcat.
- `15-logged-out.png` y `cleanup-verification.json`: bienvenida tras salir y borrado completo
  de cuentas, perfiles, sesiones, tokens, grupo y mensajes temporales.

Se inspeccionaron las capturas. `07-chat-before.png` todavía muestra la ficha del grupo y
`08-notification.png` una transición: no se usan como evidencia del chat ni del aviso.
La app queda instalada, sin la sesión temporal, y el emulador encendido. El recorrido completo
de creación/edición/salida/expulsión por UI continúa pendiente; esta prueba cubre push.

## Datos

| Tabla | Qué guarda |
| --- | --- |
| `groups` | `name`, `description`, `admin_id`, `max_members` (2–6, por defecto 6), `created_at` |
| `group_roles` | puesto: `specialty`, `slots`, `filled`; único por (`group_id`, `specialty`) |
| `group_members` | `group_id`, `user_id` (hasta 3 grupos por persona desde 20261111120000), `role_id` (null = admin), `joined_at` |
| `group_swipes` | `direction` (`user_to_group` / `group_to_user`), `decision`, `role_id`, `actor_id` |
| `group_messages` | chat del grupo |
| `push_tokens` | token Expo por dispositivo, cuenta y plataforma; sin lectura desde el cliente |

`user_reports` gana `group_id`, `group_ref` y `group_name` (foto del nombre al reportar).

RLS: todo `select` exige `is_group_member(group_id)`; ninguna tabla admite escritura directa
(`revoke all` + `grant select`). Se escribe solo por RPC `security definer`. Lo público del deck
(nombre, descripción, puestos y perfiles públicos de los miembros) sale de `group_deck()` y
`group_recruit_deck()`, no de las tablas.

RPC: `create_group`, `update_group`, `swipe_group`, `swipe_group_candidate`, `leave_group`, `kick_group_member`,
`group_deck`, `group_recruit_deck`, `report_group`, `report_group_message`, `block_group`.
Errores `LG001`–`LG005` (inválido, ya en un grupo, no disponible, solo admin, candidato no
disponible) y `LQ005` si algún día crear exige Premium.

La unión ocurre en `join_group_if_possible`, dentro de la misma transacción del segundo like:
cerrojo consultivo por persona, `for update` sobre el grupo, y comprueba plaza libre, aforo y que
la persona no tenga grupo. Dos likes simultáneos a la última plaza no la duplican.

Cuenta eliminada: el trigger `profiles_leave_groups` (antes de borrar el perfil) aplica la misma
salida que `leave_group`, hereda el admin y borra el grupo si se queda vacío.

## Decisiones tomadas sin el usuario (revisar)

1. **El admin no ocupa plaza de puesto.** Los puestos suman como mucho `max_members - 1`.
2. **Un miembro que no es admin no ve deck en Grupos**: ve «Tu grupo» (miembros, chat, salir).
3. **Si alguien encaja en varios puestos**, el deck le enseña el primero abierto; el admin da like
   para un puesto concreto y, si ese se llenó, se usa otro abierto que también encaje.
4. **Salir o ser expulsado convierte en «pasar»** los swipes entre esa persona y el grupo: no
   vuelve a entrar sola ni reaparece en el deck.
5. **Los likes del admin son del grupo**: sobreviven al cambio de admin.
6. **Herencia del admin**: el miembro más antiguo (`joined_at`, desempate por `user_id`); sin
   miembros, el grupo se borra con su chat.
7. **Bloquear un grupo** = pasar para siempre + bloquear al admin (`block_profile`). Desde dentro
   no se puede: primero se sale.
8. **Bloqueos entre personas**: no ves grupos con alguien bloqueado dentro, el admin no ve
   candidatos con bloqueo con cualquiera del grupo, y en el chat no ves mensajes de quien has
   bloqueado.
9. **Chat de grupo en tabla propia** (`group_messages`), con los componentes del chat 1:1
   (burbuja, compositor, reporte, puerta de Términos). No es un `match`.
10. **Reportar un grupo** va a `user_reports` contra el admin, con el grupo anotado.
11. **Flag en dos sitios**: `GROUP_CREATION_REQUIRES_PREMIUM` (`src/data/groups.ts`) y
    `group_creation_requires_premium()` (SQL). Hay que cambiar los dos a la vez.
12. **El mock nace con dos grupos semilla** («Taller Abierto», «Ruta Verde») para poder probar.

## Revisión por Codex (2026-11-09)

Hallazgos corregidos:

- **P1 — Cerrar sesión después de reiniciar dejaba el token registrado.** Solo se guardaba en
  memoria. Ahora se persiste en el dispositivo y la baja lo recupera sin pedir permiso; espera al
  registro en curso para que este no termine después de la baja. Pruebas de reinicio y de orden.
- **P2 — Cambiar de cuenta durante el mismo arranque no registraba push para la siguiente.**
  `useGroupPush` confundía «no volver a pedir permiso» con «no volver a registrar». Ahora solo
  limita el diálogo; vuelve a asociar el dispositivo a la cuenta al entrar en su grupo. Test con
  dos actores sobre el mismo dispositivo.
- **P2 — Un chat montado detrás de otra pantalla seguía silenciando sus avisos.** El estado sigue
  el foco de navegación, con prueba de pérdida de foco sin desmontaje.
- La prueba de última plaza era secuencial: ahora usa `Promise.all` y verifica que solo una
  aceptación entra. El arnés de Supabase siempre libera canales y desconecta Realtime, aunque el
  actor ya no tenga sesión.

Hallazgo abierto:

- **P2 — Limpieza incompleta de tokens inválidos** en
  `supabase/functions/notify-group-message/logic.mjs`: `deadTokens` solo mira la respuesta de
  `/push/send` y descarta los ids de los tickets aceptados. Si Expo acepta el ticket y APNs/FCM
  devuelve después `DeviceNotRegistered`, el token no se retira. Hace falta conservar la relación
  ticket/token y consultar `/push/getReceipts` posteriormente. Expo recomienda hacerlo a los 15
  minutos; los recibos caducan a las 24 horas:
  [documentación oficial](https://docs.expo.dev/push-notifications/sending-notifications/#check-push-receipts-for-errors).

## Producción y autorización de publicación (2026-11-09)

Al recibir la orden «aplica migraciones, commitea y pushea», las tres migraciones ya figuraban
en el historial remoto. Se cotejó su SQL con los archivos locales (sin comentarios ni diferencias
de espacios): los tres coinciden. No se ejecutaron de nuevo.

| Archivo local | Versión remota | Nombre remoto |
| --- | --- | --- |
| `20261109130000_groups.sql` | `20261109212531` | `groups` |
| `20261109140000_groups_edit.sql` | `20261109215116` | `groups_edit` |
| `20261109150000_group_message_push.sql` | `20261109215221` | `group_message_push` |

Comprobación SQL remota: RLS activa en las seis tablas de grupos/push, RPC de la app sin permiso
para `anon`, RPC de destinatarios y limpieza solo para `service_role`, y trigger
`group_messages_push` habilitado. `pg_net` 0.20.4 y Vault 0.3.1 instalados. La activación del
servidor y la configuración FCM de Android se comprobaron después, como consta en Estado;
la build y la prueba de entrega se documentan por separado.

Asesor de seguridad consultado: informa de RPC `security definer` accesibles para usuarios
autenticados y de `group_swipes`/`push_tokens` con RLS sin políticas, como exige el diseño de
acceso solo por RPC. Se comprobaron los permisos de las funciones nuevas; no se abrieron las
tablas para silenciar esos avisos.

## Verificación de textos legales (2026-11-09)

- `node scripts/build-legal.mjs` y `node scripts/build-legal.mjs --check`: pasan.
- Jest legal/i18n: **23/23**, tres suites (`src/i18n/i18n.test.ts`,
  `src/features/legal/legal.test.tsx`, `test/app/legal.test.tsx`). Comprueba también que las
  traducciones conservan secciones, enlaces y cifras, y que la app excluye notas editoriales.
- Jest aceptación/registro: **25/25**, dos suites (`src/features/profile/terms.test.tsx`,
  `src/features/profile/register-form.test.tsx`); avisos de React `act`, sin fallos.
- Descripciones y notas de revisión dentro del límite de 4000 caracteres. Se conserva «Ajustos»
  en rutas de la app en catalán; «Configuració» solo queda en la ruta del sistema iOS.
- Sin regenerar `_site/`, publicar Pages, modificar consolas de tiendas, commit ni push.
  El pendiente de borrado del token al desactivar notificaciones sigue abierto arriba.

## Verificación final de la revisión previa (2026-11-09)

- `npm run test:schema`: **239/239**.
- `node --test supabase/functions/notify-group-message/logic.test.mjs`: **7/7**.
- Contrato de grupos con el mock: **5/5**, incluida la aceptación simultánea a la última plaza.
  Contra Supabase no se ha ejecutado localmente; lo hará el job de contrato de CI.
- Jest completo con cobertura (`--runInBand`): **2179 pasan**, 226 saltados, 161 suites en verde
  y una saltada. **El comando termina en rojo por cobertura**, no por tests fallidos.

| Métrica | Medida | Suelo |
| --- | --- | --- |
| Sentencias | 94,82 % | 94,64 % |
| Ramas | 89,17 % | 89,52 % |
| Funciones | 93,98 % | 94,27 % |
| Líneas | 96,09 % | 96,19 % |

- Prettier en los archivos nuevos y modificados del bloque: pasa.
- ESLint en Grupos/push y los archivos de contrato/auth revisados: pasa con `--max-warnings 0`.
  `npm run lint` global falla en `src/features/premium/premium-badge.tsx:23`
  (`react-hooks/set-state-in-effect`), fuera del bloque; también da avisos en otros archivos.
- `npm run typecheck`: sin errores de Grupos/push. Sigue fallando por la ruta `/unblock` en
  `src/features/profile/unblock-request-form.tsx:38` y por un runner Deno de
  `e2e/artifacts/local/2026-10-14-avatar-fallo-cerrado/edge-runner.ts` que entra en el `tsconfig`
  global. No se han cambiado esos archivos ni los umbrales.
- `git diff --check`: pasa. En esa revisión no se aplicaron migraciones ni se hicieron
  despliegues, build nativa, commit o push; la orden posterior y el estado remoto constan arriba.

## Verificación anterior (antes de esta revisión)

- `npm run test:schema`: 233/233.
- Jest: 2142 tests en verde en la pasada completa; los 5 añadidos después (Premium y scroll del
  chat) pasan por separado. Una segunda pasada dio un fallo en `profile-form.test.tsx` (106 s,
  bajo carga), que no toca este bloque y había pasado en la primera.
- `tsc`: sin errores nuevos (queda uno ajeno en `unblock-request-form.tsx`).
- **Cobertura global bajo el suelo de `jest.config.js`** (94,63 / 88,77 / 93,85 / 95,90 frente a
  94,64 / 89,52 / 94,27 / 96,19). No lo causa este bloque: sus archivos miden 97,4 / 91,3 / 97,3 /
  98,5 y el resto del repo, sin ellos, 94,33 / 88,44 / 93,49 / 95,62. Los mayores huecos están en
  `src/components/app-intro.tsx` y `src/features/profile/unblock-request-form.tsx`.
