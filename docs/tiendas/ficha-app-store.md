# cofounder — ficha de App Store (español)

Revisada el 14 de octubre de 2026 tras el pivote del 12-oct-2026 (solo búsqueda de cofundador). Copiar únicamente el contenido de cada campo.

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

Principal: **Redes sociales (Social Networking)** (D07). Secundaria: Productividad estaba justificada por las sesiones Lock-In, ya ocultas; valorar **Negocios** o dejarla vacía (pregunta abierta, ver INFORME.md).

## Clasificación de edad

Edad mínima de uso: 16 años (D06), autodeclarada. En el cuestionario de App Store Connect declarar: contenido generado por usuarios (perfiles, fotos, respuestas y chat 1:1), mensajería entre usuarios, sin publicidad, compras, apuestas ni acceso web sin restricciones. No reducir la clasificación que calcule Apple; si es inferior a 16, elevarla.

| Capacidad | Esta versión |
| --- | --- |
| Contenido generado por usuarios | Sí: perfil, foto opcional (moderada antes de publicarse), respuestas breves y mensajes |
| Mensajería / chat | Sí, 1:1 tras match mutuo |
| Bloquear / reportar | Sí, según D09/D11 (confirmar en la build) |
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

Propuesta de texto: «cofounder sirve para encontrar cofundador entre pares. Funciones: perfil, deck de perfiles, match mutuo, chat 1:1 con preguntas sugeridas, bloqueo y reporte de usuarios, verificación de GitHub y eliminación de cuenta en Perfil > Cuenta. Las fotos de perfil se revisan automáticamente antes de publicarse. Cuenta de prueba: [usuario/contraseña].»

## Comprobaciones previas al envío (no copiar en la consola)

- **Bloquear/reportar y «Eliminar mi cuenta»:** comprobados en el código (`block_profile`, `report_profile`, panel de seguridad en deck y chat, `delete_my_account`) y dados por aplicados en producción el 10-oct-2026 (D09). Probarlos en la build final contra Supabase real. Reportar es de **perfiles**; reportar un mensaje concreto aún no existe (T3b).
- **Aceptación de términos:** hoy la app no la pide. Apple 1.2 y la política UGC de Google la esperan: no enviar sin ella (T3a).
- **Funciones ocultas (Lock-In):** sesiones, salas, vídeo, rachas, Pomodoro y acuerdo siguen en el código pero no en la UI (pivote del 12-oct-2026). No deben aparecer en la ficha, capturas ni vídeo de vista previa. Si el código sigue en el binario, conviene retirarlo o desactivarlo de verdad: las funciones ocultas o inactivas son motivo de rechazo en Apple (2.3.1) y las dependencias nativas que dejan (WebRTC, cámara/micrófono, alarmas exactas) generan permisos que hay que justificar. Ver INFORME.md.
- **Capturas:** solo pantallas actuales (perfil, deck a pantalla completa, match, chat con sugerencias, GitHub verificado, bloqueo). Ninguna con temporizador, salas, vídeo o rachas.
- **Cuenta de revisión:** preparar una cuenta de prueba con perfil completo y al menos un match con chat para que la revisión pueda ver las funciones.
- **URLs públicas (D08):** privacidad, términos, normas, seguridad infantil, soporte y eliminar cuenta en https://thejowe.github.io/lockin/… (`/privacidad`, `/terminos`, `/normas`, `/seguridad-infantil`, `/soporte`, `/eliminar-cuenta`) deben estar publicadas y funcionando antes de enviar.
- Responsable (D01): Joel de Torres Sainz de la Maza, carrer Nou, 37, 25153 Lleida (España). Contacto (D02): cofounder.soporte@gmail.com.
