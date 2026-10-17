/**
 * LinkedIn dentro de «Vincular cuentas» (2026-10-17), junto a GitHub.
 *
 * Igual que el de GitHub, aquí no se enciende ningún sello: `verifyLinkedin()`
 * vincula la identidad OAuth y Postgres lo deriva de ella. LinkedIn (OpenID
 * Connect) no da la URL del perfil, así que el sello certifica que la cuenta de
 * LinkedIn con ese nombre es de quien tiene la ficha, y nada más.
 */

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { LINKEDIN_VERIFICATION_CANCELLED, useRepositories, type Profile } from '@/data';
import { useTheme } from '@/hooks/use-theme';

import { PrimaryButton, SecondaryButton } from './controls';

/** El sello de LinkedIn verificado. Mismas reglas que `GithubSeal`. */
export function LinkedinSeal({ name, compact = false }: { name: string; compact?: boolean }) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`LinkedIn verificado: ${name}`}
      style={[
        styles.seal,
        compact ? styles.compact : styles.full,
        { backgroundColor: theme.brassSoft },
      ]}>
      <ThemedText type={compact ? 'smallBold' : 'bodyStrong'} themeColor="brass">
        {compact ? '✓ LinkedIn' : `✓ LinkedIn · ${name}`}
      </ThemedText>
    </View>
  );
}

type Busy = 'vincular' | 'quitar' | null;

export function LinkedinVerification({
  profile,
  onChange,
}: {
  profile: Profile;
  onChange: () => void;
}) {
  const repositories = useRepositories();
  const [busy, setBusy] = useState<Busy>(null);
  const [notice, setNotice] = useState<{ text: string; tone: 'textSecondary' | 'danger' } | null>(
    null
  );
  const seal = profile.linkedinVerification ?? null;

  async function run(action: Exclude<Busy, null>, call: () => Promise<Profile>) {
    if (busy) return;
    setBusy(action);
    setNotice(null);
    try {
      await call();
      onChange();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setNotice(
        message === LINKEDIN_VERIFICATION_CANCELLED
          ? { text: 'No se completó. No ha cambiado nada.', tone: 'textSecondary' }
          : { text: message, tone: 'danger' }
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.root}>
      {seal ? <LinkedinSeal name={seal.name} /> : null}
      <ThemedText type="small" themeColor="textSecondary">
        {seal
          ? 'Certifica que esa cuenta de LinkedIn es tuya, y nada más.'
          : 'Vincula tu LinkedIn y en tu tarjeta saldrá el sello de verificado. Es opcional.'}
      </ThemedText>
      {seal ? (
        <SecondaryButton
          label={busy === 'quitar' ? 'Quitando…' : 'Desvincular LinkedIn'}
          disabled={busy !== null}
          onPress={() => void run('quitar', () => repositories.profiles.unverifyLinkedin())}
        />
      ) : (
        <PrimaryButton
          label={busy === 'vincular' ? 'Abriendo LinkedIn…' : 'Vincular LinkedIn'}
          disabled={busy !== null}
          onPress={() => void run('vincular', () => repositories.profiles.verifyLinkedin())}
        />
      )}
      {notice ? (
        <ThemedText type="small" themeColor={notice.tone} accessibilityRole="alert">
          {notice.text}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.two,
  },
  seal: {
    alignSelf: 'flex-start',
    borderRadius: Radii.pill,
  },
  full: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  compact: {
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
  },
});
