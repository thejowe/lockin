import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnDiamond } from '@/constants/theme';
import { Paywall } from '@/features/premium/paywall';
import { ThemeOverride } from '@/hooks/use-theme';

/**
 * `/premium`: el paywall. Se abre como hoja modal desde el deck, Matches y
 * Cuenta (ver `openPaywall`). Términos y Privacidad abren su propia hoja. Va
 * sobre el azul del diamante, con tinta negra: es donde acaba la animación de
 * «Hazte Premium».
 */
export default function PremiumRoute() {
  const router = useRouter();

  return (
    <ThemeOverride.Provider value={OnDiamond}>
      <SafeAreaView style={{ flex: 1, backgroundColor: OnDiamond.background }}>
        <Paywall
          onClose={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          onOpenLegal={(doc) => router.push({ pathname: '/legal/[doc]', params: { doc } })}
        />
      </SafeAreaView>
    </ThemeOverride.Provider>
  );
}
