import { BackArrow, Screen, Spacing, ThemedText } from 'cofounder';

export function InHeader() {
  return (
    <Screen style={{ flex: 0, paddingVertical: Spacing.three, gap: Spacing.three }}>
      <BackArrow onPress={() => {}} />
      <ThemedText type="title" style={{ paddingHorizontal: Spacing.four }}>
        Iniciar sesión
      </ThemedText>
    </Screen>
  );
}
