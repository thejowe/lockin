/**
 * Sesiones Lock-In del backend mock.
 *
 * A diferencia del resto del mock, se construye para un actor: la suite de
 * contrato necesita a la otra persona del match aceptando una propuesta, y en
 * memoria no hay sesiones de verdad que abrir. La app usa siempre
 * `CURRENT_USER_ID`; los tests crean también el repositorio del otro lado.
 *
 * El store es el segundo argumento y por defecto es el compartido: los dos
 * actores de un test tienen que ver los mismos datos, así que pasarles el mismo
 * store es justo lo que los pone en el mismo match.
 */

import {
  SessionConflictError,
  SessionExpiredError,
  SessionForbiddenError,
  SessionWindowError,
} from '../session-errors';
import {
  attendedSession,
  isInJoinWindow,
  isInRatingWindow,
  isSessionBlocks,
  isSessionLive,
  isValidStartsAt,
} from '../sessions';
import { pairStreak } from '../streaks';
import { defaultMockStore } from './store';

import type { MockStore } from './store';
import type { LockInSessionRepository } from '../repositories';
import type { LockInSession, SessionAttendance, SessionRatingEntry } from '../types';

export const sessionsTopic = (matchId: string) => `sessions:${matchId}`;

const iso = (ms: number) => new Date(ms).toISOString();

export function createMockSessionRepository(
  actorId: string,
  store: MockStore = defaultMockStore
): LockInSessionRepository {
  const getState = () => store.state;
  const createId = (prefix: string) => store.createId(prefix);
  const mockNowMs = () => store.nowMs();
  const notify = (topic: string) => store.notify(topic);
  const subscribeTo = (topic: string, listener: () => void) => store.subscribeTo(topic, listener);

  const membersOf = (matchId: string): readonly string[] =>
    getState().matches.find((match) => match.id === matchId)?.profileIds ?? [];

  /**
   * Entraron las dos personas del match antes de que la sesión acabara. Es la
   * regla 4 de la spec: sin las dos no hubo sesión, así que no se pregunta nada.
   * Un match tiene siempre exactamente dos miembros.
   */
  const bothAttended = (session: LockInSession): boolean => {
    const rows = getState().attendance.filter((row) => row.sessionId === session.id);
    return membersOf(session.matchId).every((profileId) =>
      attendedSession(rows, profileId, session)
    );
  };

  const isMember = (matchId: string) => membersOf(matchId).includes(actorId);

  /** La sesión si existe y es de un match del actor; si no, como si no existiera. */
  const visible = (sessionId: string): LockInSession | null =>
    getState().lockInSessions.find(
      (session) => session.id === sessionId && isMember(session.matchId)
    ) ?? null;

  const mustSee = (sessionId: string): LockInSession => {
    const session = visible(sessionId);
    if (!session) throw new SessionForbiddenError('La sesión no existe o no es de tus matches');
    return session;
  };

  /** Avisa a los suscriptores del match y devuelve una copia, nunca el objeto del estado. */
  const changed = <T extends object>(matchId: string, value: T): T => {
    notify(sessionsTopic(matchId));
    return { ...value };
  };

  return {
    async getActive(matchId) {
      if (!isMember(matchId)) return null;
      const now = mockNowMs();
      const live = getState().lockInSessions.find(
        (session) => session.matchId === matchId && isSessionLive(session, now)
      );
      return live ? { ...live } : null;
    },

    async getById(sessionId) {
      const session = visible(sessionId);
      return session ? { ...session } : null;
    },

    async propose({ matchId, startsAt, blocks }) {
      if (!isMember(matchId)) throw new SessionForbiddenError('El match no es tuyo');
      const now = mockNowMs();
      const startsAtMs = Date.parse(startsAt);
      if (!isSessionBlocks(blocks) || !isValidStartsAt(startsAtMs, now)) {
        throw new SessionWindowError('Hora o duración fuera de rango');
      }
      const state = getState();
      if (state.lockInSessions.some((s) => s.matchId === matchId && isSessionLive(s, now))) {
        throw new SessionConflictError('Ya hay una sesión viva en este match');
      }
      const session: LockInSession = {
        id: createId('session'),
        matchId,
        proposedBy: actorId,
        startsAt: iso(startsAtMs),
        blocks,
        status: 'propuesta',
        createdAt: iso(now),
        respondedAt: null,
      };
      state.lockInSessions.push(session);
      return changed(matchId, session);
    },

    async respond(sessionId, answer) {
      const session = mustSee(sessionId);
      if (session.proposedBy === actorId) {
        throw new SessionForbiddenError('No puedes responder a tu propia propuesta');
      }
      if (session.status !== 'propuesta') throw new SessionConflictError('Ya se respondió');
      const now = mockNowMs();
      if (now >= Date.parse(session.startsAt)) throw new SessionExpiredError('La propuesta caducó');
      Object.assign(session, { status: answer, respondedAt: iso(now) });
      return changed(session.matchId, session);
    },

    async cancel(sessionId) {
      const session = mustSee(sessionId);
      if (session.status !== 'propuesta' && session.status !== 'aceptada') {
        throw new SessionConflictError('La sesión ya no se puede cancelar');
      }
      const now = mockNowMs();
      if (now >= Date.parse(session.startsAt)) throw new SessionExpiredError('Ya ha empezado');
      Object.assign(session, { status: 'cancelada', respondedAt: iso(now) });
      return changed(session.matchId, session);
    },

    async join(sessionId) {
      const session = mustSee(sessionId);
      const now = mockNowMs();
      if (!isInJoinWindow(session, now)) {
        throw new SessionWindowError('Fuera de la ventana de entrada');
      }
      const attendance = getState().attendance;
      const existing = attendance.find(
        (row) => row.sessionId === sessionId && row.profileId === actorId
      );
      if (existing) {
        existing.leftAt = null;
        return changed(session.matchId, existing);
      }
      const row: SessionAttendance = {
        sessionId,
        profileId: actorId,
        joinedAt: iso(now),
        leftAt: null,
      };
      attendance.push(row);
      return changed(session.matchId, row);
    },

    async leave(sessionId) {
      const session = mustSee(sessionId);
      const existing = getState().attendance.find(
        (row) => row.sessionId === sessionId && row.profileId === actorId
      );
      if (!existing) throw new SessionWindowError('No habías entrado en la sesión');
      existing.leftAt = iso(mockNowMs());
      return changed(session.matchId, existing);
    },

    async listAttendance(sessionId) {
      if (!visible(sessionId)) return [];
      return getState()
        .attendance.filter((row) => row.sessionId === sessionId)
        .map((row) => ({ ...row }));
    },

    async getRatable(matchId) {
      if (!isMember(matchId)) return null;
      const now = mockNowMs();
      const state = getState();
      const candidates = state.lockInSessions
        .filter((session) => session.matchId === matchId && isInRatingWindow(session, now))
        .filter((session) => bothAttended(session))
        .filter(
          (session) =>
            !state.ratings.some(
              (entry) => entry.sessionId === session.id && entry.profileId === actorId
            )
        )
        .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt));
      return candidates[0] ? { ...candidates[0] } : null;
    },

    async getMyRating(sessionId) {
      if (!visible(sessionId)) return null;
      const entry = getState().ratings.find(
        (row) => row.sessionId === sessionId && row.profileId === actorId
      );
      return entry ? entry.rating : null;
    },

    async rate(sessionId, rating) {
      const session = mustSee(sessionId);
      // El estado se mira aparte de la ventana: una sesión cancelada o rechazada
      // no es "fuera de plazo", es una sesión que nunca se pudo valorar (LI004).
      if (session.status !== 'aceptada') {
        throw new SessionForbiddenError('La sesión no llegó a celebrarse');
      }
      const now = mockNowMs();
      if (!isInRatingWindow(session, now)) {
        throw new SessionWindowError('La sesión no ha terminado, o ya pasaron 24 horas');
      }
      if (!bothAttended(session)) {
        throw new SessionForbiddenError('Solo se valora una sesión a la que entrasteis los dos');
      }
      const ratings = getState().ratings;
      const existing = ratings.find(
        (row) => row.sessionId === sessionId && row.profileId === actorId
      );
      if (existing) {
        // Repetir el mismo toque es idempotente; cambiarlo, no: queda escrita.
        if (existing.rating !== rating) throw new SessionConflictError('Ya valoraste esta sesión');
        return { ...existing };
      }
      const row: SessionRatingEntry = {
        sessionId,
        profileId: actorId,
        rating,
        ratedAt: iso(now),
      };
      ratings.push(row);
      // Sin `changed()` a propósito: la valoración es privada de quien la
      // escribe, y avisar a los suscriptores publicaría por el canal del match
      // que alguien acaba de valorar.
      return { ...row };
    },

    async listStreaks() {
      const now = mockNowMs();
      const state = getState();
      return state.matches
        .filter((match) => isMember(match.id))
        .flatMap((match) => {
          const shared = state.lockInSessions.filter(
            (session) =>
              session.matchId === match.id && session.status === 'aceptada' && bothAttended(session)
          );
          const streak = pairStreak(shared, now);
          return streak
            ? [{ matchId: match.id, count: streak.count, aliveUntil: iso(streak.aliveUntilMs) }]
            : [];
        });
    },

    async serverNow() {
      return iso(mockNowMs());
    },

    subscribe(matchId, listener) {
      return subscribeTo(sessionsTopic(matchId), listener);
    },
  };
}
