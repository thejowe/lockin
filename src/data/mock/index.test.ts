/**
 * Tests del repositorio mock: el filtrado del deck, la reciprocidad que crea un
 * match y el hilo de mensajes.
 *
 * Es la lógica que el bloque `datos` tendrá que reproducir contra Supabase, así
 * que estos tests son también la especificación de lo que un backend real debe
 * cumplir.
 */

import { buildProfileInput } from '../test-fixtures';
import { createMockRepositories, CURRENT_USER_ID, resetState } from './index';
import { SEED_RECIPROCAL_IDS } from './seed';

import type { Repositories } from '../repositories';

/** Perfiles que ya dieron like al usuario: darles like cierra el match. */
const [RECIPROCAL_A, RECIPROCAL_B] = SEED_RECIPROCAL_IDS;
/** `seed-diego` no está en la lista de likes entrantes: nunca hace match. */
const NON_RECIPROCAL_ID = 'seed-diego';

let repositories: Repositories;

beforeEach(() => {
  resetState();
  repositories = createMockRepositories();
});

describe('discovery.getDeck', () => {
  it('nunca incluye el perfil propio', async () => {
    await repositories.profiles.saveCurrent(buildProfileInput({ name: 'Yo' }));

    const deck = await repositories.discovery.getDeck({ mode: 'ambos' });

    expect(deck.map((profile) => profile.id)).not.toContain(CURRENT_USER_ID);
  });

  it('en modo Par solo devuelve perfiles de Par o abiertos a ambos', async () => {
    const deck = await repositories.discovery.getDeck({ mode: 'par' });

    expect(deck.length).toBeGreaterThan(0);
    expect(deck.every((profile) => profile.lookingFor !== 'lockin')).toBe(true);
  });

  it('en modo Lock-In solo devuelve perfiles de Lock-In o abiertos a ambos', async () => {
    const deck = await repositories.discovery.getDeck({ mode: 'lockin' });

    expect(deck.length).toBeGreaterThan(0);
    expect(deck.every((profile) => profile.lookingFor !== 'par')).toBe(true);
  });

  it('sin modo concreto devuelve el catálogo entero', async () => {
    const todos = await repositories.discovery.getDeck({ mode: 'ambos' });
    const par = await repositories.discovery.getDeck({ mode: 'par' });

    expect(todos.length).toBeGreaterThan(par.length);
  });

  it('usa el modo activo de la sesión cuando la llamada no lo especifica', async () => {
    await repositories.session.setActiveMode('lockin');

    const deck = await repositories.discovery.getDeck();

    expect(deck.length).toBeGreaterThan(0);
    expect(deck.every((profile) => profile.lookingFor !== 'par')).toBe(true);
  });

  it('cae al modo declarado en el perfil si la sesión no tiene uno activo', async () => {
    await repositories.profiles.saveCurrent(buildProfileInput({ lookingFor: 'lockin' }));

    const deck = await repositories.discovery.getDeck();

    expect(deck.length).toBeGreaterThan(0);
    expect(deck.every((profile) => profile.lookingFor !== 'par')).toBe(true);
  });

  it('no vuelve a mostrar un perfil ya decidido', async () => {
    await repositories.discovery.recordDecision(NON_RECIPROCAL_ID, 'pass');

    const deck = await repositories.discovery.getDeck({ mode: 'ambos' });

    expect(deck.map((profile) => profile.id)).not.toContain(NON_RECIPROCAL_ID);
  });

  it('respeta excludeIds además de lo ya decidido', async () => {
    const deck = await repositories.discovery.getDeck({
      mode: 'ambos',
      excludeIds: ['seed-lucia'],
    });

    expect(deck.map((profile) => profile.id)).not.toContain('seed-lucia');
  });

  it('filtra por especialidad cuando se pide', async () => {
    const [reference] = await repositories.discovery.getDeck({ mode: 'ambos' });
    const specialty = reference.specialties[0];

    const deck = await repositories.discovery.getDeck({ mode: 'ambos', specialties: [specialty] });

    expect(deck.length).toBeGreaterThan(0);
    expect(deck.every((profile) => profile.specialties.includes(specialty))).toBe(true);
  });
});

describe('discovery.recordDecision', () => {
  it('un like recíproco crea el match', async () => {
    const result = await repositories.discovery.recordDecision(RECIPROCAL_A, 'like');

    expect(result.decision).toBe('like');
    expect(result.match?.profileIds).toEqual([CURRENT_USER_ID, RECIPROCAL_A]);
  });

  it('un like sin reciprocidad no crea match', async () => {
    const result = await repositories.discovery.recordDecision(NON_RECIPROCAL_ID, 'like');

    expect(result.match).toBeNull();
  });

  it('un pass nunca crea match, aunque el otro nos hubiera dado like', async () => {
    const result = await repositories.discovery.recordDecision(RECIPROCAL_A, 'pass');

    expect(result.match).toBeNull();
    expect(await repositories.matches.list()).toHaveLength(0);
  });

  it('un perfil inexistente no crea match ni revienta', async () => {
    const result = await repositories.discovery.recordDecision('no-existe', 'like');

    expect(result.match).toBeNull();
  });

  it('el match nace en el modo concreto cuando el otro está abierto a ambos', async () => {
    await repositories.session.setActiveMode('lockin');

    // `seed-marc` declara `ambos`, así que manda el modo de la sesión.
    const result = await repositories.discovery.recordDecision('seed-marc', 'like');

    expect(result.match?.mode).toBe('lockin');
  });

  it('registra la decisión en listDecided', async () => {
    await repositories.discovery.recordDecision(NON_RECIPROCAL_ID, 'pass');

    expect(await repositories.discovery.listDecided()).toContain(NON_RECIPROCAL_ID);
  });

  it('avisa a los suscriptores de matches y deja de hacerlo al desuscribirse', async () => {
    const listener = jest.fn();
    const unsubscribe = repositories.matches.subscribe(listener);

    await repositories.discovery.recordDecision(RECIPROCAL_A, 'like');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    await repositories.discovery.recordDecision(RECIPROCAL_B, 'like');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('matches', () => {
  it('resuelve el perfil del otro lado', async () => {
    await repositories.discovery.recordDecision(RECIPROCAL_A, 'like');

    const [match] = await repositories.matches.list();

    expect(match.counterpart.id).toBe(RECIPROCAL_A);
    expect(match.lastMessage).toBeNull();
  });

  it('ordena por actividad reciente: el último mensaje sube el match', async () => {
    const first = await repositories.discovery.recordDecision(RECIPROCAL_A, 'like');
    const second = await repositories.discovery.recordDecision(RECIPROCAL_B, 'like');
    const firstId = first.match!.id;
    const secondId = second.match!.id;

    await repositories.messages.send({ matchId: firstId, body: 'hola' });

    const list = await repositories.matches.list();

    expect(list.map((match) => match.id)).toEqual([firstId, secondId]);
  });

  it('getById devuelve null para un id desconocido', async () => {
    expect(await repositories.matches.getById('no-existe')).toBeNull();
  });
});

describe('messages', () => {
  it('el mensaje enviado queda en el hilo y actualiza el match', async () => {
    const { match } = await repositories.discovery.recordDecision(RECIPROCAL_A, 'like');
    const matchId = match!.id;

    const sent = await repositories.messages.send({ matchId, body: '¿Arrancamos?' });
    const thread = await repositories.messages.listByMatch(matchId);
    const updated = await repositories.matches.getById(matchId);

    expect(thread).toEqual([sent]);
    expect(sent.senderId).toBe(CURRENT_USER_ID);
    expect(updated?.lastMessageAt).toBe(sent.sentAt);
    expect(updated?.lastMessage?.id).toBe(sent.id);
  });

  it('el hilo de un match no se cuela en el de otro', async () => {
    const a = await repositories.discovery.recordDecision(RECIPROCAL_A, 'like');
    const b = await repositories.discovery.recordDecision(RECIPROCAL_B, 'like');

    await repositories.messages.send({ matchId: a.match!.id, body: 'para A' });

    expect(await repositories.messages.listByMatch(b.match!.id)).toHaveLength(0);
  });

  it('avisa solo a los suscriptores de ese hilo', async () => {
    const a = await repositories.discovery.recordDecision(RECIPROCAL_A, 'like');
    const b = await repositories.discovery.recordDecision(RECIPROCAL_B, 'like');

    const listenerA = jest.fn();
    const listenerB = jest.fn();
    repositories.messages.subscribe(a.match!.id, listenerA);
    repositories.messages.subscribe(b.match!.id, listenerB);

    await repositories.messages.send({ matchId: a.match!.id, body: 'hola' });

    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).not.toHaveBeenCalled();
  });
});

describe('profiles.saveCurrent', () => {
  it('deriva las iniciales del nombre si no se envía avatar', async () => {
    const profile = await repositories.profiles.saveCurrent(
      buildProfileInput({ name: 'Núria Bosch', avatar: undefined })
    );

    expect(profile.avatar.initials).toBe('NB');
    expect(profile.id).toBe(CURRENT_USER_ID);
  });

  it('conserva createdAt al editar y mueve updatedAt', async () => {
    const created = await repositories.profiles.saveCurrent(buildProfileInput());
    const edited = await repositories.profiles.saveCurrent(
      buildProfileInput({ name: 'Otro nombre' })
    );

    expect(edited.createdAt).toBe(created.createdAt);
    expect(edited.name).toBe('Otro nombre');
    expect(await repositories.profiles.getCurrent()).toEqual(edited);
  });
});

describe('session', () => {
  it('no está onboarded hasta tener perfil y modo', async () => {
    expect(await repositories.session.isOnboarded()).toBe(false);

    await repositories.session.setActiveMode('par');
    expect(await repositories.session.isOnboarded()).toBe(false);

    await repositories.session.setProfileId(CURRENT_USER_ID);
    expect(await repositories.session.isOnboarded()).toBe(true);
  });
});

describe('resetState', () => {
  it('devuelve el mock a las semillas entre tests', async () => {
    await repositories.discovery.recordDecision(RECIPROCAL_A, 'like');
    expect(await repositories.matches.list()).toHaveLength(1);

    resetState();

    expect(await repositories.matches.list()).toHaveLength(0);
    expect(await repositories.discovery.listDecided()).toHaveLength(0);
  });
});
