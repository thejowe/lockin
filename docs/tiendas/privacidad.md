# Política de privacidad de LockIn

> Borrador para publicación, preparado el 9 de octubre de 2026 sobre el commit `0cddbbbae3a894c64e2be04f2c74c081602db8e6`. Completar las marcas antes de publicarlo. Los ID D01–D12 se explican en [el inventario](datos-recopilados.md#decisiones-pendientes-compartidas-por-los-cinco-documentos).

**Entrada en vigor:** [PENDIENTE DE DECISIÓN] D12: fecha de vigencia.

## 1. Quién es responsable de tus datos

LockIn permite encontrar un cofundador en modo Par o una persona con quien trabajar concentrado en modo Lock-In.

El responsable del tratamiento es **[PENDIENTE DE DECISIÓN] D01: nombre legal o razón social y domicilio**. Puedes contactar para cuestiones de privacidad o soporte en **[PENDIENTE DE DECISIÓN] D02: correo de contacto operativo**.

**[PENDIENTE DE DECISIÓN] D03:** jurisdicción y mercados de publicación, normativa aplicable y autoridad de control competente. El nombre de la app o una cuenta técnica del proveedor no sustituyen la identificación legal del responsable.

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

El servicio de señalización transmite identificadores y datos técnicos para establecer la conexión, que pueden incluir direcciones de red y puertos. La conexión usa el servicio STUN público de Google. La presencia en sesiones y salas comunica quién está conectado. Estos flujos no generan un historial de contenido en las tablas de producto de LockIn.

### Datos del dispositivo y servicios técnicos

La app guarda localmente la sesión de autenticación, ciertos datos para completar la vinculación de GitHub y referencias de recordatorios. El almacenamiento local de sesión usa AsyncStorage; no se presenta como un almacén de credenciales cifrado por la app.

Para descargar actualizaciones, Expo/EAS recibe un identificador aleatorio persistente de instalación, plataforma, versión de ejecución y metadatos de actualizaciones y posibles fallos de arranque. No es un identificador publicitario.

Los servicios de autenticación, base de datos, conexión y actualizaciones reciben datos de red como la dirección IP y pueden generar registros operativos. **[PENDIENTE DE DECISIÓN] D05:** concretar los metadatos que conservan los proveedores y su configuración de producción.

## 3. Para qué usamos los datos

Los datos permiten mantener y recuperar tu cuenta, mostrar y editar tu perfil, filtrar perfiles por modo y preferencias, resolver likes recíprocos, comunicarte con tus matches, organizar sesiones y salas, calcular las rachas compartidas, mostrar tu valoración privada y comparar las respuestas del acuerdo cuando ambas personas hayan respondido.

Los datos técnicos permiten autenticar peticiones, mantener conexiones, completar la verificación de GitHub, programar recordatorios y servir actualizaciones de la app.

La versión descrita no incluye SDK de publicidad dirigida ni una integración de analítica comercial propia en el código revisado. No se han encontrado usos publicitarios de los datos de perfil o mensajes.

**[PENDIENTE DE DECISIÓN] D03:** especificar la base jurídica de cada finalidad, incluidos servicio principal, datos públicos del perfil, autenticación opcional, cámara/micrófono, recordatorios y operaciones técnicas. Conceder un permiso del sistema no determina por sí solo todas las bases jurídicas.

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

LockIn utiliza Supabase para autenticación, base de datos y Realtime; Expo/EAS para actualizaciones; GitHub si eliges verificar tu enlace; y STUN de Google para negociar la conexión de vídeo. El envío de emails de autenticación depende del servicio configurado.

**[PENDIENTE DE DECISIÓN] D05:** identificar los proveedores legales, el servicio de correo, sus funciones como encargados o responsables independientes, regiones de alojamiento, subencargados, transferencias internacionales y garantías aplicables. No se atribuye una región o un contrato que el repositorio no acredita.

Al abrir un enlace de portfolio, GitHub o LinkedIn, visitas un servicio externo que aplica sus propias prácticas de privacidad.

## 6. Permisos y elecciones

La cámara y el micrófono se usan para la videollamada 1:1. Puedes denegar sus permisos, apagar cámara o micrófono durante la llamada o colgar.

Las notificaciones se usan para avisos locales cinco minutos antes de sesiones y salas aceptadas. Android declara además el permiso de alarmas exactas para los avisos programados. No se ha encontrado registro de tokens push para enviar notificaciones desde un servidor.

Puedes cambiar los permisos en los ajustes del dispositivo. Denegar un permiso puede impedir la función relacionada. Añadir email, enlaces, verificación GitHub y valoraciones es opcional. Para completar el perfil, la interfaz sí pide nombre, edad, zona, disponibilidad y al menos una respuesta de perfil.

## 7. Cuánto tiempo se conservan

**[PENDIENTE DE DECISIÓN] D04:** definir los plazos de conservación de cuentas y perfiles, swipes, matches, mensajes, sesiones y asistencia, valoraciones, acuerdos, salas e invitaciones; además de cuentas inactivas o irrecuperables, registros técnicos y copias de seguridad.

Actualmente, las tablas de producto no tienen una eliminación automática por antigüedad. Terminar o cancelar una sesión o sala no borra sus datos. La ventana de 24 horas para valorar una sesión limita cuándo puedes valorar; no elimina la valoración después.

Cerrar sesión o desinstalar la app no equivale a borrar los datos del servidor. Cerrar sesión elimina credenciales locales y puede hacer irrecuperable una cuenta sin email confirmado, aunque las filas sigan en el servidor.

Cuando se elimina un perfil en la base de datos, las relaciones definidas en el esquema pueden borrar también los matches y sus mensajes, sesiones, valoraciones y acuerdos, incluidos datos aportados por la otra persona. Si se elimina el perfil de quien convoca una sala, se eliminan la sala y sus miembros. La app aún no ofrece un flujo completo de eliminación de cuenta.

Los flujos de vídeo y presencia no se graban como contenido de producto; la conservación de registros de los proveedores debe concretarse por separado.

## 8. Derechos y control sobre tus datos

Puedes editar tu perfil y sus enlaces. Puedes desvincular GitHub mediante el flujo disponible; ello retira el sello y el enlace derivado cuando se sincroniza. La app no ofrece edición o borrado individual de mensajes ni cambio de una valoración ya enviada.

**[PENDIENTE DE DECISIÓN] D02/D03:** completar el canal de solicitudes y el procedimiento para ejercer los derechos aplicables de acceso, rectificación, supresión, oposición, limitación o portabilidad, según la normativa y los tratamientos correspondientes; concretar cómo reclamar ante la autoridad competente.

La baja completa desde la app y un canal web de solicitud de eliminación están pendientes de implementación/publicación. **[PENDIENTE DE DECISIÓN] D08:** URL pública de eliminación de cuenta y de esta política. No presentamos el botón de cerrar sesión como una baja.

## 9. Menores

El formulario actual permite declarar edades desde 16 años. La edad es autodeclarada y no hay verificación documental de edad ni controles parentales.

**[PENDIENTE DE DECISIÓN] D06:** establecer la edad mínima contractual y la política sobre menores, el público objetivo de las tiendas y las restricciones necesarias por territorio. La clasificación de una tienda no sustituye estas decisiones.

## 10. Seguridad y cambios

El servidor aplica controles de acceso por cuenta, pertenencia a matches y pertenencia a salas. Su funcionamiento efectivo depende de que las migraciones y los ajustes de producción estén aplicados. Los datos no son anónimos por el hecho de usar una cuenta sin email.

**[PENDIENTE DE DECISIÓN] D09:** verificar el binario, la configuración de producción y la protección de todos los flujos de datos. No se promete una certificación o un cifrado universal no comprobado.

**[PENDIENTE DE DECISIÓN] D12:** definir cómo comunicaremos cambios de esta política y su fecha de entrada en vigor.

---

Nota editorial para el responsable, a retirar del texto publicado: este borrador describe el comportamiento actual y sus carencias. Las bases jurídicas y derechos se deben concretar según D03; las instrucciones a las tiendas y los requisitos pendientes de cuenta/moderación están en [cuestionario-privacidad.md](cuestionario-privacidad.md). Sus fuentes oficiales son las [reglas de privacidad de Apple](https://developer.apple.com/app-store/review/guidelines/#privacy) y la [política de datos de usuario de Google Play](https://support.google.com/googleplay/android-developer/answer/10144311?hl=es).
