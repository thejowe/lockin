import { ScreenPlaceholder } from '@/components/screen-placeholder';

// ANDAMIO — lo sustituye el bloque `perfil` (formulario de creación).
// Al guardar, debe llamar a `repositories.profiles.saveCurrent(...)` y
// navegar a `/discover`.
export default function ProfileFormScreen() {
  return (
    <ScreenPlaceholder
      label="Paso 2 de 2"
      title="Cuéntate"
      description="Especialidades, punto de partida, disponibilidad, ambición y un par de respuestas cortas."
      owner="perfil"
    />
  );
}
