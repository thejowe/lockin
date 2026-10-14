# Informe de revisión de docs/tiendas — cofounder (lockin)

Revisión del 14-oct-2026. Base: `lockin-docs.zip` (docs/tiendas, CONCEPTO.md, app.json). Las versiones corregidas están en esta carpeta con los mismos nombres de archivo. Problema principal: **los cinco documentos son del 9–10 de octubre, anteriores al pivote del 12-oct-2026**. Describen Lock-In (sesiones, salas, vídeo, rachas, Pomodoro, acuerdo) como funciones existentes y no incluyen la foto de perfil enviada a OpenAI.

Gravedad: **bloqueante** = rechazo probable o incumplimiento legal; **importante** = riesgo real o incoherencia que hay que resolver antes de enviar; **menor** = pulido.

## Fichas (ficha-app-store.md, ficha-google-play.md)

| # | Archivo | Problema | Corrección | Gravedad |
| --- | --- | --- | --- | --- |
| 1 | Ambas fichas | La descripción presenta como existentes el modo Lock-In, las sesiones Pomodoro, la videollamada, las rachas, las salas de grupo y el acuerdo entre cofundadores (plantillas de acuerdo). Todo está oculto desde el pivote. Si se anuncian funciones que no están, Apple rechaza por la 2.3.1 / 2.3 (metadatos inexactos) y Google por metadatos engañosos | Descripción reescrita solo con las funciones actuales | Bloqueante |
| 2 | Ambas | Subtítulo, texto promocional y descripción breve: «compañero de foco», «Pomodoro», «organiza sesiones» | Subtítulo «Encuentra con quién fundar» (26/30). Promo de 142/170. Breve de 78/80 | Bloqueante |
| 3 | App Store | Palabras clave «coworking, pomodoro, productividad, concentracion» de funciones ocultas | `socio,emprender,startup,emprendedor,cofundadora,proyecto,equipo,idea,negocio,colaborar,github,pares` (99/100 bytes) | Importante |
| 4 | Ambas | No mencionan la foto de perfil ni su revisión de seguridad. Tampoco «GitHub verificado»: decían «sello», sin la etiqueta exigida | Añadidas la foto opcional, la revisión antes de publicarse y la sección «GitHub verificado», con la aclaración de que no verifica a la persona | Importante |
| 5 | Ambas | No había deslinde explícito: app de citas, bolsa de empleo, asesoramiento legal, financiación, resultados | Añadida la sección «Lo que no es», en tono sobrio | Importante |
| 6 | Ambas | Las notas internas afirmaban que la baja de cuenta y el bloqueo y reporte **no existen**, mientras privacidad.md/D09/D11 dicen que sí y que están en producción. Contradicción | Unificado en «existen; probar en la build». Mencionados en la descripción y en las notas para la revisión | Importante |
| 7 | App Store | Categoría secundaria Productividad, justificada solo por Lock-In | Proponer Negocios o dejarla vacía (decisión del responsable; D07 descartaba Negocios) | Menor |
| 8 | App Store | Faltaban notas para la revisión y una cuenta de prueba | Añadidas una plantilla de notas y la indicación de crear la cuenta de prueba | Importante |
| 9 | Ambas | Capturas y vídeo de vista previa: riesgo de reutilizar pantallas con temporizador, salas o vídeo | Añadida una lista de comprobación de capturas | Importante |
| 10 | Ambas | Precio: no se encontraron promesas de «gratis para siempre» ni de premium | Sin cambios. Se mantiene la ausencia de precio | — (correcto) |
| 11 | App Store | La tabla decía «Nombre: 6 caracteres»; «cofounder» tiene 9. También decía «nombre técnico en app.json: lockin», pero eso es el `slug`, no el nombre | Corregido | Menor |

## Política de privacidad (privacidad.md)

| # | Problema | Corrección | Gravedad |
| --- | --- | --- | --- |
| 12 | **OpenAI no aparece en §5 (proveedores)** ni se menciona la transferencia fuera del EEE, aunque §2 dice que la foto se le envía | OpenAI añadido como encargado. Se menciona la transferencia con CCT/DPF | Bloqueante (RGPD art. 13 y coherencia con las tiendas) |
| 13 | §1, §2, §3, §5 y §6 describen el modo Lock-In, sesiones, salas, acuerdo, rachas, valoraciones, videollamada, STUN de Google, recordatorios y alarmas exactas | Retirado todo eso. Nota editorial: si el binario aún recoge esos datos o hay datos de pruebas, hay que declararlos o borrarlos | Importante |
| 14 | §2 afirma que la foto se envía «no para entrenar modelos ni para otro fin». Los docs no aportan ninguna prueba (condiciones o DPA de OpenAI) | Frase retirada hasta que se confirme. Ahora dice «con el único fin de comprobar que es apropiada» | Importante |
| 15 | §6 no menciona el permiso de galería ni de cámara para la foto | Añadido | Importante |
| 16 | No se dice que la foto aprobada es visible para todas las cuentas. Además, el bucket `avatars` es **público**, así que cualquiera con la URL puede verla | Añadido en §4. Pregunta abierta en el inventario: ¿bucket privado con URLs firmadas? | Importante |
| 17 | Falta el plazo de conservación de las fotos rechazadas o pendientes (`avatar-uploads`) | Marcador «[pendiente de confirmar plazo]» | Importante |
| 18 | La fecha de entrada en vigor (10-oct) es anterior a cambios materiales (foto/OpenAI) | Sustituida por «[fecha de publicación]» | Menor |
| 19 | El correo de autenticación (Resend o Brevo) no tiene nombre | Pregunta abierta: nombrarlo cuando se decida | Menor |

## Cuestionario de privacidad (cuestionario-privacidad.md)

| # | Problema | Corrección | Gravedad |
| --- | --- | --- | --- |
| 20 | **La foto (Photos or Videos / Fotos) no figura en las tablas de Apple ni de Google**. Solo aparecía en una nota que decía «pendiente de reflejar» | Añadida en ambas tablas: vinculada, opcional, funcionalidad (+ seguridad en Google) | Bloqueante (declaración falsa en App Privacy / Data safety) |
| 21 | En Google figura «¿Eliminación desde la app? **No existe un flujo completo**», cuando ya existe | «Sí» + URL web obligatoria, con la indicación de probarlo en la build | Bloqueante si se envía tal cual |
| 22 | La sección «Lo que Apple/Google exigirán y la app aún no tiene» decía que no hay bloqueo ni reporte | Reescrita como tabla de estado actual | Importante |
| 23 | Declaraba vídeo/audio, presencia, sesiones, salas, STUN, alarmas | Retirados (si el código sale del binario) | Importante |
| 24 | ¿OpenAI es un «tercero» con el que se comparten datos en Google? Sin resolver | Regla: no compartido si actúa como proveedor de servicios. Si no, marcar Fotos como compartidas. Pregunta abierta | Importante |
| 25 | Apple 1.2: textos de perfil y chat sin filtro de contenido objetable. Tampoco consta que haya que **aceptar términos con tolerancia cero** antes de publicar | Señalado como pendiente con preguntas | Bloqueante si no existe la aceptación de términos (rechazo habitual en apps con chat) |

## Inventario (datos-recopilados.md)

| # | Problema | Corrección | Gravedad |
| --- | --- | --- | --- |
| 26 | No incluía `avatar_url`, los buckets ni OpenAI. Decía «no se declaran permisos de biblioteca de fotos», aunque app.json tiene `expo-image-picker` | Añadido | Importante |
| 27 | No incluía las tablas de bloqueo y reporte. D11 dice «pendientes de aplicar» y D09 dice «aplicadas» | Añadidas, con las columnas pendientes de completar desde las migraciones. Contradicción señalada | Importante |
| 28 | Decía que no hay baja de cuenta («Borrarlo todo» sin efecto) | Corregido según D09 | Importante |
| 29 | Tablas de Lock-In descritas como activas | Movidas a «inactivas» | Menor |

## app.json

| # | Problema | Corrección propuesta (no se ha modificado app.json) | Gravedad |
| --- | --- | --- | --- |
| 30 | El plugin `@config-plugins/react-native-webrtc` sigue presente. Su texto de cámara y micrófono dice «para la llamada de vídeo de la sesión Lock-In», una función oculta. Pide micrófono sin uso visible y compite con el texto de cámara de `expo-image-picker` por `NSCameraUsageDescription` | Retirar el plugin. Mantener solo el texto de image-picker («…para hacerte la foto de perfil»). Apple 5.1.1 exige que el texto de cada permiso explique un uso real | Bloqueante |
| 31 | `android.permission.RECORD_AUDIO` y `SCHEDULE_EXACT_ALARM` sin función visible. SCHEDULE_EXACT_ALARM exige una declaración en Play Console con un uso permitido que ya no existe | Retirarlos. Revisar el manifiesto final del AAB | Bloqueante (Google) |
| 32 | Código Lock-In oculto en el binario (funciones ocultas o inactivas) | Retirarlo o desactivarlo de verdad en la build de tienda (Apple 2.3.1) | Importante |
| 33 | `expo-notifications` y `expo-secure-store`: no consta su uso tras el pivote | Pregunta: ¿se usan? Si no, retirarlos | Menor |
| 34 | Nombre `cofounder` en iOS/Android, bundle/package `app.cofounder.mobile` y scheme `cofounder`: coherentes. El slug `lockin` no se ve en las tiendas | Sin cambios | — (correcto) |
| 35 | «cofounder» es una palabra genérica: puede estar ya ocupada como nombre en App Store o tener riesgo de marca | Pregunta: reservar el nombre en App Store Connect cuanto antes. Tener una alternativa (p. ej. «cofounder: encuentra socio») | Importante |

## Otros requisitos de tienda

| # | Problema | Gravedad |
| --- | --- | --- |
| 36 | Las URLs de privacidad, soporte, eliminar cuenta y normas (GitHub Pages) están «por crear». Las dos tiendas las exigen y deben funcionar. Google exige además la URL de eliminación de cuenta y, en la categoría Social, unas normas públicas de seguridad infantil | Bloqueante |
| 37 | La política dice que la app enlaza las normas, pero no consta que haya un enlace a la privacidad dentro de la app (Apple 5.1.1(i)) | Importante |
| 38 | Clasificación de edad: mínimo de 16 autodeclarado, coherente en todos los documentos. Declarar UGC + chat + fotos. No reducir la clasificación calculada | — (correcto) |
| 39 | El soporte con Gmail personal es aceptable, pero D02 recomienda un buzón dedicado | Menor |

## Preguntas abiertas (no inventadas; las tiene que resolver el responsable)

1. ¿Reportar existe en la UI actual? (El encargo solo menciona bloquear; privacidad/D11 dicen bloquear y reportar.) Sin reporte no se debe enviar.
2. ¿La app pide aceptar normas/términos (tolerancia cero con el contenido abusivo) antes de publicar contenido o chatear?
3. ¿Los icebreakers son fijos o se generan con IA? Si los genera un proveedor, hay que declararlo.
4. OpenAI: ¿API con DPA? ¿Retención? ¿Sin entrenamiento? ¿Proveedor de servicios a efectos de Google?
5. ¿Qué pasa con las imágenes de `avatar-uploads` tras la moderación o un rechazo? ¿Bucket `avatars` público o privado?
6. ¿Se sigue pidiendo «Qué busco» (`looking_for`) y escribiéndose `active_mode`?
7. ¿Hay notificaciones (match/mensaje) en la versión actual?
8. ¿El código Lock-In y WebRTC sale del binario de tienda?
9. ¿Hay datos de pruebas en las tablas Lock-In en producción?
10. Proveedor SMTP definitivo y categoría secundaria de Apple.
