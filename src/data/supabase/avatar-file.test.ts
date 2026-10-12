import { readLocalImage } from './avatar-file';

describe('readLocalImage', () => {
  const realFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('devuelve los bytes del archivo como JPEG', async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff]).buffer;
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => bytes,
    }) as never;

    await expect(readLocalImage('file:///a.jpg')).resolves.toEqual({
      bytes,
      contentType: 'image/jpeg',
    });
  });

  it('si no se puede leer, lo dice en vez de subir un archivo vacío', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false }) as never;

    await expect(readLocalImage('file:///a.jpg')).rejects.toThrow('No se ha podido leer la foto.');
  });
});
