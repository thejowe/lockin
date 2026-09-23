/**
 * «Ya tengo cuenta»: entrar con email y contraseña desde el onboarding.
 *
 * Existe para quien reinstala o cambia de móvil: la app le abre una cuenta
 * anónima nueva y sin esto no tendría forma de volver a la suya. Es un camino
 * **opcional** —nada del onboarding lo exige, y `docs/plan/CONCEPTO.md` sigue
 * defendiendo el arranque sin fricción—, y sin credenciales de Supabase ni
 * siquiera se ofrece (lo decide quien monta la ruta con `accountsAvailable`).
 *
 * ## Entrar en otra cuenta abandona esta
 *
 * `signInWithPassword` reemplaza la sesión. Si la cuenta de este dispositivo es
 * anónima y ya tiene perfil, ese perfil, sus matches y sus chats se quedan
 * huérfanos: nadie puede volver a ese `auth.uid()`. Por eso, antes de entrar, se
 * pregunta al servidor —no a una consulta cacheada, que podría venir de otra
 * cuenta— y, si hay algo que perder, se pide confirmación en la propia pantalla
 * (igual que el aviso de cerrar sesión en `account-section.tsx`).
 *
 * ## Qué pasa después
 *
 * Esta pantalla no decide a dónde sigue la persona: avisa con `onSignedIn` y
 * quien la monta manda a la puerta de entrada (`src/app/index.tsx`), que relee
 * `session:onboarded` desde cero. Así no hay una segunda copia de la regla
 * «perfil → tabs, sin perfil → onboarding», y ninguna pantalla montada antes
 * del login puede seguir enseñando datos de la cuenta anterior.
 *
 * ## El copy
 *
 * «Entrar» y no «Iniciar sesión / Registrarse»: aquí nadie crea nada. Y el
 * correo de recuperación no dice si el email existe, igual que
 * `sendPasswordReset` — responder distinto le contaría a cualquiera quién
 * tiene cuenta en LockIn.
 *
 * El texto de cada fallo lo pone `account-copy.ts`, compartido con el resto del
 * bloque. Importa sobre todo aquí: quedarse sin red es el fallo más probable en
 * un móvil de verdad, y es justo el que no puede leerse como «me he equivocado
 * de contraseña». Ojo, porque llega por dos caminos distintos —el login, que sí
 * pasa por `toAccountError`, y la consulta del perfil que se abandonaría, que
 * rechaza con el `TypeError` crudo del runtime—, y los dos tienen que contarse
 * igual.
 */

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useRepositories } from '@/data';
import { useTheme } from '@/hooks/use-theme';

import { describeAccountError } from './account-copy';
import { readAccountState, sendPasswordReset, signInWithEmail } from './account-gateway';
import { Field, PrimaryButton, SecondaryButton, TextField } from './controls';

/** Qué se le está pidiendo al servidor ahora mismo, si es que se le pide algo. */
type Busy = 'entrar' | 'recuperar' | null;

/** Aviso bajo los controles: neutro para lo que salió bien, `danger` para lo que no. */
interface Notice {
  text: string;
  tone: 'textSecondary' | 'danger';
}

export function SignInForm({
  /** La sesión ya es la de la otra cuenta: a dónde sigue la persona lo decide el llamador. */
  onSignedIn,
  /** Volver sin haber entrado. */
  onCancel,
}: {
  onSignedIn: () => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  const repositories = useRepositories();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  /**
   * ¿Entrar aquí deja atrás un perfil que no se puede recuperar?
   *
   * Se pregunta en el momento y sin pasar por `useQuery`: la caché es por `key`
   * y esta es justo la decisión que no puede apoyarse en un dato de otra cuenta.
   */
  async function abandonsUnrecoverableProfile(): Promise<boolean> {
    const [account, profile] = await Promise.all([
      readAccountState(),
      repositories.profiles.getCurrent(),
    ]);
    return account !== null && account.kind !== 'none' && !account.recoverable && profile !== null;
  }

  async function enter(address: string) {
    setBusy('entrar');
    setNotice(null);

    try {
      await signInWithEmail(address, password);
      onSignedIn();
    } catch (cause) {
      setNotice({ text: describeAccountError(cause), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  }

  async function handleEnter() {
    if (busy) return;

    const address = email.trim();
    if (!address || !password) {
      setNotice({ text: 'Escribe tu email y tu contraseña.', tone: 'danger' });
      return;
    }

    setBusy('entrar');
    setNotice(null);

    try {
      if (await abandonsUnrecoverableProfile()) {
        setConfirmingLeave(true);
        setBusy(null);
        return;
      }
    } catch (cause) {
      // Sin poder comprobarlo no se entra: perder un perfil sin avisar es peor
      // que pedir que se reintente.
      setNotice({ text: describeAccountError(cause), tone: 'danger' });
      setBusy(null);
      return;
    }

    setBusy(null);
    await enter(address);
  }

  async function handleForgot() {
    if (busy) return;

    const address = email.trim();
    if (!address) {
      setNotice({
        text: 'Escribe tu email y te mandamos un correo para cambiar la contraseña.',
        tone: 'danger',
      });
      return;
    }

    setBusy('recuperar');
    setNotice(null);

    try {
      await sendPasswordReset(address);
      setNotice({
        text: 'Si ese email tiene una cuenta, te hemos mandado un correo para cambiar la contraseña.',
        tone: 'textSecondary',
      });
    } catch (cause) {
      setNotice({ text: describeAccountError(cause), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <ThemedText type="label" themeColor="brass">
          Ya tengo cuenta
        </ThemedText>
        <ThemedText type="title">Vuelve a tu cuenta</ThemedText>
        <ThemedText type="body" themeColor="textSecondary">
          Entra con el email y la contraseña que pusiste al asegurar tu cuenta y recuperas tu
          perfil, tus matches y tus conversaciones.
        </ThemedText>
      </View>

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

      <Field label="Contraseña">
        <TextField
          value={password}
          onChangeText={setPassword}
          accessibilityLabel="Contraseña de tu cuenta"
          placeholder="Tu contraseña"
          secureTextEntry
          textContentType="password"
          autoComplete="current-password"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </Field>

      {confirmingLeave ? (
        // En la propia pantalla y no en un diálogo del sistema, como el aviso
        // de cerrar sesión: un modal bloqueante deja la app sin responder.
        <View
          style={[
            styles.confirm,
            { backgroundColor: theme.dangerSoft, borderColor: theme.danger },
          ]}>
          <ThemedText type="bodyStrong" themeColor="danger">
            Entrar aquí deja atrás el perfil de este teléfono
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            La cuenta de este teléfono no tiene email, así que tu perfil, tus matches y tus
            conversaciones de ahora solo existen aquí. Si entras en la otra cuenta, no hay forma de
            volver a ellos.
          </ThemedText>

          <SecondaryButton
            label={busy === 'entrar' ? 'Entrando…' : 'Entrar y dejar este perfil'}
            tone="danger"
            onPress={() => {
              if (busy) return;
              setConfirmingLeave(false);
              void enter(email.trim());
            }}
          />
          <SecondaryButton label="Mejor no" onPress={() => setConfirmingLeave(false)} />
        </View>
      ) : (
        <PrimaryButton
          label={busy === 'entrar' ? 'Entrando…' : 'Entrar'}
          disabled={busy !== null}
          onPress={() => void handleEnter()}
        />
      )}

      {notice ? (
        <ThemedText type="small" themeColor={notice.tone} accessibilityRole="alert">
          {notice.text}
        </ThemedText>
      ) : null}

      <SecondaryButton
        label={busy === 'recuperar' ? 'Mandando…' : 'He olvidado mi contraseña'}
        onPress={() => void handleForgot()}
      />
      <SecondaryButton label="Volver" onPress={onCancel} />
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
  confirm: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radii.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
