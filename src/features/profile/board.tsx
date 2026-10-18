/**
 * El tablón personal (decisión del usuario del 2026-10-17): un pequeño muro de
 * fotos en el perfil —el trabajo de la persona, más fotos suyas— con un pie
 * corto. Lo ve cualquiera que abra su perfil (`/person/[id]`) y se edita desde
 * la tab Perfil.
 *
 * Nada se publica desde aquí: `addBoardPost()` sube la foto y el servidor la
 * modera (foto y pie juntos) antes de enseñarla. Un rechazo llega con su motivo
 * ya escrito (`BoardRejectedError`).
 */

import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing, Stroke } from '@/constants/theme';
import { BOARD_MAX_POSTS, useQuery, useRepositories, type BoardPost } from '@/data';
import { isObjectionable, OBJECTIONABLE_MESSAGE } from '@/features/safety/content-filter';
import { useTheme } from '@/hooks/use-theme';

import { pickAvatarPhoto } from './avatar-photo';
import { Field, PrimaryButton, SecondaryButton, TextField } from './controls';

const CAPTION_MAX = 280;
/** Las URLs firmadas valen una hora: se piden otras antes de que caduquen. */
const REFRESH_MS = 45 * 60 * 1000;
const COLUMNS = 3;

type Draft = { uri: string; caption: string };

export function Board({
  ownerId,
  ownerName,
  /** Tablón propio: se puede añadir y quitar. */
  editable = false,
}: {
  ownerId: string;
  ownerName: string;
  editable?: boolean;
}) {
  const theme = useTheme();
  const repositories = useRepositories();
  const {
    data: posts,
    loading,
    refresh,
  } = useQuery(`board:${ownerId}`, () => repositories.profiles.listBoard(ownerId));

  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<'subir' | 'quitar' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const list = posts ?? [];
  // Por id, de la lista vigente: tras refrescar, el visor usa la URL nueva.
  const open = list.find((post) => post.id === openId) ?? null;
  const setOpen = (post: BoardPost | null) => setOpenId(post?.id ?? null);
  // Sin fotos y sin poder añadir: el tablón ajeno vacío no ocupa sitio.
  if (!editable && !loading && list.length === 0) return null;

  async function pick() {
    setNotice(null);
    const picked = await pickAvatarPhoto('library', [1, 1]);
    if (picked.status === 'denied') {
      setNotice('Sin permiso para tus fotos no podemos subir ninguna.');
      return;
    }
    if (picked.status === 'picked') setDraft({ uri: picked.uri, caption: '' });
  }

  async function publish() {
    if (!draft) return;
    if (draft.caption.length > CAPTION_MAX) {
      setNotice(`El texto no puede pasar de ${CAPTION_MAX} caracteres.`);
      return;
    }
    if (isObjectionable(draft.caption)) {
      setNotice(OBJECTIONABLE_MESSAGE);
      return;
    }
    setBusy('subir');
    setNotice(null);
    try {
      await repositories.profiles.addBoardPost(draft.uri, draft.caption);
      setDraft(null);
      refresh();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'No se ha podido subir la foto.');
    } finally {
      setBusy(null);
    }
  }

  async function remove(post: BoardPost) {
    setBusy('quitar');
    setNotice(null);
    try {
      await repositories.profiles.removeBoardPost(post.id);
      setOpen(null);
      refresh();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'No se ha podido quitar la foto.');
    } finally {
      setBusy(null);
    }
  }

  const full = list.length >= BOARD_MAX_POSTS;

  return (
    <View style={styles.root}>
      <ThemedText type="label" themeColor="textSecondary">
        {editable ? 'Tu tablón' : 'Tablón'}
      </ThemedText>
      {editable && list.length === 0 && !draft ? (
        <ThemedText type="small" themeColor="textSecondary">
          Enseña en qué trabajas, lo que has construido o algo más de ti. Las fotos se revisan antes
          de publicarse.
        </ThemedText>
      ) : null}

      {open ? (
        <View style={[styles.viewer, { borderColor: theme.border }]}>
          {open.imageUrl ? (
            <Image
              source={{ uri: open.imageUrl }}
              style={styles.large}
              contentFit="cover"
              accessibilityLabel={open.caption || `Foto del tablón de ${ownerName}`}
            />
          ) : null}
          {open.caption ? <ThemedText type="body">{open.caption}</ThemedText> : null}
          {editable ? (
            <SecondaryButton
              label={busy === 'quitar' ? 'Quitando…' : 'Quitar esta foto'}
              tone="danger"
              disabled={busy !== null}
              onPress={() => void remove(open)}
            />
          ) : null}
          <SecondaryButton label="Cerrar" onPress={() => setOpen(null)} />
        </View>
      ) : null}

      {draft ? (
        <View style={[styles.viewer, { borderColor: theme.border }]}>
          <Image source={{ uri: draft.uri }} style={styles.large} contentFit="cover" />
          <Field label="Texto (opcional)" hint={`Hasta ${CAPTION_MAX} caracteres.`}>
            <TextField
              value={draft.caption}
              onChangeText={(caption) => setDraft({ ...draft, caption })}
              placeholder="Qué es, en qué estás trabajando…"
              multiline
              maxLength={CAPTION_MAX}
              showCount
              autoCapitalize="sentences"
              autoCorrect={false}
              accessibilityLabel="Texto de la foto"
            />
          </Field>
          <PrimaryButton
            label={busy === 'subir' ? 'Revisando y subiendo…' : 'Publicar en el tablón'}
            disabled={busy !== null}
            onPress={() => void publish()}
          />
          <SecondaryButton label="Cancelar" onPress={() => setDraft(null)} />
        </View>
      ) : null}

      <View style={styles.grid}>
        {list.map((post) => (
          <Pressable
            key={post.id}
            accessibilityRole="imagebutton"
            accessibilityLabel={post.caption || `Foto del tablón de ${ownerName}`}
            onPress={() => setOpen(post)}
            style={[styles.cell, { backgroundColor: theme.backgroundElement }]}>
            {post.imageUrl ? (
              <Image source={{ uri: post.imageUrl }} style={styles.fill} contentFit="cover" />
            ) : null}
          </Pressable>
        ))}
        {editable && !full && !draft ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Añadir una foto al tablón"
            onPress={() => void pick()}
            style={[
              styles.cell,
              styles.add,
              { borderColor: theme.border, backgroundColor: theme.backgroundElement },
            ]}>
            <ThemedText type="title" themeColor="textSecondary" accessible={false}>
              +
            </ThemedText>
          </Pressable>
        ) : null}
      </View>

      {notice ? (
        <ThemedText type="small" themeColor="danger" accessibilityRole="alert">
          {notice}
        </ThemedText>
      ) : null}
    </View>
  );
}

const GAP = Spacing.two;

const styles = StyleSheet.create({
  root: {
    gap: Spacing.two,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  cell: {
    width: `${100 / COLUMNS - 3}%`,
    aspectRatio: 1,
    borderRadius: Radii.medium,
    overflow: 'hidden',
  },
  add: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: Stroke.hairline,
    borderStyle: 'dashed',
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  viewer: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radii.card,
    borderWidth: Stroke.hairline,
  },
  large: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: Radii.medium,
  },
});
