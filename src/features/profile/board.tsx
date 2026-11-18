/**
 * Fotos de «Sobre mí». El borrador es privado hasta que addBoardPost confirma
 * la publicación. Las URLs firmadas se renuevan con la consulta compartida.
 */

import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Control, Radii, ScrimAlpha, Spacing, Stroke } from '@/constants/theme';
import { useQuery, useRepositories, type BoardPost } from '@/data';
import { isObjectionable, OBJECTIONABLE_MESSAGE } from '@/features/safety/content-filter';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

import { pickAvatarPhoto } from './avatar-photo';
import { BoardGrid } from './board-grid';
import { CompactPrimaryButton, CompactSecondaryButton, Field, TextField } from './controls';

const CAPTION_MAX = 280;
const REFRESH_MS = 45 * 60 * 1000;

type Draft = { uri: string; caption: string };

export function Board({
  ownerId,
  ownerName,
  editable = false,
  hideTitle = false,
  onPhotoAdded,
  onPhotoCountChange,
}: {
  ownerId: string;
  ownerName: string;
  editable?: boolean;
  hideTitle?: boolean;
  /** Se dispara al montar la foto recién aprobada, también con movimiento reducido. */
  onPhotoAdded?: (photoId: string) => void;
  onPhotoCountChange?: (count: number | null) => void;
}) {
  const theme = useTheme();
  const repositories = useRepositories();
  const {
    data: posts,
    error,
    loading,
    refreshing,
    refresh,
  } = useQuery(`board:${ownerId}`, () => repositories.profiles.listBoard(ownerId));

  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<'elegir' | 'subir' | 'quitar' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [addition, setAddition] = useState<{
    post: BoardPost;
    previousPosts: BoardPost[] | null;
  } | null>(null);

  useEffect(() => {
    const timer = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  // El servidor ya ha aprobado la foto. Ocupa su hueco mientras llegan las URLs actualizadas.
  const list =
    addition && addition.previousPosts === posts && addition.post.ownerId === ownerId
      ? [addition.post, ...(posts ?? [])]
      : (posts ?? []);
  const addedId = addition?.post.id;
  const mountedPhotoId = list.some((post) => post.id === addedId) ? addedId : undefined;
  const notifiedId = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (mountedPhotoId && notifiedId.current !== mountedPhotoId) {
      notifiedId.current = mountedPhotoId;
      onPhotoAdded?.(mountedPhotoId);
    }
  }, [mountedPhotoId, onPhotoAdded]);

  const count = loading ? null : list.length;
  useEffect(() => {
    onPhotoCountChange?.(count);
  }, [count, onPhotoCountChange]);

  const open = list.find((post) => post.id === openId);
  const dialogOpen = !!(open || draft);

  function close() {
    if (busy) return;
    setOpenId(null);
    setDraft(null);
    setNotice(null);
  }

  async function pick() {
    setNotice(null);
    setBusy('elegir');
    try {
      const picked = await pickAvatarPhoto('library', [1, 1]);
      if (picked.status === 'denied')
        setNotice(t('Sin permiso para tus fotos no podemos subir ninguna.'));
      if (picked.status === 'picked') setDraft({ uri: picked.uri, caption: '' });
    } catch {
      setNotice(t('No se ha podido cargar la foto.'));
    } finally {
      setBusy(null);
    }
  }

  async function publish() {
    if (!draft || busy) return;
    if (draft.caption.length > CAPTION_MAX) {
      setNotice(t('El texto no puede pasar de {CAPTION_MAX} caracteres.', { CAPTION_MAX }));
      return;
    }
    if (isObjectionable(draft.caption)) {
      setNotice(t(OBJECTIONABLE_MESSAGE));
      return;
    }
    setBusy('subir');
    setNotice(null);
    try {
      const post = await repositories.profiles.addBoardPost(draft.uri, draft.caption);
      setAddition({ post, previousPosts: posts });
      setDraft(null);
      refresh();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : t('No se ha podido subir la foto.'));
    } finally {
      setBusy(null);
    }
  }

  async function remove(post: BoardPost) {
    if (busy) return;
    setBusy('quitar');
    setNotice(null);
    try {
      await repositories.profiles.removeBoardPost(post.id);
      setOpenId(null);
      refresh();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : t('No se ha podido quitar la foto.'));
    } finally {
      setBusy(null);
    }
  }

  if (!editable && !list.length) return null;

  const alert = notice ? (
    <ThemedText type="small" themeColor="danger" accessibilityRole="alert">
      {notice}
    </ThemedText>
  ) : null;

  return (
    <View style={styles.root}>
      {!hideTitle && (
        <ThemedText type="subtitle" accessibilityRole="header">
          {t('Sobre mí')}
        </ThemedText>
      )}
      {loading ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('Cargando…')}
        </ThemedText>
      ) : error ? (
        <View style={styles.root}>
          <ThemedText type="small" themeColor="danger" accessibilityRole="alert">
            {t('No se han podido cargar las fotos.')}
          </ThemedText>
          <CompactSecondaryButton label={t('Reintentar')} onPress={refresh} />
        </View>
      ) : (
        <>
          {editable && list.length === 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              {t(
                'Fotos tuyas, tus aficiones, tu día a día. Las fotos se revisan antes de publicarse.'
              )}
            </ThemedText>
          )}
          <BoardGrid
            posts={list}
            ownerName={ownerName}
            onOpen={(post) => {
              setNotice(null);
              setOpenId(post.id);
            }}
            onAdd={editable ? pick : undefined}
            disabled={busy !== null || refreshing}
          />
        </>
      )}
      {!dialogOpen && alert}

      {dialogOpen && (
        <Modal transparent animationType="none" visible onRequestClose={close}>
          <SafeAreaView
            style={[styles.backdrop, { backgroundColor: theme.background + ScrimAlpha }]}>
            <KeyboardAwareScrollView
              contentContainerStyle={styles.dialogArea}
              keyboardShouldPersistTaps="handled"
              bottomOffset={Spacing.three}>
              <View
                style={[
                  styles.dialog,
                  { backgroundColor: theme.surfaceOpaque, borderColor: theme.border },
                ]}>
                <View style={styles.dialogHeader}>
                  <ThemedText type="subtitle" accessibilityRole="header" style={styles.dialogTitle}>
                    {draft ? t('Añadir foto') : t('Sobre mí')}
                  </ThemedText>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={draft ? t('Cancelar') : t('Cerrar')}
                    disabled={busy !== null}
                    accessibilityState={{ disabled: busy !== null }}
                    onPress={close}
                    style={styles.close}>
                    <Icon name="close" color={theme.textSecondary} />
                  </Pressable>
                </View>
                {draft ? (
                  <>
                    <Image source={{ uri: draft.uri }} style={styles.preview} contentFit="cover" />
                    <Field label={t('Texto (opcional)')}>
                      <TextField
                        value={draft.caption}
                        onChangeText={(caption) => setDraft({ ...draft, caption })}
                        placeholder={t('Qué es, en qué estás trabajando…')}
                        multiline
                        editable={busy === null}
                        maxLength={CAPTION_MAX}
                        showCount
                        autoCapitalize="sentences"
                        autoCorrect={false}
                        accessibilityLabel={t('Texto de la foto')}
                        accessibilityHint={t('Hasta {CAPTION_MAX} caracteres.', { CAPTION_MAX })}
                      />
                    </Field>
                    {alert}
                    {busy === 'subir' ? (
                      <ThemedText
                        type="smallBold"
                        accessibilityRole="progressbar"
                        accessibilityLabel={t('En revisión…')}
                        accessibilityLiveRegion="polite">
                        {t('Revisando y subiendo…')}
                      </ThemedText>
                    ) : (
                      <CompactPrimaryButton
                        label={t('Publicar en Sobre mí')}
                        onPress={() => void publish()}
                      />
                    )}
                  </>
                ) : open ? (
                  <>
                    {open.imageUrl ? (
                      <Image
                        source={{ uri: open.imageUrl }}
                        style={styles.large}
                        contentFit="contain"
                        accessibilityLabel={
                          open.caption || t('Foto personal de {ownerName}', { ownerName })
                        }
                      />
                    ) : (
                      <ThemedText type="small" themeColor="textSecondary">
                        {t('No se ha podido cargar la foto.')}
                      </ThemedText>
                    )}
                    {!!open.caption && <ThemedText>{open.caption}</ThemedText>}
                    {alert}
                    {editable && (
                      <CompactSecondaryButton
                        label={busy === 'quitar' ? t('Quitando…') : t('Quitar esta foto')}
                        tone="danger"
                        disabled={busy !== null}
                        onPress={() => void remove(open)}
                      />
                    )}
                  </>
                ) : null}
              </View>
            </KeyboardAwareScrollView>
          </SafeAreaView>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.two },
  backdrop: { flex: 1 },
  dialogArea: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.three,
  },
  dialog: {
    width: '100%',
    maxWidth: 480,
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radii.large,
    borderWidth: Stroke.hairline,
  },
  dialogHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dialogTitle: { flex: 1 },
  close: {
    width: Control.minTouch,
    height: Control.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: { width: '44%', aspectRatio: 1, borderRadius: Radii.small },
  large: { width: '100%', aspectRatio: 1, borderRadius: Radii.small },
});
