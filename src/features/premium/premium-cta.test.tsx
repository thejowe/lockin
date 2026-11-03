/**
 * El botón grande de «Hazte Premium»: con «reducir movimiento» abre el paywall sin
 * más; con movimiento, el diamante crece, y ya tapada la pantalla se abre el paywall.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, View } from 'react-native';

import { openPaywall } from './open-paywall';
import { PremiumCta } from './premium-cta';

jest.mock('./open-paywall', () => ({ openPaywall: jest.fn() }));

const proto = View.prototype as unknown as {
  measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
};

const originalMeasure = proto.measureInWindow;

afterEach(() => {
  proto.measureInWindow = originalMeasure;
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('PremiumCta', () => {
  it('con «reducir movimiento» abre el paywall directamente', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await render(<PremiumCta />);
    // La consulta del sistema es asíncrona: esperar a que se aplique.
    await waitFor(() => expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalled());
    await screen.findByRole('button', { name: 'Hazte Premium' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    await fireEvent.press(screen.getByRole('button', { name: 'Hazte Premium' }));

    expect(openPaywall).toHaveBeenCalledTimes(1);
  });

  it('con movimiento, mide el diamante y acaba abriendo el paywall', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    proto.measureInWindow = (cb) => cb(100, 200, 72, 72);
    await render(<PremiumCta />);

    await fireEvent.press(screen.getByRole('button', { name: 'Hazte Premium' }));

    await waitFor(() => expect(openPaywall).toHaveBeenCalledTimes(1));
  });
});
