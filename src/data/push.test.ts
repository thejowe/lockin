/**
 * Repositorio `push` en los dos backends: el mock aplica las reglas del SQL
 * (formato, plataforma, el token pasa a quien lo registra) y Supabase llama a
 * sus dos RPC.
 */

import { createMockPushRepository, createMockStore, mockPushTokens } from './mock';
import { createSupabasePushRepository } from './supabase/push';
import { mockNotificationSettings } from './mock/push';

import type { LockInSupabaseClient } from './supabase/client';

const TOKEN = 'ExponentPushToken[abc123]';

describe('push — mock', () => {
  it('preferencias, idioma, vistos y actividad están aislados por cuenta y store', async () => {
    const store = createMockStore();
    const a = createMockPushRepository('a', store);
    const b = createMockPushRepository('b', store);
    await a.setPreferences({ notify_likes: false, notify_reminders: false });
    expect((await a.getPreferences()).notify_likes).toBe(false);
    expect((await b.getPreferences()).notify_likes).toBe(true);
    await a.register(TOKEN, 'ios', 'ca');
    await a.markIncomingLikesSeen();
    await a.touchLastActive();
    expect(mockNotificationSettings('a', store)).toMatchObject({
      locale: 'ca',
      seenAt: expect.any(Number),
      lastActiveAt: expect.any(Number),
    });
    await a.setLocale('en');
    expect(mockNotificationSettings('a', store).locale).toBe('en');
    await expect(a.setPreferences({ locale: 'es' } as never)).rejects.toMatchObject({
      code: '22023',
    });
    store.reset();
    expect((await a.getPreferences()).notify_likes).toBe(true);
    expect(mockNotificationSettings('a', store).seenAt).toBeNull();
  });
  it('registra, valida y pasa el token a la última cuenta que lo registra', async () => {
    const store = createMockStore();
    const ana = createMockPushRepository('ana', store);
    const bea = createMockPushRepository('bea', store);

    await ana.register(TOKEN, 'ios');
    expect(mockPushTokens(store).get(TOKEN)).toEqual({ userId: 'ana', platform: 'ios' });
    await bea.register(TOKEN, 'android');
    expect(mockPushTokens(store).get(TOKEN)).toEqual({ userId: 'bea', platform: 'android' });

    await expect(ana.register('basura', 'ios')).rejects.toMatchObject({ code: '23514' });
    await expect(ana.register(TOKEN, 'web' as never)).rejects.toMatchObject({ code: '23514' });

    // Olvidar un token ajeno no hace nada; el propio, sí.
    await ana.unregister(TOKEN);
    expect(mockPushTokens(store).has(TOKEN)).toBe(true);
    await bea.unregister(TOKEN);
    expect(mockPushTokens(store).has(TOKEN)).toBe(false);
  });
});

describe('push — Supabase', () => {
  function setup(error: unknown = null) {
    const rpc = jest.fn(() => Promise.resolve({ data: null, error }));
    const getUserId = jest.fn(() => Promise.resolve('uid'));
    const repository = createSupabasePushRepository({
      getClient: () =>
        ({
          rpc,
          auth: { getSession: async () => ({ data: { session: { user: { id: 'uid' } } }, error }) },
        }) as unknown as LockInSupabaseClient,
      getUserId,
    });
    return { repository, rpc, getUserId };
  }

  it('llama a register_push_token y unregister_push_token', async () => {
    const { repository, rpc, getUserId } = setup();
    await repository.register(TOKEN, 'ios');
    await repository.unregister(TOKEN);
    expect(getUserId).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls).toEqual([
      ['register_push_token', { p_token: TOKEN, p_platform: 'ios' }],
      ['unregister_push_token', { p_token: TOKEN }],
    ]);
  });

  it('propaga el rechazo del servidor', async () => {
    const failure = { code: '23514', message: 'check' };
    const { repository } = setup(failure);
    await expect(repository.register(TOKEN, 'android')).rejects.toBe(failure);
    await expect(repository.unregister(TOKEN)).rejects.toBe(failure);
    await expect(repository.setPreferences({ notify_likes: false })).rejects.toBe(failure);
    await expect(repository.setLocale('ca')).rejects.toBe(failure);
    await expect(repository.markIncomingLikesSeen()).rejects.toBe(failure);
    await expect(repository.touchLastActive()).rejects.toBe(failure);
    await expect(repository.getPreferences()).rejects.toBe(failure);
    await expect(repository.currentAccountId()).rejects.toBe(failure);
  });

  it('las preferencias, locale y marcas usan exclusivamente RPC; arranque no crea sesión', async () => {
    const { repository, rpc, getUserId } = setup();
    expect(await repository.currentAccountId()).toBe('uid');
    await repository.register(TOKEN, 'android', 'ca');
    await repository.setLocale('en');
    await repository.setPreferences({ notify_reminders: false });
    await repository.markIncomingLikesSeen();
    await repository.touchLastActive();
    expect(getUserId).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls).toEqual([
      ['register_push_token', { p_token: TOKEN, p_platform: 'android', p_locale: 'ca' }],
      ['set_notification_locale', { p_locale: 'en' }],
      ['set_notification_prefs', { p_prefs: { notify_reminders: false } }],
      ['mark_incoming_likes_seen'],
      ['touch_last_active'],
    ]);
  });
});
