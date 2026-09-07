/**
 * Complementariedad entre quien swipea y la tarjeta que tiene delante.
 *
 * Es lo que yo domino ∩ lo que la otra persona busca. Se calcula aquí y se
 * pinta, no se usa para decidir nada: **un match sigue siendo un like
 * recíproco**. Filtrar o rankear el deck por esto tocaría `discovery.getDeck` y
 * `record_decision()` en Supabase — otro campo, otro bloque, otra decisión.
 *
 * La dirección importa y es una sola: mide si *yo* encajo en lo que *esa
 * persona* pide. Lo contrario (si esa persona encaja en lo que yo pido) es la
 * otra mitad, y la resuelve el filtro del deck, que ya trabaja sobre
 * `Profile.specialties`.
 */

import { seeksComplement } from '@/features/profile';

import type { Profile, Specialty } from '@/data';

/**
 * Las especialidades que `profile` busca y quien mira ya domina, en el orden en
 * que el perfil las declaró.
 *
 * Vacío también cuando no hay nada que complementar: un perfil de `lockin` no
 * elige por skills (invariante de `Profile.seekingSpecialties`), y un
 * `seekingSpecialties` vacío significa «abierto a cualquiera» — decirle a
 * alguien que "encaja" con una lista vacía sería inventarse una señal.
 */
export function complementWith(profile: Profile, viewerSpecialties: Specialty[]): Specialty[] {
  if (!seeksComplement(profile.lookingFor)) return [];

  return profile.seekingSpecialties.filter((specialty) => viewerSpecialties.includes(specialty));
}
