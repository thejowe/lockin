/**
 * Complementariedad entre quien swipea y la tarjeta que tiene delante.
 *
 * Es lo que yo domino ∩ lo que la otra persona busca. Se calcula aquí y se
 * pinta, no se usa para decidir nada: **un match sigue siendo un like
 * recíproco**. El ranking mutuo vive en DiscoveryRepository.getDeck: usa
 * ambas direcciones. Esta señal visual sigue mostrando solo lo que esa
 * persona busca y yo domino; el filtro de specialties no cambia.
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
