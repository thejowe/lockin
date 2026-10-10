import { reportKeyboardLift } from './keyboard-lift';

describe('reportKeyboardLift', () => {
  it('teclado cerrado: nada que reservar', () => {
    expect(reportKeyboardLift(0, 900, 800)).toBe(0);
    expect(reportKeyboardLift(-5, 900, 800)).toBe(0);
  });

  it('descuenta el hueco que queda bajo el contenedor (barra de tabs)', () => {
    // ventana 900, contenedor termina en 780 -> 120 libres bajo él
    expect(reportKeyboardLift(336, 900, 780)).toBe(216);
  });

  it('si el teclado cabe en el hueco, no hay que subir nada', () => {
    expect(reportKeyboardLift(100, 900, 780)).toBe(0);
  });

  it('contenedor pegado al borde: la altura entera del teclado', () => {
    expect(reportKeyboardLift(336, 900, 900)).toBe(336);
  });

  it('sin medida fiable usa la altura entera del teclado', () => {
    expect(reportKeyboardLift(336, 900, 0)).toBe(336);
    expect(reportKeyboardLift(336, 0, 780)).toBe(336);
    expect(reportKeyboardLift(336, 900, NaN)).toBe(336);
  });

  it('un borde por debajo de la ventana nunca da negativo', () => {
    expect(reportKeyboardLift(336, 900, 950)).toBe(336);
  });
});
