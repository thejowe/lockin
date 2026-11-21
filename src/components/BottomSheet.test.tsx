import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { DeviceEventEmitter, Platform, StyleSheet, Text } from 'react-native';
import { State, type LegacyPanGesture } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Duration, Spacing } from '@/constants/theme';
import { BottomSheet } from './BottomSheet';

const mockReduced = jest.fn<boolean | null, []>(() => false);
jest.mock('@/hooks/use-reduce-motion', () => ({
  useReduceMotion: () => mockReduced() ?? false,
  useReduceMotionSetting: () => mockReduced(),
}));
beforeEach(() => mockReduced.mockReturnValue(false));

const frame = { x: 0, y: 0, height: 800, width: 400 };
const insets = { top: 40, bottom: 24, left: 8, right: 4 };

async function renderSheet(snapPoints: readonly number[] = [1]) {
  const close = jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={{ frame, insets }}>
      <BottomSheet
        visible
        onClose={close}
        title="Editor"
        snapPoints={snapPoints}
        footer={<Text>Guardar</Text>}>
        <Text>Campo</Text>
      </BottomSheet>
    </SafeAreaProvider>
  );
  const panel = screen.getByTestId('bottom-sheet-panel');
  const container = panel.parent!;
  return { panel, container, close };
}

async function openSheet(snapPoints: readonly number[] = [1]) {
  const sheet = await renderSheet(snapPoints);
  await fireEvent(sheet.container, 'layout', { nativeEvent: { layout: frame } });
  return sheet;
}

it('coloca toda la hoja fuera del modal desde el primer render y la desliza al medirlo', async () => {
  const reanimated = jest.requireMock('react-native-reanimated');
  const timing = jest.spyOn(reanimated, 'withTiming');
  try {
    const { panel, container } = await renderSheet([0.68]);
    const firstFrame = StyleSheet.flatten(panel.props.style);
    expect(firstFrame.height).toBeGreaterThan(0);
    expect(firstFrame.transform).toEqual([{ translateY: firstFrame.height }]);
    const entrance = expect.objectContaining({
      duration: Duration.slow,
      reduceMotion: reanimated.ReduceMotion.Never,
    });
    expect(timing).not.toHaveBeenCalledWith(0, entrance);
    await fireEvent(container, 'layout', { nativeEvent: { layout: frame } });
    expect(timing).toHaveBeenCalledWith(0, entrance);
  } finally {
    timing.mockRestore();
  }
});

it('mantiene el título dentro de la zona segura y el pie fuera del contenido desplazable', async () => {
  const { panel, close } = await openSheet();
  expect(panel).toHaveStyle({
    height: frame.height - insets.top - Spacing.two,
    paddingBottom: insets.bottom,
    paddingLeft: insets.left,
    paddingRight: insets.right,
  });
  expect(within(panel).getByRole('header', { name: 'Editor' })).toBeOnTheScreen();
  expect(within(panel).getByText('Guardar')).toBeOnTheScreen();
  let ancestor = screen.getByText('Campo').parent;
  while (ancestor && ancestor.props.keyboardShouldPersistTaps === undefined)
    ancestor = ancestor.parent;
  expect(ancestor).toBeTruthy();
  expect(within(ancestor!).queryByText('Guardar')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Cerrar' }));
  expect(close).toHaveBeenCalledTimes(1);
});

it('descuenta solo el teclado que tapa la hoja y recupera el inset al cerrarlo', async () => {
  const { panel, container } = await openSheet();
  const keyboardTop = 490;
  const keyboardEvent = {
    endCoordinates: { screenY: keyboardTop, height: 310, width: 400, screenX: 0 },
  };
  await act(async () => {
    DeviceEventEmitter.emit(
      Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow',
      keyboardEvent
    );
  });
  expect(panel).toHaveStyle({
    height: keyboardTop - insets.top - Spacing.two,
    marginBottom: frame.height - keyboardTop,
    paddingBottom: 0,
  });
  // Si la ventana ya se redimensionó al aparecer el teclado, no hay un segundo solape.
  await fireEvent(container, 'layout', {
    nativeEvent: { layout: { ...frame, height: keyboardTop } },
  });
  expect(panel).toHaveStyle({ height: keyboardTop - insets.top - Spacing.two, marginBottom: 0 });
  await act(async () => {
    DeviceEventEmitter.emit(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      keyboardEvent
    );
  });
  await fireEvent(container, 'layout', { nativeEvent: { layout: frame } });
  expect(panel).toHaveStyle({
    height: frame.height - insets.top - Spacing.two,
    paddingBottom: insets.bottom,
  });
});

it('sigue el ajuste de reducir movimiento si cambia con la app abierta', async () => {
  // Arrancó con el ajuste puesto (lo que leyó Reanimated) y el sistema aún no ha respondido.
  const reanimated = jest.requireMock('react-native-reanimated');
  const startup = jest.spyOn(reanimated, 'useReducedMotion').mockReturnValue(true);
  mockReduced.mockReturnValue(null);
  await openSheet();
  expect(screen.root?.props.animationType).toBe('fade');

  // Lo apaga en Ajustes: las hojas que se abren desde ese momento ya se deslizan.
  mockReduced.mockReturnValue(false);
  await openSheet();
  expect(screen.root?.props.animationType).not.toBe('fade');

  // Y al revés: si lo vuelve a activar, la siguiente vuelve al fundido.
  mockReduced.mockReturnValue(true);
  await openSheet();
  expect(screen.root?.props.animationType).toBe('fade');
  startup.mockRestore();
});

it('con movimiento reducido la hoja entra por fundido y conserva el cierre por gesto', async () => {
  mockReduced.mockReturnValue(true);
  const { panel, close } = await renderSheet([0.66, 0.94]);
  expect(screen.root?.props.animationType).toBe('fade');
  expect(panel).toHaveStyle({ transform: [{ translateY: 0 }] });

  const gesture = getByGestureTestId('bottom-sheet-pan');
  async function drag(translationY: number) {
    await act(async () => {
      fireGestureHandler<LegacyPanGesture>(gesture, [
        { state: State.BEGAN, translationY: 0 },
        { state: State.ACTIVE, translationY: translationY / 2 },
        { state: State.END, translationY, velocityY: 0 },
      ]);
    });
  }
  await drag(-240);
  await drag(224);
  expect(close).not.toHaveBeenCalled();
  await drag(110);
  expect(close).toHaveBeenCalledTimes(1);
});
