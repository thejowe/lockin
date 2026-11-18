import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useRepositories, type Profile } from '@/data';
import { t } from '@/i18n';

import { chooseProfilePhoto, PhotoSourceSheet } from './photo-source-sheet';
import { ProfileAvatar } from './profile-avatar';

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
  const { profiles } = useRepositories();
  const inFlight = useRef(false);
  const [action, setAction] = useState<'picking' | 'uploading' | 'removing' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasPhoto = Boolean(profile.avatar.imageUrl || profile.avatar.hasPhoto);

  function close() {
    if (inFlight.current) return;
    setError(null);
    onClose();
  }

  async function change(source: 'camera' | 'library' | 'remove') {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    try {
      if (source === 'remove') {
        setAction('removing');
        await profiles.removeAvatarPhoto();
      } else {
        setAction('picking');
        const uri = await chooseProfilePhoto(source);
        if (!uri) return;
        setAction('uploading');
        await profiles.setAvatarPhoto(uri);
      }
      onChange();
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : source === 'remove'
            ? t('No se ha podido quitar la foto. Inténtalo de nuevo.')
            : t('No se ha podido subir la foto. Inténtalo de nuevo.')
      );
    } finally {
      inFlight.current = false;
      setAction(null);
    }
  }

  return (
    <PhotoSourceSheet
      visible={visible}
      onClose={close}
      onChoose={change}
      onRemove={hasPhoto ? () => void change('remove') : undefined}
      busy={action !== null}>
      <View style={styles.identity}>
        <ProfileAvatar avatar={profile.avatar} size="medium" />
        <View style={styles.summary}>
          <ThemedText type="heading" numberOfLines={2}>
            {profile.name} · {profile.age}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
            {action === 'uploading'
              ? t('Subiendo…')
              : hasPhoto
                ? t('Es lo que ve la gente en tu tarjeta.')
                : t('Aún no tienes foto')}
          </ThemedText>
        </View>
      </View>
      {error ? (
        <ThemedText type="small" themeColor="danger" accessibilityRole="alert">
          {error}
        </ThemedText>
      ) : null}
    </PhotoSourceSheet>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  summary: { flex: 1, gap: Spacing.one },
});
