# Guía de publicación — cofounder (App Store y Google Play)

Fecha: 14-oct-2026. Basada en el código real (ver `AUDITORIA-CUMPLIMIENTO.md`, hallazgos «C#») y en `tiendas-revisadas/` (fichas y cuestionario ya corregidos: no se repiten aquí). **[?]** = dato desconocido que debe confirmar Jowe. Los importes y plazos son los publicados por Apple/Google a esta fecha; compruébalos al pagar.

## 0. Ruta crítica (resumen)

```
Día 0  ─ Pagar Google Play (25 USD) + verificación de identidad ──┐
       ─ Inscribirse en Apple Developer (99 USD/año)               │ en paralelo
Día 0-3 ─ Arreglar bloqueantes de código (PROMPT-CLAUDE.md) y web  │
Día 3  ─ Build AAB → Play: ficha mínima + Data safety + prueba CERRADA con ≥12 testers
Día 3-17 ─ 14 días seguidos con ≥12 testers inscritos (no bajar de 12: meter 15-20)
          (mientras: TestFlight + envío a Apple; Apple suele publicar en 1-3 días)
Día 17 ─ Solicitar acceso a producción en Play (revisión ≤7 días aprox.)
Día ~24 ─ Producción Google (+ revisión de la versión, hasta varios días)
```
El cuello de botella es **Google: 12 testers × 14 días continuos** (solo cuentas personales creadas después del 13-nov-2023; las de organización están exentas). Fuente: https://support.google.com/googleplay/android-developer/answer/14151465 . Empezar la prueba cerrada **lo antes posible**, aunque sea con una build imperfecta: se pueden subir versiones nuevas durante los 14 días sin reiniciar el contador.

## 1. Antes de nada (bloqueantes, ver auditoría)
- [ ] C8 aceptación de normas/términos antes del perfil · C9 enlaces a privacidad/normas en la app · C10 política revisada publicada · C15/C16 quitar permisos y WebRTC · C17 decidir sobre el acuerdo en el chat · C29 variables de entorno en la build `production`.
- [ ] Web (GitHub Pages) funcionando: `/privacidad/`, `/soporte/`, `/eliminar-cuenta/`, `/normas/`, y nuevas `/terminos/` y `/aviso-legal/` (LSSI art. 10: nombre, NIF **[?]**, dirección **[?]**, email). Activar Settings → Pages → Source: GitHub Actions y que el workflow corra en la rama que se use.
- [ ] Cuenta de prueba para revisores (email+contraseña, email ya verificado, perfil completo) y al menos 2-3 perfiles de prueba visibles en el deck, uno con match ya hecho y mensajes (para que el revisor vea chat, bloquear y reportar sin esperar a otra persona).
- [ ] Borrar datos de prueba Lock-In en producción (4 sesiones, 4 salas) — decisión de Jowe.

## 2. Apple

### 2.1 Programa de desarrolladores
- **Individual**: 99 USD/año (en España se cobra en euros, ~99 €), con Apple ID con 2FA y DNI. Aparece el **nombre personal** de Jowe como vendedor. Alta en 24-48 h normalmente. https://developer.apple.com/programs/enroll/
- **Organización**: requiere entidad jurídica (S.L.), número **D-U-N-S** gratuito (puede tardar hasta ~2 semanas) y web de la empresa. Muestra el nombre de la empresa.
- Recomendación: **individual** salvo que ya exista sociedad. **[?]** ¿Hay S.L.?

### 2.2 App Store Connect
1. Business → aceptar acuerdos (Free Apps basta; sin precio no hacen falta datos bancarios/fiscales).
2. **DSA (Business → Compliance)**: declarar si eres «trader». Sin ingresos ni actividad comercial puedes razonar «no trader»; si eres trader, se publicarán dirección, teléfono y email verificados en la ficha UE. Decisión de Jowe. Sin declaración, la app **no se distribuye en la UE**. https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements
3. Certificates, IDs → registrar bundle id `app.cofounder.mobile` (EAS puede hacerlo solo).
4. Apps → Nueva app: plataforma iOS, nombre «cofounder» (si está ocupado: «cofounder: encuentra socio» **[?]**), idioma principal Español (España), bundle `app.cofounder.mobile`, SKU `cofounder-ios-001`, acceso completo. **Crear el registro ya reserva el nombre** (INF-35).

### 2.3 Build y TestFlight (EAS)
```
npx eas-cli login
eas build --platform ios --profile production      # Xcode 26 / SDK iOS 26 (obligatorio desde 28-abr-2026)
eas submit --platform ios --latest                  # sube a App Store Connect
```
- Añadir `ITSAppUsesNonExemptEncryption: false` (C24) para no responder exportación en cada build.
- TestFlight: testers internos (hasta 100, sin revisión) inmediato; externos requieren Beta App Review (~1 día).
- Revisar emails de App Store Connect tras la subida (avisos de privacy manifest, ITMS-91053, C25).

### 2.4 App Privacy (Nutrition label) — respuestas propuestas
¿Recopilas datos? **Sí**. ¿Tracking? **No** (no hay SDK publicitario ni IDFA; no se necesita ATT).

| Tipo Apple | ¿Se recopila? | Vinculado a identidad | Tracking | Finalidad |
|---|---|---|---|---|
| Contact Info → Email Address | Sí | Sí | No | App Functionality |
| Contact Info → Name | Sí (nombre del perfil) | Sí | No | App Functionality |
| User Content → Photos or Videos | Sí (foto opcional) | Sí | No | App Functionality (incl. moderación) |
| User Content → Other User Content (respuestas libres, perfil) | Sí | Sí | No | App Functionality |
| User Content → Emails or Text Messages (mensajes del chat) | Sí | Sí | No | App Functionality |
| User Content → Customer Support (reportes) | Sí | Sí | No | App Functionality |
| Location → Coarse Location | **No** como dato de ubicación del dispositivo; la ubicación es texto escrito por el usuario → declararla en «Other User Content» **[?] Jowe confirma que no se usa GPS** (no hay `expo-location` en el código) |
| Identifiers → User ID | Sí (UUID Supabase) | Sí | No | App Functionality |
| Other Data → edad, zona horaria, especialidades, disponibilidad, ambición | Sí | Sí | No | App Functionality |
| Usage Data / Diagnostics | **No** (no hay analítica ni crash reporting en el código) |
| Enlaces GitHub/LinkedIn/portfolio | Other User Content | Sí | No | App Functionality |

URL de política de privacidad: `https://<usuario>.github.io/<repo>/privacidad/` **[?] URL final**.

### 2.5 Clasificación de edad (cuestionario nuevo, obligatorio con preguntas de redes sociales desde sep-2026)
Fuente: https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/
- Contenido (violencia, sexual, drogas, juego, terror, medicina…): **Ninguno**.
- Capacidades: **User-Generated Content: Sí** · **Messaging and Chat: Sí** · Unrestricted Web Access: **No** (abre enlaces de perfil en el navegador del sistema, no un navegador propio) · Advertising: **No** · Social Media: **propuesta «No»** (no hay feed que amplifique contenido; solo deck 1:1 y chat privado) — interpretación, **[?] Jowe decide**; si se marca «Sí», mínimo 13+.
- Controles parentales / verificación de edad en la app: **No** (edad autodeclarada 16+).
- Resultado esperado probablemente 13+ o similar; en la descripción y normas dejar claro «solo mayores de 16». No rebajar la calificación calculada.

### 2.6 Resto de la versión
- Categoría principal: Redes sociales o Negocios (INF-7) **[?]**.
- Capturas: obligatorio iPhone 6,9" (1320×2868 o 1290×2796, vertical), 1-10 imágenes; sin iPad si `supportsTablet` no está activo (no lo está en `app.json`). Sin Lock-In, temporizadores, salas ni vídeo (INF-9).
- URL de soporte: `/soporte/`. Marketing (opcional): raíz de la web.
- Copyright: «2026 Jowe [apellido]» **[?]**.
- Notas para el revisor (plantilla):
  > App para encontrar cofundador entre pares (16+). Cuenta demo: email `[?]` / contraseña `[?]` (email ya verificado, perfil completo, con un match y conversación de ejemplo). Bloquear y reportar: menú «⋯» en la tarjeta del deck y en el chat. Borrar cuenta: Perfil → Cuenta → Borrar cuenta. Las fotos de perfil se revisan automáticamente antes de publicarse. Normas con tolerancia cero aceptadas en el registro; los reportes se revisan en menos de 24 h por el desarrollador. Sin compras ni publicidad.
- Precio: Gratis; disponibilidad: todos los países o solo UE/España **[?]**.
- Plazo de revisión: la mayoría en 24-48 h; un rechazo suma otro ciclo.

## 3. Google Play

### 3.1 Cuenta de desarrollador
- Pago único **25 USD**. https://support.google.com/googleplay/android-developer/answer/6112435
- Tipo **personal** (o organización con D-U-N-S, que evita los 12 testers). Verificación de identidad con documento oficial y verificación de dispositivo/teléfono; puede tardar varios días. Se muestra públicamente nombre y país; con monetización, también dirección.
- Cuenta nueva personal → **prueba cerrada obligatoria: ≥12 testers inscritos de forma continua 14 días** antes de solicitar producción.

### 3.2 Crear la app y requisitos técnicos
- Crear app: nombre «cofounder», idioma es-ES, App, Gratis, aceptar declaraciones.
- AAB con **targetSdk 36** (obligatorio para apps nuevas desde 31-ago-2026; Expo 57 lo trae por defecto, verificar). https://support.google.com/googleplay/android-developer/answer/11926878
```
eas build --platform android --profile production   # genera AAB
eas submit --platform android --latest --track internal   # la 1.ª subida a veces debe hacerse a mano en Play Console
```
- Play App Signing: aceptar.

### 3.3 «Contenido de la app» (Policy → App content) — respuestas propuestas
| Formulario | Respuesta propuesta |
|---|---|
| Política de privacidad | URL `/privacidad/` (versión revisada) |
| Acceso a la app | «Toda o parte de la funcionalidad está restringida» → credenciales demo (email/contraseña) + instrucciones; el email ya verificado |
| Anuncios | **No** contiene anuncios |
| Clasificación de contenido (IARC) | Categoría: «Redes sociales / comunicación» (o «Todas las demás»). Violencia/sexo/lenguaje/drogas/juego: No. **Interacción entre usuarios: Sí**. **Comparte información personal: Sí** (perfil visible a otros). **Ubicación compartida con otros usuarios: Sí** (ubicación escrita por el usuario, aproximada) **[?]**. Compras digitales: No. Resultado previsible: PEGI 12/16 con descriptor «Interacción de usuarios» |
| Público objetivo y contenido | Edades: **16-17 y 18+** (no seleccionar menores de 13; si se elige 16-17, Google exige cumplir políticas de familias parcialmente — alternativa conservadora: solo 18+ **[?] Jowe**). «¿Atrae a niños?» **No** |
| Apps de noticias | No |
| Seguridad de datos (Data safety) | Ver 3.4 |
| Eliminación de cuenta | Sí, in-app + URL web `/eliminar-cuenta/` |
| Apps gubernamentales | No |
| Funciones financieras | **No aplica** (ninguna) |
| Salud | **No aplica** |
| Normas de seguridad infantil (apps sociales) | URL `/normas/` (que trate explícitamente CSAE) + contacto `cofounder.soporte@gmail.com`; confirmar que se cumplen leyes y se reporta CSAM |
| ID de publicidad | **No** usa Advertising ID (verificar que el manifiesto final no incluye `AD_ID`) |
| Permisos sensibles | Tras quitar `SCHEDULE_EXACT_ALARM` no hay declaración. Si se mantiene, Play pedirá justificarla y será rechazada (sin uso permitido). Fotos: `expo-image-picker` usa el selector del sistema → no pedir `READ_MEDIA_IMAGES` (verificar manifiesto) |

### 3.4 Data safety — propuesta (coherente con Apple)
- ¿Recopila o comparte datos? **Sí recopila**; **no comparte** (Supabase y OpenAI actúan como proveedores de servicios — INF-24, **[?]** confirmar DPA OpenAI).
- Cifrado en tránsito: **Sí** (HTTPS). Borrado a petición: **Sí**.
- Tipos: Información personal → Nombre, Email, ID de usuario, «Otra información» (edad, especialidades, enlaces) · Fotos · Mensajes → «Otros mensajes en la app» · Ubicación aproximada → **[?]** (texto libre; si se considera ubicación, marcar «aproximada», opcional no) · Actividad en la app → «Otro contenido generado por usuario». Todos: obligatorios salvo foto y enlaces (opcionales); finalidad «Funcionalidad de la app», foto además «Seguridad/cumplimiento».
- No: Diagnósticos, Analíticas, Identificadores de dispositivo, Datos financieros, Salud, Contactos, Audio (tras quitar RECORD_AUDIO).

### 3.5 Prueba cerrada (12 × 14)
1. Testing → Closed testing → crear pista, subir AAB, países (España/UE).
2. Testers: lista de emails (Google Groups o lista) — reclutar **15-20** personas reales con cuenta Google para tener margen (si cae por debajo de 12, el contador reinicia). Cuenta propia no cuenta. **Brodie** puede coordinar.
3. Enviar el enlace de inscripción; cada tester debe aceptar e instalar desde Play.
4. Durante los 14 días: uso real (crear perfil, swipe, match, chat, reportar), recoger feedback, subir arreglos (no reinicia).
5. Día 15+: Dashboard → «Solicitar acceso a producción»: responder sobre cómo se reclutaron testers, feedback recibido, cambios hechos y preparación. Respuesta de Google normalmente ≤7 días; si deniega, seguir probando y volver a solicitar.
6. Producción: crear versión, revisión de la app (nuevas cuentas: suele tardar días, a veces más de una semana).

### 3.6 Ficha
Textos ya en `tiendas-revisadas/ficha-google-play.md`. Recursos: icono 512×512 PNG, gráfico de funciones 1024×500, 2-8 capturas de teléfono (lado entre 320 y 3840 px, proporción ≤2:1). Email de contacto obligatorio (se muestra públicamente).

## 4. Tras publicar
- Revisar reportes a diario (SLA 24 h) y documentar acciones.
- Responder solicitudes RGPD en ≤1 mes.
- Mantener el registro de actividades y actualizar la política ante cambios (p. ej. si vuelve Lock-In/vídeo).
