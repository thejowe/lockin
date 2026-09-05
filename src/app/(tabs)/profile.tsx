import { ScreenPlaceholder } from '@/components/screen-placeholder';

// ANDAMIO — lo sustituye el bloque `perfil` (ver y editar el perfil propio).
export default function ProfileScreen() {
  return (
    <ScreenPlaceholder
      label="Perfil"
      title="Tu ficha"
      description="Ver y editar tu perfil, reutilizando el formulario del onboarding."
      owner="perfil"
    />
  );
}
