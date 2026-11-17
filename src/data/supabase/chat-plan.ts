import type { ChatPlanRepository, ChatScope } from '../chat-plan';
import type { LockInSupabaseClient } from './client';
import { fetchAllPages } from './pagination';

const column = (scope: ChatScope) => (scope.kind === 'match' ? 'match_id' : 'group_id');

export function createSupabaseChatPlan(
  getClient: () => LockInSupabaseClient,
  getUserId: () => Promise<string>
): ChatPlanRepository {
  const items = () => getClient().from('chat_plan_items');
  return {
    async list(scope) {
      await getUserId();
      const rows = await fetchAllPages((from, to) =>
        items()
          .select('id,title,starts_at,place,closed')
          .eq(column(scope), scope.id)
          .order('created_at')
          .order('id')
          .range(from, to)
      );
      return rows.map(({ id, title, starts_at, place, closed }) => ({
        id,
        title,
        startsAt: starts_at,
        place,
        closed,
      }));
    },
    async add(scope, draft) {
      const userId = await getUserId();
      const { error } = await items().insert({
        id: draft.id,
        title: draft.title,
        starts_at: draft.startsAt,
        place: draft.place,
        match_id: scope.kind === 'match' ? scope.id : null,
        group_id: scope.kind === 'group' ? scope.id : null,
      });
      if (!error) return;
      // Si se perdió la respuesta al primer envío, el borrador conserva su id.
      if (error.code === '23505') {
        const { data } = await items()
          .select('id')
          .eq(column(scope), scope.id)
          .eq('author_id', userId)
          .eq('id', draft.id)
          .maybeSingle();
        if (data) return;
      }
      throw error;
    },
    async setClosed(scope, id, closed) {
      await getUserId();
      const { error } = await items()
        .update({ closed })
        .eq(column(scope), scope.id)
        .eq('id', id)
        .select('id')
        .single();
      if (error) throw error;
    },
  };
}
