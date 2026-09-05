# TODO — chat

## Lista de matches
- [x] Tab Matches: lista con nombre, último mensaje (o "Decidid cuándo hacer vuestro primer Lock-In"), estado
- [x] Estado vacío (sin matches todavía) con mensaje útil

## Chat 1:1
- [x] Pantalla de conversación (`chat/[matchId]`)
- [x] Enviar/recibir mensajes mock, persistidos en memoria durante la sesión
- [x] Icebreakers sugeridos al abrir un chat nuevo, generados con reglas simples a partir de los perfiles (p. ej. especialidades o intereses en común) — sin IA real en el MVP

## Diferenciador Lock-In (placeholder visible, sin lógica real)
- [x] Botón/acción "Agendar sesión Lock-In" visible en el chat — sin funcionalidad real en el MVP, pero no puede faltar ni como hueco (ver `docs/plan/CONCEPTO.md`)

## Estado

Bloque terminado. Código en `src/features/chat/` más las dos pantallas
(`src/app/(tabs)/matches.tsx` y `src/app/chat/[matchId].tsx`).

Verificado sobre el export web con el recorrido completo: deck → match → chat →
elegir icebreaker → enviar → volver a la lista con el último mensaje → reentrar
en la conversación. Estado vacío y `matchId` inexistente, también.

## Pendiente de otros bloques

- **Recibir mensajes del otro lado**: la conversación ya pinta las dos columnas
  (`MessageBubble` decide el lado comparando el emisor con el perfil del match),
  pero `MessageRepository.send` fija el emisor al usuario actual, así que hoy no
  hay forma de insertar un mensaje entrante sin tocar la capa de datos, que está
  congelada. Llega solo cuando `datos` conecte Supabase — la pantalla no cambia.
- **Icebreakers con los dos perfiles**: las reglas que comparan perfil propio y
  ajeno (especialidades complementarias o compartidas, franja horaria común,
  misma ambición, husos distintos) están escritas y probadas, pero solo se ven en
  la app cuando `perfil` deje crear el perfil propio. Sin él, `suggestIcebreakers`
  degrada a las reglas que solo miran al otro lado.

## Encontrado fuera de mi alcance (no lo toco — ver "regla de oro" de `PLAN.md`)

- `src/components/app-tabs.web.tsx`: en web la barra de tabs tapa la primera
  línea de cabecera de las pantallas de tab (se pierde la etiqueta en versales y
  se corta el título). Afecta igual a Descubrir, Matches y Perfil. Es de
  `arquitecto`.
- Hidratación: el render estático de web lanza `React error #418` (desajuste de
  texto entre servidor y cliente) en **todas** las rutas, incluida `/+not-found`.
  No viene de ninguna pantalla concreta.
