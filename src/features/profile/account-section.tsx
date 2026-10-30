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
import { Linking, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing, Stroke } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { useQuery } from '@/data';
import { PremiumRow } from '@/features/premium/premium-row';
import { usePremium } from '@/features/premium/use-premium';
import { manageSubscriptionsUrl } from '@/lib/purchases';

import {
  AccountError,
  accountsAvailable,
  deleteMyAccount,
  isRecoveringPassword,
  signOut,
} from './account-gateway';
import { Field, PrimaryButton, SecondaryButton, TextField } from './controls';
import { PASSWORD_MIN_LENGTH } from './register-form';
import { useAccountActions } from './use-account-actions';

export interface AccountSectionProps {
  /** Corre cuando la cuenta ya está borrada: la pantalla vuelve al arranque. */
  onDeleted?: () => void;
  /**
   * Corre cuando una confirmación (cerrar sesión sin acceso, eliminar cuenta)
   * ya está pintada. Las confirmaciones crecen hacia abajo, justo bajo la barra
   * de tabs flotante: la pantalla que aloja la sección usa esto para desplazarse
   * hasta el final y que sus botones queden a la vista, no por debajo de la barra.
   */
  onConfirmationShown?: () => void;
}

/** Qué falta para poder guardar una contraseña nueva, o `null` si nada. */
export function newPasswordProblem(next: string, repeat: string): string | null {
  if (next.length < PASSWORD_MIN_LENGTH) {
    return `La contraseña nueva necesita al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }
  if (next !== repeat) return 'Las dos contraseñas nuevas no coinciden.';
  return null;
}

/**
 * «Gestionar contraseña»: cerrado, el menú (cambiar / la he olvidado), cambiarla
 * sabiendo la actual, o elegir una nueva al volver del correo de recuperación.
 */
type PasswordPanel = 'closed' | 'menu' | 'change' | 'recovery';

function readRecovering(): Promise<boolean> {
  return accountsAvailable ? isRecoveringPassword() : Promise.resolve(false);
}

export function AccountSection({ onDeleted, onConfirmationShown }: AccountSectionProps = {}) {
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
    changePassword,
    saveRecoveredPassword,
    resetPassword,
  } = useAccountActions();
  const { quotas, refresh: refreshPremium } = usePremium();
  const { data: recovering, refresh: refreshRecovering } = useQuery(
    'account:recovering',
    readRecovering
  );

  const [email, setEmail] = useState('');
  const [chosenPanel, setPanel] = useState<PasswordPanel>('closed');
  /** Cerrado a mano: aunque siga la recuperación, no se vuelve a abrir solo. */
  const [recoveryDismissed, setRecoveryDismissed] = useState(false);
  // De vuelta del correo de «He olvidado mi contraseña» se abre directamente el
  // paso de elegir la nueva, sin pedir la actual (es la que se ha olvidado).
  const panel: PasswordPanel =
    recovering && !recoveryDismissed && chosenPanel === 'closed' ? 'recovery' : chosenPanel;
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  /** Cierto cuando se pide otro email estando ya a la espera de confirmar uno. */
  const [changingEmail, setChangingEmail] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Sin cuenta que enseñar no hay sección: o todavía está cargando, o esta
  // ejecución corre contra el mock en memoria, o no hay sesión abierta.
  if (!account || account.kind === 'none') return null;

  function closePanel() {
    setPanel('closed');
    setRecoveryDismissed(true);
    setCurrent('');
    setNext('');
    setRepeat('');
  }

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
    const problem = newPasswordProblem(next, repeat);
    if (problem) {
      setNotice({ text: problem, tone: 'danger' });
      return;
    }
    const saved = () => {
      closePanel();
      refreshRecovering();
      setNotice({
        text: 'Contraseña guardada. Ya puedes entrar con ella desde otro teléfono.',
        tone: 'textSecondary',
      });
    };
    if (panel === 'recovery') saveRecoveredPassword(next, saved);
    else changePassword(current, next, saved);
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
      <ThemedText type="label" themeColor="textSecondary">
        Cuenta
      </ThemedText>

      {account.recoverable ? (
        // Desde el 2026-10-17 abajo solo queda lo que se gestiona: la
        // contraseña, cerrar sesión y eliminar la cuenta. El email se queda en
        // una línea para saber en qué cuenta se está.
        <ThemedText type="mono" accessibilityLabel={`Email de tu cuenta: ${account.email}`}>
          {account.email}
        </ThemedText>
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
            cambias de teléfono o desinstalas cofounder, no hay forma de traerlos de vuelta.
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

      <PremiumRow quotas={quotas} onRestored={() => void refreshPremium()} />

      {account.recoverable && panel === 'closed' ? (
        <SecondaryButton label="Gestionar contraseña" onPress={() => setPanel('menu')} />
      ) : null}

      {account.recoverable && panel === 'menu' ? (
        <View style={[styles.panel, { borderColor: theme.border }]}>
          <ThemedText type="bodyStrong">Gestionar contraseña</ThemedText>
          <PrimaryButton label="Cambiar contraseña" onPress={() => setPanel('change')} />
          <SecondaryButton
            label={busy === 'recuperar' ? 'Mandando…' : 'He olvidado mi contraseña'}
            onPress={handlePasswordReset}
          />
          <SecondaryButton label="Cancelar" onPress={closePanel} />
        </View>
      ) : null}

      {account.recoverable && (panel === 'change' || panel === 'recovery') ? (
        <View style={[styles.panel, { borderColor: theme.border }]}>
          <ThemedText type="bodyStrong">
            {panel === 'recovery' ? 'Elige tu nueva contraseña' : 'Cambiar contraseña'}
          </ThemedText>

          {panel === 'change' ? (
            <Field label="Contraseña actual">
              <TextField
                value={current}
                onChangeText={setCurrent}
                accessibilityLabel="Contraseña actual"
                placeholder="La que usas ahora"
                secureTextEntry
                textContentType="password"
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </Field>
          ) : null}

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
            onPress={handleSavePassword}
          />
          <SecondaryButton label="Cancelar" onPress={closePanel} />
        </View>
      ) : null}

      {confirmingLeave ? (
        // En la propia pantalla y no en un diálogo del sistema, igual que el
        // panel de verificación: un modal bloqueante deja la app sin responder.
        <View
          onLayout={onConfirmationShown}
          style={[
            styles.confirm,
            { backgroundColor: theme.dangerSoft, borderColor: theme.danger },
          ]}>
          <ThemedText type="bodyStrong" themeColor="danger">
            Cerrar sesión aquí te deja sin acceso a tu cuenta
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Esta cuenta solo existe en este teléfono. Si cierras sesión, perderás el acceso a tu
            perfil, tus matches y tus conversaciones desde este dispositivo y no podrás recuperarlo.
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Cerrar sesión no borra tus datos del servidor; para eso está «Eliminar mi cuenta». Si no
            quieres perder el acceso, asegura antes la cuenta con un email.
          </ThemedText>

          <SecondaryButton
            label={busy === 'salir' ? 'Cerrando sesión…' : 'Cerrar sesión y perder el acceso'}
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

      {confirmingDelete ? (
        <View
          onLayout={onConfirmationShown}
          style={[
            styles.confirm,
            { backgroundColor: theme.dangerSoft, borderColor: theme.danger },
          ]}>
          <ThemedText type="bodyStrong" themeColor="danger">
            Eliminar tu cuenta es para siempre
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Se borran tu perfil, tus matches, tus conversaciones, tus sesiones y tus salas, también
            para quienes hablaban contigo. No se puede deshacer ni recuperar.
          </ThemedText>
          {quotas === null || quotas.isPremium ? (
            <>
              <ThemedText type="small" themeColor="danger">
                {quotas === null
                  ? 'No hemos podido comprobar si tienes una suscripción. Si la tienes, no se cancela sola: cancélala en la tienda o se seguirá cobrando.'
                  : 'Tu suscripción no se cancela sola: cancélala en la tienda o se seguirá cobrando.'}
              </ThemedText>
              <SecondaryButton
                label="Gestionar suscripción"
                onPress={() => void Linking.openURL(manageSubscriptionsUrl())}
              />
            </>
          ) : null}

          <SecondaryButton
            label={busy === 'borrar' ? 'Eliminando…' : 'Eliminar mi cuenta para siempre'}
            tone="danger"
            onPress={() =>
              void run(
                'borrar',
                () => deleteMyAccount(),
                () => {
                  setConfirmingDelete(false);
                  onDeleted?.();
                }
              )
            }
          />
          <SecondaryButton label="Mejor no" onPress={() => setConfirmingDelete(false)} />
        </View>
      ) : (
        <SecondaryButton
          label="Eliminar mi cuenta"
          tone="danger"
          onPress={() => {
            setConfirmingLeave(false);
            setConfirmingDelete(true);
          }}
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
  panel: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radii.medium,
    borderWidth: Stroke.hairline,
  },
  confirm: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radii.medium,
    borderWidth: Stroke.hairline,
  },
});
