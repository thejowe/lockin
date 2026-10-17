/**
 * La mano que enseña a tocar la primera tarjeta: sale la primera vez, se va al
 * tocar (o al decidir) y no vuelve.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { buildProfile } from '@/data/test-fixtures';

import { ProfileCard } from './profile-card';
import { TAP_HINT_KEY, TapHint, useTapHint } from './tap-hint';

function Harness() {
  const hint = useTapHint();
  return (
    <ProfileCard profile={buildProfile()} tapHint={hint.visible} onPageChange={hint.dismiss} />
  );
}

beforeEach(() => AsyncStorage.clear());

it('no intercepta toques: deja pasar el dedo a la tarjeta', async () => {
  await render(<TapHint bottom={0} />);

  expect(screen.getByTestId('tap-hint')).toHaveProp('pointerEvents', 'none');
  expect(screen.getByText('Toca para ver más')).toBeTruthy();
});

it('sale la primera vez y, al tocar la tarjeta, se va para siempre', async () => {
  const first = await render(<Harness />);

  expect(await screen.findByTestId('tap-hint')).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: /^Ver / }));

  await waitFor(() => expect(screen.queryByTestId('tap-hint')).toBeNull());
  await waitFor(async () => expect(await AsyncStorage.getItem(TAP_HINT_KEY)).toBe('1'));
  await first.unmount();

  await render(<Harness />);
  await waitFor(async () => expect(await AsyncStorage.getItem(TAP_HINT_KEY)).toBe('1'));
  expect(screen.queryByTestId('tap-hint')).toBeNull();
});

it('retirada antes de que llegue la lectura, no reaparece y queda recordada', async () => {
  let release: (value: string | null) => void = () => undefined;
  jest
    .spyOn(AsyncStorage, 'getItem')
    .mockImplementationOnce(() => new Promise((resolve) => (release = resolve)));

  await render(<Harness />);
  await fireEvent.press(screen.getByRole('button', { name: /^Ver / }));
  release(null);

  await waitFor(async () => expect(await AsyncStorage.getItem(TAP_HINT_KEY)).toBe('1'));
  expect(screen.queryByTestId('tap-hint')).toBeNull();
});

it('el botón «i» abre el perfil sin pasar de bloque', async () => {
  const onOpenProfile = jest.fn();
  const onPageChange = jest.fn();
  const profile = buildProfile();
  await render(
    <ProfileCard profile={profile} onOpenProfile={onOpenProfile} onPageChange={onPageChange} />
  );

  await fireEvent.press(screen.getByRole('button', { name: `Ver el perfil de ${profile.name}` }));

  expect(onOpenProfile).toHaveBeenCalledTimes(1);
  expect(onPageChange).not.toHaveBeenCalled();
});

it('sin onOpenProfile no hay botón «i»', async () => {
  const profile = buildProfile();
  await render(<ProfileCard profile={profile} />);

  expect(screen.queryByRole('button', { name: `Ver el perfil de ${profile.name}` })).toBeNull();
});
