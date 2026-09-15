/**
 * Sesiones Lock-In contra Supabase.
 *
 * Toda escritura va por RPC (ver `supabase/migrations/20260913000100_lockin_sessions.sql`),
 * que valida las reglas con la fila bloqueada; aquí solo se traduce y se avisa.
 * Las dependencias se inyectan porque la suite de contrato necesita el mismo
 * repositorio actuando como otra persona, con su propio cliente.
 */

import {
  SessionConflictError,
  SessionExpiredError,
  SessionForbiddenError,
  SessionWindowError,
} from '../session-errors';
import { isSessionLive } from '../sessions';
import { ensureUserId } from './auth';
import { getSupabaseClient } from './client';

import type { LockInSupabaseClient } from './client';
import type { SessionAttendanceRow, SessionRow } from './database.types';
import type { LockInSessionRepository, Unsubscribe } from '../repositories';
import type { LockInSession, SessionAttendance } from '../types';
import type { RealtimeChannel } from '@supabase/supabase-js';

/** PostgREST serializa `timestamptz` como `…+00:00`; el dominio usa ISO con `Z`. */
const toIso = (value: string) => new Date(value).toISOString();

export function toLockInSession(row: SessionRow): LockInSession {
  return {
    id: row.id,
    matchId: row.match_id,
    proposedBy: row.proposed_by,
    startsAt: toIso(row.starts_at),
    blocks: row.blocks,
    status: row.status,
    createdAt: toIso(row.created_at),
    respondedAt: row.responded_at === null ? null : toIso(row.responded_at),
  };
}

export function toSessionAttendance(row: SessionAttendanceRow): SessionAttendance {
  return {
    sessionId: row.session_id,
    profileId: row.profile_id,
    joinedAt: toIso(row.joined_at),
    leftAt: row.left_at === null ? null : toIso(row.left_at),
  };
}

const DOMAIN_ERRORS: Record<string, new (message: string) => Error> = {
  LI001: SessionConflictError,
  LI002: SessionExpiredError,
  LI003: SessionWindowError,
  LI004: SessionForbiddenError,
};

/** `errcode` LI00x de los RPCs → error de dominio. Cualquier otro sale intacto. */
export function toSessionError(error: { code?: string; message: string }): unknown {
  const DomainError = error.code ? DOMAIN_ERRORS[error.code] : undefined;
  return DomainError ? new DomainError(error.message) : error;
}

export interface SessionRepositoryDeps {
  getClient(): LockInSupabaseClient;
  /** Abre sesión si hace falta y devuelve el id del usuario. */
  getUserId(): Promise<string>;
}

const defaultDeps: SessionRepositoryDeps = {
  getClient: getSupabaseClient,
  getUserId: ensureUserId,
};

export function createSupabaseSessionRepository(
  deps: SessionRepositoryDeps = defaultDeps
): LockInSessionRepository {
  const listeners = new Map<string, Set<() => void>>();
  const channels = new Map<string, RealtimeChannel>();
  /** `join`/`leave` devuelven asistencia, sin `matchId`: esto dice a quién avisar. */
  const matchOfSession = new Map<string, string>();

  const notify = (matchId: string) => listeners.get(matchId)?.forEach((listener) => listener());

  const remember = (session: LockInSession) => {
    matchOfSession.set(session.id, session.matchId);
    return session;
  };

  /** Escritura propia: se avisa al momento, sin esperar al eco de realtime. */
  const changed = (row: unknown) => {
    const session = remember(toLockInSession(row as SessionRow));
    notify(session.matchId);
    return session;
  };

  async function notifyForSession(sessionId: string) {
    const matchId = matchOfSession.get(sessionId) ?? (await repository.getById(sessionId))?.matchId;
    if (matchId) notify(matchId);
  }

  const repository: LockInSessionRepository = {
    async getActive(matchId) {
      await deps.getUserId();
      const { data, error } = await deps
        .getClient()
        .from('lockin_sessions')
        .select('*')
        .eq('match_id', matchId)
        .in('status', ['propuesta', 'aceptada'])
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;

      // "Viva" depende de la hora, que no se puede filtrar en la consulta sin un
      // RPC más. Se usa el reloj del dispositivo: la pantalla de sesión corrige
      // el desfase con `serverNow()` donde de verdad importa.
      const now = Date.now();
      const live = (data as SessionRow[])
        .map(toLockInSession)
        .find((session) => isSessionLive(session, now));
      return live ? remember(live) : null;
    },

    async getById(sessionId) {
      await deps.getUserId();
      const { data, error } = await deps
        .getClient()
        .from('lockin_sessions')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle();
      if (error) throw error;
      return data ? remember(toLockInSession(data as SessionRow)) : null;
    },

    async propose({ matchId, startsAt, blocks }) {
      await deps.getUserId();
      const { data, error } = await deps.getClient().rpc('propose_session', {
        p_match_id: matchId,
        p_starts_at: startsAt,
        p_blocks: blocks,
      });
      if (error) throw toSessionError(error);
      return changed(data);
    },

    async respond(sessionId, answer) {
      await deps.getUserId();
      const { data, error } = await deps
        .getClient()
        .rpc('respond_session', { p_session_id: sessionId, p_answer: answer });
      if (error) throw toSessionError(error);
      return changed(data);
    },

    async cancel(sessionId) {
      await deps.getUserId();
      const { data, error } = await deps
        .getClient()
        .rpc('cancel_session', { p_session_id: sessionId });
      if (error) throw toSessionError(error);
      return changed(data);
    },

    async join(sessionId) {
      await deps.getUserId();
      const { data, error } = await deps
        .getClient()
        .rpc('join_session', { p_session_id: sessionId });
      if (error) throw toSessionError(error);
      await notifyForSession(sessionId);
      return toSessionAttendance(data as SessionAttendanceRow);
    },

    async leave(sessionId) {
      await deps.getUserId();
      const { data, error } = await deps
        .getClient()
        .rpc('leave_session', { p_session_id: sessionId });
      if (error) throw toSessionError(error);
      await notifyForSession(sessionId);
      return toSessionAttendance(data as SessionAttendanceRow);
    },

    async listAttendance(sessionId) {
      await deps.getUserId();
      const { data, error } = await deps
        .getClient()
        .from('session_attendance')
        .select('*')
        .eq('session_id', sessionId);
      if (error) throw error;
      return (data as SessionAttendanceRow[]).map(toSessionAttendance);
    },

    // Valoración post-sesión: el contrato ya la declara, pero los RPCs
    // (`ratable_session`, `rate_session`) son la Tarea 3 y este repositorio la
    // Tarea 4 de `docs/superpowers/plans/2026-09-15-valoracion-post-sesion.md`.
    // Hasta entonces se lanza en vez de fingir un resultado.
    async getRatable() {
      throw new Error('getRatable todavía no está implementado contra Supabase (Tarea 4)');
    },

    async getMyRating() {
      throw new Error('getMyRating todavía no está implementado contra Supabase (Tarea 4)');
    },

    async rate() {
      throw new Error('rate todavía no está implementado contra Supabase (Tarea 4)');
    },

    async serverNow() {
      await deps.getUserId();
      const { data, error } = await deps.getClient().rpc('server_now');
      if (error) throw error;
      return toIso(data as string);
    },

    subscribe(matchId, listener): Unsubscribe {
      const set = listeners.get(matchId) ?? new Set();
      set.add(listener);
      listeners.set(matchId, set);

      if (!channels.has(matchId)) {
        const channel = deps
          .getClient()
          .channel(`lockin:sessions:${matchId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'lockin_sessions',
              filter: `match_id=eq.${matchId}`,
            },
            () => notify(matchId)
          )
          // La asistencia no lleva `match_id`: RLS ya limita el stream a sesiones
          // de tus matches, así que como mucho avisa de más, nunca de menos.
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'session_attendance' },
            () => notify(matchId)
          )
          .subscribe();
        channels.set(matchId, channel);
      }

      return () => {
        set.delete(listener);
        if (set.size > 0) return;
        listeners.delete(matchId);
        const channel = channels.get(matchId);
        channels.delete(matchId);
        if (channel) void deps.getClient().removeChannel(channel);
      };
    },
  };

  return repository;
}
