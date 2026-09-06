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
 * Sin esa variable la suite se salta entera. No entra en `npm test` ni en CI, y
 * la razón no es comodidad:
 *
 * - **Escribe en un proyecto real.** No hay base local — el CLI de Supabase no
 *   se puede enlazar desde aquí, ver `docs/plan/todo/datos.md` —, así que esto
 *   habla con el proyecto de `.env.local`. Un CI que lo ejecutara en cada push
 *   estaría escribiendo en el entorno compartido.
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
import type { Database } from './database.types';
import type { ModePreference } from '../types';
import type { Repositories } from '../repositories';
import type { SupabaseClient } from '@supabase/supabase-js';

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

const supabaseBackend: ContractBackend = {
  name: 'supabase',

  async reset(): Promise<ContractFixture> {
    const currentUserId = await resetCurrentUser();
    const [parReciprocal, lockinReciprocal, bothReciprocal] = reciprocals;

    return {
      repositories,
      currentUserId,

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
});
