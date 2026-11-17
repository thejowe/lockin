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
