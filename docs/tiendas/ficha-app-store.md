# cofounder — ficha de App Store (español)

Revisada el 15 de octubre de 2026 contra el binario final tras T5 (solo búsqueda de cofundador; Lock-In fuera del binario). Copiar únicamente el contenido de cada campo.

## Nombre

cofounder

## Subtítulo

Encuentra con quién fundar

## Texto promocional

Desliza perfiles de personas que quieren empezar algo, haz match cuando el interés es mutuo y conversa para ver si encajáis como cofundadores.

## Descripción

¿Tienes ganas de construir algo y te falta con quién? cofounder te ayuda a encontrar cofundador o cofundadora entre personas que están en un punto parecido al tuyo.

No hace falta tener nada construido. Puedes no tener idea todavía, tener una idea sin empezar o haber probado algo pequeño. Aquí nadie contrata a nadie: la relación es entre pares, y ambos aportáis y decidís juntos.

TU PERFIL
Cuenta quién eres y qué aportas: nombre, edad, ubicación y zona horaria, especialidades, punto de partida, disponibilidad y nivel de ambición. Responde a una o dos preguntas breves para que se note cómo piensas, no solo lo que sabes hacer. Si quieres, añade enlaces a GitHub, portfolio o LinkedIn.

También puedes añadir una foto. Es opcional y solo se publica después de pasar una revisión automática de seguridad.

DESLIZA
Los perfiles aparecen a pantalla completa, uno a uno. Desliza para indicar que te interesa una persona o para pasar a la siguiente.

MATCH Y CHAT
Cuando el interés es mutuo, hacéis match y se abre un chat privado entre los dos. Para romper el hielo, la app te sugiere algunas preguntas con las que empezar.

GITHUB VERIFICADO
Puedes vincular tu cuenta de GitHub para mostrar «GitHub verificado» en tu perfil. Indica que el enlace de GitHub pertenece a quien lo publica; no verifica la identidad de la persona ni sus conocimientos.

SEGURIDAD Y CONTROL
Puedes bloquear o reportar a cualquier persona desde la app. Puedes eliminar tu cuenta y tus datos cuando quieras desde Perfil > Cuenta.

LO QUE NO ES
cofounder no es una app de citas ni una bolsa de empleo. No ofrece asesoramiento legal ni financiación, ni garantiza resultados: te ayuda a conocer a personas con las que construir; lo que hagáis depende de vosotros.

Para personas de 16 años o más.

## Palabras clave

socio,emprender,startup,emprendedor,cofundadora,proyecto,equipo,idea,negocio,colaborar,github,pares

## URLs

- Política de privacidad: https://thejowe.github.io/lockin/privacidad
- Soporte: https://thejowe.github.io/lockin/soporte
- Términos de uso (EULA): https://thejowe.github.io/lockin/terminos
- Normas de la comunidad: https://thejowe.github.io/lockin/normas

## Categoría

Principal: **Redes sociales (Social Networking)** (D07). Secundaria: **Negocios (Business)** (decidido el 16-oct-2026; Productividad dejó de estar justificada al sacar Lock-In).

## Clasificación de edad

Edad mínima de uso: 16 años (D06), autodeclarada. En el cuestionario de App Store Connect declarar: contenido generado por usuarios (perfiles, fotos, respuestas y chat 1:1), mensajería entre usuarios, sin publicidad, compras, apuestas ni acceso web sin restricciones. No reducir la clasificación que calcule Apple; si es inferior a 16, elevarla.

| Capacidad | Esta versión |
| --- | --- |
| Contenido generado por usuarios | Sí: perfil, foto opcional (moderada antes de publicarse), respuestas breves y mensajes |
| Mensajería / chat | Sí, 1:1 tras match mutuo |
| Bloquear / reportar | Sí: perfiles y mensajes concretos (confirmar en la build) |
| Filtro de contenido | Sí: filtro básico de texto en perfil y chat, más moderación de fotos |
| Aceptación de Términos y Normas | Sí, obligatoria antes de publicar |
| Publicidad / compras / apuestas | No |
| Controles parentales / verificación de edad | No; edad autodeclarada |

## Límites

| Campo | Texto | Límite |
| --- | --- | --- |
| Nombre | 9 caracteres | 30 |
| Subtítulo | 26 caracteres | 30 |
| Texto promocional | 142 caracteres | 170 |
| Descripción | 1770 caracteres | 4000 |
| Palabras clave | 99 bytes | 100 |

Las palabras clave no repiten el nombre ni la categoría (Apple ya los indexa) y no usan nombres de terceros salvo «github», que describe una función real (GitHub verificado). Bundle ID: `app.cofounder.mobile`; versión 1.0.0.

## Notas para la revisión (App Review Notes)

Texto para pegar en App Store Connect (en inglés, el revisor lo lee en ese idioma):

```
cofounder is a peer-to-peer app for finding a startup co-founder. Users create a
profile, swipe through other profiles, and chat 1:1 after a mutual match.

HOW TO TEST
1. Sign in with the demo account below (or create an account; email is optional).
2. Accept the Terms of Use and Community Guidelines when prompted.
3. Open the Discover tab to see profiles, swipe to like/pass; the demo account
   already has a match with a chat in the Matches tab.
4. Profile > Account: Delete my account (in-app account deletion, Guideline 5.1.1(v)).

DEMO ACCOUNT
[cuenta de prueba: pendiente]

USER-GENERATED CONTENT (Guideline 1.2)
- Terms and Community Guidelines must be accepted (versioned, with date) before
  publishing content or chatting; links to them are in Profile.
- Report: any profile (Discover/chat safety panel) and any individual message
  (message report panel in the chat). Reports go to a private table reviewed
  by the operator; target response time is 24 h for severe content and 72 h otherwise.
- Block: any user, from Discover or chat; blocking is mutual and immediate.
- Filter: a basic objectionable-text filter (insults, threats, explicit sexual
  content; Spanish and English) blocks submission of profile text and messages;
  profile photos are moderated server-side with OpenAI's moderation API and are
  only published after approval (fail-closed).
- Account deletion: Profile > Account > Delete my account removes profile,
  matches, messages and photo.
- Contact: cofounder.soporte@gmail.com. Child-safety standards:
  https://thejowe.github.io/lockin/seguridad-infantil

PERMISSIONS
- Camera / photo library: only to take or choose the optional profile photo.
  No microphone, no location, no contacts, no push notifications, no tracking.
- Encryption: standard HTTPS/TLS only (ITSAppUsesNonExemptEncryption = false).
- Sign in with GitHub is optional and only used to show a "GitHub verified"
  badge. The app also supports email/password and anonymous accounts, so GitHub
  is not the only login option.

AGE
Minimum age 16, self-declared.
```

`[cuenta de prueba: pendiente]` es un marcador: no inventar credenciales. Antes de enviar, crear la cuenta en producción con perfil completo y un match con chat, y rellenar el bloque. Las migraciones de aceptación y reporte de mensajes ya están aplicadas (16-oct); aun así, no enviar sin haber probado esas dos funciones contra Supabase real (T7).

## Comprobaciones previas al envío (no copiar en la consola)

- **Binario final (T5, `cf18086`):** sin Lock-In, WebRTC, `expo-notifications`, `RECORD_AUDIO` ni `SCHEDULE_EXACT_ALARM`; solo `CAMERA` y galería para la foto de perfil, `expo-secure-store` y `ITSAppUsesNonExemptEncryption=false`. Falta mirar el manifiesto del AAB y el Info.plist generado (T7).
- **Bloquear, reportar perfiles y mensajes, aceptación de Términos y Normas, filtro, baja de cuenta:** implementados en el código (T3a, T3b). Las migraciones `20261014120000` (aceptación), `20261014130000` (reportar mensaje) y `20261014140000` (limpieza de fotos) están aplicadas en producción desde el 16-oct-2026. Falta probarlo todo contra Supabase real en la build final (T7).
- **Capturas:** solo pantallas actuales (perfil, deck a pantalla completa, match, chat con sugerencias, GitHub verificado, bloqueo/reporte). Ninguna con temporizador, salas, vídeo o rachas (ya no existen en la app).
- **Cuenta de revisión:** [cuenta de prueba: pendiente] con perfil completo y al menos un match con chat para que la revisión vea las funciones.
- **URLs públicas (D08):** privacidad, términos, normas, seguridad infantil, soporte y eliminar cuenta en https://thejowe.github.io/lockin/… (`/privacidad`, `/terminos`, `/normas`, `/seguridad-infantil`, `/soporte`, `/eliminar-cuenta`) deben estar publicadas y funcionando antes de enviar [pendiente: fecha de publicación; no empujar `web/**` hasta cerrar marcadores].
- Responsable (D01): Joel de Torres Sainz de la Maza, carrer Nou, 37, 25153 Lleida (España). DSA (Business → Compliance): **no trader** (decidido el 16-oct-2026: app gratuita, sin anuncios, compras ni ingresos); revisarlo si se monetiza. Contacto (D02): cofounder.soporte@gmail.com.
