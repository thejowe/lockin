import { Colors, Screen, Spacing, ThinkingLogo } from 'cofounder';

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <Screen style={{ flex: 0, padding: Spacing.five, flexDirection: 'row', gap: Spacing.five, alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </Screen>
  );
}

export function Pulsing() {
  return (
    <Frame>
      <ThinkingLogo color={Colors.dark.brass} />
    </Frame>
  );
}

export function Sizes() {
  return (
    <Frame>
      <ThinkingLogo width={40} color={Colors.dark.text} />
      <ThinkingLogo width={72} color={Colors.dark.text} />
    </Frame>
  );
}
