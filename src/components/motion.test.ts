/**
 * Las entradas compartidas existen y se escalonan: el mock de Reanimated no
 * anima, así que basta con que construyan su animación sin romper.
 */

import { enterFade, enterRise, enterUp } from '@/components/motion';

describe('entradas', () => {
  it('enterUp construye la entrada de cualquier puesto de la lista', () => {
    expect(enterUp()).toBeTruthy();
    expect(enterUp(3)).toBeTruthy();
  });

  it('enterRise construye la entrada de cualquier puesto de la página', () => {
    expect(enterRise()).toBeTruthy();
    expect(enterRise(2)).toBeTruthy();
  });

  it('enterFade construye el fundido', () => {
    expect(enterFade()).toBeTruthy();
    expect(enterFade(2)).toBeTruthy();
  });
});
