import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Paywall } from '@/features/premium/paywall';
import { useTheme } from '@/hooks/use-theme';

/**
 * `/premium`: el paywall. Se abre como hoja modal desde el deck, Matches y
 * Cuenta (ver `openPaywall`). Términos y Privacidad abren su propia hoja.
 */
export default function PremiumRoute() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <Paywall
        onClose={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        onOpenLegal={(doc) => router.push({ pathname: '/legal/[doc]', params: { doc } })}
      />
    </SafeAreaView>
  );
}
