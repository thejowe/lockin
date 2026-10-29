/**
 * Tests del cliente del tablón contra Supabase.
 *
 * Como la foto de perfil: la imagen se deja en `avatar-uploads/` y la Edge
 * Function `moderate-board` decide si se publica. Lo que se prueba es que una
 * subida fallida no llega a la función, que cualquier rechazo o respuesta rara
 * de la función sea un `BoardRejectedError` (falla cerrado) y que leer firme las
 * URLs del bucket privado sin inventarse ninguna.
 */

import { BoardRejectedError } from '../repositories';

import { addBoardPost, listBoardPosts, removeBoardPost } from './board';

import type { LockInSupabaseClient } from './client';

jest.mock('./avatar-file', () => ({
  readLocalImage: jest
    .fn()
    .mockResolvedValue({ bytes: new ArrayBuffer(8), contentType: 'image/jpeg' }),
}));

type InvokeResult = { data: unknown; error: unknown };

function httpError(error: unknown) {
  return { context: { status: 422, json: async () => ({ error }) } };
}

const row = (id: string, path: string) => ({
  id,
  owner_id: 'u1',
  image_path: path,
  caption: `pie ${id}`,
  created_at: `2026-10-1${id}T10:00:00Z`,
});

function fakeClient(
  opts: {
    rows?: unknown[] | null;
    selectError?: unknown;
    signed?: { path: string; signedUrl: string | null }[] | null;
    signedOne?: { signedUrl: string } | null;
    uploadError?: boolean;
    invoke?: InvokeResult;
  } = {}
) {
  const calls: string[] = [];
  const query: Record<string, jest.Mock> = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    order: jest.fn(async () => ({
      data: opts.rows === undefined ? [] : opts.rows,
      error: opts.selectError ?? null,
    })),
  };
  const bucket = {
    upload: jest.fn(async (path: string) => {
      calls.push(`upload:${path}`);
      return opts.uploadError
        ? { data: null, error: { message: 'boom' } }
        : { data: { path }, error: null };
    }),
    createSignedUrls: jest.fn(async () => ({ data: opts.signed ?? null, error: null })),
    createSignedUrl: jest.fn(async () => ({
      data: opts.signedOne === undefined ? { signedUrl: 'https://firmada/una' } : opts.signedOne,
      error: null,
    })),
  };
  const invoke = jest.fn(async (_name: string, init: { body: unknown }) => {
    calls.push(`invoke:${JSON.stringify(init.body)}`);
    return (
      opts.invoke ?? {
        data: {
          post: {
            id: 'p9',
            ownerId: 'u1',
            imagePath: 'u1/p9.jpg',
            caption: 'mi pie',
            createdAt: '2026-10-18T09:00:00Z',
          },
        },
        error: null,
      }
    );
  });
  const storageFrom = jest.fn((name: string) => {
    calls.push(`bucket:${name}`);
    return bucket;
  });
  const client = {
    from: jest.fn(() => query),
    storage: { from: storageFrom },
    functions: { invoke },
  } as unknown as LockInSupabaseClient;
  return { client, calls, bucket, invoke, query, storageFrom };
}

describe('listBoardPosts', () => {
  it('lee las fotos de esa persona, más recientes primero, con URL firmada de una hora', async () => {
    const { client, query, bucket } = fakeClient({
      rows: [row('2', 'u1/b.jpg'), row('1', 'u1/a.jpg')],
      signed: [
        { path: 'u1/b.jpg', signedUrl: 'https://firmada/b' },
        { path: 'u1/a.jpg', signedUrl: 'https://firmada/a' },
      ],
    });

    const posts = await listBoardPosts(client, 'u1');

    expect(query.eq).toHaveBeenCalledWith('owner_id', 'u1');
    expect(query.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(bucket.createSignedUrls).toHaveBeenCalledWith(['u1/b.jpg', 'u1/a.jpg'], 3600);
    expect(posts).toEqual([
      {
        id: '2',
        ownerId: 'u1',
        imageUrl: 'https://firmada/b',
        caption: 'pie 2',
        createdAt: '2026-10-12T10:00:00Z',
      },
      {
        id: '1',
        ownerId: 'u1',
        imageUrl: 'https://firmada/a',
        caption: 'pie 1',
        createdAt: '2026-10-11T10:00:00Z',
      },
    ]);
  });

  it('sin fotos no pide ninguna firma', async () => {
    const { client, bucket } = fakeClient({ rows: null });

    await expect(listBoardPosts(client, 'u1')).resolves.toEqual([]);
    expect(bucket.createSignedUrls).not.toHaveBeenCalled();
  });

  it('una foto que no se pudo firmar queda sin URL en vez de inventarse una', async () => {
    const { client } = fakeClient({
      rows: [row('1', 'u1/a.jpg'), row('2', 'u1/b.jpg'), row('3', 'u1/c.jpg')],
      signed: [
        { path: 'u1/a.jpg', signedUrl: null },
        { path: 'u1/b.jpg', signedUrl: 'https://firmada/b' },
      ],
    });

    const posts = await listBoardPosts(client, 'u1');

    expect(posts.map((post) => post.imageUrl)).toEqual([null, 'https://firmada/b', null]);
  });

  it('si la firma entera falla, las fotos siguen listándose sin URL', async () => {
    const { client } = fakeClient({ rows: [row('1', 'u1/a.jpg')], signed: null });

    const posts = await listBoardPosts(client, 'u1');

    expect(posts).toHaveLength(1);
    expect(posts[0].imageUrl).toBeNull();
  });

  it('propaga un error de la consulta', async () => {
    const failure = new Error('RLS');
    const { client } = fakeClient({ selectError: failure });

    await expect(listBoardPosts(client, 'u1')).rejects.toBe(failure);
  });
});

describe('addBoardPost', () => {
  it('sube a avatar-uploads/<uid>/ y pide a moderate-board que la publique con su pie', async () => {
    const { client, calls, bucket } = fakeClient();

    const post = await addBoardPost(client, 'u1', 'file:///foto.jpg', 'mi pie');

    expect(calls[0]).toBe('bucket:avatar-uploads');
    expect(calls[1]).toMatch(/^upload:u1\/[\w-]+\.jpg$/);
    const path = calls[1].slice('upload:'.length);
    expect(calls[2]).toBe(`invoke:${JSON.stringify({ action: 'add', path, caption: 'mi pie' })}`);
    expect(bucket.upload).toHaveBeenCalledWith(path, expect.any(ArrayBuffer), {
      contentType: 'image/jpeg',
      upsert: false,
    });
    expect(calls[3]).toBe('bucket:board');
    expect(bucket.createSignedUrl).toHaveBeenCalledWith('u1/p9.jpg', 3600);
    expect(post).toEqual({
      id: 'p9',
      ownerId: 'u1',
      imageUrl: 'https://firmada/una',
      caption: 'mi pie',
      createdAt: '2026-10-18T09:00:00Z',
    });
  });

  it('sin crypto.randomUUID el nombre sigue siendo único y .jpg', async () => {
    const original = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    try {
      const { client, calls } = fakeClient();
      await addBoardPost(client, 'u1', 'file:///foto.jpg', '');
      expect(calls[1]).toMatch(/^upload:u1\/[a-z0-9]+-[a-z0-9]+\.jpg$/);
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: original, configurable: true });
    }
  });

  it('publicada pero sin firma, la foto vuelve sin URL', async () => {
    const { client } = fakeClient({ signedOne: null });

    const post = await addBoardPost(client, 'u1', 'file:///foto.jpg', 'mi pie');

    expect(post.imageUrl).toBeNull();
  });

  it('si la subida falla no invoca la función', async () => {
    const { client, invoke } = fakeClient({ uploadError: true });

    await expect(addBoardPost(client, 'u1', 'file:///foto.jpg', 'x')).rejects.toThrow(
      'No se ha podido subir la foto'
    );
    expect(invoke).not.toHaveBeenCalled();
  });

  it.each(['flagged', 'invalid-image', 'board-full'] as const)(
    'traduce el rechazo «%s» de la función',
    async (reason) => {
      const { client } = fakeClient({ invoke: { data: null, error: httpError(reason) } });

      const failure = await addBoardPost(client, 'u1', 'file:///foto.jpg', 'x').catch(
        (cause: unknown) => cause
      );

      expect(failure).toBeInstanceOf(BoardRejectedError);
      expect((failure as BoardRejectedError).reason).toBe(reason);
    }
  );

  it.each([
    ['un motivo que la app no conoce', { data: null, error: httpError('otro') }],
    [
      'un cuerpo ilegible',
      {
        data: null,
        error: {
          context: {
            json: async () => {
              throw new SyntaxError('no es JSON');
            },
          },
        },
      },
    ],
    ['un error sin respuesta HTTP', { data: null, error: new Error('red') }],
    ['un error nulo y sin foto', { data: { post: { id: 7 } }, error: null }],
  ])('con %s falla cerrado como «no disponible»', async (_label, result) => {
    const { client, bucket } = fakeClient({ invoke: result });

    await expect(addBoardPost(client, 'u1', 'file:///foto.jpg', 'x')).rejects.toMatchObject({
      reason: 'unavailable',
    });
    expect(bucket.createSignedUrl).not.toHaveBeenCalled();
  });
});

describe('removeBoardPost', () => {
  it('pide a la función que la quite', async () => {
    const { client, invoke } = fakeClient({ invoke: { data: {}, error: null } });

    await expect(removeBoardPost(client, 'p1')).resolves.toBeUndefined();
    expect(invoke).toHaveBeenCalledWith('moderate-board', {
      body: { action: 'remove', postId: 'p1' },
    });
  });

  it('si la función falla, lo dice', async () => {
    const { client } = fakeClient({ invoke: { data: null, error: new Error('caída') } });

    await expect(removeBoardPost(client, 'p1')).rejects.toThrow('No se ha podido quitar la foto');
  });
});
