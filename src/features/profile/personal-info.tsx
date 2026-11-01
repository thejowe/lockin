/**
 * «Información personal» de Ajustes: el correo de la cuenta y el móvil.
 *
 * Lo que aquí aparece es privado: no sale en el perfil que ve la gente. El
 * correo se muestra y no se edita (cambiarlo es asegurar la cuenta otra vez, y
 * eso vive en «Cuenta»); el móvil sí se edita, con un lápiz al lado del valor
 * como el resto de cosas editables, y es obligatorio desde el alta.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { HitSlop, Opacity, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import {
  CompactPrimaryButton as PrimaryButton,
  CompactSecondaryButton as SecondaryButton,
  Field,
  TextField,
} from './controls';
import { useAccountActions } from './use-account-actions';

export function PersonalInfo() {
  const theme = useTheme();
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
        <ThemedText type="body" themeColor="textSecondary">
          Correo
        </ThemedText>
        <ThemedText
          type="bodyStrong"
          accessibilityLabel={`Correo de tu cuenta: ${email ?? 'sin añadir'}`}>
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
          <View style={styles.actions}>
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
          </View>
        </>
      ) : (
        <View style={styles.row}>
          <ThemedText type="body" themeColor="textSecondary">
            Teléfono
          </ThemedText>
          <View style={styles.valueRow}>
            <ThemedText type="bodyStrong">{account.phone ?? 'Sin añadir'}</ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={account.phone ? 'Cambiar teléfono' : 'Añadir teléfono'}
              hitSlop={HitSlop.inline}
              onPress={startEditing}
              style={({ pressed }) => [{ opacity: pressed ? Opacity.pressed : 1 }]}>
              <Icon name="pencil" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>
        </View>
      )}

      {notice ? (
        <ThemedText type="body" themeColor={notice.tone}>
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
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
