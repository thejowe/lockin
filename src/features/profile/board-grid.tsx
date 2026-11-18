import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Opacity, Radii, Spacing, Stroke } from '@/constants/theme';
import { BOARD_MAX_POSTS, type BoardPost } from '@/data';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

// Los mismos giros de board-pins en el deck. El hueco sigue recto y mide siempre lo mismo.
const TILTS = [-4, 3, -2, 5, -3, 2];
const PIN_SIZE = 12;

export function BoardGrid({
  posts,
  ownerName,
  onOpen,
  onAdd,
  disabled,
}: {
  posts: BoardPost[];
  ownerName: string;
  onOpen: (post: BoardPost) => void;
  onAdd?: () => void;
  disabled: boolean;
}) {
  const theme = useTheme();
  // En edición la publicación nueva ocupa justo el hueco «Añadir foto».
  const photos = onAdd ? [...posts].reverse() : posts;
  const rows = onAdd
    ? Math.max(2, Math.ceil(Math.min(BOARD_MAX_POSTS, photos.length + 1) / 2))
    : Math.ceil(photos.length / 2);

  function slot(index: number) {
    const post = photos[index];
    const canAdd = onAdd && index === photos.length;
    // Mantiene el ancho de la última foto de un perfil ajeno con un número impar.
    if (!post && (!onAdd || index >= BOARD_MAX_POSTS))
      return <View key={index} style={styles.slot} />;
    return (
      <View key={index} testID={`board-slot-${index}`} style={styles.slot}>
        {post ? (
          <Pressable
            key={post.id}
            testID={`board-photo-${post.id}`}
            accessibilityRole="imagebutton"
            accessibilityLabel={post.caption || t('Foto personal de {ownerName}', { ownerName })}
            onPress={() => onOpen(post)}
            style={({ pressed }) => [
              styles.print,
              {
                backgroundColor: theme.surfaceOpaque,
                borderColor: theme.border,
                transform: [{ rotate: `${TILTS[index % TILTS.length]}deg` }],
                opacity: pressed ? Opacity.pressed : 1,
              },
            ]}>
            {post.imageUrl ? (
              <Image source={{ uri: post.imageUrl }} style={styles.image} contentFit="cover" />
            ) : (
              <ThemedText type="caption" themeColor="textMuted" style={styles.centerText}>
                {t('No se ha podido cargar la foto.')}
              </ThemedText>
            )}
            <View
              testID={`board-pin-${post.id}`}
              pointerEvents="none"
              style={[styles.pin, { backgroundColor: theme.textSecondary }]}
            />
          </Pressable>
        ) : canAdd ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Añadir una foto a Sobre mí')}
            disabled={disabled}
            accessibilityState={{ disabled }}
            onPress={onAdd}
            style={({ pressed }) => [
              styles.empty,
              {
                borderColor: theme.textMuted,
                backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
              },
            ]}>
            <ThemedText type="subtitle" accessible={false}>
              +
            </ThemedText>
            <ThemedText type="smallBold" style={styles.centerText}>
              {t('Añadir foto')}
            </ThemedText>
          </Pressable>
        ) : (
          <View style={[styles.empty, { borderColor: theme.border }]} />
        )}
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {Array.from({ length: rows }, (_, row) => (
        <View key={row} style={styles.row}>
          {slot(row * 2)}
          {slot(row * 2 + 1)}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: Spacing.three, paddingVertical: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.three },
  slot: { flex: 1, aspectRatio: 1, minWidth: 0 },
  empty: {
    flex: 1,
    gap: Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.two,
    borderStyle: 'dashed',
    borderWidth: Stroke.thin,
    borderRadius: Radii.medium,
  },
  print: {
    flex: 1,
    margin: Spacing.one,
    padding: Spacing.one,
    justifyContent: 'center',
    borderWidth: Stroke.hairline,
    borderRadius: Radii.small,
  },
  image: { flex: 1, borderRadius: Spacing.half },
  pin: {
    position: 'absolute',
    top: -PIN_SIZE / 2,
    alignSelf: 'center',
    width: PIN_SIZE,
    height: PIN_SIZE,
    borderRadius: PIN_SIZE / 2,
    boxShadow: '0px 2px 3px rgba(0,0,0,0.5)',
  },
  centerText: { textAlign: 'center' },
});
