import { ScreenPlaceholder } from '@/components/screen-placeholder';

// ANDAMIO — lo sustituye el bloque `chat` (conversación 1:1).
// No olvides el hueco visible de "Agendar sesión Lock-In": es el diferenciador
// del producto, ver `docs/plan/CONCEPTO.md`.
export default function ChatScreen() {
  return (
    <ScreenPlaceholder
      label="Conversación"
      title="Vuestro hilo"
      description="Mensajes, icebreakers sugeridos y el botón para agendar una sesión Lock-In."
      owner="chat"
    />
  );
}
