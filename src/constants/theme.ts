/**
 * Sistema de diseño de cofounder — dirección «cristal».
 *
 * Fuente de verdad de la paleta (grafito, cristal, brasa y verde-azulado), la
 * escala tipográfica, el espaciado y el movimiento. Ver `docs/plan/CONCEPTO.md`.
 *
 * Ningún componente debería declarar un color literal: si falta un token, se añade aquí.
 */

import '@/global.css';

import { Platform, StyleSheet, type TextStyle } from 'react-native';

/**
 * Paleta. La app es solo oscura (decisión del 2026-10-03): fondo negro liso
 * (desde el 2026-10-17 sin la luz ambiental difusa que hubo detrás, ver
 * `AmbientBackground`) y superficies de cristal translúcido encima.
 *
 * Las superficies (`backgroundElement`, `backgroundSelected`) y los rellenos
 * suaves (`*Soft`) llevan alfa en hex de 8 dígitos: son vidrio, no pintura, y
 * dejan pasar el brillo ambiental. `theme.test.ts` los compone sobre el fondo y
 * sobre el punto más claro de la luz ambiental (`AmbientPeak`) antes de medir
 * contraste.
 */
const Dark = {
  /** Fondo de pantalla: negro (decisión del usuario del 2026-10-17). */
  background: '#000000',
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
  brass: '#FFFFFF',
  /** Brasa como relleno suave (fondo de chip/badge). */
  brassSoft: '#FFFFFF1F',
  /** Acento verde-azulado: confirmación, presencia, modo Lock-In. */
  teal: '#7FC3B0',
  /** Verde-azulado como relleno suave. */
  tealSoft: '#7FC3B029',
  /** Azul del diamante de Premium. */
  diamond: '#4DA3FF',
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
 * El punto más luminoso de lo que hay detrás del cristal. Hubo luz ambiental
 * (`assets/images/ambient-*.jpg`, pico `#351C10`) hasta el 2026-10-17; desde
 * entonces el fondo es negro liso y el pico es el propio fondo. Se conserva
 * para que `theme.test.ts` siga midiendo contraste si algún día vuelve.
 */
export const AmbientPeak = Dark.background;

export type ThemeName = keyof typeof Colors;
export type ThemeColor = keyof typeof Dark;
export type ThemePalette = { [K in keyof typeof Dark]: string };

/**
 * Los tonos propios de Premium: la noche azul del paywall, el halo que sale del
 * diamante y el degradado de la gema y del botón de compra. Solo los usan el
 * paywall y la animación que lo abre (`premium-cta.tsx`).
 *
 * Hasta el 2026-11-10 el paywall era el azul del diamante liso con tinta negra:
 * sin profundidad ni contraste entre planes. Ahora es noche con el azul como
 * luz, como las pantallas de pago que convierten (oscuro + un acento que brilla).
 */
export const PremiumTones = {
  /** Fondo: azul noche, casi negro. El círculo de la animación tiene este color. */
  night: '#040815',
  /** Halo del diamante detrás del héroe. */
  halo: '#2F7BFF',
  /** Segundo halo, más frío, para dar volumen. */
  haloCool: '#6A5BFF',
  /** Gema: arista iluminada, cuerpo y sombra. */
  gemLight: '#E4F3FF',
  gemMid: Dark.diamond,
  gemDeep: '#4A3DFF',
  /** Botón de compra: degradado de cian a azul real. */
  ctaFrom: '#8AD0FF',
  ctaTo: '#3D7BFF',
  /** Tinta sobre el botón de compra. */
  onCta: '#020A1F',
  /** Insignia «Mejor valor». */
  badge: '#FFD66B',
  onBadge: '#2A1C00',
} as const;

/**
 * Paleta del paywall: noche azul con tinta clara y el azul del diamante como
 * acento. Mismas claves que la paleta normal, así `ThemedText` y `Button` se
 * leen solos dentro de `ThemeOverride`.
 */
export const OnPremium: ThemePalette = {
  ...Dark,
  background: PremiumTones.night,
  backgroundElement: '#FFFFFF0D',
  backgroundSelected: '#4DA3FF24',
  surfaceOpaque: '#0B1226',
  text: '#F5F8FF',
  textSecondary: '#C3D0EA',
  textMuted: '#9AA8C6',
  border: '#FFFFFF21',
  brass: '#9CD3FF',
  brassSoft: '#4DA3FF24',
  onAccent: PremiumTones.onCta,
  glassHighlight: '#FFFFFF2E',
};

/**
 * Tiempos de la apertura del paywall desde el diamante (dirección Premium:
 * larga, sin rebote). La gema vuela al sitio del héroe mientras un círculo de
 * noche crece desde ella; ya tapada la pantalla, el paywall abre debajo y el
 * velo se retira.
 */
export const PaywallReveal = {
  /** Anticipación: la gema se encoge un pelo antes de salir. */
  anticipate: 90,
  /** Vuelo de la gema y expansión del círculo. */
  cover: 560,
  /** Espera con la pantalla tapada a que el paywall esté montado debajo. */
  hold: 260,
  /** Retirada del velo: más corta que la entrada. */
  fade: 260,
} as const;

/**
 * Familias tipográficas. Pareja de contraste: Instrument Serif para titulares
 * (serif de display, condensada y de trazo afilado, con aire editorial) sobre
 * Instrument Sans para la interfaz (su compañera de familia: mismo esqueleto,
 * más cálida que una neo-grotesca genérica). Los valores son las claves con las
 * que `src/app/_layout.tsx` registra las fuentes en `expo-font` — deben coincidir
 * con `BrandFonts`. La serif solo existe en 400: nunca le pongas `fontWeight`
 * (el sistema la falsearía en negrita). Para énfasis en un titular, usa la
 * cursiva `displayItalic`.
 */
export const FontFamily = {
  /** Titulares (la serif solo tiene un peso: `displayBold` es un alias). */
  display: 'InstrumentSerif_400Regular',
  displayBold: 'InstrumentSerif_400Regular',
  displayItalic: 'InstrumentSerif_400Regular_Italic',
  /** Cifras grandes (temporizador): sans, para que las tabulares no bailen. */
  light: 'InstrumentSans_400Regular',
  /** Texto de interfaz. */
  sans: 'InstrumentSans_400Regular',
  sansMedium: 'InstrumentSans_500Medium',
  sansSemiBold: 'InstrumentSans_600SemiBold',
  sansBold: 'InstrumentSans_700Bold',
  /** Datos y metadatos (con cifras tabulares en `Typography.mono`). */
  mono: 'InstrumentSans_400Regular',
  monoMedium: 'InstrumentSans_500Medium',
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
 * Escala tipográfica: titulares serif de display (tracking leve) sobre sans de
 * interfaz, cuerpo a 16 con interlineado corto. Cada entrada es
 * un estilo completo y cerrado — las pantallas eligen un rol, no componen
 * tamaños sueltos.
 */
export const Typography = {
  /** Pantalla de bienvenida, «¡Match!». */
  display: {
    fontFamily: FontFamily.displayBold,
    fontSize: 48,
    lineHeight: 50,
    letterSpacing: -0.8,
  },
  /** Título de pantalla. */
  title: { fontFamily: FontFamily.displayBold, fontSize: 38, lineHeight: 42, letterSpacing: -0.5 },
  /** Nombre en tarjeta de perfil, cabecera de sección. */
  subtitle: { fontFamily: FontFamily.display, fontSize: 27, lineHeight: 31, letterSpacing: -0.2 },
  /** Cabecera dentro de una tarjeta. */
  heading: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.25,
  },
  /** Cuerpo por defecto. */
  body: { fontFamily: FontFamily.sans, fontSize: 16, lineHeight: 23, letterSpacing: -0.15 },
  bodyStrong: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 16,
    lineHeight: 23,
    letterSpacing: -0.15,
  },
  /** Texto de apoyo, listas densas. */
  small: { fontFamily: FontFamily.sans, fontSize: 14, lineHeight: 20, letterSpacing: -0.1 },
  smallBold: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  /** Pie de foto, notas. Inter a 12 pide un soplo de aire entre letras. */
  caption: { fontFamily: FontFamily.sans, fontSize: 12, lineHeight: 17, letterSpacing: 0.1 },
  /** Etiqueta de sección o de dato: pequeña, en caja normal, sin versales. */
  label: { fontFamily: FontFamily.sansMedium, fontSize: 13, lineHeight: 19, letterSpacing: 0.05 },
  /** Datos crudos (horas/semana, zona horaria, horas): cifras tabulares. */
  mono: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 13,
    lineHeight: 19,
    letterSpacing: 0.05,
    fontVariant: ['tabular-nums'],
  },
  /** Enlace en línea. */
  link: { fontFamily: FontFamily.sansMedium, fontSize: 16, lineHeight: 23, letterSpacing: -0.15 },
  /** Cifra grande y fina: el temporizador del Pomodoro. */
  timer: {
    fontFamily: FontFamily.light,
    fontSize: 60,
    lineHeight: 66,
    letterSpacing: -1.5,
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
  /** Contorno que tiene que verse en cualquier densidad: el chip hueco de «busca». */
  thin: 1,
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
  /** Recorrido largo y con peso que se lee entero (el vuelo del diamante). */
  glide: [0.65, 0, 0.35, 1],
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
