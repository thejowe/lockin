import { Stack } from 'expo-router';

/**
 * Onboarding: elegir modo y crear perfil. Fuera de las tabs a propósito —
 * hasta que no hay perfil no hay nada que descubrir.
 */
export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
