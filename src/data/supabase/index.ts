/**
 * Implementación de `Repositories` contra Supabase.
 *
 * Cumple exactamente el mismo contrato que el mock de `src/data/mock/`, así que
 * las pantallas de `perfil`, `descubrir` y `chat` no cambian ni una línea. El
 * comportamiento que hay que reproducir está especificado, test a test, en
 * `src/data/mock/index.test.ts`; `src/data/supabase/README.md` mapea cada uno de
 * esos tests con la pieza de aquí que lo cumple.
 *
 * Tres reglas de esta capa:
 *
 * - El id del usuario NUNCA viaja como parámetro desde una pantalla: sale de
 *   `auth.uid()`. Es lo que hace que RLS pueda proteger algo.
 * - La lógica que decide quién ve qué vive en SQL (`discovery_deck`,
 *   `record_decision`), no aquí. Este archivo traduce y orquesta.
 * - Toda escritura local avisa a los suscriptores al instante, sin esperar al
 *   eco de realtime: si no, la UI se quedaría un viaje de red por detrás de la
 *   acción que acaba de hacer el usuario.
 */

import { ensureUserId, linkGithubIdentity, unlinkGithubIdentity } from './auth';
import { getSupabaseClient } from './client';
import {
  byRecentActivity,
  counterpartIdOf,
  toMatch,
  toMessage,
  toProfile,
  toProfileInsert,
} from './mappers';
import { subscribeResyncingOnRejoin } from './realtime';
import { createSupabaseSessionRepository } from './sessions';
import { GITHUB_VERIFICATION_CANCELLED } from '../repositories';

import type { MatchRow, MessageRow, ProfileRow } from './database.types';
import type {
  DiscoveryRepository,
  MatchRepository,
  MessageRepository,
  ProfileRepository,
  Repositories,
  SessionRepository,
  Unsubscribe,
} from '../repositories';
import type {
  Decision,
  DecisionResult,
  MatchWithProfile,
  Message,
  MessageInput,
  ProfileFilter,
  ProfileInput,
  Session,
} from '../types';
import type { RealtimeChannel } from '@supabase/supabase-js';

export {
  AccountError,
  completeAuthLink,
  currentUserId,
  ensureUserId,
  getAccountState,
  linkEmailToCurrentUser,
  sendPasswordReset,
  setAccountPassword,
  signInWithEmail,
  signOut,
  signUpWithEmail,
} from './auth';
export type { AccountErrorReason, AccountKind, AccountState } from './auth';

const MATCHES_TOPIC = 'matches';
const messagesTopic = (matchId: string) => `messages:${matchId}`;

/**
 * Cuántas filas se piden por vuelta al paginar `matches` y `messages`.
 *
 * PostgREST tiene un tope de fila por defecto (`max-rows`, 1000 en un proyecto
 * nuevo de Supabase): un `select('*')` sin `range()` no falla al superarlo,
 * **corta la respuesta en silencio**. `matches.list()` no llevaba `range()`
 * en absoluto, así que una cuenta con más matches que ese tope perdía los de
 * más allá sin ningún aviso. Paginar con esta vuelta evita depender de ese
 * límite ajeno sin cambiar la firma del contrato: `list()` sigue devolviendo
 * todo, solo que en varias peticiones en vez de una que podía truncarse.
 */
const FETCH_PAGE_SIZE = 500;

// ---------------------------------------------------------------------------
// Avisos a las pantallas
// ---------------------------------------------------------------------------
//
// Dos fuentes que acaban en el mismo sitio: las escrituras de este dispositivo
// (inmediatas) y los cambios de la otra persona (realtime). Las marcas de
// `emittedLocally` evitan el aviso doble cuando el eco de realtime trae de
// vuelta algo que acabamos de escribir nosotros.
//
// Todo esto vivía en variables de módulo, así que dos juegos de repositorios
// del mismo proceso compartían listeners, canales y marcas. Ahora es de la
// instancia: `createSupabaseRepositories()` crea el suyo.

/**
 * Cuánto vale una marca de escritura propia antes de caducar.
 *
 * El eco de realtime de una fila que acabamos de escribir llega en menos de un
 * segundo; medio minuto es holgura de sobra para una red mala. La marca caduca
 * **por tiempo y solo por tiempo**: antes era un `Set` de 256 entradas con
 * desalojo del más antiguo, así que una ráfaga de escrituras podía tirar la
 * marca de una fila cuyo eco aún estaba en camino y provocar una relectura
 * duplicada. Aquí la presión de tamaño no puede perder ninguna marca viva.
 */
const EMITTED_MARK_TTL_MS = 30_000;

/** Los avisos y los canales de realtime de UN juego de repositorios. */
interface Notifier {
  notify(topic: string): void;
  /** Marca una fila propia para que su eco de realtime no vuelva a avisar. */
  markEmitted(id: string): void;
  /** `true` si esta fila la escribimos nosotros y ya avisamos por ella. */
  wasEmittedLocally(id: string | undefined): boolean;
  subscribeTo(topic: string, listener: () => void, openChannel: () => RealtimeChannel): Unsubscribe;
}

function createNotifier(): Notifier {
  const listeners = new Map<string, Set<() => void>>();

  /**
   * Canal de realtime por tema, abierto con el primer suscriptor y cerrado con
   * el último. Sin este recuento, entrar y salir de una conversación dejaría
   * canales abiertos hasta agotar el límite de conexiones del proyecto.
   */
  const channels = new Map<string, RealtimeChannel>();

  /** Id de fila -> instante en que su marca deja de valer. */
  const emittedLocally = new Map<string, number>();

  return {
    notify(topic) {
      listeners.get(topic)?.forEach((listener) => listener());
    },

    markEmitted(id) {
      const now = Date.now();
      // Cota de memoria por caducidad, no por tamaño: lo que se tira aquí es
      // siempre una marca cuyo eco ya no puede llegar.
      for (const [marked, expiresAt] of emittedLocally) {
        if (expiresAt <= now) emittedLocally.delete(marked);
      }
      emittedLocally.set(id, now + EMITTED_MARK_TTL_MS);
    },

    wasEmittedLocally(id) {
      if (!id) return false;
      const expiresAt = emittedLocally.get(id);
      if (expiresAt === undefined) return false;

      emittedLocally.delete(id);
      // Una marca caducada ya no silencia nada: el eco llegó tan tarde que más
      // vale releer que arriesgarse a perder un cambio de la otra persona.
      return expiresAt > Date.now();
    },

    subscribeTo(topic, listener, openChannel) {
      const set = listeners.get(topic) ?? new Set<() => void>();
      set.add(listener);
      listeners.set(topic, set);

      if (!channels.has(topic)) channels.set(topic, openChannel());

      return () => {
        set.delete(listener);
        if (set.size > 0) return;

        listeners.delete(topic);
        const channel = channels.get(topic);
        channels.delete(topic);
        if (channel) void getSupabaseClient().removeChannel(channel);
      };
    },
  };
}

/**
 * Último mensaje de cada conversación, indexado por `matchId`.
 *
 * Antes era una heurística: traer los 200 mensajes más recientes del usuario
 * y agrupar en JS, correcto "salvo que alguien tenga más de 200 mensajes por
 * delante del último de alguna conversación vieja". `last_messages_for_matches`
 * resuelve el `distinct on (match_id)` en Postgres, que PostgREST no expone
 * directamente — exacto para cualquier historial, sin techo.
 */
async function lastMessagesByMatch(matchIds: string[]): Promise<Map<string, Message>> {
  const byMatch = new Map<string, Message>();
  if (matchIds.length === 0) return byMatch;

  const { data, error } = await getSupabaseClient().rpc('last_messages_for_matches', {
    p_match_ids: matchIds,
  });
  if (error) throw error;

  for (const row of data as MessageRow[]) byMatch.set(row.match_id, toMessage(row));

  return byMatch;
}

/**
 * Trae todas las filas de una tabla en vueltas de `FETCH_PAGE_SIZE`, en vez de
 * un único `select` sin `range()` que PostgREST podría truncar en silencio al
 * superar su tope de fila. Orden estable por `id` para que ninguna fila se
 * salte ni se repita entre vueltas.
 */
async function fetchAllPages<Row>(
  query: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: unknown }>
): Promise<Row[]> {
  const rows: Row[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await query(offset, offset + FETCH_PAGE_SIZE - 1);
    if (error) throw error;

    rows.push(...(data ?? []));
    if (!data || data.length < FETCH_PAGE_SIZE) return rows;
    offset += FETCH_PAGE_SIZE;
  }
}

/** Añade a cada match el perfil del otro lado y su último mensaje. */
async function resolveMatches(rows: MatchRow[], userId: string): Promise<MatchWithProfile[]> {
  if (rows.length === 0) return [];

  const client = getSupabaseClient();
  const counterpartIds = [...new Set(rows.map((row) => counterpartIdOf(row, userId)))];

  const [counterparts, lastMessages] = await Promise.all([
    client.from('profiles').select('*').in('id', counterpartIds),
    lastMessagesByMatch(rows.map((row) => row.id)),
  ]);
  if (counterparts.error) throw counterparts.error;

  const profilesById = new Map(counterparts.data.map((row: ProfileRow) => [row.id, row]));

  return rows
    .map((row) => {
      const counterpart = profilesById.get(counterpartIdOf(row, userId));
      // Un match cuyo perfil no se puede leer (borrado a medias) se omite en vez
      // de romper la lista entera. Mismo criterio que `withCounterpart` del mock.
      if (!counterpart) return null;

      return {
        ...toMatch(row, userId),
        counterpart: toProfile(counterpart),
        lastMessage: lastMessages.get(row.id) ?? null,
      };
    })
    .filter((match): match is MatchWithProfile => match !== null)
    .sort(byRecentActivity);
}

// ---------------------------------------------------------------------------
// Repositorios
// ---------------------------------------------------------------------------

/**
 * La fábrica que consume `src/data/active.ts`. Misma forma que la del mock.
 *
 * Cada llamada trae su propio `Notifier`: dos juegos de repositorios no
 * comparten ni listeners, ni canales de realtime, ni marcas de escritura
 * propia, así que un test puede aislar dos instancias.
 */
export function createSupabaseRepositories(): Repositories {
  const hub = createNotifier();
  const notify = (topic: string) => hub.notify(topic);
  const markEmitted = (id: string) => hub.markEmitted(id);
  const wasEmittedLocally = (id: string | undefined) => hub.wasEmittedLocally(id);
  const subscribeTo = (topic: string, listener: () => void, openChannel: () => RealtimeChannel) =>
    hub.subscribeTo(topic, listener, openChannel);

  const session: SessionRepository = {
    async get(): Promise<Session> {
      const client = getSupabaseClient();
      const userId = await ensureUserId();

      const [profile, settings] = await Promise.all([
        client.from('profiles').select('id').eq('id', userId).maybeSingle(),
        client.from('user_settings').select('active_mode').eq('user_id', userId).maybeSingle(),
      ]);

      if (profile.error) throw profile.error;
      if (settings.error) throw settings.error;

      return {
        profileId: profile.data ? userId : null,
        activeMode: settings.data?.active_mode ?? null,
      };
    },

    async setActiveMode(mode) {
      const client = getSupabaseClient();
      const userId = await ensureUserId();

      const { error } = await client
        .from('user_settings')
        .upsert({ user_id: userId, active_mode: mode }, { onConflict: 'user_id' });
      if (error) throw error;

      return session.get();
    },

    /**
     * No-op deliberado.
     *
     * En el mock, `profileId` es un dato que alguien tiene que escribir. Aquí es
     * derivado: hay perfil si existe la fila `profiles` con `auth.uid()`, y esa
     * fila la crea `profiles.saveCurrent`. Escribirlo por separado solo podría
     * desincronizar las dos cosas, y un `setProfileId(null)` que borrase el perfil
     * sería destructivo para algo que el contrato describe como un simple marcador.
     */
    async setProfileId(_profileId) {
      return session.get();
    },

    async isOnboarded() {
      const current = await session.get();
      return current.profileId !== null && current.activeMode !== null;
    },
  };

  const profiles: ProfileRepository = {
    async verifyGithub() {
      const completed = await linkGithubIdentity();
      if (!completed) throw new Error(GITHUB_VERIFICATION_CANCELLED);

      // La verdad la escribe Postgres leyendo auth.identities. Aquí no viaja
      // ningún handle: si viajara, sería falsificable.
      const { error } = await getSupabaseClient().rpc('sync_github_verification');
      if (error) throw error;

      const profile = await profiles.getCurrent();
      if (!profile) throw new Error('No hay perfil que verificar todavía.');
      return profile;
    },

    async unverifyGithub() {
      await unlinkGithubIdentity();

      const { error } = await getSupabaseClient().rpc('sync_github_verification');
      if (error) throw error;

      const profile = await profiles.getCurrent();
      if (!profile) throw new Error('No hay perfil que desverificar todavía.');
      return profile;
    },

    async refreshGithubVerification() {
      const before = await profiles.getCurrent();
      if (!before) throw new Error('No hay perfil que sincronizar todavía.');

      // Sin sello no hay nada que refrescar, y llamar al RPC aquí sería
      // destructivo: su rama «no hay identidad de GitHub» vacía `link_github`, y
      // sin sello ese campo es lo que la persona escribió a mano en el
      // formulario. Salir antes es la guarda, no una optimización.
      if (!before.githubVerification) return before;

      const { error } = await getSupabaseClient().rpc('sync_github_verification');
      if (error) throw error;

      const after = await profiles.getCurrent();
      if (!after) throw new Error('No hay perfil que sincronizar todavía.');
      return after;
    },

    async getCurrent() {
      const client = getSupabaseClient();
      const userId = await ensureUserId();

      const { data, error } = await client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;

      return data ? toProfile(data) : null;
    },

    async saveCurrent(input: ProfileInput) {
      const client = getSupabaseClient();
      const userId = await ensureUserId();

      // Se lee el perfil actual solo para heredar el acento del avatar cuando el
      // formulario no manda uno; el resto de campos los pisa `input` entero.
      const existing = await profiles.getCurrent();

      const { data, error } = await client
        .from('profiles')
        .upsert(toProfileInsert(userId, input, existing), { onConflict: 'id' })
        .select('*')
        .single();
      if (error) throw error;

      // El perfil propio es el que se pinta en la lista de matches del otro lado
      // y en la propia pantalla de perfil: cambiarlo es un cambio visible.
      notify(MATCHES_TOPIC);

      return toProfile(data);
    },

    async getById(id) {
      const client = getSupabaseClient();
      await ensureUserId();

      const { data, error } = await client.from('profiles').select('*').eq('id', id).maybeSingle();
      if (error) throw error;

      return data ? toProfile(data) : null;
    },

    async list(filter: ProfileFilter = {}) {
      const client = getSupabaseClient();
      const userId = await ensureUserId();

      let query = client.from('profiles').select('*').neq('id', userId);

      // "Modo Par" incluye a quien está abierto a ambos: mismo criterio que
      // `matchesMode` en el mock y que el `where` de `discovery_deck`.
      if (filter.mode && filter.mode !== 'ambos') {
        query = query.in('looking_for', ['ambos', filter.mode]);
      }
      if (filter.specialties?.length) {
        query = query.overlaps('specialties', filter.specialties);
      }
      if (filter.excludeIds?.length) {
        query = query.not('id', 'in', `(${filter.excludeIds.join(',')})`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      return data.map(toProfile);
    },
  };

  const discovery: DiscoveryRepository = {
    async getDeck(filter: ProfileFilter = {}) {
      const client = getSupabaseClient();
      await ensureUserId();

      // `discovery_deck` ya excluye el perfil propio, todo lo swipeado y ahora
      // también `excludeIds`, y aplica el modo efectivo (el activo de la sesión
      // o, si no hay, el del perfil) cuando `p_mode` va nulo. Eso es
      // `effectiveMode()` del mock, en SQL. También ordena por encaje mutuo e id
      // ANTES de paginar (20260907000200). Conservar ese orden: ordenar aquí
      // solo clasificaría la primera página.
      //
      // `excludeIds` bajó al `where` de la propia función (20260918000100): antes
      // se filtraba aquí, DESPUÉS de que el RPC ya hubiera aplicado `p_limit`, así
      // que la página encogía de forma impredecible según cuánto llevara ya
      // swipeado quien pide el deck.
      const { data, error } = await client.rpc('discovery_deck', {
        p_mode: filter.mode ?? null,
        p_specialties: filter.specialties?.length ? filter.specialties : null,
        p_exclude_ids: filter.excludeIds?.length ? filter.excludeIds : null,
      });
      if (error) throw error;

      return (data as ProfileRow[]).map(toProfile);
    },

    async recordDecision(profileId: string, decision: Decision): Promise<DecisionResult> {
      const client = getSupabaseClient();
      const userId = await ensureUserId();

      const { data, error } = await client.rpc('record_decision', {
        p_target_id: profileId,
        p_decision: decision,
      });

      if (error) {
        // `23503` lo levanta `record_decision` cuando el perfil destino no existe
        // (o cuando el usuario todavía no tiene perfil propio). El contrato dice
        // que un perfil inexistente "no crea match ni revienta", así que se
        // traduce a un resultado sin match en vez de propagarlo.
        if (error.code === '23503') return { decision, match: null };
        throw error;
      }

      // `record_decision` devuelve `public.matches`, un tipo COMPUESTO, y cuando
      // devuelve NULL PostgREST no manda `null`: manda una fila con todas las
      // columnas a null. Sin mirar `id`, un `pass` o un like sin reciprocidad
      // acababa produciendo un `Match` de mentira con id `null`, que la pantalla
      // de match habría intentado abrir. Lo encontró
      // `src/data/supabase/contract.test.ts`; el mock nunca pudo verlo.
      const row = data as MatchRow | null;
      if (!row?.id) return { decision, match: null };

      markEmitted(row.id);
      notify(MATCHES_TOPIC);

      return { decision, match: toMatch(row, userId) };
    },

    async listDecided() {
      const client = getSupabaseClient();
      const userId = await ensureUserId();

      const { data, error } = await client
        .from('decisions')
        .select('target_id')
        .eq('actor_id', userId);
      if (error) throw error;

      return data.map((row) => row.target_id);
    },
  };

  const matches: MatchRepository = {
    async list() {
      const client = getSupabaseClient();
      const userId = await ensureUserId();

      // Sin `where`: la política "matches: solo los tuyos" ya limita la lectura a
      // los matches del usuario. Filtrar otra vez aquí solo daría una falsa
      // sensación de seguridad sobre dónde vive de verdad la regla.
      //
      // Sí lleva `range()`, en vueltas de `fetchAllPages`: sin él, una cuenta
      // con más matches que el tope de fila de PostgREST perdía los de más allá
      // sin ningún error. El orden por `id` es solo para que la paginación sea
      // estable entre vueltas — el orden que ve la pantalla lo pone
      // `byRecentActivity` en `resolveMatches`.
      const rows = await fetchAllPages<MatchRow>((from, to) =>
        client.from('matches').select('*').order('id', { ascending: true }).range(from, to)
      );

      return resolveMatches(rows, userId);
    },

    async getById(matchId) {
      const client = getSupabaseClient();
      const userId = await ensureUserId();

      const { data, error } = await client
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const [match] = await resolveMatches([data], userId);
      return match ?? null;
    },

    subscribe(listener): Unsubscribe {
      return subscribeTo(MATCHES_TOPIC, listener, () =>
        subscribeResyncingOnRejoin(
          getSupabaseClient()
            .channel('lockin:matches')
            // RLS filtra también el stream de realtime, así que aquí solo llegan
            // matches y mensajes del usuario: no hace falta filtro de servidor.
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'matches' },
              (payload) => {
                const row = payload.new as Partial<MatchRow> | undefined;
                if (wasEmittedLocally(row?.id)) return;
                notify(MATCHES_TOPIC);
              }
            )
            // Un mensaje nuevo mueve `last_message_at` y reordena la lista.
            .on(
              'postgres_changes',
              { event: 'INSERT', schema: 'public', table: 'messages' },
              () => {
                notify(MATCHES_TOPIC);
              }
            ),
          () => notify(MATCHES_TOPIC)
        )
      );
    },
  };

  const messages: MessageRepository = {
    async listByMatch(matchId) {
      const client = getSupabaseClient();
      await ensureUserId();

      const { data, error } = await client
        .from('messages')
        .select('*')
        .eq('match_id', matchId)
        .order('sent_at', { ascending: true })
        .order('id', { ascending: true });
      if (error) throw error;

      return data.map(toMessage);
    },

    async send({ matchId, body }: MessageInput) {
      const client = getSupabaseClient();
      const userId = await ensureUserId();

      // `sent_at` lo pone la base (`default now()`), no el reloj del teléfono: es
      // el mismo instante que el trigger copia a `matches.last_message_at`, así
      // que `lastMessageAt === sentAt` sale exacto sin depender del cliente.
      const { data, error } = await client
        .from('messages')
        .insert({ match_id: matchId, sender_id: userId, body })
        .select('*')
        .single();
      if (error) throw error;

      markEmitted(data.id);
      notify(messagesTopic(matchId));
      notify(MATCHES_TOPIC);

      return toMessage(data);
    },

    subscribe(matchId, listener): Unsubscribe {
      const topic = messagesTopic(matchId);

      return subscribeTo(topic, listener, () =>
        subscribeResyncingOnRejoin(
          getSupabaseClient()
            .channel(`lockin:${topic}`)
            .on(
              'postgres_changes',
              {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `match_id=eq.${matchId}`,
              },
              (payload) => {
                const row = payload.new as Partial<MessageRow> | undefined;
                if (wasEmittedLocally(row?.id)) return;
                notify(topic);
              }
            ),
          () => notify(topic)
        )
      );
    },
  };

  return {
    session,
    profiles,
    discovery,
    matches,
    messages,
    sessions: createSupabaseSessionRepository(),
  };
}
