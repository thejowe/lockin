/**
 * «Información personal» de Ajustes: el correo de la cuenta y el móvil.
 *
 * Lo que aquí aparece es privado: no sale en el perfil que ve la gente. El
 * correo se muestra y no se edita (cambiarlo es asegurar la cuenta otra vez, y
 * eso vive en «Cuenta»); el móvil sí se edita, y es obligatorio desde el alta.
 */

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

import { Field, PrimaryButton, SecondaryButton, TextField } from './controls';
import { useAccountActions } from './use-account-actions';

export function PersonalInfo() {
  const { account, busy, notice, setNotice, savePhone } = useAccountActions();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  if (!account || account.kind === 'none') return null;

  function startEditing() {
    setDraft(account?.phone ?? '');
    setNotice(null);
    setEditing(true);
  }

  const email = account.email ?? account.pendingEmail;

  return (
    <View style={styles.root}>
      <ThemedText type="label" themeColor="textSecondary">
        Información personal
      </ThemedText>

      <View style={styles.row}>
        <ThemedText type="small" themeColor="textSecondary">
          Correo
        </ThemedText>
        <ThemedText type="mono" accessibilityLabel={`Correo de tu cuenta: ${email ?? 'sin añadir'}`}>
          {email ?? 'Sin añadir'}
        </ThemedText>
      </View>

      {editing ? (
        <>
          <Field label="Teléfono" hint="Es privado: no sale en tu perfil.">
            <TextField
              value={draft}
              onChangeText={setDraft}
              accessibilityLabel="Teléfono de tu cuenta"
              placeholder="+34 600 123 456"
              keyboardType="phone-pad"
              inputMode="tel"
              textContentType="telephoneNumber"
              autoComplete="tel"
              autoCorrect={false}
            />
          </Field>
          <PrimaryButton
            label={busy === 'telefono' ? 'Guardando…' : 'Guardar teléfono'}
            disabled={busy !== null}
            onPress={() =>
              savePhone(draft, () => {
                setEditing(false);
                setNotice({ text: 'Teléfono guardado.', tone: 'textSecondary' });
              })
            }
          />
          <SecondaryButton label="Cancelar" onPress={() => setEditing(false)} />
        </>
      ) : (
        <>
          <View style={styles.row}>
            <ThemedText type="small" themeColor="textSecondary">
              Teléfono
            </ThemedText>
            <ThemedText type="mono">{account.phone ?? 'Sin añadir'}</ThemedText>
          </View>
          <SecondaryButton
            label={account.phone ? 'Cambiar teléfono' : 'Añadir teléfono'}
            onPress={startEditing}
          />
        </>
      )}

      {notice ? (
        <ThemedText type="small" themeColor={notice.tone}>
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
  row: {
    gap: Spacing.half,
  },
});
