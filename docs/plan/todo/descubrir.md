# TODO — descubrir

## Deck de swipe
- [x] Componente de tarjeta de perfil (avatar/iniciales, nombre, especialidades, qué busca, prompt destacado)
- [x] Gesto de swipe (like derecha / pass izquierda) con `react-native-gesture-handler` + `react-native-reanimated` (ya instalados por el scaffold — no añadas otra librería de swipe)
- [x] Botones alternativos de like/pass (accesibilidad — no todo el mundo usa gesto)
- [x] Feedback visual claro al soltar (etiqueta LIKE / PASS)

## Filtro por modo
- [x] El deck respeta el modo activo del usuario (Par / Lock-In / ambos)

## Matching
- [x] Lógica mock: dar like a un perfil "sembrado" como recíproco genera match
- [x] Guardar el match a través de la capa de datos de `arquitecto`

## Pantalla de match
- [x] Modal/pantalla de "¡Match!" con opción directa de ir al chat
- [x] Estado vacío del deck (cuando no quedan perfiles) con mensaje útil, no una pantalla en blanco

## Especialidades buscadas en el deck (2026-09-07)
- [x] La tarjeta separa **lo que domina** de **lo que busca**: dos filas etiquetadas con los mismos acentos que `ProfileDetails` (verde-azulado / latón). En una sola lista de chips no había forma de saber cuál era cuál, y son datos opuestos
- [x] El chip de modo pasa a neutro (`Quiere: Cofundador`): antes era verde-azulado y ahora ese acento significa «domina»
- [x] Complementariedad visible **antes** del swipe: lo que yo domino ∩ lo que esa persona busca sale en latón sólido y con "✓" delante, más un `✓ Encajas` en la cabecera. El "✓" está a propósito — el color solo no lo lee un lector de pantalla ni quien no distingue latón de latón suave
- [x] El modal de match lo nombra ("Y busca justo lo que tú dominas: …"): es el mejor icebreaker que hay y llega justo cuando se decide si abrir el chat
- [x] `src/features/discover/complement.ts` + tests. Vacío cuando el perfil es `lockin` (no se elige por skills) y cuando `seekingSpecialties` está vacío (eso es «abierto a cualquiera», no «encajas con todo»)
- [x] La pantalla lee el perfil propio solo para esto; mientras carga, la tarjeta simplemente no resalta nada

### Lo que NO se ha tocado, y por qué
**La lógica de matching sigue igual: un match es un like recíproco.** Se evaluó
resaltar la complementariedad *dentro* del match y se descartó:

- Condicionarlo rompería el contrato de `src/data/repositories.contract.ts` («un
  like recíproco crea el match») y la RPC `record_decision()` de Supabase, que
  es SQL fuera del alcance de este bloque.
- Rankear el deck por complementariedad tocaría `discovery.getDeck`, o sea
  `src/data/`. `ProfileFilter.specialties` sigue filtrando por lo que la otra
  persona **domina**; un filtro sobre lo buscado sería otro campo y lo pide este
  bloque antes de que nadie lo añada.
- La complementariedad es una señal **para quien decide**, no una puerta. Puesta
  en la tarjeta llega antes del swipe, que es donde cambia algo; puesta en el
  match llegaría cuando ya no se puede hacer nada con ella.

Si en algún momento se quiere que pese de verdad, el sitio es el orden del deck
(que la traiga `getDeck`), no el match — y hay que pedírselo a `datos`.
