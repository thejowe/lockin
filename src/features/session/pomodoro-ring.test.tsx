/**
 * El anillo del Pomodoro: cuánto arco toca en cada fase, y que el centro pinta
 * lo que se le pasa.
 */

import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { BLOCK_MINUTES, WORK_MINUTES } from '@/data';

import { PomodoroRing, phaseProgress } from './pomodoro-ring';

const MINUTE = 60_000;

describe('phaseProgress', () => {
  it('antes de empezar no hay arco', () => {
    expect(phaseProgress({ kind: 'antes', block: 0, remainingMs: 5 * MINUTE })).toBe(0);
  });

  it('a mitad del trabajo, medio arco', () => {
    const half = (WORK_MINUTES * MINUTE) / 2;
    expect(phaseProgress({ kind: 'trabajo', block: 1, remainingMs: half })).toBeCloseTo(0.5);
  });

  it('el descanso se mide sobre su propia duración', () => {
    const rest = (BLOCK_MINUTES - WORK_MINUTES) * MINUTE;
    expect(phaseProgress({ kind: 'descanso', block: 1, remainingMs: rest })).toBe(0);
    expect(phaseProgress({ kind: 'descanso', block: 1, remainingMs: 0 })).toBe(1);
  });

  it('terminada, arco completo', () => {
    expect(phaseProgress({ kind: 'terminada', block: 2, remainingMs: 0 })).toBe(1);
  });
});

describe('PomodoroRing', () => {
  it('pinta en el centro la cuenta atrás que se le pasa', async () => {
    const view = await render(
      <PomodoroRing phase={{ kind: 'trabajo', block: 1, remainingMs: 10 * MINUTE }}>
        <Text>10:00</Text>
      </PomodoroRing>
    );

    expect(screen.getByText('10:00')).toBeTruthy();

    // Al cambiar de fase hacia atrás (trabajo → descanso) se vuelve a pintar sin romper.
    await view.rerender(
      <PomodoroRing phase={{ kind: 'descanso', block: 1, remainingMs: 4 * MINUTE }}>
        <Text>04:00</Text>
      </PomodoroRing>
    );
    expect(screen.getByText('04:00')).toBeTruthy();
  });
});
