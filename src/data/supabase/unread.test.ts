import { createSupabaseUnreadRepository } from './unread';
import type { LockInSupabaseClient } from './client';

function fixture() {
  const rpc = jest.fn();
  const getUserId = jest.fn().mockResolvedValue('reader');
  const repo = createSupabaseUnreadRepository({
    getUserId,
    getClient: () => ({ rpc }) as unknown as LockInSupabaseClient,
  });
  return { rpc, repo, getUserId };
}

it('suma los mensajes manteniendo contadores separados para grupos y matches con el mismo id', async () => {
  const { rpc, repo, getUserId } = fixture();
  rpc.mockResolvedValueOnce({ data: null }).mockResolvedValueOnce({
    data: [
      { chat_kind: 'match', chat_id: 'same', unread: 2 },
      { chat_kind: 'group', chat_id: 'same', unread: 3 },
    ],
  });
  await expect(repo.counts()).resolves.toEqual({ byMatch: {}, byGroup: {}, total: 0 });
  await expect(repo.counts()).resolves.toEqual({
    byMatch: { same: 2 },
    byGroup: { same: 3 },
    total: 5,
  });
  expect(getUserId).toHaveBeenCalledTimes(2);
  expect(rpc).toHaveBeenCalledWith('unread_message_counts');
});

it('notifica una lectura solo cuando el servidor la confirma y respeta la baja del oyente', async () => {
  const { rpc, repo } = fixture();
  const listener = jest.fn();
  const unsubscribe = repo.subscribe(listener);
  const error = new Error('sin conexión');
  rpc
    .mockResolvedValueOnce({ error })
    .mockResolvedValueOnce({ error })
    .mockResolvedValue({ error: null });
  await expect(repo.counts()).rejects.toBe(error);
  await expect(repo.markGroupRead('g')).rejects.toBe(error);
  expect(listener).not.toHaveBeenCalled();
  await repo.markMatchRead('m');
  expect(rpc).toHaveBeenCalledWith('mark_chat_read', { p_kind: 'match', p_chat_id: 'm' });
  expect(listener).toHaveBeenCalledTimes(1);
  unsubscribe();
  await repo.markGroupRead('g');
  expect(rpc).toHaveBeenLastCalledWith('mark_chat_read', { p_kind: 'group', p_chat_id: 'g' });
  expect(listener).toHaveBeenCalledTimes(1);
});
