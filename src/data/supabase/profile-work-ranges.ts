import type { LockInSupabaseClient } from './client';
import type { DeckRow, IncomingLikeRow } from './database.types';

/** Los RPC paginan en SQL y devuelven las columnas históricas del perfil.
 * Completa su jornada en una lectura, conservando orden, cursor y permisos de lectura.
 */
export async function addProfileWorkRanges<Row extends DeckRow | IncomingLikeRow>(
  client: LockInSupabaseClient,
  rows: Row[]
) {
  if (!rows.length) return [];
  const { data, error } = await client
    .from('profiles')
    .select('id, timezone, availability_hours_per_week, availability_bands, work_ranges')
    .in(
      'id',
      rows.map((row) => row.id)
    );
  if (error) throw error;
  const byId = new Map(data.map((range) => [range.id, range]));
  return rows.flatMap((row) => {
    const range = byId.get(row.id);
    // Si el perfil se borró o bloqueó entre lecturas, ya no se puede enseñar.
    return range ? [{ ...row, ...range }] : [];
  });
}
