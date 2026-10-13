/**
 * El paginador montado: el gesto navega a la pestaña de al lado, vuelve si el
 * arrastre es corto y cede el gesto al deck de Descubrir mientras tiene
 * tarjetas. La matemática pura vive en `swipe-between-tabs.test.ts`.
 */

import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { State, type PanGesture } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import {
  PAGER_PAN_TEST_ID,
  PagerPage,
  SwipeBetweenTabs,
  useLockTabSwipe,
} from '@/components/swipe-between-tabs';

const mockNavigate = jest.fn();
let mockPathname = '/discover';

jest.mock('expo-router', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ navigate: mockNavigate }),
}));

const mockReduceMotion = jest.fn(() => false);
jest.mock('@/hooks/use-reduce-motion', () => ({ useReduceMotion: () => mockReduceMotion() }));

function Locker({ locked }: { locked: boolean }) {
  useLockTabSwipe(locked);
  return <Text>{locked ? 'deck con tarjetas' : 'deck vacío'}</Text>;
}

function drag(translationX: number, velocityX = 0) {
  fireGestureHandler<PanGesture>(getByGestureTestId(PAGER_PAN_TEST_ID), [
    { state: State.BEGAN, translationX: 0, translationY: 0 },
    { state: State.ACTIVE, translationX: translationX / 2, translationY: 0 },
    { translationX, translationY: 0 },
    { state: State.END, translationX, translationY: 0, velocityX, velocityY: 0 },
  ]);
}

beforeEach(() => {
  mockNavigate.mockClear();
  mockReduceMotion.mockReturnValue(false);
  mockPathname = '/matches';
});

describe('SwipeBetweenTabs', () => {
  it('un arrastre largo a la izquierda navega a la pestaña siguiente', async () => {
    await render(
      <SwipeBetweenTabs>
        <Text>contenido</Text>
      </SwipeBetweenTabs>
    );

    await act(async () => drag(-300));

    expect(mockNavigate).toHaveBeenCalledWith('/profile');
  });

  it('un arrastre largo a la derecha navega a la anterior', async () => {
    await render(
      <SwipeBetweenTabs>
        <Text>contenido</Text>
      </SwipeBetweenTabs>
    );

    await act(async () => drag(300));

    expect(mockNavigate).toHaveBeenCalledWith('/discover');
  });

  it('un arrastre corto y lento se queda en la pestaña', async () => {
    await render(
      <SwipeBetweenTabs>
        <Text>contenido</Text>
      </SwipeBetweenTabs>
    );

    await act(async () => drag(-20, -50));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('con «reducir movimiento» también navega, sin muelle', async () => {
    mockReduceMotion.mockReturnValue(true);
    await render(
      <SwipeBetweenTabs>
        <Text>contenido</Text>
      </SwipeBetweenTabs>
    );

    await act(async () => drag(-300));

    expect(mockNavigate).toHaveBeenCalledWith('/profile');
  });

  it('en Descubrir con tarjetas el gesto es del deck', async () => {
    mockPathname = '/discover';
    await render(
      <SwipeBetweenTabs>
        <Locker locked />
      </SwipeBetweenTabs>
    );

    await act(async () => drag(-300));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('en Descubrir con el deck vacío el paginador vuelve a ser suyo', async () => {
    mockPathname = '/discover';
    await render(
      <SwipeBetweenTabs>
        <Locker locked={false} />
      </SwipeBetweenTabs>
    );

    await act(async () => drag(-300));

    expect(mockNavigate).toHaveBeenCalledWith('/matches');
  });

  it('una ruta que no es pestaña cuenta como la primera', async () => {
    mockPathname = '/chat/abc';
    await render(
      <SwipeBetweenTabs>
        <Text>contenido</Text>
      </SwipeBetweenTabs>
    );

    await act(async () => drag(300));

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe('PagerPage', () => {
  it('la página enfocada es visible y las demás se ocultan al lector de pantalla', async () => {
    await render(
      <SwipeBetweenTabs>
        <PagerPage index={1} isFocused>
          <Text>visible</Text>
        </PagerPage>
        <PagerPage index={2} isFocused={false}>
          <Text>oculta</Text>
        </PagerPage>
      </SwipeBetweenTabs>
    );

    expect(screen.getByText('visible')).toBeOnTheScreen();
    expect(screen.queryByText('oculta')).toBeNull();
  });

  it('fuera de un paginador se monta igual', async () => {
    await render(
      <PagerPage index={0} isFocused>
        <Text>suelta</Text>
      </PagerPage>
    );

    expect(screen.getByText('suelta')).toBeOnTheScreen();
  });
});
