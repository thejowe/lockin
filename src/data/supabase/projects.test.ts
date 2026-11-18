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
