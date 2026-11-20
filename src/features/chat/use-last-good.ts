import { useState } from 'react';

/**
 * Conserva el último dato leído con éxito mientras una relectura falla.
 *
 * `useQuery` devuelve `data: null` cuando la petición vigente falla. En el chat
 * eso desmontaba la conversación o el editor del proyecto cada vez que el
 * sondeo de 15 s se topaba con un corte de red, y se perdía lo que se estaba
 * escribiendo. Un `null` leído sin error (el match o el proyecto ya no existen)
 * sí manda y borra lo conservado.
 */
export function useLastGood<T>(data: T | null, error: Error | null): T | null {
  const [kept, setKept] = useState<T | null>(data);
  // Ajuste durante el render (patrón de React para estado derivado): sin efecto,
  // no hay un render intermedio con el dato vacío.
  if (data !== null && data !== kept) setKept(data);
  else if (data === null && !error && kept !== null) setKept(null);
  return data ?? (error ? kept : null);
}
