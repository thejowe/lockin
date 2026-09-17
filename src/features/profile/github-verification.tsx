/**
 * Panel de verificación de GitHub del perfil propio.
 *
 * Es el ÚNICO punto de la app con acción de verificar: en la ficha ajena y en
 * la tarjeta del deck el sello solo se mira.
 *
 * El panel no guarda perfil: lo recibe ya resuelto y avisa con `onChange`
 * cuando el repositorio lo ha cambiado, para que quien lo monta lo relea. Si
 * guardara su propia copia habría dos versiones del mismo dato en pantalla.
 *
 * Y sobre todo: aquí no se enciende ningún sello. `verifyGithub()` lo deriva de
 * una identidad OAuth real y lo escribe Postgres; el cliente solo pide la
 * sincronización y pinta lo que vuelve (ver la spec, «Por qué la verdad se
 * deriva en el servidor»).
 */

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { GITHUB_VERIFICATION_CANCELLED, useRepositories } from '@/data';
import { useTheme } from '@/hooks/use-theme';

import { PrimaryButton, SecondaryButton } from './controls';

import type { Profile } from '@/data';

/** Qué se está pidiendo al repositorio ahora mismo, si es que se está pidiendo algo. */
type Busy = 'verificar' | 'quitar' | null;

/** Aviso bajo los botones: neutro para lo que no ha salido mal, `danger` para lo que sí. */
interface Notice {
  text: string;
  tone: 'textSecondary' | 'danger';
}

export function GithubVerification({
  profile,
  /** Se llama cuando el repositorio ha cambiado el perfil y hay que releerlo. */
  onChange,
}: {
  profile: Profile;
  onChange: () => void;
}) {
  const theme = useTheme();
  const repositories = useRepositories();

  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const seal = profile.githubVerification;
  // Sin sello, cualquier enlace que haya lo escribió la persona a mano: es lo
  // que verificar le va a sobrescribir.
  const handwrittenLink = seal ? null : (profile.links.github ?? null);

  async function run(action: Busy, call: () => Promise<Profile>) {
    if (busy) return;

    setConfirming(false);
    setBusy(action);
    setNotice(null);

    try {
      await call();
      onChange();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      // Cancelar no es un fallo: la persona cerró GitHub y no ha cambiado nada.
      // Presentarlo en rojo enseña a desconfiar de una pantalla que funcionó.
      setNotice(
        message === GITHUB_VERIFICATION_CANCELLED
          ? { text: 'La verificación no se completó. No ha cambiado nada.', tone: 'textSecondary' }
          : { text: message, tone: 'danger' }
      );
    } finally {
      setBusy(null);
    }
  }

  function handleVerify() {
    if (handwrittenLink) {
      setConfirming(true);
      return;
    }
    void run('verificar', () => repositories.profiles.verifyGithub());
  }

  return (
    <View style={styles.root}>
      <ThemedText type="label" themeColor="brass">
        Verificación
      </ThemedText>

      {seal ? (
        // El sello no puede ser solo un icono: sin `accessibilityLabel`, quien
        // navega con lector de pantalla no oye nada.
        <View
          accessible
          accessibilityLabel={`GitHub verificado: ${seal.handle}`}
          style={[styles.seal, { backgroundColor: theme.brassSoft }]}>
          <ThemedText type="bodyStrong" themeColor="brass">
            {`✓ @${seal.handle} · verificado`}
          </ThemedText>
        </View>
      ) : null}

      <ThemedText type="small" themeColor="textSecondary">
        {seal
          ? 'Certifica que el enlace de GitHub de tu ficha es tuyo, y nada más: no dice quién eres ni lo bueno que seas.'
          : 'Puedes probar que el enlace de GitHub de tu ficha es tuyo. Es opcional y no cambia tu sitio en el deck.'}
      </ThemedText>

      {confirming && handwrittenLink ? (
        // En la propia pantalla, no en un diálogo del sistema: un modal
        // bloqueante deja la app sin responder a nada más.
        <View
          style={[
            styles.confirm,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}>
          <ThemedText type="bodyStrong">Vas a sustituir el enlace que escribiste</ThemedText>

          <ThemedText type="small" themeColor="textSecondary">
            Tu ficha enseña ahora:
          </ThemedText>
          <ThemedText type="mono">{handwrittenLink}</ThemedText>

          <ThemedText type="small" themeColor="textSecondary">
            Al verificar pasará a enseñar la cuenta con la que entres en GitHub, sea cual sea.
          </ThemedText>

          <PrimaryButton
            label="Continuar y sobrescribir"
            onPress={() => void run('verificar', () => repositories.profiles.verifyGithub())}
          />
          <SecondaryButton label="Dejarlo como está" onPress={() => setConfirming(false)} />
        </View>
      ) : null}

      {seal ? (
        <SecondaryButton
          label={busy === 'quitar' ? 'Quitando…' : 'Quitar verificación'}
          onPress={() => void run('quitar', () => repositories.profiles.unverifyGithub())}
        />
      ) : confirming ? null : (
        <PrimaryButton
          label={busy === 'verificar' ? 'Abriendo GitHub…' : 'Verificar con GitHub'}
          onPress={handleVerify}
          disabled={busy !== null}
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
  seal: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.pill,
  },
  confirm: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radii.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
