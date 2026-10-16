import { createAvatarSigner, REFRESH_MARGIN_MS, SIGNED_URL_TTL_SECONDS } from './avatar-urls';

import type { LockInSupabaseClient } from './client';
import type { Profile } from '../types';

function profile(id: string, imageUrl?: string): Profile {
  return {
    id,
    avatar: {
      initials: 'A',
      accent: 'brass',
      ...(imageUrl ? { imageUrl, hasPhoto: true } : {}),
    },
  } as Profile;
}

function setup(over?: {
  respond?: (paths: string[], ttl: number, call: number) => unknown;
  now?: { value: number };
}) {
  let calls = 0;
  const createSignedUrls = jest.fn(async (paths: string[], ttl: number): Promise<unknown> => {
    const call = ++calls;
    return (
      over?.respond?.(paths, ttl, call) ?? {
        data: paths.map((path) => ({
          path,
          signedUrl: `https://x/sign/${path}?n=${call}`,
          error: null,
        })),
        error: null,
      }
    );
  });
  const from = jest.fn(() => ({ createSignedUrls }));
  const client = { storage: { from } } as unknown as LockInSupabaseClient;
  const clock = over?.now ?? { value: 1_000_000 };
  const timers: { callback: () => void; ms: number; live: boolean }[] = [];
  const foreground: { callback: (() => void) | null } = { callback: null };
  const onStale = jest.fn();
  const signer = createAvatarSigner(() => client, {
    now: () => clock.value,
    onStale,
    setTimer: (callback, ms) => {
      const timer = { callback, ms, live: true };
      timers.push(timer);
      return timer;
    },
    clearTimer: (handle) => {
      (handle as { live: boolean }).live = false;
    },
    onForeground: (callback) => {
      foreground.callback = callback;
      return () => {
        foreground.callback = null;
      };
    },
  });
  /** Dispara el último temporizador vivo, como si hubiera pasado su tiempo. */
  const fireTimer = () => {
    const timer = [...timers].reverse().find((t) => t.live);
    if (!timer) throw new Error('sin temporizador vivo');
    timer.live = false;
    clock.value += timer.ms;
    timer.callback();
    return timer;
  };
  return { signer, createSignedUrls, from, clock, timers, foreground, onStale, fireTimer };
}

describe('createAvatarSigner', () => {
  it('firma por lote, una sola vez por ruta, en el bucket avatars', async () => {
    const { signer, createSignedUrls, from } = setup();

    const out = await signer.signProfiles([
      profile('a', 'a/1.jpg'),
      profile('b', 'b/1.jpg'),
      profile('c'),
      profile('a2', 'a/1.jpg'),
    ]);

    expect(from).toHaveBeenCalledWith('avatars');
    expect(createSignedUrls).toHaveBeenCalledTimes(1);
    expect(createSignedUrls).toHaveBeenCalledWith(['a/1.jpg', 'b/1.jpg'], SIGNED_URL_TTL_SECONDS);
    expect(out[0].avatar.imageUrl).toBe('https://x/sign/a/1.jpg?n=1');
    expect(out[3].avatar.imageUrl).toBe('https://x/sign/a/1.jpg?n=1');
    expect('imageUrl' in out[2].avatar).toBe(false);
  });

  it('sin fotos no llama a Storage', async () => {
    const { signer, createSignedUrls } = setup();
    await signer.signProfiles([profile('a')]);
    expect(createSignedUrls).not.toHaveBeenCalled();
  });

  it('reutiliza la misma URL mientras no toque renovarla (caché de imagen estable)', async () => {
    const { signer, createSignedUrls, clock } = setup();
    const first = await signer.signProfiles([profile('a', 'a/1.jpg')]);

    clock.value += SIGNED_URL_TTL_SECONDS * 1000 - REFRESH_MARGIN_MS - 1;
    const second = await signer.signProfiles([profile('a', 'a/1.jpg')]);

    expect(createSignedUrls).toHaveBeenCalledTimes(1);
    expect(second[0].avatar.imageUrl).toBe(first[0].avatar.imageUrl);
  });

  it('renueva cuando le queda menos del margen', async () => {
    const { signer, createSignedUrls, clock } = setup();
    await signer.signProfiles([profile('a', 'a/1.jpg')]);

    clock.value += SIGNED_URL_TTL_SECONDS * 1000 - REFRESH_MARGIN_MS + 1;
    const out = await signer.signProfiles([profile('a', 'a/1.jpg')]);

    expect(createSignedUrls).toHaveBeenCalledTimes(2);
    expect(out[0].avatar.imageUrl).toBe('https://x/sign/a/1.jpg?n=2');
  });

  it('tras una suspensión larga el temporizador avisa aunque ya haya caducado todo', async () => {
    const { signer, clock, timers, onStale } = setup();
    await signer.signProfiles([profile('a', 'a/1.jpg')]);

    // La app estuvo suspendida más que el TTL: el temporizador atrasado corre
    // con la URL ya caducada y la caché no puede quedar vacía sin avisar.
    clock.value += SIGNED_URL_TTL_SECONDS * 1000 * 2;
    timers[timers.length - 1].callback();

    expect(onStale).toHaveBeenCalledTimes(1);
  });

  it('solo pide las rutas que faltan', async () => {
    const { signer, createSignedUrls } = setup();
    await signer.signProfiles([profile('a', 'a/1.jpg')]);
    await signer.signProfiles([profile('a', 'a/1.jpg'), profile('b', 'b/1.jpg')]);
    expect(createSignedUrls).toHaveBeenLastCalledWith(['b/1.jpg'], SIGNED_URL_TTL_SECONDS);
  });

  it('si Storage falla, el perfil sale sin foto en vez de con la ruta cruda', async () => {
    const { signer } = setup({ respond: () => ({ data: null, error: new Error('x') }) });
    const out = await signer.signProfiles([profile('a', 'a/1.jpg')]);
    expect('imageUrl' in out[0].avatar).toBe(false);
    // La foto sigue existiendo aunque no haya URL que pintar.
    expect(out[0].avatar.hasPhoto).toBe(true);
  });

  it('si Storage lanza, tampoco rompe la lectura', async () => {
    const { signer } = setup({
      respond: () => {
        throw new Error('red');
      },
    });
    const out = await signer.signProfiles([profile('a', 'a/1.jpg')]);
    expect('imageUrl' in out[0].avatar).toBe(false);
  });

  it('una ruta sin objeto (error por entrada) pierde la foto; las demás se firman', async () => {
    const { signer } = setup({
      respond: (paths) => ({
        data: paths.map((path) =>
          path === 'a/1.jpg'
            ? { path, signedUrl: null, error: 'Object not found' }
            : { path, signedUrl: `https://x/sign/${path}`, error: null }
        ),
        error: null,
      }),
    });
    const out = await signer.signProfiles([profile('a', 'a/1.jpg'), profile('b', 'b/1.jpg')]);
    expect('imageUrl' in out[0].avatar).toBe(false);
    expect(out[1].avatar.imageUrl).toBe('https://x/sign/b/1.jpg');
  });

  it('avisa de que hay URLs por caducar antes de que caduquen (para releer lo ya pintado)', async () => {
    const { signer, onStale, fireTimer, clock } = setup();
    await signer.signProfiles([profile('a', 'a/1.jpg')]);
    const signedAt = clock.value;

    const timer = fireTimer();

    expect(timer.ms).toBeLessThan(SIGNED_URL_TTL_SECONDS * 1000 - REFRESH_MARGIN_MS + 2000);
    expect(clock.value - signedAt).toBeLessThan(SIGNED_URL_TTL_SECONDS * 1000);
    expect(onStale).toHaveBeenCalledTimes(1);
  });

  it('tras avisar, la relectura firma de nuevo y se vuelve a armar', async () => {
    const { signer, createSignedUrls, fireTimer, timers } = setup();
    await signer.signProfiles([profile('a', 'a/1.jpg')]);
    fireTimer();

    const out = await signer.signProfiles([profile('a', 'a/1.jpg')]);

    expect(createSignedUrls).toHaveBeenCalledTimes(2);
    expect(out[0].avatar.imageUrl).toBe('https://x/sign/a/1.jpg?n=2');
    expect(timers.filter((t) => t.live)).toHaveLength(1);
  });

  it('al volver a primer plano avisa solo si alguna URL está en el margen', async () => {
    const { signer, onStale, foreground, clock } = setup();
    await signer.signProfiles([profile('a', 'a/1.jpg')]);

    foreground.callback?.();
    expect(onStale).not.toHaveBeenCalled();

    clock.value += SIGNED_URL_TTL_SECONDS * 1000 - REFRESH_MARGIN_MS + 1;
    foreground.callback?.();
    expect(onStale).toHaveBeenCalledTimes(1);
  });

  it('clear() descarta la caché', async () => {
    const { signer, createSignedUrls } = setup();
    await signer.signProfiles([profile('a', 'a/1.jpg')]);
    signer.clear();
    await signer.signProfiles([profile('a', 'a/1.jpg')]);
    expect(createSignedUrls).toHaveBeenCalledTimes(2);
  });
});
