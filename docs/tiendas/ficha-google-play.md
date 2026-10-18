# cofounder — ficha de Google Play (español)

Revisada el 15 de octubre de 2026 contra el binario final tras T5 (Lock-In fuera del binario). Copiar únicamente el contenido de cada campo.

## Nombre de la aplicación

cofounder

## Descripción breve

Encuentra cofundador: desliza perfiles, haz match y conversa de igual a igual.

## Descripción completa

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

Google Play no tiene campo de keywords. La descripción ya incluye de forma natural «cofundador», «emprender», «pares», «GitHub». No añadir bloques de palabras repetidas (política de metadatos).

## Categoría

Tipo: **Aplicación**. Categoría: **Social** (D07). Implica cumplir las normas de seguridad infantil de Google (normas públicas, mecanismo de aviso, contacto designado: D11).

## Clasificación de contenido y público objetivo

Público objetivo: 16–17 y 18+ (D06). En el cuestionario IARC declarar interacción entre usuarios, contenido generado por usuarios, intercambio de fotos (foto de perfil) y chat. No declarar vídeo ni voz: el código de videollamada ya no está en el binario (T5). No afirmar una calificación concreta antes del resultado oficial.

## Data safety, eliminación de cuenta y permisos

- Respuestas de Data safety: ver `cuestionario-privacidad.md`.
- Eliminación de cuenta: en la app (Perfil > Cuenta > Eliminar mi cuenta) y URL web https://thejowe.github.io/cofounder-web/eliminar-cuenta (obligatoria y funcionando; explica cómo pedirla por correo sin la app).
- Seguridad infantil (categoría Social): URL de los estándares https://thejowe.github.io/cofounder-web/seguridad-infantil; contacto designado cofounder.soporte@gmail.com.
- Permisos (binario final, T5): solo `CAMERA` declarado por la app, para la foto de perfil; la galería usa el selector del sistema. Sin `RECORD_AUDIO`, `SCHEDULE_EXACT_ALARM` ni notificaciones: no hay permisos sensibles que justificar. Confirmar en el manifiesto del AAB que ninguna librería añade otros (T7).
- Políticas UGC de Google: Términos y Normas aceptados antes de publicar; reporte de perfiles y mensajes; bloqueo; filtro básico de texto y moderación de fotos; revisión de reportes (24 h / 72 h). Migraciones aplicadas en producción el 16-oct-2026; falta probarlo contra Supabase real (T7).
- Declaración de trader (DSA): **no trader** (decidido el 16-oct-2026: app gratuita, sin anuncios, compras ni ingresos); revisarlo si se monetiza.
- Cuenta de prueba por si Play pide acceso: [cuenta de prueba: pendiente].

## Límites

| Campo | Texto | Límite |
| --- | --- | --- |
| Nombre | 9 caracteres | 30 |
| Descripción breve | 78 caracteres | 80 |
| Descripción completa | 1770 caracteres | 4000 |

Package: `app.cofounder.mobile`; versión 1.0.0. Cuenta personal declarada no trader (DSA) y sin monetización: Play muestra el nombre del desarrollador y el país, no la dirección.

## Comprobaciones previas al envío (no copiar en la consola)

- **Binario final (T5, `cf18086`):** sin Lock-In, WebRTC, `expo-notifications`, `RECORD_AUDIO` ni `SCHEDULE_EXACT_ALARM`; solo `CAMERA` y galería para la foto de perfil, `expo-secure-store` y `ITSAppUsesNonExemptEncryption=false`. Falta mirar el manifiesto del AAB y el Info.plist generado (T7).
- **Bloquear, reportar perfiles y mensajes, aceptación de Términos y Normas, filtro, baja de cuenta:** implementados en el código (T3a, T3b). Las migraciones `20261014120000` (aceptación), `20261014130000` (reportar mensaje) y `20261014140000` (limpieza de fotos) están aplicadas en producción desde el 16-oct-2026. Falta probarlo contra Supabase real en la build final (T7).
- **Capturas:** solo pantallas actuales (perfil, deck a pantalla completa, match, chat con sugerencias, GitHub verificado, bloqueo/reporte). Ninguna con temporizador, salas, vídeo o rachas (ya no existen en la app).
- **Cuenta de revisión:** [cuenta de prueba: pendiente] con perfil completo y al menos un match con chat para que la revisión vea las funciones.
- **URLs públicas (D08):** privacidad, términos, normas, seguridad infantil, soporte y eliminar cuenta en https://thejowe.github.io/cofounder-web/… (`/privacidad`, `/terminos`, `/normas`, `/seguridad-infantil`, `/soporte`, `/eliminar-cuenta`) deben estar publicadas y funcionando antes de enviar [pendiente: fecha de publicación; no empujar `web/**` hasta cerrar marcadores].
- Responsable (D01): Joel de Torres Sainz de la Maza, carrer Nou, 37, 25153 Lleida (España). DSA: no trader. Contacto (D02): cofounder.soporte@gmail.com.
