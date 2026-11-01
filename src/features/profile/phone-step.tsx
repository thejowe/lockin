/**
 * «Tu teléfono»: el paso que pide el móvil a quien ya tiene la cuenta
 * confirmada pero no lo dio — entró con GitHub, LinkedIn, Google o Apple, que
 * se saltan el formulario de registro, o tiene la cuenta de antes del requisito.
 *
 * Sin salida: el móvil es obligatorio. Al guardar, `onDone` devuelve al arranque
 * (`/`), que decide el siguiente paso.
 */

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

import { Field, PrimaryButton, TextField } from './controls';
import { useAccountActions } from './use-account-actions';

export function PhoneStep({ onDone }: { onDone: () => void }) {
  const { busy, notice, savePhone } = useAccountActions();
  const [phone, setPhone] = useState('');

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <ThemedText type="title">Tu teléfono</ThemedText>
        <ThemedText type="body" themeColor="textSecondary">
          Necesitamos un número de contacto para tu cuenta. Es privado: no sale en tu perfil.
        </ThemedText>
      </View>

      <Field label="Teléfono">
        <TextField
          value={phone}
          onChangeText={setPhone}
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
        label={busy === 'telefono' ? 'Guardando…' : 'Guardar y continuar'}
        disabled={busy !== null}
        onPress={() => savePhone(phone, onDone)}
      />

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
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.two,
  },
});
