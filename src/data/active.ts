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
 * desarrollo, la falta de credenciales lanza al cargar el módulo y dice cuál
 * falta.
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

/** El backend elegido para esta ejecución. */
export const backend: Backend = chooseBackend();

// Rastro de qué backend está activo: mirando la app no había forma de saberlo,
// y confundir el mock con Supabase es exactamente el fallo que se persigue
// aquí. Se calla en tests, donde se importa una vez por archivo de suite y el
// dato no aporta nada.
if (process.env.NODE_ENV !== 'test') {
  console.info(
    backend === 'supabase'
      ? '[lockin] backend de datos: Supabase'
      : '[lockin] backend de datos: mock en memoria (sin credenciales; solo desarrollo)'
  );
}

/** La implementación activa: Supabase si hay credenciales, mock si no. */
export const repositories: Repositories =
  backend === 'supabase' ? createSupabaseRepositories() : createMockRepositories();

/** Presencia en sesiones, con la misma regla. Sin credenciales, en memoria. */
export const presence: PresenceAdapter =
  backend === 'supabase' ? createSupabasePresenceAdapter() : createMemoryPresenceAdapter();

/** Señalización de vídeo, con la misma regla. Sin credenciales, en memoria. */
export const videoSignal: VideoSignalChannel =
  backend === 'supabase' ? createSupabaseVideoSignalAdapter() : createMemoryVideoSignalAdapter();
