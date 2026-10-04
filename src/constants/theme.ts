/**
 * Sistema de diseño de LockIn — dirección «cristal».
 *
 * Fuente de verdad de la paleta (grafito, cristal, brasa y verde-azulado), la
 * escala tipográfica, el espaciado y el movimiento. Ver `docs/plan/CONCEPTO.md`.
 *
 * Ningún componente debería declarar un color literal: si falta un token, se añade aquí.
 */

import '@/global.css';

import { Platform, StyleSheet, type TextStyle } from 'react-native';

/**
 * Paleta. La app es solo oscura (decisión del 2026-10-03): fondo grafito con
 * luz ambiental difusa detrás (`AmbientBackground`) y superficies de cristal
 * translúcido encima.
 *
 * Las superficies (`backgroundElement`, `backgroundSelected`) y los rellenos
 * suaves (`*Soft`) llevan alfa en hex de 8 dígitos: son vidrio, no pintura, y
 * dejan pasar el brillo ambiental. `theme.test.ts` los compone sobre el fondo y
 * sobre el punto más claro de la luz ambiental (`AmbientPeak`) antes de medir
 * contraste.
 */
const Dark = {
  /** Fondo de pantalla, por debajo de la luz ambiental. */
  background: '#0A0A0B',
  /** Cristal: tarjetas, filas, campos. */
  backgroundElement: '#FFFFFF14',
  /** Cristal en estado activo/seleccionado, o más elevado. */
  backgroundSelected: '#FFFFFF29',
  /**
   * Cristal opaco: el mismo tono que el cristal sobre el grafito, sin alfa. Para
   * superficies que se apilan (las tarjetas del deck), donde la de detrás no
   * debe transparentarse a través de la de delante.
   */
  surfaceOpaque: '#18181B',
  /** Tinta principal. */
  text: '#F5F5F7',
  /** Tinta secundaria. */
  textSecondary: '#BEBEC4',
  /** Tinta terciaria: metadatos, marcas de tiempo, placeholders. */
  textMuted: '#A8A8AE',
  /** Canto del cristal: trazo fino que separa la superficie del fondo. */
  border: '#FFFFFF2E',
  /**
   * Acento brasa: acción principal, marca, selección. El nombre `brass` se
   * conserva del sistema anterior para no renombrar 35 pantallas; el color es
   * el naranja de la dirección cristal.
   */
  brass: '#FF8645',
  /** Brasa como relleno suave (fondo de chip/badge). */
  brassSoft: '#FF86451F',
  /** Acento verde-azulado: confirmación, presencia, modo Lock-In. */
  teal: '#7FC3B0',
  /** Verde-azulado como relleno suave. */
  tealSoft: '#7FC3B029',
  /** Alerta/riesgo: descartar, destruir, error. */
  danger: '#FF9A80',
  /** Alerta como relleno suave. */
  dangerSoft: '#FF9A8029',
  /** Tinta sobre un relleno de acento sólido. */
  onAccent: '#1A0A02',
  /** Brillo del canto superior del cristal (luz que entra por arriba). */
  glassHighlight: '#FFFFFF24',
} as const;

/**
 * `light` es un alias de `dark`: el esquema claro se retiró, pero el tipo
 * `ThemeName` y los tests que recorren los dos esquemas siguen valiendo sin
 * ramificar en cada pantalla.
 */
export const Colors = {
  light: Dark,
  dark: Dark,
} as const;

/**
 * Color del punto más luminoso de las imágenes de luz ambiental
 * (`assets/images/ambient-*.jpg`). Es el peor caso de contraste para la tinta
 * clara: el test compone cada superficie también sobre él.
 */
export const AmbientPeak = '#351C10';

export type ThemeName = keyof typeof Colors;
export type ThemeColor = keyof typeof Dark;
export type ThemePalette = typeof Dark;

/**
 * Familias tipográficas. Inter es la neo-grotesca más cercana a SF Pro (la
 * tipografía de la referencia), y se ve igual en iOS, Android y web. Los
 * valores son las claves con las que `src/app/_layout.tsx` registra las fuentes
 * en `expo-font` — deben coincidir con `BrandFonts`. Los alias `display` y
 * `mono` se conservan del sistema anterior: hoy son pesos de Inter.
 */
export const FontFamily = {
  /** Titulares. */
  display: 'Inter_600SemiBold',
  displayBold: 'Inter_700Bold',
  /** Cifras grandes (temporizador). */
  light: 'Inter_300Light',
  /** Texto de interfaz. */
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemiBold: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
  /** Datos y metadatos (con cifras tabulares en `Typography.mono`). */
  mono: 'Inter_400Regular',
  monoMedium: 'Inter_500Medium',
} as const;

export type FontFamilyName = keyof typeof FontFamily;

/**
 * Fallbacks del sistema mientras las fuentes cargan (y si fallan).
 * En web se resuelven contra las variables CSS de `src/global.css`.
 */
export const SystemFonts = Platform.select({
  ios: { sans: 'system-ui', serif: 'ui-serif', mono: 'ui-monospace' },
  web: { sans: 'var(--font-sans)', serif: 'var(--font-serif)', mono: 'var(--font-mono)' },
  default: { sans: 'normal', serif: 'serif', mono: 'monospace' },
});

/**
 * Escala tipográfica, al modo de Apple: titulares apretados (tracking negativo
 * que crece con el tamaño), cuerpo a 16 con interlineado corto. Cada entrada es
 * un estilo completo y cerrado — las pantallas eligen un rol, no componen
 * tamaños sueltos.
 */
export const Typography = {
  /** Pantalla de bienvenida, «¡Match!». */
  display: {
    fontFamily: FontFamily.displayBold,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1.2,
  },
  /** Título de pantalla. */
  title: { fontFamily: FontFamily.displayBold, fontSize: 32, lineHeight: 36, letterSpacing: -0.9 },
  /** Nombre en tarjeta de perfil, cabecera de sección. */
  subtitle: { fontFamily: FontFamily.display, fontSize: 22, lineHeight: 28, letterSpacing: -0.45 },
  /** Cabecera dentro de una tarjeta. */
  heading: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.25,
  },
  /** Cuerpo por defecto. */
  body: { fontFamily: FontFamily.sans, fontSize: 16, lineHeight: 22, letterSpacing: -0.15 },
  bodyStrong: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.15,
  },
  /** Texto de apoyo, listas densas. */
  small: { fontFamily: FontFamily.sans, fontSize: 14, lineHeight: 19, letterSpacing: -0.1 },
  smallBold: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 14,
    lineHeight: 19,
    letterSpacing: -0.1,
  },
  /** Pie de foto, notas. */
  caption: { fontFamily: FontFamily.sans, fontSize: 12, lineHeight: 16 },
  /** Etiqueta de sección o de dato: pequeña, en caja normal, sin versales. */
  label: { fontFamily: FontFamily.sansMedium, fontSize: 13, lineHeight: 18 },
  /** Datos crudos (horas/semana, zona horaria, horas): cifras tabulares. */
  mono: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 13,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },
  /** Enlace en línea. */
  link: { fontFamily: FontFamily.sansMedium, fontSize: 16, lineHeight: 22, letterSpacing: -0.15 },
  /** Cifra grande y fina: el temporizador del Pomodoro. */
  timer: {
    fontFamily: FontFamily.light,
    fontSize: 60,
    lineHeight: 66,
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
} satisfies Record<string, TextStyle>;

export type TypographyRole = keyof typeof Typography;

/** Escala de espaciado (base 4). Los nombres vienen del scaffold — no los renombres. */
export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/**
 * Radios de esquina. Suaves pero contenidos: el redondeo exagerado es lo
 * primero que delata una interfaz de plantilla. `pill` solo para chips,
 * botones y la barra de pestañas.
 */
export const Radii = {
  small: 8,
  medium: 12,
  large: 16,
  card: 22,
  sheet: 26,
  pill: 999,
} as const;

/** Grosores de trazo. `strong` solo para sellos que tienen que leerse de un vistazo. */
export const Stroke = {
  hairline: StyleSheet.hairlineWidth,
  strong: 2,
} as const;

/**
 * Medidas de control. 44 es el mínimo táctil (HIG / WCAG 2.5.8): nada que se
 * pulse queda por debajo, aunque se dibuje más pequeño y lo complete `HitSlop`.
 */
export const Control = {
  /** Mínimo táctil: botones de icono, chips con hitSlop, filas compactas. */
  minTouch: 44,
  /** Campo de texto de una línea. */
  field: 50,
  /** Botón de acción (píldora). */
  button: 56,
  /** Campo de texto multilínea: dos líneas y media de cuerpo, más relleno. */
  textArea: 88,
} as const;

/** Ampliaciones del área táctil para controles que se dibujan por debajo de 44. */
export const HitSlop = {
  /** Chip o sugerencia de 36 de alto → 48 táctiles (≥ 44) sin engordarlo. */
  chip: { top: 6, bottom: 6 },
  /** Texto-botón en línea (sugerencias, pestañas web). */
  inline: { top: 8, bottom: 8 },
} as const;

/** Opacidades de estado. Una sola escala para que todo se apague igual. */
export const Opacity = {
  /** Mientras el dedo está encima. */
  pressed: 0.85,
  /** Control inactivo: se ve, se lee, no invita. */
  disabled: 0.45,
} as const;

/**
 * Elevación. El cristal no proyecta sombra dura: una sombra amplia y suave
 * despega lo que flota (la tarjeta del deck, la barra de pestañas, el modal),
 * y `glow` es el halo cálido del botón principal.
 */
const DarkElevation = {
  raised: '0px 1px 0px rgba(255, 255, 255, 0.06), 0px 18px 40px rgba(0, 0, 0, 0.35)',
  overlay: '0px 2px 6px rgba(0, 0, 0, 0.35), 0px 30px 60px rgba(0, 0, 0, 0.55)',
  glow: '0px 10px 28px rgba(255, 134, 69, 0.35)',
} as const;

export const Elevation = {
  light: DarkElevation,
  dark: DarkElevation,
} as const satisfies Record<ThemeName, Record<string, string>>;

/** Alfa en hex que se añade a `background` para el velo detrás de un modal. */
export const ScrimAlpha = 'B8';

/**
 * Intensidad de `BlurView` (expo-blur) para el cristal que flota sobre
 * contenido que se desplaza: barra de pestañas, cabeceras, hojas y modales.
 * Las tarjetas no la llevan: debajo solo hay luz ambiental, ya difusa, y
 * desenfocarla otra vez costaría GPU sin cambiar nada a la vista.
 */
export const BlurIntensity = {
  bar: 40,
  sheet: 60,
} as const;

/** Duraciones de animación, en ms. */
export const Duration = {
  fast: 140,
  base: 220,
  slow: 360,
} as const;

/** Retardo entre elementos de una lista que entra escalonada, en ms. */
export const Stagger = 40;

/**
 * Curvas cúbicas (x1, y1, x2, y2) para `Easing.bezier`. Nada de `ease-in` para
 * entrar: lo que aparece arranca rápido y frena (`out`); lo que ya está en
 * pantalla y se desplaza, acelera y frena (`inOut`).
 */
export const Curves = {
  out: [0.23, 1, 0.32, 1],
  inOut: [0.77, 0, 0.175, 1],
} as const;

/**
 * Muelles de Reanimated. Se usan donde el movimiento responde a la mano o tiene
 * que poder interrumpirse a medias: un muelle hereda la velocidad que lleva, una
 * duración fija no.
 */
export const Springs = {
  /** Vuelta al sitio de una tarjeta soltada sin decidir: firme, sin bamboleo. */
  settle: { damping: 18, stiffness: 220, mass: 0.6 },
  /** Entrada con presencia (el match): un solo rebote corto. */
  pop: { damping: 15, stiffness: 190, mass: 0.8 },
  /** Respuesta al toque de un botón: inmediata al bajar, suave al soltar. */
  press: { damping: 22, stiffness: 420, mass: 0.5 },
  /** Deslizamiento de un indicador (pestaña activa, segmento, interruptor): sin rebote. */
  glide: { damping: 28, stiffness: 300, mass: 0.8 },
} as const;

/** Escala de un control mientras se pulsa. Sutil: se nota en el dedo, no a la vista. */
export const PressScale = 0.97;

/**
 * Hueco inferior que deja cada pestaña para la barra flotante: alto de la
 * píldora (56) más su separación del borde. El inset del sistema lo pone el
 * `SafeAreaView` de cada pestaña, con el borde `bottom` en `edges`.
 */
export const BottomTabInset = 56 + 24;
export const MaxContentWidth = 800;
