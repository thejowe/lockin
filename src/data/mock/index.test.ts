/**
 * El contrato de `Repositories`, ejecutado contra el mock en memoria.
 *
 * Los casos ya no viven aquí: están en `src/data/repositories.contract.ts`, y
 * los ejecuta también `src/data/supabase/contract.test.ts` contra Supabase. Lo
 * que queda en este archivo es el arnés del mock más los tres casos que
 * describen mecánica del mock y no tienen equivalente en un backend real.
 */

import { describeRepositoryContract } from '../repositories.contract';
import { buildProfileInput } from '../test-fixtures';
import { createMockRepositories, CURRENT_USER_ID, resetState } from './index';
import { SEED_RECIPROCAL_IDS } from './seed';

import type { ContractBackend } from '../repositories.contract';
import type { Repositories } from '../repositories';

/** Perfiles que ya dieron like al usuario: darles like cierra el match. */
const [RECIPROCAL_NURIA, RECIPROCAL_MARC, RECIPROCAL_ALBA] = SEED_RECIPROCAL_IDS;
/** `seed-diego` no está en la lista de likes entrantes: nunca hace match. */
const NON_RECIPROCAL_ID = 'seed-diego';

const mockBackend: ContractBackend = {
  name: 'mock',

  async reset() {
    resetState();
    const repositories = createMockRepositories();

    return {
      repositories,
      currentUserId: CURRENT_USER_ID,
      // En el mock los likes entrantes vienen sembrados en el estado inicial y
      // se puede swipear sin perfil propio, así que no hay nada que preparar.
      async prepareSwiper() {},
      reciprocalAId: RECIPROCAL_NURIA,
      reciprocalBId: RECIPROCAL_ALBA,
      openToBothReciprocalId: RECIPROCAL_MARC,
      nonReciprocalId: NON_RECIPROCAL_ID,
      excludableId: 'seed-lucia',
      unknownProfileId: 'no-existe',
    };
  },
};

describeRepositoryContract(mockBackend);

/**
 * Lo que solo tiene sentido en el mock.
 *
 * No está en el contrato compartido a propósito: son detalles de esta
 * implementación, no promesas de producto. `src/data/supabase/README.md`
 * explica en qué se convierte cada uno contra Supabase.
 */
describe('mecánica del mock', () => {
  let repositories: Repositories;

  beforeEach(() => {
    resetState();
    repositories = createMockRepositories();
  });

  it('el perfil propio se guarda bajo CURRENT_USER_ID', async () => {
    // Contra Supabase el id es el `auth.uid()`, que no se conoce hasta abrir
    // sesión; aquí es una constante para que las semillas puedan referenciarlo.
    const profile = await repositories.profiles.saveCurrent(buildProfileInput());

    expect(profile.id).toBe(CURRENT_USER_ID);
  });

  it('setProfileId marca el perfil propio en la sesión', async () => {
    // Contra Supabase `profileId` es derivado —existe la fila en `profiles` o
    // no—, así que allí `setProfileId` es un no-op deliberado.
    await repositories.session.setActiveMode('par');
    expect(await repositories.session.isOnboarded()).toBe(false);

    await repositories.session.setProfileId(CURRENT_USER_ID);

    expect(await repositories.session.isOnboarded()).toBe(true);
  });

  it('resetState devuelve el mock a las semillas entre tests', async () => {
    // Contra Supabase el equivalente es `dev_reset_current_user()` de
    // `supabase/seed.sql`; el arnés de `contract.test.ts` lo llama en cada test.
    await repositories.discovery.recordDecision(RECIPROCAL_NURIA, 'like');
    expect(await repositories.matches.list()).toHaveLength(1);

    resetState();

    expect(await repositories.matches.list()).toHaveLength(0);
    expect(await repositories.discovery.listDecided()).toHaveLength(0);
  });
});
