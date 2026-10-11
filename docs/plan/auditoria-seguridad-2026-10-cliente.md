# Auditoría de seguridad, segunda pasada: cliente, dependencias y configuración — 2026-10-11

Complementa `auditoria-seguridad-2026-10.md`, que cubrió solo el esquema SQL. Esta pasada mira la app, las dependencias, CI y el estado del proyecto remoto (`get_advisors` de Supabase, solo lectura).

## Resultado

| # | Gravedad | Hallazgo | Estado |
|---|---|---|---|
| 1 | Media | «Leaked password protection» desactivada en Supabase Auth | **Bloqueado por plan**: «Only available on Pro plan and above». La organización «Second Thought» es Free. No se activa sin pagar |
| 2 | Media-baja | Refresh token y contraseña de la cuenta de dispositivo en `AsyncStorage`, en claro | **Arreglado** en código; necesita build nativa nueva |
| 3 | Media-baja | Altas anónimas sin captcha: solo frena el límite de 30/h por IP | **Abierto, del usuario** (ver abajo: no se puede activar sin cambio de cliente) |
| 4 | Baja | `has_profile_block(uuid)` invocable por RPC: quien fue bloqueado puede sondear si lo bloquearon | **Aceptado**, razonado abajo |
| 5 | Info | `npm audit`: 71 avisos, 1 crítico | **Analizado**, sin acción; abajo |

## 2. Almacén seguro de la sesión

`src/data/supabase/secure-storage.ts` sustituye a `AsyncStorage` como `storage` del cliente de Supabase y guarda en él la cuenta de dispositivo (`lockin.supabase.device-account`, que lleva email y contraseña).

- Usa `expo-secure-store` (Keystore / Keychain), `~57.0.4`, con plugin en `app.json`.
- Migra al leer: quien ya tiene sesión en `AsyncStorage` la conserva y la copia en claro se borra.
- Escritura por generaciones con manifiesto: morir a mitad de una escritura deja el valor anterior.
- Una operación a la vez por clave.
- Un fallo del Keystore sin copia de reserva se propaga (nunca «no hay sesión»), y `removeItem` no da por cerrada una sesión que sigue ahí.
- Web: sigue `AsyncStorage`.

`codex review` dio dos rondas con 7 hallazgos (P1 y P2); todos corregidos y cubiertos por tests (`secure-storage.test.ts`). Suite completa: 128 suites, 1490 tests en verde; `tsc` limpio.

**Falta (del usuario / comprobador):**
- Es un módulo nativo: hace falta un APK nuevo (`expo prebuild`). El E2E de CI ya compila desde prebuild.
- Comprobar en el emulador, con Supabase real, que una sesión existente **sobrevive a la actualización** (migración desde `AsyncStorage`) y que cierre y reapertura la mantiene. Es el riesgo real de este cambio: perder la sesión de una cuenta anónima es perder el perfil.
- Una copia en `AsyncStorage` puede quedar tras un fallo parcial; se reintenta la migración en la siguiente lectura.

## 4. `has_profile_block` como oráculo

La función solo contesta sobre bloqueos que implican a quien llama, así que el único dato que filtra es «X me ha bloqueado». Ese hecho ya es observable: el match desaparece de la lista y la persona de X desaparece del deck. Moverla a un esquema no expuesto obligaría a reescribir las políticas y funciones que la usan (migraciones `20261009224000` a `20261011120000`) para tapar un dato que ya se infiere. Se acepta. Revisar si algún día el producto promete que el bloqueado no sepa que lo es.

## 5. Dependencias

`npm audit --omit=dev` cuenta 71 avisos, pero casi todo es herramienta de build y no entra en el bundle de la app:

- `shell-quote` (crítico): vía `react-devtools-core`, servidor de desarrollo.
- `node-forge`: vía `@expo/code-signing-certificates` y `@expo/cli`, herramientas.
- `braces`, `source-map-js`, `sprintf-js`, `uuid`: cadena de Metro, Jest y config plugins.
- `decode-uri-component` (moderado, DoS por URL mal codificada): vía `expo-router` → `query-string`. **Es el único que llega al runtime**, y solo da cuelgue de la app con un enlace malformado, no ejecución. Sin arreglo disponible sin cambiar `expo-router`.

`npm audit fix` sin `--force` solo quitaba 5 avisos y movía el lockfile; no se aplica. Reabrir al subir de SDK.

## Pendiente del usuario

1. **Auth → Sign In / Providers → Email → Prevent use of leaked passwords**: requiere plan Pro (comprobado en el dashboard el 2026-10-11, desde Attack Protection → «Configure in email provider»). Decisión de gasto del usuario. Mientras tanto, subir «Minimum password length» de 6 a 8 (hoy 6) mitiga parte, pero antes hay que mirar si la app valida 6 en el formulario.
2. **Captcha en altas anónimas** (Auth → Attack Protection → «Enable Captcha protection», hoy desactivado; el propio dashboard lo recomienda para altas anónimas): **no activar todavía**. Con captcha el cliente tiene que mandar `captchaToken` en `signInAnonymously()`; sin ese cambio, nadie podría entrar. Es trabajo de código (hCaptcha o Turnstile en un WebView) que decide el usuario si compensa. Mientras, el límite por IP sigue siendo el freno.
3. Revisar en el dashboard: Redirect URLs exactas, «Only private channels» en Realtime, y SMTP propio (el límite de correo por defecto es ~2/hora).

## Sin revisar todavía

- Deep link `cofounder://auth/callback`: `completeAuthLink` leído solo parcialmente. El esquema propio es secuestrable en Android; PKCE mitiga.
- URLs del perfil (`link_github`, portfolio): comprobar que no se abran con esquemas peligrosos.
- Manifest Android tras `prebuild`: `allowBackup`, componentes exportados, `SCHEDULE_EXACT_ALARM`.
- WebRTC con solo STUN: expone la IP de la otra persona; decisión de producto.
- Logs con datos personales.
