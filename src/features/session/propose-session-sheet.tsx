/**
 * Hoja para proponer una sesión Lock-In: día (hoy y 6 más), hora en tramos de
 * 15 min y 1, 2 o 4 bloques. Llega con la franja común preseleccionada.
 *
 * Se monta al abrirla (ver `SessionCard`), así que la preselección se calcula
 * con la hora de ese momento y no se mueve mientras se elige.
 */

import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Opacity, Radii, Spacing, Stroke } from '@/constants/theme';
import { BLOCK_MINUTES, SESSION_BLOCK_OPTIONS } from '@/data';
import { useTheme } from '@/hooks/use-theme';

import { blocksLabel, formatDayLabel, formatTimeOfDay } from './format';
import { dayOptions, preselectSlot, slotsForDay, startOfDayMs } from './slots';

import type { Profile, SessionBlocks } from '@/data';

export interface ProposeSessionSheetProps {
  visible: boolean;
  me: Profile | null;
  counterpart: Profile;
  nowMs: number;
  submitting: boolean;
  onSubmit(startsAt: string, blocks: SessionBlocks): void;
  onClose(): void;
}

const MINUTE = 60_000;

export function ProposeSessionSheet({
  visible,
  me,
  counterpart,
  nowMs,
  submitting,
  onSubmit,
  onClose,
}: ProposeSessionSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [initialSlot] = useState(() => preselectSlot(me, counterpart, nowMs));
  const [slotMs, setSlotMs] = useState(initialSlot);
  const [dayMs, setDayMs] = useState(() => startOfDayMs(initialSlot));
  const [blocks, setBlocks] = useState<SessionBlocks>(2);

  const days = dayOptions(nowMs).filter((day) => slotsForDay(day, nowMs).length > 0);
  const slots = slotsForDay(dayMs, nowMs);

  const selectDay = (day: number) => {
    const current = new Date(slotMs);
    const sameTime = new Date(day);
    sameTime.setHours(current.getHours(), current.getMinutes(), 0, 0);
    const daySlots = slotsForDay(day, nowMs);
    setDayMs(day);
    setSlotMs(daySlots.includes(sameTime.getTime()) ? sameTime.getTime() : daySlots[0]);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View
        testID="propose-session-sheet"
        style={[
          styles.root,
          {
            backgroundColor: theme.background,
            paddingTop: Spacing.four + sheetTopInset(insets.top),
            paddingBottom: Spacing.four + insets.bottom,
          },
        ]}>
        <ThemedText type="subtitle">Proponer sesión Lock-In</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {`A ${counterpart.name.split(' ')[0]} le llegará para aceptarla o rechazarla.`}
        </ThemedText>

        <Section title="Día">
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
        </Section>

        <Section title="Hora">
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

        <Section title="Duración">
          <View style={styles.row}>
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

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Proponer sesión"
            accessibilityState={{ disabled: submitting }}
            disabled={submitting}
            onPress={() => onSubmit(new Date(slotMs).toISOString(), blocks)}
            style={[
              styles.primary,
              { backgroundColor: theme.brass, opacity: submitting ? Opacity.disabled : 1 },
            ]}>
            <ThemedText type="bodyStrong" style={{ color: theme.onAccent }}>
              Proponer
            </ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar sin proponer"
            onPress={onClose}
            style={styles.secondary}>
            <ThemedText type="bodyStrong">Cancelar</ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Hueco de arriba que la hoja tiene que reservar ella misma.
 *
 * En iOS `pageSheet` ya se presenta por debajo de la barra de estado, con la
 * pantalla de detrás asomando: sumar el inset dejaría un hueco de más. En
 * Android `pageSheet` no existe: el `Modal` ocupa la pantalla entera y, con
 * edge-to-edge, el título quedaba debajo del reloj. Abajo sí hace falta en los
 * dos: la hoja llega hasta el borde inferior en ambos sistemas.
 */
function sheetTopInset(top: number): number {
  return Platform.OS === 'android' ? top : 0;
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
          backgroundColor: selected ? theme.tealSoft : 'transparent',
        },
      ]}>
      <ThemedText type="small" themeColor={selected ? 'teal' : 'text'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: Spacing.four, gap: Spacing.four },
  section: { gap: Spacing.two },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.pill,
    borderWidth: Stroke.hairline,
  },
  actions: { marginTop: 'auto', gap: Spacing.two },
  primary: { alignItems: 'center', paddingVertical: Spacing.three, borderRadius: Radii.pill },
  secondary: { alignItems: 'center', paddingVertical: Spacing.three },
});
