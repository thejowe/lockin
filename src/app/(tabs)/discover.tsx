import { ScreenPlaceholder } from '@/components/screen-placeholder';

// ANDAMIO — lo sustituye el bloque `descubrir` (deck de swipe + matching).
export default function DiscoverScreen() {
  return (
    <ScreenPlaceholder
      label="Descubrir"
      title="Aquí va el deck"
      description="Tarjetas de perfil con swipe, filtradas por el modo activo. Un like recíproco genera match."
      owner="descubrir"
    />
  );
}
