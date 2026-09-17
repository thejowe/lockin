/**
 * La vuelta del enlace que Supabase manda por correo.
 *
 * Los dos correos de la cuenta —confirmar el email y cambiar la contraseña—
 * terminan en `lockin://auth/callback`. Sin nadie que recoja ese enlace, quien
 * lo pincha aterriza en la pantalla de «ruta no encontrada» de expo-router, y
 * una recuperación de contraseña se queda directamente a medias: es el canje
 * del `code` lo que abre la sesión en la que después se pone la nueva.
 *
 * El trabajo de verdad lo hace `completeAuthLink`, que ya distingue las dos
 * formas del enlace (`?code=` de PKCE y `?token_hash=&type=`) y traduce los
 * enlaces caducados. Aquí solo se le pasa la URL una vez —`handled` evita que
 * un segundo render intente canjear un código de un solo uso ya gastado— y se
 * enseña el resultado.
 */

import * as Linking from 'expo-linking';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

import { completeAuthLink } from './account-gateway';
import { SecondaryButton } from './controls';

export function AuthCallback({
  /** A dónde sigue la persona: con el enlace aplicado, o tras un enlace roto. */
  onDone,
}: {
  onDone: () => void;
}) {
  const url = Linking.useURL();
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  useEffect(() => {
    if (!url || handled.current) return;
    handled.current = true;

    completeAuthLink(url).then(
      () => onDone(),
      (cause: unknown) => {
        setError(cause instanceof Error ? cause.message : 'Ese enlace no ha funcionado.');
      }
    );
  }, [url, onDone]);

  if (error) {
    return (
      <View style={styles.root}>
        <ThemedText type="subtitle">Ese enlace no ha funcionado</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {error}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Tu cuenta no ha cambiado. Puedes pedir otro correo desde tu perfil.
        </ThemedText>
        <SecondaryButton label="Volver a mi perfil" onPress={onDone} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ThemedText type="subtitle">Un momento…</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Estamos aplicando el enlace de tu correo.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
});
