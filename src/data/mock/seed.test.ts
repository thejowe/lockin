/**
 * Lo que el catálogo mock tiene que garantizar al recorrido E2E.
 *
 * El `.yaml` no elige tarjeta: crea un perfil, da like a la de delante y espera
 * «¡Match!». Eso solo es cierto si la tarjeta de delante es alguien que ya dio
 * like —`SEED_RECIPROCAL_IDS`—, y tiene que serlo por el criterio de producto
 * (complementariedad mutua), no por el desempate de `id`, que es arbitrario y
 * ni siquiera ordena igual en Postgres, donde los ids son UUID por orden de
 * siembra y aquí son `seed-<nombre>` por orden alfabético.
 *
 * Vive aquí y no en `e2e/` a propósito: el dato es de este bloque, y un fallo
 * de catálogo debe caer en `npm test`, no treinta minutos después en un
 * emulador.
 */

import { buildProfileInput } from '../test-fixtures';
import { createMockRepositories, resetState } from './index';
import { SEED_PROFILES, SEED_RECIPROCAL_IDS } from './seed';

import type { Repositories } from '../repositories';

/**
 * El perfil que teclea `e2e/full-journey.yaml`: domina Desarrollo y Marketing,
 * busca Diseño, modo Ambos.
 */
const E2E_PROFILE = buildProfileInput({
  name: 'E2E-perfil',
  specialties: ['dev', 'marketing'],
  seekingSpecialties: ['diseno'],
  lookingFor: 'ambos',
});

describe('el catálogo mock sostiene el recorrido E2E', () => {
  let repositories: Repositories;

  beforeEach(() => {
    resetState();
    repositories = createMockRepositories();
  });

  it('la tarjeta de delante es alguien que ya dio like', async () => {
    await repositories.session.setActiveMode('ambos');
    await repositories.profiles.saveCurrent(E2E_PROFILE);

    const [front] = await repositories.discovery.getDeck();

    expect(SEED_RECIPROCAL_IDS).toContain(front.id);
  });

  it('y lo es por puntuación máxima estricta, no por desempate de id', async () => {
    // Puntuación 2 = los dos sumandos del criterio: domina lo que el recorrido
    // busca (diseño) y busca algo de lo que el recorrido domina (dev o
    // marketing). Si hay dos, quién va delante lo decide el `id`, y entonces el
    // recorrido depende de cómo se llame la gente.
    const maximos = SEED_PROFILES.filter(
      (profile) =>
        profile.lookingFor !== 'lockin' &&
        profile.specialties.includes('diseno') &&
        profile.seekingSpecialties.some((tag) => tag === 'dev' || tag === 'marketing')
    );

    expect(maximos.map((profile) => profile.id)).toEqual(['seed-marc']);
  });
});
