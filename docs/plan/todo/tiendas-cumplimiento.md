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

- [ ] T1 documentos y páginas (A)
- [x] T3a aceptación y enlaces (B) — hecho 2026-10-14; falta gate en chat y aplicar migración 20261014120000
- [x] T3b reporte de mensajes y filtro (C) — migración 20261014130000 sin aplicar en producción; pendiente codex review
- [ ] T4 fotos: retención y bucket (D)
- [x] T5 app.json y binario (E) — hecho 2026-10-15, ver «T5 hecho»
- [x] T6 declaraciones y notas de revisor (A) — hecho 2026-10-15, ver «T6 hecho»; abiertos los marcadores `[pendiente: ...]`
- [ ] T7 verificación en dispositivo (F)

## ▶ Al retomar — estado del 2026-10-14 (parado a petición del usuario)

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
- [ ] T5 `app.json`/binario (agente `arquitecto`, tras arreglar lo de arriba): quitar
  `@config-plugins/react-native-webrtc`, RECORD_AUDIO, SCHEDULE_EXACT_ALARM, `expo-notifications`
  (solo sirve al recordatorio de Lock-In; `expo-secure-store` SE USA, se queda); dejar solo los textos de
  `expo-image-picker`; sacar Lock-In/WebRTC de la build de tienda (Apple 2.3.1) o apagarlo de verdad;
  revisar manifiesto del AAB.
- [ ] T6 declaraciones: actualizar cuestionario/Data safety contra el binario final (incluida foto);
  cuenta de prueba y notas de revisor de Apple.
- [ ] T7 `comprobador` en emulador: aceptación de términos (onboarding, chat, perfil existente), enlaces
  legales, reportar mensaje, filtro, baja de cuenta con fotos. Necesita APK nuevo y migraciones aplicadas.
- [ ] Texto de `privacidad.md`/`eliminar-cuenta` sobre borrado de fotos: pasar de «mejor esfuerzo» a
  «garantizado en servidor» una vez aplicada `20261014140000`.
- [ ] Subir `TERMS_VERSION` si cambia la fecha final de `terminos.md` (hoy ambas 2026-10-14).

**Migraciones SIN aplicar en producción** (`grrzmzktrhksbttpbblg`; requieren permiso del usuario):
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

