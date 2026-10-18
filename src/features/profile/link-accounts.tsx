/**
 * «Vincular cuentas» del perfil propio: una fila de logos (decisión del
 * usuario del 2026-10-18). Sustituye a los botones grandes de «Vincular
 * GitHub» / «Vincular LinkedIn».
 *
 * - Logo en sus colores: esa cuenta está vinculada. En gris: no lo está.
 * - Tocar uno gris lo vincula directamente (abre el proveedor). Tocar uno en
 *   color abre debajo su sello y «Desvincular».
 * - Un proveedor que esta compilación no tiene configurado sale en gris con
 *   «Pronto»: tocarlo lo explica en vez de abrir una página de error.
 *
 * Como antes, aquí no se enciende ningún sello: `verifyGithub()` y
 * `verifyLinkedin()` vinculan la identidad OAuth y Postgres lo deriva. El
 * componente no guarda perfil: avisa con `onChange` para que quien lo monta lo
 * relea.
 */

import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Opacity, Radii, Spacing, Stroke } from '@/constants/theme';
import {
  GITHUB_VERIFICATION_CANCELLED,
  LINKEDIN_VERIFICATION_CANCELLED,
  useRepositories,
} from '@/data';
import { useTheme } from '@/hooks/use-theme';

import { Glyph } from './connected-apps';
import { PrimaryButton, SecondaryButton } from './controls';
import { GithubSeal } from './github-seal';
import { LinkedinSeal } from './linkedin-seal';

import type { Profile } from '@/data';

export type LinkableAccount = 'github' | 'linkedin';

const LABELS: Record<LinkableAccount, string> = { github: 'GitHub', linkedin: 'LinkedIn' };

/** Los colores de marca, solo cuando la cuenta está vinculada. */
const LINKEDIN_BLUE = '#0A66C2';

const TILE = 64;

interface Notice {
  text: string;
  tone: 'textSecondary' | 'danger';
}

type Busy = { account: LinkableAccount; action: 'vincular' | 'quitar' } | null;

export function LinkAccounts({
  profile,
  onChange,
  /** Proveedores que esta compilación puede abrir; el resto sale con «Pronto». */
  available = { github: true, linkedin: true },
}: {
  profile: Profile;
  /** Se llama cuando el repositorio ha cambiado el perfil y hay que releerlo. */
  onChange: () => void;
  available?: Record<LinkableAccount, boolean>;
}) {
  const theme = useTheme();
  const repositories = useRepositories();

  const [open, setOpen] = useState<LinkableAccount | null>(null);
  const [confirmingGithub, setConfirmingGithub] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const githubSeal = profile.githubVerification ?? null;
  const linkedinSeal = profile.linkedinVerification ?? null;
  const linked: Record<LinkableAccount, boolean> = {
    github: githubSeal !== null,
    linkedin: linkedinSeal !== null,
  };
  // Sin sello, cualquier enlace de GitHub lo escribió la persona a mano: es lo
  // que vincular le va a sobrescribir.
  const handwrittenGithub = githubSeal ? null : (profile.links.github ?? null);

  async function run(next: NonNullable<Busy>, call: () => Promise<Profile>) {
    if (busy) return;
    setConfirmingGithub(false);
    setBusy(next);
    setNotice(null);
    try {
      await call();
      setOpen(null);
      onChange();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      // Cancelar no es un fallo: la persona cerró el proveedor y no ha cambiado
      // nada. En rojo enseñaría a desconfiar de una pantalla que funcionó.
      const cancelled =
        message === GITHUB_VERIFICATION_CANCELLED || message === LINKEDIN_VERIFICATION_CANCELLED;
      setNotice(
        cancelled
          ? { text: 'No se completó. No ha cambiado nada.', tone: 'textSecondary' }
          : { text: message, tone: 'danger' }
      );
    } finally {
      setBusy(null);
    }
  }

  function link(account: LinkableAccount) {
    if (account === 'github') {
      void run({ account, action: 'vincular' }, () => repositories.profiles.verifyGithub());
    } else {
      void run({ account, action: 'vincular' }, () => repositories.profiles.verifyLinkedin());
    }
  }

  function unlink(account: LinkableAccount) {
    if (account === 'github') {
      void run({ account, action: 'quitar' }, () => repositories.profiles.unverifyGithub());
    } else {
      void run({ account, action: 'quitar' }, () => repositories.profiles.unverifyLinkedin());
    }
  }

  function handlePress(account: LinkableAccount) {
    if (busy) return;
    setNotice(null);
    setConfirmingGithub(false);
    if (linked[account]) {
      setOpen((current) => (current === account ? null : account));
      return;
    }
    setOpen(null);
    if (!available[account]) {
      setNotice({
        text: `Vincular ${LABELS[account]} todavía no está disponible.`,
        tone: 'textSecondary',
      });
      return;
    }
    if (account === 'github' && handwrittenGithub) {
      // En la propia pantalla, no en un diálogo del sistema: un modal
      // bloqueante deja la app sin responder a nada más.
      setConfirmingGithub(true);
      return;
    }
    link(account);
  }

  const accounts: LinkableAccount[] = ['github', 'linkedin'];

  return (
    <View style={styles.root}>
      <ThemedText type="label" themeColor="textSecondary">
        Vincular cuentas
      </ThemedText>

      <View style={styles.row}>
        {accounts.map((account) => {
          const isLinked = linked[account];
          const isBusy = busy?.account === account;
          const caption = isLinked ? 'Vinculado' : available[account] ? LABELS[account] : 'Pronto';
          return (
            <View key={account} style={styles.cell}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  isLinked ? `${LABELS[account]} vinculado` : `Vincular ${LABELS[account]}`
                }
                accessibilityState={{
                  selected: isLinked,
                  busy: isBusy,
                  disabled: busy !== null,
                }}
                disabled={busy !== null}
                onPress={() => handlePress(account)}
                style={({ pressed }) => [
                  styles.tile,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: isLinked ? theme.textSecondary : theme.border,
                    opacity: pressed ? Opacity.pressed : 1,
                  },
                ]}>
                {isBusy ? (
                  <ActivityIndicator color={theme.text} />
                ) : (
                  <View style={isLinked ? null : styles.dimmed}>
                    <Glyph
                      app={account}
                      size={30}
                      color={
                        isLinked
                          ? account === 'linkedin'
                            ? LINKEDIN_BLUE
                            : theme.text
                          : theme.textSecondary
                      }
                      cutout={isLinked && account === 'linkedin' ? '#FFFFFF' : undefined}
                    />
                  </View>
                )}
              </Pressable>
              <ThemedText type="small" themeColor={isLinked ? 'text' : 'textSecondary'}>
                {caption}
              </ThemedText>
            </View>
          );
        })}
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        Toca un logo para vincular esa cuenta. Los vinculados salen en color y con su sello en tu
        tarjeta.
      </ThemedText>

      {confirmingGithub && handwrittenGithub ? (
        <View
          style={[
            styles.panel,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}>
          <ThemedText type="bodyStrong">Vas a sustituir el enlace que escribiste</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Tu ficha enseña ahora:
          </ThemedText>
          <ThemedText type="mono">{handwrittenGithub}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Al vincular pasará a enseñar la cuenta con la que entres en GitHub, sea cual sea.
          </ThemedText>
          <PrimaryButton label="Continuar y sobrescribir" onPress={() => link('github')} />
          <SecondaryButton label="Dejarlo como está" onPress={() => setConfirmingGithub(false)} />
        </View>
      ) : null}

      {open === 'github' && githubSeal ? (
        <View
          style={[
            styles.panel,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}>
          <GithubSeal handle={githubSeal.handle} />
          <ThemedText type="small" themeColor="textSecondary">
            Certifica que el enlace de GitHub de tu ficha es tuyo, y nada más: no dice quién eres ni
            lo bueno que seas.
          </ThemedText>
          <SecondaryButton
            label={busy?.action === 'quitar' ? 'Quitando…' : 'Desvincular GitHub'}
            disabled={busy !== null}
            onPress={() => unlink('github')}
          />
        </View>
      ) : null}

      {open === 'linkedin' && linkedinSeal ? (
        <View
          style={[
            styles.panel,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}>
          <LinkedinSeal name={linkedinSeal.name} />
          <ThemedText type="small" themeColor="textSecondary">
            Certifica que esa cuenta de LinkedIn es tuya, y nada más.
          </ThemedText>
          <SecondaryButton
            label={busy?.action === 'quitar' ? 'Quitando…' : 'Desvincular LinkedIn'}
            disabled={busy !== null}
            onPress={() => unlink('linkedin')}
          />
        </View>
      ) : null}

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
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.four,
  },
  cell: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: Radii.medium,
    borderWidth: Stroke.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimmed: {
    opacity: Opacity.disabled,
  },
  panel: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radii.medium,
    borderWidth: Stroke.hairline,
  },
});
