import { Colors, Icon, Screen, Spacing, ThemedText } from 'cofounder';

const NAMES = [
  'discover',
  'chat',
  'person',
  'pair',
  'focus',
  'both',
  'heart',
  'close',
  'expand',
  'check',
  'flame',
  'lock',
  'sparkle',
  'send',
  'document',
  'chevrons',
  'back',
  'camera',
  'pencil',
  'menu',
  'diamond',
  'eye',
  'eye-off',
  'sliders',
] as const;

function Frame({ children }: { children: React.ReactNode }) {
  return <Screen style={{ flex: 0, padding: Spacing.four }}>{children}</Screen>;
}

export function Set() {
  return (
    <Frame>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: Spacing.three }}>
        {NAMES.map((n) => (
          <div key={n} style={{ display: 'grid', justifyItems: 'center', gap: Spacing.one }}>
            <Icon name={n} color={Colors.dark.text} />
            <ThemedText type="caption" themeColor="textMuted">
              {n}
            </ThemedText>
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function Semantic() {
  return (
    <Frame>
      <div style={{ display: 'flex', gap: Spacing.four, alignItems: 'center' }}>
        <Icon name="heart" color={Colors.dark.danger} fill={Colors.dark.danger} size={28} />
        <Icon name="check" color={Colors.dark.teal} size={28} />
        <Icon name="diamond" color={Colors.dark.diamond} size={28} />
        <Icon name="close" color={Colors.dark.textSecondary} size={28} />
        <Icon name="sparkle" color={Colors.dark.text} size={28} strokeWidth={1.4} />
      </div>
    </Frame>
  );
}
