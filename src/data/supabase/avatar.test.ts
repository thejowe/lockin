/**
 * Tests del cliente de la foto de perfil.
 *
 * El cliente solo deja el archivo en `avatar-uploads/` y pide a la Edge Function
 * `moderate-avatar` que lo publique: lo que se prueba aquí es el orden, que no
 * se invoque nada si la subida falla, y que cualquier fallo de la revisión sea
 * un error con mensaje (falla cerrado), nunca una foto publicada.
 */

import { AvatarRejectedError, deleteAvatar, uploadAvatar } from './avatar';

import type { LockInSupabaseClient } from './client';

jest.mock('./avatar-file', () => ({
  readLocalImage: jest
    .fn()
    .mockResolvedValue({ bytes: new ArrayBuffer(8), contentType: 'image/jpeg' }),
}));

type InvokeResult = { data: unknown; error: unknown };

function httpError(status: number, error: string) {
  return { context: { status, json: async () => ({ error }) } };
}

function fakeClient(opts: { uploadError?: boolean; invoke?: InvokeResult } = {}) {
  const calls: string[] = [];
  const bucket = {
    upload: jest.fn(async (path: string) => {
      calls.push(`upload:${path}`);
      return opts.uploadError
        ? { data: null, error: { message: 'boom' } }
        : { data: { path }, error: null };
    }),
    remove: jest.fn(async (paths: string[]) => {
      calls.push(`remove:${paths.join(',')}`);
      return { data: [], error: null };
    }),
  };
  const invoke = jest.fn(async (_name: string, init: { body: unknown }) => {
    calls.push(`invoke:${JSON.stringify(init.body)}`);
    return opts.invoke ?? { data: { avatarUrl: 'https://x/avatars/u1/n.jpg' }, error: null };
  });
  const client = {
    storage: { from: jest.fn(() => bucket) },
    functions: { invoke },
  } as unknown as LockInSupabaseClient;
  return { client, calls, bucket, invoke };
}

describe('uploadAvatar', () => {
  it('sube a avatar-uploads/<uid>/<uuid>.jpg y pide a la función que la publique', async () => {
    const { client, calls } = fakeClient();

    const url = await uploadAvatar(client, 'u1', 'file:///a.jpg');

    expect(url).toBe('https://x/avatars/u1/n.jpg');
    expect(calls[0]).toMatch(/^upload:u1\/[\w-]+\.jpg$/);
    expect(calls[1]).toMatch(/^invoke:\{"action":"set","path":"u1\/[\w-]+\.jpg"\}$/);
  });

  it('si la subida falla no invoca la función', async () => {
    const { client, invoke } = fakeClient({ uploadError: true });

    await expect(uploadAvatar(client, 'u1', 'file:///a.jpg')).rejects.toThrow(/subir la foto/i);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('foto marcada: AvatarRejectedError flagged con el mensaje de normas', async () => {
    const { client } = fakeClient({
      invoke: { data: null, error: httpError(422, 'flagged') },
    });

    const failure = await uploadAvatar(client, 'u1', 'file:///a.jpg').catch((e) => e);

    expect(failure).toBeInstanceOf(AvatarRejectedError);
    expect(failure.reason).toBe('flagged');
    expect(failure.message).toBe(
      'Esta foto no cumple las normas de la comunidad. Prueba con otra.'
    );
  });

  it('imagen inválida: invalid-image', async () => {
    const { client } = fakeClient({
      invoke: { data: null, error: httpError(422, 'invalid-image') },
    });

    const failure = await uploadAvatar(client, 'u1', 'file:///a.jpg').catch((e) => e);

    expect(failure.reason).toBe('invalid-image');
  });

  it('dos cambios a la vez: conflict, con mensaje para reintentar', async () => {
    const { client } = fakeClient({
      invoke: { data: null, error: httpError(409, 'conflict') },
    });

    const failure = await uploadAvatar(client, 'u1', 'file:///a.jpg').catch((e) => e);

    expect(failure.reason).toBe('conflict');
    expect(failure.message).toMatch(/Inténtalo de nuevo/);
  });

  it('proveedor caído: «inténtalo más tarde», sin culpar a la foto', async () => {
    const { client } = fakeClient({
      invoke: { data: null, error: httpError(503, 'unavailable') },
    });

    const failure = await uploadAvatar(client, 'u1', 'file:///a.jpg').catch((e) => e);

    expect(failure.reason).toBe('unavailable');
    expect(failure.message).toMatch(/más tarde/);
  });

  it('un error de red de la invocación también falla cerrado', async () => {
    const { client } = fakeClient({ invoke: { data: null, error: new Error('Failed to fetch') } });

    const failure = await uploadAvatar(client, 'u1', 'file:///a.jpg').catch((e) => e);

    expect(failure).toBeInstanceOf(AvatarRejectedError);
    expect(failure.reason).toBe('unavailable');
  });

  it('una respuesta sin avatarUrl no se da por buena', async () => {
    const { client } = fakeClient({ invoke: { data: {}, error: null } });

    const failure = await uploadAvatar(client, 'u1', 'file:///a.jpg').catch((e) => e);

    expect(failure.reason).toBe('unavailable');
  });
});

describe('deleteAvatar', () => {
  it('deleteAvatar invoca la acción remove', async () => {
    const { client, calls } = fakeClient({ invoke: { data: { avatarUrl: null }, error: null } });

    await deleteAvatar(client);

    expect(calls).toEqual(['invoke:{"action":"remove"}']);
  });

  it('deleteAvatar con la función caída lanza «más tarde»', async () => {
    const { client } = fakeClient({ invoke: { data: null, error: new Error('red') } });

    await expect(deleteAvatar(client)).rejects.toMatchObject({ reason: 'unavailable' });
  });
});
