import { CofounderLogo, Colors, Screen, Spacing } from 'cofounder';

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <Screen
      style={{
        flex: 0,
        padding: Spacing.five,
        flexDirection: 'row',
        gap: Spacing.five,
        alignItems: 'center',
      }}>
      {children}
    </Screen>
  );
}

export function Default() {
  return (
    <Frame>
      <CofounderLogo width={96} animated={false} />
    </Frame>
  );
}

export function Sizes() {
  return (
    <Frame>
      <CofounderLogo width={32} animated={false} />
      <CofounderLogo width={56} animated={false} />
      <CofounderLogo width={88} animated={false} />
    </Frame>
  );
}

export function Tinted() {
  return (
    <Frame>
      <CofounderLogo width={64} animated={false} color={Colors.dark.text} />
      <CofounderLogo width={64} animated={false} color={Colors.dark.teal} />
    </Frame>
  );
}
