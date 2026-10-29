/**
 * «Continuar con» + el logo de Google o de Apple, dentro de «Ya tengo cuenta» y
 * de «Crea tu cuenta» (2026-10-29; antes estaban sueltos en la bienvenida).
 *
 * Es el mismo botón en las dos pantallas porque hace lo mismo: el proveedor no
 * distingue entre entrar y registrarse. Si la persona ya tiene cuenta con ese
 * Google o ese Apple, la sesión que vuelve es la suya —como si hubiera pulsado
 * «Iniciar sesión»—; si no, GoTrue la crea. Quien lo monta manda a `/`, que
 * decide: con perfil, al deck; sin él, al formulario (con lo que se tecleó en
 * «Sobre ti», si se pasó por ahí).
 *
 * Solo aparecen los que la compilación tiene configurados
 * (`EXPO_PUBLIC_AUTH_PROVIDERS`), y Apple solo en iOS: es donde la norma 4.8 de
 * la App Store lo exige al ofrecer Google, y en Android no aporta nada.
 */

import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { GlassButton } from '@/components/glass-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing, Stroke } from '@/constants/theme';
import { useRepositories } from '@/data';
import { useTheme } from '@/hooks/use-theme';

import { describeAccountError } from './account-copy';
import { accountsAvailable, enabledAuthProviders, signInWithProvider } from './account-gateway';
import { clearPendingPassword } from './pending-password';

type Provider = 'google' | 'apple';

const LOGO_SIZE = 20;

const NAME: Record<Provider, string> = { google: 'Google', apple: 'Apple' };

/** Los proveedores que esta compilación ofrece, en orden. */
export function offeredProviders(): Provider[] {
  if (!accountsAvailable) return [];
  const offered: Provider[] = [];
  if (enabledAuthProviders.has('google')) offered.push('google');
  if (enabledAuthProviders.has('apple') && Platform.OS === 'ios') offered.push('apple');
  return offered;
}

function GoogleLogo() {
  return (
    <Svg width={LOGO_SIZE} height={LOGO_SIZE} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

function AppleLogo({ color }: { color: string }) {
  return (
    <Svg width={LOGO_SIZE} height={LOGO_SIZE} viewBox="0 0 814 1000">
      <Path
        fill={color}
        d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"
      />
    </Svg>
  );
}

export function ProviderButtons({
  /** La sesión ya es la del proveedor (nueva o de siempre): a dónde sigue lo decide el llamador. */
  onSignedIn,
  /** Mientras el formulario de al lado está pidiendo algo, aquí no se pulsa. */
  disabled = false,
}: {
  onSignedIn: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const repositories = useRepositories();
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const providers = offeredProviders();
  if (providers.length === 0) return null;

  async function handle(provider: Provider) {
    if (busy || disabled) return;
    setBusy(provider);
    setError(null);
    try {
      if (!(await signInWithProvider(provider))) return;
      // La sesión es otra (la del proveedor): el modo se guarda en ella, y una
      // contraseña de un alta a medias en este teléfono ya no es de nadie.
      await repositories.session.setActiveMode('par');
      await clearPendingPassword();
      onSignedIn();
    } catch (cause) {
      setError(describeAccountError(cause));
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.root}>
      {providers.map((provider) => (
        <GlassButton
          key={provider}
          label={busy === provider ? `Abriendo ${NAME[provider]}…` : 'Continuar con'}
          icon={
            busy === provider ? null : provider === 'google' ? (
              <GoogleLogo />
            ) : (
              <AppleLogo color="#0A0A0B" />
            )
          }
          accessibilityLabel={`Continuar con ${NAME[provider]}`}
          tint="light"
          disabled={disabled || busy !== null}
          onPress={() => void handle(provider)}
        />
      ))}

      {error ? (
        <ThemedText type="small" themeColor="danger" accessibilityRole="alert">
          {error}
        </ThemedText>
      ) : null}

      <View style={styles.divider}>
        <View style={[styles.line, { backgroundColor: theme.border }]} />
        <ThemedText type="small" themeColor="textSecondary">
          o con tu email
        </ThemedText>
        <View style={[styles.line, { backgroundColor: theme.border }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.three,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  line: {
    flex: 1,
    height: Stroke.hairline,
  },
});
