/**
 * Elección del backend activo. Es el ÚNICO archivo que decide qué
 * implementación de `Repositories` usa la app.
 *
 * La regla es la presencia de credenciales: si `.env.local` define
 * `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY`, la app habla con
 * Supabase; si no, sigue con el mock en memoria. Así el proyecto arranca sin
 * configurar nada y conectarlo es copiar `.env.example` a `.env.local`, sin
 * tocar ninguna pantalla.
 *
 * Ese respaldo al mock es **solo de desarrollo**. Una build de release sin
 * credenciales publicaba una app llena de perfiles semilla que parecía
 * funcionar perfectamente: nadie se enteraba de que el entorno estaba mal
 * configurado hasta que un usuario buscaba sus datos y no estaban. Fuera de
 * desarrollo, la falta de credenciales lanza y dice cuál falta.
 *
 * **Cuándo lanza**: al primer uso real del repositorio, no al evaluar el
 * módulo. `npx expo export` compila el bundle sin ninguna variable de entorno
 * y ejecuta los módulos para descubrir las rutas; con la comprobación en el
 * cuerpo del módulo, el export moría antes de generar nada. Perezosa, la
 * protección se mantiene entera —una app de release mal configurada revienta
 * ruidosamente en cuanto pide un dato— y el export estático sigue saliendo.
 *
 * `createSupabaseRepositories()` no abre ninguna conexión al llamarse: el
 * cliente y la sesión se crean en la primera consulta real.
 */

import { createMockRepositories } from './mock';
import { createMemoryPresenceAdapter } from './presence';
import { createSupabaseRepositories } from './supabase';
import { hasSupabaseCredentials } from './supabase/client';
import { createSupabasePresenceAdapter } from './supabase/presence';
import { createSupabaseVideoSignalAdapter } from './supabase/video-signal';
import { createMemoryVideoSignalAdapter } from './video-signal';

import type { PresenceAdapter } from './presence';
import type { Repositories } from './repositories';
import type { VideoSignalChannel } from './video-signal';

/** Qué backend sirve los datos de esta ejecución. */
export type Backend = 'supabase' | 'mock';

/**
 * Las variables que faltan, por su nombre.
 *
 * Se leen como accesos literales a `process.env.X` porque es lo que Metro
 * sustituye en tiempo de build; con una variable intermedia la sustitución no
 * ocurre (ver el encabezado de `./supabase/client`).
 */
function missingCredentials(): string[] {
  const missing: string[] = [];
  if (!process.env.EXPO_PUBLIC_SUPABASE_URL) missing.push('EXPO_PUBLIC_SUPABASE_URL');
  if (!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  return missing;
}

function chooseBackend(): Backend {
  if (hasSupabaseCredentials) return 'supabase';

  if (!__DEV__) {
    throw new Error(
      'LockIn no puede arrancar sin backend: ' +
        `faltan ${missingCredentials().join(' y ')}. ` +
        'Las variables EXPO_PUBLIC_* se inlinean en tiempo de build, así que ' +
        'tienen que estar definidas en el entorno que compila el bundle ' +
        '(.env.local en local, los secretos del perfil de EAS en release). ' +
        'El respaldo a los perfiles semilla del mock es solo de desarrollo: ' +
        'aquí sería publicar una app con datos falsos que parece funcionar.'
    );
  }

  return 'mock';
}

interface Active {
  backend: Backend;
  repositories: Repositories;
  presence: PresenceAdapter;
  videoSignal: VideoSignalChannel;
}

let active: Active | null = null;

/**
 * Resuelve el backend la primera vez que alguien pide un dato, y lo recuerda.
 *
 * Todo lo que decide el backend pasa por aquí, de modo que los tres adaptadores
 * de una ejecución vienen siempre del mismo lado: no puede haber repositorios
 * de Supabase con presencia en memoria.
 */
function resolveActive(): Active {
  if (active) return active;

  const backend = chooseBackend();

  // Rastro de qué backend está activo: mirando la app no había forma de
  // saberlo, y confundir el mock con Supabase es exactamente el fallo que se
  // persigue aquí. Se calla en tests, donde se resuelve una vez por archivo de
  // suite y el dato no aporta nada.
  if (process.env.NODE_ENV !== 'test') {
    console.info(
      backend === 'supabase'
        ? '[lockin] backend de datos: Supabase'
        : '[lockin] backend de datos: mock en memoria (sin credenciales; solo desarrollo)'
    );
  }

  active =
    backend === 'supabase'
      ? {
          backend,
          repositories: createSupabaseRepositories(),
          presence: createSupabasePresenceAdapter(),
          videoSignal: createSupabaseVideoSignalAdapter(),
        }
      : {
          backend,
          repositories: createMockRepositories(),
          presence: createMemoryPresenceAdapter(),
          videoSignal: createMemoryVideoSignalAdapter(),
        };

  return active;
}

/**
 * El backend elegido para esta ejecución. Resuelve si aún no lo estaba, así que
 * fuera de desarrollo y sin credenciales lanza igual que pedir un dato.
 */
export function activeBackend(): Backend {
  return resolveActive().backend;
}

/**
 * La implementación activa: Supabase si hay credenciales, mock si no.
 *
 * Es una fachada de propiedades perezosas, no el objeto real: leer
 * `repositories.profiles` es lo que resuelve el backend. Las pantallas no
 * notan la diferencia, y `npx expo export` puede cargar el módulo sin entorno.
 */
export const repositories: Repositories = {
  get session() {
    return resolveActive().repositories.session;
  },
  get profiles() {
    return resolveActive().repositories.profiles;
  },
  get discovery() {
    return resolveActive().repositories.discovery;
  },
  get matches() {
    return resolveActive().repositories.matches;
  },
  get messages() {
    return resolveActive().repositories.messages;
  },
  get sessions() {
    return resolveActive().repositories.sessions;
  },
};

/** Presencia en sesiones, con la misma regla. Sin credenciales, en memoria. */
export const presence: PresenceAdapter = {
  join: (sessionId, profileId, handlers) =>
    resolveActive().presence.join(sessionId, profileId, handlers),
};

/** Señalización de vídeo, con la misma regla. Sin credenciales, en memoria. */
export const videoSignal: VideoSignalChannel = {
  join: (sessionId, profileId, handlers) =>
    resolveActive().videoSignal.join(sessionId, profileId, handlers),
  send: (sessionId, message) => resolveActive().videoSignal.send(sessionId, message),
};
