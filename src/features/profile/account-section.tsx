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
import {
  CompactPrimaryButton as PrimaryButton,
  CompactSecondaryButton as SecondaryButton,
  Field,
  TextField,
} from './controls';
import { PASSWORD_MIN_LENGTH } from './register-form';
import { useAccountActions } from './use-account-actions';
import { t } from '@/i18n';

export interface AccountSectionProps {
  /**
   * «Información personal» (correo y teléfono). La contraseña se pinta justo
   * debajo, en el mismo apartado, así que esta sección la recibe para ponerla
   * delante en vez de dejar que la pantalla las separe.
   */
  personalInfo?: React.ReactNode;
  /** Lo que va entre la contraseña y las salidas (cerrar sesión, eliminar): el bloque Legal. */
  children?: React.ReactNode;
  /** Corre cuando la cuenta ya está borrada: la pantalla vuelve al arranque. */
  onDeleted?: () => void;
  /** Corre cuando la sesión ya está cerrada: la pantalla vuelve al arranque. */
  onSignedOut?: () => void;
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
    return t('La contraseña nueva necesita al menos {PASSWORD_MIN_LENGTH} caracteres.', {
      PASSWORD_MIN_LENGTH,
    });
  }
  if (next !== repeat) return t('Las dos contraseñas nuevas no coinciden.');
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

export function AccountSection({
  personalInfo,
  children,
  onDeleted,
  onSignedOut,
  onConfirmationShown,
}: AccountSectionProps = {}) {
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
    resend(() => setNotice({ text: t('Te lo hemos vuelto a mandar.'), tone: 'textSecondary' }));
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
        text: t('Contraseña guardada. Ya puedes entrar con ella desde otro teléfono.'),
        tone: 'textSecondary',
      });
    };
    if (panel === 'recovery') saveRecoveredPassword(next, saved);
    else changePassword(current, next, saved);
  }

  function handlePasswordReset() {
    resetPassword(() =>
      setNotice({
        text: t('Te hemos mandado un correo para cambiar la contraseña.'),
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
      onSignedOut,
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
      <View style={styles.block}>
        {personalInfo}

        {account.recoverable ? (
          <View style={styles.passwordRow}>
            <ThemedText type="body" themeColor="textSecondary">
              {t('Contraseña')}
            </ThemedText>
            {panel === 'closed' ? (
              <SecondaryButton label={t('Gestionar contraseña')} onPress={() => setPanel('menu')} />
            ) : null}
          </View>
        ) : null}

        {account.recoverable && panel === 'menu' ? (
          <View style={[styles.panel, { borderColor: theme.border }]}>
            <ThemedText type="bodyStrong">{t('Gestionar contraseña')}</ThemedText>
            <PrimaryButton label={t('Cambiar contraseña')} onPress={() => setPanel('change')} />
            <SecondaryButton
              label={busy === 'recuperar' ? t('Mandando…') : t('He olvidado mi contraseña')}
              onPress={handlePasswordReset}
            />
            <SecondaryButton label={t('Cancelar')} onPress={closePanel} />
          </View>
        ) : null}

        {account.recoverable && (panel === 'change' || panel === 'recovery') ? (
          <View style={[styles.panel, { borderColor: theme.border }]}>
            <ThemedText type="bodyStrong">
              {panel === 'recovery' ? t('Elige tu nueva contraseña') : t('Cambiar contraseña')}
            </ThemedText>

            {panel === 'change' ? (
              <Field label={t('Contraseña actual')}>
                <TextField
                  value={current}
                  onChangeText={setCurrent}
                  accessibilityLabel={t('Contraseña actual')}
                  placeholder={t('La que usas ahora')}
                  secureTextEntry
                  textContentType="password"
                  autoComplete="current-password"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </Field>
            ) : null}

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

            <View style={styles.actions}>
              <PrimaryButton
                label={busy === 'contrasena' ? t('Guardando…') : t('Guardar contraseña')}
                disabled={busy !== null}
                onPress={handleSavePassword}
              />
              <SecondaryButton label={t('Cancelar')} onPress={closePanel} />
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.block}>
        <ThemedText type="label" themeColor="textSecondary">
          Premium
        </ThemedText>
        <PremiumRow quotas={quotas} onRestored={() => void refreshPremium()} />
      </View>

      <View style={styles.block}>
        {/* Con la cuenta asegurada no queda nada propio bajo este título. */}
        {account.recoverable ? null : (
          <ThemedText type="label" themeColor="textSecondary">
            {t('Cuenta')}
          </ThemedText>
        )}

        {account.recoverable ? null : account.kind === 'pending-email' ? (
          <>
            <ThemedText type="bodyStrong">{t('Falta confirmar tu email')}</ThemedText>
            <ThemedText type="body" themeColor="textSecondary">
              {t(
                'Te hemos mandado un correo a {v}. Pincha el enlace y tu cuenta quedará asegurada.',
                { v: pendingEmail ?? t('tu email') }
              )}
            </ThemedText>
            <ThemedText type="body" themeColor="textSecondary">
              {t('Hasta que lo pinches, tus datos siguen viviendo solo en este teléfono.')}
            </ThemedText>
          </>
        ) : (
          <>
            <ThemedText type="bodyStrong">{t('Tus datos viven solo en este teléfono')}</ThemedText>
            <ThemedText type="body" themeColor="textSecondary">
              {t(
                'Tu perfil, tus matches y tus conversaciones están guardados aquí, en este móvil. Si cambias de teléfono o desinstalas cofounder, no hay forma de traerlos de vuelta.'
              )}
            </ThemedText>
            <ThemedText type="body" themeColor="textSecondary">
              {t(
                'Con un email recuperas tu cuenta desde donde quieras. No creas otra: aseguras la que ya tienes.'
              )}
            </ThemedText>
          </>
        )}

        {waitingForEmail ? (
          <>
            <PrimaryButton label={t('Ya lo he confirmado')} onPress={refresh} />
            <SecondaryButton
              label={busy === 'reenviar' ? t('Mandando…') : t('Reenviar el correo')}
              onPress={handleResend}
            />
            <SecondaryButton label={t('Usar otro email')} onPress={() => setChangingEmail(true)} />
          </>
        ) : null}

        {askingForEmail ? (
          <>
            <Field label={t('Email')} hint={t('Te mandamos un enlace para confirmar que es tuyo.')}>
              <TextField
                value={email}
                onChangeText={setEmail}
                accessibilityLabel={t('Email con el que asegurar tu cuenta')}
                placeholder="tu@email.com"
                keyboardType="email-address"
                inputMode="email"
                textContentType="emailAddress"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </Field>

            <PrimaryButton
              label={busy === 'asegurar' ? t('Mandando el correo…') : t('Asegurar mi cuenta')}
              onPress={handleLink}
            />
          </>
        ) : null}

        {children}

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
              {t('Cerrar sesión aquí te deja sin acceso a tu cuenta')}
            </ThemedText>
            <ThemedText type="body" themeColor="textSecondary">
              {t(
                'Esta cuenta solo existe en este teléfono. Si cierras sesión, perderás el acceso a tu perfil, tus matches y tus conversaciones desde este dispositivo y no podrás recuperarlo.'
              )}
            </ThemedText>
            <ThemedText type="body" themeColor="textSecondary">
              {t(
                'Cerrar sesión no borra tus datos del servidor; para eso está «Eliminar mi cuenta». Si no quieres perder el acceso, asegura antes la cuenta con un email.'
              )}
            </ThemedText>

            <SecondaryButton
              label={
                busy === 'salir' ? t('Cerrando sesión…') : t('Cerrar sesión y perder el acceso')
              }
              tone="danger"
              onPress={() =>
                void run(
                  'salir',
                  () => signOut({ acceptDataLoss: true }),
                  () => {
                    setConfirmingLeave(false);
                    onSignedOut?.();
                  }
                )
              }
            />
            <SecondaryButton label={t('Mejor no')} onPress={() => setConfirmingLeave(false)} />
          </View>
        ) : (
          <SecondaryButton
            label={busy === 'salir' ? t('Cerrando sesión…') : t('Cerrar sesión')}
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
              {t('Eliminar tu cuenta es para siempre')}
            </ThemedText>
            <ThemedText type="body" themeColor="textSecondary">
              {t(
                'Se borran tu perfil, tus matches, tus conversaciones, tus sesiones y tus salas, también para quienes hablaban contigo. No se puede deshacer ni recuperar.'
              )}
            </ThemedText>
            {quotas === null || quotas.isPremium ? (
              <>
                <ThemedText type="body" themeColor="danger">
                  {quotas === null
                    ? t(
                        'No hemos podido comprobar si tienes una suscripción. Si la tienes, no se cancela sola: cancélala en la tienda o se seguirá cobrando.'
                      )
                    : t(
                        'Tu suscripción no se cancela sola: cancélala en la tienda o se seguirá cobrando.'
                      )}
                </ThemedText>
                <SecondaryButton
                  label={t('Gestionar suscripción')}
                  onPress={() => void Linking.openURL(manageSubscriptionsUrl())}
                />
              </>
            ) : null}

            <SecondaryButton
              label={busy === 'borrar' ? t('Eliminando…') : t('Eliminar mi cuenta para siempre')}
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
            <SecondaryButton label={t('Mejor no')} onPress={() => setConfirmingDelete(false)} />
          </View>
        ) : (
          <SecondaryButton
            label={t('Eliminar mi cuenta')}
            tone="danger"
            onPress={() => {
              setConfirmingLeave(false);
              setConfirmingDelete(true);
            }}
          />
        )}

        {notice ? (
          <ThemedText type="body" themeColor={notice.tone}>
            {notice.text}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.four,
  },
  block: {
    gap: Spacing.two,
  },
  passwordRow: {
    gap: Spacing.one,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
