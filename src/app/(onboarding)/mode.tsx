import { ScreenPlaceholder } from '@/components/screen-placeholder';

// ANDAMIO — lo sustituye el bloque `perfil` (selección de modo).
// Al elegir, debe guardar con `repositories.session.setActiveMode(...)` y
// navegar a `/profile-form`.
export default function ModeScreen() {
  return (
    <ScreenPlaceholder
      label="Paso 1 de 2"
      title="¿Qué buscas?"
      description="Cofundador en igualdad de condiciones, compañero de Lock-In, o ambos."
      owner="perfil"
    />
  );
}
