import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { BrandFonts } from '@/constants/fonts';
import { Colors, FontFamily } from '@/constants/theme';
import { DataProvider } from '@/data';
import { useThemeName } from '@/hooks/use-theme';

SplashScreen.preventAutoHideAsync();

/** Tema de navegación derivado de la paleta de marca. */
function navigationTheme(scheme: 'light' | 'dark') {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const palette = Colors[scheme];

  return {
    ...base,
    dark: scheme === 'dark',
    colors: {
      ...base.colors,
      primary: palette.brass,
      background: palette.background,
      card: palette.background,
      text: palette.text,
      border: palette.border,
      notification: palette.danger,
    },
  };
}

export default function RootLayout() {
  const scheme = useThemeName();
  const palette = Colors[scheme];
  const [fontsLoaded, fontError] = useFonts(BrandFonts);

  useEffect(() => {
    // Si las fuentes fallan, arrancamos igual con los fallbacks del sistema:
    // quedarse en el splash para siempre sería peor que una tipografía distinta.
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    // `KeyboardProvider` va aquí, en la raíz, porque es donde se engancha a los
    // WindowInsets del IME. Lo pide `chat/[matchId]`: bajo edge-to-edge
    // —obligatorio desde Expo SDK 54— Android 15+ ya no redimensiona la ventana
    // al abrir el teclado, y el `KeyboardAvoidingView` de React Native se entera
    // por `keyboardDidShow`, que se emite justamente al observar ese resize. Sin
    // resize no hay evento, así que ahí es inerte con cualquier `behavior`.
    // Ver `docs/plan/todo/chat.md`.
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.background }}>
      <KeyboardProvider>
        <ThemeProvider value={navigationTheme(scheme)}>
          <DataProvider>
            <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: palette.background },
              }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(onboarding)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="chat/[matchId]"
                options={{
                  headerShown: true,
                  headerBackButtonDisplayMode: 'minimal',
                  headerStyle: { backgroundColor: palette.background },
                  headerTintColor: palette.brass,
                  headerTitleStyle: { color: palette.text, fontFamily: FontFamily.display },
                }}
              />
            </Stack>
          </DataProvider>
        </ThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
