# TODO — descubrir

## Deck de swipe
- [ ] Componente de tarjeta de perfil (avatar/iniciales, nombre, especialidades, qué busca, prompt destacado)
- [ ] Gesto de swipe (like derecha / pass izquierda) con `react-native-gesture-handler` + `react-native-reanimated` (ya instalados por el scaffold — no añadas otra librería de swipe)
- [ ] Botones alternativos de like/pass (accesibilidad — no todo el mundo usa gesto)
- [ ] Feedback visual claro al soltar (etiqueta LIKE / PASS)

## Filtro por modo
- [ ] El deck respeta el modo activo del usuario (Par / Lock-In / ambos)

## Matching
- [ ] Lógica mock: dar like a un perfil "sembrado" como recíproco genera match
- [ ] Guardar el match a través de la capa de datos de `arquitecto`

## Pantalla de match
- [ ] Modal/pantalla de "¡Match!" con opción directa de ir al chat
- [ ] Estado vacío del deck (cuando no quedan perfiles) con mensaje útil, no una pantalla en blanco
