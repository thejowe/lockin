/**
 * Qué pinta la tarjeta de sesión del chat. Pura: la hora entra como parámetro.
 *
 * Recibe dos sesiones —la viva y la que toca valorar— y **la viva gana
 * siempre**: si hay una propuesta o una sesión por empezar, eso es lo accionable
 * ahora y la valoración espera a la repesca siguiente o caduca sin valorar. Un
 * chat no puede pedir dos cosas a la vez sin que una de las dos se ignore.
 */

import { isInJoinWindow, isSessionLive } from '@/data';

import type { LockInSession } from '@/data';

export type CardView =
  | { kind: 'agendar' }
  | { kind: 'esperando'; session: LockInSession }
  | { kind: 'recibida'; session: LockInSession }
  | { kind: 'aceptada'; session: LockInSession }
  | { kind: 'entrar'; session: LockInSession }
  | { kind: 'valorar'; session: LockInSession };

export function cardView(
  live: LockInSession | null,
  ratable: LockInSession | null,
  myProfileId: string | null,
  nowMs: number
): CardView {
  const view = liveView(live, myProfileId, nowMs);
  if (view.kind !== 'agendar') return view;
  return ratable ? { kind: 'valorar', session: ratable } : { kind: 'agendar' };
}

/** Lo que pide la sesión viva, o `agendar` si no hay ninguna que atender. */
function liveView(
  session: LockInSession | null,
  myProfileId: string | null,
  nowMs: number
): CardView {
  if (!session || !isSessionLive(session, nowMs)) return { kind: 'agendar' };
  if (session.status === 'propuesta') {
    return session.proposedBy === myProfileId
      ? { kind: 'esperando', session }
      : { kind: 'recibida', session };
  }
  return isInJoinWindow(session, nowMs)
    ? { kind: 'entrar', session }
    : { kind: 'aceptada', session };
}
