import {
  PlanConflictError,
  type ChatPlanRepository,
  type ChatScope,
  type TaskDetails,
} from '../chat-plan';
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

  function validateDetails(scope: ChatScope, details: Partial<TaskDetails>, meeting: boolean) {
    const joint = [...store.state.jointProjects.values()].find((project) =>
      scope.kind === 'group' ? project.groupId === scope.id : project.matchId === scope.id
    );
    if (
      meeting ||
      !joint?.authorIds.includes(actorId) ||
      (details.assigneeId != null && !joint.authorIds.includes(details.assigneeId)) ||
      (details.dueAt != null && !Number.isFinite(Date.parse(details.dueAt))) ||
      (details.status !== undefined && !['pending', 'in_progress', 'done'].includes(details.status))
    )
      throw new Error('Invalid task details');
  }
  return {
    async list(scope) {
      return visible(scope).map(
        ({ id, title, startsAt, place, closed, assigneeId, dueAt, status, revision }) => ({
          id,
          title,
          startsAt,
          place,
          closed,
          assigneeId: assigneeId ?? null,
          dueAt: dueAt ?? null,
          status: status ?? (closed && !startsAt ? 'done' : 'pending'),
          revision,
        })
      );
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
      if (
        (draft.status !== undefined && draft.status !== 'pending') ||
        draft.assigneeId != null ||
        draft.dueAt != null
      )
        validateDetails(scope, draft, draft.startsAt !== null);
      store.state.chatPlan.push({
        ...draft,
        scope,
        authorId: actorId,
        closed: draft.status === 'done',
        revision: store.createId('plan-revision'),
      });
      store.notify('project-notifications');
    },
    async updateTask(scope, id, details, revision) {
      const item = visible(scope).find((row) => row.id === id);
      if (!item) throw new Error('Plan item unavailable');
      if (revision && item.revision !== revision) throw new PlanConflictError();
      validateDetails(scope, details, item.startsAt !== null);
      Object.assign(item, details, {
        closed: details.status === 'done',
        revision: store.createId('plan-revision'),
      });
      store.notify('project-notifications');
    },
    async setClosed(scope, id, closed) {
      const item = visible(scope).find((item) => item.id === id);
      if (!item) throw new Error('Plan item unavailable');
      item.closed = closed;
      item.revision = store.createId('plan-revision');
      if (!item.startsAt) item.status = closed ? 'done' : 'pending';
      store.notify('project-notifications');
    },
  };
}
