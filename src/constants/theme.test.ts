/**
 * Verificación de contraste de la paleta.
 *
 * El sistema de diseño promete que ninguna pantalla declara un color literal:
 * todo sale de `Colors`. Eso permite comprobar la accesibilidad del producto
 * entero aquí, sobre los tokens, en vez de a ojo pantalla por pantalla.
 *
 * Umbrales WCAG 2.1 AA: 4.5:1 para texto normal y 3:1 para elementos de interfaz
 * no textuales (bordes que delimitan un campo, por ejemplo).
 *
 * Si un par baja del umbral, el arreglo va en `Colors` —no en la pantalla que lo
 * usa—, y esta lista es la que dice qué combinaciones tienen que seguir siendo
 * válidas.
 */

import { AmbientPeak, Colors } from './theme';

import type { ThemeColor, ThemeName } from './theme';

/** Componente de canal lineal, como lo define WCAG para la luminancia relativa. */
function channel(value: number): number {
  const ratio = value / 255;
  return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
}

/** Canales de un `#rrggbb` o `#rrggbbaa` (alfa de 0 a 1). */
function parse(hex: string): { rgb: number[]; alpha: number } {
  const value = hex.replace('#', '');
  const rgb = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
  const alpha = value.length === 8 ? parseInt(value.slice(6, 8), 16) / 255 : 1;
  return { rgb, alpha };
}

/**
 * Color opaco que se ve al poner `top` (quizá translúcido) sobre `bottom`
 * (opaco). Así se mide el cristal: lo que llega al ojo es la mezcla.
 */
export function composite(top: string, bottom: string): string {
  const { rgb, alpha } = parse(top);
  const under = parse(bottom).rgb;
  const mixed = rgb.map((value, i) => Math.round(value * alpha + under[i] * (1 - alpha)));
  return '#' + mixed.map((value) => value.toString(16).padStart(2, '0')).join('');
}

/** Luminancia relativa de un `#rrggbb`. */
function luminance(hex: string): number {
  const [r, g, b] = parse(hex).rgb;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Ratio de contraste WCAG entre dos colores sólidos. */
export function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

interface Pair {
  foreground: ThemeColor;
  background: ThemeColor;
  /** Umbral mínimo. 4.5 para texto normal, 3 para elementos no textuales. */
  min: number;
  /** Dónde se usa, para que un fallo diga qué se rompe. */
  usage: string;
}

/** Pares que cumplen AA hoy y tienen que seguir cumpliéndolo. */
const AA_PAIRS: Pair[] = [
  // Texto sobre las tres superficies.
  { foreground: 'text', background: 'background', min: 4.5, usage: 'cuerpo sobre la pantalla' },
  { foreground: 'text', background: 'backgroundElement', min: 4.5, usage: 'cuerpo en tarjeta' },
  {
    foreground: 'text',
    background: 'backgroundSelected',
    min: 4.5,
    usage: 'cuerpo en fila seleccionada',
  },
  {
    foreground: 'textSecondary',
    background: 'background',
    min: 4.5,
    usage: 'texto de apoyo sobre la pantalla',
  },
  {
    foreground: 'textSecondary',
    background: 'backgroundElement',
    min: 4.5,
    usage: 'texto de apoyo en tarjeta',
  },
  {
    foreground: 'textMuted',
    background: 'background',
    min: 4.5,
    usage: 'metadatos y marcas de tiempo',
  },
  {
    foreground: 'textMuted',
    background: 'backgroundElement',
    min: 4.5,
    usage: 'placeholder y contador de campo',
  },

  {
    foreground: 'text',
    background: 'surfaceOpaque',
    min: 4.5,
    usage: 'cuerpo en tarjeta del deck',
  },
  {
    foreground: 'textSecondary',
    background: 'surfaceOpaque',
    min: 4.5,
    usage: 'apoyo en tarjeta del deck',
  },
  {
    foreground: 'textMuted',
    background: 'surfaceOpaque',
    min: 4.5,
    usage: 'etiquetas en tarjeta del deck',
  },

  // Acentos como texto: etiquetas de sección, badges, errores de validación.
  { foreground: 'brass', background: 'background', min: 4.5, usage: 'etiqueta de sección' },
  { foreground: 'brass', background: 'backgroundElement', min: 4.5, usage: 'etiqueta en tarjeta' },
  { foreground: 'brass', background: 'brassSoft', min: 4.5, usage: 'chip de marca seleccionado' },
  { foreground: 'teal', background: 'background', min: 4.5, usage: 'confirmación y modo Lock-In' },
  { foreground: 'teal', background: 'backgroundElement', min: 4.5, usage: 'badge de Lock-In' },
  { foreground: 'teal', background: 'tealSoft', min: 4.5, usage: 'badge "Like" del deck' },
  { foreground: 'danger', background: 'background', min: 4.5, usage: 'mensaje de error' },
  {
    foreground: 'danger',
    background: 'backgroundElement',
    min: 4.5,
    usage: 'error dentro de campo',
  },
  { foreground: 'danger', background: 'dangerSoft', min: 4.5, usage: 'badge "Pasar" del deck' },

  // Texto sobre relleno de acento sólido: botón principal, chip activo.
  { foreground: 'onAccent', background: 'brass', min: 4.5, usage: 'botón principal' },
  { foreground: 'onAccent', background: 'teal', min: 4.5, usage: 'chip de especialidad activo' },
  { foreground: 'onAccent', background: 'danger', min: 4.5, usage: 'acción destructiva' },
];

/**
 * Pares que HOY no llegan a AA. El test fija el ratio actual como suelo: no
 * exige el arreglo, pero impide que la situación empeore en silencio mientras
 * se decide. Al arreglar un par, sube a `AA_PAIRS` y su entrada se borra.
 *
 * Hoy la lista está vacía. Los cuatro huecos que reportó `calidad` (2026-09-05)
 * se cerraron el 2026-09-06:
 *
 * - `textMuted` sobre ambas superficies: resuelto en `Colors`. En claro se
 *   retira el tercer nivel de tinta (`textMuted` = `textSecondary`), porque la
 *   paleta clara no lo admite por encima de 4.5:1 sin que colapse contra el
 *   segundo. En oscuro sí cabe: `#7D8874` -> `#828D79`. Los dos pares están
 *   ahora en `AA_PAIRS`.
 * - `border` sobre ambas superficies: NO APLICA, no es deuda. La regla 1.4.11
 *   cubre los componentes de interfaz cuyo límite hace falta para identificarlos.
 *   El borde de tarjeta es decoración, y los campos se identifican por su
 *   etiqueta visible permanente (`src/features/profile/controls.tsx`), no por el
 *   trazo. Subirlo a 3:1 volvería la interfaz un wireframe sin ganancia real de
 *   accesibilidad. Si algún día un control depende solo del borde para
 *   distinguirse, ese control sí entra aquí.
 */
interface Gap extends Pair {
  /** Ratio medido hoy. Bajar de aquí rompe el test. */
  current: Record<ThemeName, number>;
  reason: string;
}

const KNOWN_GAPS: Gap[] = [];

const THEMES: ThemeName[] = ['light', 'dark'];

/**
 * Lo que hay detrás de cada superficie: el fondo liso y el punto más claro de la
 * luz ambiental. El cristal tiene que leerse bien sobre los dos.
 */
const BACKDROPS = { fondo: 'background', 'luz ambiental': 'peak' } as const;

describe.each(THEMES)('contraste del tema %s', (theme) => {
  const palette = Colors[theme];

  /** La superficie `token` tal como se ve sobre `backdrop`, ya opaca. */
  function surface(token: ThemeColor, backdrop: 'background' | 'peak'): string {
    const base = backdrop === 'peak' ? AmbientPeak : palette.background;
    return token === 'background' ? base : composite(palette[token], base);
  }

  function ratio(foreground: ThemeColor, background: ThemeColor, backdrop: 'background' | 'peak') {
    const under = surface(background, backdrop);
    return contrastRatio(composite(palette[foreground], under), under);
  }

  describe.each(Object.entries(BACKDROPS))('sobre %s', (_name, backdrop) => {
    it.each(AA_PAIRS)(
      '$foreground sobre $background llega a AA ($usage)',
      ({ foreground, background, min }) => {
        expect(ratio(foreground, background, backdrop)).toBeGreaterThanOrEqual(min);
      }
    );

    // `it.each` de Jest falla si recibe un array vacío, y hoy no queda ningún
    // hueco. La guarda mantiene el bloque listo para cuando vuelva a haber uno.
    const itGap = KNOWN_GAPS.length > 0 ? it.each(KNOWN_GAPS) : () => {};
    itGap(
      '$foreground sobre $background no empeora respecto a lo reportado ($usage)',
      ({ foreground, background, current }) => {
        expect(ratio(foreground, background, backdrop)).toBeGreaterThanOrEqual(current[theme]);
      }
    );
  });
});

describe('composite', () => {
  it('deja intacto un color opaco', () => {
    expect(composite('#FF8645', '#000000')).toBe('#ff8645');
  });

  it('mezcla un cristal blanco al 50 % sobre negro', () => {
    expect(composite('#FFFFFF80', '#000000')).toBe('#808080');
  });
});

describe('contrastRatio', () => {
  it('da 21:1 entre blanco y negro', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBe(21);
  });

  it('da 1:1 entre un color y sí mismo', () => {
    expect(contrastRatio('#8C5E10', '#8C5E10')).toBe(1);
  });
});
