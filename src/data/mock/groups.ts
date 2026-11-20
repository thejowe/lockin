/**
 * Grupos del backend mock.
 *
 * Como las salas (`./rooms.ts`), se construye para un actor: los tests necesitan
 * a quien administra y a quien busca grupo sobre el mismo store. La app usa
 * siempre `CURRENT_USER_ID`.
 *
 * Es el espejo de `supabase/migrations/20261109130000_groups.sql` (con los
 * cambios de `20261111120000_groups_multi_membership.sql`): mismas reglas, mismo
 * orden de comprobaciones y mismos códigos (`GroupError.reason`).
 */

import {
  firstOpenRoleFor,
  GROUP_MAX_MEMBERSHIPS,
  GroupError,
  validateGroupInput,
  validateGroupUpdate,
} from '../groups';
import { REPORT_MAX_LENGTH, REPORT_REASONS } from '../types';
import { sharedPhotosLockedMessage, validateProject } from '../projects';
import { mockProjectView, projectRecord } from './projects';
import { t } from '@/i18n';
import {
  defaultMockStore,
  detachProjectAuthor,
  isBlockedPair,
  removeMockGroupMember,
  PASS_COOLDOWN_MS,
} from './store';

import type { MockGroupSwipe, MockState, MockStore, StoredGroup } from './store';
import type { GroupRepository } from '../repositories';
import type {
  Decision,
  Group,
  GroupDeckCard,
  GroupMember,
  GroupMemberView,
  GroupMessage,
  GroupRole,
  GroupView,
  ReportReason,
  Specialty,
} from '../types';

/** Tópico de avisos del grupo de una persona. */
export const groupsTopic = (profileId: string) => `groups:${profileId}`;
const groupMessagesTopic = (groupId: string) => `group-messages:${groupId}`;

/** Orden de `specialty` en Postgres (el del enum): así el «primer puesto abierto» coincide. */
const SPECIALTY_ORDER: Specialty[] = [
  'diseno',
  'dev',
  'marketing',
  'ventas',
  'datos',
  'legal',
  'producto',
  'finanzas',
  'operaciones',
  'contenido',
  'ia',
  'hardware',
  'growth',
  'comunidad',
  'personas',
  'investigacion',
  'audiovisual',
  'seguridad',
  'ecommerce',
  'inversion',
];

interface Ranked<T extends { id: string }> {
  item: T;
  passedAt: number | null;
  liked: boolean;
}

function bySwipeRank<T extends { id: string }>(a: Ranked<T>, b: Ranked<T>) {
  if (a.passedAt !== b.passedAt) {
    if (a.passedAt === null) return -1;
    if (b.passedAt === null) return 1;
    return a.passedAt - b.passedAt;
  }
  return Number(b.liked) - Number(a.liked) || byId(a.item.id, b.item.id);
}

const byId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function createMockGroupRepository(
  actorId: string,
  store: MockStore = defaultMockStore
): GroupRepository {
  const getState = (): MockState => store.state;
  const iso = () => new Date(store.nowMs()).toISOString();

  const membersOf = (groupId: string): GroupMember[] =>
    getState()
      .groupMembers.filter((member) => member.groupId === groupId)
      .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt) || byId(a.userId, b.userId));

  const rolesOf = (groupId: string): GroupRole[] =>
    getState()
      .groupRoles.filter((role) => role.groupId === groupId)
      .sort(
        (a, b) =>
          SPECIALTY_ORDER.indexOf(a.specialty) - SPECIALTY_ORDER.indexOf(b.specialty) ||
          byId(a.id, b.id)
      );

  /** Los grupos de una persona, en el orden en que entró. */
  const membershipsOf = (userId: string): GroupMember[] =>
    getState()
      .groupMembers.filter((member) => member.userId === userId)
      .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt) || byId(a.groupId, b.groupId));

  const isMember = (groupId: string, userId: string): boolean =>
    getState().groupMembers.some(
      (member) => member.groupId === groupId && member.userId === userId
    );

  const atLimit = (userId: string): boolean =>
    membershipsOf(userId).length >= GROUP_MAX_MEMBERSHIPS;

  /** Espejo de `group_has_block_with`. */
  const hasBlockWith = (groupId: string, userId: string): boolean => {
    const state = getState();
    const now = store.nowMs();
    const banned = (id: string) => (state.bannedUntil.get(id) ?? 0) > now;
    return (
      banned(userId) ||
      swipeOf(groupId, userId, 'user_to_group')?.dismissal === 'block' ||
      membersOf(groupId).some(
        (member) => banned(member.userId) || isBlockedPair(state, member.userId, userId)
      )
    );
  };

  const swipeOf = (groupId: string, userId: string, direction: 'user_to_group' | 'group_to_user') =>
    getState().groupSwipes.find(
      (swipe) =>
        swipe.groupId === groupId && swipe.userId === userId && swipe.direction === direction
    );

  function ranked<T extends { id: string }>(
    item: T,
    groupId: string,
    userId: string,
    direction: MockGroupSwipe['direction'],
    cutoff: number
  ): Ranked<T>[] {
    const mine = swipeOf(groupId, userId, direction);
    const peer = swipeOf(
      groupId,
      userId,
      direction === 'user_to_group' ? 'group_to_user' : 'user_to_group'
    );
    if (mine?.dismissal || peer?.dismissal || mine?.decision === 'like') return [];
    if ((mine && mine.atMs > cutoff) || (peer?.decision === 'pass' && peer.atMs > cutoff))
      return [];
    return [{ item, passedAt: mine?.atMs ?? null, liked: peer?.decision === 'like' }];
  }

  function writeSwipe(
    groupId: string,
    userId: string,
    direction: 'user_to_group' | 'group_to_user',
    decision: Decision,
    roleId: string | null,
    dismissal?: 'block'
  ): void {
    const existing = swipeOf(groupId, userId, direction);
    const atMs = store.nowMs();
    if (existing && !dismissal) {
      if (existing.decision === 'like' || existing.dismissal) return;
      if (decision === 'pass' && existing.atMs > atMs - PASS_COOLDOWN_MS) return;
    }
    const swipe = { groupId, userId, direction, decision, roleId, actorId, atMs, dismissal };
    if (existing) Object.assign(existing, swipe);
    else getState().groupSwipes.push(swipe);
  }

  /** Lo que ve cada quien de un miembro: su perfil no se entrega con un bloqueo de por medio. */
  const memberViews = (group: StoredGroup): GroupMemberView[] =>
    membersOf(group.id).map((member) => ({
      member: { ...member },
      specialty: getState().groupRoles.find((role) => role.id === member.roleId)?.specialty ?? null,
      isAdmin: member.userId === group.adminId,
      profile:
        member.userId !== actorId && isBlockedPair(getState(), actorId, member.userId)
          ? null
          : (getState().profiles.get(member.userId) ?? null),
    }));

  function toGroup({ projectId, ...group }: StoredGroup): Group {
    const project = projectId && getState().projects.find((row) => row.id === projectId);
    return { ...group, project: project ? mockProjectView(store, project, actorId) : null };
  }

  const toView = (group: StoredGroup): GroupView => ({
    group: toGroup(group),
    roles: rolesOf(group.id).map((role) => ({ ...role })),
    members: memberViews(group),
    isAdmin: group.adminId === actorId,
  });

  const adminGroup = (): StoredGroup => {
    const group = getState().groups.find((candidate) => candidate.adminId === actorId);
    if (!group) throw new GroupError('admin-only', 'No administras ningún grupo');
    return group;
  };

  /** Avisa a quien está dentro del grupo y a las personas indicadas. */
  const changed = (groupId: string, extra: string[] = []): void => {
    const audience = new Set([...membersOf(groupId).map((member) => member.userId), ...extra]);
    audience.add(actorId);
    audience.forEach((profileId) => store.notify(groupsTopic(profileId)));
  };

  /** Espejo de `join_group_if_possible`. */
  function joinIfPossible(group: StoredGroup, userId: string, roleId: string | null): boolean {
    const state = getState();
    if (isMember(group.id, userId) || atLimit(userId)) return false;
    if (membersOf(group.id).length >= group.maxMembers) return false;
    if (hasBlockWith(group.id, userId)) return false;

    const roles = rolesOf(group.id);
    const preferred = roles.find((role) => role.id === roleId && role.filled < role.slots);
    const role =
      preferred ?? firstOpenRoleFor(roles, state.profiles.get(userId)?.specialties ?? []);
    if (!role) return false;

    state.groupMembers.push({ groupId: group.id, userId, roleId: role.id, joinedAt: iso() });
    if (group.projectId) state.jointProjects.get(group.projectId)?.authorIds.push(userId);
    role.filled += 1;
    changed(group.id);
    return true;
  }

  function checkReport(reason: ReportReason, details: string | undefined): void {
    if (!REPORT_REASONS.includes(reason))
      throw Object.assign(new Error('Elige un motivo válido.'), { code: 'LI009' });
    if (Array.from(details ?? '').length > REPORT_MAX_LENGTH)
      throw Object.assign(new Error('El texto no puede superar 500 caracteres.'), {
        code: '23514',
      });
  }

  return {
    async listMine() {
      const views = membershipsOf(actorId).flatMap((membership) => {
        const group = getState().groups.find((candidate) => candidate.id === membership.groupId);
        return group ? [toView(group)] : [];
      });
      // El que administra, primero; el resto, en el orden en que entró.
      return [...views.filter((view) => view.isAdmin), ...views.filter((view) => !view.isAdmin)];
    },

    async create(input) {
      const state = getState();
      if (!state.profiles.has(actorId)) {
        throw Object.assign(new Error('Necesitas un perfil.'), { code: '23503' });
      }
      const invalid = validateGroupInput(input);
      if (invalid) throw invalid;
      if (input.project) {
        validateProject(input.project);
        // Espejo de `create_moderated_group_project`: un grupo de proyecto se ve en
        // Descubrir nada más crearse, así que el interruptor de fotos también lo cubre.
        if (
          (input.project.cover || input.project.photos.length) &&
          !state.appConfig.sharedProjectPhotos
        )
          throw new Error(sharedPhotosLockedMessage('group'));
        const existing = state.groups.find((entry) => entry.projectId === input.projectDraftId);
        if (existing?.adminId === actorId) {
          // Reintento tras perder la respuesta: con nadie más dentro, guarda el borrador actual.
          if (membersOf(existing.id).some((member) => member.userId !== actorId))
            return toView(existing);
          Object.assign(existing, {
            name: input.name.trim(),
            description: input.description.trim(),
            maxMembers: input.maxMembers ?? 6,
          });
          // Puestos por especialidad, como `update_group`: el que sigue conserva su id.
          const wanted = new Map(input.roles.map((role) => [role.specialty, role.slots]));
          state.groupRoles = state.groupRoles.filter(
            (role) => role.groupId !== existing.id || wanted.has(role.specialty)
          );
          for (const role of rolesOf(existing.id)) role.slots = wanted.get(role.specialty)!;
          for (const role of input.roles) {
            if (rolesOf(existing.id).some((current) => current.specialty === role.specialty))
              continue;
            state.groupRoles.push({
              id: store.createId('group-role'),
              groupId: existing.id,
              specialty: role.specialty,
              slots: role.slots,
              filled: 0,
            });
          }
          state.projects = state.projects.map((entry) =>
            entry.id === input.projectDraftId
              ? projectRecord(input.project!, entry.id, actorId, store.createId('revision'))
              : entry
          );
          changed(existing.id);
          return toView(existing);
        }
        if (state.projects.some((entry) => entry.id === input.projectDraftId))
          throw new Error(t('El proyecto ha cambiado. Vuelve a abrirlo.'));
      }
      if (state.groups.some((candidate) => candidate.adminId === actorId)) {
        throw new GroupError('already-admin', 'Ya administras un grupo');
      }
      if (atLimit(actorId)) throw new GroupError('group-limit', 'Ya estás en el máximo de grupos');

      const group: StoredGroup = {
        id: store.createId('group'),
        projectId: input.projectDraftId,
        name: input.name.trim(),
        description: input.description.trim(),
        adminId: actorId,
        maxMembers: input.maxMembers ?? 6,
        createdAt: iso(),
      };
      if (input.project) {
        state.projects.push(
          projectRecord(input.project, input.projectDraftId, actorId, store.createId('revision'))
        );
        state.jointProjects.set(input.projectDraftId, {
          groupId: group.id,
          matchId: null,
          authorIds: [actorId],
          published: false,
          proposedBy: null,
          notes: '',
          notesBy: null,
          notesRevision: store.createId('notes'),
        });
      }
      state.groups.push(group);
      state.groupRoles.push(
        ...input.roles.map((role): GroupRole => ({
          id: store.createId('group-role'),
          groupId: group.id,
          specialty: role.specialty,
          slots: role.slots,
          filled: 0,
        }))
      );
      state.groupMembers.push({
        groupId: group.id,
        userId: actorId,
        roleId: null,
        joinedAt: group.createdAt,
      });
      changed(group.id);
      return toView(group);
    },

    async update(input) {
      const state = getState();
      const group = adminGroup();
      const current = rolesOf(group.id);
      const invalid = validateGroupUpdate(input, { maxMembers: group.maxMembers, roles: current });
      if (invalid) throw invalid;

      const wanted = new Map(input.roles.map((role) => [role.specialty, role.slots]));
      const removed = new Set(
        current.filter((role) => !wanted.has(role.specialty)).map((role) => role.id)
      );
      state.groupRoles = state.groupRoles.filter((role) => !removed.has(role.id));
      // Como `on delete set null`: el like del grupo sigue, sin perfil concreto.
      state.groupSwipes.forEach((swipe) => {
        if (swipe.roleId && removed.has(swipe.roleId)) swipe.roleId = null;
      });
      for (const [specialty, slots] of wanted) {
        const existing = state.groupRoles.find(
          (role) => role.groupId === group.id && role.specialty === specialty
        );
        if (existing) existing.slots = slots;
        else
          state.groupRoles.push({
            id: store.createId('group-role'),
            groupId: group.id,
            specialty,
            slots,
            filled: 0,
          });
      }
      group.name = input.name.trim();
      group.description = input.description.trim();
      changed(group.id);
      return toView(group);
    },

    async getDeck() {
      const state = getState();
      const viewer = state.profiles.get(actorId);
      if (!viewer || atLimit(actorId)) return [];

      const cutoff = store.nowMs() - PASS_COOLDOWN_MS;

      return state.groups
        .filter((group) => membersOf(group.id).length < group.maxMembers)
        .filter((group) => !isMember(group.id, actorId))
        .filter((group) => !hasBlockWith(group.id, actorId))
        .flatMap((group) => ranked(group, group.id, actorId, 'user_to_group', cutoff))
        .sort(bySwipeRank)
        .flatMap(({ item: group }): GroupDeckCard[] => {
          const roles = rolesOf(group.id);
          const myRole = firstOpenRoleFor(roles, viewer.specialties);
          if (!myRole) return [];
          return [
            {
              group: toGroup(group),
              roles: roles.map((role) => ({ ...role })),
              members: memberViews(group),
              myRole: { ...myRole },
            },
          ];
        });
    },

    async getRecruitDeck() {
      const state = getState();
      const group = adminGroup();
      if (membersOf(group.id).length >= group.maxMembers) return [];
      const roles = rolesOf(group.id);
      const cutoff = store.nowMs() - PASS_COOLDOWN_MS;

      return [...state.profiles.values()]
        .filter((profile) => profile.id !== actorId && profile.lookingFor !== 'lockin')
        .filter((profile) => !isMember(group.id, profile.id) && !atLimit(profile.id))
        .filter((profile) => !hasBlockWith(group.id, profile.id))
        .flatMap((profile) => ranked(profile, group.id, profile.id, 'group_to_user', cutoff))
        .sort(bySwipeRank)
        .flatMap(({ item: profile }) => {
          const role = firstOpenRoleFor(roles, profile.specialties);
          return role ? [{ profile, role: { ...role } }] : [];
        });
    },

    async swipeGroup(groupId, decision) {
      const state = getState();
      if (!state.profiles.has(actorId)) {
        throw Object.assign(new Error('Necesitas un perfil.'), { code: '23503' });
      }
      if (atLimit(actorId)) throw new GroupError('group-limit', 'Ya estás en el máximo de grupos');
      const group = state.groups.find((candidate) => candidate.id === groupId);
      if (!group || hasBlockWith(groupId, actorId) || isMember(groupId, actorId)) {
        throw new GroupError('unavailable', 'El grupo no está disponible');
      }

      writeSwipe(groupId, actorId, 'user_to_group', decision, null);
      // Espejo de swipe_group: cuentan los dos likes guardados y vigentes, no el pedido.
      const mine = swipeOf(groupId, actorId, 'user_to_group');
      const theirs = swipeOf(groupId, actorId, 'group_to_user');
      if (
        decision !== 'like' ||
        mine?.decision !== 'like' ||
        mine.dismissal ||
        theirs?.decision !== 'like' ||
        theirs.dismissal
      )
        return { decision, joined: false };
      return { decision, joined: joinIfPossible(group, actorId, theirs.roleId) };
    },

    async swipeCandidate(userId, roleId, decision) {
      const state = getState();
      const group = adminGroup();
      if (!state.groupRoles.some((role) => role.id === roleId && role.groupId === group.id)) {
        throw new GroupError('invalid', 'Ese puesto no es de tu grupo');
      }
      if (userId === actorId || !state.profiles.has(userId) || hasBlockWith(group.id, userId)) {
        throw new GroupError('candidate-unavailable', 'Esa persona no está disponible');
      }

      writeSwipe(group.id, userId, 'group_to_user', decision, roleId);
      // Espejo de swipe_group_candidate: likes guardados y vigentes, con el puesto guardado.
      const ours = swipeOf(group.id, userId, 'group_to_user');
      const theirs = swipeOf(group.id, userId, 'user_to_group');
      if (
        decision !== 'like' ||
        ours?.decision !== 'like' ||
        ours.dismissal ||
        theirs?.decision !== 'like' ||
        theirs.dismissal
      ) {
        return { decision, joined: false };
      }
      const joined = joinIfPossible(group, userId, ours.roleId);
      if (joined) store.notify(groupsTopic(userId));
      return { decision, joined };
    },

    async leave(groupId) {
      if (!isMember(groupId, actorId)) throw new GroupError('unavailable', 'No estás en ese grupo');
      const others = membersOf(groupId).map((member) => member.userId);
      removeMockGroupMember(getState(), actorId, groupId);
      changed(groupId, others);
    },

    async kick(userId) {
      const group = adminGroup();
      if (userId === actorId) throw new GroupError('invalid', 'Para irte tú, sal del grupo');
      if (!isMember(group.id, userId)) {
        throw new GroupError('candidate-unavailable', 'Esa persona no está en tu grupo');
      }
      removeMockGroupMember(getState(), userId, group.id);
      changed(group.id, [userId]);
    },

    async report({ groupId, reason, details }) {
      checkReport(reason, details);
      const group = getState().groups.find((candidate) => candidate.id === groupId);
      if (!group) throw new GroupError('unavailable', 'El grupo no está disponible');
      if (group.adminId === actorId)
        throw Object.assign(new Error('No puedes reportar tu propio grupo.'), { code: 'LI008' });
      getState().userReports.push({
        reporterId: actorId,
        reportedId: group.adminId,
        reporterRef: actorId,
        reportedRef: group.adminId,
        createdAtMs: store.nowMs(),
        reason,
        details: details?.trim() || null,
        groupId: group.id,
        groupRef: group.id,
        groupName: group.name,
      });
    },

    async block(groupId) {
      const state = getState();
      const group = state.groups.find((candidate) => candidate.id === groupId);
      if (!group) throw new GroupError('unavailable', 'El grupo no está disponible');
      if (isMember(groupId, actorId)) {
        throw new GroupError('invalid', 'Sal del grupo antes de bloquearlo');
      }
      writeSwipe(groupId, actorId, 'user_to_group', 'pass', null, 'block');
      const blocks = state.userBlocks.get(actorId) ?? new Set<string>();
      blocks.add(group.adminId);
      state.userBlocks.set(actorId, blocks);
      for (const match of state.matches) {
        if (match.profileIds.includes(actorId) && match.profileIds.includes(group.adminId))
          detachProjectAuthor(state, actorId, match.id);
      }
      // El bloqueo al admin cambia también deck y matches de cofundador.
      store.notify('matches');
      store.notify(groupsTopic(actorId));
    },

    async listMessages(groupId) {
      if (!isMember(groupId, actorId)) return [];
      return getState()
        .groupMessages.filter((message) => message.groupId === groupId)
        .filter(
          (message) =>
            message.senderId === actorId || !isBlockedPair(getState(), actorId, message.senderId)
        )
        .map((message) => ({ ...message }));
    },

    async sendMessage(groupId, body) {
      if (!isMember(groupId, actorId) || body.trim() === '') {
        throw Object.assign(new Error('No se puede enviar el mensaje.'), { code: '42501' });
      }
      const message: GroupMessage = {
        id: store.createId('group-message'),
        groupId,
        senderId: actorId,
        body,
        sentAt: new Date().toISOString(),
      };
      getState().groupMessages.push(message);
      store.notify(groupMessagesTopic(groupId));
      return { ...message };
    },

    async reportMessage({ messageId, reason, details }) {
      checkReport(reason, details);
      const state = getState();
      const message = state.groupMessages.find((candidate) => candidate.id === messageId);
      if (!message || !isMember(message.groupId, actorId))
        throw Object.assign(new Error('El mensaje no está disponible.'), { code: '42501' });
      if (message.senderId === actorId)
        throw Object.assign(new Error('No puedes reportar tus propios mensajes.'), {
          code: 'LI008',
        });
      const group = state.groups.find((candidate) => candidate.id === message.groupId);
      state.userReports.push({
        reporterId: actorId,
        reportedId: message.senderId,
        reporterRef: actorId,
        reportedRef: message.senderId,
        createdAtMs: store.nowMs(),
        reason,
        details: details?.trim() || null,
        messageRef: message.id,
        messageExcerpt: Array.from(message.body).slice(0, 500).join(''),
        groupId: message.groupId,
        groupRef: message.groupId,
        groupName: group?.name,
      });
    },

    subscribe(listener) {
      return store.subscribeTo(groupsTopic(actorId), listener);
    },

    subscribeMessages(groupId, listener) {
      return store.subscribeTo(groupMessagesTopic(groupId), listener);
    },
  };
}
