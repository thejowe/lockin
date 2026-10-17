/**
 * «Crea tu cuenta»: el registro con email y contraseña del onboarding.
 *
 * Decisión del usuario del 2026-09-20: el registro es **obligatorio**. Esta
 * pantalla es la puerta —`mode` y `profile-form` mandan aquí mientras la cuenta
 * no sea recuperable— y por eso no tiene «Ahora no».
 *
 * ## Dos pasos para la persona, tres para el servidor
 *
 * Desde el 2026-10-17 se pide todo de una vez: email, contraseña, repetirla y
 * aceptar los Términos; después, confirmar el correo. Pero GoTrue no acepta
 * contraseña en una cuenta anónima hasta que su email está verificado
 * (`mailer_autoconfirm` está en `false` a propósito), así que por debajo el
 * orden sigue siendo email → confirmar → contraseña: la contraseña espera en el
 * almacén seguro (`pending-password.ts`) y se aplica sola en cuanto la cuenta
 * pasa a recuperable. El paso lo dicta el `AccountState`, no un contador local,
 * de modo que volver del correo (o reabrir la app) cae en el paso que toca.
 *
 * Si la contraseña guardada no está (el sistema mató la app y no había almacén
 * seguro, o pasó más de un día) o el servidor la rechaza, se vuelve a pedir: es
 * el paso «Elige tu contraseña» de antes, que queda como red.
 *
 * Los Términos se aceptan aquí y no al final: la aceptación cuelga del
 * `auth.uid()`, que no cambia en todo el ascenso, así que el formulario de
 * perfil ya la encuentra hecha y no vuelve a preguntar.
 *
 * ## Se asciende la sesión, no se abre otra
 *
 * Es `linkEmailToCurrentUser`, la misma operación que `AccountSection` ofrece
 * en Perfil, y sale del mismo hook (`use-account-actions.ts`): el alta y el
 * ascenso son un único camino. `auth.uid()` no cambia.
 *
 * ## El copy
 *
 * «Crear cuenta» para el alta y «Ya tengo cuenta» para volver a una: quien
 * reinstala también aterriza aquí, así que esa salida no puede faltar. Y como
 * en el alta no hay perfil que abandonar, si el email ya está en uso no hace
 * falta ninguna advertencia: el aviso de error y ese botón bastan.
 */

import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { TERMS_VERSION } from '@/constants/legal';
import { Spacing } from '@/constants/theme';
import { useRepositories } from '@/data';

import { describeAccountError } from './account-copy';
import { AccountError, linkEmailToCurrentUser, setAccountPassword } from './account-gateway';
import { Field, PrimaryButton, SecondaryButton, TextField } from './controls';
import {
  clearPendingPassword,
  hasPendingPassword,
  readPendingPassword,
  stashPendingPassword,
} from './pending-password';
import { TermsCheckbox, TermsLinks } from './terms';
import { useAccountActions } from './use-account-actions';

/** Mínimo propio, por encima de los 6 de GoTrue por defecto. */
export const PASSWORD_MIN_LENGTH = 8;

/** Qué falta para poder mandar el paso de cuenta, o `null` si nada. */
export function accountStepProblem({
  email,
  password,
  repeat,
  termsAccepted,
}: {
  email: string;
  password: string;
  repeat: string;
  termsAccepted: boolean;
}): string | null {
  if (!email.trim()) return 'Escribe tu email para que podamos mandarte el enlace.';
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `La contraseña necesita al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }
  if (password !== repeat) return 'Las dos contraseñas no coinciden.';
  if (!termsAccepted) return 'Para crear la cuenta tienes que aceptar los Términos y las Normas.';
  return null;
}

function PasswordFields({
  password,
  repeat,
  onPassword,
  onRepeat,
}: {
  password: string;
  repeat: string;
  onPassword: (value: string) => void;
  onRepeat: (value: string) => void;
}) {
  return (
    <>
      <Field label="Contraseña" hint={`Al menos ${PASSWORD_MIN_LENGTH} caracteres.`}>
        <TextField
          value={password}
          onChangeText={onPassword}
          accessibilityLabel="Contraseña de tu cuenta"
          placeholder="Tu contraseña"
          secureTextEntry
          textContentType="newPassword"
          autoComplete="new-password"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </Field>

      <Field label="Repite la contraseña">
        <TextField
          value={repeat}
          onChangeText={onRepeat}
          accessibilityLabel="Repite la contraseña"
          placeholder="Otra vez"
          secureTextEntry
          textContentType="newPassword"
          autoComplete="new-password"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </Field>
    </>
  );
}

export function RegisterForm({
  /** La cuenta ya tiene email confirmado y contraseña: el onboarding sigue. */
  onDone,
  /** Salida para quien ya tiene una cuenta. */
  onSignIn,
  /** Etiquetas de paso («Paso 2 de 4»…), si quien lo monta cuenta pasos. */
  steps,
}: {
  onDone: () => void;
  onSignIn: () => void;
  steps?: { account: string; confirm: string };
}) {
  const repositories = useRepositories();
  const { account, loading, loadError, refresh, busy, notice, setNotice, run, resend } =
    useAccountActions();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  /** Cierto cuando se pide otro email estando ya a la espera de confirmar uno. */
  const [changingEmail, setChangingEmail] = useState(false);
  /**
   * Con la cuenta ya recuperable: `applying` mientras se pone la contraseña
   * guardada, `manual` si hay que pedirla otra vez.
   */
  const [finish, setFinish] = useState<'idle' | 'applying' | 'manual'>('idle');
  const finishing = useRef(false);

  const recoverable = account?.recoverable === true;
  const userId = account?.userId ?? null;

  // Al volver del correo con la cuenta ya confirmada: se pone sola la
  // contraseña que se eligió antes de confirmar. Solo la de esta cuenta: una
  // que esperaba para otra (un alta abandonada antes de entrar en otra cuenta)
  // se borra, y esta cuenta ya tiene la suya, así que se sigue sin pedir nada.
  useEffect(() => {
    if (!recoverable || !userId || finishing.current) return;
    finishing.current = true;
    setFinish('applying');

    void (async () => {
      const someone = await hasPendingPassword();
      const stashed = await readPendingPassword(userId);
      if (!stashed) {
        if (someone) onDone();
        else setFinish('manual');
        return;
      }
      try {
        await setAccountPassword(stashed, userId);
        await clearPendingPassword();
        onDone();
      } catch (cause) {
        setNotice({ text: describeAccountError(cause), tone: 'danger' });
        setFinish('manual');
      }
    })();
  }, [recoverable, userId, onDone, setNotice]);

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

  const step = recoverable
    ? 'password'
    : account.kind === 'pending-email' && !changingEmail
      ? 'confirm'
      : 'account';

  if (step === 'password' && finish !== 'manual') {
    return (
      <View style={styles.root}>
        <ThemedText type="title">Email confirmado</ThemedText>
        <ThemedText type="body" themeColor="textSecondary">
          Terminando de crear tu cuenta…
        </ThemedText>
      </View>
    );
  }

  function submitAccount() {
    const problem = accountStepProblem({ email, password, repeat, termsAccepted });
    if (problem) {
      setNotice({ text: problem, tone: 'danger' });
      return;
    }

    const address = email.trim();
    const owner = account?.userId;
    void run(
      'asegurar',
      async () => {
        if (!owner) {
          throw new AccountError('no-session', 'No hay ninguna sesión abierta.');
        }
        await stashPendingPassword(password, owner);
        await repositories.session.acceptTerms(TERMS_VERSION);
        await linkEmailToCurrentUser(address);
      },
      () => {
        setEmail('');
        setPassword('');
        setRepeat('');
        setChangingEmail(false);
      }
    );
  }

  function submitPassword() {
    const problem = accountStepProblem({
      email: account?.email ?? '-',
      password,
      repeat,
      termsAccepted: true,
    });
    if (problem) {
      setNotice({ text: problem, tone: 'danger' });
      return;
    }

    void run(
      'contrasena',
      () => setAccountPassword(password),
      () => {
        setPassword('');
        setRepeat('');
        void clearPendingPassword();
        onDone();
      }
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <ThemedText type="label" themeColor="textSecondary">
          {step === 'confirm'
            ? (steps?.confirm ?? 'Casi está')
            : (steps?.account ?? 'Antes de empezar')}
        </ThemedText>

        {step === 'account' ? (
          <>
            <ThemedText type="title">Crea tu cuenta</ThemedText>
            <ThemedText type="body" themeColor="textSecondary">
              Con tu email y tu contraseña vuelves a tu perfil, tus matches y tus conversaciones
              desde cualquier teléfono. Te mandaremos un correo para confirmar que es tuyo.
            </ThemedText>
          </>
        ) : null}

        {step === 'confirm' ? (
          <>
            <ThemedText type="title">Verifica tu email</ThemedText>
            <ThemedText type="body" themeColor="textSecondary">
              {`Te hemos mandado un correo a ${account.pendingEmail ?? 'tu email'}. Pincha el enlace y vuelve aquí: seguimos con tu perfil.`}
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
              Email confirmado. Vuelve a escribir la contraseña con la que entrarás desde otro
              teléfono.
            </ThemedText>
          </>
        ) : null}
      </View>

      {step === 'account' ? (
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

          <PasswordFields
            password={password}
            repeat={repeat}
            onPassword={setPassword}
            onRepeat={setRepeat}
          />

          <TermsLinks />
          <TermsCheckbox
            checked={termsAccepted}
            onToggle={() => setTermsAccepted((value) => !value)}
          />

          <PrimaryButton
            label={busy === 'asegurar' ? 'Creando la cuenta…' : 'Crear cuenta'}
            disabled={busy !== null}
            onPress={submitAccount}
          />
        </>
      ) : null}

      {step === 'confirm' ? (
        <>
          <PrimaryButton label="Ya lo he verificado" onPress={refresh} />
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
          <PasswordFields
            password={password}
            repeat={repeat}
            onPassword={setPassword}
            onRepeat={setRepeat}
          />

          <PrimaryButton
            label={busy === 'contrasena' ? 'Guardando…' : 'Guardar y continuar'}
            disabled={busy !== null}
            onPress={submitPassword}
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
