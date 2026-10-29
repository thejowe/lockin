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
        text: 'Contraseña guardada. Ya puedes entrar con ella desde otro teléfono.',
        tone: 'textSecondary',
      });
    });
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <ThemedText type="title">Elige tu nueva contraseña</ThemedText>
        {account?.email ? (
          <ThemedText type="mono" accessibilityLabel={`Email de tu cuenta: ${account.email}`}>
            {account.email}
          </ThemedText>
        ) : null}
      </View>

      {saved ? null : (
        <>
          <Field label="Nueva contraseña" hint={`Al menos ${PASSWORD_MIN_LENGTH} caracteres.`}>
            <TextField
              value={next}
              onChangeText={setNext}
              accessibilityLabel="Nueva contraseña"
              placeholder="La nueva"
              secureTextEntry
              textContentType="newPassword"
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>

          <Field label="Repite la nueva contraseña">
            <TextField
              value={repeat}
              onChangeText={setRepeat}
              accessibilityLabel="Repite la nueva contraseña"
              placeholder="Otra vez"
              secureTextEntry
              textContentType="newPassword"
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>

          <PrimaryButton
            label={busy === 'contrasena' ? 'Guardando…' : 'Guardar contraseña'}
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
        <PrimaryButton label="Seguir" onPress={onDone} />
      ) : (
        <SecondaryButton label="Ahora no" disabled={busy !== null} onPress={onDone} />
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
