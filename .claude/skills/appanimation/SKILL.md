---
name: appanimation
description: Flujo de trabajo estructurado para diseñar, construir y revisar cualquier animación o movimiento de la app LockIn/cofounder (Expo + React Native + Reanimated). Orquesta tres skills — `motion-design` (qué debe sentir y cómo se mueve), `expo-animation` (cómo se implementa bien en móvil) y `animate-expo` (segunda opinión de Emil Kowalski) — y decide cuál usar en cada fase. Úsala SIEMPRE que el usuario pida animar algo, añadir movimiento, gestos, transiciones, microinteracciones, un estado de carga/éxito/match, una intro, un logo animado, un Lottie, hápticos, o arreglar animaciones que van a tirones, aunque no diga «animación» (p. ej. «que se sienta más vivo», «que el match tenga más gracia», «anima el logo»).
---

# appanimation — flujo de animación de la app

El usuario te dice **qué quiere** («anima el match», «que las tarjetas se sientan físicas»). Tú sigues este plan sin preguntar cómo hacerlo: decides qué skill entra en cada fase. Solo pregunta si falta algo que no puedes deducir del código ni de `docs/plan/CONCEPTO.md`.

## Las tres skills y su papel

| Skill | Es el experto en | Se invoca en | No sirve para |
|---|---|---|---|
| `motion-design` (LottieFiles) | La **intención**: emoción, personalidad, narrativa, principios de Disney, coreografía de varias piezas, tablas de timing/easing, arquetipos (Playful/Premium/…) | Fase 2 (diseño) y Fase 5 (checklist de calidad) | Código. Habla de CSS/Framer/GSAP: **traduce** sus duraciones y curvas a Reanimated, no copies su código web |
| `expo-animation` (Expo oficial) | La **implementación** en RN/Expo: ¿debe animarse?, qué hilo, qué propiedades, spring vs timing, gestos, interrupción, reducir movimiento, hápticos | Fase 1 (puerta) y Fase 3 (construcción). **Es la autoridad en el código** | Decidir el carácter emocional |
| `animate-expo` (Emil Kowalski) | Lo mismo que la anterior, con la filosofía de Emil. Casi idéntica; `expo-animation` es la versión más reciente (corrige `cubicBezier` en Reanimated 4.1+) | Fase 4, solo como **segunda opinión** en animaciones de gesto/sheet/swipe, o si `expo-animation` no cubre el caso | Duplicar trabajo: nunca las ejecutes las dos para escribir el mismo código |

Regla de desempate: si `expo-animation` y `animate-expo` discrepan, gana `expo-animation` (más nueva y oficial). Si `motion-design` pide algo que viola la puerta de `expo-animation` (p. ej. animar un cambio de pestaña), gana la puerta: el movimiento frecuente se come la paciencia del usuario aunque sea bonito.

## Plan de trabajo

Anuncia al principio «Uso appanimation: Fase 1…» y avanza por orden. Cada fase tiene una salida concreta; si una fase termina en «no animar», para ahí y dilo.

### Fase 0 — Contexto del proyecto (2 minutos, sin skills)
Antes de diseñar, lee lo que ya existe para no inventar un segundo lenguaje de movimiento:
- `src/components/motion.ts` — entradas compartidas (`enterUp`, `enterFade`) y la regla de la dirección «cristal»: *nada rebota al entrar; el rebote se reserva para lo que responde a la mano o celebra (el match)*.
- `src/constants/theme.ts` — `Curves`, `Duration`, `Stagger`. Úsalos; no hardcodees curvas ni ms.
- Un par de ejemplos vivos: `src/components/app-intro.tsx`, `cofounder-logo.tsx`, `reveal-stack.tsx`, `swipe-between-tabs.tsx`.
- Versiones reales: Expo 58, Reanimated 4.7, Gesture Handler 3, worklets 0.13. Antes de escribir código de Expo, `AGENTS.md` manda leer los docs de la versión (https://docs.expo.dev/versions/v58.0.0/).
- Salida: 2–3 líneas con qué tokens y patrones vas a reutilizar.

### Fase 1 — Puerta: ¿debe animarse? → `expo-animation`
Invoca `expo-animation` y aplica sus pasos 1 y 2 (frecuencia de uso y propósito en una palabra). Si algo ocurre decenas de veces al día (cambio de pestaña, scroll, teclado), la respuesta es no o casi imperceptible. Esta fase puede producir cero líneas de código; eso es un éxito, no un fallo.
- Salida: «Sí/No · frecuencia · propósito (feedback / estado / continuidad espacial / explicación / deleite)».

### Fase 2 — Dirección de movimiento → `motion-design`
Solo si pasó la puerta y el movimiento es algo más que un fundido trivial (escena de varias piezas, celebración, intro, estado de carga con personalidad). Invoca `motion-design` y úsala para:
1. Fijar la **emoción objetivo** y elegir **un** arquetipo de personalidad coherente con la app (la dirección «cristal» es contenida: encaja Premium/Corporate; Playful solo en el match y celebraciones).
2. Estructurar la secuencia: pieza principal, secundaria, ambiental; escalonado y regla 1/3.
3. Sacar duraciones y easing de sus tablas **y mapearlos a los tokens del repo** (`Duration`, `Curves`, `Stagger`). Si no existe un token equivalente, propón uno nuevo en `theme.ts` en vez de un número suelto.
Para un microefecto simple (pulsar un botón) salta esta fase: `expo-animation` ya trae sus valores.
- Salida: una ficha corta — emoción, arquetipo, guion de la secuencia con tiempos.

### Fase 3 — Construcción → `expo-animation`
Implementa siguiendo sus reglas duras: Reanimated (no `Animated` del core), todo en el hilo de UI, solo `transform`/`opacity` salvo motivo, springs/curvas de sus tablas, **reducir movimiento incluido desde el primer commit**, interrumpible, con velocidad heredada si hay gesto. Consulta su `RECIPES.md` para press feedback, sheets, swipe, transiciones de pantalla. Ten en cuenta la trampa que ya conoce `motion.ts`: en Android una entrada que arranca fuera de pantalla puede quedarse en opacidad 0; respeta `usePageFocused`.
- Si pide un asset (logo animado, ilustración, check de éxito) y no existe, ver «Assets y Lottie» abajo.
- Salida: código + tests si el patrón del repo los pide (`motion.test.ts`).

### Fase 4 — Segunda opinión (condicional) → `animate-expo`
Úsala cuando la animación sea de **gesto** (swipe del deck, sheet arrastrable, pull) o cuando algo no te convenza de la Fase 3. Pásale tu implementación y pregunta qué cambiaría; aplica solo diferencias con razón técnica clara. En el resto de casos, sáltala: dos pasadas sobre un fundido son ruido.

### Fase 5 — Revisión y verificación → `motion-design` + `comprobador`
1. Pasa el `reference/quality-checklist.md` de `motion-design` y, si algo se ve mal, su `reference/troubleshooting.md`.
2. Revisa contra `expo-animation`: ¿hilo de UI?, ¿reducir movimiento?, ¿interrumpible?, ¿probado en release?
3. Verificación real: lanza el agente `comprobador` (emulador Android local) para ver la animación en dispositivo y capturar evidencia. El simulador de desarrollo no cuenta como prueba de que «se siente bien»: dilo si no pudiste comprobarlo.
4. Si el cambio toca `src/features/` o `src/app/`, no lo lances a la vez que otro bloque (ver `docs/plan/PLAN.md`); el agente `visual` es el dueño del pulido visual.

## Assets y Lottie

Hoy el repo **no tiene** `lottie-react-native` ni `expo-haptics` (sí `react-native-svg`). Antes de proponer Lottie o hápticos:
- ¿Se puede hacer con Reanimated + SVG? Para logos y iconos simples, casi siempre sí y pesa menos: preferible.
- Si de verdad hace falta Lottie (ilustración compleja, celebración), explica en una línea por qué, instala con `npx expo install lottie-react-native` y avisa de que tocar dependencias nativas obliga a un build nuevo del cliente de desarrollo/iOS (skill `build-ios`).
- Los `.json` de Lottie van en `assets/`, con `autoPlay`/`loop` explícitos y un fallback estático cuando reducir movimiento esté activo.
- Lo mismo para hápticos: `npx expo install expo-haptics`, solo en acciones que responden a la mano o celebran.

## Formato de la respuesta final
Cierra con cuatro líneas: **qué se animó y por qué**, **qué tokens se reutilizaron/crearon**, **cómo degrada con reducir movimiento**, **qué quedó sin comprobar en dispositivo**. Sin repetir el código.
