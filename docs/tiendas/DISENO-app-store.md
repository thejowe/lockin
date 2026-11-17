# Diseño de la ficha de App Store — «el hilo»

Pedido por el usuario el 2026-11-17: una mejora radical de cómo se presenta cofounder en App
Store (imágenes y textos). Las imágenes viven en `store/app-store/`; los textos, en
`docs/tiendas/{,en/,ca/}ficha-app-store.md`.

## Lectura del encargo

Galería de App Store para una app de swipe entre pares que busca cofundador. Público: gente de
20–35 años con ganas de empezar algo y nada construido. Tono: editorial, nocturno, serio pero
humano. Familia estética: la dirección «cristal» de la app (negro, tinta clara, Instrument
Serif con cursiva) con una sola luz cálida.

## Concepto

**El hilo.** Una línea fina de brasa cruza la galería entera de izquierda a derecha. Empieza en
un punto solo en la primera imagen («tú»), pasa por detrás de los teléfonos, encuentra un segundo
punto en la imagen del match y desde ahí siguen **dos** líneas juntas hasta cerrarse en el
símbolo de cofounder (dos medias lunas y un punto: dos personas y una idea) en la última. Es el
recorrido del producto contado sin palabras: de solo a juntos.

Es el único gesto protagonista. Lo demás es sobrio: titular, una frase y la pantalla real.

## Reglas duras

- **Pantallas reales.** Toda imagen con teléfono es la app de verdad (`capture.mjs`). Nada de
  maquetas inventadas; las zonas ampliadas son recortes de la misma captura.
- **Un acento.** Brasa `#FF8645` (el acento original de la dirección «cristal», ver
  `CONCEPTO.md`) solo para el hilo, sus puntos, el punto del símbolo y la palabra en cursiva del
  titular. La app usa hoy blanco como acento; en la tienda la brasa da la vida que se pidió sin
  salir de la historia de la marca.
- **Una luz.** Un degradado cálido muy tenue que entra por arriba, como la luz ambiental que tuvo
  la app. Sin manchas, halos ni brillos alrededor de nada.
- **Tipografía de la marca.** Titular en Instrument Serif 164 px, énfasis en su cursiva (nunca otra
  familia); texto en Instrument Sans 50 px. Titulares de 2–3 líneas; frase de 2 líneas como mucho.
- **Lo que sale del teléfono crece ×1,3** desde el sitio donde está en la pantalla, para que se
  lea en la miniatura de la tienda (match, preguntas para romper el hielo, sello de GitHub).
- **Contraste AA calculado** (`visual-craft/scripts/contrast.mjs`) sobre negro y sobre el punto
  más claro de la luz: tinta 15,8:1, secundaria 9,3:1, brasa 7,2:1.
- **Textos honestos.** Nada que la app no haga. «GitHub verificado» va con su matiz en la
  descripción; nada de cifras de usuarios ni premios.

## Textos de la ficha (cambios del 2026-11-17)

- **Subtítulo** con la palabra que se busca: «Encuentra cofundador y equipo» / «Find a co-founder
  & your team» / «Troba cofundador i equip». El subtítulo indexa en la búsqueda; las palabras
  clave ya no repiten «cofundador» ni «equipo».
- **Texto promocional** con el gancho de Grupos y «no hace falta tener nada construido».
- **Descripción** reordenada: gancho, principio («aquí nadie contrata a nadie»), cómo funciona en
  cuatro puntos y luego el detalle. Conserva todo lo que exige la revisión (16+, matiz de GitHub,
  seguridad, lo que no es, condiciones de la suscripción y enlaces) y ahora dice qué da Premium.

## Cómo se verifica

`compose.mjs` escribe una hoja de contacto por idioma (`build/preview-<idioma>.jpg`): se mira
entera, para comprobar que el hilo no se corta entre imágenes, y cada imagen a tamaño real, para
comprobar que ningún texto se desborda en inglés ni en catalán.
