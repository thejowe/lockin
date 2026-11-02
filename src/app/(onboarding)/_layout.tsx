import { Stack } from 'expo-router';

/**
 * Onboarding: elegir modo y crear perfil. Fuera de las tabs a propósito —
 * hasta que no hay perfil no hay nada que descubrir.
 */
export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Deslizar para volver, solo desde el borde izquierdo: desde iOS 26 el
          gesto vale en cualquier punto de la pantalla y se lleva el arrastre del
          `Slider` de horas hacia atrás (y con él todo lo rellenado). */}
      <Stack.Screen name="profile-form" options={{ fullScreenGestureEnabled: false }} />
    </Stack>
  );
}
