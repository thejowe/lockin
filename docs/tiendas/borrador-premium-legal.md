# Borrador legal de Premium (Fase 4) — fusionado el 2026-11-02

**Fusionado** en `terminos.md` (§10, versión 1.2), `privacidad.md` (versión 1.4), las dos fichas y
`cuestionario-privacidad.md`. Este archivo queda como histórico; las fuentes de verdad son esos documentos.

Estado: borrador del 2026-11-01. No sustituye a `terminos.md` ni a `privacidad.md`: se fusiona en ellos
**solo cuando existan las cuentas de Apple, Google y RevenueCat y los precios estén decididos**. Publicarlo
antes anunciaría una suscripción que la app todavía no puede cobrar. No es asesoramiento jurídico: entra en
la revisión del punto 8 de la lista de pendientes.

Precios confirmados por el usuario el 2026-11-01: 4,99 €/mes y 39,99 €/año. Prueba gratis: 3 días (confirmada por el usuario el 2026-11-01).

## Para `terminos.md` — nueva sección «Cofounder Premium» (entre §9 y §10)

**Qué incluye.** Cofounder Premium es una suscripción opcional que elimina el límite diario de likes y añade
Super Likes, deshacer el último gesto, Boost y ver quién te ha dado like. Cofounder sigue siendo gratuito sin
Premium y no muestra anuncios.

**Precio y renovación.** 4,99 € al mes o 39,99 € al año, impuestos incluidos, cobrados por Apple
App Store o Google Play. La suscripción se renueva sola al final de cada periodo salvo que la canceles al menos
24 horas antes. La primera vez que te suscribes tienes 3 días de prueba gratuita; si no cancelas al menos 24 horas antes de que termine, empieza el cobro del plan elegido. La prueba es una por persona y cuenta de tienda.

**Cómo cancelar.** Desde los ajustes de suscripciones de tu cuenta de Apple o Google (la app tiene el acceso
directo «Gestionar suscripción»). Borrar la cuenta de cofounder **no cancela** la suscripción en la tienda:
cancélala antes.

**Desistimiento y reembolsos.** El cobro lo hace la tienda, que gestiona los reembolsos según sus condiciones.
Al contratar, pides acceso inmediato al contenido digital y reconoces que pierdes el derecho de desistimiento
de 14 días en cuanto empieza a prestarse, salvo lo que la tienda te reconozca.

**Cambios de precio y fin.** Te avisaremos antes de cambiar el precio; la tienda te pedirá confirmarlo. Al
terminar el periodo pagado vuelves al plan gratuito sin perder tu perfil ni tus matches.

Al subir esta sección: `TERMS_VERSION` nueva y fecha de `terminos.md` actualizada (vuelve a pedir aceptación).

## Para `privacidad.md`

- **§2 (datos):** estado de suscripción (activa/no, producto, fecha de fin) y un identificador de cliente
  de RevenueCat igual al `uid`. No recibimos datos de tarjeta: los cobra la tienda.
- **§5 (servicios):** *RevenueCat* (encargado, EE. UU.): valida compras y mantiene el estado de la suscripción.
  Recibe el `uid` y los datos de la compra. Transferencia fuera del EEE por cláusulas contractuales tipo o DPF;
  comprobar el DPA de RevenueCat al firmarlo.
- **§7 (conservación):** el estado de suscripción se conserva mientras exista la cuenta; los registros de compra
  los conservan la tienda y RevenueCat según sus políticas.

## Para las fichas

- **App Store:** «Compras dentro de la app: sí»; App Privacy → *Purchases* (vinculado al usuario, no para
  seguimiento). Nota de revisión: Premium no desbloquea contenido ajeno a la app.
- **Google Play:** «Contiene compras en la app: sí»; Data safety → *Historial de compras* (recopilado,
  compartido con RevenueCat como encargado).
- Ambas: sin anuncios, sin cambio en la declaración de edad.
