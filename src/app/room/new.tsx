/**
 * Convocar una sala Lock-In entre tus matches (spec § 2, «Convocar»).
 *
 * Tres preguntas y ninguna caja de texto: con quién (2–4 matches), cuándo
 * (día y tramo de 15 min, como la hoja de proponer sesión) y cuánto (1, 2 o 4
 * bloques). Una sala no tiene título ni objetivo: cualquier texto llegaría a
 * gente que no eligió a quien lo escribe.
 *
 * La preselección se calcula con la hora de montar y no se mueve mientras se
 * elige. Si para cuando se pulsa «Convocar» el tramo ya no vale, el servidor
 * responde `SessionWindowError` y se pide otro. Al convocar, la ruta se
 * sustituye por la de la sala: atrás vuelve a Matches, no a este formulario.
 */

import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Screen } from '@/components/ambient-background';
import { Button } from '@/components/button';
import { enterUp } from '@/components/motion';
import { LoadingState, MessageState } from '@/components/state-view';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radii, Spacing, Stroke } from '@/constants/theme';
import {
  BLOCK_MINUTES,
  RoomInviteError,
  ROOM_MIN_INVITEES,
  SESSION_BLOCK_OPTIONS,
  SessionWindowError,
  useRepositories,
  type SessionBlocks,
} from '@/data';
import { useMatches } from '@/features/chat';
import { InviteePicker, useSingleFlight } from '@/features/room';
import {
  blocksLabel,
  dayOptions,
  formatDayLabel,
  formatTimeOfDay,
  slotsForDay,
} from '@/features/session';
import { useTheme } from '@/hooks/use-theme';

const MINUTE = 60_000;

function createErrorText(error: unknown): string {
  if (error instanceof RoomInviteError) return error.message;
  if (error instanceof SessionWindowError) return 'Esa hora ya no está disponible. Elige otra.';
  return 'No se ha podido convocar. Inténtalo de nuevo.';
}

export default function NewRoomScreen() {
  const router = useRouter();
  const repositories = useRepositories();
  const matches = useMatches();

  const [nowMs] = useState(() => Date.now());
  // Hoy solo si le queda algún tramo; si no, la lista empieza en mañana.
  const [days] = useState(() =>
    dayOptions(nowMs).filter((day) => slotsForDay(day, nowMs).length > 0)
  );
  const [dayMs, setDayMs] = useState(days[0]);
  const [slotMs, setSlotMs] = useState(() => slotsForDay(days[0], nowMs)[0]);
  const [blocks, setBlocks] = useState<SessionBlocks>(2);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  // Convocar y navegar es una sola acción: un segundo toque no escribe otra
  // sala ni hace un segundo `replace`.
  const flight = useSingleFlight();

  const slots = slotsForDay(dayMs, nowMs);
  const canSubmit = selected.size >= ROOM_MIN_INVITEES && !flight.busy;

  const toggle = (profileId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(profileId)) next.add(profileId);
      return next;
    });
  };

  const selectDay = (day: number) => {
    const current = new Date(slotMs);
    const sameTime = new Date(day);
    sameTime.setHours(current.getHours(), current.getMinutes(), 0, 0);
    const daySlots = slotsForDay(day, nowMs);
    setDayMs(day);
    setSlotMs(daySlots.includes(sameTime.getTime()) ? sameTime.getTime() : daySlots[0]);
  };

  const submit = () =>
    flight
      .run(
        async (isCurrent) => {
          setError(null);
          const view = await repositories.rooms.create({
            inviteeIds: [...selected],
            startsAt: new Date(slotMs).toISOString(),
            blocks,
          });
          // Si ya salió, la sala queda creada y la verá en Matches.
          if (isCurrent()) router.replace(`/room/${view.room.id}`);
        },
        { hold: true }
      )
      .catch((cause) => setError(createErrorText(cause)));

  const header = <Stack.Screen options={{ title: 'Convocar sala' }} />;
  const list = matches.data ?? [];

  if (matches.loading) {
    return (
      <Screen ambient="teal">
        {header}
        <LoadingState label="Cargando tus matches…" />
      </Screen>
    );
  }

  if (matches.error) {
    return (
      <Screen ambient="teal">
        {header}
        <MessageState
          eyebrow="Sala Lock-In"
          eyebrowColor="teal"
          title="No hemos podido cargar tus matches"
          body="Comprueba la conexión y vuelve a intentarlo.">
          <Button label="Reintentar" onPress={matches.refresh} />
        </MessageState>
      </Screen>
    );
  }

  if (list.length < ROOM_MIN_INVITEES) {
    return (
      <Screen ambient="teal">
        {header}
        <MessageState
          eyebrow="Sala Lock-In"
          eyebrowColor="teal"
          title="Necesitas al menos 2 matches para convocar una sala"
          body="Una sala junta a 2–4 de tus matches para trabajar a la vez.">
          <Button label="Ir a Descubrir" href="/discover" />
        </MessageState>
      </Screen>
    );
  }

  return (
    <Screen ambient="teal">
      {header}
      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View entering={enterUp(0)} style={styles.intro}>
          <ThemedText type="label" themeColor="teal">
            Sala Lock-In
          </ThemedText>
          <ThemedText type="title">Convocar sala Lock-In</ThemedText>
          <ThemedText type="body" themeColor="textSecondary">
            Cada persona acepta o rechaza. Hasta que acepte, solo tú sabes que la has invitado.
          </ThemedText>
        </Animated.View>

        <Animated.View entering={enterUp(1)}>
          <Section title="Con quién">
            <InviteePicker matches={list} selected={selected} onToggle={toggle} />
          </Section>
        </Animated.View>

        <Animated.View entering={enterUp(2)}>
          <Section title="Cuándo">
            <ScrollView
              horizontal
              contentContainerStyle={styles.row}
              showsHorizontalScrollIndicator={false}>
              {days.map((day) => (
                <Chip
                  key={day}
                  label={formatDayLabel(day, nowMs)}
                  accessibilityLabel={`Día ${formatDayLabel(day, nowMs)}`}
                  selected={day === dayMs}
                  onPress={() => selectDay(day)}
                />
              ))}
            </ScrollView>
            <ScrollView
              horizontal
              contentContainerStyle={styles.row}
              showsHorizontalScrollIndicator={false}>
              {slots.map((slot) => (
                <Chip
                  key={slot}
                  label={formatTimeOfDay(slot)}
                  accessibilityLabel={`Hora ${formatTimeOfDay(slot)}`}
                  selected={slot === slotMs}
                  onPress={() => setSlotMs(slot)}
                />
              ))}
            </ScrollView>
          </Section>
        </Animated.View>

        <Animated.View entering={enterUp(3)}>
          <Section title="Cuánto">
            <View style={styles.wrap}>
              {SESSION_BLOCK_OPTIONS.map((option) => {
                const end = formatTimeOfDay(slotMs + option * BLOCK_MINUTES * MINUTE);
                return (
                  <Chip
                    key={option}
                    label={`${blocksLabel(option)} · hasta ${end}`}
                    accessibilityLabel={`${blocksLabel(option)}, hasta ${end}`}
                    selected={option === blocks}
                    onPress={() => setBlocks(option)}
                  />
                );
              })}
            </View>
          </Section>
        </Animated.View>

        <Animated.View entering={enterUp(4)} style={styles.actions}>
          {error && (
            <ThemedText type="small" themeColor="danger">
              {error}
            </ThemedText>
          )}
          {selected.size < ROOM_MIN_INVITEES && (
            <ThemedText type="small" themeColor="textSecondary">
              Elige al menos 2 personas.
            </ThemedText>
          )}
          <Button label="Convocar" onPress={submit} disabled={!canSubmit} />
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="label" themeColor="textSecondary">
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

function Chip({
  label,
  accessibilityLabel,
  selected,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderColor: selected ? theme.teal : theme.border,
          backgroundColor: selected ? theme.tealSoft : theme.backgroundElement,
        },
      ]}>
      <ThemedText type="small" themeColor={selected ? 'teal' : 'text'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.four,
    gap: Spacing.five,
  },
  intro: { gap: Spacing.two },
  section: { gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.pill,
    borderWidth: Stroke.hairline,
  },
  actions: { gap: Spacing.two },
});
