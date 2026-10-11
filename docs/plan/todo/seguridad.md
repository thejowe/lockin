# Seguridad — segunda pasada (cliente, dependencias, dashboard)

Abierto el 2026-10-11. Informe y razonamiento completos en
`docs/plan/auditoria-seguridad-2026-10-cliente.md`; la primera pasada, solo de esquema SQL, en
`docs/plan/auditoria-seguridad-2026-10.md` (H1–H4, cerrados).

Sin bloque propio en `PLAN.md`: lo que sigue toca `src/data/supabase/` (alcance de `datos`) y el
manifiesto nativo, así que se lanza de uno en uno y nunca a la vez que otro bloque que toque esos
archivos.

## Hecho

- [x] **Sesión de Supabase y cuenta de dispositivo en `expo-secure-store`** — `c40e766`.
  `src/data/supabase/secure-storage.ts` (+ test), cableado en `client.ts` y `auth.ts`, mock en
  memoria en `jest.setup.js`, plugin en `app.json`. `codex review` en 2 rondas, 7 hallazgos
  corregidos. 128 suites / 1490 tests en verde, `tsc` limpio.
- [x] `has_profile_block(uuid)` como oráculo de «X me bloqueó»: **aceptado**, razón en el informe.
- [x] `npm audit`: analizado, sin acción. Solo `decode-uri-component` (vía `expo-router`) llega al
  runtime y no tiene arreglo sin cambiar `expo-router`. Reabrir al subir de SDK.
- [x] Dashboard de Supabase leído con Claude en Chrome el 2026-10-11.

## Abierto

- [ ] **[comprobador]** La sesión **existente sobrevive a la actualización** (migración desde
  `AsyncStorage`) y cierre + reapertura la mantiene, contra **Supabase real**. Es el riesgo real
  del cambio de `c40e766`: perder la sesión anónima es perder el perfil. Hace falta un APK nuevo
  (`expo-secure-store` es nativo): `expo prebuild --clean` y build release con
  `EXPO_PUBLIC_SUPABASE_*` (ver memoria `gradle-no-rastrea-expo-public`). Pasos: instalar el APK
  **anterior** (`preview` de EAS), crear cuenta y perfil, instalar encima el nuevo, abrir y
  comprobar mismo uid y mismo perfil; `am force-stop` y repetir. Citar en la evidencia `[lockin]
  backend de datos: Supabase`.
- [ ] **[Claude]** Revisar el deep link `cofounder://auth/callback`: `completeAuthLink`
  (`src/data/supabase/auth.ts`, ~línea 514) se leyó solo a medias. El esquema propio es
  secuestrable en Android; PKCE mitiga. Comprobar que un enlace malformado o ajeno no cambia de
  cuenta ni abre sesión.
- [ ] **[Claude]** URLs del perfil (`link_github`, portfolio): comprobar con qué esquema se abren
  (`Linking.openURL`) y validar que sea `https:`. Sin hallazgo todavía.
- [ ] **[Claude]** Manifiesto Android tras `expo prebuild`: `allowBackup`, componentes
  exportados, `SCHEDULE_EXACT_ALARM`. Confirmar de paso que el plugin de `expo-secure-store` deja
  su dato fuera del Auto Backup.
- [ ] **[Claude]** Logs: buscar datos personales en `console.*` y en mensajes de error que lleguen
  al usuario o a Sentry si lo hubiera. Sin hallazgo todavía.
- [ ] **WebRTC, solo STUN**: expone la IP de la otra persona. Decisión de producto, no de código:
  o se acepta y se dice en `docs/tiendas/` (privacidad), o hay que contratar un TURN.

## Del usuario (ningún agente puede)

- [ ] **Leaked password protection**: Auth → Sign In / Providers → Email → «Prevent use of leaked
  passwords». **Exige plan Pro**; la organización «Second Thought» es Free (comprobado el
  2026-10-11). Es una decisión de gasto. Si se contrata, se activa en un minuto con Claude en
  Chrome.
- [ ] **Captcha en altas anónimas** (Auth → Attack Protection → «Enable Captcha protection», hoy
  desactivado). **No activar sin cambio de cliente**: sin `captchaToken` en `signInAnonymously()`
  nadie podría darse de alta. Falta elegir proveedor (Turnstile o hCaptcha). Diseño pensado, sin
  escribir: página alojada en GitHub Pages (`web/`) que devuelve el token por deep link con
  `expo-web-browser`, tras una variable `EXPO_PUBLIC_CAPTCHA_URL` apagada por defecto, para no
  añadir `react-native-webview`. Cuidado: ese deep link comparte esquema con
  `cofounder://auth/callback`, así que primero hay que cerrar la casilla del deep link.
- [ ] **«Minimum password length» = 6** en Email (Supabase recomienda 8). Subirla puede romper el
  formulario si la app valida 6: mirar `src/features/profile/` antes de tocarla.
- [ ] **«Secure email change» activo**, y un comentario de `auth.ts` dice que debe estar
  desactivado. El E2E de registro pasa, así que no hay fallo demostrado: decidir si se actualiza
  el comentario o el ajuste.
- [ ] Revisar en el dashboard: Redirect URLs exactas, «Only private channels» en Realtime y SMTP
  propio (el límite por defecto es ~2 correos/hora).
