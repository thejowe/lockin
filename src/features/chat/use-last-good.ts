import { useState } from 'react';

type Query<T> = { data: T | null; error: Error | null; loading: boolean };

/**
 * Conserva el último dato leído con éxito mientras una relectura falla o se
 * reintenta.
 *
 * `useQuery` devuelve `data: null` cuando la petición vigente falla, y otra vez
 * `data: null` con `loading` mientras se reintenta tras un fallo. En el chat eso
 * desmontaba la conversación, el plan o el editor del proyecto cada vez que el
 * sondeo de 15 s se topaba con un corte de red, y se perdía lo que se estaba
 * escribiendo. Solo un `null` ya resuelto y sin error (el match o el proyecto
 * ya no existen) borra lo conservado. Lo conservado es de su `key`: al cambiar
 * de consulta no se arrastra el dato de otra.
 */
export function useLastGood<T>(query: Query<T>, key: string): Query<T> {
  const [kept, setKept] = useState<{ key: string; data: T | null }>({ key, data: query.data });
  const current = kept.key === key ? kept.data : null;
  const settledNull = query.data === null && !query.loading && !query.error;
  // Ajuste durante el render (patrón de React para estado derivado): sin efecto,
  // no hay un render intermedio con el dato vacío.
  if (kept.key !== key || (query.data !== null && query.data !== current)) {
    setKept({ key, data: query.data });
  } else if (settledNull && current !== null) {
    setKept({ key, data: null });
  }
  const data = query.data ?? (settledNull ? null : current);
  return { data, error: query.error, loading: query.loading && data === null };
}
