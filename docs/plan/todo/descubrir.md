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
