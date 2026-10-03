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

/**
 * Trae todas las filas de una tabla en vueltas de `FETCH_PAGE_SIZE`, en vez de
 * un único `select` sin `range()` que PostgREST podría truncar en silencio al
 * superar su tope de fila. Orden estable por `id` para que ninguna fila se
 * salte ni se repita entre vueltas.
 */
export async function fetchAllPages<Row>(
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
