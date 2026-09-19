/**
 * Sección de cuenta del perfil propio.
 *
 * Es el sitio de la tab Perfil desde el que se asegura la cuenta (el alta, en el
 * onboarding, hace lo mismo con `register-form.tsx`), y existe porque hasta
 * ahora la app nunca decía la verdad más incómoda que tiene: mientras no haya un email confirmado, el perfil, los matches y las
 * conversaciones viven solo en el `AsyncStorage` de este teléfono.
 *
 * ## El copy no es negociable
 *
 * Aquí no se «crea una cuenta» ni se «registra» nadie: la cuenta ya existe
 * desde que se abrió la app por primera vez, y lo que se hace es **asegurarla**.
 * Ese matiz es lo que conserva el arranque sin fricción que decidió
 * `docs/plan/CONCEPTO.md` — si esto se lee como un registro, la pantalla acaba
 * empujando a registrarse, que es justo lo que el producto no quiere.
 *
 * Y si el email ya está en uso, el error se queda ahí: no se ofrece entrar en
 * la otra cuenta. Hacerlo abandonaría el perfil, los matches y los chats de
 * este dispositivo, y eso no se propone de pasada dentro de un mensaje de error
 * (decisión del 2026-09-17).
 *
 * ## El ascenso son dos pasos, no uno
 *
 * GoTrue no acepta contraseña en una cuenta anónima hasta que el email está
 * verificado, así que primero `linkEmailToCurrentUser(email)` —que solo pide la
 * confirmación— y solo después, de vuelta del correo, `setAccountPassword`. Por
 * eso `pending-email` tiene su propio bloque y **no** se pinta como estado a
 * salvo: prometerlo sería mentir.
 *
 * ## Quién bloquea el cierre de sesión
 *
 * No esta pantalla: `signOut()` se niega solo cuando la cuenta no es
 * recuperable. Aquí se le llama sin flag, se recoge ese `unrecoverable-account`
 * y es él quien abre el aviso. Así la regla vive en un único sitio y esta
 * pantalla no puede quedarse con una copia desfasada de ella.
 */

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { AccountError, signOut } from './account-gateway';
import { Field, PrimaryButton, SecondaryButton, TextField } from './controls';
import { useAccountActions } from './use-account-actions';

export function AccountSection() {
  const theme = useTheme();
  const {
    account,
    refresh,
    busy,
    notice,
    setNotice,
    run,
    link,
    resend,
    savePassword,
    resetPassword,
  } = useAccountActions();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  /** Cierto cuando se pide otro email estando ya a la espera de confirmar uno. */
  const [changingEmail, setChangingEmail] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);

  // Sin cuenta que enseñar no hay sección: o todavía está cargando, o esta
  // ejecución corre contra el mock en memoria, o no hay sesión abierta.
  if (!account || account.kind === 'none') return null;

  function handleLink() {
    link(email, () => {
      setEmail('');
      setChangingEmail(false);
    });
  }

  function handleResend() {
    resend(() => setNotice({ text: 'Te lo hemos vuelto a mandar.', tone: 'textSecondary' }));
  }

  function handleSavePassword() {
    savePassword(password, () => {
      setPassword('');
      setNotice({
        text: 'Contraseña guardada. Ya puedes entrar con ella desde otro teléfono.',
        tone: 'textSecondary',
      });
    });
  }

  function handlePasswordReset() {
    resetPassword(() =>
      setNotice({
        text: 'Te hemos mandado un correo para cambiar la contraseña.',
        tone: 'textSecondary',
      })
    );
  }

  /**
   * Intenta cerrar sesión de verdad y deja que la capa de datos decida.
   *
   * Si la cuenta no es recuperable, `signOut()` lanza `unrecoverable-account`, y
   * eso —y no una comprobación duplicada aquí— es lo que abre el aviso.
   */
  function handleSignOut() {
    void run(
      'salir',
      () => signOut(),
      undefined,
      (cause) => {
        if (cause instanceof AccountError && cause.reason === 'unrecoverable-account') {
          setConfirmingLeave(true);
          return true;
        }
        return false;
      }
    );
  }

  const pendingEmail = account.pendingEmail;
  const waitingForEmail = account.kind === 'pending-email' && !changingEmail;
  const askingForEmail = !account.recoverable && !waitingForEmail;

  return (
    <View style={styles.root}>
      <ThemedText type="label" themeColor="brass">
        Cuenta
      </ThemedText>

      {account.recoverable ? (
        <>
          <ThemedText type="bodyStrong">Tu cuenta está asegurada</ThemedText>
          <ThemedText type="mono" accessibilityLabel={`Email de tu cuenta: ${account.email}`}>
            {account.email}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Con este email vuelves a entrar desde cualquier teléfono, con tu perfil, tus matches y
            tus conversaciones.
          </ThemedText>
        </>
      ) : account.kind === 'pending-email' ? (
        <>
          <ThemedText type="bodyStrong">Falta confirmar tu email</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {`Te hemos mandado un correo a ${pendingEmail ?? 'tu email'}. Pincha el enlace y tu cuenta quedará asegurada.`}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Hasta que lo pinches, tus datos siguen viviendo solo en este teléfono.
          </ThemedText>
        </>
      ) : (
        <>
          <ThemedText type="bodyStrong">Tus datos viven solo en este teléfono</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Tu perfil, tus matches y tus conversaciones están guardados aquí, en este móvil. Si
            cambias de teléfono o desinstalas LockIn, no hay forma de traerlos de vuelta.
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Con un email recuperas tu cuenta desde donde quieras. No creas otra: aseguras la que ya
            tienes.
          </ThemedText>
        </>
      )}

      {waitingForEmail ? (
        <>
          <PrimaryButton label="Ya lo he confirmado" onPress={refresh} />
          <SecondaryButton
            label={busy === 'reenviar' ? 'Mandando…' : 'Reenviar el correo'}
            onPress={handleResend}
          />
          <SecondaryButton label="Usar otro email" onPress={() => setChangingEmail(true)} />
        </>
      ) : null}

      {askingForEmail ? (
        <>
          <Field label="Email" hint="Te mandamos un enlace para confirmar que es tuyo.">
            <TextField
              value={email}
              onChangeText={setEmail}
              accessibilityLabel="Email con el que asegurar tu cuenta"
              placeholder="tu@email.com"
              keyboardType="email-address"
              inputMode="email"
              textContentType="emailAddress"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>

          <PrimaryButton
            label={busy === 'asegurar' ? 'Mandando el correo…' : 'Asegurar mi cuenta'}
            onPress={handleLink}
          />
        </>
      ) : null}

      {account.recoverable ? (
        <>
          <Field label="Contraseña" hint="Es con la que entrarás desde otro teléfono.">
            <TextField
              value={password}
              onChangeText={setPassword}
              accessibilityLabel="Contraseña de tu cuenta"
              placeholder="Tu contraseña"
              secureTextEntry
              textContentType="newPassword"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>

          <PrimaryButton
            label={busy === 'contrasena' ? 'Guardando…' : 'Guardar contraseña'}
            onPress={handleSavePassword}
          />

          <SecondaryButton
            label={busy === 'recuperar' ? 'Mandando…' : 'No me acuerdo: mándame un correo'}
            onPress={handlePasswordReset}
          />
        </>
      ) : null}

      {confirmingLeave ? (
        // En la propia pantalla y no en un diálogo del sistema, igual que el
        // panel de verificación: un modal bloqueante deja la app sin responder.
        <View
          style={[
            styles.confirm,
            { backgroundColor: theme.dangerSoft, borderColor: theme.danger },
          ]}>
          <ThemedText type="bodyStrong" themeColor="danger">
            Cerrar sesión aquí borra tus datos
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Esta cuenta solo existe en este teléfono. Si cierras sesión, tu perfil, tus matches y
            tus conversaciones desaparecen para siempre.
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Si lo que quieres es no perderlos, asegura antes la cuenta con un email.
          </ThemedText>

          <SecondaryButton
            label={busy === 'salir' ? 'Borrando…' : 'Borrarlo todo y cerrar sesión'}
            tone="danger"
            onPress={() =>
              void run(
                'salir',
                () => signOut({ acceptDataLoss: true }),
                () => setConfirmingLeave(false)
              )
            }
          />
          <SecondaryButton label="Mejor no" onPress={() => setConfirmingLeave(false)} />
        </View>
      ) : (
        <SecondaryButton
          label={busy === 'salir' ? 'Cerrando sesión…' : 'Cerrar sesión'}
          onPress={handleSignOut}
        />
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
  confirm: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radii.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
