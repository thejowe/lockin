# cofounder — ficha de Google Play (español)

Revisada el 14 de octubre de 2026 tras el pivote del 12-oct-2026. Copiar únicamente el contenido de cada campo.

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

Público objetivo: 16–17 y 18+ (D06). En el cuestionario IARC declarar interacción entre usuarios, contenido generado por usuarios, intercambio de fotos (foto de perfil) y chat. No declarar vídeo ni voz si el código de videollamada se retira del binario. No afirmar una calificación concreta antes del resultado oficial.

## Data safety, eliminación de cuenta y permisos

- Respuestas de Data safety: ver `cuestionario-privacidad.md`.
- Eliminación de cuenta: en la app (Perfil > Cuenta > Eliminar mi cuenta) y URL web https://thejowe.github.io/lockin/eliminar-cuenta (obligatoria y funcionando; explica cómo pedirla por correo sin la app).
- Seguridad infantil (categoría Social): URL de los estándares https://thejowe.github.io/lockin/seguridad-infantil; contacto designado cofounder.soporte@gmail.com.
- Permisos: con Lock-In oculto, **retirar** `RECORD_AUDIO` y `SCHEDULE_EXACT_ALARM` (y el plugin WebRTC) de app.json salvo que alguna función visible los use. Si se mantiene `SCHEDULE_EXACT_ALARM`, Play Console exige justificarlo y ya no hay función visible que lo justifique.

## Límites

| Campo | Texto | Límite |
| --- | --- | --- |
| Nombre | 9 caracteres | 30 |
| Descripción breve | 78 caracteres | 80 |
| Descripción completa | 1770 caracteres | 4000 |

Package: `app.cofounder.mobile`; versión 1.0.0. Como persona física publicando en la UE, Play mostrará nombre y dirección del editor (estado de «trader», DSA).

## Comprobaciones previas al envío (no copiar en la consola)

- **Bloquear/reportar y «Eliminar mi cuenta»:** comprobados en el código (`block_profile`, `report_profile`, panel de seguridad en deck y chat, `delete_my_account`) y dados por aplicados en producción el 10-oct-2026 (D09). Probarlos en la build final contra Supabase real. Reportar es de **perfiles**; reportar un mensaje concreto aún no existe (T3b).
- **Aceptación de términos:** hoy la app no la pide. Apple 1.2 y la política UGC de Google la esperan: no enviar sin ella (T3a).
- **Funciones ocultas (Lock-In):** sesiones, salas, vídeo, rachas, Pomodoro y acuerdo siguen en el código pero no en la UI (pivote del 12-oct-2026). No deben aparecer en la ficha, capturas ni vídeo de vista previa. Si el código sigue en el binario, conviene retirarlo o desactivarlo de verdad: las funciones ocultas o inactivas son motivo de rechazo en Apple (2.3.1) y las dependencias nativas que dejan (WebRTC, cámara/micrófono, alarmas exactas) generan permisos que hay que justificar. Ver INFORME.md.
- **Capturas:** solo pantallas actuales (perfil, deck a pantalla completa, match, chat con sugerencias, GitHub verificado, bloqueo). Ninguna con temporizador, salas, vídeo o rachas.
- **Cuenta de revisión:** preparar una cuenta de prueba con perfil completo y al menos un match con chat para que la revisión pueda ver las funciones.
- **URLs públicas (D08):** privacidad, términos, normas, seguridad infantil, soporte y eliminar cuenta en https://thejowe.github.io/lockin/… (`/privacidad`, `/terminos`, `/normas`, `/seguridad-infantil`, `/soporte`, `/eliminar-cuenta`) deben estar publicadas y funcionando antes de enviar.
- Responsable (D01): Joel de Torres Sainz de la Maza, carrer Nou, 37, 25153 Lleida (España). Contacto (D02): cofounder.soporte@gmail.com.
