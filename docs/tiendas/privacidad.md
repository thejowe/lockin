# Política de privacidad de cofounder

> Texto para publicación, completado el 10 de octubre de 2026 con las decisiones D01–D12 del responsable (ver [el inventario](datos-recopilados.md#decisiones-pendientes-compartidas-por-los-cinco-documentos)). Antes de publicarlo en la URL pública, revisar la nota final.

**Entrada en vigor:** 10 de octubre de 2026.

## 1. Quién es responsable de tus datos

cofounder permite encontrar un cofundador en modo Par o una persona con quien trabajar concentrado en modo Lock-In.

El responsable del tratamiento es **Joel de Torres Sainz de la Maza**, con domicilio en carrer Nou, 37, 25153 (Lleida, Catalunya, España). Puedes contactar para cuestiones de privacidad o soporte en **cofounder.soporte@gmail.com**.

Publicamos la app en España y el resto del Espacio Económico Europeo. Se aplican el Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 (LOPDGDD). La autoridad de control competente es la Agencia Española de Protección de Datos ([aepd.es](https://www.aepd.es)); en Catalunya también puedes acudir a la Autoritat Catalana de Protecció de Dades.

## 2. Qué datos tratamos

### Tu cuenta

La app puede crear una cuenta sin pedirte un correo. Aunque el acceso se denomine anónimo, se asigna un identificador de cuenta que vincula tu perfil y tu actividad.

Puedes añadir un email, confirmarlo y establecer una contraseña para recuperar la cuenta desde otro dispositivo. También existen alta y acceso por email. El email y las credenciales se usan con el servicio de autenticación; el email no forma parte del perfil que mostramos a otras personas.

Si eliges verificar tu enlace de GitHub, se vincula una identidad de GitHub y se publica el nombre de esa cuenta y la fecha de verificación. El sello acredita la autoría del enlace; no acredita tu identidad legal ni tus conocimientos. La autenticación puede recibir otros metadatos de GitHub, según la configuración del proveedor.

### Tu perfil

Guardamos el nombre y la edad que indicas, tu ciudad o zona y zona horaria, iniciales y color del avatar, especialidades que dominas y buscas, qué tipo de compañero buscas, punto de partida de tu proyecto, disponibilidad semanal y franjas horarias, ambición, enlaces opcionales a GitHub, portfolio y LinkedIn, y respuestas breves a preguntas de perfil. Guardamos también las fechas de creación y modificación.

La ubicación se introduce como texto. Esta versión no obtiene tu posición mediante GPS. El avatar usa iniciales y un color; no se sube una fotografía de perfil.

### Tu actividad y conversaciones

Guardamos el modo de navegación elegido, tus decisiones de swipe, los matches recíprocos y los mensajes de texto, con sus participantes y fechas.

En las sesiones individuales de trabajo guardamos quién propone, fecha y hora, duración, respuesta o cancelación y registros de entrada y salida. Si valoras una sesión, guardamos la valoración y su fecha. Las rachas de pareja se calculan a partir de sesiones y asistencia; no son una puntuación pública.

En modo Par puedes responder a temas de una conversación guiada sobre compromiso, reparto y salida. Guardamos el tema, la opción, una nota opcional y la última modificación. No se firma ni genera un contrato.

En las salas grupales guardamos quién convoca, horario, duración, cancelación, invitaciones, respuestas y asistencia. Las salas son de 3–5 personas y no incluyen vídeo ni chat grupal.

### Videollamada y presencia

Si usas vídeo en una sesión individual, la cámara y el micrófono transmiten imagen y voz a la otra persona mediante WebRTC. La app no implementa grabación ni conserva archivos de esa llamada en su base de datos. Esto no impide que el receptor pueda capturar el contenido por otros medios.

El servicio de señalización transmite identificadores y datos técnicos para establecer la conexión, que pueden incluir direcciones de red y puertos. La conexión usa el servicio STUN público de Google. La presencia en sesiones y salas comunica quién está conectado. Estos flujos no generan un historial de contenido en las tablas de producto de cofounder.

### Datos del dispositivo y servicios técnicos

La app guarda localmente la sesión de autenticación, ciertos datos para completar la vinculación de GitHub y referencias de recordatorios. El almacenamiento local de sesión usa AsyncStorage; no se presenta como un almacén de credenciales cifrado por la app.

Para descargar actualizaciones, Expo/EAS recibe un identificador aleatorio persistente de instalación, plataforma, versión de ejecución y metadatos de actualizaciones y posibles fallos de arranque. No es un identificador publicitario.

Los servicios de autenticación, base de datos, conexión y actualizaciones reciben datos de red como la dirección IP y pueden generar registros operativos. Los proveedores conservan estos registros operativos durante el plazo que fija su propia configuración; no los usamos para publicidad ni para elaborar perfiles.

## 3. Para qué usamos los datos

Los datos permiten mantener y recuperar tu cuenta, mostrar y editar tu perfil, filtrar perfiles por modo y preferencias, resolver likes recíprocos, comunicarte con tus matches, organizar sesiones y salas, calcular las rachas compartidas, mostrar tu valoración privada y comparar las respuestas del acuerdo cuando ambas personas hayan respondido.

Los datos técnicos permiten autenticar peticiones, mantener conexiones, completar la verificación de GitHub, programar recordatorios y servir actualizaciones de la app.

La versión descrita no incluye SDK de publicidad dirigida ni una integración de analítica comercial propia en el código revisado. No se han encontrado usos publicitarios de los datos de perfil o mensajes.

Bases jurídicas (art. 6 RGPD):

- **Ejecución del servicio que solicitas** (art. 6.1.b): cuenta, perfil, swipes, matches, mensajes, sesiones, salas, rachas, valoraciones y acuerdo.
- **Consentimiento** (art. 6.1.a): cámara y micrófono para la videollamada, recordatorios y verificación opcional de GitHub. Puedes retirarlo en cualquier momento desde los ajustes del dispositivo o desvinculando GitHub.
- **Interés legítimo** (art. 6.1.f): seguridad, prevención de abusos, moderación de reportes y operación técnica del servicio.
- **Obligación legal** (art. 6.1.c): atender requerimientos de las autoridades.

## 4. Quién puede verlos

- **Tu perfil completo puede leerlo cualquier cuenta autenticada**, incluidas las cuentas creadas sin email. No se limita a quienes hayan hecho match contigo. Evita incluir información que no quieras compartir con estas personas.
- Solo tú lees tus preferencias de navegación, tus swipes y tus valoraciones de sesión. El sistema usa los likes para resolver reciprocidad.
- Las dos personas del match ven su conversación, las sesiones individuales y su asistencia. La valoración de una persona no se muestra a la otra.
- En el acuerdo, la otra persona ve tu opción y nota de un tema cuando también ha respondido a ese tema. Antes puede ver que ya respondiste.
- En una sala, quien convoca ve todas las invitaciones y respuestas. Los demás participantes ven su propia fila y a quienes hayan aceptado. Los invitados pendientes no se muestran entre sí.
- La otra persona de la videollamada recibe tu imagen, voz y los datos de conexión necesarios.
- Los operadores con privilegios administrativos y los proveedores pueden acceder a datos según los permisos necesarios para prestar el servicio. El chat se almacena en la base de datos; no se ofrece una garantía de cifrado de extremo a extremo del chat.

Los recordatorios son locales. El aviso de sesión incluye el nombre del compañero y puede aparecer en la pantalla bloqueada según tus ajustes del sistema.

## 5. Servicios externos y transferencias

cofounder utiliza Supabase para autenticación, base de datos y Realtime; Expo/EAS para actualizaciones; GitHub si eliges verificar tu enlace; y STUN de Google para negociar la conexión de vídeo. El envío de emails de autenticación depende del servicio configurado.

Proveedores y su función:

- **Supabase** (encargado del tratamiento): autenticación, base de datos y Realtime. El proyecto está alojado en la región UE Centro (Fráncfort, `eu-central-1`).
- **Expo / EAS** (encargado): distribución de actualizaciones de la app.
- **GitHub** (responsable independiente), solo si eliges verificar tu enlace.
- **Google** (STUN público), solo en videollamada: recibe datos de red para negociar la conexión, sin contenido de imagen ni voz.
- **Servicio de correo de autenticación**: envía los emails de confirmación y recuperación.

Algunos proveedores pueden tratar datos fuera del EEE, en cuyo caso se apoyan en las cláusulas contractuales tipo de la Comisión Europea o en el Marco de Privacidad de Datos UE-EE. UU.

Al abrir un enlace de portfolio, GitHub o LinkedIn, visitas un servicio externo que aplica sus propias prácticas de privacidad.

## 6. Permisos y elecciones

La cámara y el micrófono se usan para la videollamada 1:1. Puedes denegar sus permisos, apagar cámara o micrófono durante la llamada o colgar.

Las notificaciones se usan para avisos locales cinco minutos antes de sesiones y salas aceptadas. Android declara además el permiso de alarmas exactas para los avisos programados. No se ha encontrado registro de tokens push para enviar notificaciones desde un servidor.

Puedes cambiar los permisos en los ajustes del dispositivo. Denegar un permiso puede impedir la función relacionada. Añadir email, enlaces, verificación GitHub y valoraciones es opcional. Para completar el perfil, la interfaz sí pide nombre, edad, zona, disponibilidad y al menos una respuesta de perfil.

## 7. Cuánto tiempo se conservan

Conservamos tus datos mientras tu cuenta exista. Al eliminar la cuenta desde la app (Perfil → Cuenta → Eliminar mi cuenta) se borran tu perfil y los datos asociados de forma inmediata en la base de datos.

- **Cuentas inactivas:** podemos eliminar las cuentas que lleven 24 meses sin acceso. No hay aviso previo automático por email: la app no cuenta con un mecanismo de envío.
- **Copias de seguridad del proveedor:** pueden conservar datos eliminados hasta 30 días más.
- **Registros técnicos de los proveedores** (IP, peticiones): según su configuración, sin superar 90 días en nuestra operación.
- **Reportes de abuso:** se conservan como máximo 12 meses desde su creación y se borran automáticamente después. Si la persona que reporta o la reportada elimina su cuenta, el reporte permanece hasta ese plazo, sin enlace a un perfil y con el identificador interno de la cuenta como referencia.

Salvo la eliminación automática de reportes, las tablas de producto no se borran por antigüedad. Terminar o cancelar una sesión o sala no borra sus datos. La ventana de 24 horas para valorar una sesión limita cuándo puedes valorar; no elimina la valoración después.

Cerrar sesión o desinstalar la app no equivale a borrar los datos del servidor. Cerrar sesión elimina credenciales locales y puede hacer irrecuperable una cuenta sin email confirmado, aunque las filas sigan en el servidor.

Cuando se elimina una cuenta, también se borran los matches y sus mensajes, sesiones, valoraciones y acuerdos, incluidos los datos que aportó la otra persona en esos matches. Las salas cuyo convocante se da de baja se conservan para los demás participantes, sin la persona convocante.

Los flujos de vídeo y presencia no se graban como contenido de producto; la conservación de registros de los proveedores debe concretarse por separado.

## 8. Derechos y control sobre tus datos

Puedes editar tu perfil y sus enlaces. Puedes desvincular GitHub mediante el flujo disponible; ello retira el sello y el enlace derivado cuando se sincroniza. La app no ofrece edición o borrado individual de mensajes ni cambio de una valoración ya enviada.

Puedes darte de baja desde la app (Perfil → Cuenta → Eliminar mi cuenta) o pedir la eliminación escribiendo a cofounder.soporte@gmail.com; respondemos en un máximo de 30 días. Cerrar sesión no es una baja. Tienes además derecho a acceso, rectificación, supresión, oposición, limitación y portabilidad, que puedes ejercer por el mismo correo, y a reclamar ante la AEPD. Las páginas públicas están en https://thejowe.github.io/lockin/.

## 9. Menores

cofounder es para personas de **16 años o más**. La edad es autodeclarada y no hay verificación documental de edad ni controles parentales. Si detectamos una cuenta de una persona menor de 16 años, la eliminaremos. Si crees que ocurre, avísanos por correo.

## 10. Seguridad y cambios

El servidor aplica controles de acceso por cuenta, pertenencia a matches y pertenencia a salas. Su funcionamiento efectivo depende de que las migraciones y los ajustes de producción estén aplicados. Los datos no son anónimos por el hecho de usar una cuenta sin email.

Las conexiones con Supabase y Expo usan TLS. No prometemos cifrado de extremo a extremo del chat ni una certificación de seguridad.

Puedes **bloquear y reportar** a otra persona desde la app. Revisamos los reportes y actuamos sobre contenido o cuentas que incumplan las [normas de la comunidad](https://thejowe.github.io/lockin/normas).

Si cambiamos esta política de forma relevante, lo avisaremos dentro de la app y, si tienes email, por correo, al menos 30 días antes de que entre en vigor. La fecha de entrada en vigor figura al principio.

---

Nota editorial para el responsable, a retirar del texto publicado: la purga de reportes a 12 meses la implementa `purge_old_user_reports()` (migración `20261010120000`), programada a diario con pg_cron; antes de publicar, comprobar en producción que `select jobname, schedule from cron.job` la lista (si pg_cron no está disponible, hay que llamarla desde otro planificador y este texto no sería cierto). La eliminación de cuentas con 24 meses sin acceso es una facultad, no un proceso automático: el esquema no guarda una última actividad fiable, y borrar cuentas solo por inactividad se retiró tras la revisión de Codex por el riesgo de eliminar una cuenta en uso. Las migraciones de cuenta y de bloqueo anteriores ya están aplicadas en producción (10-oct-2026). Las instrucciones a las tiendas están en [cuestionario-privacidad.md](cuestionario-privacidad.md). Sus fuentes oficiales son las [reglas de privacidad de Apple](https://developer.apple.com/app-store/review/guidelines/#privacy) y la [política de datos de usuario de Google Play](https://support.google.com/googleplay/android-developer/answer/10144311?hl=es).
