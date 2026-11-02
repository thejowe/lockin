/**
 * «Tu teléfono»: el paso que pide el móvil a quien ya tiene la cuenta
 * confirmada pero no lo dio — entró con GitHub, LinkedIn, Google o Apple, que
 * se saltan el formulario de registro, o tiene la cuenta de antes del requisito.
 *
 * Sin salida: el móvil es obligatorio. Al guardar, `onDone` devuelve al arranque
 * (`/`), que decide el siguiente paso. El número no se verifica por SMS.
 */

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

import { Field, PrimaryButton, TextField } from './controls';
import { CountryCodePicker } from './country-code-picker';
import { DEFAULT_COUNTRY, joinPhone } from './countries';
import { useAccountActions } from './use-account-actions';
import { t } from '@/i18n';

export function PhoneStep({ onDone }: { onDone: () => void }) {
  const { busy, notice, savePhone } = useAccountActions();
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState('');

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <ThemedText type="title">{t('Tu teléfono')}</ThemedText>
        <ThemedText type="body" themeColor="textSecondary">
          {t('Necesitamos un número de contacto para tu cuenta. Es privado: no sale en tu perfil.')}
        </ThemedText>
      </View>

      <Field label={t('Teléfono')}>
        <View style={styles.phoneRow}>
          <CountryCodePicker country={country} onChange={setCountry} disabled={busy !== null} />
          <View style={styles.phoneInput}>
            <TextField
              value={phone}
              onChangeText={setPhone}
              accessibilityLabel={t('Teléfono de tu cuenta, sin prefijo')}
              placeholder="600 123 456"
              keyboardType="phone-pad"
              inputMode="tel"
              textContentType="telephoneNumber"
              autoComplete="tel"
              autoCorrect={false}
            />
          </View>
        </View>
      </Field>

      <PrimaryButton
        label={busy === 'telefono' ? t('Guardando…') : t('Guardar y continuar')}
        disabled={busy !== null}
        onPress={() => savePhone(joinPhone(country, phone), onDone)}
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
  phoneRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  phoneInput: {
    flex: 1,
  },
});
