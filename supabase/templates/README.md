# Plantillas de correo de Supabase Auth

Copia de las plantillas del proyecto de producción (`grrzmzktrhksbttpbblg`). No hay
`config.toml`: **se aplican a mano** en el panel, en Authentication → Emails → Templates,
pegando el asunto y el HTML («Source»). Si cambias una aquí, cámbiala allí, y al revés.

| Archivo | Plantilla del panel | Asunto | ¿La usa la app? | En producción |
|---|---|---|---|---|
| `confirmation.html` | Confirm sign up | Confirma tu correo en cofounder | Alta con correo | Aplicada 2026-10-22 |
| `email_change.html` | Change email address | Confirma tu correo en cofounder | Sí: vincular correo a la cuenta anónima (`linkEmailToCurrentUser`) | Aplicada 2026-10-23 |
| `recovery.html` | Reset password | Restablece tu contraseña de cofounder | Sí: `sendPasswordReset` | Aplicada 2026-10-23 |
| `magic_link.html` | Magic link or OTP | Tu enlace para entrar en cofounder | No | Pendiente |
| `invite.html` | Invite user | Te han invitado a cofounder | No | Pendiente |
| `reauthentication.html` | Reauthentication | Tu código de cofounder | No | Pendiente |

**Idiomas (2026-11-02), SIN APLICAR en producción.** `confirmation`, `email_change` y `recovery` eligen
español, inglés o catalán según `.Data.locale`, que la app guarda en los metadatos al dar de alta o
vincular el correo. Sin ese dato salen en español, también para las cuentas que ya existen. No se han
probado contra GoTrue: antes de pegarlas en producción, comprobar con una cuenta de prueba que el correo
llega sin metadatos y con cada idioma, porque un fallo de plantilla deja a la gente sin poder confirmar.
Asuntos: «Confirm your email for cofounder» / «Confirma el teu correu a cofounder»; «Reset your password»
/ «Restableix la teva contrasenya». El asunto admite las mismas condiciones que el cuerpo.

Todas las que llevan enlace usan `{{ .ConfirmationURL }}`: lleva el
`redirect_to=cofounder://auth/callback` y el `code` PKCE que espera `completeAuthLink`
(`src/data/supabase/auth.ts`). No cambiarlo por `{{ .TokenHash }}` sin revisar esa función.
