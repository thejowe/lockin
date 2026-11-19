import { Button, Screen, Spacing } from 'cofounder';

// El sistema es solo oscuro: todo se ve sobre la raíz de pantalla real.
function Frame({ children }: { children: React.ReactNode }) {
  return <Screen style={{ flex: 0, padding: Spacing.four, gap: Spacing.two }}>{children}</Screen>;
}

export function Variants() {
  return (
    <Frame>
      <Button label="Crear perfil" onPress={() => {}} />
      <Button label="Volver a Matches" variant="secondary" onPress={() => {}} />
      <Button label="Descartar cambios" variant="danger" onPress={() => {}} />
    </Frame>
  );
}

export function Disabled() {
  return (
    <Frame>
      <Button label="Guardar y continuar" disabled onPress={() => {}} />
      <Button label="Cerrar" variant="secondary" disabled onPress={() => {}} />
    </Frame>
  );
}

export function Compact() {
  return (
    <Frame>
      <div style={{ display: 'flex', gap: Spacing.two }}>
        <Button label="Editar" compact variant="secondary" onPress={() => {}} />
        <Button label="Cerrar sesión" compact variant="danger" onPress={() => {}} />
      </div>
    </Frame>
  );
}

export function ActionRow() {
  return (
    <Frame>
      <div style={{ display: 'flex', gap: Spacing.two }}>
        <Button label="Cerrar" variant="secondary" style={{ flex: 1 }} onPress={() => {}} />
        <Button label="Reintentar" style={{ flex: 1 }} onPress={() => {}} />
      </div>
    </Frame>
  );
}
