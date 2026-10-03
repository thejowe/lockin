/**
 * Sección «Salas Lock-In» en la cabecera de Matches (spec § 2, «Entrada»).
 *
 * No se pinta si no hay nada que enseñar: sin salas vivas y con menos de 2
 * matches no se puede ni convocar. Una invitación sí se ve aunque no tengas 2
 * matches: te la hizo otra persona.
 */

import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Button } from '@/components/button';
import { enterUp } from '@/components/motion';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { ROOM_MIN_INVITEES } from '@/data';
import { useMatches } from '@/features/chat';

import { RoomRow } from './room-row';
import { useLiveRooms } from './use-live-rooms';

export function RoomsSection() {
  const router = useRouter();
  const { rooms } = useLiveRooms();
  const matches = useMatches();
  const canConvene = (matches.data?.length ?? 0) >= ROOM_MIN_INVITEES;

  if (rooms.length === 0 && !canConvene) return null;

  return (
    <View style={styles.root}>
      <ThemedText type="label" themeColor="teal">
        Salas Lock-In
      </ThemedText>
      {rooms.map((view, index) => (
        <Animated.View key={view.room.id} entering={enterUp(Math.min(index, 6))}>
          <RoomRow view={view} onPress={() => router.push(`/room/${view.room.id}`)} />
        </Animated.View>
      ))}
      {canConvene && (
        <Button
          label="Convocar sala Lock-In"
          variant="secondary"
          onPress={() => router.push('/room/new')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.two, paddingTop: Spacing.three },
});
