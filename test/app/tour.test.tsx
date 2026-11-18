/**
 * Tests del mini tutorial de después del alta (`/tour`).
 *
 * Lo que importa: que se pueda recorrer con «Siguiente» hasta «Empezar», que
 * «Omitir» salga de golpe y que en los dos casos se llegue a Descubrir con
 * `replace` (atrás no vuelve al tutorial). Que las páginas se pasen también
 * deslizando lo da el `ScrollView` con `pagingEnabled`; aquí no se simula.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { buildProfileInput } from '@/data/test-fixtures';
import { tourSeenKey } from '@/features/tour/tour-seen';

import { renderRoute, repositories, resetRepositories, resetRouter, router } from '../routes';

import { TOUR_PAGES } from '@/features/tour/app-tour';

import TourScreen from '../../src/app/(onboarding)/tour';

jest.mock('expo-router', () => require('../routes').expoRouterMock());

beforeEach(async () => {
  resetRepositories();
  resetRouter();
  await AsyncStorage.clear();
});

describe('TourScreen', () => {
  it('enseña las cuatro funciones: Descubrir, chat, Grupos y perfil', async () => {
    await renderRoute(<TourScreen />);

    for (const title of [
      'Encuentra a tu cofundador',
      'Habla con tus matches',
      'Únete a un grupo',
      'Destaca con tu perfil',
    ]) {
      expect(screen.getByText(title)).toBeTruthy();
    }
    expect(TOUR_PAGES).toHaveLength(4);
  });

  it('«Siguiente» avanza hasta la última página, que cambia a «Empezar» y entra', async () => {
    await renderRoute(<TourScreen />);

    for (let page = 1; page < TOUR_PAGES.length; page++) {
      await fireEvent.press(screen.getByRole('button', { name: 'Siguiente' }));
    }
    expect(router.replace).not.toHaveBeenCalled();
    // En la última ya no hay «Omitir»: el botón grande hace lo mismo.
    expect(screen.queryByRole('button', { name: 'Omitir' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Empezar' }));

    expect(router.replace).toHaveBeenCalledWith('/discover');
    expect(router.push).not.toHaveBeenCalled();
  });

  it('«Omitir» sale directo a Descubrir', async () => {
    await renderRoute(<TourScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Omitir' }));

    expect(router.replace).toHaveBeenCalledWith('/discover');
  });

  it('cada página se lee entera con el lector de pantalla y dice en qué paso va', async () => {
    await renderRoute(<TourScreen />);

    const first = screen.getByLabelText(
      'Encuentra a tu cofundador. Toca a la derecha para ver lo siguiente y a la izquierda para volver'
    );
    expect(first.props.accessibilityHint).toBe('Paso 1 de 4');
  });

  it('al salir lo marca como visto para esta cuenta: no vuelve a salir', async () => {
    await repositories.session.setActiveMode('par');
    await repositories.profiles.saveCurrent(buildProfileInput());
    await renderRoute(<TourScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Omitir' }));

    await waitFor(async () => expect(await AsyncStorage.getItem(tourSeenKey('me'))).toBe('1'));
  });
});
