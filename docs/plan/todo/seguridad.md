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

- [x] **[comprobador]** La sesión **existente sobrevive a la actualización** (migración desde
  `AsyncStorage`) y cierre + reapertura la mantiene, contra **Supabase real**. Es el riesgo real
  del cambio de `c40e766`: perder la sesión anónima es perder el perfil. Hace falta un APK nuevo
  (`expo-secure-store` es nativo): `expo prebuild --clean` y build release con
  `EXPO_PUBLIC_SUPABASE_*` (ver memoria `gradle-no-rastrea-expo-public`). Pasos: instalar el APK
  **anterior** (`preview` de EAS), crear cuenta y perfil, instalar encima el nuevo, abrir y
  comprobar mismo uid y mismo perfil; `am force-stop` y repetir. Citar en la evidencia `[lockin]
  backend de datos: Supabase`.
  **Comprobado 2026-10-11 (comprobador), ✅, Supabase real.** APK anterior = `878d98a` y nuevo =
  `9c17d42`, ambos release x86_64 con `EXPO_PUBLIC_SUPABASE_*` y `--rerun`, compilados desde
  copias `git archive` en `C:\w\{old,new}` (no el árbol compartido). Se compiló con
  `EXPO_PUBLIC_REQUIRE_ACCOUNT=false` (sesión **anónima**, como el E2E `supabase`): la puerta de
  email necesita un buzón confirmable y el límite de GoTrue es ~2/hora; el almacenamiento de la
  sesión es el mismo. Pasos: `pm clear`, alta anónima, perfil «Migracion SS, 31, Sevilla»; en
  `RKStorage` (adb root) la clave `sb-…-auth-token` con uid `66c9b705-8bee-4841-b59e-17f453f4af0e`
  (`is_anonymous: true`); `adb install -r` del nuevo encima; abrir: va directo al deck y el Perfil
  muestra el mismo perfil; `RKStorage` queda sin la clave y existe `SecureStore.xml`; `am
  force-stop` + relanzar: mismo perfil. En Postgres hay una sola fila «Migracion SS», con ese
  uid (no se creó una cuenta nueva). Logcat de ambos arranques: `[lockin] backend de datos:
  Supabase`. No cubierto: sesión con email+contraseña (mismo almacén, no recorrido) ni migración
  desde un APK EAS firmado distinto. Queda una fila de prueba «Migracion SS» en el remoto.
  Evidencia: `e2e/artifacts/local/2026-10-11-secure-store-migracion/` (`old-22.png`, `new-02-perfil.png`,
  `new-03-tras-forcestop.png`, `old-RKStorage.db`, `new-RKStorage*.db`).
- [x] **[Claude]** Deep link `cofounder://auth/callback` (2026-10-11). La ruta reconstruye la URL
  con esquema, host y ruta fijos y solo deja pasar `code`, `token_hash`, `type`, `error`: un enlace
  ajeno no cambia de destino. `code` va ligado al verificador PKCE de este teléfono, así que un
  `code` forjado no canjea. **Hueco real, cerrado:** `token_hash` + `type` no iba ligado a nadie, y
  `verifyOtp` con el hash de la cuenta del atacante dejaba el teléfono dentro de ella. Ahora solo
  se acepta con un correo pedido desde este dispositivo en las últimas 24 h (`signUp`,
  `linkEmailToCurrentUser`, `sendPasswordReset` lo apuntan) y con `type` en
  `email_change|recovery|signup|email`. La marca no se borra al usar el enlace: «Secure email
  change» manda dos enlaces por petición. `codex review` en 2 rondas: la primera cazó que se
  rompían el alta por `signUp` y el segundo enlace del cambio de email (corregidos); la segunda
  sin hallazgos. Tests en `auth.test.ts`.
- [x] **[Claude]** URLs del perfil (2026-10-11): se abren con `openBrowserAsync` (navegador
  integrado, no `Linking.openURL`). El servidor ya tenía `check (… ~* '^https?://')` y el formulario
  valida igual; añadido el mismo filtro en `ProfileDetails` por defensa en profundidad (la URL sale
  de la fila de otra persona). Test: `javascript:` e `intent://` no se pintan.
- [x] **[Claude]** Manifiesto Android (2026-10-11): `allowBackup="true"` era el hallazgo; puesto
  `android.allowBackup: false` en `app.json` (efectivo en el próximo `prebuild`). Solo
  `MainActivity` está exportada (necesario para el lanzador y el esquema `cofounder`).
  `SCHEDULE_EXACT_ALARM` sigue declarado: decisión de Play ya listada en `docs/tiendas/`.
- [x] **[Claude]** Logs (2026-10-11): solo hay tres `console.*` en `src/` (backend activo,
  `la consulta "<key>" falló: <message>`, reintento por reloj). Ninguno imprime nombres, correos,
  mensajes ni tokens; las claves de consulta son identificadores. Sin hallazgo.
- [x] **WebRTC, solo STUN** (2026-10-11): se acepta sin TURN (coste cero, sin proveedor nuevo) y
  se dice a quien usa la app: `docs/tiendas/privacidad.md` ya nombraba STUN de Google y ahora
  dice que la otra persona ve tu IP en la llamada. Reabrir si algún día se quiere ocultarla.

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
- [x] **«Minimum password length» = 8** (2026-10-11, con Claude en Chrome): subido de 6 a 8 en
  Email y comprobado recargando el panel. La app no valida la longitud en el cliente y un rechazo
  llega como `weak-password` con copy claro; los E2E usan contraseñas largas.
- [x] **«Secure email change»**: se queda activo. Comentario de `auth.ts` y `supabase/README.md`
  corregidos; con anónimos activos no estorba (una anónima sin email recibe un solo correo).
- [ ] Revisar en el dashboard: Redirect URLs exactas, «Only private channels» en Realtime y SMTP
  propio (el límite por defecto es ~2 correos/hora).
