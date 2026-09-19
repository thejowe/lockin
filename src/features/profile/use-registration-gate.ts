/**
 * La puerta del registro obligatorio: ¿puede esta persona seguir con el alta?
 *
 * Decisión del usuario del 2026-09-20 (`docs/plan/todo/perfil.md` → «Decisión
 * de alta»). Pasa quien tiene la cuenta recuperable, o sea, el email
 * confirmado; el resto va a `/register`. Se pregunta al servidor en cada
 * montaje —`useQuery` no guarda nada entre pantallas—, así que ninguna sesión
 * anterior puede dejar la puerta abierta ni cerrada de más.
 *
 * Si la lectura falla se responde `required`, no `open`: sin saber quién es la
 * persona, dejarla pasar sería el fallo que la regla existe para evitar, y la
 * pantalla de registro sabe enseñar el error y reintentar.
 *
 * Sin capa de cuentas (mock) o con la puerta apagada en la compilación
 * (`registrationRequired`), siempre `open`, y sin esperar a nada.
 */

import { useQuery } from '@/data';

import { readAccountState, registrationRequired } from './account-gateway';

export type RegistrationGate = 'checking' | 'required' | 'open';

export function useRegistrationGate(): RegistrationGate {
  const { data: account, loading } = useQuery('account:state', readAccountState);

  if (!registrationRequired) return 'open';
  if (loading) return 'checking';

  return account?.recoverable ? 'open' : 'required';
}
