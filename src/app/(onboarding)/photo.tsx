import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Screen } from '@/components/ambient-background';
import { PhotoGateScreen } from '@/features/profile/photo-gate-screen';

/** Puerta de foto: a donde manda `RequirePhoto` a quien no tiene foto aprobada. */
export default function PhotoRoute() {
  return (
    <Screen ambient="plum">
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <PhotoGateScreen />
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
