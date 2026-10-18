# Normas de la comunidad de cofounder

> Documento redactado el 14 de octubre de 2026 a partir de las normas que ya publicaba la web. La versión y la fecha son las que registrará la aceptación dentro de la app.

**Versión:** 1.1

**Fecha de la versión:** 18 de octubre de 2026

cofounder conecta a personas para valorar si pueden fundar algo juntas. Para que sea un sitio seguro, estas normas valen en perfiles, fotos, tablones, respuestas, enlaces y mensajes. Forman parte de los [términos de uso](https://thejowe.github.io/cofounder-web/terminos).

## Tolerancia cero

cofounder tiene **tolerancia cero con el contenido y las conductas abusivas**. Retiramos el contenido, suspendemos o eliminamos la cuenta y, cuando la ley lo exige, lo comunicamos a las autoridades.

## Qué no se permite

- Acoso, amenazas, intimidación, insultos o discriminación por cualquier motivo.
- Contenido sexual, desnudos o proposiciones sexuales.
- Cualquier contenido que sexualice, explote o ponga en riesgo a menores.
- Violencia gráfica o incitación a la violencia o al odio.
- Suplantar la identidad de otra persona o crear perfiles falsos.
- Estafas, spam, captación de dinero o promoción de productos no solicitada.
- Compartir datos personales de terceros sin su permiso.
- Usar la app como app de citas o como bolsa de empleo.
- Cualquier actividad ilegal.

## Qué es y qué no es cofounder

cofounder no es una app de citas ni una bolsa de empleo. No ofrece asesoramiento legal ni financiación y no garantiza resultados. El distintivo «GitHub verificado» indica que el enlace de GitHub pertenece a quien lo publica; no verifica a la persona.

## Edad mínima

Hay que tener 16 años o más. Eliminamos las cuentas de personas menores de esa edad en cuanto las detectamos.

## Fotos

La foto de perfil y las fotos del tablón son opcionales. Se revisan automáticamente antes de publicarse, junto con el texto de cada foto del tablón, y no se publican si no superan esa revisión o si no se puede hacer. Solo puedes subir fotos tuyas o sobre las que tengas permiso, y en el tablón no muestres a otras personas sin su permiso.

## Seguridad infantil

Tolerancia cero con el abuso y la explotación sexual infantil (CSAE). Cualquier contenido o conducta que ponga en riesgo a una persona menor se retira, se suspende la cuenta y se comunica a las autoridades competentes. Los detalles están en nuestros [estándares de seguridad infantil](https://thejowe.github.io/cofounder-web/seguridad-infantil).

## Cómo bloquear y reportar

Desde el perfil de cualquier persona, en el deck o en el chat, puedes **bloquearla** (deja de poder verte y escribirte) o **reportarla**, eligiendo un motivo y, si quieres, añadiendo un texto. En el chat también puedes reportar un mensaje concreto. También puedes escribirnos a cofounder.soporte@gmail.com.

## Qué hacemos con un reporte

- Los revisamos en un máximo de 72 horas.
- Los que afectan a menores o contienen contenido sexual, en un máximo de 24 horas.
- Según la gravedad, avisamos, retiramos contenido, suspendemos o eliminamos la cuenta.
- Conservamos los reportes como máximo 12 meses desde que se crean.

Si estás en peligro inmediato, llama al 112. Si eres menor y necesitas ayuda, en España puedes llamar al 116 111 (Fundación ANAR).

---

Nota editorial, a retirar del texto publicado:

- Los plazos de 72 h y 24 h son un compromiso operativo del responsable (D11), no una regla del código. La conservación de 12 meses sí la impone `purge_old_user_reports()`.
- Reportar existe para perfiles (`report_profile`) y, desde el 14-oct, para un mensaje concreto (`report_message`, `message-report-panel.tsx`).
- El bloqueo funciona en las dos direcciones: comprobado en `has_profile_block` (20261009224000).
