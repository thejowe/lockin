# Nota para desplegar la web (14-oct-2026, tarde)

Comprobado en vivo a las ~17:40 (zona del usuario):

1. https://thejowe.github.io/lockin/ aún menciona Lock-In en la home.
2. https://thejowe.github.io/lockin/privacidad/ es la versión del 10-oct (Lock-In, salas, vídeo, STUN, frase «no para entrenar»).
3. https://thejowe.github.io/lockin/normas/ aún dice «perfiles, mensajes y videollamadas».

Acciones para Claude Code (rama del workflow de Pages):

- Sustituir `docs/tiendas/privacidad.md` por el contenido de `tiendas-revisadas/privacidad.md` (dejar marcadores [pendiente] visibles).
- Reescribir el texto de `web/index.html` / plantilla de build: solo búsqueda de cofundador; sin Lock-In, Pomodoro, salas ni vídeo.
- En `web/normas/`: quitar «videollamadas»; dejar perfiles y mensajes.
- Añadir `web/terminos/` y `web/aviso-legal/` desde `legal-borradores/` (NIF pendiente en aviso legal).
- Enlazar Privacidad, Términos, Normas, Soporte, Eliminar cuenta y Aviso legal en el pie.
- Desplegar con el workflow de GitHub Pages y verificar las URLs.

## Rechequeo 15-oct-2026 (~15:00 Europe/Madrid)

- `https://thejowe.github.io/lockin/privacidad/` sigue siendo la versión del 10-oct (Lock-In, salas, vídeo, STUN).
- En el repo, `docs/tiendas/privacidad.md` sigue siendo esa versión antigua; la revisada está en el material local `tiendas-revisadas/privacidad.md` (y el plan `docs/plan/todo/tiendas-cumplimiento.md` casilla T1 aún abierta).
- Gmail (`cofounder.soporte@gmail.com`): sin hilos de Apple Developer ni Google Play Console (búsqueda amplia, incl. trash). Las cuentas de desarrollador no aparecen dadas de alta.

## Rechequeo 15-oct-2026 (~18:32 Europe/Madrid)

- `https://thejowe.github.io/lockin/` sigue mencionando Lock-In en la home.
- `https://thejowe.github.io/lockin/privacidad/` sigue siendo la versión del 10-oct (Lock-In, salas, vídeo, STUN).
- `https://thejowe.github.io/lockin/normas/` sigue diciendo «perfiles, mensajes y videollamadas».
- En el repo, `docs/tiendas/privacidad.md` (rama por defecto) sigue siendo la versión antigua; la revisada está en `docs/tiendas-revisadas/privacidad.md` y en material local.
- Gmail (`cofounder.soporte@gmail.com`): búsqueda amplia (incl. trash) sin hilos de Apple Developer ni Google Play Console. Las cuentas de desarrollador no aparecen dadas de alta.

## Rechequeo 16-oct-2026 (~07:42 Europe/Madrid)

- `https://thejowe.github.io/lockin/` sigue mencionando Lock-In en la home.
- `https://thejowe.github.io/lockin/privacidad/` sigue siendo la versión del 10-oct (Lock-In, salas, vídeo, STUN; sin OpenAI como encargado aparte de la frase de la foto).
- En el repo (rama por defecto), `docs/tiendas/privacidad.md` sigue siendo esa versión antigua; casilla T1 de `docs/plan/todo/tiendas-cumplimiento.md` sigue abierta.
- Supabase proyecto `lockin` (`grrzmzktrhksbttpbblg`): región `eu-central-1`, estado ACTIVE_HEALTHY (confirmado por el conector).
- Gmail (`cofounder.soporte@gmail.com`): sin hilos de Apple Developer ni Google Play Console (búsqueda amplia, incl. trash). Las cuentas de desarrollador no aparecen dadas de alta.
- Calendario del día: sin eventos.
