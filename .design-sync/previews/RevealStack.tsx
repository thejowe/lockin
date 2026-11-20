import { Glass, RevealStack, Screen, Spacing, ThemedText } from 'cofounder';

export function Cascade() {
  return (
    <Screen style={{ flex: 0, padding: Spacing.four }}>
      <RevealStack style={{ gap: Spacing.two }}>
        <ThemedText type="subtitle">Tus matches</ThemedText>
        <Glass style={{ padding: Spacing.three }}>
          <ThemedText type="heading">Marta Ríos</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Producto · Barcelona
          </ThemedText>
        </Glass>
        <Glass style={{ padding: Spacing.three }}>
          <ThemedText type="heading">Joan Puig</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Técnico · Girona
          </ThemedText>
        </Glass>
        <Glass style={{ padding: Spacing.three }}>
          <ThemedText type="heading">Lucía Martín</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Negocio · Madrid
          </ThemedText>
        </Glass>
      </RevealStack>
    </Screen>
  );
}
