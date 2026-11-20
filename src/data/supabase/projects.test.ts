import { createClient, type Session } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { supabaseProjects } from './projects';
import type { LockInSupabaseClient } from './client';
import type { ProjectInput } from '../projects';

jest.mock('./avatar-file', () => ({
  readLocalImage: jest.fn(async () => ({ bytes: new ArrayBuffer(8), contentType: 'image/jpeg' })),
}));
const input: ProjectInput = {
  name: 'Atlas',
  tagline: 'Mapas',
  description: '',
  link: '',
  cover: { uri: 'file:///new.jpg' },
  photos: [{ uri: 'https://signed/old', path: 'me/project-old.jpg' }],
};
function fixture() {
  const upload = jest.fn().mockResolvedValue({ error: null });
  const remove = jest.fn().mockResolvedValue({ error: null });
  const invoke = jest.fn().mockResolvedValue({ data: { saved: true }, error: null });
  const storage = jest.fn(() => ({ upload, remove }));
  const repo = supabaseProjects(
    () =>
      ({ storage: { from: storage }, functions: { invoke } }) as unknown as LockInSupabaseClient,
    async () => 'me'
  );
  return { repo, invoke, upload, remove, storage };
}
it('sube solo las fotos nuevas y entrega claves privadas, incluso al editar con URLs firmadas', async () => {
  const { repo, invoke, upload, remove, storage } = fixture();
  await repo.save(input, { id: 'p', revision: 'v' });
  expect(upload).toHaveBeenCalledTimes(1);
  const path = upload.mock.calls[0][0];
  expect(path).toMatch(/^me\/.+\.jpg$/);
  expect(storage).toHaveBeenCalledWith('avatar-uploads');
  expect(invoke).toHaveBeenCalledWith('moderate-project', {
    body: {
      action: 'save',
      name: 'Atlas',
      tagline: 'Mapas',
      link: '',
      description: '',
      previous: { id: 'p', revision: 'v' },
      images: [{ pending: path }, { keep: 'me/project-old.jpg' }],
    },
  });
  expect(remove).toHaveBeenCalledWith([path]);
});
it('un rechazo identifica la foto y libera las subidas pendientes', async () => {
  const { repo, invoke, remove } = fixture();
  invoke.mockResolvedValue({
    error: { context: { json: async () => ({ error: 'flagged', slot: 1 }) } },
  });
  await expect(repo.save(input)).rejects.toMatchObject({ slot: 1 });
  expect(remove).toHaveBeenCalledTimes(1);
});
it('una respuesta ilegible nunca confirma la publicación', async () => {
  const { repo, invoke } = fixture();
  invoke.mockResolvedValue({ data: {}, error: null });
  await expect(repo.save(input)).rejects.toThrow();
});

it('lee la ficha por un coautor y carga las imágenes compartidas con una petición autenticada', async () => {
  const path = 'shared/p/project-cover.jpg';
  const fetch = jest.fn(
    async (_request: RequestInfo | URL) =>
      new Response(
        JSON.stringify([
          {
            id: 'p',
            owner_id: 'first',
            revision: 'r',
            name: 'Atlas',
            tagline: 'Demo',
            link: '',
            description: '',
            cover_path: path,
            photo_paths: [],
            project_authors: [
              {
                profiles: {
                  id: 'first',
                  availability_bands: ['tarde'],
                  work_ranges: [{ start_min: 720, end_min: 1200 }],
                  name: 'Ana',
                  avatar_initials: 'A',
                  avatar_accent: 'brass',
                  prompts: [],
                },
              },
              {
                profiles: {
                  id: 'second',
                  availability_bands: ['tarde'],
                  work_ranges: [{ start_min: 720, end_min: 1200 }],
                  name: 'Pau',
                  avatar_initials: 'P',
                  avatar_accent: 'teal',
                  prompts: [],
                },
              },
            ],
          },
        ]),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
  );
  const client = createClient<Database>('https://example.supabase.co', 'test-key', {
    global: { fetch },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  jest.spyOn(client.auth, 'getSession').mockResolvedValue({
    data: { session: { access_token: 'test-token' } as Session },
    error: null,
  });
  const repo = supabaseProjects(
    () => client,
    async () => 'reader'
  );
  const cards = await repo.list('second');
  expect(cards).toHaveLength(1);
  expect(cards[0].authors?.map((author) => author.id)).toEqual(['first', 'second']);
  expect(cards[0].cover).toMatchObject({
    uri: 'https://example.supabase.co/storage/v1/object/authenticated/board/' + path,
    headers: { Authorization: 'Bearer test-token' },
  });
  expect(fetch).toHaveBeenCalledTimes(1);
  const url = new URL(String(fetch.mock.calls[0][0]));
  expect(url.searchParams.get('listed.user_id')).toBe('eq.second');
  expect(url.searchParams.get('published')).toBe('eq.true');
});
