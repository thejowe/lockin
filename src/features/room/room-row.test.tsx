import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { buildProfile } from '@/data/test-fixtures';

import { RoomRow } from './room-row';

import type { RoomView } from '@/data';

const now = new Date(2026, 9, 3, 12).getTime();
const startsAt = new Date(2026, 9, 3, 12, 5, 30).toISOString();
const me = {
  roomId: 'room',
  profileId: 'me',
  status: 'aceptada' as const,
  respondedAt: null,
  joinedAt: null,
  leftAt: null,
};
const view: RoomView = {
  room: { id: 'room', hostId: 'ana', startsAt, blocks: 1, cancelledAt: null, createdAt: startsAt },
  me,
  others: [
    {
      member: { ...me, profileId: 'ana' },
      profile: buildProfile({ id: 'ana', name: 'Ana García' }),
    },
  ],
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(now);
});
afterEach(() => {
  jest.useRealTimers();
});

it('pinta título y detalle y los junta en el nombre accesible del botón', async () => {
  await render(<RoomRow view={view} onPress={jest.fn()} />);
  expect(screen.getByText('Sala')).toBeTruthy();
  expect(screen.getByText('hoy 12:05 · 2 personas')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Sala · hoy 12:05 · 2 personas' })).toBeTruthy();
});

it('tocar la fila llama a onPress', async () => {
  const onPress = jest.fn();
  await render(<RoomRow view={view} onPress={onPress} />);
  await fireEvent.press(screen.getByRole('button'));
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('actualiza el texto al abrirse la ventana con la fila montada', async () => {
  await render(<RoomRow view={view} onPress={jest.fn()} />);
  await act(async () => {
    jest.advanceTimersByTime(30_000);
  });
  expect(
    screen.getByRole('button', { name: 'Entrar a la sala · hoy 12:05 · 1 bloque' })
  ).toBeTruthy();
});
