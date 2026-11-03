/** El velo del cambio de idioma: invisible al arrancar, visible al cambiar, y se retira solo. */

import { act, render, screen } from '@testing-library/react-native';

import { LOCALE_VEIL_MS, LocaleSwitchVeil } from './locale-switch-veil';

describe('LocaleSwitchVeil', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('no se ve al arrancar', async () => {
    await render(<LocaleSwitchVeil locale="es" />);
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('aparece al cambiar de idioma y se retira solo', async () => {
    const view = await render(<LocaleSwitchVeil locale="es" />);
    await view.rerender(<LocaleSwitchVeil locale="en" />);
    expect(screen.getByRole('progressbar')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(LOCALE_VEIL_MS + 10);
    });
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});
