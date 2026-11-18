/**
 * El tablón en la tarjeta del deck: las fotos de la persona «clavadas» con
 * chinchetas, un poco torcidas, como en un corcho. Al pulsar una se amplía en
 * un visor a pantalla completa (con su pie, si lo tiene).
 *
 * Solo enseña lo ya publicado (`listBoard`: lo modera el servidor antes). El
 * hook `useBoardPosts` lo comparte la tarjeta para saber si añade esta página.
 */

import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { HitSlop, Radii, Spacing } from '@/constants/theme';
import { useQuery, useRepositories, type BoardPost } from '@/data';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

/** Cuántas fotos caben en la tarjeta; el resto se ve en el perfil completo. */
const MAX_PINNED = 6;
/** Giros fijos (grados) para que cada foto cuelgue algo torcida, sin azar entre renders. */
const TILTS = [-4, 3, -2, 5, -3, 2];
const PIN_SIZE = 12;

export function useBoardPosts(ownerId: string): BoardPost[] {
  const repositories = useRepositories();
  const { data } = useQuery(`board:${ownerId}`, () => repositories.profiles.listBoard(ownerId));
  return (data ?? []).filter((post) => post.imageUrl);
}

export function BoardPins({ posts, ownerName }: { posts: BoardPost[]; ownerName: string }) {
  const theme = useTheme();
  const [openId, setOpenId] = useState<string | null>(null);
  const open = posts.find((post) => post.id === openId) ?? null;

  return (
    <View style={styles.cork} pointerEvents="box-none">
      {posts.slice(0, MAX_PINNED).map((post, index) => (
        <Pressable
          key={post.id}
          accessibilityRole="imagebutton"
          accessibilityLabel={post.caption || t('Foto personal de {ownerName}', { ownerName })}
          hitSlop={HitSlop.inline}
          onPress={(event) => {
            // Que el toque no pase a la tarjeta y cambie de bloque.
            event.stopPropagation();
            setOpenId(post.id);
          }}
          style={({ pressed }) => [
            styles.photo,
            {
              backgroundColor: theme.surfaceOpaque,
              transform: [
                { rotate: `${TILTS[index % TILTS.length]}deg` },
                { scale: pressed ? 0.96 : 1 },
              ],
            },
          ]}>
          <Image
            source={{ uri: post.imageUrl ?? undefined }}
            style={styles.image}
            contentFit="cover"
          />
          <View style={[styles.pin, { backgroundColor: theme.brass }]} />
        </Pressable>
      ))}

      <Modal
        visible={open !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setOpenId(null)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Cerrar')}
          onPress={() => setOpenId(null)}
          style={styles.backdrop}>
          {open ? (
            <View style={styles.viewer}>
              <Image
                source={{ uri: open.imageUrl ?? undefined }}
                style={styles.large}
                contentFit="contain"
                accessibilityLabel={
                  open.caption || t('Foto personal de {ownerName}', { ownerName })
                }
              />
              {open.caption ? (
                <ThemedText type="body" style={styles.caption}>
                  {open.caption}
                </ThemedText>
              ) : null}
            </View>
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  cork: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    paddingTop: Spacing.three,
  },
  photo: {
    width: '29%',
    aspectRatio: 1,
    padding: 4,
    borderRadius: Radii.small,
    boxShadow: '0px 3px 8px rgba(0,0,0,0.45)',
  },
  image: {
    flex: 1,
    borderRadius: 2,
  },
  pin: {
    position: 'absolute',
    top: -PIN_SIZE / 2,
    alignSelf: 'center',
    width: PIN_SIZE,
    height: PIN_SIZE,
    borderRadius: PIN_SIZE / 2,
    boxShadow: '0px 2px 3px rgba(0,0,0,0.5)',
  },
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
    backgroundColor: 'rgba(0,0,0,0.92)',
  },
  viewer: {
    width: '100%',
    gap: Spacing.three,
  },
  large: {
    width: '100%',
    aspectRatio: 1,
  },
  caption: {
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
