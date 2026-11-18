import { Redirect } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LoadingState } from '@/components/state-view';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useQuery, useRepositories } from '@/data';
import { t } from '@/i18n';

import { PhotoCardPicker } from './photo-card-picker';
import { chooseProfilePhoto, PhotoSourceSheet } from './photo-source-sheet';
import { CURRENT_PROFILE_KEY, hasApprovedPhoto } from './require-photo';
import { WizardScreen } from './wizard';

/**
 * Destino de la puerta de foto (`RequirePhoto`): el mismo paso de foto del alta,
 * sin volver atrás. Solo se sale con una foto aprobada por `moderate-avatar`.
 */
export function PhotoGateScreen() {
  const { profiles } = useRepositories();
  const {
    data: profile,
    loading,
    refresh,
  } = useQuery(CURRENT_PROFILE_KEY, () => profiles.getCurrent());
  const inFlight = useRef(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [approvedUri, setApprovedUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  if (loading) return <LoadingState label={t('Comprobando tu cuenta…')} />;
  if (!profile) return <Redirect href="/" />;
  // Se entra cuando la consulta compartida con la puerta ya trae la foto: si se
  // navegase antes, `RequirePhoto` leería el perfil viejo y devolvería aquí.
  if (hasApprovedPhoto(profile) && (leaving || !approvedUri)) return <Redirect href="/discover" />;

  async function choose(source: 'camera' | 'library') {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    try {
      const uri = await chooseProfilePhoto(source);
      setSheetOpen(false);
      if (!uri) return;
      setPendingUri(uri);
      await profiles.setAvatarPhoto(uri);
      setApprovedUri(uri);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t('No se ha podido subir la foto. Inténtalo de nuevo.')
      );
    } finally {
      inFlight.current = false;
      setPendingUri(null);
      setSheetOpen(false);
    }
  }

  const busy = pendingUri !== null;
  return (
    <WizardScreen
      step={1}
      total={1}
      title={t('Pon tu foto de perfil')}
      subtitle={t('Para seguir en cofounder necesitas una foto de perfil aprobada.')}
      primaryLabel={t('Continuar')}
      busy={busy || !approvedUri || leaving}
      onPrimary={() => {
        setLeaving(true);
        refresh();
      }}>
      <View style={styles.photo}>
        <PhotoCardPicker
          uri={pendingUri ?? approvedUri}
          name={profile.name}
          age={String(profile.age)}
          disabled={busy}
          onPress={() => setSheetOpen(true)}
        />
        {pendingUri || approvedUri ? (
          <ThemedText
            type="small"
            themeColor="textSecondary"
            accessibilityLiveRegion="polite"
            style={styles.message}>
            {pendingUri ? t('En revisión…') : t('Foto aprobada')}
          </ThemedText>
        ) : null}
        {error ? (
          <ThemedText
            type="small"
            themeColor="danger"
            accessibilityRole="alert"
            style={styles.message}>
            {error}
          </ThemedText>
        ) : null}
      </View>
      <PhotoSourceSheet
        visible={sheetOpen}
        onClose={() => {
          if (!inFlight.current) setSheetOpen(false);
        }}
        onChoose={(source) => void choose(source)}
        busy={busy}
      />
    </WizardScreen>
  );
}

const styles = StyleSheet.create({
  photo: { gap: Spacing.two },
  message: { textAlign: 'center' },
});
