/**
 * El único punto del bloque `perfil` que habla con la capa de cuentas.
 *
 * Las pantallas piden datos a `@/data` y nunca a `@/data/supabase`: es la regla
 * que permite cambiar de backend sin tocarlas. La cuenta es la excepción, y
 * está aislada aquí a propósito. El contrato de `src/data/repositories.ts` no
 * tiene login —`SessionRepository` solo habla de modo activo y de perfil
 * propio—, así que no hay forma de preguntarle por el estado de la cuenta, y la
 * orden `P1` prohíbe tocar `src/data/` para ampliarlo. Concentrando la
 * excepción en un archivo, el día que la cuenta entre en `Repositories` solo
 * cambia este: los componentes ya importan de aquí.
 *
 * `readAccountState()` es lo único que envuelve algo. Sin credenciales la app
 * corre contra el mock en memoria, donde no existe ninguna cuenta que asegurar
 * y `getSupabaseClient()` lanza; ahí devuelve `null`, que la sección lee como
 * «en esta ejecución no hay capa de cuentas» y no pinta nada. El resto sale tal
 * cual de `@/data/supabase`, con su nombre original, para que buscar
 * `linkEmailToCurrentUser` siga encontrando las dos puntas del mismo cable.
 */

import { getAccountState } from '@/data/supabase';
import { hasSupabaseCredentials } from '@/data/supabase/client';

import type { AccountState } from '@/data/supabase';

export {
  AccountError,
  completeAuthLink,
  linkEmailToCurrentUser,
  sendPasswordReset,
  setAccountPassword,
  signInWithEmail,
  signOut,
} from '@/data/supabase';
export type { AccountErrorReason, AccountKind, AccountState } from '@/data/supabase';

/**
 * Si esta ejecución tiene capa de cuentas que ofrecer.
 *
 * Es lo que decide si el onboarding enseña «Ya tengo cuenta»: sin credenciales
 * de Supabase la app corre contra el mock en memoria, donde no hay ningún
 * servidor al que entrar y `getSupabaseClient()` lanzaría al pulsarlo.
 */
export const accountsAvailable = hasSupabaseCredentials;

/**
 * Si el alta exige una cuenta con email confirmado antes de crear el perfil.
 *
 * Decisión del usuario del 2026-09-20 (`docs/plan/todo/perfil.md` → «Decisión
 * de alta»): el registro es obligatorio. Solo tiene sentido con capa de cuentas;
 * sin ella no hay servidor al que registrarse y la puerta no existe.
 *
 * `EXPO_PUBLIC_REQUIRE_ACCOUNT=false` la apaga **en tiempo de compilación** y
 * existe por una sola razón: el E2E de la variante `supabase` recorre el alta de
 * verdad contra un Postgres desechable y no tiene un buzón en el que pinchar el
 * enlace de confirmación. Una build de usuario no lleva esa variable.
 */
export const registrationRequired =
  accountsAvailable && process.env.EXPO_PUBLIC_REQUIRE_ACCOUNT !== 'false';

/**
 * El estado de la cuenta, o `null` si esta ejecución no tiene capa de cuentas.
 *
 * `null` no es un fallo: es el arranque de desarrollo sin `.env.local`, donde
 * los datos ya son de mentira y no hay nada que recuperar.
 */
export async function readAccountState(): Promise<AccountState | null> {
  if (!hasSupabaseCredentials) return null;
  return getAccountState();
}
