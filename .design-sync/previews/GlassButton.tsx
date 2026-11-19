import { GlassButton, Screen, Spacing, ThemedText } from 'cofounder';

function Frame({ children }: { children: React.ReactNode }) {
  return <Screen style={{ flex: 0, padding: Spacing.four, gap: Spacing.two }}>{children}</Screen>;
}

export function Welcome() {
  return (
    <Frame>
      <ThemedText type="title" style={{ marginBottom: Spacing.three }}>
        Encuentra a tu socio
      </ThemedText>
      <GlassButton label="Iniciar sesión" tint="light" onPress={() => {}} />
      <GlassButton label="Registrarse" tint="dark" onPress={() => {}} />
    </Frame>
  );
}

export function Tints() {
  return (
    <Frame>
      <GlassButton label="Claro" tint="light" onPress={() => {}} />
      <GlassButton label="Oscuro" tint="dark" onPress={() => {}} />
    </Frame>
  );
}

export function Disabled() {
  return (
    <Frame>
      <GlassButton label="Un momento…" tint="dark" disabled onPress={() => {}} />
    </Frame>
  );
}
