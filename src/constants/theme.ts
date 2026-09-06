/**
 * Sistema de diseño de LockIn.
 *
 * Fuente de verdad de la paleta de marca (latón / grafito-salvia / verde-azulado),
 * la escala tipográfica y el espaciado. Ver `docs/plan/CONCEPTO.md`.
 *
 * Ningún componente debería declarar un color literal: si falta un token, se añade aquí.
 */

import '@/global.css';

import { Platform } from 'react-native';

/**
 * Paleta de marca. Los cinco tokens de `CONCEPTO.md` (fondo, tinta, latón,
 * verde-azulado, alerta) más los derivados que necesita la UI: superficies,
 * texto secundario, bordes y las variantes suaves de cada acento.
 */
export const Colors = {
  light: {
    /** Fondo de pantalla. */
    background: '#EEF0EA',
    /** Superficie elevada: tarjetas, filas, campos. */
    backgroundElement: '#E4E7DE',
    /** Superficie en estado activo/seleccionado. */
    backgroundSelected: '#D8DCD0',
    /** Tinta principal. */
    text: '#1B231E',
    /** Tinta secundaria (grafito-salvia). */
    textSecondary: '#5A6459',
    /**
     * Tinta terciaria. En claro NO existe como nivel propio: vale lo mismo que
     * `textSecondary`. La paleta clara no admite un tercer nivel por encima de
     * 4.5:1 sin que colapse contra el segundo (a 4.5:1 quedaría a 1.17 de
     * `textSecondary`, la misma tinta a ojo). El token se mantiene para que las
     * pantallas no tengan que ramificar por tema; en oscuro sí es un nivel real.
     */
    textMuted: '#5A6459',
    /** Trazo de separación. */
    border: '#D2D7C9',
    /** Acento latón: acción principal, marca. */
    brass: '#8C5E10',
    /** Latón como relleno suave (fondo de chip/badge). */
    brassSoft: '#F2E5CB',
    /** Acento verde-azulado: confirmación, match, modo Lock-In. */
    teal: '#285F52',
    /** Verde-azulado como relleno suave. */
    tealSoft: '#D8E6E0',
    /** Alerta/riesgo: descartar, destruir, error. */
    danger: '#963C2C',
    /** Alerta como relleno suave. */
    dangerSoft: '#F4DED8',
    /** Tinta sobre un relleno de acento sólido. */
    onAccent: '#FBFCF8',
  },
  dark: {
    background: '#14180F',
    backgroundElement: '#1F2419',
    backgroundSelected: '#2B3123',
    text: '#E9ECE1',
    textSecondary: '#A2AC98',
    textMuted: '#828D79',
    border: '#333A2B',
    brass: '#E0B04E',
    brassSoft: '#33280F',
    teal: '#7FC3B0',
    tealSoft: '#16302A',
    danger: '#E28D74',
    dangerSoft: '#331C15',
    onAccent: '#14180F',
  },
} as const;

export type ThemeName = keyof typeof Colors;
export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
export type ThemePalette = (typeof Colors)[ThemeName];

/**
 * Familias tipográficas de marca. Los valores son las claves con las que
 * `src/app/_layout.tsx` registra las fuentes en `expo-font` — deben coincidir.
 */
export const FontFamily = {
  /** Fraunces — display y titulares. */
  display: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',
  /** IBM Plex Sans — texto de interfaz. */
  sans: 'IBMPlexSans_400Regular',
  sansMedium: 'IBMPlexSans_500Medium',
  sansSemiBold: 'IBMPlexSans_600SemiBold',
  sansBold: 'IBMPlexSans_700Bold',
  /** IBM Plex Mono — etiquetas, datos y metadatos. */
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
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
 * Escala tipográfica. Cada entrada es un estilo completo y cerrado — las
 * pantallas eligen un rol, no componen tamaños sueltos.
 */
export const Typography = {
  /** Fraunces grande: pantalla de bienvenida, "¡Match!". */
  display: { fontFamily: FontFamily.displayBold, fontSize: 40, lineHeight: 46 },
  /** Fraunces: título de pantalla. */
  title: { fontFamily: FontFamily.display, fontSize: 30, lineHeight: 38 },
  /** Fraunces: nombre en tarjeta de perfil, cabecera de sección. */
  subtitle: { fontFamily: FontFamily.display, fontSize: 22, lineHeight: 30 },
  /** Plex Sans: cabecera dentro de una tarjeta. */
  heading: { fontFamily: FontFamily.sansSemiBold, fontSize: 18, lineHeight: 26 },
  /** Plex Sans: cuerpo por defecto. */
  body: { fontFamily: FontFamily.sans, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: FontFamily.sansSemiBold, fontSize: 16, lineHeight: 24 },
  /** Plex Sans: texto de apoyo, listas densas. */
  small: { fontFamily: FontFamily.sans, fontSize: 14, lineHeight: 20 },
  smallBold: { fontFamily: FontFamily.sansSemiBold, fontSize: 14, lineHeight: 20 },
  /** Plex Sans: pie de foto, notas. */
  caption: { fontFamily: FontFamily.sans, fontSize: 12, lineHeight: 16 },
  /** Plex Mono en versales: etiquetas de sección, chips de dato. */
  label: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  /** Plex Mono: datos crudos (horas/semana, zona horaria, enlaces). */
  mono: { fontFamily: FontFamily.mono, fontSize: 13, lineHeight: 20 },
  /** Enlace en línea. */
  link: { fontFamily: FontFamily.sansMedium, fontSize: 16, lineHeight: 24 },
} as const;

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

/** Radios de esquina. `pill` para chips y botones de acción redondos. */
export const Radii = {
  small: 8,
  medium: 12,
  large: 20,
  card: 28,
  pill: 999,
} as const;

/** Duraciones de animación, en ms. */
export const Duration = {
  fast: 140,
  base: 220,
  slow: 360,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
