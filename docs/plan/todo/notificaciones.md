# Notificaciones — 2026-11-11

Ampliación preparada en `claude/startup-cofounder-matching-app-tfeai1`.
Migración aplicada en producción el 2026-11-11 por orden del usuario.
Proyecto: `grrzmzktrhksbttpbblg`. Edge Function v4 desplegada el 2026-11-11
con autorización explícita; transporte backend comprobado. Recepción física pendiente.

## Alcance

- Resumen diario de likes no vistos, match, mensajes 1:1 y de grupo, actividad
  de grupos, reenganche opcional con motivo y caducidad de Premium.
- Preferencias en Ajustes (ca: Ajustos), registro sin diálogo al arrancar si ya
  hay permiso, permiso contextual en likes/match/grupos y baja del token.
- Migración nueva `20261111160000_push_notifications.sql` y ampliación de
  `notify-group-message` con la misma URL y secretos. Migración aplicada;
  función actualizada desplegada como v4.
- SQL embebido y pruebas de función/cliente; documentos legales es/en/ca.

## Validación local y pendientes

- [x] `npm test -- --runInBand`: 166 suites y 2.248 tests pasan; 1 suite y 227
  tests omitidos según la configuración existente. No se bajó la cobertura.
- [x] `npm run test:functions`: 114 tests pasan.
- [x] `npm run test:schema -- --test-concurrency=1`: 263 tests pasan, incluida
  recompilación idempotente, ausencia de Vault/net/cron y permisos por rol.
- [x] `npm run typecheck`, lint/formato del alcance y
  `node scripts/build-legal.mjs --check`.
- [x] Edge Function: `deno check --no-lock --node-modules-dir=none` sobre copia
  aislada de index.ts y sus cuatro módulos locales (incluido sync-entitlement).
  Sin escribir lock/dependencias en el repo ni usar configuración o secretos.
  ESLint del alcance: cero errores; avisos previos de require en andamiaje Jest
  y de index.ts ignorado por tratarse de Deno.
- [x] Revisión de un snapshot exacto del índice, sin los cambios previos de
  grupos: SQL 261 y funciones 114 pasan; typecheck de app pasa. La suite completa
  muestra 10 fallos en `test/app/groups.test.tsx`, los mismos 10 reproducidos en
  un export de HEAD `ce106d0` sin este parche. No son regresiones de esta tarea:
  quedan resueltos en los cambios de grupos ya presentes en el árbol compartido,
  que se conservan sin incluirlos aquí. i18n necesita un contexto Git para
  enumerar fuentes; repetido con ese contexto junto a group-routes: 39/39 pasan.
  No se han ocultado suites ni cambiado umbrales. Logs locales de comparación:
  `lockin-push-review-jest.log`, `lockin-push-base-groups.log`,
  `lockin-push-review-focus.log` en la carpeta temporal de Codex.
- [ ] Android: comprobador con backend mock y sin dotenv. El bundle SDK 58 se
  genera, pero tres intentos de build fallan en C++ por rutas de Windows >260
  caracteres (reanimated/gesture-handler). No se obtuvo APK nuevo: quedan sin
  comprobar visualmente Ajustes, persistencia mock, catalán y permiso contextual.
  Evidencia local ignorada:
  `e2e/artifacts/local/2026-11-11-notificaciones/verdict.md` y logs/hash de fuentes.
  Repetir desde una ruta de proyecto más corta o tras corregir el toolchain.
- [ ] Push real/frío/caliente y baja del token en iOS/Android físicos requieren
  build con servicios configurados. Los handlers y el foco están probados en Jest.
- [x] Migración aplicada en producción; comprobados estructura, permisos y jobs.
- [x] Con confirmación explícita: función actualizada desplegada como v4.
- [x] Transporte backend comprobado, incluida corrección de timeout y zona horaria.
- [ ] Recepción física de push pendiente.
  Vault sin cambios.
- [ ] Recibos posteriores de Expo: P2 en `grupos.md`, fuera de esta tanda.

## Hecho en el código

- `user_settings`: locale es/en/ca (fallback en), actividad, vistos de likes,
  últimas marcas y siete preferencias true. El modo activo se conserva; las
  columnas nuevas solo se escriben por RPC propia. Lectura de preferencias por
  RPC; no hay acceso de cliente a tokens, eventos o reservas.
- Digest: pendientes sin decisión de vuelta ni bloqueo; posteriores a
  `greatest(incoming_likes_seen_at,last_like_digest_at)`. Ventana 11:00–12:00
  local, una vez por día y al menos 20 h. Zona IANA inválida/ausente → Madrid.
  El RPC no devuelve nombre ni Super Like a destinatarios gratis. /likes marca
  vistos también sin Premium; las fotos/nombres gratis siguen sin descargarse.
- Match inmediato a ambos y mensaje 1:1 solo al destinatario; bloqueos en ambos
  sentidos. Mensajes de grupo mantienen firma/copy/canal y añaden preferencia.
- Grupos: triggers sobre pertenencia/swipes, independientes de las funciones
  que los crean. Entrada propia, entrada ajena, expulsión y candidatura al admin.
  Tope de 3 candidaturas por día local y admin; no hay cola de las sobrantes.
  La expulsión abre `/(tabs)/matches`. Sin Vault/net ningún insert falla.
  La confirmación de expulsión ya no promete que nadie reciba un aviso.
- Reenganche: ≥3 días desde last_active o last_sign_in inicial, ≥7 días entre
  avisos, 10:00–20:00, con likes no vistos o mensaje ajeno posterior a actividad.
  Respeta notify_likes para la razón de likes. Si lleva likes, consume también
  su marca de resumen para evitar repetirlos en el próximo digest.
- Premium: premium_until entre +20 y +28 h, una vez por fecha UTC, excluye null
  y año 9999; 09:00–22:00 local, /premium. No distingue prueba de pago.
- Reservas de 15 min por cuenta/tipo evitan cron concurrente. Marca al recibir
  ticket Expo `ok` en al menos un dispositivo; no marca error HTTP, excepción,
  ticket fallido o ausente. La marca usa la hora de selección para no consumir
  likes posteriores al envío. Esto no garantiza entrega final: recibos P2.
- Eventos de grupo: IDs/fechas, sin texto libre del webhook, con FK/cascada;
  purga tras 7 días desde el job horario. Reservas: una fila por cuenta/tipo,
  sustituidas en cada intento. También se borran con la cuenta.
- La misma función admite cuerpos legacy `{message_id}` y tipos explícitos:
  group-message, direct-message, match, group-activity (solo event_id),
  like-digest, reengagement, premium-expiry. Autenticación x-push-secret,
  destinatarios solo por RPC service_role, lotes de 100 y tokens muertos fuera.
- Android: group-messages, messages, matches, likes, groups y reminders antes
  del permiso; reminders DEFAULT. Hilos/collapse por conversación o resumen.
  Sin badge. Solo rutas /likes, /premium, /chat/UUID, /group/UUID y tab Matches.
- PushBridge comprueba permiso, sincroniza idioma, registra sin diálogo si ya
  hay permiso y marca actividad con throttle por cuenta. Consulta sesión sin
  crear una nueva al abrir bienvenida. Se sincroniza al navegar y al volver.
  El cambio de idioma usa useLocale; no depende de haber entrado en un grupo.
- Permiso contextual compartido entre likes, MatchModal y grupos, como máximo
  una vez por arranque. Permiso denegado: solo enlace a ajustes del sistema;
  baja al retirar permiso y al cerrar sesión conservadas.
- Privacidad v1.9 y generados es/en/ca, inventario y delta de App Privacy / Data
  safety documentados. Recordatorios: interés legítimo con oposición desde
  Ajustes; revisión jurídica/declaraciones del responsable pendiente.

## Aplicación en producción — 2026-11-11

- Autorización del usuario: aplicar las migraciones pendientes. Se cotejó el
  historial remoto: `groups_multi_membership` ya estaba aplicada como
  `20261111173433`; solo faltaba `push_notifications`.
- Aplicada mediante Supabase MCP, sin modificar el SQL preparado:
  local `20261111160000_push_notifications.sql` → remoto
  `20261111174123_push_notifications`. No se reejecutaron migraciones previas
  ni se cambiaron sus archivos o el historial remoto.
- Verificados los 13 campos nuevos de settings (siete booleanos true y seis
  campos nullable), ausencia de la sobrecarga antigua de register_push_token y
  compatibilidad con llamadas de dos argumentos mediante el tercero opcional.
- Tablas push_notice_claims/push_group_events con RLS y sin SELECT para anon o
  authenticated. RPC internas solo service_role; RPC propias accesibles a
  authenticated y sin acceso anon. Marcas/preferencias sin UPDATE directo;
  active_mode conserva su permiso de escritura.
- Los cinco triggers están habilitados, incluido group_messages_push existente.
  Jobs activos, ejecutados como postgres: `lockin-push-like-digest` (`*/15 * * * *`)
  y `lockin-push-hourly` (`25 * * * *`). Solo se comprobó su definición; no se
  forzó ningún envío ni se invocó manualmente enqueue.
- Prueba remota sin datos personales: destinos de eventos con un UUID inexistente
  devuelven cero filas; push_local_time sin perfil usa Europe/Madrid. Prueba SQL
  local previa a aplicar: 13/13. No se crearon usuarios o mensajes de prueba en
  producción ni se consultaron tokens, nombres o contenido de mensajes.
- Antes del commit documental: `npm test -- --runInBand` (2.248 pasan, 227
  omitidos; 166 suites pasan y 1 omitida) y `npm run typecheck` pasan.
- Advisors: dos tablas más con [RLS sin políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
  (cerradas deliberadamente) y cinco nuevas [RPC propias SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable),
  con auth.uid y permisos de su cuenta. Las dos RPC anon previas no cambian.
- Al cerrar el paso de migración, `notify-group-message` seguía ACTIVE en v3,
  verify_jwt=false. El despliegue autorizado posterior consta a continuación.
- Sin cambios en Vault, secretos, Firebase, tiendas o web publicada.

## Despliegue autorizado y verificación — 2026-11-11

- Fuente base `42a81a1`; función `notify-group-message` v4 ACTIVE, mismo ID/URL,
  verify_jwt=false. Se subieron index.ts, logic.mjs, copy.mjs,
  revenuecat-webhook/logic.mjs y sync-entitlement/logic.mjs. Los cinco contenidos
  recuperados del despliegue coinciden exactamente con el repo.
- Hash del bundle reportado por Supabase:
  `3cfd68574eee70865d9891416bef4f13e36b401116aa1695e60dcafcbc5a6eab`.
- Sin leer o modificar secretos: POST externo sin x-push-secret devuelve
  401 `{error:secret}`; pg_net usa la cabecera ya existente mediante enqueue.
- Primera comprobación: legacy group-message, direct-message, match y
  group-activity con UUID inexistente devuelven 200 `{sent:0,forgotten:0}`.
  No se crearon eventos de producto ni se reutilizaron mensajes reales.
- Se invocaron los enqueues del resumen y horario. Las siete solicitudes
  terminaron con HTTP 200 en los logs de la función, pero los tres avisos
  programados superaron el timeout de 5 s de pg_net; se reprodujo en el horario
  al repetirlo. El resumen en caliente devolvió 200 (request 12).
- El cron real de likes ejecutó a las 18:00 UTC: succeeded y respuesta 200 de
  pg_net (request 15). El job horario usa el mismo helper comprobado manualmente;
  no se ha esperado hasta el siguiente minuto 25.
- Diagnóstico: push_local_time recorre pg_timezone_names por llamada (~75 ms);
  el RPC del digest sin destinos tarda ~3 s con solo 16 filas de settings.
  Corrección nueva `20261111180240_push_delivery_reliability.sql`: validar rutas
  IANA/UTC/GMT directamente con timezone(), conservar catálogo para alias sin
  barra, fallback Madrid ante zona inválida y 30 s de margen para el webhook.
  No se modifica la migración ya aplicada ni el copy, horarios o destinatarios.
- Corrección probada y aplicada en producción como
  `20261111180445_push_delivery_reliability`. Prueba SQL 264/264, incluidas
  recompilación idempotente, zonas inválidas/offsets, fallback, cabecera del
  webhook, timeout de 30 s y tolerancia al fallo de red. Lint/formato del test
  y typecheck pasan. La nueva migración no modifica Vault ni sus valores.
- Medida posterior del mismo RPC sin destinos: 12,6 ms frente a ~3 s antes,
  sobre estas 16 filas; no es una prueba de carga. Requests pg_net 16/17/18
  (digest/reenganche/Premium): HTTP 200 `{sent:0,forgotten:0}`, sin timeout.
  Reconfirmados los permisos service_role y advisors sin cambios de exposición.
- Antes del despliegue: funciones 114/114 y Deno check pasan. Antes del commit:
  Jest 2.248 pasan, 227 omitidos; typecheck pasa.
- La recepción efectiva en el móvil no se ha comprobado. Un HTTP 200 con cero
  destinos verifica el transporte y la selección vacía, no Expo/APNs/FCM.

## Orden de activación y pasos pendientes

1. Hecho: revisar el historial remoto, incluidos los cambios de grupos previos.
   Los timestamps históricos locales/remotos difieren; cotejar también el nombre
   y no usar un db push a ciegas que intente reaplicar migraciones antiguas.
2. Hecho: aplicar `20261111160000_push_notifications.sql`, registrada remotamente
   como `20261111174123_push_notifications`. No volver a aplicarla ni editarla.
3. Vault no cambia: reutilizar push_webhook_url y push_webhook_secret actuales.
4. Hecho con confirmación: desplegar **la misma** función (v4):
   `supabase functions deploy notify-group-message --project-ref grrzmzktrhksbttpbblg --no-verify-jwt`.
   Incluir index.ts, logic.mjs, copy.mjs, revenuecat-webhook/logic.mjs y su
   dependencia sync-entitlement/logic.mjs (también al desplegar por MCP).
   Reutilizar PUSH_WEBHOOK_SECRET existente; no pedirlo,
   copiarlo al repo ni generar otro. `verify_jwt` sigue false.
5. Backend: enqueues y cron real de likes comprobados; corrección del timeout
   aplicada y verificada. Queda un envío real con receptor en móvil para
   validar Expo/APNs/FCM; no confundir el estado succeeded del cron con entrega.
6. Preparar/distribuir una build con el cliente actualizado. Comprobar iOS y
   Android físicos: permiso, frío/caliente, pantalla en foco y baja por sistema.
7. Publicar web/textos legales y actualizar declaraciones de tiendas solo con
   confirmación. Revisar Product Interaction, idioma/preferencias y finalidad
   de recordatorios; el token sigue siendo Device ID funcional sin tracking.

## Límites y pendientes

- Sin recibos posteriores de Expo: un ticket aceptado no demuestra entrega.
- Los avisos programados requieren al menos un token y una fila de settings
  (el registro la crea). No hay avisos vacíos ni de perfil incompleto.
- Límite de 500 cuentas por selección y todos sus dispositivos. Un fallo se
  vuelve a intentar tras la reserva y dentro de la próxima ventana permitida;
  no se retrasa al día siguiente un evento inmediato perdido.
- Una ventana de caducidad que cae íntegramente en horario nocturno puede
  quedar sin aviso de Premium: se prioriza no avisar de 22:00 a 09:00.
- En producción se aplicaron las migraciones de notificaciones y su corrección
  de fiabilidad, y se desplegó v4 de la misma función. No se han tocado
  secretos/Vault, Firebase, tiendas, web publicada, badge, analítica, email,
  Lock-In/salas ni archivos de migraciones ya aplicadas.

## Archivos de esta tarea

Los cambios previos de grupos se conservan fuera de este commit; en archivos
compartidos solo se incluyen los cambios de notificaciones.

```text
docs/plan/TODO.md
docs/plan/todo/notificaciones.md
docs/tiendas/ca/privacidad.md
docs/tiendas/cuestionario-privacidad.md
docs/tiendas/datos-recopilados.md
docs/tiendas/en/privacidad.md
docs/tiendas/privacidad.md
jest.setup.js
package.json
src/app/chat/[matchId].tsx
src/app/group/[groupId].tsx
src/app/settings.tsx
src/components/push-bridge.test.tsx
src/components/push-bridge.tsx
src/data/mock/push.ts
src/data/notification-settings.ts
src/data/push.test.ts
src/data/repositories.ts
src/data/supabase/database.types.ts
src/data/supabase/push.ts
src/features/discover/match-modal.tsx
src/features/groups/group-home.tsx
src/features/groups/use-group-push.ts
src/features/legal/texts.generated.ts
src/features/notifications/use-contextual-push.ts
src/features/premium/incoming-likes.test.tsx
src/features/premium/incoming-likes.tsx
src/features/premium/likes-row.tsx
src/features/profile/notification-section.test.tsx
src/features/profile/notification-section.tsx
src/features/safety/chat-safety.test.tsx
src/features/safety/message-report.test.tsx
src/i18n/ca.json
src/i18n/en.json
src/lib/push.test.ts
src/lib/push.ts
supabase/drift-check.mjs
supabase/drift-check.test.mjs
supabase/functions/notify-group-message/copy.mjs
supabase/functions/notify-group-message/index.ts
supabase/functions/notify-group-message/logic.mjs
supabase/functions/notify-group-message/logic.test.mjs
supabase/migrations/20261111160000_push_notifications.sql
supabase/migrations/20261111180240_push_delivery_reliability.sql
supabase/push-embedded.test.mjs
test/app/group-routes.test.tsx
test/app/layouts.test.tsx
test/app/matchId.test.tsx
test/routes.tsx
tsconfig.json
```
