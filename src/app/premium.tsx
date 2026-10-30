import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { MessageState } from '@/components/state-view';
import { useTheme } from '@/hooks/use-theme';

/**
 * `/premium`: STUB hasta la Tarea 9 del plan de Premium (el paywall de verdad,
 * con las ofertas). Existe solo para que `openPaywall()` navegue sin error
 * desde el deck. No vende nada ni promete precios.
 */
export default function PremiumRoute() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <MessageState eyebrow="Premium" title="Muy pronto" body="Estamos preparando Premium.">
        <Button
          label="Volver"
          variant="secondary"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      </MessageState>
    </SafeAreaView>
  );
}
