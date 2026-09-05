import { ScreenPlaceholder } from '@/components/screen-placeholder';

// ANDAMIO — lo sustituye el bloque `chat` (lista de matches).
export default function MatchesScreen() {
  return (
    <ScreenPlaceholder
      label="Matches"
      title="Con quién has conectado"
      description="Lista de matches con el último mensaje, y entrada a cada conversación."
      owner="chat"
    />
  );
}
