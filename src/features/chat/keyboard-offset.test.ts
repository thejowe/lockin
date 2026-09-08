import { keyboardVerticalOffset } from './keyboard-offset';

/**
 * Las cifras vienen del emulador de CI (Pixel, 1080x2400 a densidad 2.625),
 * medidas sobre los artefactos del run 34151655965: la sonda de teclado logueó
 * `windowHeight=914.2857` dp y el `window.xml` del mismo paso sitúa el
 * contenido de la app en `y=275` px, o sea 104.76 dp de barra de estado (128
 * px) más cabecera nativa (147 px). Si esta cuenta se vuelve a torcer, el
 * compositor termina otra vez debajo del teclado y solo lo ve el E2E.
 */
const WINDOW_HEIGHT = 914.2857055664062;
const CONTENT_TOP = 275 / 2.625;
const AVOIDING_VIEW_HEIGHT = WINDOW_HEIGHT - CONTENT_TOP;

describe('keyboardVerticalOffset', () => {
  it('devuelve la distancia real medida en el emulador: barra de estado + cabecera', () => {
    expect(keyboardVerticalOffset(WINDOW_HEIGHT, AVOIDING_VIEW_HEIGHT)).toBeCloseTo(CONTENT_TOP, 5);
  });

  it('deja el compositor justo encima del teclado con las medidas reales', () => {
    // La cuenta del componente, con `frame.y = 0` porque `onLayout` da
    // coordenadas relativas: padding = frame.height - (ventana - teclado - offset).
    const keyboardHeight = 336.3809509277344;
    const offset = keyboardVerticalOffset(WINDOW_HEIGHT, AVOIDING_VIEW_HEIGHT);
    const padding = Math.max(AVOIDING_VIEW_HEIGHT - (WINDOW_HEIGHT - keyboardHeight - offset), 0);

    // El relleno tiene que ser el teclado entero: ni corto (el compositor se
    // esconde) ni pasado (flota sobre un hueco vacío).
    expect(padding).toBeCloseTo(keyboardHeight, 5);
  });

  it('no aplica offset cuando la vista ocupa la ventana entera', () => {
    expect(keyboardVerticalOffset(WINDOW_HEIGHT, WINDOW_HEIGHT)).toBe(0);
  });

  it('no devuelve negativos si la vista se mide más alta que la ventana', () => {
    expect(keyboardVerticalOffset(800, 900)).toBe(0);
  });

  it('no aplica offset antes del primer onLayout', () => {
    expect(keyboardVerticalOffset(WINDOW_HEIGHT, 0)).toBe(0);
    expect(keyboardVerticalOffset(0, 0)).toBe(0);
  });
});
