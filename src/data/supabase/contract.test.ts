/**
 * @jest-environment node
 *
 * El contrato de `Repositories`, ejecutado contra Supabase de verdad.
 *
 * Es la misma suite que corre contra el mock — `src/data/repositories.contract.ts`,
 * llamada también desde `src/data/mock/index.test.ts` — pero con red, RLS y
 * Postgres detrás. Existe porque el mapeo test a test de `README.md` era papel:
 * decía qué pieza cumplía cada caso, y nadie lo comprobaba.
 *
 * ## Es opt-in, y no puede dejar de serlo
 *
 *     LOCKIN_SUPABASE_CONTRACT=1 npx jest src/data/supabase/contract.test.ts
 *
 * Sin esa variable la suite se salta entera. No entra en `npm test` ni en el CI
 * de cada push, y la razón no es comodidad:
 *
 * - **Escribe en la base a la que apunte.** En local habla con el proyecto de
 *   `.env.local`, que hoy es el real. La forma segura de ejecutarla es el
 *   workflow manual `.github/workflows/contract.yml`, que levanta una Supabase
 *   local desechable en el runner (migraciones + `supabase/seed.sql`) y exige
 *   que no haya `.env.local`.
 * - **Necesita `supabase/seed.sql` ejecutado.** No por el catálogo, sino por
 *   `dev_reset_current_user()`. Las políticas RLS no dan DELETE sobre
 *   `decisions`, `matches` ni `messages` a NADIE — con razón: un swipe no se
 *   deshace —, así que sin esa función de desarrollo el único estado limpio
 *   posible es un usuario nuevo POR TEST, y Supabase limita las altas anónimas
 *   por IP a 30/hora: la suite se queda a medias con `Request rate limit
 *   reached`. Con la función, una pasada gasta cuatro altas en total. El
 *   respaldo sigue ahí y avisa por qué falla.
 * - **Deja rastro.** Cada pasada da de alta cuatro usuarios anónimos. Sus
 *   perfiles, decisiones, matches y mensajes los borra el `teardown()` con
 *   `dev_reset_current_user()`, así que el catálogo vuelve a los ocho de
 *   `seed.sql`; lo que sobrevive es la fila de `auth.users`, que exige
 *   privilegios que la clave `anon` no tiene. No rompe nada —sin perfil, esas
 *   cuentas no salen en ningún deck—, pero conviene vaciarlas de vez en cuando:
 *   el procedimiento está en `supabase/README.md`, sección "Mantenimiento:
 *   borrar los usuarios anónimos de pruebas".
 *
 * ## Cómo se consigue la reciprocidad
 *
 * En el mock, los likes entrantes son un `Set` sembrado de fábrica. Aquí tienen
 * que existir de verdad: tres usuarios de apoyo abren su propia sesión y llaman
 * a `record_decision()` contra el usuario del test. Es exactamente lo que pasa
 * en producción cuando alguien te da like antes que tú a él.
 *
 * Esos tres son usuarios anónimos que crea la propia suite, no los perfiles de
 * `supabase/seed.sql`, por dos razones:
 *
 * - `seed_incoming_likes()` inserta en `decisions` en nombre de otros y, sin
 *   `SECURITY DEFINER`, solo funciona como superusuario. Que el camino del test
 *   sea el mismo que el de la app es parte de lo que se está comprobando.
 * - Entrar como un usuario de `seed.sql` requiere que sus filas de `auth.users`
 *   estén bien formadas. Se insertan a mano y es fácil que no lo estén: contra
 *   `grrzmzktrhksbttpbblg` el login devolvía `500 Database error querying
 *   schema` por columnas de token en NULL (arreglado en `supabase/seed.sql`,
 *   pero las filas ya creadas siguen rotas hasta que se reparen). Depender de
 *   eso ataría el contrato a un detalle de una herramienta de desarrollo.
 *
 * Del catálogo semilla solo se usan dos perfiles en papeles pasivos —uno al que
 * dar like sin reciprocidad y otro para `excludeIds`—, que no necesitan iniciar
 * sesión: basta con que existan.
 *
 * ## Por qué este archivo corre en el entorno `node`
 *
 * El `@jest-environment node` de arriba no es cosmético. `jest-expo` instala
 * los globals de Expo, y entre ellos un `fetch` (`expo/fetch`) que en Jest es
 * un stub sin módulo nativo detrás: devuelve respuestas con `status`
 * indefinido, así que cualquier llamada de `@supabase/supabase-js` falla con
 * `"undefined" is not valid JSON`. En el entorno `node` ese stub se sigue
 * instalando —los `setupFiles` del preset corren igual—, pero aquí se puede
 * sustituir por una implementación real sin afectar a ninguna otra suite. El
 * `WebSocket` que necesita realtime sí es el nativo de Node.
 */

/* eslint-disable @typescript-eslint/no-require-imports */

import fs from 'fs';
import path from 'path';

import { createClient } from '@supabase/supabase-js';

import { buildProfileInput } from '../test-fixtures';
import { describeRepositoryContract } from '../repositories.contract';
import { toProfileInsert } from './mappers';

import type { ContractBackend, ContractFixture } from '../repositories.contract';
import type { Database, IncomingLikeRow } from './database.types';
import type { ModePreference } from '../types';
import type {
  AgreementRepository,
  LockInSessionRepository,
  Repositories,
  RoomRepository,
} from '../repositories';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

// Devuelve el `fetch` real antes de que `createClient` capture el stub de
// `jest-expo`. Ver la cabecera del archivo.
const originalFetch = (globalThis as { originalfetch?: typeof globalThis.fetch }).originalfetch;
if (!originalFetch) {
  throw new Error(
    'No hay globalThis.originalfetch: el polyfill de Expo ha cambiado y esta suite ' +
      'se quedaría con el fetch stub de jest-expo, que no sale a la red.'
  );
}
globalThis.fetch = originalFetch;

/**
 * Perfiles de `supabase/seed.sql` en papel pasivo: nunca inician sesión, solo
 * tienen que existir. Diego declara `par` y no da like a nadie; Lucía solo se
 * usa para comprobar que `excludeIds` la saca del deck.
 */
const DIEGO_ID = '11111111-1111-4111-8111-000000000004';
const LUCIA_ID = '11111111-1111-4111-8111-000000000007';

/** UUID con forma válida que no existe en la base. */
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

/**
 * Los tres usuarios de apoyo que darán like al usuario de cada test. El modo
 * que declaran importa: el de `ambos` es el que prueba que un match nace en el
 * modo concreto de la sesión.
 */
const RECIPROCALS: { label: string; lookingFor: ModePreference }[] = [
  { label: 'Recíproca Par', lookingFor: 'par' },
  { label: 'Recíproca Lockin', lookingFor: 'lockin' },
  { label: 'Recíproca Ambos', lookingFor: 'ambos' },
];

/**
 * Lee `.env.local` a mano.
 *
 * Metro inyecta las `EXPO_PUBLIC_*` al hacer el bundle, pero Jest no: si no se
 * leyeran aquí, `client.ts` no encontraría credenciales. Se hace en este
 * archivo y no en `jest.setup.js` porque poner esas variables en el entorno
 * global haría que `src/data/active.ts` eligiera Supabase en TODAS las suites,
 * y las pantallas empezarían a pedir red en los tests de componente.
 */
function readEnvLocal(): Record<string, string> {
  const file = path.resolve(__dirname, '../../../.env.local');
  if (!fs.existsSync(file)) return {};

  return Object.fromEntries(
    fs
      .readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=');
        const key = line.slice(0, separator).trim();
        const value = line
          .slice(separator + 1)
          .trim()
          .replace(/^["']|["']$/g, '');
        return [key, value];
      })
      .filter(([key]) => key)
  );
}

const env = readEnvLocal();
const url = env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const enabled = process.env.LOCKIN_SUPABASE_CONTRACT === '1' && Boolean(url && anonKey);

/** Un usuario de apoyo, con su sesión propia y su perfil ya creado. */
interface Reciprocal {
  id: string;
  client: SupabaseClient<Database>;
}

/**
 * Crea un usuario de apoyo: alta anónima, cliente propio y perfil en el
 * catálogo. Se hace una sola vez por pasada, no por test — cada uno cuesta un
 * alta anónima del cupo por hora.
 */
async function createReciprocal(label: string, lookingFor: ModePreference): Promise<Reciprocal> {
  const client = createClient<Database>(url!, anonKey!, {
    // Sin persistencia: si estos clientes escribieran en AsyncStorage pisarían
    // la sesión del usuario del test, que vive en el cliente de `client.ts`.
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error } = await client.auth.signInAnonymously();
  if (error) throw error;
  const id = data.user!.id;

  // El perfil hace falta para dos cosas: `record_decision()` exige que el actor
  // tenga uno, y la lista de matches del usuario del test tiene que poder
  // resolver el perfil del otro lado.
  const { error: profileError } = await client
    .from('profiles')
    .upsert(toProfileInsert(id, buildProfileInput({ name: label, lookingFor }), null), {
      onConflict: 'id',
    });
  if (profileError) throw profileError;

  return { id, client };
}

let appClient: SupabaseClient<Database>;
let repositories: Repositories;
let reciprocals: Reciprocal[] = [];

/**
 * `dev_reset_current_user()` no está en `database.types.ts` a propósito: ese
 * archivo es la traducción literal de `supabase/migrations/`, y esta función
 * vive solo en `supabase/seed.sql` porque nunca debe llegar a producción.
 */
async function callDevReset(client: SupabaseClient<Database>): Promise<string | null> {
  const rpc = client.rpc.bind(client) as unknown as (
    fn: string
  ) => PromiseLike<{ error: { code?: string; message: string } | null }>;

  const { error } = await rpc('dev_reset_current_user');
  return error ? (error.code ?? error.message) : null;
}

/**
 * Las funciones `dev_*` de Premium viven solo en `supabase/seed.sql` (nunca en
 * producción), así que tampoco están en `database.types.ts`.
 */
async function callDev(
  client: SupabaseClient<Database>,
  fn: string,
  args?: Record<string, unknown>
): Promise<void> {
  const rpc = client.rpc.bind(client) as unknown as (
    name: string,
    params?: Record<string, unknown>
  ) => PromiseLike<{ error: { code?: string; message: string } | null }>;
  const { error } = await rpc(fn, args);
  if (error) throw new Error(`${fn} falló: ${error.code ?? ''} ${error.message}`);
}

/**
 * Tope de página de `discovery_deck` (`p_limit default 50`, ver
 * `supabase/migrations/20260905000500_functions_and_realtime.sql`).
 */
const DECK_PAGE_LIMIT = 50;

/**
 * El catálogo es estado compartido, y hay un caso del contrato que depende de
 * su tamaño: «sin modo concreto devuelve el catálogo entero» compara el deck
 * sin filtrar con el filtrado por modo y exige que el primero sea mayor. En
 * cuanto el catálogo pasa del tope de página los dos devuelven `DECK_PAGE_LIMIT`
 * y el caso falla con un `Expected: > 50 / Received: 50` que no dice nada de la
 * causa real.
 *
 * Así que se comprueba antes de empezar, y el fallo explica qué ejecutar. El
 * margen deja sitio a los cuatro perfiles que crea la propia pasada.
 */
async function assertCatalogFitsInOneDeckPage(): Promise<void> {
  const { count, error } = await appClient
    .from('profiles')
    .select('id', { count: 'exact', head: true });
  if (error) throw error;
  if (count === null || count + RECIPROCALS.length + 1 <= DECK_PAGE_LIMIT) return;

  throw new Error(
    `El catálogo tiene ${count} perfiles y discovery_deck pagina a ${DECK_PAGE_LIMIT}: ` +
      'el deck sin filtrar y el filtrado por modo saldrían ambos llenos y el contrato ' +
      'no podría distinguirlos. Son perfiles de pasadas antiguas de esta suite, de ' +
      'cuando su teardown no los borraba. Límpialos en el SQL editor con\n\n' +
      '    delete from auth.users where is_anonymous = true;\n\n' +
      'que se lleva por cascada perfiles, decisiones, matches y mensajes de los ' +
      'usuarios anónimos y deja intactos los ocho de supabase/seed.sql.'
  );
}

/**
 * Devuelve al usuario de la sesión a "recién registrado".
 *
 * El camino bueno es `dev_reset_current_user()` (ver `supabase/seed.sql`): una
 * sola llamada, sin gastar altas. Si esa función no está en la base, se cae al
 * único otro reset posible —registrar un usuario anónimo nuevo—, que funciona
 * pero agota el límite de altas por IP a mitad de la suite.
 */
async function resetCurrentUser(): Promise<string> {
  const failure = await callDevReset(appClient);
  if (failure === null) {
    const { data } = await appClient.auth.getSession();
    return data.session!.user.id;
  }

  // Los tres códigos que significan "esa función no está disponible aquí":
  // `PGRST202` es el de PostgREST cuando no la encuentra en el cache de
  // esquema —el que sale de verdad cuando no se ha ejecutado el seed—, y
  // `42883`/`42501` los de Postgres si llegara a la base sin existir o sin
  // permiso. Cualquier otro código es un fallo real y no debe quedar tapado.
  const MISSING = ['PGRST202', '42883', '42501'];
  if (!MISSING.includes(failure)) {
    throw new Error(`dev_reset_current_user() falló: ${failure}`);
  }

  await appClient.auth.signOut();
  const { data, error } = await appClient.auth.signInAnonymously();
  if (error) {
    throw new Error(
      `${error.message}. Sin dev_reset_current_user() esta suite necesita un alta ` +
        'anónima por test y agota el límite por IP. Ejecuta supabase/seed.sql en el ' +
        'proyecto para instalarla.'
    );
  }
  return data.user!.id;
}

/**
 * Sesiones actuando como un usuario de apoyo, con su cliente y su sesión.
 *
 * Con `require` y no con `import` por lo mismo que `./index`: `sessions.ts`
 * importa `client.ts`, que lee las credenciales al cargarse, y a esta altura del
 * archivo todavía no están en `process.env`.
 */
function sessionRepositoryFor(actor: Reciprocal): LockInSessionRepository {
  const { createSupabaseSessionRepository } = require('./sessions') as typeof import('./sessions');
  return createSupabaseSessionRepository({
    getClient: () => actor.client,
    getUserId: async () => actor.id,
  });
}

function roomRepositoryFor(actor: Reciprocal): RoomRepository {
  const { createSupabaseRoomRepository } = require('./rooms') as typeof import('./rooms');
  return createSupabaseRoomRepository({
    getClient: () => actor.client,
    getUserId: async () => actor.id,
  });
}

function agreementRepositoryFor(actor: Reciprocal): AgreementRepository {
  const { createSupabaseAgreementRepository } =
    require('./agreement') as typeof import('./agreement');
  return createSupabaseAgreementRepository({
    getClient: () => actor.client,
    getUserId: async () => actor.id,
  });
}

/**
 * Espera a que todos los canales de realtime abiertos estén enganchados.
 *
 * `subscribe()` vuelve antes de que el servidor registre la suscripción. Si el
 * cable se cortara antes de ese primer `join`, el `SUBSCRIBED` posterior sería
 * el primero y el caso del reenganche pasaría sin demostrar nada.
 */
async function waitUntilChannelsJoined(): Promise<void> {
  const deadline = Date.now() + 20_000;
  for (;;) {
    const channels = appClient.realtime.getChannels();
    if (channels.length > 0 && channels.every((channel) => channel.state === 'joined')) return;
    if (Date.now() > deadline) {
      const states = channels.map((channel) => `${channel.topic}=${channel.state}`).join(', ');
      throw new Error(
        `Los canales de realtime no llegaron a engancharse en 20 s: ${states || '(ninguno)'}`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

const supabaseBackend: ContractBackend = {
  name: 'supabase',
  canTimeTravel: false,
  // Un OAuth real necesita un navegador y un humano del otro lado: esta suite
  // no puede completar verifyGithub()/unverifyGithub() sola.
  canLinkIdentityWithoutBrowser: false,

  /**
   * La caída de red del caso del reenganche.
   *
   * `realtime.disconnect()` cierra el socket y deja los canales en `errored`
   * sin programar reconexión; `connect()` los hace reengancharse. Es la misma
   * secuencia que vive un teléfono que pierde cobertura, con la diferencia de
   * que aquí decidimos cuándo. Solo se toca el cliente del usuario del test:
   * los de apoyo tienen el suyo y siguen escribiendo con normalidad.
   */
  async dropRealtime() {
    await waitUntilChannelsJoined();
    await appClient.realtime.disconnect();
  },

  async restoreRealtime() {
    appClient.realtime.connect();
  },

  /**
   * El match ajeno de los casos «un tercero suscrito…», con el camino de la
   * app: `record_decision()` por los dos lados, un `insert` en `messages` y los
   * RPC de sesiones. El borrado es `dev_reset_current_user()` de uno de los
   * dos, que en cascada genera un DELETE en `matches`, `messages`,
   * `lockin_sessions` y `session_attendance` — lo mismo que darse de baja.
   */
  async foreignMatch(onReady) {
    // Los dos de apoyo que no comparten match con el usuario en ninguno de
    // los casos que usan esto: esos casos solo le dan like a `reciprocalAId`.
    const [, lockinReciprocal, bothReciprocal] = reciprocals;

    // Primero, los canales del usuario enganchados: si no, los avisos que se
    // trata de no recibir se perderían por llegar antes del `join`, y el caso
    // pasaría sin demostrar nada. Luego, margen para los DELETE del `reset()`
    // de este caso, que en el run 37125586152 llegaron 0,4 s después de
    // enganchar; `onReady` los descuenta.
    await waitUntilChannelsJoined();
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    onReady();

    // Sin reponer el perfil después: nada del caso lo vuelve a leer, y el
    // `reset()` del siguiente lo recrea.
    let wiped = false;
    const wipe = async () => {
      if (wiped) return;
      wiped = true;
      const failure = await callDevReset(bothReciprocal.client);
      if (failure) throw new Error(`dev_reset_current_user() falló: ${failure}`);
    };

    try {
      const { error: likeError } = await lockinReciprocal.client.rpc('record_decision', {
        p_target_id: bothReciprocal.id,
        p_decision: 'like',
      });
      if (likeError) throw likeError;
      const { data: match, error: matchError } = await bothReciprocal.client.rpc(
        'record_decision',
        { p_target_id: lockinReciprocal.id, p_decision: 'like' }
      );
      if (matchError) throw matchError;
      if (!match) throw new Error('foreignMatch: el like recíproco no cerró match');

      const { error: messageError } = await lockinReciprocal.client
        .from('messages')
        .insert({ match_id: match.id, sender_id: lockinReciprocal.id, body: 'ajeno' });
      if (messageError) throw messageError;

      const proposer = sessionRepositoryFor(lockinReciprocal);
      const accepter = sessionRepositoryFor(bothReciprocal);
      const now = Date.parse(await proposer.serverNow());
      // Justo por encima del margen mínimo de 5 minutos: la ventana de entrada
      // abre a los 2 s, y hace falta para que haya filas de asistencia.
      const session = await proposer.propose({
        matchId: match.id,
        startsAt: new Date(now + 5 * 60_000 + 2_000).toISOString(),
        blocks: 1,
      });
      await accepter.respond(session.id, 'aceptada');
      await new Promise((resolve) => setTimeout(resolve, 3_000));
      await proposer.join(session.id);
      await accepter.join(session.id);

      return { matchId: match.id, wipe };
    } catch (error) {
      await wipe();
      throw error;
    }
  },

  async reset(): Promise<ContractFixture> {
    const currentUserId = await resetCurrentUser();
    for (const [index, actor] of reciprocals.entries()) {
      // Los de apoyo gastan cupos de Super Like y Boost (`superLikeFrom`,
      // `boostAs`) y los likes_events/boosts no se pueden borrar desde el
      // cliente: se resetean como el usuario de la app, y su perfil se vuelve a
      // subir justo debajo.
      const failure = await callDevReset(actor.client);
      if (failure !== null) throw new Error(`dev_reset_current_user() falló: ${failure}`);
      const { label, lookingFor } = RECIPROCALS[index];
      const { error } = await actor.client
        .from('profiles')
        .upsert(toProfileInsert(actor.id, buildProfileInput({ name: label, lookingFor }), null));
      if (error) throw error;
    }
    const [parReciprocal, lockinReciprocal, bothReciprocal] = reciprocals;

    const used = new Set<string>();
    const extraClients: SupabaseClient<Database>[] = [];
    return {
      async realtimeFor(profileId) {
        const { createSupabasePresenceAdapter } =
          require('./presence') as typeof import('./presence');
        const { createSupabaseVideoSignalAdapter } =
          require('./video-signal') as typeof import('./video-signal');
        let client =
          profileId === currentUserId
            ? appClient
            : reciprocals.find((actor) => actor.id === profileId)!.client;
        if (used.has(profileId)) {
          // Otra pantalla del mismo perfil: otro socket con la misma identidad,
          // sin gastar un alta anónima ni compartir el canal del primer cliente.
          const { data } = await client.auth.getSession();
          client = createClient<Database>(url!, anonKey!, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
          });
          extraClients.push(client);
          const { error } = await client.auth.setSession(data.session!);
          if (error) throw error;
        }
        used.add(profileId);
        return {
          presence: createSupabasePresenceAdapter(() => client),
          videoSignal: createSupabaseVideoSignalAdapter(() => client),
        };
      },
      async closeRealtime() {
        for (const client of [
          appClient,
          ...reciprocals.map((actor) => actor.client),
          ...extraClients,
        ]) {
          await client.removeAllChannels();
          await client.realtime.disconnect();
        }
        // No signOut: la pantalla extra comparte la sesión de la contraparte.
        extraClients.length = 0;
      },
      repositories,
      currentUserId,
      async setRankingCandidates(inputs) {
        for (const [index, input] of inputs.entries()) {
          const actor = reciprocals[index];
          const { error } = await actor.client
            .from('profiles')
            .upsert(toProfileInsert(actor.id, input, null));
          if (error) throw error;
        }
        return reciprocals.map((actor) => actor.id);
      },

      async prepareSwiper() {
        // El perfil propio primero: `record_decision()` exige que el actor
        // tenga perfil, y los de apoyo no podrían apuntar a un perfil que no
        // existe (la FK de `decisions` va contra `profiles`).
        await repositories.profiles.saveCurrent(buildProfileInput());

        for (const reciprocal of reciprocals) {
          const { error: likeError } = await reciprocal.client.rpc('record_decision', {
            p_target_id: currentUserId,
            p_decision: 'like',
          });
          if (likeError) throw likeError;
        }
      },

      reciprocalAId: parReciprocal.id,
      reciprocalBId: lockinReciprocal.id,
      openToBothReciprocalId: bothReciprocal.id,
      nonReciprocalId: DIEGO_ID,
      excludableId: LUCIA_ID,
      unknownProfileId: UNKNOWN_ID,
      counterpartSessions: () => sessionRepositoryFor(parReciprocal),
      outsiderSessions: () => sessionRepositoryFor(lockinReciprocal),
      counterpartAgreement: () => agreementRepositoryFor(parReciprocal),
      outsiderAgreement: () => agreementRepositoryFor(lockinReciprocal),
      roomsFor: (profileId) => {
        const actor = reciprocals.find((candidate) => candidate.id === profileId);
        if (!actor) throw new Error('roomsFor: perfil de apoyo desconocido: ' + profileId);
        return roomRepositoryFor(actor);
      },
      elapse: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      // Estado que el cliente no puede escribir: lo siembran las `dev_*` de seed.sql.
      async setPremium(active) {
        await callDev(appClient, 'dev_set_premium', { p_active: active });
      },
      async seedLikeEvents(kind, count, ageHours) {
        await callDev(appClient, 'dev_add_like_events', {
          p_kind: kind,
          p_count: count,
          p_age_hours: ageHours,
        });
      },
      async ageLastDecision(minutes) {
        await callDev(appClient, 'dev_age_last_decision', { p_minutes: minutes });
      },
      async seedPastBoost(ageDays) {
        await callDev(appClient, 'dev_add_boost', { p_age_days: ageDays });
      },
      async superLikeFrom(profileId) {
        const actor = reciprocals.find((candidate) => candidate.id === profileId);
        if (!actor) throw new Error('superLikeFrom: perfil de apoyo desconocido: ' + profileId);
        // Con Premium hay 5 Super Likes a la semana, no 1: sobra holgura.
        await callDev(actor.client, 'dev_set_premium', { p_active: true });
        const { error } = await actor.client.rpc('record_decision', {
          p_target_id: currentUserId,
          p_decision: 'like',
          p_super: true,
        });
        if (error) throw error;
      },
      async boostAs(profileId) {
        const actor = reciprocals.find((candidate) => candidate.id === profileId);
        if (!actor) throw new Error('boostAs: perfil de apoyo desconocido: ' + profileId);
        await callDev(actor.client, 'dev_set_premium', { p_active: true });
        const { error } = await actor.client.rpc('activate_boost');
        if (error) throw error;
      },
    };
  },

  async safetyPair() {
    // Tres usuarios anónimos NUEVOS, aparte del usuario del test y de los de
    // apoyo; cada uno con su propio cliente y su propio juego de repositorios.
    const { createSupabaseRepositories } = require('./index') as typeof import('./index');
    const actors: {
      client: SupabaseClient<Database>;
      id: string;
      repositories: Repositories;
    }[] = [];
    for (let index = 0; index < 3; index += 1) {
      const client = createClient<Database>(url!, anonKey!, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { data, error } = await client.auth.signInAnonymously();
      if (error) throw error;
      const id = data.user!.id;
      actors.push({
        client,
        id,
        repositories: createSupabaseRepositories({
          getClient: () => client,
          getUserId: async () => id,
        }),
      });
    }
    return {
      a: actors[0].repositories,
      b: actors[1].repositories,
      c: actors[2].repositories,
      aId: actors[0].id,
      bId: actors[1].id,
      cId: actors[2].id,
      async expectReportsPrivate() {
        // Sin política SELECT: 42501 (permiso denegado) o, como mucho, vacío.
        for (const { client } of actors) {
          const { data, error } = await client.from('user_reports').select('*');
          if (error) expect(error.code).toBe('42501');
          else expect(data).toEqual([]);
        }
      },
      async close() {
        for (const { client } of actors) {
          const { error } = await client.rpc('delete_my_account');
          if (error) throw error;
          await client.removeAllChannels();
          client.realtime.disconnect();
          await client.auth.signOut();
        }
      },
    };
  },

  async teardown() {
    // Deshacer lo que la pasada ha metido en el catálogo, ANTES de cerrar las
    // sesiones: `dev_reset_current_user()` solo mira `auth.uid()`, así que sin
    // sesión no hay nada que borrar.
    //
    // No es limpieza cosmética. Los cuatro usuarios de cada pasada (el del test
    // y los tres de apoyo) dejaban su perfil en el catálogo para siempre, y el
    // catálogo es un recurso compartido de los tests: `discovery_deck` pagina a
    // 50 filas, así que a partir de la pasada número quince el deck sin filtrar
    // y el filtrado por modo devolvían ambos 50 y «sin modo concreto devuelve el
    // catálogo entero» fallaba con un `Expected: > 50 / Received: 50` que no
    // apunta a nada. Los `auth.users` anónimos sí sobreviven —borrarlos exige la
    // clave `service_role`—, pero sin perfil no salen en ningún deck.
    await callDevReset(appClient);
    for (const reciprocal of reciprocals) {
      await callDevReset(reciprocal.client);
    }

    // Sin esto Jest no termina: quedan vivos el websocket de realtime y el
    // temporizador de refresco del token.
    await appClient.removeAllChannels();
    appClient.realtime.disconnect();
    appClient.auth.stopAutoRefresh();
    await appClient.auth.signOut();

    for (const reciprocal of reciprocals) {
      // Los repositorios de sesiones de la otra persona abren canales de realtime.
      await reciprocal.client.removeAllChannels();
      await reciprocal.client.auth.signOut();
    }
    reciprocals = [];
  },
};

(enabled ? describe : describe.skip)('Supabase (opt-in: LOCKIN_SUPABASE_CONTRACT=1)', () => {
  // Cada test abre sesión, crea perfil y hace varias llamadas de red.
  jest.setTimeout(120_000);

  beforeAll(async () => {
    // Se ponen antes de cargar `client.ts`, que lee `process.env` al importarse.
    process.env.EXPO_PUBLIC_SUPABASE_URL = url;
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = anonKey;

    const { getSupabaseClient } = require('./client') as typeof import('./client');
    const { createSupabaseRepositories } = require('./index') as typeof import('./index');

    appClient = getSupabaseClient();
    repositories = createSupabaseRepositories();

    // La sesión del usuario del test se abre UNA vez; a partir de ahí cada
    // `reset()` la vacía con `dev_reset_current_user()` en vez de registrar a
    // otro. `AsyncStorage` está mockeado y arranca vacío, así que no hay sesión
    // previa que reutilizar.
    const { error: sessionError } = await appClient.auth.signInAnonymously();
    if (sessionError) throw sessionError;

    await assertCatalogFitsInOneDeckPage();

    // En serie, no en paralelo: tres altas anónimas simultáneas desde la misma
    // IP es justo la forma de tropezar con el limitador.
    reciprocals = [];
    for (const { label, lookingFor } of RECIPROCALS) {
      reciprocals.push(await createReciprocal(label, lookingFor));
    }
  });

  describeRepositoryContract(supabaseBackend);

  // Complementa `describe('premium')` del contrato compartido: aquí se observa
  // la respuesta SQL sin traducir errores ni pasar por los repositorios.
  describe('Premium SQL: RPC, cupos y permisos', () => {
    const MINUTE_MS = 60_000;
    const HOUR_MS = 60 * MINUTE_MS;
    const DAY_MS = 24 * HOUR_MS;
    type DeckArgs = Database['public']['Functions']['discovery_deck']['Args'];
    type DecisionArgs = Database['public']['Functions']['record_decision']['Args'];
    let actors: Reciprocal[] = [];
    let viewer: Reciprocal;
    let peers: Reciprocal[];

    // El teardown del contrato compartido ya cerró appClient y reciprocals.
    // Solo cuatro altas para todo este bloque; el seed limpia entre casos.
    beforeAll(async () => {
      for (const label of ['Premium SQL', 'SQL A', 'SQL B', 'SQL C']) {
        actors.push(await createReciprocal(label, 'par'));
      }
      [viewer, ...peers] = actors;
    });

    beforeEach(async () => {
      for (const actor of actors) {
        const failure = await callDevReset(actor.client);
        if (failure !== null) throw new Error(`dev_reset_current_user() falló: ${failure}`);
      }
      for (const actor of actors) {
        await sqlData(
          actor.client
            .from('profiles')
            .upsert(toProfileInsert(actor.id, buildProfileInput({ lookingFor: 'par' }), null))
        );
      }
    });

    afterAll(async () => {
      for (const actor of actors) {
        try {
          const failure = await callDevReset(actor.client);
          if (failure !== null) throw new Error(`dev_reset_current_user() falló: ${failure}`);
        } finally {
          await actor.client.removeAllChannels();
          actor.client.realtime.disconnect();
          actor.client.auth.stopAutoRefresh();
          await actor.client.auth.signOut();
        }
      }
      actors = [];
    });

    async function sqlData<T>(request: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
      const { data, error } = await request;
      expect(error).toBeNull();
      return data;
    }

    const record = (
      targetId: string,
      args: Partial<Omit<DecisionArgs, 'p_target_id'>> = {},
      actor = viewer
    ) =>
      actor.client.rpc('record_decision', {
        p_target_id: targetId,
        p_decision: 'like',
        p_mode: 'par',
        ...args,
      });

    const quotas = async (actor = viewer) =>
      (await sqlData(actor.client.rpc('premium_quotas').single()))!;
    const decisions = (actor = viewer) =>
      sqlData(
        actor.client
          .from('decisions')
          .select('target_id, decision, created_at')
          .eq('actor_id', actor.id)
          .order('target_id')
      );
    const setPremium = (active: boolean, actor = viewer) =>
      callDev(actor.client, 'dev_set_premium', { p_active: active });
    const seedLikes = (kind: 'like' | 'super', count: number, ageHours = 1) =>
      callDev(viewer.client, 'dev_add_like_events', {
        p_kind: kind,
        p_count: count,
        p_age_hours: ageHours,
      });

    async function sqlQuota(
      request: PromiseLike<{ error: PostgrestError | null }>,
      code: string,
      resetsAt: string | null
    ) {
      const { error } = await request;
      expect(error?.code).toBe(code);
      expect(error?.details).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(Number.isFinite(Date.parse(error!.details))).toBe(true);
      expect(Date.parse(error!.details)).toBe(Date.parse(resetsAt!));
    }

    it.each([
      {
        label: 'like 26 gratis',
        premium: false,
        kind: 'like',
        count: 24,
        superLike: false,
        code: 'LQ001',
      },
      {
        label: 'segundo Super Like gratis',
        premium: false,
        kind: 'super',
        count: 0,
        superLike: true,
        code: 'LQ002',
      },
      {
        label: 'sexto Super Like Premium',
        premium: true,
        kind: 'super',
        count: 4,
        superLike: true,
        code: 'LQ002',
      },
      {
        label: 'like 301 Premium',
        premium: true,
        kind: 'like',
        count: 299,
        superLike: false,
        code: 'LQ004',
      },
    ] as const)('$label: código, detail y rechazo sin escritura', async (test) => {
      await setPremium(test.premium);
      await seedLikes(test.kind, test.count);
      await sqlData(record(peers[0].id, { p_super: test.superLike }));
      await sqlData(record(peers[1].id, { p_decision: 'pass' }));
      const before = await quotas();
      const rows = await decisions();

      await sqlQuota(
        record(peers[1].id, { p_super: test.superLike }),
        test.code,
        test.superLike ? before.supers_reset_at : before.likes_reset_at
      );

      expect(await decisions()).toEqual(rows);
      expect(await quotas()).toEqual(before);
      expect(await sqlData(viewer.client.from('matches').select('id'))).toEqual([]);
      // Incluso con el cupo agotado se puede hacer pass; no genera eventos.
      await sqlData(record(peers[2].id, { p_decision: 'pass', p_super: true }));
      expect(await quotas()).toEqual(before);
    });

    it('LQ004 tiene prioridad sobre LQ001 al perder Premium con 300 likes gastados', async () => {
      await setPremium(true);
      await seedLikes('like', 300);
      await setPremium(false);
      const before = await quotas();

      await sqlQuota(record(peers[0].id), 'LQ004', before.likes_reset_at);

      expect(await decisions()).toEqual([]);
      expect(await quotas()).toEqual(before);
    });

    it('like → pass → like registra dos gastos aunque solo quede una decisión', async () => {
      await sqlData(record(peers[0].id));
      expect((await quotas()).likes_left).toBe(24);
      await sqlData(record(peers[0].id, { p_decision: 'pass' }));
      expect((await quotas()).likes_left).toBe(24);
      await sqlData(record(peers[0].id));

      expect((await quotas()).likes_left).toBe(23);
      expect(await decisions()).toEqual([
        expect.objectContaining({ target_id: peers[0].id, decision: 'like' }),
      ]);
    });

    it('reintentos concurrentes del mismo Super Like gastan uno y no renuevan created_at', async () => {
      await setPremium(true);
      const first = await Promise.all([
        record(peers[0].id, { p_super: true }),
        record(peers[0].id, { p_super: true }),
      ]);
      expect(first.map(({ error }) => error)).toEqual([null, null]);
      expect((await quotas()).supers_left).toBe(4);

      await callDev(viewer.client, 'dev_age_last_decision', { p_minutes: 9 });
      await seedLikes('super', 4);
      const rows = await decisions();
      const before = await quotas();
      expect(before.supers_left).toBe(0);
      const retries = await Promise.all([
        record(peers[0].id, { p_super: true }),
        record(peers[0].id, { p_super: true }),
      ]);

      expect(retries.map(({ error }) => error)).toEqual([null, null]);
      expect(await decisions()).toEqual(rows);
      expect(await quotas()).toEqual(before);
    });

    it.each([
      {
        label: 'likes gratis',
        premium: false,
        kind: 'like',
        count: 24,
        superLike: false,
        code: 'LQ001',
      },
      {
        label: 'Super Likes Premium',
        premium: true,
        kind: 'super',
        count: 4,
        superLike: true,
        code: 'LQ002',
      },
      {
        label: 'antiabuso Premium',
        premium: true,
        kind: 'like',
        count: 299,
        superLike: false,
        code: 'LQ004',
      },
    ] as const)(
      'cerrojo por actor: dos targets comparten el último cupo de $label',
      async (test) => {
        await setPremium(test.premium);
        await seedLikes(test.kind, test.count);
        const before = await quotas();
        const results = await Promise.all(
          peers.slice(0, 2).map((peer) => record(peer.id, { p_super: test.superLike }))
        );
        expect(results.filter(({ error }) => error === null)).toHaveLength(1);
        const rejected = results.findIndex(({ error }) => error !== null);
        await sqlQuota(
          Promise.resolve(results[rejected]),
          test.code,
          test.superLike ? before.supers_reset_at : before.likes_reset_at
        );
        const accepted = rejected === 0 ? 1 : 0;
        expect(await decisions()).toEqual([
          expect.objectContaining({ target_id: peers[accepted].id, decision: 'like' }),
        ]);
        const after = await quotas();
        expect(test.superLike ? after.supers_left : after.likes_left).toBe(
          test.premium && !test.superLike ? null : 0
        );
        // Un tercer target sigue rechazado: el perdedor no dejó una decisión ni
        // un match, y el cupo tampoco se recarga por cambiar de target.
        await sqlQuota(
          record(peers[2].id, { p_super: test.superLike }),
          test.code,
          test.superLike ? after.supers_reset_at : after.likes_reset_at
        );
        expect(await decisions()).toHaveLength(1);
        expect(await sqlData(viewer.client.from('matches').select('id'))).toEqual([]);
      }
    );

    it('premium_quotas devuelve una fila completa y ventanas independientes de 24 h y 7 días', async () => {
      expect(await quotas()).toEqual({
        is_premium: false,
        premium_until: null,
        likes_left: 25,
        likes_reset_at: null,
        supers_left: 1,
        supers_reset_at: null,
        boost_available_at: null,
        boost_active_until: null,
      });
      const start = Date.parse((await sqlData(viewer.client.rpc('server_now')))!);
      await seedLikes('like', 25, 25);
      await seedLikes('super', 5, 169);
      await seedLikes('super', 1, 25);
      await seedLikes('super', 1, 1);
      await seedLikes('like', 2, 1);
      const end = Date.parse((await sqlData(viewer.client.rpc('server_now')))!);
      const free = await quotas();

      expect(free).toMatchObject({
        is_premium: false,
        premium_until: null,
        likes_left: 22,
        supers_left: 0,
      });
      expect(Date.parse(free.likes_reset_at!)).toBeGreaterThanOrEqual(start + 23 * HOUR_MS);
      expect(Date.parse(free.likes_reset_at!)).toBeLessThanOrEqual(end + 23 * HOUR_MS);
      // Con dos supers y tope gratis de uno, tiene que caducar el más reciente.
      expect(Date.parse(free.supers_reset_at!)).toBeGreaterThanOrEqual(start + 167 * HOUR_MS);
      expect(Date.parse(free.supers_reset_at!)).toBeLessThanOrEqual(end + 167 * HOUR_MS);

      await setPremium(true);
      const premium = await quotas();
      expect(premium).toMatchObject({
        is_premium: true,
        likes_left: null,
        supers_left: 3,
        likes_reset_at: free.likes_reset_at,
      });
      expect(Date.parse(premium.premium_until!)).toBeGreaterThan(end);
      // Con tope de cinco vuelve a ser el más antiguo de los dos supers vivos.
      expect(Date.parse(premium.supers_reset_at!)).toBeGreaterThanOrEqual(start + 143 * HOUR_MS);
      expect(Date.parse(premium.supers_reset_at!)).toBeLessThanOrEqual(end + 143 * HOUR_MS);
    });

    it.each(['undo_last_decision', 'activate_boost', 'incoming_likes'] as const)(
      '%s sin Premium devuelve LQ005 sin cambiar decisiones ni cupos',
      async (fn) => {
        await sqlData(record(peers[0].id, { p_decision: 'pass' }));
        const before = await quotas();
        const rows = await decisions();

        const { data, error } = await viewer.client.rpc(fn);

        expect(data).toBeNull();
        expect(error?.code).toBe('LQ005');
        expect(await quotas()).toEqual(before);
        expect(await decisions()).toEqual(rows);
      }
    );

    it.each([
      { minutes: 9, allowed: true },
      { minutes: 10, allowed: false },
    ])(
      'undo_last_decision a los $minutes minutos: solo la última, sin devolver el Super Like',
      async ({ minutes, allowed }) => {
        await setPremium(true);
        await sqlData(record(peers[0].id, { p_decision: 'pass' }));
        await callDev(viewer.client, 'dev_age_last_decision', { p_minutes: 20 });
        await sqlData(record(peers[1].id, { p_super: true }));
        await callDev(viewer.client, 'dev_age_last_decision', { p_minutes: minutes });
        const before = await quotas();

        const target = await sqlData(viewer.client.rpc('undo_last_decision'));

        expect(target).toBe(allowed ? peers[1].id : null);
        expect((await decisions())!.map((row) => row.target_id).sort()).toEqual(
          (allowed ? [peers[0].id] : [peers[0].id, peers[1].id]).sort()
        );
        expect(await quotas()).toEqual(before);
        expect(before.supers_left).toBe(4);
      }
    );

    it('undo_last_decision no borra un pass posterior a un match existente', async () => {
      await setPremium(true);
      await sqlData(record(viewer.id, {}, peers[0]));
      const match = await sqlData(record(peers[0].id));
      expect(match?.id).toEqual(expect.any(String));
      await sqlData(record(peers[0].id, { p_decision: 'pass' }));
      const rows = await decisions();

      expect(await sqlData(viewer.client.rpc('undo_last_decision'))).toBeNull();
      expect(await decisions()).toEqual(rows);
      expect(await sqlData(viewer.client.from('matches').select('id'))).toEqual([
        { id: match!.id },
      ]);
    });

    it('undo_last_decision sin decisiones devuelve null', async () => {
      await setPremium(true);
      expect(await sqlData(viewer.client.rpc('undo_last_decision'))).toBeNull();
    });

    it('activate_boost publica los dos relojes y LQ003 conserva el Boost activo', async () => {
      await setPremium(true);
      const start = Date.parse((await sqlData(viewer.client.rpc('server_now')))!);
      const endsAt = await sqlData(viewer.client.rpc('activate_boost'));
      const end = Date.parse((await sqlData(viewer.client.rpc('server_now')))!);
      const before = await quotas();

      expect(Date.parse(endsAt!)).toBeGreaterThanOrEqual(start + 30 * MINUTE_MS);
      expect(Date.parse(endsAt!)).toBeLessThanOrEqual(end + 30 * MINUTE_MS);
      expect(before.boost_active_until).toBe(endsAt);
      expect(Date.parse(before.boost_available_at!) - Date.parse(endsAt!)).toBe(
        30 * DAY_MS - 30 * MINUTE_MS
      );
      await sqlQuota(viewer.client.rpc('activate_boost'), 'LQ003', before.boost_available_at);
      expect(await quotas()).toEqual(before);
    });

    it.each([29, 30])(
      'Boost de hace %i días: cooldown desde el inicio, aunque ya no esté activo',
      async (ageDays) => {
        await setPremium(true);
        await callDev(viewer.client, 'dev_add_boost', { p_age_days: ageDays });
        const before = await quotas();
        expect(before.boost_active_until).toBeNull();
        if (ageDays === 29) {
          expect(before.boost_available_at).not.toBeNull();
          await sqlQuota(viewer.client.rpc('activate_boost'), 'LQ003', before.boost_available_at);
          expect(await quotas()).toEqual(before);
        } else {
          expect(before.boost_available_at).toBeNull();
          const endsAt = await sqlData(viewer.client.rpc('activate_boost'));
          expect((await quotas()).boost_active_until).toBe(endsAt);
        }
      }
    );

    it.each<DeckArgs>([
      { p_min_hours_per_week: 0 },
      { p_time_bands: ['noche'] },
      { p_time_bands: [] },
      { p_ambition: ['equilibrado'] },
      { p_ambition: [] },
      { p_starting_point: ['idea-sin-empezar'] },
      { p_starting_point: [] },
      { p_timezone_window_hours: 0 },
    ])('discovery_deck rechaza cada filtro Premium con LQ005: %j', async (filter) => {
      const { data, error } = await viewer.client.rpc('discovery_deck', filter);
      expect(data).toBeNull();
      expect(error?.code).toBe('LQ005');
      // La misma firma y los mismos argumentos son válidos para Premium.
      await setPremium(true);
      const deck = await sqlData(viewer.client.rpc('discovery_deck', filter));
      expect(deck!.map((row) => row.id)).toContain(peers[0].id);
    });

    it('discovery_deck ordena Super Like → Boost → encaje antes del LIMIT y respeta especialidad gratis', async () => {
      await sqlData(
        viewer.client.from('profiles').upsert(
          toProfileInsert(
            viewer.id,
            buildProfileInput({
              lookingFor: 'par',
              specialties: ['dev'],
              seekingSpecialties: ['diseno'],
            }),
            null
          )
        )
      );
      for (const [index, peer] of peers.entries()) {
        await sqlData(
          peer.client.from('profiles').upsert(
            toProfileInsert(
              peer.id,
              buildProfileInput({
                lookingFor: 'par',
                specialties: index === 2 ? ['diseno'] : ['ventas'],
                seekingSpecialties: index === 2 ? ['dev'] : [],
              }),
              null
            )
          )
        );
      }
      const catalog = await sqlData(viewer.client.from('profiles').select('id'));
      const args: DeckArgs = {
        p_mode: 'par',
        p_exclude_ids: catalog!
          .filter(({ id }) => !peers.some((peer) => peer.id === id))
          .map(({ id }) => id),
      };
      // Un Boost terminado tampoco puede adelantar al candidato de encaje mutuo.
      await callDev(peers[0].client, 'dev_add_boost', { p_age_days: 1 });
      const baseline = await sqlData(viewer.client.rpc('discovery_deck', args));
      expect(baseline!.map(({ id }) => id)).toEqual([
        peers[2].id,
        ...[peers[0].id, peers[1].id].sort(),
      ]);
      await sqlData(record(viewer.id, { p_super: true }, peers[0]));
      await setPremium(true, peers[1]);
      await sqlData(peers[1].client.rpc('activate_boost'));

      const page = await sqlData(viewer.client.rpc('discovery_deck', { ...args, p_limit: 2 }));
      expect(page!.map(({ id, super_liked_me }) => ({ id, super_liked_me }))).toEqual([
        { id: peers[0].id, super_liked_me: true },
        { id: peers[1].id, super_liked_me: false },
      ]);
      const full = await sqlData(viewer.client.rpc('discovery_deck', args));
      expect(full!.map(({ id }) => id)).toEqual(peers.map(({ id }) => id));
      const filtered = await sqlData(
        viewer.client.rpc('discovery_deck', { ...args, p_specialties: ['diseno'] })
      );
      expect(filtered!.map(({ id }) => id)).toEqual([peers[2].id]);
    });

    async function incomingFixture() {
      await setPremium(true);
      await sqlData(record(viewer.id, { p_super: true }, peers[0]));
      // Fuerza el cruce de grupos: el Super Like es anterior a los normales.
      await callDev(peers[0].client, 'dev_age_last_decision', { p_minutes: 1 });
      for (const peer of peers.slice(1)) await sqlData(record(viewer.id, {}, peer));
      return (await sqlData(viewer.client.rpc('incoming_likes')))!;
    }

    it('incoming_likes pagina por (is_super, liked_at, id), incluido el desempate exacto de fecha', async () => {
      const all = await incomingFixture();
      expect(all).toHaveLength(3);
      expect(all[0]).toMatchObject({ id: peers[0].id, is_super: true });
      expect(all.slice(1).every((row) => !row.is_super && row.liked_at > all[0].liked_at)).toBe(
        true
      );
      expect(await sqlData(viewer.client.rpc('incoming_likes_count'))).toBe(3);
      let cursor: IncomingLikeRow | undefined;
      const seen: IncomingLikeRow[] = [];
      for (let index = 0; index <= all.length; index += 1) {
        const page = (await sqlData(
          viewer.client.rpc('incoming_likes', {
            p_limit: 1,
            p_before: cursor?.liked_at,
            p_before_super: cursor?.is_super,
            p_before_id: cursor?.id,
          })
        ))!;
        if (index === all.length) expect(page).toEqual([]);
        else {
          expect(page).toHaveLength(1);
          seen.push(page[0]);
          cursor = page[0];
        }
      }
      expect(seen).toEqual(all);
      // Un cursor justo ANTES del id, a su misma fecha, incluye esa fila. Con
      // el id real la excluye. No hace falta poder escribir timestamps en SQL.
      const last = all[all.length - 1];
      const atLast = { p_before: last.liked_at, p_before_super: last.is_super };
      expect(
        await sqlData(
          viewer.client.rpc('incoming_likes', {
            ...atLast,
            p_before_id: '00000000-0000-0000-0000-000000000000',
          })
        )
      ).toEqual(
        all.filter((row) => row.is_super === last.is_super && row.liked_at === last.liked_at)
      );
      expect(
        await sqlData(
          viewer.client.rpc('incoming_likes', {
            ...atLast,
            p_before_id: last.id,
          })
        )
      ).toEqual([]);
    });

    it('incoming_likes y su conteo excluyen decisiones y bloqueos en ambas direcciones sin filtrar likes por RLS', async () => {
      await incomingFixture();
      await sqlData(record(peers[2].id, { p_decision: 'pass' }));
      await sqlData(viewer.client.rpc('block_profile', { p_profile_id: peers[0].id }));
      await sqlData(peers[1].client.rpc('block_profile', { p_profile_id: viewer.id }));

      expect(await sqlData(viewer.client.rpc('incoming_likes_count'))).toBe(0);
      expect(await sqlData(viewer.client.rpc('incoming_likes'))).toEqual([]);
      for (const peer of peers.slice(0, 2)) {
        expect(await decisions(peer)).toEqual([
          expect.objectContaining({ target_id: viewer.id, decision: 'like' }),
        ]);
      }
      // Premium tampoco abre la lectura directa de las decisiones ajenas.
      expect(
        await sqlData(viewer.client.from('decisions').select('*').eq('target_id', viewer.id))
      ).toEqual([]);
      await setPremium(false);
      expect(await sqlData(viewer.client.rpc('incoming_likes_count'))).toBe(0);
      expect((await viewer.client.rpc('incoming_likes')).error?.code).toBe('LQ005');
    });

    it.each(['anon', 'authenticated'] as const)(
      'entitlements no admite INSERT, UPSERT, UPDATE ni DELETE con %s',
      async (role) => {
        await setPremium(true);
        const before = await quotas();
        // Estas tablas internas no están expuestas en database.types.ts; aquí
        // se intenta saltar el contrato deliberadamente, con la API de tablas.
        const client: SupabaseClient =
          role === 'authenticated'
            ? viewer.client
            : createClient(url!, anonKey!, {
                auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
              });
        const row = {
          user_id: viewer.id,
          premium_until: null,
          product_id: 'intruso',
          store: 'app_store',
        };
        const insert = await client.from('entitlements').insert({ ...row, user_id: peers[0].id });
        expect(insert.error?.code).toBe('42501');
        const upsert = await client.from('entitlements').upsert(row);
        expect(upsert.error?.code).toBe('42501');
        const update = await client
          .from('entitlements')
          .update({ premium_until: null })
          .eq('user_id', viewer.id);
        expect(update.error?.code).toBe('42501');
        const remove = await client.from('entitlements').delete().eq('user_id', viewer.id);
        expect(remove.error?.code).toBe('42501');
        expect(await quotas()).toEqual(before);
        expect((await quotas(peers[0])).is_premium).toBe(false);
      }
    );
  });

  // Foto de perfil (`20261012120000_avatar_photo.sql`): lo que RLS y los
  // permisos de columna dejan hacer a un cliente. La moderación en sí no se
  // prueba aquí: es de la Edge Function y no está en la Supabase local.
  describe('foto de perfil: permisos de Storage y de columna', () => {
    // Cabecera JPEG mínima: el bucket solo admite `image/jpeg`.
    const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00, 0xff, 0xd9]);
    const uploaded: string[] = [];
    // Usuarios propios: el `teardown()` del contrato vacía `reciprocals` antes
    // de que este bloque corra.
    let actors: Reciprocal[] = [];

    beforeAll(async () => {
      actors = [];
      for (const label of ['Foto A', 'Foto B']) {
        actors.push(await createReciprocal(label, 'par'));
      }
    });

    afterAll(async () => {
      if (uploaded.length > 0) {
        await actors[0].client.storage.from('avatar-uploads').remove(uploaded);
      }
      for (const actor of actors) {
        await callDevReset(actor.client);
        await actor.client.removeAllChannels();
        await actor.client.auth.signOut();
      }
      actors = [];
    });

    it('subir a la propia carpeta de pendientes está permitido', async () => {
      const [a] = actors;
      const path = `${a.id}/contract-${Date.now()}.jpg`;

      const { error } = await a.client.storage
        .from('avatar-uploads')
        .upload(path, JPEG, { contentType: 'image/jpeg' });

      expect(error).toBeNull();
      uploaded.push(path);
    });

    it('subir a la carpeta de otra persona está denegado', async () => {
      const [a, b] = actors;

      const { error } = await a.client.storage
        .from('avatar-uploads')
        .upload(`${b.id}/intruso.jpg`, JPEG, { contentType: 'image/jpeg' });

      expect(error).not.toBeNull();
    });

    it('no se puede escribir directamente en el bucket público', async () => {
      const [a] = actors;

      const { error } = await a.client.storage
        .from('avatars')
        .upload(`${a.id}/directa.jpg`, JPEG, { contentType: 'image/jpeg' });

      expect(error).not.toBeNull();
    });

    it('lo subido a pendientes no se puede leer por la API de cliente', async () => {
      const [a] = actors;
      expect(uploaded).not.toHaveLength(0);

      const { data, error } = await a.client.storage.from('avatar-uploads').download(uploaded[0]);

      expect(data).toBeNull();
      expect(error).not.toBeNull();
    });

    // `20261016120000_avatars_private.sql`: el bucket es privado y solo se firma
    // la foto publicada de algún perfil. Publicar exige la service role (no
    // disponible aquí), así que se comprueban los dos negativos.
    it('el bucket avatars ya no sirve nada por la ruta pública', async () => {
      const [a] = actors;
      const { data } = a.client.storage.from('avatars').getPublicUrl(`${a.id}/x.jpg`);

      const response = await fetch(data.publicUrl);

      expect(response.ok).toBe(false);
    });

    it('no se firma un objeto que ningún perfil tiene publicado', async () => {
      const [a] = actors;

      const { data, error } = await a.client.storage
        .from('avatars')
        .createSignedUrl(`${a.id}/no-publicada.jpg`, 60);

      expect(data).toBeNull();
      expect(error).not.toBeNull();
    });

    it('un cliente no puede escribir `avatar_url` en su perfil', async () => {
      const [a] = actors;

      const { error } = await a.client
        .from('profiles')
        // `ProfileUpdate` no admite `avatar_url` a propósito: el cliente no la escribe.
        .update({
          avatar_url: `${a.id}/x.jpg`,
        } as never)
        .eq('id', a.id);

      expect(error?.code).toBe('42501');
    });
  });
});
