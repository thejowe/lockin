import { Colors, Glass, Screen, Spacing, ThemedText } from 'cofounder';

function Frame({ children }: { children: React.ReactNode }) {
  return <Screen style={{ flex: 0, padding: Spacing.four, gap: Spacing.three }}>{children}</Screen>;
}

export function Card() {
  return (
    <Frame>
      <Glass style={{ padding: Spacing.three, gap: Spacing.one }}>
        <ThemedText type="heading">Marta Ríos</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Producto · Barcelona · busca socio técnico
        </ThemedText>
      </Glass>
    </Frame>
  );
}

export function Levels() {
  return (
    <Frame>
      <Glass style={{ padding: Spacing.three }}>
        <ThemedText type="body">Normal: tarjetas, filas, campos</ThemedText>
      </Glass>
      <Glass elevated style={{ padding: Spacing.three }}>
        <ThemedText type="body">Elevado: activo o seleccionado</ThemedText>
      </Glass>
      <Glass floating style={{ padding: Spacing.three }}>
        <ThemedText type="body">Flotante: con sombra</ThemedText>
      </Glass>
    </Frame>
  );
}

export function ListRows() {
  return (
    <Frame>
      <Glass radius={16} style={{ overflow: 'hidden' }}>
        {['Notificaciones', 'Privacidad', 'Idioma'].map((label, i) => (
          <div
            key={label}
            style={{
              padding: Spacing.three,
              borderTop: i ? `1px solid ${Colors.dark.border}` : 'none',
            }}>
            <ThemedText type="body">{label}</ThemedText>
          </div>
        ))}
      </Glass>
    </Frame>
  );
}
