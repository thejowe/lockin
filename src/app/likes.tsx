import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/ambient-background';
import { IncomingLikes } from '@/features/premium';
import { RequireVerifiedEmail } from '@/features/profile';
import { useTheme } from '@/hooks/use-theme';

/**
 * `/likes`: quién te ha dado like. Con Premium, la cuadrícula; sin él, relleno
 * y el paywall (ver `IncomingLikes`). Al hacer match desde aquí se abre el chat.
 */
function LikesContent() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <AmbientBackground variant="teal" />
      <SafeAreaView style={{ flex: 1 }} edges={['left', 'right', 'bottom']}>
        <IncomingLikes
          onOpenChat={(matchId) =>
            router.push({ pathname: '/chat/[matchId]', params: { matchId } })
          }
        />
      </SafeAreaView>
    </View>
  );
}

/** Sin email confirmado no se ve nada de dentro: ver `RequireVerifiedEmail`. */
export default function LikesRoute() {
  return (
    <RequireVerifiedEmail>
      <LikesContent />
    </RequireVerifiedEmail>
  );
}
