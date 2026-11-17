import type { ChatPlanRepository, ChatScope } from '../chat-plan';
import { isBlockedPair, type MockStore } from './store';

export function createMockChatPlan(store: MockStore, actorId: string): ChatPlanRepository {
  function isMember(scope: ChatScope) {
    const state = store.state;
    if (scope.kind === 'group') {
      return state.groupMembers.some((m) => m.groupId === scope.id && m.userId === actorId);
    }
    const match = state.matches.find((m) => m.id === scope.id);
    return (
      !!match && match.profileIds.includes(actorId) && !isBlockedPair(state, ...match.profileIds)
    );
  }

  function visible(scope: ChatScope) {
    if (!isMember(scope)) return [];
    return store.state.chatPlan.filter(
      (item) =>
        item.scope.kind === scope.kind &&
        item.scope.id === scope.id &&
        !isBlockedPair(store.state, actorId, item.authorId)
    );
  }

  return {
    async list(scope) {
      return visible(scope).map(({ id, title, startsAt, place, closed }) => ({
        id,
        title,
        startsAt,
        place,
        closed,
      }));
    },
    async add(scope, draft) {
      if (!isMember(scope)) throw new Error('Conversation unavailable');
      const existing = visible(scope).find((item) => item.id === draft.id);
      if (existing?.authorId === actorId) return;
      if (
        store.state.chatPlan.some((item) => item.id === draft.id) ||
        !draft.title.trim() ||
        draft.title.length > 160 ||
        (draft.place?.length ?? 0) > 240 ||
        (draft.startsAt === null
          ? draft.place !== null
          : !(Date.parse(draft.startsAt) > store.nowMs()))
      ) {
        throw new Error('Invalid plan item');
      }
      store.state.chatPlan.push({ ...draft, scope, authorId: actorId, closed: false });
    },
    async setClosed(scope, id, closed) {
      const item = visible(scope).find((item) => item.id === id);
      if (!item) throw new Error('Plan item unavailable');
      item.closed = closed;
    },
  };
}
