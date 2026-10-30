/**
 * Traducción de Premium contra Supabase: errores LQ00x, cursor de likes recibidos,
 * columnas de `premium_quotas` y los argumentos nuevos de `discovery_deck` y
 * `record_decision`. El cliente es un doble: la regla de verdad vive en SQL y la
 * ejercita el contrato (`contract.test.ts`, opt-in).
 */
import { PremiumRequiredError, QuotaExceededError } from '../premium-errors';
import { incomingLikeCursor } from '../repositories';
import { createSupabaseRepositories } from './index';
import {
  createSupabasePremiumRepository,
  toIncomingLikesCursor,
  toPremiumError,
  toPremiumQuotas,
} from './premium';

import type { LockInSupabaseClient } from './client';
import type { PremiumQuotasRow, ProfileRow } from './database.types';
import type { IncomingLike } from '../types';

type RpcResult = {
  data: unknown;
  error: { code?: string; message: string; details?: string } | null;
};

const profileRow = (id: string): ProfileRow => ({
  id,
  name: id,
  age: 30,
  location: 'Barcelona',
  timezone: 'Europe/Madrid',
  avatar_initials: 'AB',
  avatar_accent: 'brass',
  avatar_url: null,
  specialties: ['dev'],
  seeking_specialties: [],
  looking_for: 'ambos',
  starting_point: 'solo-ganas',
  availability_hours_per_week: 10,
  availability_bands: ['tarde'],
  ambition: 'lifestyle',
  link_github: null,
  github_handle: null,
  github_verified_at: null,
  link_portfolio: null,
  link_linkedin: null,
  link_instagram: null,
  link_tiktok: null,
  linkedin_name: null,
  linkedin_verified_at: null,
  prompts: [],
  created_at: '2026-10-01T10:00:00+00:00',
  updated_at: '2026-10-01T10:00:00+00:00',
});

const quotasRow: PremiumQuotasRow = {
  is_premium: false,
  premium_until: null,
  likes_left: 3,
  likes_reset_at: '2026-10-30T10:00:00+00:00',
  supers_left: 1,
  supers_reset_at: null,
  boost_available_at: null,
  boost_active_until: null,
};

function fakeClient(results: Record<string, RpcResult> = {}) {
  const rpc = jest.fn(async (name: string, _args?: unknown): Promise<RpcResult> => {
    return results[name] ?? { data: null, error: null };
  });
  return { client: { rpc } as unknown as LockInSupabaseClient, rpc };
}

const deps = (client: LockInSupabaseClient) => ({
  getClient: () => client,
  getUserId: async () => 'me',
});

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('toPremiumError', () => {
  it.each([
    ['LQ001', 'likes'],
    ['LQ002', 'supers'],
    ['LQ003', 'boost'],
    ['LQ004', 'abuse'],
  ] as const)('%s es un QuotaExceededError de tipo %s con el instante del detail', (code, kind) => {
    const error = toPremiumError({ code, message: 'x', details: '2026-10-30T12:34:56.789Z' });
    expect(error).toBeInstanceOf(QuotaExceededError);
    expect((error as QuotaExceededError).kind).toBe(kind);
    expect((error as QuotaExceededError).resetsAt).toBe('2026-10-30T12:34:56.789Z');
  });

  it('un detail ausente o ilegible deja resetsAt a null', () => {
    const missing = toPremiumError({ code: 'LQ001', message: 'x' }) as QuotaExceededError;
    expect(missing.resetsAt).toBeNull();
    const garbled = toPremiumError({
      code: 'LQ001',
      message: 'x',
      details: 'mañana',
    }) as QuotaExceededError;
    expect(garbled.resetsAt).toBeNull();
  });

  it('LQ005 es PremiumRequiredError', () => {
    expect(toPremiumError({ code: 'LQ005', message: 'x' })).toBeInstanceOf(PremiumRequiredError);
  });

  it('cualquier otro error pasa tal cual', () => {
    const original = { code: '23503', message: 'fk' };
    expect(toPremiumError(original)).toBe(original);
  });
});

describe('toPremiumQuotas', () => {
  it('pasa las columnas a campos de dominio y normaliza las fechas a ISO', () => {
    expect(toPremiumQuotas(quotasRow)).toEqual({
      isPremium: false,
      premiumUntil: null,
      likesLeft: 3,
      likesResetAt: '2026-10-30T10:00:00.000Z',
      supersLeft: 1,
      supersResetAt: null,
      boostAvailableAt: null,
      boostActiveUntil: null,
    });
  });

  it('con Premium, likesLeft sigue siendo null', () => {
    const quotas = toPremiumQuotas({ ...quotasRow, is_premium: true, likes_left: null });
    expect(quotas.likesLeft).toBeNull();
  });
});

describe('toIncomingLikesCursor', () => {
  it('sin cursor no manda nada', () => {
    expect(toIncomingLikesCursor(undefined)).toEqual({
      p_before: null,
      p_before_super: null,
      p_before_id: null,
    });
  });

  it('el cursor de tres claves se reparte en los tres parámetros', () => {
    expect(toIncomingLikesCursor('1|2026-10-30T10:00:00.000Z|abc')).toEqual({
      p_before: '2026-10-30T10:00:00.000Z',
      p_before_super: true,
      p_before_id: 'abc',
    });
    expect(toIncomingLikesCursor('0|2026-10-30T10:00:00.000Z|abc').p_before_super).toBe(false);
  });

  it('una marca ISO suelta pagina solo por fecha', () => {
    expect(toIncomingLikesCursor('2026-10-30T10:00:00.000Z')).toEqual({
      p_before: '2026-10-30T10:00:00.000Z',
      p_before_super: null,
      p_before_id: null,
    });
  });

  it('es la inversa de incomingLikeCursor()', () => {
    const like = { isSuper: true, likedAt: '2026-10-30T10:00:00.000Z', profile: { id: 'p1' } };
    expect(toIncomingLikesCursor(incomingLikeCursor(like as unknown as IncomingLike))).toEqual({
      p_before: like.likedAt,
      p_before_super: true,
      p_before_id: 'p1',
    });
  });
});

describe('createSupabasePremiumRepository', () => {
  it('getQuotas lee la fila única de premium_quotas', async () => {
    const { client, rpc } = fakeClient({ premium_quotas: { data: [quotasRow], error: null } });
    const quotas = await createSupabasePremiumRepository(deps(client)).getQuotas();
    expect(rpc).toHaveBeenCalledWith('premium_quotas');
    expect(quotas.likesLeft).toBe(3);
  });

  it('undoLastDecision devuelve el id deshecho o null', async () => {
    const some = fakeClient({ undo_last_decision: { data: 'p1', error: null } });
    expect(await createSupabasePremiumRepository(deps(some.client)).undoLastDecision()).toBe('p1');
    const none = fakeClient({ undo_last_decision: { data: null, error: null } });
    expect(await createSupabasePremiumRepository(deps(none.client)).undoLastDecision()).toBeNull();
  });

  it('undoLastDecision sin Premium rechaza con PremiumRequiredError', async () => {
    const { client } = fakeClient({
      undo_last_decision: { data: null, error: { code: 'LQ005', message: 'premium' } },
    });
    await expect(
      createSupabasePremiumRepository(deps(client)).undoLastDecision()
    ).rejects.toBeInstanceOf(PremiumRequiredError);
  });

  it('activateBoost devuelve el fin en ISO y el segundo rechaza con kind boost', async () => {
    const ok = fakeClient({ activate_boost: { data: '2026-10-30T12:30:00+00:00', error: null } });
    expect(await createSupabasePremiumRepository(deps(ok.client)).activateBoost()).toBe(
      '2026-10-30T12:30:00.000Z'
    );
    const used = fakeClient({
      activate_boost: {
        data: null,
        error: { code: 'LQ003', message: 'usado', details: '2026-11-29T12:00:00.000Z' },
      },
    });
    const error = await createSupabasePremiumRepository(deps(used.client))
      .activateBoost()
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(QuotaExceededError);
    expect((error as QuotaExceededError).kind).toBe('boost');
    expect((error as QuotaExceededError).resetsAt).toBe('2026-11-29T12:00:00.000Z');
  });

  it('countIncomingLikes devuelve el número', async () => {
    const { client } = fakeClient({ incoming_likes_count: { data: 4, error: null } });
    expect(await createSupabasePremiumRepository(deps(client)).countIncomingLikes()).toBe(4);
  });

  it('listIncomingLikes traduce filas y manda el cursor como parámetros', async () => {
    const { client, rpc } = fakeClient({
      incoming_likes: {
        data: [{ ...profileRow('p1'), is_super: true, liked_at: '2026-10-30T10:00:00+00:00' }],
        error: null,
      },
    });
    const likes = await createSupabasePremiumRepository(deps(client)).listIncomingLikes({
      before: '1|2026-10-30T11:00:00.000Z|p0',
      limit: 10,
    });
    expect(rpc).toHaveBeenCalledWith('incoming_likes', {
      p_limit: 10,
      p_before: '2026-10-30T11:00:00.000Z',
      p_before_super: true,
      p_before_id: 'p0',
    });
    expect(likes).toHaveLength(1);
    expect(likes[0]).toMatchObject({ isSuper: true, likedAt: '2026-10-30T10:00:00+00:00' });
    expect(likes[0].profile.id).toBe('p1');
  });

  it('listIncomingLikes conserva los microsegundos del servidor y el cursor los devuelve intactos', async () => {
    const { client, rpc } = fakeClient({
      incoming_likes: {
        data: [
          { ...profileRow('p1'), is_super: false, liked_at: '2026-10-30T10:00:00.123456+00:00' },
        ],
        error: null,
      },
    });
    const repository = createSupabasePremiumRepository(deps(client));
    const [like] = await repository.listIncomingLikes();
    expect(like.likedAt).toBe('2026-10-30T10:00:00.123456+00:00');

    await repository.listIncomingLikes({ before: incomingLikeCursor(like) });
    expect(rpc).toHaveBeenLastCalledWith(
      'incoming_likes',
      expect.objectContaining({ p_before: '2026-10-30T10:00:00.123456+00:00', p_before_id: 'p1' })
    );
  });

  it('subscribeQuotas descarta un refresco superado por otro más nuevo', async () => {
    const pending: ((row: PremiumQuotasRow) => void)[] = [];
    const rpc = jest.fn(
      (name: string) =>
        new Promise<RpcResult>((resolve) => {
          if (name === 'premium_quotas') {
            pending.push((row) => resolve({ data: [row], error: null }));
          } else {
            resolve({ data: '2026-10-30T12:30:00+00:00', error: null });
          }
        })
    );
    const repository = createSupabasePremiumRepository(
      deps({ rpc } as unknown as LockInSupabaseClient)
    );
    const seen: number[] = [];
    repository.subscribeQuotas((quotas) => seen.push(quotas.likesLeft ?? -1));

    await repository.activateBoost();
    await repository.activateBoost();
    expect(pending).toHaveLength(2);
    pending[1]({ ...quotasRow, likes_left: 1 });
    await flush();
    pending[0]({ ...quotasRow, likes_left: 9 });
    await flush();
    expect(seen).toEqual([1]);
  });

  it('listIncomingLikes sin Premium rechaza con PremiumRequiredError', async () => {
    const { client } = fakeClient({
      incoming_likes: { data: null, error: { code: 'LQ005', message: 'premium' } },
    });
    await expect(
      createSupabasePremiumRepository(deps(client)).listIncomingLikes()
    ).rejects.toBeInstanceOf(PremiumRequiredError);
  });

  it('subscribeQuotas avisa tras una acción propia y deja de avisar al darse de baja', async () => {
    const { client } = fakeClient({
      premium_quotas: { data: [quotasRow], error: null },
      activate_boost: { data: '2026-10-30T12:30:00+00:00', error: null },
    });
    const repository = createSupabasePremiumRepository(deps(client));
    const seen: number[] = [];
    const stop = repository.subscribeQuotas((quotas) => seen.push(quotas.likesLeft ?? -1));

    await repository.activateBoost();
    await flush();
    expect(seen).toEqual([3]);

    stop();
    await repository.activateBoost();
    await flush();
    expect(seen).toEqual([3]);
  });
});

describe('createSupabasePremiumRepository: bordes', () => {
  const failure = { code: '08006', message: 'sin red' };

  it('getQuotas acepta una fila suelta y rechaza una respuesta vacía', async () => {
    const single = fakeClient({ premium_quotas: { data: quotasRow, error: null } });
    expect((await createSupabasePremiumRepository(deps(single.client)).getQuotas()).likesLeft).toBe(
      3
    );

    const empty = fakeClient({ premium_quotas: { data: [], error: null } });
    await expect(createSupabasePremiumRepository(deps(empty.client)).getQuotas()).rejects.toThrow(
      'premium_quotas no devolvió ninguna fila'
    );
  });

  it('un fallo de red en cualquier RPC llega tal cual, sin traducir', async () => {
    const { client } = fakeClient({
      premium_quotas: { data: null, error: failure },
      undo_last_decision: { data: null, error: failure },
      activate_boost: { data: null, error: failure },
      incoming_likes_count: { data: null, error: failure },
      incoming_likes: { data: null, error: failure },
    });
    const repository = createSupabasePremiumRepository(deps(client));

    await expect(repository.getQuotas()).rejects.toBe(failure);
    await expect(repository.undoLastDecision()).rejects.toBe(failure);
    await expect(repository.activateBoost()).rejects.toBe(failure);
    await expect(repository.countIncomingLikes()).rejects.toBe(failure);
    await expect(repository.listIncomingLikes()).rejects.toBe(failure);
  });

  it('countIncomingLikes sin dato cuenta cero', async () => {
    const { client } = fakeClient({ incoming_likes_count: { data: null, error: null } });

    await expect(createSupabasePremiumRepository(deps(client)).countIncomingLikes()).resolves.toBe(
      0
    );
  });

  it('listIncomingLikes sin filas devuelve una lista vacía y pide 50 por defecto', async () => {
    const { client, rpc } = fakeClient({ incoming_likes: { data: null, error: null } });

    await expect(
      createSupabasePremiumRepository(deps(client)).listIncomingLikes()
    ).resolves.toEqual([]);
    expect(rpc).toHaveBeenCalledWith('incoming_likes', expect.objectContaining({ p_limit: 50 }));
  });

  it('listIncomingLikes pasa los perfiles por signProfiles para firmar las fotos', async () => {
    const { client } = fakeClient({
      incoming_likes: {
        data: [
          { ...profileRow('p1'), is_super: true, liked_at: '2026-10-30T10:00:00.123456+00:00' },
        ],
        error: null,
      },
    });
    const signProfiles = jest.fn(async (profiles: IncomingLike['profile'][]) =>
      profiles.map((profile) => ({ ...profile, name: 'firmado' }))
    );

    const [like] = await createSupabasePremiumRepository({
      ...deps(client),
      signProfiles,
    }).listIncomingLikes();

    expect(signProfiles).toHaveBeenCalledTimes(1);
    expect(like.profile.name).toBe('firmado');
    expect(like.isSuper).toBe(true);
  });

  it('expone el aviso de cupos y syncEntitlement aún no hace nada', async () => {
    const { client } = fakeClient({ premium_quotas: { data: [quotasRow], error: null } });
    let notify: () => void = () => {};
    const repository = createSupabasePremiumRepository({
      ...deps(client),
      exposeNotify: (fn) => {
        notify = fn;
      },
    });
    const seen: number[] = [];
    repository.subscribeQuotas((quotas) => seen.push(quotas.supersLeft));

    notify();
    await flush();

    expect(seen).toEqual([1]);
    await expect(repository.syncEntitlement()).resolves.toBeUndefined();
  });

  it('un refresco que falla no avisa a nadie ni rompe nada', async () => {
    const { client } = fakeClient({ premium_quotas: { data: null, error: failure } });
    let notify: () => void = () => {};
    const repository = createSupabasePremiumRepository({
      ...deps(client),
      exposeNotify: (fn) => {
        notify = fn;
      },
    });
    const listener = jest.fn();
    repository.subscribeQuotas(listener);

    notify();
    await flush();

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('discovery sobre Supabase con Premium', () => {
  const repositoriesWith = (results: Record<string, RpcResult>) => {
    const { client, rpc } = fakeClient(results);
    return { repositories: createSupabaseRepositories(deps(client)), rpc };
  };

  it('getDeck manda los filtros premium y pasa super_liked_me a superLikedMe', async () => {
    const { repositories, rpc } = repositoriesWith({
      discovery_deck: {
        data: [
          { ...profileRow('a'), super_liked_me: true },
          { ...profileRow('b'), super_liked_me: false },
        ],
        error: null,
      },
    });
    const deck = await repositories.discovery.getDeck({
      minHoursPerWeek: 8,
      timeBands: ['tarde'],
      ambition: ['todo-o-nada'],
      startingPoint: ['solo-ganas'],
      timezoneWindowHours: 3,
    });
    expect(rpc).toHaveBeenCalledWith('discovery_deck', {
      p_mode: null,
      p_specialties: null,
      p_exclude_ids: null,
      p_min_hours_per_week: 8,
      p_time_bands: ['tarde'],
      p_ambition: ['todo-o-nada'],
      p_starting_point: ['solo-ganas'],
      p_timezone_window_hours: 3,
    });
    expect(deck.map((card) => [card.id, card.superLikedMe])).toEqual([
      ['a', true],
      ['b', false],
    ]);
  });

  it('getDeck sin filtros premium manda null en todos', async () => {
    const { repositories, rpc } = repositoriesWith({ discovery_deck: { data: [], error: null } });
    await repositories.discovery.getDeck();
    expect(rpc).toHaveBeenCalledWith(
      'discovery_deck',
      expect.objectContaining({
        p_min_hours_per_week: null,
        p_time_bands: null,
        p_ambition: null,
        p_starting_point: null,
        p_timezone_window_hours: null,
      })
    );
  });

  it('getDeck con filtros premium sin Premium rechaza con PremiumRequiredError', async () => {
    const { repositories } = repositoriesWith({
      discovery_deck: { data: null, error: { code: 'LQ005', message: 'premium' } },
    });
    await expect(
      repositories.discovery.getDeck({ ambition: ['todo-o-nada'] })
    ).rejects.toBeInstanceOf(PremiumRequiredError);
  });

  it('recordDecision con Super Like manda p_super', async () => {
    const { repositories, rpc } = repositoriesWith({});
    await repositories.discovery.recordDecision('x', 'like', undefined, { super: true });
    expect(rpc).toHaveBeenCalledWith('record_decision', {
      p_target_id: 'x',
      p_decision: 'like',
      p_super: true,
    });
  });

  it.each([
    ['LQ001', 'likes'],
    ['LQ002', 'supers'],
    ['LQ004', 'abuse'],
  ] as const)('recordDecision con %s rechaza con QuotaExceededError %s', async (code, kind) => {
    const { repositories } = repositoriesWith({
      record_decision: {
        data: null,
        error: { code, message: 'cupo', details: '2026-10-30T23:00:00.000Z' },
      },
    });
    const error = await repositories.discovery.recordDecision('x', 'like').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(QuotaExceededError);
    expect((error as QuotaExceededError).kind).toBe(kind);
    expect((error as QuotaExceededError).resetsAt).toBe('2026-10-30T23:00:00.000Z');
  });

  it('un like refresca los cupos de quien está suscrito', async () => {
    const { repositories } = repositoriesWith({
      premium_quotas: { data: [quotasRow], error: null },
    });
    const seen: number[] = [];
    repositories.premium.subscribeQuotas((quotas) => seen.push(quotas.supersLeft));
    await repositories.discovery.recordDecision('x', 'like');
    await flush();
    expect(seen).toEqual([1]);
  });
});
