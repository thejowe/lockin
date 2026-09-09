# TODO — perfil

## Onboarding
- [x] Pantalla de selección de modo (Par / Lock-In / ambos)
- [x] Guardar el modo elegido (a través de la capa de datos de `arquitecto`)

## Formulario de perfil
- [x] Campos: nombre, edad, ubicación/zona horaria
- [x] Especialidades (selección múltiple de tags)
- [x] Qué busco (Cofundador / Compañero de lock-in / Ambos)
- [x] Qué debe dominar quien busco (mismos tags; solo en Cofundador / Ambos)
- [x] Punto de partida (las 3 opciones de `docs/plan/CONCEPTO.md`)
- [x] Disponibilidad (horas/semana + franja horaria)
- [x] Ambición/compromiso (escala o selección)
- [x] Enlaces opcionales (GitHub / portfolio / LinkedIn)
- [x] 1-2 prompts de texto libre corto
- [x] Validación básica (campos obligatorios mínimos)

## Teclado de los campos de texto
- [x] Cada `TextField` declara `autoCapitalize` y `autoCorrect` según lo que significa el campo
- [x] La respuesta a un prompt no se title-casea (`sentences`, corrector apagado)
- [x] Ubicación capitaliza por palabras (topónimo) y no la corrige el diccionario
- [x] Test unitario que cae si alguien quita cualquiera de los dos props, y que cuenta los campos para que uno nuevo no se cuele
- [ ] Confirmar en emulador que el auto-capitalizado no vuelve — hace falta más de un verde (ver abajo)

## Perfil propio
- [x] Pantalla de ver/editar perfil en la tab Perfil
- [x] Reutilizar el formulario de creación para la edición
- [x] Distinguir de un vistazo "lo que domina" de "lo que busca" en la ficha

## Datos de ejemplo
- [x] Al menos 6-8 perfiles mock variados (distintos modos, especialidades, puntos de partida) para que `descubrir` tenga un deck creíble
- [x] Al menos 2 de esos perfiles "sembrados" para dar match recíproco en el mock de `descubrir`
- [x] La tarjeta de delante del deck es uno de los recíprocos, y lo es por puntuación estricta (no por el desempate de `id`)
- [x] `supabase/seed.sql` cuenta la misma historia que `src/data/mock/seed.ts`

## Dónde ha quedado

- `src/features/profile/` — `catalog.ts` (opciones y etiquetas), `controls.tsx` (primitivas de formulario), `profile-form.tsx` (formulario único de alta y edición), `profile-details.tsx` (ficha en lectura), `profile-avatar.tsx`.
- `seekingSpecialties` (contrato de `arquitecto`): el formulario lo pregunta solo cuando `lookingFor` es `par` o `ambos` —`catalog.ts:seeksComplement`— y lo envía vacío en cualquier otro caso, aunque se hubieran marcado chips antes de cambiar de modo. La ficha lo pinta en latón, debajo de lo que domina (verde) y separado por una línea; vacío se lee como "Abierto a cualquier especialidad", que es lo que significa en el dominio. Los chips de este grupo llevan `accessibilityLabel` "Busco X" para no compartir nombre accesible con los de lo que domina.
- Rutas: `src/app/(onboarding)/mode.tsx`, `src/app/(onboarding)/profile-form.tsx`, `src/app/(tabs)/profile.tsx` — ya no usan `ScreenPlaceholder`.
- Catálogo mock: `src/data/mock/seed.ts`, 8 perfiles y 3 recíprocos (uno por modo, para que cualquier filtro de `descubrir` tenga match posible).
- Teclado (2026-09-08): la respuesta al prompt llegaba a Postgres capitalizada palabra por palabra —'Una Herramienta para Construir en equipo' tecleado en minúsculas— porque era el único campo sin `autoCapitalize` ni `autoCorrect`. Ahora los nueve campos los declaran: `words` para nombre y ubicación (nombres propios), `sentences` para las respuestas libres, `none` para edad, zona horaria y enlaces; el corrector va apagado en todos, incluidos los nombres propios, porque el diccionario los reescribe. Lo cubren dos tests en `profile-form.test.tsx`: uno por campo contra la tabla `KEYBOARD_BEHAVIOUR`, y otro que cuenta los `TextInput` del árbol para que un campo nuevo sin props rompa la suite en vez de colarse.

- Tarjeta de delante del deck (2026-09-09): el E2E `mock` moría en el comando 37 de 38 con `Assertion is false: "¡Match!" is visible` — [run 34283362375](https://github.com/thejowe/lockin/actions/runs/34283362375/job/102253132068). No era el recorrido: `getDeck` ordena por complementariedad mutua y desempata por `id`, y para el perfil que teclea el `.yaml` (domina Desarrollo y Marketing, busca Diseño) empataban **dos** perfiles en la puntuación máxima —Marc y Lucía, los dos «diseño buscando desarrollo»—; ganaba `seed-lucia` por alfabético y Lucía no está en `SEED_RECIPROCAL_IDS`, así que el like no podía cerrar match.

  **Por qué el arreglo es cambiar a Lucía y no meterla en los recíprocos.** Meterla habría puesto el verde en el sitio, pero deja el defecto intacto: dos de ocho perfiles ocupando la misma casilla en un catálogo cuya cabecera presume de cubrir el abanico —y el empate siguiente, con otro perfil propio, habría vuelto a salir por donde nadie mira. El defecto real es que Lucía busca `dev`/`producto`, que es lo mismo que buscan Marc y Diego, y contradice su propio prompt: fundió una marca de cerámica preciosa que no vendió nada y aprendió a validar antes. Lo que busca es quien venda y quien mida. Con `['ventas', 'datos']` la puntuación máxima vuelve a ser única (Marc, que sí es recíproco), el desempate de `id` deja de decidir nada, y `datos` pasa a estar buscado por alguien, que antes no lo estaba por nadie. Orden resultante: `seed-marc > seed-diego > seed-ines > seed-lucia > seed-nuria > seed-alba > seed-omar > seed-tomas`.

  No se tocó `e2e/`, ni la aserción del match, ni `getDeck`. La variante `supabase` lo había resuelto por su lado (`e2e/incoming-likes.sql`, de `calidad`, sube a Núria a puntuación 2 y su UUID es el más bajo); el mock no tiene esa palanca porque el `update` es de la base desechable de e2e, así que el arreglo tenía que estar en el catálogo.

  Lo fija `src/data/mock/seed.test.ts`, con la invariante escrita: **quien encabeza el deck tiene que estar en `SEED_RECIPROCAL_IDS`, y por puntuación estricta**. Está en `npm test` y no en `e2e/` a propósito: un fallo de catálogo debe caer en segundos, no media hora después en un emulador. Verificado por mutación — los dos casos caen con el catálogo anterior.

  Asimetría que queda anotada y no se ha tocado: el desempate por `id` no ordena igual en los dos backends (aquí `seed-<nombre>`, alfabético; en Postgres UUID por orden de siembra), así que dos perfiles empatados salen en distinto orden en mock y en Supabase. Deja de importar en cuanto la cabeza del deck no empata, que es lo que ahora garantiza el test, pero si alguna vez hace falta que el deck entero coincida, la palanca es renombrar los ids del mock con su ordinal.

- `supabase/seed.sql` se actualizó con el mismo cambio (fila de Lucía y la receta de `update` comentada del final). Su cabecera lo exige: es el catálogo del mock traducido a filas reales, y dos catálogos con historias distintas hacen que "funciona con el mock" no signifique nada. No es un archivo de `e2e/`.

- Teclado, estado real (2026-09-09): `autoCapitalize` **sí sigue puesto**. Los ocho `<TextField>` de `profile-form.tsx` lo declaran junto con `autoCorrect={false}` (nueve `TextInput` renderizados: el del prompt se pinta dos veces), y `controls.tsx:TextField` los reenvía al `TextInput` nativo con `{...rest}`, así que llegan. El APK del run rojo ya los llevaba: `48c1ac6` es ancestro de `e0f4ca7`. Ninguna capitalización sale de código nuestro — lo único que llama a `toUpperCase` son las iniciales del avatar.

  Pero el verde **no lo cierra**, por lo que documenta `calidad.md:826`: el auto-capitalizado es intermitente (dos runs sobre el mismo commit `91e98a1`, uno murió en `verify.mjs:27` con `'Una Herramienta para Construir en equipo'` y el otro pasó de largo). Y de los tres verdes seguidos de `supabase` solo **uno** —`e0f4ca7`, run 34283362375— lleva el arreglo dentro: `78c90b8` y `0149634` salen de la rama de `calidad`, que forkeó antes. Un verde con ~50% de intermitencia medida es 50% de probabilidad de falso negativo. Lo que lo cierra es acumular pasadas de `supabase` sobre commits que contengan `48c1ac6`, cada una comparando la cadena exacta en `verify.mjs:27`; a cinco seguidas el falso negativo baja al 3%. Contador: **1**. Los tests unitarios no pueden ayudar aquí —renderizan sin IME, así que prueban que los props están declarados, no que Android los respete.

## Recuerda
Nadie contrata a nadie: no metas campos de "salario" o "equity que ofrezco" — eso es Modo Talento, Fase 4, fuera de este MVP.
