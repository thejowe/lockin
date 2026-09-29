# visual — pulido visual de la app

Bloque 13 de `PLAN.md`. Agente: `.claude/agents/visual.md`. Abierto el 2026-09-29
a petición del usuario («tenemos que mejorar la parte visual de la aplicación»).
Todos los bloques de producto están cerrados; este pule lo que ya existe sin
tocar lógica ni datos.

## Auditoría

- [ ] **[Claude]** Auditoría visual de todas las pantallas con `impeccable` +
  `redesign-existing-projects` (y `find-animation-opportunities` /
  `improve-animations` para el movimiento): hallazgos priorizados con
  `archivo:línea`, capturas «antes» en web (390×844, claro y oscuro). Escribirla
  aquí debajo antes de tocar código.

## Tokens

- [ ] **[Claude]** Afinar `src/constants/theme.ts`: escala tipográfica,
  espaciado, radios, elevación y tokens de movimiento (duraciones, springs).
  `theme.test.ts` sigue verde con `KNOWN_GAPS` vacío.
- [ ] **[Claude]** Sustituir números sueltos de estilo en pantallas por tokens.

## Pantallas (por impacto)

- [ ] **[Claude]** Descubrir: tarjeta, deck, feedback de like/pass, modal de match.
- [ ] **[Claude]** Onboarding (selección de modo, formulario) y perfil propio.
- [ ] **[Claude]** Matches y chat (lista, burbujas, icebreakers, tarjeta de sesión).
- [ ] **[Claude]** Sesión (Pomodoro, presencia, valoración) y acuerdo.
- [ ] **[Claude]** Estados vacíos, de carga y de error coherentes en toda la app.

## Movimiento

- [ ] **[Claude]** Swipe con física de spring e interrupción limpia; entrada del
  match; press states. Todo respeta reduced-motion.

## Cierre

- [ ] **[Claude]** `tsc`, lint, jest con cobertura sobre el suelo, export web, y
  los `e2e/*.yaml` sin textos rotos. CI verde en Actions.
- [ ] **[comprobador]** Recorrido completo en el emulador (mock) con capturas
  antes/después de cada pantalla pulida.

## Registro

