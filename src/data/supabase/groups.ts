/**
 * Grupos contra Supabase: la RLS decide quién lee (solo miembros) y las
 * funciones de `20261109130000_groups.sql` validan y hacen cada escritura. Los
 * dos decks son RPC que devuelven JSON ya filtrado; aquí solo se traduce.
 */
import { GROUP_ERROR_CODES, GROUP_MAX_MEMBERS, GroupError } from '../groups';
import { ensureUserId } from './auth';
import { getSupabaseClient } from './client';
import { toMessageReportArgs, toProfile, toSafetyError } from './mappers';
import { toPremiumError } from './premium';
import { PRIVATE_CHANNEL, subscribeResyncingOnRejoin } from './realtime';

import type { LockInSupabaseClient } from './client';
import type {
  GroupDeckRow,
  GroupMemberRow,
  GroupMessageRow,
  GroupRecruitRow,
  GroupRoleRow,
  GroupRow,
} from './database.types';
import type { GroupRepository, Unsubscribe } from '../repositories';
import type {
  Group,
  GroupMember,
  GroupMemberView,
  GroupMessage,
  GroupRole,
  GroupView,
  Profile,
} from '../types';
import type { RealtimeChannel } from '@supabase/supabase-js';

const toIso = (value: string) => new Date(value).toISOString();

export function toGroup(row: Omit<GroupRow, 'updated_at'>): Group {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    adminId: row.admin_id,
    maxMembers: row.max_members,
    createdAt: toIso(row.created_at),
  };
}

export function toGroupRole(row: GroupRoleRow): GroupRole {
  return {
    id: row.id,
    groupId: row.group_id,
    specialty: row.specialty,
    slots: row.slots,
    filled: row.filled,
  };
}

export function toGroupMember(row: GroupMemberRow): GroupMember {
  return {
    groupId: row.group_id,
    userId: row.user_id,
    roleId: row.role_id,
    joinedAt: toIso(row.joined_at),
  };
}

export function toGroupMessage(row: GroupMessageRow): GroupMessage {
  return {
    id: row.id,
    groupId: row.group_id,
    senderId: row.sender_id,
    body: row.body,
    sentAt: row.sent_at,
  };
}

/** LG001–LG005 → `GroupError`; LQ005 → `PremiumRequiredError`; el resto, como los reportes. */
export function toGroupError(error: { code?: string; message: string }): unknown {
  const reason = error.code ? GROUP_ERROR_CODES[error.code] : undefined;
  if (reason) return new GroupError(reason, error.message);
  if (error.code?.startsWith('LQ')) return toPremiumError({ ...error, code: error.code });
  return toSafetyError({ code: error.code ?? '', message: error.message });
}

export interface GroupRepositoryDeps {
  getClient(): LockInSupabaseClient;
  getUserId(): Promise<string>;
  /** Cambia la ruta de la foto de cada perfil por una URL firmada (bucket privado). */
  signProfiles?(profiles: Profile[]): Promise<Profile[]>;
  /** Tras bloquear un grupo: su admin queda bloqueado y matches y chats se releen. */
  onBlocked?(): void;
}

const defaultDeps: GroupRepositoryDeps = { getClient: getSupabaseClient, getUserId: ensureUserId };

const messagesTopic = (groupId: string) => `lockin:group-messages:${groupId}`;

export function createSupabaseGroupRepository(
  deps: GroupRepositoryDeps = defaultDeps
): GroupRepository {
  const listeners = new Set<() => void>();
  let channel: RealtimeChannel | undefined;
  const notify = () => listeners.forEach((listener) => listener());

  const messageListeners = new Map<string, Set<() => void>>();
  const messageChannels = new Map<string, RealtimeChannel>();
  const notifyMessages = (groupId: string) =>
    messageListeners.get(groupId)?.forEach((listener) => listener());
  /** Mensajes propios recién escritos: su eco de realtime no vuelve a avisar. */
  const sentHere = new Set<string>();

  /** Los perfiles públicos de esas personas, firmados, por id. Un bloqueo los deja fuera (RLS). */
  async function profilesById(ids: string[]): Promise<Map<string, Profile>> {
    if (ids.length === 0) return new Map();
    const { data, error } = await deps.getClient().from('profiles').select('*').in('id', ids);
    if (error) throw error;
    const mapped = data.map(toProfile);
    const signed = deps.signProfiles ? await deps.signProfiles(mapped) : mapped;
    return new Map(signed.map((profile) => [profile.id, profile]));
  }

  function memberViews(
    group: Group,
    roles: GroupRole[],
    members: GroupMember[],
    profiles: Map<string, Profile>
  ): GroupMemberView[] {
    return [...members]
      .sort(
        (a, b) =>
          a.joinedAt.localeCompare(b.joinedAt) ||
          (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0)
      )
      .map((member) => ({
        member,
        specialty: roles.find((role) => role.id === member.roleId)?.specialty ?? null,
        isAdmin: member.userId === group.adminId,
        profile: profiles.get(member.userId) ?? null,
      }));
  }

  const repository: GroupRepository = {
    async getMine(): Promise<GroupView | null> {
      const client = deps.getClient();
      const userId = await deps.getUserId();

      const membership = await client
        .from('group_members')
        .select('group_id')
        .eq('user_id', userId)
        .maybeSingle();
      if (membership.error) throw membership.error;
      if (!membership.data) return null;
      const groupId = membership.data.group_id;

      const [group, roles, members] = await Promise.all([
        client.from('groups').select('*').eq('id', groupId).maybeSingle(),
        client.from('group_roles').select('*').eq('group_id', groupId).order('specialty'),
        client.from('group_members').select('*').eq('group_id', groupId).order('joined_at'),
      ]);
      if (group.error) throw group.error;
      if (roles.error) throw roles.error;
      if (members.error) throw members.error;
      if (!group.data) return null;

      const mappedGroup = toGroup(group.data);
      const mappedRoles = roles.data.map(toGroupRole);
      const mappedMembers = members.data.map(toGroupMember);
      const profiles = await profilesById(mappedMembers.map((member) => member.userId));

      return {
        group: mappedGroup,
        roles: mappedRoles,
        members: memberViews(mappedGroup, mappedRoles, mappedMembers, profiles),
        isAdmin: mappedGroup.adminId === userId,
      };
    },

    async create(input) {
      await deps.getUserId();
      const { error } = await deps.getClient().rpc('create_group', {
        p_name: input.name,
        p_description: input.description,
        p_roles: input.roles.map((role) => ({ specialty: role.specialty, slots: role.slots })),
        p_max_members: input.maxMembers ?? GROUP_MAX_MEMBERS,
      });
      if (error) throw toGroupError(error);
      notify();
      const view = await repository.getMine();
      if (!view) throw new GroupError('unavailable', 'El grupo no está disponible');
      return view;
    },

    async getDeck() {
      await deps.getUserId();
      const { data, error } = await deps.getClient().rpc('group_deck', {});
      if (error) throw toGroupError(error);
      const rows = (data ?? []) as GroupDeckRow[];

      const profiles = await profilesById([
        ...new Set(rows.flatMap((row) => row.members.map((member) => member.user_id))),
      ]);
      return rows.flatMap((row) => {
        const group = toGroup(row);
        const roles = row.roles.map(toGroupRole);
        const myRole = roles.find((role) => role.id === row.my_role_id);
        if (!myRole) return [];
        return [
          {
            group,
            roles,
            members: memberViews(group, roles, row.members.map(toGroupMember), profiles),
            myRole,
          },
        ];
      });
    },

    async getRecruitDeck() {
      await deps.getUserId();
      const client = deps.getClient();
      const [deck, mine] = await Promise.all([
        client.rpc('group_recruit_deck', {}),
        repository.getMine(),
      ]);
      if (deck.error) throw toGroupError(deck.error);
      const rows = (deck.data ?? []) as GroupRecruitRow[];
      const roles = new Map((mine?.roles ?? []).map((role) => [role.id, role]));

      const mapped = rows.map((row) => toProfile(row.profile));
      const signed = deps.signProfiles ? await deps.signProfiles(mapped) : mapped;
      return rows.flatMap((row, index) => {
        const role = roles.get(row.role_id);
        return role ? [{ profile: signed[index], role }] : [];
      });
    },

    async swipeGroup(groupId, decision) {
      await deps.getUserId();
      const { data, error } = await deps
        .getClient()
        .rpc('swipe_group', { p_group_id: groupId, p_decision: decision });
      if (error) throw toGroupError(error);
      const joined = data === true;
      if (joined) notify();
      return { decision, joined };
    },

    async swipeCandidate(userId, roleId, decision) {
      await deps.getUserId();
      const { data, error } = await deps.getClient().rpc('swipe_group_candidate', {
        p_user_id: userId,
        p_role_id: roleId,
        p_decision: decision,
      });
      if (error) throw toGroupError(error);
      const joined = data === true;
      if (joined) notify();
      return { decision, joined };
    },

    async leave() {
      await deps.getUserId();
      const { error } = await deps.getClient().rpc('leave_group');
      if (error) throw toGroupError(error);
      notify();
    },

    async kick(userId) {
      await deps.getUserId();
      const { error } = await deps.getClient().rpc('kick_group_member', { p_user_id: userId });
      if (error) throw toGroupError(error);
      notify();
    },

    async report({ groupId, reason, details }) {
      await deps.getUserId();
      const { error } = await deps.getClient().rpc('report_group', {
        p_group_id: groupId,
        p_reason: reason,
        p_details: details ?? null,
      });
      if (error) throw toGroupError(error);
    },

    async block(groupId) {
      await deps.getUserId();
      const { error } = await deps.getClient().rpc('block_group', { p_group_id: groupId });
      if (error) throw toGroupError(error);
      deps.onBlocked?.();
      notify();
    },

    async listMessages(groupId) {
      await deps.getUserId();
      const { data, error } = await deps
        .getClient()
        .from('group_messages')
        .select('*')
        .eq('group_id', groupId)
        .order('sent_at', { ascending: true })
        .order('id', { ascending: true });
      if (error) throw error;
      return data.map(toGroupMessage);
    },

    async sendMessage(groupId, body) {
      const userId = await deps.getUserId();
      // `sent_at` lo pone la base, como en los mensajes 1:1.
      const { data, error } = await deps
        .getClient()
        .from('group_messages')
        .insert({ group_id: groupId, sender_id: userId, body })
        .select('*')
        .single();
      if (error) throw error;
      sentHere.add(data.id);
      notifyMessages(groupId);
      return toGroupMessage(data);
    },

    async reportMessage(input) {
      await deps.getUserId();
      const { error } = await deps
        .getClient()
        .rpc('report_group_message', toMessageReportArgs(input));
      if (error) throw toGroupError(error);
    },

    subscribe(listener): Unsubscribe {
      listeners.add(listener);
      if (!channel) {
        // `group_members` no se publica (sus cambios revelarían quién está en
        // qué grupo): las funciones tocan `groups.updated_at` y ese UPDATE,
        // filtrado por RLS, es el aviso. Un grupo borrado no avisa: quien lo
        // tenía abierto lo deja de ver en su siguiente lectura.
        channel = subscribeResyncingOnRejoin(
          deps
            .getClient()
            .channel('lockin:groups', PRIVATE_CHANNEL)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'groups' }, notify),
          notify
        );
      }
      let stopped = false;
      return () => {
        if (stopped) return;
        stopped = true;
        listeners.delete(listener);
        if (listeners.size > 0) return;
        const oldChannel = channel;
        channel = undefined;
        if (oldChannel) void deps.getClient().removeChannel(oldChannel);
      };
    },

    subscribeMessages(groupId, listener): Unsubscribe {
      const set = messageListeners.get(groupId) ?? new Set<() => void>();
      set.add(listener);
      messageListeners.set(groupId, set);

      if (!messageChannels.has(groupId)) {
        messageChannels.set(
          groupId,
          subscribeResyncingOnRejoin(
            deps
              .getClient()
              .channel(messagesTopic(groupId), PRIVATE_CHANNEL)
              .on(
                'postgres_changes',
                {
                  event: 'INSERT',
                  schema: 'public',
                  table: 'group_messages',
                  filter: `group_id=eq.${groupId}`,
                },
                (payload) => {
                  const row = payload.new as Partial<GroupMessageRow> | undefined;
                  if (row?.id && sentHere.delete(row.id)) return;
                  notifyMessages(groupId);
                }
              ),
            () => notifyMessages(groupId)
          )
        );
      }

      let stopped = false;
      return () => {
        if (stopped) return;
        stopped = true;
        set.delete(listener);
        if (set.size > 0) return;
        messageListeners.delete(groupId);
        const oldChannel = messageChannels.get(groupId);
        messageChannels.delete(groupId);
        if (oldChannel) void deps.getClient().removeChannel(oldChannel);
      };
    },
  };

  return repository;
}
