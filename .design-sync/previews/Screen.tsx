import { Button, Glass, Screen, Spacing, ThemedText } from 'cofounder';

export function ScreenRoot() {
  return (
    <Screen style={{ flex: 0, height: 360, padding: Spacing.four, gap: Spacing.four }}>
      <div style={{ display: 'grid', gap: Spacing.two }}>
        <ThemedText type="label" themeColor="textSecondary">
          Perfil
        </ThemedText>
        <ThemedText type="title">Sobre ti</ThemedText>
      </div>
      <Glass style={{ padding: Spacing.three, gap: Spacing.one }}>
        <ThemedText type="heading">Rol</ThemedText>
        <ThemedText type="body" themeColor="textSecondary">
          Producto y diseño
        </ThemedText>
      </Glass>
      <div style={{ flex: 1 }} />
      <Button label="Guardar y continuar" onPress={() => {}} />
    </Screen>
  );
}
