/**
 * Canales de presencia y vídeo abiertos por ESTE cliente, para poder cerrarlos
 * cuando la persona bloquea a alguien.
 *
 * Supabase Realtime evalúa la política de un canal privado al unirse y cachea la
 * decisión hasta reconectar o renovar el JWT: el servidor no puede revocar un
 * canal ya autorizado, y el bloqueo no avisa a la otra parte por diseño. Lo
 * único que sí se puede hacer es cortar los canales del lado de quien bloquea.
 * El lado bloqueado conserva el suyo hasta que reconecte (y entonces la política
 * ya lo rechaza): la misma regla ya aceptada para las respuestas de sala.
 *
 * El alcance es el id de la sesión o de la sala, que es lo que identifica cada
 * canal. El registro es por cliente: dos clientes del mismo proceso (los tests)
 * no se cierran los canales entre sí.
 */

import type { LockInSupabaseClient } from './client';

type Closer = () => void;

const byClient = new WeakMap<LockInSupabaseClient, Map<string, Set<Closer>>>();

/** Registra un canal; devuelve la función que lo da de baja (al salir con normalidad). */
export function trackLiveChannel(
  client: LockInSupabaseClient,
  scopeId: string,
  close: Closer
): () => void {
  let scopes = byClient.get(client);
  if (!scopes) byClient.set(client, (scopes = new Map()));
  let closers = scopes.get(scopeId);
  if (!closers) scopes.set(scopeId, (closers = new Set()));
  closers.add(close);
  return () => {
    closers.delete(close);
    if (closers.size === 0) scopes.delete(scopeId);
  };
}

/**
 * Cierra los canales de esas sesiones/salas, o todos si no se dice cuáles
 * (cuando no se ha podido averiguar con quién estaba cada uno).
 */
export function closeLiveChannels(client: LockInSupabaseClient, scopeIds?: Iterable<string>): void {
  const scopes = byClient.get(client);
  if (!scopes) return;
  const wanted = scopeIds ? [...scopeIds] : [...scopes.keys()];
  for (const scopeId of wanted) {
    const closers = scopes.get(scopeId);
    if (!closers) continue;
    for (const close of [...closers]) close();
  }
}
