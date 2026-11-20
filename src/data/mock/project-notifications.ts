import { mockNotificationSettings, mockPushTokens } from './push';
import { isBlockedPair, type MockStore } from './store';

const DAY = 24 * 60 * 60_000;
const MEETING_LEAD = 15 * 60_000;
type ActivityKind = 'created' | 'proposed' | 'deleted';
type NoticeKind = ActivityKind | 'task' | 'meeting';

interface MockNotice {
  kind: NoticeKind;
  sourceId: string;
  matchId: string;
  at: number;
}
interface MockActivity extends MockNotice {
  kind: ActivityKind;
  projectId: string;
  actorId: string;
}

type Delivery = MockNotice & { token: string; recipient: string };
type Log = { events: MockActivity[]; delivered: Map<string, Delivery> };
const logs = new WeakMap<MockStore['state'], Log>();
const observing = new WeakSet<MockStore>();

function forStore(store: MockStore) {
  let log = logs.get(store.state);
  if (!log) {
    log = { events: [], delivered: new Map() };
    logs.set(store.state, log);
  }
  return log;
}

/** Simulates the server's cron when the test clock moves; no native push APIs. */
export function observeProjectNotifications(store: MockStore) {
  if (observing.has(store)) return;
  observing.add(store);
  store.subscribeTo('project-notifications', () => flushProjectNotifications(store));
}

export function recordProjectActivity(
  store: MockStore,
  kind: ActivityKind,
  matchId: string,
  projectId: string,
  actorId: string
) {
  const log = forStore(store);
  if (kind === 'proposed') {
    log.events = log.events.filter((e) => e.projectId !== projectId || e.kind !== 'proposed');
  }
  const sourceId = store.createId('project-event');
  log.events.push({ kind, matchId, projectId, actorId, sourceId, at: store.nowMs() });
  flushProjectNotifications(store);
  return sourceId;
}

/** Test observation of Expo tickets accepted by the mock devices. */
export function mockProjectPushDeliveries(store: MockStore) {
  return [...forStore(store).delivered.values()];
}

function flushProjectNotifications(store: MockStore) {
  const { state } = store;
  const now = store.nowMs();
  const log = forStore(store);
  const tokens = mockPushTokens(store);
  log.events = log.events.filter((event) => now - event.at <= DAY);
  if (!tokens.size) return;

  function deliver(notice: MockNotice, recipient: string) {
    const { prefs } = mockNotificationSettings(recipient, store);
    const reminder = notice.kind === 'meeting' || notice.kind === 'task';
    if (!(reminder ? prefs.notify_reminders : prefs.notify_messages)) return;
    for (const [token, owner] of tokens) {
      if (owner.userId !== recipient) continue;
      const key = JSON.stringify([token, recipient, notice.kind, notice.sourceId, notice.at]);
      if (!log.delivered.has(key)) log.delivered.set(key, { ...notice, recipient, token });
    }
  }

  for (const match of state.matches) {
    if (isBlockedPair(state, ...match.profileIds)) continue;
    for (const event of log.events) {
      if (event.matchId !== match.id || !match.profileIds.includes(event.actorId)) continue;
      const project = state.jointProjects.get(event.projectId);
      if (event.kind !== 'deleted' && project?.matchId !== match.id) continue;
      if (event.kind === 'proposed' && project?.proposedBy !== event.actorId) continue;
      const peer = match.profileIds.find((id) => id !== event.actorId);
      if (peer) deliver(event, peer);
    }

    const joint = [...state.jointProjects.values()].find((project) => project.matchId === match.id);
    if (!joint) continue;
    for (const item of state.chatPlan) {
      if (item.closed || item.scope.kind !== 'match' || item.scope.id !== match.id) continue;
      const scheduled = item.startsAt ?? item.dueAt;
      if (!scheduled) continue;
      const at = Date.parse(scheduled);
      if (at <= now || at - now > (item.startsAt ? MEETING_LEAD : DAY)) continue;
      for (const recipient of joint.authorIds) {
        if (!item.assigneeId || item.assigneeId === recipient) {
          deliver(
            { kind: item.startsAt ? 'meeting' : 'task', matchId: match.id, sourceId: item.id, at },
            recipient
          );
        }
      }
    }
  }
}
