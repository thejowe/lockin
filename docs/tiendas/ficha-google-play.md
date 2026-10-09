# LockIn — ficha de Google Play (español)

Preparada el 9 de octubre de 2026 sobre `0cddbbbae3a894c64e2be04f2c74c081602db8e6`. Copiar únicamente el contenido de cada campo, no las notas de preparación.

## Nombre

LockIn

## Subtítulo editorial

Cofundador o compañero de foco

Google Play no ofrece un campo de subtítulo equivalente al de Apple. Se conserva aquí como referencia de mensaje; el campo que se envía es la descripción breve.

## Descripción corta / breve

Encuentra cofundador o compañero de foco. Haz match y trabaja con Pomodoro.

## Descripción larga / completa

Encuentra con quién empezar a construir o con quién concentrarte.

LockIn conecta a personas que buscan un cofundador o un compañero de trabajo concentrado. Puedes estar sin idea, tener una idea sin empezar o haber probado algo pequeño. La relación es entre pares: ambos aportáis y decidís juntos.

ELIGE TU MODO

Par: descubre personas por sus especialidades y lo que buscan complementar. Cuenta qué dominas, qué quieres construir, tu disponibilidad y tu nivel de compromiso.

Lock-In: encuentra compañía para trabajar al mismo tiempo, aunque cada uno esté en lo suyo. También puedes elegir ambos modos.

DESLIZA Y CONVERSA

Explora perfiles con nombre, edad, zona, disponibilidad y respuestas breves. Indica si te interesa una persona. Cuando el interés es recíproco, hacéis match y podéis hablar por chat.

ORGANIZA SESIONES DE ENFOQUE

Propón una fecha y una duración de 1, 2 o 4 bloques. Cada bloque combina 25 minutos de trabajo y 5 de descanso. La otra persona acepta o rechaza la propuesta.

Comparte el temporizador y ve si tu compañero está presente. En las sesiones individuales puedes usar una videollamada con permisos de cámara y micrófono. Activa los avisos locales para recibir un recordatorio cinco minutos antes.

Al terminar una sesión compartida, puedes valorarla con un toque. Tu valoración es privada. Las rachas compartidas te ayudan a ver la continuidad de vuestras sesiones.

TRABAJA EN GRUPO

Convoca una sala con 2–4 de tus matches, hasta reunir 3–5 personas. Cada invitado decide si se une. Las salas comparten Pomodoro y presencia, sin vídeo ni chat de grupo.

ABRE LAS CONVERSACIONES DIFÍCILES

En tus matches Par, responde por separado a temas sobre dedicación, reparto y salida. Ves la respuesta de la otra persona a un tema después de dar la tuya. Es una conversación guiada; no genera un contrato ni sustituye el asesoramiento legal.

TU PERFIL, A TU MANERA

Añade enlaces a GitHub, portfolio o LinkedIn. Puedes verificar que tu enlace de GitHub pertenece a tu cuenta. El sello verifica la autoría de ese enlace.

Empieza con lo que tienes y encuentra con quién dar el siguiente paso.

## Palabras clave editoriales

cofundador, compañero de enfoque, coworking, Pomodoro, proyectos, colaboración, productividad.

Google Play no tiene un campo separado de keywords equivalente al de Apple. Usarlas de forma natural en la ficha; no añadir un bloque de palabras repetidas a la descripción.

## Categoría

Tipo: **Aplicación**. Propuesta editorial de categoría: **Social**, por descubrimiento de personas, matches, conversaciones e invitaciones. **[PENDIENTE DE DECISIÓN] D07:** confirmar categoría y etiquetas en Play Console. El repo no las decide.

## Clasificación de edad y público objetivo

**[PENDIENTE DE DECISIÓN] D06:** completar el cuestionario IARC, confirmar los resultados por región y elegir el público objetivo de Play Console y la edad mínima de uso. No afirmar PEGI 16, ESRB Teen o «18+» sin los resultados y decisiones correspondientes.

El formulario admite edad declarada desde 16; SQL admite 16–120. No existe verificación real de edad ni una política de menores configurada. La edad de uso del producto, el público objetivo y el resultado IARC son campos distintos.

Para preparar el cuestionario, declarar interacción entre usuarios, contenido generado por usuarios y chat. Hay perfiles y notas de texto libre, mensajes 1:1 y videollamada individual. No se han encontrado apuestas, concursos, compras, anuncios integrados ni contenido adulto diseñado por la app. La ausencia de moderación impide garantizar qué escribirán o mostrarán otros usuarios.

Fuente para los campos de clasificación, público y privacidad: [preparar una app para revisión](https://support.google.com/googleplay/android-developer/answer/9859455?hl=es). La calificación final puede variar por territorio; no trasladar sin más una cifra de App Store. Si se publica en la categoría Social, completar también las [normas de seguridad infantil de Google](https://support.google.com/googleplay/android-developer/answer/14747720?hl=en), incluido contacto y normas públicas; D02/D06/D08/D11 pendientes.

## Límites y datos administrativos

| Campo | Texto preparado | Límite |
| --- | --- | --- |
| Nombre | 6 caracteres | 30 caracteres |
| Descripción breve | 75 caracteres | 80 caracteres |
| Descripción completa | 2118 caracteres, incluidos saltos de línea | 4000 caracteres |

Fuente: [crear y configurar una aplicación](https://support.google.com/googleplay/android-developer/answer/9859152?hl=es). Package Android del repo: `app.lockin.mobile`; versión app.json: `1.0.0`.

- **[PENDIENTE DE DECISIÓN] D01:** identidad legal del editor y domicilio.
- **[PENDIENTE DE DECISIÓN] D02:** correo de soporte obligatorio y contacto de privacidad.
- **[PENDIENTE DE DECISIÓN] D08:** URL de privacidad, soporte y solicitud de eliminación de cuenta.
- **[PENDIENTE DE DECISIÓN] D09:** revisar el AAB/APK final, permisos generados, WebRTC y configuración de backend.

## Evidencia y preparación de publicación

Las funciones proceden del [modelo de datos](../../src/data/types.ts) y de las implementaciones de [descubrimiento](../../src/features/discover/), [chat](../../src/features/chat/), [sesiones](../../src/features/session/), [acuerdo](../../src/features/agreement/) y [salas](../../src/features/room/). La verificación de GitHub solo prueba autoría del enlace. Las salas son de 3–5 personas con reloj/presencia, sin vídeo ni chat grupal.

No se han inventado precio, ofertas premium, funciones de contratación, contratos, moderación, perfiles privados o garantías de compatibilidad. El vídeo requiere la build nativa y permisos; el código no demuestra por sí solo la conexión entre dos teléfonos físicos.

Preparar las respuestas de [Data safety](cuestionario-privacidad.md#google-play--data-safety--seguridad-de-los-datos), los datos de acceso para revisión y los requisitos de [baja, bloqueo y reporte](cuestionario-privacidad.md#lo-que-applegoogle-exigirán-y-la-app-aún-no-tiene). No declarar esas funciones como terminadas.
