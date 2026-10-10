/**
 * El contrato de `Repositories`, ejecutado contra el mock en memoria.
 *
 * Los casos ya no viven aquí: están en `src/data/repositories.contract.ts`, y
 * los ejecuta también `src/data/supabase/contract.test.ts` contra Supabase. Lo
 * que queda en este archivo es el arnés del mock más los tres casos que
 * describen mecánica del mock y no tienen equivalente en un backend real.
 */

import { createMemoryPresenceAdapter } from '../presence';
import { createMemoryVideoSignalAdapter } from '../video-signal';
import { describeRepositoryContract } from '../repositories.contract';
import { buildProfile, buildProfileInput } from '../test-fixtures';
import { createMockAgreementRepository } from './agreement';
import {
  advanceMockClock,
  createMockRepositories,
  createMockRoomRepository,
  createMockSessionRepository,
  createMockStore,
  CURRENT_USER_ID,
  resetState,
} from './index';
import { SEED_RECIPROCAL_IDS } from './seed';
import { getState } from './store';

import type { ContractBackend } from '../repositories.contract';
import type { Repositories } from '../repositories';

/** Perfiles que ya dieron like al usuario: darles like cierra el match. */
const [RECIPROCAL_NURIA, RECIPROCAL_MARC, RECIPROCAL_ALBA] = SEED_RECIPROCAL_IDS;
/** `seed-diego` no está en la lista de likes entrantes: nunca hace match. */
const NON_RECIPROCAL_ID = 'seed-diego';

const mockBackend: ContractBackend = {
  name: 'mock',
  canTimeTravel: true,
  // El mock simula la verificación sin tocar un navegador: puede completar el
  // flujo entero sola.
  canLinkIdentityWithoutBrowser: true,

  async reset() {
    resetState();
    const repositories = createMockRepositories();
    const realtime = {
      presence: createMemoryPresenceAdapter(),
      videoSignal: createMemoryVideoSignalAdapter(),
    };

    return {
      repositories,
      async realtimeFor() {
        return realtime;
      },
      async closeRealtime() {},
      currentUserId: CURRENT_USER_ID,
      async setRankingCandidates(inputs) {
        return inputs.map((input, index) => {
          const id = ['ranking-c', 'ranking-b', 'ranking-a'][index];
          getState().profiles.set(
            id,
            buildProfile({
              ...input,
              id,
              avatar: { initials: 'RP', accent: 'brass' },
              seekingSpecialties: input.seekingSpecialties ?? [],
            })
          );
          return id;
        });
      },
      // En el mock los likes entrantes vienen sembrados en el estado inicial y
      // se puede swipear sin perfil propio, así que no hay nada que preparar.
      async prepareSwiper() {},
      reciprocalAId: RECIPROCAL_NURIA,
      reciprocalBId: RECIPROCAL_ALBA,
      openToBothReciprocalId: RECIPROCAL_MARC,
      nonReciprocalId: NON_RECIPROCAL_ID,
      excludableId: 'seed-lucia',
      unknownProfileId: 'no-existe',
      counterpartSessions: () => createMockSessionRepository(RECIPROCAL_NURIA),
      // Alba es recíproca, pero los casos de sesiones solo dan like a Núria:
      // no comparte match con el usuario del test.
      outsiderSessions: () => createMockSessionRepository(RECIPROCAL_ALBA),
      counterpartAgreement: () => createMockAgreementRepository(RECIPROCAL_NURIA),
      outsiderAgreement: () => createMockAgreementRepository(RECIPROCAL_ALBA),
      roomsFor: (profileId) => createMockRoomRepository(profileId),
      async elapse(ms) {
        advanceMockClock(ms);
      },
    };
  },

  async safetyPair() {
    // Dos clientes sobre el MISMO almacén: el segundo actúa como otra persona.
    const store = createMockStore();
    const bId = 'safety-b';
    const a = createMockRepositories(store);
    const b = createMockRepositories(store, { actorId: bId });
    return {
      a,
      b,
      aId: CURRENT_USER_ID,
      bId,
      async expectReportsPrivate(expected) {
        expect(store.state.userReports).toEqual([expect.objectContaining(expected)]);
        // El cliente solo expone block/report, nunca el almacén privado.
        expect('listReports' in a.profiles).toBe(false);
        expect('listReports' in b.profiles).toBe(false);
      },
      async close() {},
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

  it('deleteMyAccount borra lo propio y deja el catálogo ajeno', async () => {
    // Contra Supabase es el RPC `delete_my_account()`, que borra `auth.users` y
    // deja caer lo demás en cascada; aquí el almacén hace lo mismo a mano.
    await repositories.profiles.saveCurrent(buildProfileInput());
    await repositories.session.setActiveMode('par');
    await repositories.discovery.recordDecision(RECIPROCAL_NURIA, 'like');
    const [match] = await repositories.matches.list();
    await repositories.messages.send({ matchId: match.id, body: 'hola' });
    expect(await repositories.session.isOnboarded()).toBe(true);

    await repositories.session.deleteMyAccount();

    expect(await repositories.session.isOnboarded()).toBe(false);
    expect(await repositories.profiles.getCurrent()).toBeNull();
    expect(await repositories.matches.list()).toHaveLength(0);
    expect(await repositories.discovery.listDecided()).toHaveLength(0);
    // Las demás personas siguen ahí.
    expect(await repositories.profiles.getById(RECIPROCAL_NURIA)).not.toBeNull();
  });
});
