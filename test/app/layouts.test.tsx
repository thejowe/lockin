/**
 * Tests de los tres `_layout.tsx`.
 *
 * Casi todo lo que hacen es declarativo, pero el de la raíz sí decide dos cosas
 * que dejan la app en negro si se rompen: no pintar nada hasta que las fuentes
 * resuelven, y esconder el splash igualmente cuando fallan. Un fallo de fuentes
 * que se tragara el `hideAsync` dejaría el splash para siempre, y eso no se ve
 * en ningún otro test.
 *
 * También se comprueba que el tema de navegación sale de la paleta de marca:
 * es lo que pinta el fondo de la barra del chat, la única cabecera nativa.
 *
 * Ojo: en RNTL 14 `render` es asíncrono.
 */

import { render, screen } from '@testing-library/react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Text } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));

// `jest.setup.js` deja `useFonts` fijo en "ya cargadas"; aquí hace falta poder
// moverlo test a test, así que se sustituye por un espía de verdad.
jest.mock('expo-font', () => ({
  ...jest.requireActual('expo-font'),
  useFonts: jest.fn(() => [true, null]),
  isLoaded: () => true,
  loadAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: jest.fn(() => 'light') }));

/** Valor que el layout raíz pasa al `ThemeProvider` de navegación. */
const mockTheme: { value: unknown } = { value: null };

jest.mock('expo-router', () => {
  const { Text: T } = require('react-native');

  const Stack = Object.assign(({ children }: { children?: React.ReactNode }) => children ?? null, {
    Screen: ({ name }: { name: string }) => <T>{`ruta:${name}`}</T>,
  });

  return {
    Stack,
    DefaultTheme: { dark: false, colors: { primary: '#000' } },
    DarkTheme: { dark: true, colors: { primary: '#fff' } },
    ThemeProvider: ({ value, children }: { value: unknown; children: React.ReactNode }) => {
      mockTheme.value = value;
      return children;
    },
  };
});

const mockUseFonts = useFonts as jest.MockedFunction<typeof useFonts>;
const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseColorScheme.mockReturnValue('light');
  mockTheme.value = null;
});

describe('RootLayout', () => {
  /** Se importa dentro de cada test para que el mock de fuentes ya esté puesto. */
  function load() {
    return require('../../src/app/_layout').default as () => React.ReactElement | null;
  }

  it('esconde el splash nada más resolver las fuentes y declara las rutas', async () => {
    mockUseFonts.mockReturnValue([true, null]);
    const RootLayout = load();

    await render(<RootLayout />);

    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
    expect(screen.getByText('ruta:index')).toBeTruthy();
    expect(screen.getByText('ruta:(tabs)')).toBeTruthy();
    expect(screen.getByText('ruta:chat/[matchId]')).toBeTruthy();
  });

  it('no pinta nada mientras las fuentes ni han cargado ni han fallado', async () => {
    mockUseFonts.mockReturnValue([false, null]);
    const RootLayout = load();

    await render(<RootLayout />);

    expect(screen.queryByText('ruta:index')).toBeNull();
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  });

  it('si las fuentes fallan arranca igual: quedarse en el splash sería peor', async () => {
    mockUseFonts.mockReturnValue([false, new Error('no se ha podido cargar la fuente')]);
    const RootLayout = load();

    await render(<RootLayout />);

    expect(screen.getByText('ruta:index')).toBeTruthy();
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });

  it.each(['light', 'dark'] as const)(
    'deriva el tema de navegación %s de la paleta de marca',
    async (scheme) => {
      mockUseColorScheme.mockReturnValue(scheme);
      mockUseFonts.mockReturnValue([true, null]);
      const RootLayout = load();

      await render(<RootLayout />);

      expect(mockTheme.value).toMatchObject({
        dark: scheme === 'dark',
        colors: expect.objectContaining({
          primary: Colors[scheme].brass,
          background: Colors[scheme].background,
          text: Colors[scheme].text,
        }),
      });
    }
  );
});

describe('OnboardingLayout', () => {
  it('monta su Stack sin cabecera: los dos pasos traen la suya', async () => {
    const OnboardingLayout = require('../../src/app/(onboarding)/_layout').default;

    await render(<OnboardingLayout />);

    expect(screen.toJSON()).toBeNull();
  });
});

describe('TabsLayout', () => {
  it('delega en el componente de tabs, que es quien conoce cada plataforma', async () => {
    jest.doMock('@/components/app-tabs', () => ({
      __esModule: true,
      default: () => <Text>tabs</Text>,
    }));
    const TabsLayout = require('../../src/app/(tabs)/_layout').default;

    await render(<TabsLayout />);

    expect(screen.getByText('tabs')).toBeTruthy();
  });
});
