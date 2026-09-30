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
 *
 * ## La URL llega por prop, no de `Linking.useURL()`
 *
 * `useURL()` empieza por `getInitialURL()` —la URL con la que se ABRIÓ la app— y
 * solo oye los eventos `url` posteriores a montarse. Con la app ya abierta, que
 * es lo normal al volver del cliente de correo, expo-router consume ese evento
 * para navegar hasta aquí antes de que esta pantalla exista: `useURL()` se
 * quedaba en `null` y la pantalla en «Un momento…» para siempre. Lo destapó el
 * E2E de la variante `registro` (run 35658934499). La ruta lee los parámetros
 * del router, que llegan igual en frío que en caliente, y los pasa con
 * `authLinkFromParams`.
 */

import { useEffect, useRef, useState } from 'react';

import { LoadingState, MessageState } from '@/components/state-view';

import { describeAccountError } from './account-copy';
import { completeAuthLink } from './account-gateway';
import { SecondaryButton } from './controls';

/** Los parámetros que `completeAuthLink` sabe leer de un enlace de cuenta. */
const AUTH_LINK_PARAMS = ['code', 'token_hash', 'type', 'error', 'error_description'] as const;

/**
 * Rehace el enlace a partir de los parámetros de la ruta, o `null` si no trae
 * ninguno de los que `completeAuthLink` lee —entonces no hay nada que canjear.
 */
export function authLinkFromParams(
  params: Record<string, string | string[] | undefined>
): string | null {
  const query = new URLSearchParams();
  for (const key of AUTH_LINK_PARAMS) {
    const value = params[key];
    const first = Array.isArray(value) ? value[0] : value;
    if (first) query.set(key, first);
  }
  const search = query.toString();
  return search ? `lockin://auth/callback?${search}` : null;
}

export function AuthCallback({
  /** El enlace del correo, o `null` mientras no haya llegado. */
  url,
  /** A dónde sigue la persona: con el enlace aplicado, o tras un enlace roto. */
  onDone,
}: {
  url: string | null;
  onDone: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  useEffect(() => {
    if (!url || handled.current) return;
    handled.current = true;

    completeAuthLink(url).then(
      () => onDone(),
      (cause: unknown) => {
        // Por `account-copy` y no por `cause.message`: `completeAuthLink` sí
        // escribe en español lo que sabe explicar (el enlace caducado, el que
        // no trae código), pero lo que le rebota el canje del `code` es el
        // texto inglés de GoTrue.
        setError(describeAccountError(cause));
      }
    );
  }, [url, onDone]);

  if (error) {
    return (
      <MessageState
        eyebrow="Cuenta"
        title="Ese enlace no ha funcionado"
        body={error}
        detail="Tu cuenta no ha cambiado. Puedes pedir otro correo desde tu perfil.">
        <SecondaryButton label="Volver a mi perfil" onPress={onDone} />
      </MessageState>
    );
  }

  return <LoadingState label="Un momento…" detail="Estamos aplicando el enlace de tu correo." />;
}
