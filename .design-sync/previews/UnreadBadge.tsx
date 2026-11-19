import { Colors, Glass, Icon, Screen, Spacing, ThemedText, UnreadBadge } from 'cofounder';

function Frame({ children }: { children: React.ReactNode }) {
  return <Screen style={{ flex: 0, padding: Spacing.four, gap: Spacing.three }}>{children}</Screen>;
}

export function Counts() {
  return (
    <Frame>
      <div style={{ display: 'flex', gap: Spacing.three, alignItems: 'center' }}>
        <UnreadBadge count={1} />
        <UnreadBadge count={9} />
        <UnreadBadge count={24} />
        <UnreadBadge count={150} />
      </div>
    </Frame>
  );
}

export function OnTabIcon() {
  return (
    <Frame>
      <div style={{ position: 'relative', width: 28, height: 28 }}>
        <Icon name="chat" color={Colors.dark.text} size={28} />
        <UnreadBadge count={3} size="small" style={{ position: 'absolute', top: -4, right: -8 }} />
      </div>
    </Frame>
  );
}

export function InRow() {
  return (
    <Frame>
      <Glass style={{ padding: Spacing.three, flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
        <div style={{ flex: 1, display: 'grid', gap: 2 }}>
          <ThemedText type="heading">Marta Ríos</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">¿Te va bien una llamada el jueves?</ThemedText>
        </div>
        <UnreadBadge count={2} />
      </Glass>
    </Frame>
  );
}
