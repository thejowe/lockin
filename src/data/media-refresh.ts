/**
 * Aviso de «las URLs firmadas de las fotos están a punto de caducar».
 *
 * Lo emite el backend que firma (Supabase, `supabase/avatar-urls.ts`) y lo
 * escucha `DataProvider`, que relee las consultas montadas para que las
 * pantallas que ya tenían perfiles en memoria (deck, matches, chat) reciban
 * URLs nuevas antes de que las anteriores fallen. El mock nunca lo emite.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

export function onMediaStale(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitMediaStale(): void {
  for (const listener of [...listeners]) listener();
}
