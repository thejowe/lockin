/**
 * Una fila de la lista de matches.
 *
 * Cuando todavía no hay mensajes, en lugar de un hueco vacío la fila empuja
 * hacia el diferenciador del producto ("decidid cuándo hacer vuestro primer
 * Lock-In"): es el momento en el que la conversación tiene más probabilidad de
 * arrancar, y el que decide si la app se abandona tras el match.
 */

import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing, Stroke } from '@/constants/theme';
import { usePressScale } from '@/hooks/use-press-scale';
import { useTheme } from '@/hooks/use-theme';

import { formatRelative } from './format';
import { MODE_LABELS } from './labels';
import { ProfileAvatar } from './profile-avatar';

import type { MatchWithProfile } from '@/data';

/** Lo que se lee bajo el nombre mientras nadie ha escrito nada. */
export const NO_MESSAGES_HINT = 'Decidid cuándo hacer vuestro primer Lock-In';

/**
 * Textos de la racha de pareja. Son copia de `streakTag`/`streakLine` de
 * `sesiones`: `chat` no importa de ese bloque, así que la fila recibe solo el
 * número y su test fija que los textos no divergen.
 */
const streakTag = (count: number) => `· Racha ${count}`;
const streakLine = (count: number) => `Racha de ${count} sesiones seguidas`;

export function MatchRow({
  match,
  streak = null,
  first = true,
  last = true,
}: {
  match: MatchWithProfile;
  /** Racha visible de la pareja, ya filtrada por quien compone la lista. */
  streak?: number | null;
  /**
   * Posición dentro del grupo. La lista se pinta como un solo bloque de cristal
   * (la lista agrupada de iOS): solo la primera redondea arriba, solo la última
   * abajo, y entre filas hay un trazo fino en vez de un hueco. Sola, la fila es
   * las dos cosas y se ve como una tarjeta.
   */
  first?: boolean;
  last?: boolean;
}) {
  const theme = useTheme();
  const press = usePressScale();
  const { counterpart, lastMessage } = match;

  const isMine = lastMessage !== null && lastMessage.senderId !== counterpart.id;
  const preview = lastMessage ? `${isMine ? 'Tú: ' : ''}${lastMessage.body}` : NO_MESSAGES_HINT;
  const timestamp = formatRelative(lastMessage?.sentAt ?? match.createdAt);
  const streakPart = streak === null ? '' : `${streakLine(streak)}. `;

  return (
    <Link href={`/chat/${match.id}`} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Conversación con ${counterpart.name}. ${streakPart}${preview}`}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}>
        {({ pressed }) => (
          // La forma va aquí y no en el `style` del Pressable: `Link asChild`
          // en web descarta el estilo-función, y la fila salía sin fondo y con
          // el avatar apilado encima del nombre.
          // `collapsable={false}`: que Fabric no la aplane al cambiar de estado
          // (ver `src/components/button.tsx`).
          <Animated.View
            collapsable={false}
            style={[
              styles.root,
              first && styles.first,
              last && styles.last,
              {
                backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
                borderColor: theme.border,
              },
              // El brillo del canto es de la superficie entera, no de cada fila.
              first && { boxShadow: `inset 0px 1px 0px ${theme.glassHighlight}` },
              press.style,
            ]}>
            {last ? null : <View style={[styles.divider, { backgroundColor: theme.border }]} />}
            <ProfileAvatar avatar={counterpart.avatar} />

            <View style={styles.body}>
              <View style={styles.topLine}>
                <ThemedText type="heading" numberOfLines={1} style={styles.name}>
                  {counterpart.name}
                </ThemedText>
                <ThemedText type="mono" themeColor="textMuted">
                  {timestamp}
                </ThemedText>
              </View>

              <View style={styles.tags}>
                <ThemedText type="label" themeColor="textMuted">
                  {MODE_LABELS[match.mode]}
                </ThemedText>
                {lastMessage === null && (
                  <ThemedText type="label" themeColor="brass">
                    · Nuevo
                  </ThemedText>
                )}
                {streak !== null && (
                  <View style={[styles.streak, { backgroundColor: theme.brassSoft }]}>
                    <Icon name="flame" size={12} color={theme.brass} strokeWidth={2.2} />
                    <ThemedText type="caption" themeColor="brass">
                      {streakTag(streak)}
                    </ThemedText>
                  </View>
                )}
              </View>

              <ThemedText
                type="small"
                themeColor={lastMessage ? 'textSecondary' : 'teal'}
                numberOfLines={2}>
                {preview}
              </ThemedText>
            </View>
          </Animated.View>
        )}
      </Pressable>
    </Link>
  );
}

/** Tamaño por defecto de `ProfileAvatar`: fija dónde empieza el separador. */
const AVATAR_SIZE = 48;

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    padding: Spacing.three,
    borderLeftWidth: Stroke.hairline,
    borderRightWidth: Stroke.hairline,
  },
  first: {
    borderTopWidth: Stroke.hairline,
    borderTopLeftRadius: Radii.card,
    borderTopRightRadius: Radii.card,
  },
  last: {
    borderBottomWidth: Stroke.hairline,
    borderBottomLeftRadius: Radii.card,
    borderBottomRightRadius: Radii.card,
  },
  /**
   * Separador entre filas, sangrado hasta el texto como en iOS: el avatar queda
   * libre y la columna de nombres se lee como una sola.
   */
  divider: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    left: Spacing.three + AVATAR_SIZE + Spacing.three,
    height: Stroke.hairline,
  },
  body: {
    flex: 1,
    gap: Spacing.one,
  },
  topLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  name: {
    flexShrink: 1,
  },
  tags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
    borderRadius: Radii.pill,
  },
});
