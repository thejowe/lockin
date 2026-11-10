import { useLocalSearchParams, useRouter } from 'expo-router';

import { OnPremium, PaywallReveal } from '@/constants/theme';
import { Paywall } from '@/features/premium/paywall';
import { ThemeOverride } from '@/hooks/use-theme';

/**
 * `/premium`: el paywall, a pantalla completa sobre la noche azul de Premium.
 * Se abre desde el deck, Matches y Cuenta (ver `openPaywall`). Términos y
 * Privacidad abren su propia hoja.
 *
 * Con `?via=gem` viene de la animación del diamante (`premium-cta.tsx`): el
 * velo aún tapa la pantalla al montar, así que el contenido espera a que se
 * retire antes de entrar.
 */
export default function PremiumRoute() {
  const router = useRouter();
  const { via } = useLocalSearchParams<{ via?: string }>();

  return (
    <ThemeOverride.Provider value={OnPremium}>
      <Paywall
        entranceDelay={via === 'gem' ? PaywallReveal.hold : 0}
        onClose={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        onOpenLegal={(doc) => router.push({ pathname: '/legal/[doc]', params: { doc } })}
      />
    </ThemeOverride.Provider>
  );
}
