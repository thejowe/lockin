# Grupos — detalle

Pedido por el usuario el 2026-11-09: además del deck de cofundador, Descubrir gana una sección
«Grupos». Un grupo es un proyecto con admin, puestos (especialidad + plazas) y hasta 6 personas.
Quien administra recluta; quien no tiene grupo ve los grupos que buscan lo que domina.

**Tensión con el concepto:** `CONCEPTO.md` dice «nadie contrata a nadie». Los grupos introducen
puestos y plazas por decisión expresa del usuario. Se mantiene lo esencial: la entrada exige like
de los dos lados y dentro no hay jerarquía más allá de administrar (expulsar, y heredar al salir).

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
- [ ] Activación de push: build nativa nueva (`expo-notifications` vuelve a `package.json` y
  `app.json`), credenciales FCM/APNs, desplegar `notify-group-message` con `verify_jwt: false`,
  configurar `PUSH_WEBHOOK_SECRET` y guardar en Vault `push_webhook_url` y
  `push_webhook_secret` (el mismo secreto). `pg_net` y Vault ya están instalados; los dos secretos
  de Vault no están configurados (verificado sin leer sus valores).

## Datos

| Tabla | Qué guarda |
| --- | --- |
| `groups` | `name`, `description`, `admin_id`, `max_members` (2–6, por defecto 6), `created_at` |
| `group_roles` | puesto: `specialty`, `slots`, `filled`; único por (`group_id`, `specialty`) |
| `group_members` | `group_id`, `user_id` **único** (un grupo por persona), `role_id` (null = admin), `joined_at` |
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
   (burbuja, compositor, filtro de contenido, reporte, puerta de Términos). No es un `match`.
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
`group_messages_push` habilitado. `pg_net` 0.20.4 y Vault 0.3.1 instalados. La activación de push
sigue pendiente de los secretos, del despliegue de la función y de la build nativa.

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
