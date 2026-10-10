# cofounder — ficha de App Store (español)

Preparada el 9 de octubre de 2026 sobre `0cddbbbae3a894c64e2be04f2c74c081602db8e6`. Los textos de los bloques siguientes son para copiar en los campos de la consola; las notas de preparación no forman parte de la descripción.

## Nombre

cofounder

## Subtítulo

Cofundador o compañero de foco

## Descripción corta / texto promocional

Encuentra un cofundador o compañero de enfoque. Haz match, conversa y organiza sesiones con Pomodoro para avanzar juntos.

Apple no tiene el mismo campo «descripción corta» que Google Play. Este texto se puede usar como texto promocional opcional.

## Descripción larga

Encuentra con quién empezar a construir o con quién concentrarte.

cofounder conecta a personas que buscan un cofundador o un compañero de trabajo concentrado. Puedes estar sin idea, tener una idea sin empezar o haber probado algo pequeño. La relación es entre pares: ambos aportáis y decidís juntos.

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

## Palabras clave

socios,emprender,colaborar,coworking,pomodoro,proyectos,productividad,equipo,concentracion

## Categoría

Categoría decidida (D07): **Redes sociales (Social Networking)** como principal y **Productividad** como secundaria.

## Clasificación de edad

Decisión D06: edad mínima 16. Completar el cuestionario de App Store Connect declarando contenido generado por usuarios (chat y perfiles) con filtros de reporte y bloqueo; revisar el resultado por territorio antes de enviar.

El código admite edades declaradas desde 16 años (formulario 16–99; SQL 16–120). No hay verificación documental, controles parentales ni un bloqueo de uso para mayores de 18. Si la clasificación calculada fuera inferior a la edad mínima de uso finalmente elegida, revisar la opción de aumentar la clasificación. No reducir una clasificación superior calculada por Apple.

Datos para contestar el cuestionario:

| Capacidad | Lo que implementa esta versión |
| --- | --- |
| Contenido generado por usuarios | Sí: perfil, prompts, mensajes y notas del acuerdo |
| Mensajería / chat | Sí, 1:1 después de match recíproco |
| Funciones sociales | Sí: perfiles, matches, invitaciones y salas |
| Publicidad / compras / apuestas | No se han encontrado SDK publicitario, cobros, apuestas o concursos en código |
| Controles parentales / verificación de edad | No encontrados; edad autodeclarada |
| Acceso web sin restricciones dentro de la app | Los enlaces externos se abren con Linking/navegador; no se ha encontrado un navegador general propio. Revisar cómo pregunta la consola sobre esta capacidad |
| Contenido adulto/violento diseñado por la app | No se ha encontrado; los textos libres de usuarios no están moderados, por lo que no se garantiza ausencia de ese contenido |

La escala actual incluye 4+, 9+, 13+, 16+ y 18+ en las plataformas recientes, con posibles diferencias regionales y versiones anteriores. No usar una cifra de otra plataforma como si fuera una clasificación ya emitida. Fuentes: [definiciones de edad](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/) y [cómo completar y elevar la clasificación](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/).

## Límites y datos administrativos

| Campo | Texto preparado | Límite |
| --- | --- | --- |
| Nombre | 6 caracteres | 30 caracteres |
| Subtítulo | 30 caracteres | 30 caracteres |
| Texto promocional | 121 caracteres | 170 caracteres |
| Descripción | 2118 caracteres, incluidos saltos de línea | 4000 caracteres |
| Palabras clave | 90 bytes UTF-8; texto ASCII | 100 bytes |

Fuentes: [información de la app](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/) y [campos de la versión](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/). Bundle ID del repo: `app.cofounder.mobile`; versión configurada: `1.0.0`; nombre técnico en app.json: `lockin`.

- **D01 decidido:** Joel de Torres Sainz de la Maza, carrer Nou, 37, 25153 Lleida (España); copyright © 2026 Joel de Torres Sainz de la Maza.
- **D02 decidido:** soporte y privacidad en joeldetorres123@gmail.com.
- **D08 decidido:** soporte https://thejowe.github.io/lockin/soporte y privacidad https://thejowe.github.io/lockin/privacidad (páginas por crear).
- **D09:** validar una build nativa real con WebRTC y cámara en dispositivo antes de usar la descripción de videollamada; la cámara real sigue sin comprobar (`todo/video.md`).

## Evidencia y preparación de revisión

Funciones descritas presentes en [tipos](../../src/data/types.ts), [perfil](../../src/features/profile/), [descubrimiento](../../src/features/discover/), [chat](../../src/features/chat/), [sesiones](../../src/features/session/), [acuerdo](../../src/features/agreement/) y [salas](../../src/features/room/). Las fases futuras del concepto no se presentan como implementadas: el código actual ya incluye sesiones, acuerdo y salas, pero no incluye Modo Talento o premium.

No se ha supuesto precio, «gratis para siempre», contratación, garantía de compatibilidad, identidad legal verificada ni contratos firmados. La llamada está implementada para la app nativa; no se da por probada una llamada en dos móviles por haber leído el código. Las salas no tienen vídeo.

Preparar acceso para revisión y demostrar funcionalidades en la build enviada. Consultar [Lo que Apple/Google exigirán y la app aún no tiene](cuestionario-privacidad.md#lo-que-applegoogle-exigirán-y-la-app-aún-no-tiene), en especial baja de cuenta y bloqueo/reporte/moderación. Esta ficha no afirma que esas funciones ya existan.
