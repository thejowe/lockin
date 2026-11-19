import { Button, MessageState, Screen } from 'cofounder';

// MessageState ocupa la pantalla (flex: 1): se le da un alto de pantalla corta.
function Frame({ children }: { children: React.ReactNode }) {
  return <Screen style={{ flex: 0, height: 420 }}>{children}</Screen>;
}

export function EmptyProfile() {
  return (
    <Frame>
      <MessageState
        eyebrow="Perfil"
        title="Todavía no tienes ficha"
        body="Crea tu perfil para que la gente pueda encontrarte en el deck.">
        <Button label="Crear perfil" onPress={() => {}} />
      </MessageState>
    </Frame>
  );
}

export function LoadError() {
  return (
    <Frame>
      <MessageState
        title="No hemos podido cargar el deck"
        body="Inténtalo otra vez en un momento."
        detail="network_timeout · 504">
        <Button label="Reintentar" onPress={() => {}} />
        <Button label="Cerrar" variant="secondary" onPress={() => {}} />
      </MessageState>
    </Frame>
  );
}

export function Unavailable() {
  return (
    <Frame>
      <MessageState
        eyebrow="Chat"
        eyebrowColor="danger"
        title="Esta conversación no está disponible"
        body="Vuelve a tus matches para ver tus conversaciones disponibles.">
        <Button label="Volver a Matches" variant="secondary" onPress={() => {}} />
      </MessageState>
    </Frame>
  );
}
