import { currentUserId, ensureUserId } from './auth';
import { getSupabaseClient } from './client';

jest.mock('./client', () => ({ getSupabaseClient: jest.fn() }));
const auth = { getSession: jest.fn(), signInAnonymously: jest.fn() };
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(getSupabaseClient)
    .mockReturnValue({ auth } as unknown as ReturnType<typeof getSupabaseClient>);
});
it('reutiliza la identidad guardada al arrancar', async () => {
  auth.getSession.mockResolvedValue({
    data: { session: { user: { id: 'existing-user' } } },
    error: null,
  });
  await expect(ensureUserId()).resolves.toBe('existing-user');
  expect(auth.signInAnonymously).not.toHaveBeenCalled();
});
it('un error de renovación no crea otra cuenta y permite recuperar la original', async () => {
  const error = new Error('No se pudo renovar la sesión');
  auth.getSession.mockResolvedValueOnce({ data: { session: null }, error });
  await expect(ensureUserId()).rejects.toBe(error);
  expect(auth.signInAnonymously).not.toHaveBeenCalled();
  auth.getSession.mockResolvedValueOnce({
    data: { session: { user: { id: 'existing-user' } } },
    error: null,
  });
  await expect(ensureUserId()).resolves.toBe('existing-user');
});
it('currentUserId distingue un fallo de una sesión ausente', async () => {
  const error = new Error('Error de almacenamiento');
  auth.getSession.mockResolvedValueOnce({ data: { session: null }, error });
  await expect(currentUserId()).rejects.toBe(error);
  auth.getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
  await expect(currentUserId()).resolves.toBeNull();
});
