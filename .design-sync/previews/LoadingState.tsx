import { LoadingState, Screen } from 'cofounder';

function Frame({ children }: { children: React.ReactNode }) {
  return <Screen style={{ flex: 0, height: 320 }}>{children}</Screen>;
}

export function Default() {
  return (
    <Frame>
      <LoadingState label="Buscando perfiles…" />
    </Frame>
  );
}

export function WithDetail() {
  return (
    <Frame>
      <LoadingState
        label="Preparando el acuerdo"
        detail="Estamos generando el borrador del acuerdo de socios."
      />
    </Frame>
  );
}
