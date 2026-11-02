# Idiomas (es / en / ca)

Decidido con el usuario el 2026-11-02: la app detecta el idioma del móvil y se puede cambiar en
Ajustes. Sin pantalla de elegir idioma al entrar. Español, inglés y catalán; si el móvil no pide
ninguno de los tres, inglés.

## Cómo funciona

- **La clave es el texto en español:** `t('Registrarse')`. `src/i18n/en.json` y `ca.json` traducen frase a
  frase; el español no tiene diccionario. `src/i18n/i18n.test.ts` recorre `src/` y falla si falta o sobra
  una clave o si no coinciden las `{variables}`.
- **Texto nuevo visible: siempre con `t()`.** En un módulo, `t()` no vale porque se evalúa al importar:
  las tablas usan getters y las constantes sueltas, `tk()`, con `t()` donde se pintan.
- **Frases enteras, nunca trozos:** «por la {x}» no funciona en catalán («al matí»). Ver `timeBandPhrase`.
  En catalán, evitar «de {nombre}» por el apóstrofo.
- **Lo que se guarda no se traduce:** las preguntas de perfil se siguen guardando en español y se traducen
  al pintarlas, así cada persona las lee en su idioma.
- **Cambiar de idioma** vuelve a montar la navegación (`key={locale}` en `_layout.tsx`).
- **E2E:** `run.mjs` compila con `EXPO_PUBLIC_FORCE_LOCALE=es`, porque los flujos buscan textos en español y
  el emulador arranca en inglés. Los tests de Jest corren en español (`jest.setup.js`).
- **Legal:** `docs/tiendas/{en,ca}/*.md` → `LEGAL_TRANSLATIONS` en `texts.generated.ts`. Al cambiar un
  documento en español hay que cambiar sus copias: `legal.test.tsx` compara secciones, enlaces y cifras.

## Hecho

- [x] Módulo `src/i18n`, detección con `expo-localization`, preferencia guardada, selector en Ajustes.
- [x] Interfaz, errores, catálogos, países, fechas y acuerdo de socios envueltos y traducidos.
- [x] Nombre de la app y permisos de iOS por idioma (`locales/`, `app.json`).
- [x] Filtro de contenido: mensaje traducido y lista ampliada con catalán.
- [x] Textos legales en inglés y catalán dentro de la app.
- [x] Plantillas de correo con los tres idiomas en el repo; la app guarda `locale` en los metadatos.
- [x] Comprobado en web con mock (Chrome sin interfaz): detección es/en/ca/fr, selector, persistencia.

## Pendiente

- [ ] **Del usuario: revisión legal** de `docs/tiendas/{en,ca}/`. Son traducciones sin revisar y hoy ya se
  enseñan en la app. Decidir también si el español prevalece en caso de discrepancia; eso cambiaría los
  términos y obligaría a subir `TERMS_VERSION`.
- [ ] **Del usuario: revisar el catalán y el inglés** con ojos nativos: nadie ha leído aún las pantallas enteras.
- [ ] **Plantillas de correo: sin aplicar en producción.** Probarlas antes con una cuenta de prueba, ver
  `supabase/templates/README.md`. Mientras tanto, los correos salen en español.
- [ ] [comprobador] Build nativa nueva (`expo-localization` no llega por OTA): idioma del sistema, selector,
  cambio de idioma del móvil con la app abierta en Android, permisos en cada idioma. En este equipo no hay emulador.
- [ ] Fichas de App Store y Play en inglés y catalán.
- [ ] Web pública (`web/`, `build-web.mjs`): sigue solo en español, y los enlaces legales de las tiendas apuntan ahí.
- [ ] El documento legal dice «Perfil > Cuenta > Eliminar mi cuenta» y desde el 2026-11-01 está en Ajustes
  (también en español): corregirlo sube la versión.
