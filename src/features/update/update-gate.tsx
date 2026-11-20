import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { AppState, Linking, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { MessageState } from '@/components/state-view';
import { useQuery, useRepositories } from '@/data';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

const STORE_URL = Platform.select({
  ios: 'https://apps.apple.com/app/id6828604279',
  default: 'https://play.google.com/store/apps/details?id=app.cofounder.android',
});

/** Versión instalada: en iOS manda `ios.version` de app.json (CFBundleShortVersionString). */
export function currentAppVersion(): string | null {
  const config = Constants.expoConfig;
  return (Platform.OS === 'ios' ? config?.ios?.version : undefined) ?? config?.version ?? null;
}

function parse(version: string): number[] | null {
  const parts = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  return parts ? parts.slice(1).map(Number) : null;
}

/** ¿Está `current` por debajo de `minimum`? Ante una versión ilegible, no se bloquea a nadie. */
export function isOutdated(current: string | null, minimum: string | null): boolean {
  const have = current && parse(current);
  const need = minimum && parse(minimum);
  if (!have || !need) return false;
  for (let i = 0; i < 3; i++) {
    if (have[i] !== need[i]) return have[i] < need[i];
  }
  return false;
}

/**
 * Tapa la app entera cuando el servidor exige una versión más nueva
 * (`app_config.min_ios_version` / `min_android_version`; en web no hay). Se monta encima de la navegación, dentro de
 * `DataProvider`, y no deja hacer nada más que ir a la tienda.
 */
export function UpdateGate({ version = currentAppVersion() }: { version?: string | null }) {
  const { appConfig } = useRepositories();
  const theme = useTheme();
  const { data: minimum, refresh } = useQuery('app-config:min-version', () =>
    appConfig.minAppVersion()
  );
  const [linkError, setLinkError] = useState(false);
  // Se vuelve a mirar al volver a la app: tras arrancar sin red, o si el servidor la cambia.
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => listener.remove();
  }, [refresh]);
  if (!isOutdated(version, minimum ?? null)) return null;
  return (
    <View
      style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: theme.background }]}
      accessibilityViewIsModal>
      <MessageState
        title={t('Hay una versión nueva de cofounder')}
        body={t('Actualiza la app para seguir usándola. Esta versión ya no es compatible.')}
        detail={linkError ? t('No se ha podido abrir la tienda.') : undefined}>
        <Button
          label={t('Actualizar')}
          onPress={() => {
            setLinkError(false);
            void Linking.openURL(STORE_URL).catch(() => setLinkError(true));
          }}
        />
      </MessageState>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { justifyContent: 'center', zIndex: 1000 },
});
