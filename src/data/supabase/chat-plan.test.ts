import { createClient } from '@supabase/supabase-js';
import { createSupabaseChatPlan } from './chat-plan';
import type { Database } from './database.types';

function setup() {
  const fetch = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();
  const client = createClient<Database>('https://example.supabase.co', 'test-key', {
    global: { fetch },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const repo = createSupabaseChatPlan(
    () => client,
    async () => 'author'
  );
  function reply(status: number, body: unknown) {
    fetch.mockResolvedValueOnce(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      })
    );
  }
  return { fetch, repo, reply };
}

const draft = { id: 'item', title: 'Primera entrevista', startsAt: null, place: null };
it.each(['group', 'match'] as const)(
  'lee y actualiza el plan del chat %s por su columna',
  async (kind) => {
    const { repo, fetch, reply } = setup();
    const scope = { kind, id: 'chat' };
    reply(201, null);
    await repo.add(scope, draft);
    const [, init] = fetch.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toEqual({
      id: 'item',
      title: draft.title,
      starts_at: null,
      place: null,
      group_id: kind === 'group' ? 'chat' : null,
      match_id: kind === 'match' ? 'chat' : null,
    });
    reply(200, [{ id: 'item', title: draft.title, starts_at: null, place: null, closed: false }]);
    expect(await repo.list(scope)).toEqual([{ ...draft, closed: false }]);
    reply(200, { id: 'item' });
    await repo.setClosed(scope, draft.id, true);
    const [url, update] = fetch.mock.calls[2];
    expect(String(url)).toContain(`${kind}_id=eq.chat`);
    expect(String(url)).toContain('id=eq.item');
    expect(update?.method).toBe('PATCH');
    expect(JSON.parse(String(update?.body))).toEqual({ closed: true });
  }
);

it('un reintento solo se acepta si el id ya está en ese chat y es del autor', async () => {
  const { repo, fetch, reply } = setup();
  const scope = { kind: 'match' as const, id: 'chat' };
  reply(409, { code: '23505' });
  reply(200, [{ id: 'item' }]);
  await repo.add(scope, draft);
  const url = String(fetch.mock.calls[1][0]);
  expect(url).toContain('author_id=eq.author');
  expect(url).toContain('match_id=eq.chat');
  reply(409, { code: '23505' });
  reply(200, []);
  await expect(repo.add(scope, draft)).rejects.toMatchObject({ code: '23505' });
});

it('la edición de tareas exige la revisión leída y comunica el conflicto si no queda ninguna fila', async () => {
  const { repo, fetch, reply } = setup();
  const scope = { kind: 'match' as const, id: 'm' };
  const details = { assigneeId: null, dueAt: null, status: 'done' as const };
  reply(200, []);
  await expect(repo.updateTask(scope, 'item', details, 'r1')).rejects.toThrow();
  expect(new URL(String(fetch.mock.calls[0][0])).searchParams.get('revision')).toBe('eq.r1');
  reply(200, [{ id: 'item' }]);
  await repo.updateTask(scope, 'item', details);
  expect(new URL(String(fetch.mock.calls[1][0])).searchParams.has('revision')).toBe(false);
  expect(JSON.parse(String(fetch.mock.calls[1][1]?.body))).toEqual({
    assignee_id: null,
    due_at: null,
    status: 'done',
  });
  reply(403, { code: '42501' });
  await expect(repo.updateTask(scope, 'item', details, 'r2')).rejects.toMatchObject({
    code: '42501',
  });
});
