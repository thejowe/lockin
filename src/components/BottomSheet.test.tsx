import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { DeviceEventEmitter, Platform, Text } from 'react-native';
import { State, type LegacyPanGesture } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { BottomSheet } from './BottomSheet';

const mockReduced = jest.fn(() => false);
jest.mock('@/hooks/use-reduce-motion', () => ({ useReduceMotion: () => mockReduced() }));
beforeEach(() => mockReduced.mockReturnValue(false));

const frame = { x: 0, y: 0, height: 800, width: 400 };
const insets = { top: 40, bottom: 24, left: 8, right: 4 };

async function openSheet(snapPoints: readonly number[] = [1]) {
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
  await fireEvent(container, 'layout', { nativeEvent: { layout: frame } });
  return { panel, container, close };
}

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

it('con movimiento reducido la hoja entra por fundido y conserva el cierre por gesto', async () => {
  mockReduced.mockReturnValue(true);
  const { panel, close } = await openSheet([0.66, 0.94]);
  expect(screen.root?.props.animationType).toBe('fade');
  expect(panel.props.entering).toBeUndefined();

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
