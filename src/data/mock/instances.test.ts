/**
 * Aislamiento entre juegos de repositorios del mock.
 *
 * Los datos, el reloj, el contador de ids y los suscriptores vivían en
 * variables de módulo, así que dos `createMockRepositories()` del mismo proceso
 * eran en realidad el mismo backend y no había forma limpia de aislar dos
 * instancias en un test.
 *
 * Ahora eso es cosa del store. Sin argumento sigue siendo el compartido —es lo
 * que esperan `resetState()`, `advanceMockClock()` y las suites que las usan—,
 * y con un `createMockStore()` propio no se toca nada del otro lado.
 */

import { buildProfileInput } from '../test-fixtures';
import { createMockRepositories, createMockStore, resetState } from './index';
import { SEED_RECIPROCAL_IDS } from './seed';

const [RECIPROCAL_NURIA] = SEED_RECIPROCAL_IDS;

beforeEach(() => {
  resetState();
});

describe('dos juegos de repositorios del mock', () => {
  it('con stores distintos no comparten datos', async () => {
    const uno = createMockRepositories(createMockStore());
    const otro = createMockRepositories(createMockStore());

    await uno.profiles.saveCurrent(buildProfileInput({ name: 'Ada Lovelace' }));

    expect((await uno.profiles.getCurrent())?.name).toBe('Ada Lovelace');
    expect(await otro.profiles.getCurrent()).toBeNull();
    expect((await uno.session.get()).profileId).not.toBeNull();
    expect((await otro.session.get()).profileId).toBeNull();
  });

  it('con stores distintos no comparten suscriptores', async () => {
    const uno = createMockRepositories(createMockStore());
    const otro = createMockRepositories(createMockStore());

    const enUno = jest.fn();
    const enOtro = jest.fn();
    uno.matches.subscribe(enUno);
    otro.matches.subscribe(enOtro);

    await uno.profiles.saveCurrent(buildProfileInput({ name: 'Ada Lovelace' }));
    await uno.discovery.recordDecision(RECIPROCAL_NURIA, 'like');

    expect(enUno).toHaveBeenCalled();
    expect(enOtro).not.toHaveBeenCalled();
  });

  it('con stores distintos no comparten el reloj de las sesiones', async () => {
    const storeUno = createMockStore();
    const uno = createMockRepositories(storeUno);
    const otro = createMockRepositories(createMockStore());

    const antes = Date.parse(await otro.sessions.serverNow());
    storeUno.advanceClock(24 * 60 * 60 * 1000);

    expect(Date.parse(await uno.sessions.serverNow()) - antes).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(Date.parse(await otro.sessions.serverNow()) - antes).toBeLessThan(60_000);
  });

  it('sin argumento siguen compartiendo el store por defecto: es lo que usa `resetState()`', async () => {
    const uno = createMockRepositories();
    const otro = createMockRepositories();

    await uno.profiles.saveCurrent(buildProfileInput({ name: 'Ada Lovelace' }));

    expect((await otro.profiles.getCurrent())?.name).toBe('Ada Lovelace');

    resetState();
    expect(await uno.profiles.getCurrent()).toBeNull();
  });
});
