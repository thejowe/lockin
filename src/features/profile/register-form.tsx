/**
 * «Crear cuenta»: el registro con email y contraseña del onboarding.
 *
 * Decisión del usuario del 2026-09-20: el registro es **obligatorio**. Esta
 * pantalla es la puerta —`mode` y `profile-form` mandan aquí mientras la cuenta
 * no sea recuperable— y por eso no tiene «Ahora no».
 *
 * ## Tres tiempos, no un formulario
 *
 * No se pide el email y la contraseña juntos, y no es capricho: GoTrue no acepta
 * contraseña en una cuenta anónima hasta que su email está verificado
 * (`mailer_autoconfirm` está en `false` a propósito). Así que el alta es
 * email → confirmar el correo → contraseña, y la pantalla es la misma en los
 * tres: el paso lo dicta el `AccountState`, no un contador local, de modo que
 * volver del correo (o reabrir la app) cae en el paso que toca.
 *
 * ## Se asciende la sesión, no se abre otra
 *
 * Es `linkEmailToCurrentUser`, la misma operación que `AccountSection` ofrece
 * en Perfil, y sale del mismo hook (`use-account-actions.ts`): el alta y el
 * ascenso son un único camino. `auth.uid()` no cambia.
 *
 * ## Qué no puede garantizar
 *
 * Que la contraseña se ponga: `AccountState` no dice si la cuenta la tiene, así
 * que quien cierre la app entre confirmar y elegirla pasa la puerta igualmente
 * —la cuenta ya es recuperable por correo, y Perfil sigue ofreciéndola—.
 *
 * ## El copy
 *
 * «Crear cuenta» para el alta y «Ya tengo cuenta» para volver a una: quien
 * reinstala también aterriza aquí, así que esa salida no puede faltar. Y como
 * en el alta no hay perfil que abandonar, si el email ya está en uso no hace
 * falta ninguna advertencia: el aviso de error y ese botón bastan.
 */

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

import { Field, PrimaryButton, SecondaryButton, TextField } from './controls';
import { describeAccountError, useAccountActions } from './use-account-actions';

export function RegisterForm({
  /** La cuenta ya tiene email confirmado y contraseña: el onboarding sigue. */
  onDone,
  /** Salida para quien ya tiene una cuenta. */
  onSignIn,
}: {
  onDone: () => void;
  onSignIn: () => void;
}) {
  const {
    account,
    loading,
    loadError,
    refresh,
    busy,
    notice,
    setNotice,
    link,
    resend,
    savePassword,
  } = useAccountActions();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  /** Cierto cuando se pide otro email estando ya a la espera de confirmar uno. */
  const [changingEmail, setChangingEmail] = useState(false);

  if (loading) return null;

  if (loadError || !account) {
    return (
      <View style={styles.root}>
        <ThemedText type="title">No hemos podido comprobar tu cuenta</ThemedText>
        <ThemedText type="body" themeColor="textSecondary">
          {loadError ? describeAccountError(loadError) : 'Inténtalo otra vez.'}
        </ThemedText>
        <PrimaryButton label="Reintentar" onPress={refresh} />
        <SecondaryButton label="Ya tengo cuenta" onPress={onSignIn} />
      </View>
    );
  }

  const step = account.recoverable
    ? 'password'
    : account.kind === 'pending-email' && !changingEmail
      ? 'confirm'
      : 'email';

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <ThemedText type="label" themeColor="brass">
          Antes de empezar
        </ThemedText>

        {step === 'email' ? (
          <>
            <ThemedText type="title">Crea tu cuenta</ThemedText>
            <ThemedText type="body" themeColor="textSecondary">
              Con tu email vuelves a tu perfil, tus matches y tus conversaciones desde cualquier
              teléfono. Te mandamos un correo para confirmar que es tuyo, y la contraseña la eliges
              cuando lo hayas confirmado.
            </ThemedText>
          </>
        ) : null}

        {step === 'confirm' ? (
          <>
            <ThemedText type="title">Confirma tu email</ThemedText>
            <ThemedText type="body" themeColor="textSecondary">
              {`Te hemos mandado un correo a ${account.pendingEmail ?? 'tu email'}. Pincha el enlace y vuelve aquí para elegir tu contraseña.`}
            </ThemedText>
          </>
        ) : null}

        {step === 'password' ? (
          <>
            <ThemedText type="title">Elige tu contraseña</ThemedText>
            <ThemedText type="mono" accessibilityLabel={`Email confirmado: ${account.email ?? ''}`}>
              {account.email}
            </ThemedText>
            <ThemedText type="body" themeColor="textSecondary">
              Email confirmado. Esta es la contraseña con la que entrarás desde otro teléfono.
            </ThemedText>
          </>
        ) : null}
      </View>

      {step === 'email' ? (
        <>
          <Field label="Email">
            <TextField
              value={email}
              onChangeText={setEmail}
              accessibilityLabel="Email de tu cuenta"
              placeholder="tu@email.com"
              keyboardType="email-address"
              inputMode="email"
              textContentType="emailAddress"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>

          <PrimaryButton
            label={busy === 'asegurar' ? 'Mandando el correo…' : 'Crear cuenta'}
            disabled={busy !== null}
            onPress={() =>
              link(email, () => {
                setEmail('');
                setChangingEmail(false);
              })
            }
          />
        </>
      ) : null}

      {step === 'confirm' ? (
        <>
          <PrimaryButton label="Ya lo he confirmado" onPress={refresh} />
          <SecondaryButton
            label={busy === 'reenviar' ? 'Mandando…' : 'Reenviar el correo'}
            onPress={() =>
              resend(() =>
                setNotice({ text: 'Te lo hemos vuelto a mandar.', tone: 'textSecondary' })
              )
            }
          />
          <SecondaryButton label="Usar otro email" onPress={() => setChangingEmail(true)} />
        </>
      ) : null}

      {step === 'password' ? (
        <>
          <Field label="Contraseña">
            <TextField
              value={password}
              onChangeText={setPassword}
              accessibilityLabel="Contraseña de tu cuenta"
              placeholder="Tu contraseña"
              secureTextEntry
              textContentType="newPassword"
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>

          <PrimaryButton
            label={busy === 'contrasena' ? 'Guardando…' : 'Guardar y continuar'}
            disabled={busy !== null}
            onPress={() =>
              savePassword(password, () => {
                setPassword('');
                onDone();
              })
            }
          />
        </>
      ) : null}

      {notice ? (
        <ThemedText type="small" themeColor={notice.tone} accessibilityRole="alert">
          {notice.text}
        </ThemedText>
      ) : null}

      {step === 'password' ? null : <SecondaryButton label="Ya tengo cuenta" onPress={onSignIn} />}
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
