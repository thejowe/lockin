/**
 * Premium contra Supabase: cupos, deshacer, Boost y likes recibidos.
 *
 * Toda la regla vive en SQL (`premium_quotas`, `undo_last_decision`,
 * `activate_boost`, `incoming_likes*`, y los cupos de `record_decision`); aquí
 * solo se traduce: columnas a campos de dominio y `errcode` LQ00x a las clases
 * de `premium-errors.ts`.
 */
import { PremiumRequiredError, QuotaExceededError } from '../premium-errors';
import { ensureUserId } from './auth';
import { getSupabaseClient } from './client';
import { toProfile } from './mappers';

import type { LockInSupabaseClient } from './client';
import type { IncomingLikeRow, PremiumQuotasRow } from './database.types';
import type { PremiumRepository, Unsubscribe } from '../repositories';
import type { IncomingLike, PremiumQuotas, Profile } from '../types';

/** Lo mínimo que se lee de un error de PostgREST. */
interface PostgrestLikeError {
  code?: string;
  message?: string;
  details?: string | null;
}

const toIsoOrNull = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : new Date(time).toISOString();
};

/**
 * `LQ001`–`LQ004` -> `QuotaExceededError` (el `detail` del SQL es el instante, en
 * ISO, en que vuelve a haber cupo); `LQ005` -> `PremiumRequiredError`. Cualquier
 * otro error se devuelve tal cual.
 */
export function toPremiumError(error: PostgrestLikeError): unknown {
  const resetsAt = toIsoOrNull(error.details);
  switch (error.code) {
    case 'LQ001':
      return new QuotaExceededError('likes', resetsAt);
    case 'LQ002':
      return new QuotaExceededError('supers', resetsAt);
    case 'LQ003':
      return new QuotaExceededError('boost', resetsAt);
    case 'LQ004':
      return new QuotaExceededError('abuse', resetsAt);
    case 'LQ005':
      return new PremiumRequiredError();
    default:
      return error;
  }
}

export function toPremiumQuotas(row: PremiumQuotasRow): PremiumQuotas {
  return {
    isPremium: row.is_premium,
    premiumUntil: toIsoOrNull(row.premium_until),
    likesLeft: row.likes_left,
    likesResetAt: toIsoOrNull(row.likes_reset_at),
    supersLeft: row.supers_left,
    supersResetAt: toIsoOrNull(row.supers_reset_at),
    boostAvailableAt: toIsoOrNull(row.boost_available_at),
    boostActiveUntil: toIsoOrNull(row.boost_active_until),
  };
}

/**
 * Cursor de `listIncomingLikes` (`incomingLikeCursor()`: `super|likedAt|id`) a los
 * parámetros del RPC. Una marca ISO suelta pagina solo por fecha.
 */
export function toIncomingLikesCursor(before: string | undefined): {
  p_before: string | null;
  p_before_super: boolean | null;
  p_before_id: string | null;
} {
  if (before === undefined) return { p_before: null, p_before_super: null, p_before_id: null };
  const [flag, stamp, ...rest] = before.split('|');
  if (stamp === undefined) return { p_before: before, p_before_super: null, p_before_id: null };
  return {
    p_before: stamp,
    p_before_super: flag === '1',
    p_before_id: rest.join('|') || null,
  };
}

export interface PremiumRepositoryDeps {
  getClient?(): LockInSupabaseClient;
  getUserId?(): Promise<string>;
  /** Cambia la ruta de la foto de cada perfil por una URL firmada (bucket privado). */
  signProfiles?(profiles: Profile[]): Promise<Profile[]>;
  /** Recibe la función que avisa a los suscriptores de `subscribeQuotas`. */
  exposeNotify?(notify: () => void): void;
}

export function createSupabasePremiumRepository({
  getClient = getSupabaseClient,
  getUserId = ensureUserId,
  signProfiles = async (profiles) => profiles,
  exposeNotify,
}: PremiumRepositoryDeps = {}): PremiumRepository {
  const listeners = new Set<(quotas: PremiumQuotas) => void>();

  async function getQuotas(): Promise<PremiumQuotas> {
    const client = getClient();
    await getUserId();
    const { data, error } = await client.rpc('premium_quotas');
    if (error) throw toPremiumError(error);
    const row = (Array.isArray(data) ? data[0] : data) as PremiumQuotasRow | undefined;
    if (!row) throw new Error('premium_quotas no devolvió ninguna fila');
    return toPremiumQuotas(row);
  }

  const notifyQuotas = () => {
    if (listeners.size === 0) return;
    void getQuotas().then(
      (quotas) => listeners.forEach((listener) => listener(quotas)),
      () => {
        // Un fallo de red al refrescar no debe romper la acción que lo provocó.
      }
    );
  };
  exposeNotify?.(notifyQuotas);

  return {
    getQuotas,

    subscribeQuotas(cb): Unsubscribe {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },

    async undoLastDecision() {
      const client = getClient();
      await getUserId();
      const { data, error } = await client.rpc('undo_last_decision');
      if (error) throw toPremiumError(error);
      notifyQuotas();
      return (data as string | null) ?? null;
    },

    async activateBoost() {
      const client = getClient();
      await getUserId();
      const { data, error } = await client.rpc('activate_boost');
      if (error) throw toPremiumError(error);
      notifyQuotas();
      return new Date(data as string).toISOString();
    },

    async countIncomingLikes() {
      const client = getClient();
      await getUserId();
      const { data, error } = await client.rpc('incoming_likes_count');
      if (error) throw toPremiumError(error);
      return Number(data ?? 0);
    },

    async listIncomingLikes(page = {}) {
      const client = getClient();
      await getUserId();
      const { data, error } = await client.rpc('incoming_likes', {
        p_limit: page.limit ?? 50,
        ...toIncomingLikesCursor(page.before),
      });
      if (error) throw toPremiumError(error);

      const rows = (data ?? []) as IncomingLikeRow[];
      const profiles = await signProfiles(rows.map(toProfile));
      return rows.map((row, index): IncomingLike => ({
        profile: profiles[index],
        isSuper: row.is_super,
        likedAt: new Date(row.liked_at).toISOString(),
      }));
    },

    async syncEntitlement() {
      // La función `sync-entitlement` llega con el cobro real (Fase 3).
    },
  };
}
