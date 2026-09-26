# acuerdo — Acuerdo de socios a ciegas (Fase 3)

Spec: `docs/superpowers/specs/2026-09-24-acuerdo-socios-design.md`
Plan: `docs/superpowers/plans/2026-09-24-acuerdo-socios.md`

## Tareas

- [x] Tarea 1 — Catálogo y estado por tema (`src/features/agreement/topics.ts`, `status.ts`)
- [x] Tarea 2 — Migración SQL y cobertura en PGlite
- [x] [Claude] Tarea 3 — Dominio, contrato y mock
- [x] [Claude] Tarea 4 — Repositorio de Supabase (`5040ea3`; CI verde, run 36066497602; contrato verde, run 36067948181). Revisada el 2026-09-26 contra el plan: mapeo LI004/LI005/23514, deps como `sessions.ts`, registro y fixture correctos; solo se reordenó el import en `supabase/index.ts`. Estaba en `[Codex]` y pasa a `[Claude]` por decisión del usuario (sin Codex en este dispositivo), no porque cambiara el criterio
- [x] [Claude] Tarea 5 — Hook `useAgreement` y `TopicRow`. Hecha el 2026-09-26 con los tests del plan (Review Focus 1 y 3 en el hook, 2 en `TopicRow`) y cuatro más: nota de solo espacios → `null`, botón deshabilitado mientras `saving`, y dos arreglos sobre el código del plan (mi clave desconocida cuenta como no respondida también en la fila, no solo en `topicStatus`; y el editor se resincroniza con la respuesta guardada al abrirse). `npx jest src/features/agreement` (30), `tsc`, lint y `npm test` con cobertura sobre el suelo. Estaba en `[Codex]` y pasa a `[Claude]` por decisión del usuario (sin Codex en este dispositivo), no porque cambiara el criterio
- [x] [Claude] Tarea 6 — Tarjeta, pantalla, ruta y cruce con `chat`. Hecha el 2026-09-26: `AgreementCard` debajo de `SessionCard` (y `gap` en `styles.lockIn` para separarlas), pantalla `/agreement/[matchId]` con aviso legal fijo, `Stack.Screen` con cabecera. Sobre el plan: el match perdido usa el titular real de `MissingMatch` («Esta conversación no está disponible»), el enlace «Volver a Matches» no sale mientras carga, y un fallo de carga que no es LI004/LI005 da «Reintentar» (test propio, igual que el de guardar fallido). `tsc` sin `.expo/types/router.d.ts` local (obsoleto, como en CI), lint, export web y los 62 tests de acuerdo + `matchId` + `layouts`
- [x] Tarea 7 — E2E en la variante `supabase` (`936ae51`). Step 1 comprobado en verde: el match del recorrido es `par` (`prepareAgreement` lo afirma y pasó). `agreement.yaml` encadenado tras `session-streak.yaml`; `agreement.test.mjs` entra por el glob de `test:e2e`, así que no hizo falta tocar `package.json`. En Actions, `E2E Android` [run 36250919159](https://github.com/thejowe/lockin/actions/runs/36250919159) verde en las tres variantes; en la `supabase`, el log dice `[Passed] Acuerdo de socios a ciegas desde el chat (22s)` seguido de `Postgres: respuesta del acuerdo verificada.` y el veredicto `recorrido, persistencia, sesión Lock-In y acuerdo verificados`. La variante `mock` (control negativo) sin cambios. Ruido conocido: Maestro escribe un `Stream Closed` de log4j en `agreement/maestro.log` al cerrar la sesión, después del `Passed`; no afecta al veredicto
- [x] Tarea 8 — Verificación final y cierre, el 2026-09-26 sobre `936ae51` (Linux, así que `format:check` y `test:e2e` sí valen como veredicto aquí):
      `npx tsc --noEmit` y `npm run lint` limpios; `npm run format:check` limpio;
      `npx jest --coverage`: 91 suites pasan (1 saltada), 1036 tests pasan y 110 saltados,
      cobertura 95.09/90.14/94.75/96.49 sobre el suelo 89.82/82.56/91.49/91.38;
      `npm run test:schema` 21/21; `npm run test:e2e` 93/93; `npx expo export --platform web` en verde.
      En Actions sobre el mismo commit: `CI` verde entera, «Formato» incluido
      ([run 36250919284](https://github.com/thejowe/lockin/actions/runs/36250919284)); `E2E Android` verde (arriba);
      `Schema drift` ([run 36250919107](https://github.com/thejowe/lockin/actions/runs/36250919107)): job local verde y
      remoto **rojo a propósito**. Su `remote.diff` es exactamente lo que falta por aplicar, todo en dirección «esperado sí, observado no»:
      la tabla `agreement_answers` (6 columnas, 6 `constraint`, índice de la PK, `rls=t`), su política
      «solo lees las tuyas», sus `grant`, y `answer_agreement_topic()` y `match_agreement()` con sus `EXECUTE`. Nada más.
      El paso del `comprobador` (Step 4) no se pudo lanzar desde esta sesión, que corría en un contenedor sin emulador ni KVM: queda como casilla abierta más abajo.
      Tampoco se pudo actualizar la memoria `schema-drift-remoto-rojo-esperado.md` (Step 3), que vive en la máquina del usuario y no en el repo: la excepción queda registrada aquí, en «Pendiente del usuario»
- [ ] [comprobador] Recorrer el acuerdo en el emulador (mock y Supabase local)

## Pendiente del usuario

- [ ] Aplicar `supabase/migrations/20260924000200_agreement_answers.sql` en
      `grrzmzktrhksbttpbblg` por el SQL Editor. Hasta entonces, `Schema drift`
      remoto está rojo **a propósito**: excepción vigente desde el 2026-09-26, con el
      `remote.diff` limitado a `agreement_answers`, su política y las dos
      funciones (ver Tarea 8). Se cierra cuando el usuario la aplica y el
      siguiente run da «Sin diferencias.»; desde ahí, un rojo del job remoto
      vuelve a ser deriva real. Falta además anotar esta excepción en la
      memoria local `schema-drift-remoto-rojo-esperado.md` (y su línea en
      `MEMORY.md`), que no está en el repo.

## Hallazgos del comprobador
