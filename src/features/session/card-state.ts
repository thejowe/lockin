/** Qué pinta la tarjeta de sesión del chat. Pura: la hora entra como parámetro. */

import { isInJoinWindow, isSessionLive } from '@/data';

import type { LockInSession } from '@/data';

export type CardView =
  | { kind: 'agendar' }
  | { kind: 'esperando'; session: LockInSession }
  | { kind: 'recibida'; session: LockInSession }
  | { kind: 'aceptada'; session: LockInSession }
  | { kind: 'entrar'; session: LockInSession };

export function cardView(
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
