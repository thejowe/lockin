import { Screen, Spacing, ThemedText } from 'cofounder';

function Frame({ children }: { children: React.ReactNode }) {
  return <Screen style={{ flex: 0, padding: Spacing.four, gap: Spacing.three }}>{children}</Screen>;
}

export function SerifRoles() {
  return (
    <Frame>
      <ThemedText type="display">¡Match!</ThemedText>
      <ThemedText type="title">Encuentra a tu socio</ThemedText>
      <ThemedText type="subtitle">Todavía no tienes ficha</ThemedText>
    </Frame>
  );
}

export function SansRoles() {
  return (
    <Frame>
      <ThemedText type="heading">Acuerdo de socios</ThemedText>
      <ThemedText type="body">Crea tu perfil para que la gente pueda encontrarte en el deck.</ThemedText>
      <ThemedText type="bodyStrong">Reparto de equity y dedicación</ThemedText>
      <ThemedText type="small">Ha fallado la carga. Inténtalo otra vez en un momento.</ThemedText>
      <ThemedText type="caption">Última actividad hace 2 h</ThemedText>
      <ThemedText type="label">PERFIL</ThemedText>
    </Frame>
  );
}

export function InkLevels() {
  return (
    <Frame>
      <ThemedText type="body">Tinta principal: lo que se lee primero.</ThemedText>
      <ThemedText type="body" themeColor="textSecondary">
        Tinta secundaria: el porqué, en una línea.
      </ThemedText>
      <ThemedText type="body" themeColor="textMuted">
        Tinta apagada: metadatos y ayudas.
      </ThemedText>
      <ThemedText type="small" themeColor="teal">Conectado ahora</ThemedText>
      <ThemedText type="small" themeColor="danger">No se ha podido enviar</ThemedText>
    </Frame>
  );
}

export function Numbers() {
  return (
    <Frame>
      <ThemedText type="timer">24:59</ThemedText>
      <ThemedText type="mono" themeColor="textSecondary">40 % · 60 % · 4 años de vesting</ThemedText>
    </Frame>
  );
}
