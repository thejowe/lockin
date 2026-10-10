# cofounder — cuestionario de privacidad de las tiendas

Preparado el 9 de octubre de 2026 sobre `0cddbbbae3a894c64e2be04f2c74c081602db8e6`. Fuente factual: [inventario campo a campo](datos-recopilados.md). Los datos de proveedores también cuentan; las respuestas no se limitan a las tablas public.

Este documento permite preparar App Store Connect y Play Console. Las marcas pendientes deben resolverse contra la configuración y el binario que se enviarán; no se ha enviado ningún formulario ni se ha comprobado el backend de producción.

## Apple — App Privacy

Fuente de las definiciones: [App Privacy Details de Apple](https://developer.apple.com/app-store/app-privacy-details/). La recogida que exige declarar Apple depende de envío fuera del dispositivo y conservación; que una función sea opcional no la exime automáticamente.

### Preguntas generales

| Pregunta | Respuesta derivada del código |
| --- | --- |
| ¿La app o sus socios recogen datos? | **Sí.** Perfil, cuenta, actividad, mensajes, sesiones, acuerdos y salas se guardan en Supabase; Expo/EAS recibe datos técnicos de actualizaciones. |
| ¿Se usan datos para seguimiento (tracking)? | **No se ha encontrado tracking publicitario en el código.** Respuesta propuesta: No, tras validar prácticas de proveedores en D05/D09. Matching entre personas no es tracking publicitario. |
| ¿Los datos están vinculados a la identidad? | **Sí** para los datos de cuenta/producto. El UUID conecta perfil y actividad aunque la cuenta sea «anónima». |
| ¿Se recoge el identificador publicitario? | No se ha encontrado IDFA/Advertising ID. Sí existe un identificador de instalación EAS-Client-ID, que pertenece a Device ID. |
| URL de política de privacidad | https://thejowe.github.io/lockin/privacidad (D08; hay que crear la página a partir de `privacidad.md`). |

### Tipos y finalidad

Finalidad principal: **App Functionality**. Añadir **Product Personalization** para los datos que se usan al adaptar el deck por modo, preferencias/especialidades y decisiones previas. Para autenticación, usar App Functionality; Apple no tiene una finalidad independiente llamada «gestión de cuentas».

| Tipo de Apple | Datos concretos | Recogidos | Vinculados | Finalidad / seguimiento |
| --- | --- | --- | --- | --- |
| Contact Info → Name | profiles.name; iniciales derivadas | Sí | Sí | Funcionalidad; sin tracking detectado |
| Contact Info → Email Address | Email real/pending opcional de Auth; metadatos OAuth si contienen email | Sí en los flujos que lo usan | Sí | Funcionalidad de cuenta; sin tracking detectado |
| Location → Coarse Location | Ciudad/zona declarada en profiles.location; zona horaria como contexto | Sí | Sí | Funcionalidad. No requiere GPS para contar como ubicación |
| Identifiers → User ID | UUID de cuenta/perfil, identificadores de participantes y handle GitHub | Sí | Sí | Funcionalidad |
| Contacts → Contacts | Grafo propio de matches e invitaciones/miembros de salas | Sí | Sí | Funcionalidad. No hay importación de agenda; Apple incluye el grafo social en esta categoría |
| User Content → Emails or Text Messages | messages.body, emisor, match y fecha | Sí | Sí | Funcionalidad de chat |
| User Content → Other User Content | Respuestas de perfil, enlaces, especialidades, disponibilidad, ambición y respuestas/notas del acuerdo | Sí | Sí | Funcionalidad; personalización para preferencias que usa el deck |
| Usage Data → Product Interaction | Modo elegido, likes/pass, matches, propuestas y respuestas de sesión/sala, asistencia y valoraciones privadas | Sí | Sí | Funcionalidad; personalización para el deck cuando excluye decisiones previas |
| Other Data → Other Data Types | Edad declarada; demás datos de perfil no cubiertos por otra categoría | Sí | Sí | Funcionalidad |
| Identifiers → Device ID | EAS-Client-ID enviado por expo-updates | Sí: se envía; declarar conservadoramente mientras se confirma conservación del proveedor | **Sí como opción conservadora**: un ID persistente de instalación no prueba desidentificación | Actualizaciones/funcionalidad; uso adicional del proveedor D05/D09 pendiente |
| Diagnostics → Crash Data | Expo-Recent-Failed-Update-IDs cuando hay fallos de arranque | Sí: transmisión comprobada; conservación proveedor pendiente | Sí como opción conservadora al asociarse con EAS-Client-ID | Funcionalidad de actualizaciones/diagnóstico; no hay integración de crash reporting propia |
| Diagnostics → Other Diagnostic Data | Plataforma/runtime e IDs de actualización actual/incluida | Sí: transmisión comprobada; conservación proveedor pendiente | Sí como opción conservadora | Funcionalidad de actualizaciones; validar fines adicionales en D05/D09 |

No declarar el grafo de matches como Gameplay Content: cofounder no es un juego. La autodeclaración de una edad no es información biométrica. No clasificar el email de acceso como contenido de «Emails or Text Messages»: ese campo corresponde a los mensajes, no a la dirección de contacto.

Decisión D09: la disposición cualitativa de aportación económica **no** se declara como información financiera; no hay salario, deuda, cuentas ni pago. Se cubre como contenido generado por el usuario, opcional y vinculado.

Decisión D05/D09: el ID EAS, la IP y los registros de Supabase/Expo se usan solo para operación del servicio (actualizaciones, autenticación), sin analítica. Declarar como «Identificadores de dispositivo», vinculados, funcionalidad de la app.

### Vídeo, audio, datos locales y categorías negativas

| Caso | Respuesta de preparación |
| --- | --- |
| Vídeo y audio 1:1 | No se graban ni almacenan archivos de medios por la app; flujo temporal directo para la llamada. Si ninguna parte operadora/proveedor conserva contenido más allá de atenderla, no se declara como recogida Photos or Videos / Audio Data bajo la definición Apple. El receptor sí lo recibe; no equivale a que no haya transmisión. Confirmar D05/D09. Si se incorpora grabación/retención, declarar esos tipos. |
| SDP/ICE y presencia | No hay tabla de contenido ni historial. Confirmar registros de proveedor antes de aplicar exclusión por procesamiento temporal. Los UUID ya persistentes siguen declarados como User ID. |
| Credenciales/recordatorios solo locales | El acceso exclusivamente local no se añade como recogida independiente. Los datos de cuenta que también envía Auth sí están cubiertos arriba. |
| Fotos de avatar, GPS preciso, historial de búsquedas o navegación, salud, biometría, compras, datos de pago, documentos | No se han encontrado funciones que recaben estas categorías. Abrir enlaces en el navegador del sistema no crea un historial propio en la base de datos. |
| Customer Support | Canal de soporte por correo (cofounder.soporte@gmail.com): los mensajes que la persona envíe se tratan para atenderlos. Solo declarar si Play/App Store lo pide para el canal publicado; no hay SDK. |

No prometer «Data Not Collected» o «Data Not Linked to You».

## Google Play — Data safety / Seguridad de los datos

Fuente: [guía oficial del formulario](https://support.google.com/googleplay/android-developer/answer/10787469?hl=es). Las siguientes respuestas describen el código actual; las excepciones de proveedores y acciones del usuario deben documentarse por separado.

### Preguntas generales

| Pregunta | Respuesta de preparación |
| --- | --- |
| ¿Recoge o comparte algún tipo de dato obligatorio de declarar? | **Sí.** No seleccionar «no recoge datos». |
| ¿Todos los datos se cifran en tránsito? | **Sí.** Supabase por HTTPS/WSS y medios WebRTC con DTLS-SRTP; el STUN transporta solo datos de red, no contenido de usuario. Comprobar que `EXPO_PUBLIC_SUPABASE_URL` de la build es `https://` antes de enviar. |
| ¿Cómo se crean cuentas? | **Nombre de usuario y contraseña** para email/contraseña (real o sintético); **OAuth** para vinculación de GitHub; **Otros** para creación anónima automática. Declarar todos los métodos que estén habilitados en la versión final. |
| ¿Se puede solicitar eliminación de cuenta y datos desde la app? | **No existe un flujo completo.** Cerrar sesión no elimina la cuenta ni las filas de producto. No responder que sí por el texto «Borrarlo todo». |
| Enlace web de solicitud de eliminación | https://thejowe.github.io/lockin/eliminar-cuenta (D08; hay que crear la página). Mecanismo en app: Perfil → Cuenta → Eliminar mi cuenta. |
| ¿Ofrece eliminación de datos sin eliminar la cuenta? | No hay borrado individual de mensajes, valoraciones o historial. La edición del perfil no equivale a borrar todas las categorías. |
| ¿Revisión independiente de seguridad / distintivos? | No se ha encontrado certificación; no marcar que se dispone de ella. |

La contraseña se envía a Auth; no es una columna pública ni una venta de credenciales. La recogida para acceso y recuperación se declara también con la finalidad **Account Management / Gestión de cuentas**.

### Tipos persistentes y control del usuario

En las filas siguientes, **recogidos = Sí** y **procesamiento temporal = No**, porque los datos se guardan en Supabase o se transmiten con un identificador persistente al proveedor de actualizaciones. Para los datos técnicos, confirmar conservación en D05/D09 antes de cerrar la respuesta temporal.

| Categoría / tipo de Google | Datos del inventario | ¿Opcional u obligatorio? | Finalidades comprobadas |
| --- | --- | --- | --- |
| Información personal → Nombre | Nombre e iniciales del perfil | Obligatorio para completar perfil | Funcionalidad; gestión de cuentas/perfil |
| Información personal → Dirección de correo | Email real y pendiente de Auth | Opcional para usar la cuenta anónima; necesario si se elige alta/recuperación por email. El email sintético es generado automáticamente | Gestión de cuentas |
| Información personal → IDs de usuario | UUID de cuenta y handle OAuth GitHub | UUID obligatorio; GitHub opcional | Gestión de cuentas y funcionalidad |
| Información personal → Otra información | Edad, zona horaria y datos estructurados de perfil no cubiertos por otros tipos | Obligatorio para edad y campos que exige el perfil; enlaces/preferencias adicionales opcionales | Funcionalidad y gestión de perfil |
| Ubicación → Ubicación aproximada | Ciudad/zona declarada | Obligatorio para completar perfil | Funcionalidad |
| Contactos → Contactos | Grafo de matches e invitaciones a salas; IDs/nombres de participantes | Opcional: se genera al hacer matches o participar/invitar; no se importa agenda | Funcionalidad |
| Mensajes → Otros mensajes en aplicaciones | Mensajes de chat y sus participantes/fechas | Opcional: el usuario elige enviar mensajes | Funcionalidad |
| Actividad de la aplicación → Interacciones con la aplicación | Modo, programación y respuestas de sesiones/salas, entradas/salidas y acciones de uso | Hay datos necesarios para la función elegida; el modo se guarda como parte del uso básico | Funcionalidad |
| Actividad de la aplicación → Otras acciones | Likes/pass y valoración de sesión | Opcional para el usuario | Funcionalidad |
| Actividad de la aplicación → Otro contenido generado por usuarios | Prompts, enlaces y notas/respuestas del acuerdo | **Obligatorio a nivel de tipo:** la UI exige al menos un prompt. Notas del acuerdo y enlaces son opcionales | Funcionalidad |
| Identificadores de dispositivo o de otro tipo | EAS-Client-ID; no es Advertising ID | Obligatorio mientras expo-updates siga activo sin opción de desactivación para el usuario | Funcionalidad de actualización |
| Información y rendimiento → Registros de fallos | IDs de actualizaciones con fallo de arranque enviados por Expo | Automático cuando se produce el evento; sin opción por usuario en código | Funcionalidad/diagnóstico de actualización |
| Información y rendimiento → Diagnósticos | Runtime/plataforma y estado/IDs de actualizaciones | Automático en las peticiones; sin opción por usuario en código | Funcionalidad de actualización |

El hecho de poder abandonar la app no convierte un campo exigido por el formulario en opcional. Cuando un tipo agrega datos obligatorios y opcionales, no marcar todo el tipo «opcional».

Decisión D09: no incluir Información financiera. No hay tarjetas, cobros, saldo, salario ni deudas.

No hay evidencia de personalización publicitaria o marketing. El filtrado y matching son funcionalidad de la app; no añadir fines comerciales ausentes del código. Confirmar fines operativos adicionales de proveedores en D05.

### «Compartidos»: separar recepción real y etiqueta del formulario

Para preparar una versión conservadora, declarar **compartidos = Sí** en los tipos que publica el perfil: Nombre, Ubicación aproximada, IDs de usuario, Otra información y Otro contenido generado por usuarios. P solo requiere una cuenta autenticada; no hay un ajuste de perfil privado ni un control de audiencia verificado en esta auditoría.

Los mensajes enviados, respuestas al acuerdo tras respuesta recíproca, participación en salas y medios de la llamada se transfieren a destinatarios elegidos por acciones del usuario. Esto puede acogerse a la excepción de transferencia iniciada por el usuario si es razonablemente esperable. Aun así, se deben declarar como recogidos cuando persisten en Supabase.

| Receptor / dato | Transferencia real | Cómo preparar «compartidos» |
| --- | --- | --- |
| Otras cuentas autenticadas: perfil | Sí, incluidos email-free/anonymous autenticados | Sí conservador para los tipos públicos anteriores; D10 para aplicar una excepción con evidencia de transparencia/acción del usuario |
| Match: mensajes, sesiones, asistencia; acuerdo revelado | Sí | No solo si se justifica la excepción de acción iniciada/esperable para cada flujo; de lo contrario Sí |
| Participantes de sala: miembros aceptados y presencia | Sí, incluida la lista de personas que no tienen match entre sí | Igual: D10 para confirmar la excepción; no declarar que nadie recibe el grafo social |
| Supabase: todos los datos persistentes y Auth | Sí | No en «compartidos» solo si encaja como proveedor que trata datos por cuenta del editor; confirmar D05/D10 |
| Expo/EAS: ID instalación, diagnóstico e IP | Sí | Confirmar el papel y los usos del proveedor en D05/D10; no se deduce la excepción solo de instalar el SDK |
| GitHub OAuth y SMTP | Sí, en los flujos correspondientes | Revisar datos, contratos y acción del usuario en D05/D10 |
| Google STUN: IP y negociación | Sí, durante conexión | Papel, tratamiento y tipo a declarar pendientes en D05/D09/D10 |

Decisión D10: marcar «No se comparten» para Supabase y Expo (encargados que tratan datos por cuenta del responsable) y para lo que la otra persona del match ve por acción del usuario. Marcar compartido solo el enlace de GitHub si la persona lo abre (servicio externo) y la IP al STUN de Google en llamada.

### Vídeo, audio y datos temporales

El código envía voz y vídeo fuera del dispositivo, sin grabarlos en el producto. La guía de Google distingue la excepción de cifrado de extremo a extremo y el procesamiento temporal. No omitir datos solo porque no existe una tabla.

- Si se acredita que solo remitente y receptor pueden leer los medios bajo la excepción de cifrado de extremo a extremo, esos medios pueden quedar fuera de «recogidos». Confirmar D09; no extrapolarlo al chat almacenado ni a SDP/ICE.
- Si esa excepción no se acredita, preparar **Vídeos** y **Grabaciones de voz o de sonido**, recogidos Sí, opcionales, funcionalidad de llamada. Marcar temporales solo si cumplen el estándar de uso exclusivo en memoria durante la llamada y no hay retención adicional.
- SDP/ICE contiene UUID y puede contener IP/puertos. La presencia usa IDs. Preparar los tipos correspondientes y confirmar su procesamiento temporal y logs en D05/D09.
- IP no debe declararse como ubicación precisa por defecto: depende de uso/derivación; la ciudad declarada sí está incluida como ubicación aproximada.

Decisión D05/D09: hay llamada remota (WebRTC) y, por tanto, datos que salen del dispositivo; no afirmar lo contrario.

## Lo que Apple/Google exigirán y la app aún no tiene

Los siguientes son hallazgos del código auditado, no funciones implementadas por estos documentos. No se ha modificado el producto.

| Requisito y fuente | Evidencia en el repo | Trabajo que falta |
| --- | --- | --- |
| Baja de cuenta desde la app: [Apple, 5.1.1(v)](https://developer.apple.com/app-store/review/guidelines/#data-collection-and-storage) y [Google, eliminación de cuentas](https://support.google.com/googleplay/android-developer/answer/13327111?hl=es) | No hay operación de eliminación de Auth ni flujo completo. signOut solo cierra sesión y elimina credenciales locales | Implementar baja real para cuentas anónimas, de dispositivo, email y OAuth, con comprobación de identidad, eliminación de datos vinculados y tratamiento de backups/retenciones. No confundir DELETE de profiles con eliminación de Auth/user_settings |
| Recurso web para solicitar baja: [Google](https://support.google.com/googleplay/android-developer/answer/13327111?hl=es) | No encontrado | Publicar URL y operación de solicitudes (D08); debe funcionar, no ser solo texto de intención |
| Bloquear usuarios y reportar usuarios/contenido: [Apple, 1.2](https://developer.apple.com/app-store/review/guidelines/#user-generated-content), [Google, UGC](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en-GB) | Sin tablas/RPC/UI de bloqueo o denuncia; sin restricción de acceso por bloqueo | Implementar controles dentro de la app y aplicar sus efectos en servidor para perfil, contacto, chat e invitaciones. Un pass no equivale a bloquear |
| Moderación y reglas de contenido: mismas reglas UGC | No se ha encontrado filtrado de contenido objetable, cola de reportes ni aceptación de términos antes de aportar contenido | Definir normas, aceptación, revisión y respuesta operativa; implementar herramientas necesarias. D11 pendiente |
| Política pública y contacto: [Apple, 5.1.1 y 1.2](https://developer.apple.com/app-store/review/guidelines/), [Google, datos de usuario](https://support.google.com/googleplay/android-developer/answer/10144311?hl=es) | Estos documentos son borradores locales; no se ha encontrado enlace de privacidad dentro de la app | Completar responsable/contacto, publicar política, enlazarla en app y consolas; resolver D01–D05/D08/D12 |
| Seguridad infantil para la categoría Social: [Google, Child Safety Standards](https://support.google.com/googleplay/android-developer/answer/14747720?hl=en) | No se han encontrado normas públicas contra abuso/explotación sexual infantil, canal operativo de avisos ni contacto designado | Si se publica como Social, completar esas normas, recepción/revisión de avisos, procedimiento ante contenido ilícito y contacto; D02/D06/D08/D11. No marcar la declaración de cumplimiento como terminada |
| Metadatos de edad y declaraciones verificadas | Edad autodeclarada desde 16; faltan política final y resultados de los cuestionarios | Completar público objetivo y clasificaciones de cada consola; revisar producción/SDKs (D06/D09) |

La pantalla de cuenta debe corregir «Borrarlo todo» antes de publicarse: hoy promete un borrado que la implementación no ejecuta. La existencia de cascadas SQL permite diseñar la baja, pero no cumple por sí sola el requisito.

## Cierre de preparación

- Resolver las decisiones D01–D12 del inventario; las respuestas de seguridad/compartición/medios dependen especialmente de D05/D09/D10.
- Aplicar y comprobar las migraciones/RLS y cerrar el acceso público de Realtime según la migración de autorización; contrastar con el binario final.
- Contrastar permisos generados y dependencias nativas con app.json; no confundir Expo Go con la app nativa que soporta WebRTC.
- Completar los flujos de baja y moderación en una tarea de producto separada. Esta entrega se limita a docs/tiendas.
