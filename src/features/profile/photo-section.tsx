/**
 * Bloque «Foto» del perfil propio: poner, cambiar o quitar la foto.
 *
 * La foto no pasa por el formulario de la ficha: tiene sus propios métodos en
 * `repositories.profiles` porque la publica el servidor, y solo después de
 * revisarla. Por eso un fallo aquí casi nunca es «la red»: puede ser que la
 * foto no cumpla las normas, y el mensaje (ya traducido por la capa de datos)
 * se enseña tal cual.
 *
 * El permiso denegado y el selector cancelado no son errores de la subida: el
 * primero se explica, el segundo no hace nada.
 */

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing, Stroke } from '@/constants/theme';
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

export function PhotoSection({ profile, onChange }: { profile: Profile; onChange: () => void }) {
  const repositories = useRepositories();
  const theme = useTheme();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasPhoto = Boolean(profile.avatar.imageUrl || profile.avatar.hasPhoto);

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
    <View
      style={[
        styles.root,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ]}>
      <View style={styles.header}>
        <ProfileAvatar avatar={profile.avatar} size="large" />
        <View style={styles.copy}>
          <ThemedText type="heading">Tu foto</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {hasPhoto ? 'Es lo que ve la gente en tu tarjeta.' : 'Aún no tienes foto'}
          </ThemedText>
        </View>
      </View>

      {busy ? (
        <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
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
          label="Elegir de la galería"
          disabled={busy}
          onPress={() => choose('library')}
        />
        <SecondaryButton label="Hacer una foto" disabled={busy} onPress={() => choose('camera')} />
        {hasPhoto ? (
          <SecondaryButton label="Quitar foto" tone="danger" disabled={busy} onPress={remove} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radii.large,
    borderWidth: Stroke.hairline,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  copy: {
    flex: 1,
    gap: Spacing.one,
  },
  actions: {
    gap: Spacing.two,
  },
});
