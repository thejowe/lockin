/** Salas contra Supabase: RLS decide la visibilidad y las RPC validan escrituras. */
import { RoomInviteError } from '../rooms';
import { SessionForbiddenError } from '../session-errors';
import { ensureUserId } from './auth';
import { getSupabaseClient } from './client';
import { toProfile } from './mappers';
import { fetchAllPages } from './pagination';
import { subscribeResyncingOnRejoin } from './realtime';
import { toSessionError } from './sessions';

import type { LockInSupabaseClient } from './client';
import type { RoomRow, RoomMemberRow } from './database.types';
import type { RoomRepository } from '../repositories';
import type { LockInRoom, RoomMember, RoomView } from '../types';
import type { RealtimeChannel } from '@supabase/supabase-js';

const toIso = (value: string) => new Date(value).toISOString();

export function toLockInRoom(row: RoomRow): LockInRoom {
  return {
    id: row.id,
    hostId: row.host_id,
    startsAt: toIso(row.starts_at),
    blocks: row.blocks,
    cancelledAt: row.cancelled_at === null ? null : toIso(row.cancelled_at),
    createdAt: toIso(row.created_at),
  };
}

export function toRoomMember(row: RoomMemberRow): RoomMember {
  return {
    roomId: row.room_id,
    profileId: row.profile_id,
    status: row.status,
    respondedAt: row.responded_at === null ? null : toIso(row.responded_at),
    joinedAt: row.joined_at === null ? null : toIso(row.joined_at),
    leftAt: row.left_at === null ? null : toIso(row.left_at),
  };
}

export function toRoomError(error: { code?: string; message: string }): unknown {
  return error.code === 'LI006' ? new RoomInviteError(error.message) : toSessionError(error);
}

export interface RoomRepositoryDeps {
  getClient(): LockInSupabaseClient;
  getUserId(): Promise<string>;
}

const defaultDeps: RoomRepositoryDeps = { getClient: getSupabaseClient, getUserId: ensureUserId };

export function createSupabaseRoomRepository(
  deps: RoomRepositoryDeps = defaultDeps
): RoomRepository {
  const listeners = new Set<() => void>();
  let channel: RealtimeChannel | undefined;
  const notify = () => listeners.forEach((listener) => listener());

  /** Dos lecturas en lote, paginadas y ordenadas por sus claves estables. */
  async function resolveRooms(rows: RoomRow[], userId: string): Promise<RoomView[]> {
    if (rows.length === 0) return [];
    const client = deps.getClient();
    const members = await fetchAllPages((from, to) =>
      client
        .from('room_members')
        .select('*')
        .in(
          'room_id',
          rows.map((row) => row.id)
        )
        .order('room_id')
        .order('profile_id')
        .range(from, to)
    );
    const profileIds = [
      ...new Set(
        members.filter((member) => member.profile_id !== userId).map((member) => member.profile_id)
      ),
    ];
    const profiles =
      profileIds.length === 0
        ? []
        : await fetchAllPages((from, to) =>
            client.from('profiles').select('*').in('id', profileIds).order('id').range(from, to)
          );
    const profilesById = new Map(profiles.map((row) => [row.id, toProfile(row)]));
    const membersByRoom = new Map<string, RoomMember[]>();
    for (const row of members) {
      const group = membersByRoom.get(row.room_id) ?? [];
      group.push(toRoomMember(row));
      membersByRoom.set(row.room_id, group);
    }
    return rows.flatMap((row) => {
      const group = membersByRoom.get(row.id) ?? [];
      const me = group.find((member) => member.profileId === userId);
      if (!me) return [];
      // No replicar el ciego aquí: todas estas filas ya pasaron la RLS.
      const others = group
        .filter((member) => member.profileId !== userId)
        .sort((a, b) => (a.profileId < b.profileId ? -1 : a.profileId > b.profileId ? 1 : 0))
        .flatMap((member) => {
          const profile = profilesById.get(member.profileId);
          return profile ? [{ member, profile }] : [];
        });
      return [{ room: toLockInRoom(row), me, others }];
    });
  }

  const repository: RoomRepository = {
    async getById(roomId) {
      const userId = await deps.getUserId();
      const { data, error } = await deps
        .getClient()
        .from('lockin_rooms')
        .select('*')
        .eq('id', roomId)
        .maybeSingle();
      if (error) throw error;
      return data ? ((await resolveRooms([data], userId))[0] ?? null) : null;
    },
    async listLive() {
      const userId = await deps.getUserId();
      // El reloj de Postgres decide qué está vivo; no hay tope de 20 salas.
      const rows = await fetchAllPages((from, to) =>
        deps.getClient().rpc('live_rooms').order('starts_at').order('id').range(from, to)
      );
      return resolveRooms(rows, userId);
    },
    async create({ inviteeIds, startsAt, blocks }) {
      await deps.getUserId();
      const { data, error } = await deps
        .getClient()
        .rpc('create_room', { p_invitee_ids: inviteeIds, p_starts_at: startsAt, p_blocks: blocks });
      if (error) throw toRoomError(error);
      notify();
      const view = await repository.getById(data.id);
      if (!view) throw new SessionForbiddenError('La sala no existe o no estás en ella');
      return view;
    },
    async respond(roomId, answer) {
      await deps.getUserId();
      const { data, error } = await deps
        .getClient()
        .rpc('respond_room', { p_room_id: roomId, p_answer: answer });
      if (error) throw toRoomError(error);
      notify();
      return toRoomMember(data);
    },
    async cancel(roomId) {
      await deps.getUserId();
      const { data, error } = await deps.getClient().rpc('cancel_room', { p_room_id: roomId });
      if (error) throw toRoomError(error);
      notify();
      return toLockInRoom(data);
    },
    async join(roomId) {
      await deps.getUserId();
      const { data, error } = await deps.getClient().rpc('join_room', { p_room_id: roomId });
      if (error) throw toRoomError(error);
      notify();
      return toRoomMember(data);
    },
    async leave(roomId) {
      await deps.getUserId();
      const { data, error } = await deps.getClient().rpc('leave_room', { p_room_id: roomId });
      if (error) throw toRoomError(error);
      notify();
      return toRoomMember(data);
    },
    subscribe(listener) {
      listeners.add(listener);
      if (!channel) {
        // room_members no se publica: sus DELETE revelarían invitados sin RLS.
        // touch_room convierte sus cambios en avisos de la sala.
        channel = subscribeResyncingOnRejoin(
          deps
            .getClient()
            .channel('lockin:rooms')
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'lockin_rooms' },
              notify
            ),
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
  };
  return repository;
}
