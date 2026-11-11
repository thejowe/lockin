# Diseño de la landing de getcofounder.app

Contrato visual del bloque `web` (tareas en `todo/web.md`). Lo que no esté aquí sale de los tokens
de la app (`src/constants/theme.ts`).

## Concepto: «Dos mitades»

El símbolo de cofounder son dos medias lunas que casi se tocan y un punto en el hueco común. La
landing cuenta lo mismo con luz: dos halos (blanco cálido y verde-azulado) separados en la portada
se acercan a medida que se baja. Un único gesto protagonista —el móvil que entra girando, se
desliza al centro y va cambiando de pantalla—; todo lo demás, sobrio.

## Sistema

- **Paleta:** la de la app, solo oscura. Fondo `#000`, cristal `#FFFFFF14`/`#FFFFFF29`, canto
  `#FFFFFF2E`, tinta `#F5F5F7` / `#BEBEC4` / `#A8A8AE`, acción blanca con tinta `#1A0A02`, verde-azulado
  `#7FC3B0` para match y confirmación. Premium usa su noche azul (`#040815`) con el azul del diamante
  `#4DA3FF` y la insignia `#FFD66B`. Contrastes medidos en `theme.test.ts` (la web usa los mismos pares).
- **Tipografía:** Instrument Serif (titulares; énfasis en cursiva, nunca negrita) sobre Instrument
  Sans 400/600, servidas desde `web/fonts/` con `font-display: swap`. Escala fluida con `clamp()`.
- **Radios:** 8/12/16/22/26 y `pill`, como la app. Espaciado en múltiplos de 4.
- **Movimiento:** solo `transform` y `opacity`. Curva de salida `cubic-bezier(.22,1,.36,1)`. Dentro
  del móvil, cada pantalla tiene su microanimación (la mano pulsa, la tarjeta se desliza, el anillo
  del tour recorre los botones, las medias lunas del match se juntan) y solo corre la activa.

## El móvil

Decisión del usuario del 2026-11-10: fuera los giros y cruces entre pasos («parece de mala
calidad»). Queda solo la vuelta de entrada.

- Marco genérico en CSS 3D (sin copiar un modelo real): cara frontal con la pantalla y cara trasera
  con el símbolo; las láminas de canto solo se ven en la vuelta de entrada.
- **Entrada:** sube a la derecha dando una vuelta completa (`phone-in`, CSS).
- **Al centro:** mientras la portada sale, el móvil se desliza al centro y crece un 12 %. Sigue al
  scroll con interpolación por frame (factor 0,14), así la rueda a saltos no da tirones.
- **Recorrido:** escenario fijo (sticky) de `--n × 70vh` de scroll. Cada tramo cambia a la vez la
  pantalla y el texto, con transiciones CSS (no ligadas al scroll): sale en 0,28 s, entra en
  0,42–0,7 s con 0,1 s de retraso, desplazamiento de 3 % / 28 px hacia arriba al bajar y hacia abajo
  al subir. Texto a la izquierda, índice de pasos a la derecha (≥ 1200 px; salta a cada paso).
- < 1024 px: el móvil arriba (hasta el 24 % del alto de ancho) y el texto debajo, centrado.
  `prefers-reduced-motion`: sin desplazamiento ni escala, solo fundidos de 0,25 s, el móvil se queda
  a la derecha. Sin JS: pasos apilados como texto.

## Cómo se verifica

`node scripts/build-web.mjs` + `node --test scripts/build-web.test.mjs`; capturas a 375/768/1440 px
en el panel de navegador; recorrido de arriba abajo y de vuelta comprobando que el cambio de pantalla
nunca se ve de frente; consola limpia; páginas legales intactas.

## Pendiente

- Las pantallas del móvil son HTML con los textos y tokens de la app; cuando `comprobador` saque las
  capturas reales (Fase 1) se pueden sustituir pantalla a pantalla (`data-screen`).
- Insignias oficiales de App Store y Google Play: entran con la URL de cada tienda. Mientras tanto,
  botón propio «Próximamente» sin logotipos de terceros.
