/**
 * «Elige tu nueva contraseña»: lo que se abre al volver del correo de
 * «¿Has olvidado la contraseña?» (2026-10-30, decisión del usuario).
 *
 * Antes el enlace dejaba a la persona en Perfil y tenía que bajar hasta el
 * panel de la contraseña. Ahora `auth/callback` abre esta hoja directamente si
 * la sesión viene de un enlace de recuperación vigente (`isRecoveringPassword`).
 *
 * Pide la nueva dos veces y nunca la actual: es justo la que se ha olvidado.
 * Guarda con `setRecoveredPassword`, que vuelve a comprobar que el enlace sigue
 * vigente. Si la persona la cierra sin guardar, el panel de Perfil sigue
 * ofreciendo lo mismo mientras dure la recuperación.
 */

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

import { newPasswordProblem } from './account-section';
import { Field, PrimaryButton, SecondaryButton, TextField } from './controls';
import { PASSWORD_MIN_LENGTH } from './register-form';
import { useAccountActions } from './use-account-actions';
import { t } from '@/i18n';

export function NewPasswordForm({
  /** Guardada, o cerrada sin guardar: a dónde sigue lo decide quien la monta. */
  onDone,
}: {
  onDone: () => void;
}) {
  const { account, busy, notice, setNotice, saveRecoveredPassword } = useAccountActions();

  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [saved, setSaved] = useState(false);

  function handleSave() {
    const problem = newPasswordProblem(next, repeat);
    if (problem) {
      setNotice({ text: problem, tone: 'danger' });
      return;
    }
    saveRecoveredPassword(next, () => {
      setNext('');
      setRepeat('');
      setSaved(true);
      setNotice({
        text: t('Contraseña guardada. Ya puedes entrar con ella desde otro teléfono.'),
        tone: 'textSecondary',
      });
    });
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <ThemedText type="title">{t('Elige tu nueva contraseña')}</ThemedText>
        {account?.email ? (
          <ThemedText
            type="mono"
            accessibilityLabel={t('Email de tu cuenta: {email}', { email: account.email })}>
            {account.email}
          </ThemedText>
        ) : null}
      </View>

      {saved ? null : (
        <>
          <Field
            label={t('Nueva contraseña')}
            hint={t('Al menos {PASSWORD_MIN_LENGTH} caracteres.', { PASSWORD_MIN_LENGTH })}>
            <TextField
              value={next}
              onChangeText={setNext}
              accessibilityLabel={t('Nueva contraseña')}
              placeholder={t('La nueva')}
              secureTextEntry
              textContentType="newPassword"
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>

          <Field label={t('Repite la nueva contraseña')}>
            <TextField
              value={repeat}
              onChangeText={setRepeat}
              accessibilityLabel={t('Repite la nueva contraseña')}
              placeholder={t('Otra vez')}
              secureTextEntry
              textContentType="newPassword"
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>

          <PrimaryButton
            label={busy === 'contrasena' ? t('Guardando…') : t('Guardar contraseña')}
            disabled={busy !== null}
            onPress={handleSave}
          />
        </>
      )}

      {notice ? (
        <ThemedText type="small" themeColor={notice.tone} accessibilityRole="alert">
          {notice.text}
        </ThemedText>
      ) : null}

      {saved ? (
        <PrimaryButton label={t('Seguir')} onPress={onDone} />
      ) : (
        <SecondaryButton label={t('Ahora no')} disabled={busy !== null} onPress={onDone} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.two,
  },
});
