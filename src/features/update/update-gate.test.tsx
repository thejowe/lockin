import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { DataProvider } from '@/data';
import { createMockRepositories, createMockStore } from '@/data/mock';

import { isOutdated, UpdateGate } from './update-gate';

describe('isOutdated', () => {
  it.each([
    ['1.0.1', '1.0.2', true],
    ['1.0.1', '1.1.0', true],
    ['1.9.9', '2.0.0', true],
    ['1.0.1', '1.0.1', false],
    ['1.2.0', '1.1.9', false],
    ['1.0.1', '0.0.0', false],
    [null, '9.9.9', false],
    ['1.0.1', null, false],
    ['raro', '1.0.0', false],
  ])('%s frente a la mínima %s → %s', (current, minimum, expected) => {
    expect(isOutdated(current, minimum)).toBe(expected);
  });
});

describe('UpdateGate', () => {
  function setup(minimum: string) {
    const store = createMockStore();
    store.state.appConfig.minAppVersion = minimum;
    return createMockRepositories(store);
  }

  it('con la versión al día no pinta nada', async () => {
    await render(
      <DataProvider value={setup('1.0.0')}>
        <UpdateGate version="1.0.1" />
      </DataProvider>
    );
    await waitFor(() =>
      expect(screen.queryByText('Hay una versión nueva de cofounder')).toBeNull()
    );
  });

  it('por debajo de la mínima tapa la app y lleva a la tienda', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await render(
      <DataProvider value={setup('1.1.0')}>
        <UpdateGate version="1.0.1" />
      </DataProvider>
    );
    expect(await screen.findByText('Hay una versión nueva de cofounder')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Actualizar' }));
    expect(open).toHaveBeenCalledWith(expect.stringMatching(/apps\.apple\.com|play\.google\.com/));
  });
});
