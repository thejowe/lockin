/**
 * La pieza común de los tres canales de `postgres_changes` de este backend:
 * releer al REENGANCHARSE.
 *
 * `postgres_changes` no reemite. Entrega lo que ocurre mientras la suscripción
 * está viva en el servidor y nada más: si el socket se cae, el `phx_join` que
 * viene después no trae lo perdido, así que la pantalla se queda con el dato
 * viejo hasta el siguiente cambio — que puede no llegar nunca. Un aviso al
 * volver a engancharse hace que la pantalla relea, que es todo lo que hace
 * falta: los repositorios no guardan nada, leen de la base.
 *
 * ## Por qué solo en el reenganche
 *
 * Avisar también en el primer `SUBSCRIBED` no arregla nada que esto no arregle
 * —quien se acaba de suscribir ya ha leído— y sí rompe algo: el contrato exige
 * que un `send` avise **exactamente una vez** a los suscriptores de su hilo
 * (`messages › avisa solo a los suscriptores de ese hilo`). Esa cuenta exacta
 * es lo que demuestra que la marca de escritura propia (`emittedLocally`) hace
 * su trabajo, y un aviso de más al abrir el canal la deja sin demostrar. Se
 * intentó la vía fácil —avisar en todos los `SUBSCRIBED`, los tres canales— y
 * salió `Expected 1, Received 2`.
 *
 * Contar los `SUBSCRIBED` basta para distinguir los dos casos, porque el
 * cliente de realtime reutiliza el mismo `joinPush` al reengancharse y sus
 * hooks de recepción sobreviven al `reset()`: el segundo `SUBSCRIBED` y los
 * siguientes son siempre reenganches.
 */

import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Suscribe `channel` y llama a `onRejoin` cada vez que vuelve a engancharse
 * tras haberlo estado, nunca en el primer `join`.
 */
export function subscribeResyncingOnRejoin(
  channel: RealtimeChannel,
  onRejoin: () => void
): RealtimeChannel {
  let joined = false;

  return channel.subscribe((status) => {
    if (status !== 'SUBSCRIBED') return;
    if (joined) onRejoin();
    joined = true;
  });
}
