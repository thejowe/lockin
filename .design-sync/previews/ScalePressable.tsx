import {
  Colors,
  glassStyle,
  Icon,
  Radii,
  ScalePressable,
  Screen,
  Spacing,
  ThemedText,
} from 'cofounder';

function Frame({ children }: { children: React.ReactNode }) {
  return <Screen style={{ flex: 0, padding: Spacing.four, gap: Spacing.three }}>{children}</Screen>;
}

export function GlassCard() {
  return (
    <Frame>
      <ScalePressable
        accessibilityRole="button"
        onPress={() => {}}
        style={[glassStyle(Colors.dark), { padding: Spacing.three, gap: Spacing.one }]}
        pressedStyle={{ backgroundColor: Colors.dark.backgroundSelected }}>
        <ThemedText type="heading">Acuerdo de socios</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Reparto, dedicación y vesting. Toca para revisarlo.
        </ThemedText>
      </ScalePressable>
    </Frame>
  );
}

export function Chip() {
  return (
    <Frame>
      <div style={{ display: 'flex', gap: Spacing.two }}>
        {['Producto', 'Técnico', 'Negocio'].map((label, i) => (
          <ScalePressable
            key={label}
            accessibilityRole="button"
            onPress={() => {}}
            style={{
              paddingHorizontal: Spacing.three,
              height: 36,
              justifyContent: 'center',
              borderRadius: Radii.pill,
              borderWidth: 1,
              borderColor: Colors.dark.border,
              backgroundColor:
                i === 0 ? Colors.dark.backgroundSelected : Colors.dark.backgroundElement,
            }}>
            <ThemedText type="label">{label}</ThemedText>
          </ScalePressable>
        ))}
      </div>
    </Frame>
  );
}

export function IconButton() {
  return (
    <Frame>
      <ScalePressable
        accessibilityRole="button"
        accessibilityLabel="Me gusta"
        onPress={() => {}}
        style={{
          width: 56,
          height: 56,
          borderRadius: Radii.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: Colors.dark.backgroundElement,
          borderWidth: 1,
          borderColor: Colors.dark.border,
        }}>
        <Icon name="heart" color={Colors.dark.text} size={24} />
      </ScalePressable>
    </Frame>
  );
}
