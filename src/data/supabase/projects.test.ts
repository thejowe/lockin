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

it('promueve y retira únicamente la revisión elegida y conserva el conflicto de una revisión antigua', async () => {
  const { repo, invoke } = fixture();
  const version = { id: 'proyecto', revision: 'r1' };
  await repo.promote(version);
  await repo.remove(version);
  expect(invoke.mock.calls.map(([, args]) => args.body)).toEqual([
    { action: 'promote', previous: version },
    { action: 'remove', previous: version },
  ]);
  invoke.mockResolvedValue({ error: { context: { json: async () => ({ error: 'conflict' }) } } });
  await expect(repo.remove(version)).rejects.toThrow(/ha cambiado/);
});

it('no inicia una subida con datos de ficha inválidos ni confirma una foto que no llegó a Storage', async () => {
  const { repo, invoke, upload, remove } = fixture();
  for (const invalid of [
    { name: '   ' },
    { name: 'X'.repeat(101) },
    { tagline: '' },
    { description: 'x'.repeat(5001) },
    { description: 'puta' },
    { link: 'javascript:alert(1)' },
    { photos: Array(6).fill({ uri: 'file:///a.jpg' }) },
  ])
    await expect(repo.save({ ...input, ...invalid })).rejects.toThrow();
  expect(upload).not.toHaveBeenCalled();
  upload.mockResolvedValueOnce({ error: new Error('offline') });
  await expect(repo.save(input)).rejects.toThrow(/subir la foto/);
  expect(invoke).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
});

it('mantiene la explicación de las fotos bloqueadas para cada modo de guardado', async () => {
  const { repo, invoke } = fixture();
  invoke.mockResolvedValue({
    error: { context: { json: async () => ({ error: 'photos-locked' }) } },
  });
  await expect(repo.save(input, undefined, 'p', 'match')).rejects.toThrow(/proyectos compartidos/);
  await expect(
    repo.createForGroup(input, 'p', {
      name: 'Equipo',
      description: 'Proyecto piloto',
      roles: [{ specialty: 'dev', slots: 1 }],
    })
  ).rejects.toThrow(/grupos de proyecto/);
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

function serverResponses(...responses: { data: unknown; status?: number }[]) {
  const fetch = jest.fn(async (_request: RequestInfo | URL, _init?: RequestInit) => {
    const response = responses.shift();
    if (!response) throw new Error('Petición inesperada');
    return new Response(JSON.stringify(response.data), {
      status: response.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  const client = createClient<Database>('https://example.supabase.co', 'test-key', {
    global: { fetch },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const repo = supabaseProjects(
    () => client,
    async () => 'reader'
  );
  return { repo, fetch };
}

const workspace = {
  project_id: 'p',
  project_revision: 'revision',
  published: false,
  proposed_by: 'partner',
  has_capacity: true,
  notes: 'Primera nota',
  notes_by: 'reader',
  notes_revision: 'notes-v2',
};
const projectRow = {
  id: 'p',
  owner_id: 'reader',
  revision: 'revision',
  name: 'Atlas',
  tagline: 'Mapas',
  cover_path: null,
  photo_paths: [],
  project_authors: [{ profiles: null }],
  published: false,
  detached: false,
};

it('relee una sola vez si el consentimiento pertenece a otra versión de la ficha', async () => {
  const { repo, fetch } = serverResponses(
    { data: [workspace] },
    { data: [{ ...projectRow, revision: 'antigua' }] },
    { data: [workspace] },
    { data: [projectRow] }
  );
  await expect(repo.workspace('match')).resolves.toMatchObject({
    project: { id: 'p', authors: [] },
    published: false,
    proposedBy: 'partner',
    hasCapacity: true,
    notes: workspace.notes,
    notesBy: 'reader',
    notesRevision: 'notes-v2',
  });
  expect(fetch).toHaveBeenCalledTimes(4);
});

it('rechaza un segundo conflicto, conserva los fallos del servidor y distingue un espacio vacío', async () => {
  const error = { code: '42501', message: 'private' };
  const { repo } = serverResponses(
    { data: [workspace] },
    { data: [] },
    { data: [workspace] },
    { data: [] },
    { data: error, status: 403 },
    { data: [workspace] },
    { data: error, status: 403 },
    { data: [] }
  );
  await expect(repo.workspace('m')).rejects.toThrow(/ha cambiado/);
  await expect(repo.workspace('m')).rejects.toMatchObject(error);
  await expect(repo.workspace('m')).rejects.toMatchObject(error);
  await expect(repo.workspace('m')).resolves.toBeNull();
});

it('la lista propia filtra los privados y ordena por la promoción del autor consultado', async () => {
  const { repo, fetch } = serverResponses({
    data: [
      { ...projectRow, id: 'primero', listed: [] },
      { ...projectRow, id: 'destacado', listed: [{ promoted_at: '2026-11-01T00:00:00Z' }] },
    ],
  });
  expect((await repo.list('reader', { includePrivate: true })).map((p) => p.id)).toEqual([
    'destacado',
    'primero',
  ]);
  expect(new URL(String(fetch.mock.calls[0][0])).searchParams.get('or')).toBe(
    '(published.eq.true,detached.eq.true)'
  );
});

it('lee el último evento de borrado con su autor y comunica un fallo de lectura', async () => {
  const { repo, fetch } = serverResponses(
    { data: [] },
    { data: [{ id: 'evento', actor_id: 'pareja' }] },
    { data: { message: 'denied' }, status: 403 }
  );
  await expect(repo.lastDeletion('m')).resolves.toBeNull();
  await expect(repo.lastDeletion('m')).resolves.toEqual({ id: 'evento', actorId: 'pareja' });
  await expect(repo.lastDeletion('m')).rejects.toMatchObject({ message: 'denied' });
  const params = new URL(String(fetch.mock.calls[0][0])).searchParams;
  expect(params.get('kind')).toBe('eq.deleted');
  expect(params.get('match_id')).toBe('eq.m');
  expect(params.get('limit')).toBe('1');
});

it('envía la revisión mostrada para consentir la publicación y para guardar notas', async () => {
  const { repo, fetch } = serverResponses({ data: null }, { data: null });
  await repo.publication({ id: 'p', revision: 'r1' }, 'accept');
  await repo.saveNotes('p', 'Notas nuevas', 'r2');
  expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({
    p_project_id: 'p',
    p_revision: 'r1',
    p_action: 'accept',
  });
  expect(JSON.parse(String(fetch.mock.calls[1][1]?.body))).toEqual({
    p_project_id: 'p',
    p_revision: 'r2',
    p_text: 'Notas nuevas',
  });
});

it.each([
  ['PJ423', /fotos/],
  ['PJ409', /ha cambiado/],
  ['PJ003', /tres proyectos/],
  ['42501', /guardar/],
])('traduce %s en la publicación y la edición de notas', async (code, message) => {
  const failure = { data: { code, message: 'server' }, status: 403 };
  const { repo } = serverResponses(failure, failure);
  await expect(repo.publication({ id: 'p', revision: 'r' }, 'accept')).rejects.toThrow(message);
  await expect(repo.saveNotes('p', '', 'r')).rejects.toThrow(message);
});

it('una firma personal ausente o una sesión compartida ausente impiden exponer una foto', async () => {
  const { repo } = serverResponses(
    { data: [{ ...projectRow, cover_path: 'reader/project.jpg', listed: [] }] },
    { data: [{ path: 'reader/project.jpg', error: 'missing' }] },
    { data: [{ ...projectRow, cover_path: 'shared/p/project.jpg', listed: [] }] }
  );
  await expect(repo.list('reader')).rejects.toThrow(/cargar la foto/);
  await expect(repo.list('reader')).rejects.toThrow(/cargar la foto/);
});

it('libera las subidas tras un error de escritura aun si falla la limpieza del cliente', async () => {
  const { repo, invoke, remove } = fixture();
  remove.mockRejectedValue(new Error('sin red'));
  invoke.mockResolvedValue({ error: { context: { json: async () => ({ error: 'full' }) } } });
  await expect(repo.save(input)).rejects.toThrow(/tres proyectos/);
  expect(remove).toHaveBeenCalledTimes(1);
});
