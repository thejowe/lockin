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
- [ ] T3a aceptación y enlaces (B)
- [ ] T3b reporte de mensajes y filtro (C)
- [ ] T4 fotos: retención y bucket (D)
- [ ] T5 app.json y binario (E)
- [ ] T6 declaraciones y cuenta de prueba de Apple (A, tras E)
- [ ] T7 verificación en dispositivo (F)
