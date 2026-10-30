/**
 * Hoja «Foto de perfil»: hacer una foto, elegir de la galería o eliminarla.
 *
 * Desde el 2026-10-30 no es un bloque más del perfil: se abre al pulsar la
 * cámara translúcida que lleva la foto propia arriba del todo
 * (`ProfileDetails` → `onAvatarPress`), y arriba de la hoja se ve la foto un
 * poco más grande (decisión del usuario).
 *
 * La foto no pasa por el formulario de la ficha: tiene sus propios métodos en
 * `repositories.profiles` porque la publica el servidor, y solo después de
 * revisarla. Por eso un fallo aquí casi nunca es «la red»: puede ser que la
 * foto no cumpla las normas, y el mensaje (ya traducido por la capa de datos)
 * se enseña tal cual, sin cerrar la hoja.
 *
 * El permiso denegado y el selector cancelado no son errores de la subida: el
 * primero se explica, el segundo no hace nada.
 */

import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radii, ScrimAlpha, Spacing, Stroke } from '@/constants/theme';
import { useRepositories } from '@/data';
import { useTheme } from '@/hooks/use-theme';

import { pickAvatarPhoto } from './avatar-photo';
import { SecondaryButton } from './controls';
import { ProfileAvatar } from './profile-avatar';

import type { Profile } from '@/data';

const DENIED = {
  library:
    'Sin permiso de galería no podemos leer tu foto. Puedes dárselo en los ajustes del móvil.',
  camera:
    'Sin permiso de cámara no podemos hacerte la foto. Puedes dárselo en los ajustes del móvil.',
} as const;

export function PhotoSection({
  profile,
  onChange,
  visible,
  onClose,
}: {
  profile: Profile;
  onChange: () => void;
  visible: boolean;
  onClose: () => void;
}) {
  const repositories = useRepositories();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasPhoto = Boolean(profile.avatar.imageUrl || profile.avatar.hasPhoto);

  function close() {
    // Con una subida en vuelo no se cierra: el resultado tiene que verse aquí.
    if (busy) return;
    setError(null);
    onClose();
  }

  async function choose(source: 'library' | 'camera') {
    setError(null);

    // Todo dentro del `try`: el selector nativo o el recorte también pueden
    // rechazar (una imagen dañada, un permiso que cambia a mitad), y eso no
    // puede quedarse como una promesa rechazada sin enseñar nada.
    setBusy(true);
    try {
      const picked = await pickAvatarPhoto(source);
      if (picked.status === 'cancelled') return;
      if (picked.status === 'denied') {
        setError(DENIED[source]);
        return;
      }

      await repositories.profiles.setAvatarPhoto(picked.uri);
      onChange();
      onClose();
    } catch (cause) {
      // `AvatarRejectedError` ya trae el mensaje de normas o de «más tarde».
      setError(
        cause instanceof Error
          ? cause.message
          : 'No se ha podido subir la foto. Inténtalo de nuevo.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setError(null);
    setBusy(true);
    try {
      await repositories.profiles.removeAvatarPhoto();
      onChange();
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'No se ha podido quitar la foto. Inténtalo de nuevo.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      // Android: el botón atrás cierra la hoja, no la pantalla de debajo.
      onRequestClose={close}>
      <View style={styles.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          onPress={close}
          style={[StyleSheet.absoluteFill, { backgroundColor: theme.background + ScrimAlpha }]}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surfaceOpaque,
              borderColor: theme.border,
              paddingBottom: Spacing.four + insets.bottom,
            },
          ]}>
          <View style={[styles.grabber, { backgroundColor: theme.border }]} />

          <View style={styles.header}>
            <ProfileAvatar avatar={profile.avatar} size="xlarge" />
            <ThemedText type="heading">Foto de perfil</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              {hasPhoto ? 'Es lo que ve la gente en tu tarjeta.' : 'Aún no tienes foto'}
            </ThemedText>
          </View>

          {busy ? (
            <ThemedText
              type="small"
              themeColor="textSecondary"
              accessibilityLiveRegion="polite"
              style={styles.center}>
              Subiendo…
            </ThemedText>
          ) : null}

          {error ? (
            <ThemedText type="small" themeColor="danger" accessibilityRole="alert">
              {error}
            </ThemedText>
          ) : null}

          <View style={styles.actions}>
            <SecondaryButton
              label="Hacer una foto"
              disabled={busy}
              onPress={() => choose('camera')}
            />
            <SecondaryButton
              label="Elegir de la galería"
              disabled={busy}
              onPress={() => choose('library')}
            />
            {hasPhoto ? (
              <SecondaryButton
                label="Eliminar foto"
                tone="danger"
                disabled={busy}
                onPress={remove}
              />
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    gap: Spacing.three,
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderTopLeftRadius: Radii.large,
    borderTopRightRadius: Radii.large,
    borderWidth: Stroke.hairline,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: Radii.pill,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  center: {
    textAlign: 'center',
  },
  actions: {
    gap: Spacing.two,
  },
});
