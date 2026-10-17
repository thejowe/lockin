# Prompt para Claude Code (copiar y pegar)

```
Trabaja en el repo thejowe/lockin (app "cofounder", Expo SDK 57 + Supabase). Rama: claude/startup-cofounder-matching-app-tfeai1. Objetivo: dejarla publicable en App Store y Google Play. Respeta las convenciones del repo (AGENTS.md, CLAUDE.md, tests junto al código, migraciones nuevas en supabase/migrations con timestamp, nunca editar migraciones ya aplicadas). Haz un commit por tarea, con tests. No despliegues nada a producción sin que yo lo confirme.

Tareas (son NUEVAS; las de permisos app.json, WebRTC y Lock-In del binario ya están en otro informe, inclúyelas solo si no están hechas):

1. Aceptación de normas antes de usar la app (Apple 1.2). En el onboarding, antes de crear el perfil, una casilla obligatoria: "Acepto las Normas de la comunidad (tolerancia cero con contenido abusivo), los Términos y la Política de privacidad" con los tres enlaces. Guarda en BD la aceptación: migración que añada a profiles (o tabla aparte) `terms_accepted_at timestamptz` y `terms_version text`, escribible solo vía RPC `accept_terms(p_version text)`. Bloquea crear perfil/decisiones/mensajes en servidor (RLS o en las RPC existentes) si no hay aceptación de la versión vigente. Usuarios ya existentes: se les pide al abrir la app.

2. Enlaces legales dentro de la app (Apple 5.1.1(i)). En Perfil → sección Cuenta y en la pantalla de registro: Privacidad, Términos, Normas, Soporte, Eliminar cuenta (web) y Aviso legal, abiertos con expo-web-browser. Base URL en una constante única.

3. Reporte de mensajes concretos. Pulsación larga en una burbuja del chat (message-bubble.tsx) → "Reportar mensaje" → ReportForm. Migración: añade `message_id uuid null references messages(id) on delete set null` y `message_snapshot text` a user_reports, y una RPC `report_message(p_message_id, p_reason, p_details)` que verifique que quien reporta es participante del match y que el mensaje es del otro; guarda snapshot del texto. Mantén report_profile.

4. Aviso al responsable de cada reporte nuevo: trigger/Database Webhook o Edge Function que envíe un email a cofounder.soporte@gmail.com (proveedor: el SMTP/Resend configurado; si no hay, deja la función lista y documenta el secreto necesario). Añade también una RPC solo para service_role `suspend_profile(p_profile_id)` que oculte el perfil del deck y bloquee el envío de mensajes (columna `suspended_at`).

5. Moderación de texto. Antes de guardar el texto libre del perfil (respuestas cortas, nombre, ubicación, enlaces) llama a la Edge Function de moderación (reutiliza la lógica de moderate-avatar con OpenAI omni-moderation-latest para texto) y rechaza con mensaje claro si sale flagged. Para mensajes de chat: evalúa coste/latencia y, como mínimo, aplica una lista de palabras/patrones en servidor. Tests para la lógica en logic.mjs.

6. Limpieza de Storage tras borrar cuenta. El RPC delete_my_account no borra storage.objects y el cliente borra la foto "a mejor esfuerzo". Añade una tarea programada (pg_cron ya está activo en el proyecto) o Edge Function programada que borre objetos de los buckets `avatars` y `avatar-uploads` cuyo primer segmento de ruta no corresponda a un auth.users.id existente. Tests.

7. Purga de cuentas anónimas abandonadas: cron que borre auth.users anónimos (is_anonymous) sin actividad desde hace más de 30 días (documenta el criterio).

8. AgreementCard: hoy se pinta en todos los chats con mode 'par' (src/app/chat/[matchId].tsx:159). Escóndela detrás de un flag `FEATURES.agreement = false` (constante única) hasta que se decida anunciarla; aplica el mismo flag para que las rutas src/app/agreement, src/app/room y src/app/session redirijan a /discover si alguien llega por deep link (si no se eliminan del binario).

9. Notificaciones: si no hay push de match/mensaje, quita el plugin "expo-notifications" de app.json y el código que solo existía para Lock-In, conservando la limpieza de avisos antiguos solo si sigue siendo necesaria; documenta la decisión.

10. app.json: añade `ios.infoPlist.ITSAppUsesNonExemptEncryption: false`. En eas.json, el perfil `production` no define EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY: configúralos (variables de entorno EAS, no secretos en git) y añade una comprobación que haga fallar el arranque/build de producción si faltan (no caer al mock).

11. Web estática (web/ + scripts/build-web.mjs): la política se genera de docs/tiendas/privacidad.md, que es la versión antigua pre-pivote. Sustitúyela por docs/tiendas-revisadas/privacidad.md (déjame los marcadores [pendiente] visibles en la PR para que los rellene). Añade páginas web/terminos/ y web/aviso-legal/ (LSSI art. 10: titular, NIF, domicilio, email, con marcadores para que yo ponga los datos) y enlázalas en el pie de todas las páginas. Asegura que pages.yml despliega desde la rama que se publique.

12. Tras todo: `npx expo prebuild --clean` en local/CI y comprueba en el AndroidManifest fusionado que solo quedan los permisos necesarios (sin RECORD_AUDIO, SCHEDULE_EXACT_ALARM, AD_ID ni READ_MEDIA_*) y que targetSdkVersion es 36. Pega el resultado en la PR.

Al final, dame una lista de lo que no pudiste hacer y de los datos que necesitas de mí.
```
