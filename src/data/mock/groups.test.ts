/**
 * Grupos en el backend mock. Es el espejo de `supabase/groups-embedded.test.mjs`:
 * las mismas reglas, comprobadas sobre el store en memoria con varias personas.
 */

import { GroupError } from '../groups';
import { buildProfileInput } from '../test-fixtures';
import { createMockRepositories, createMockStore, CURRENT_USER_ID } from './index';

import type { MockStore } from './store';
import type { Repositories } from '../repositories';
import type { GroupInput, Specialty } from '../types';

const INPUT: GroupInput = {
  name: 'Equipo',
  description: 'Un proyecto de prueba con descripción.',
  roles: [
    { specialty: 'dev', slots: 2 },
    { specialty: 'diseno', slots: 1 },
  ],
};

let store: MockStore;
const actors = new Map<string, Repositories>();

/** Los repositorios de una persona, con su perfil ya creado. */
async function person(id: string, specialties: Specialty[]): Promise<Repositories> {
  const repositories = createMockRepositories(store, { actorId: id });
  await repositories.profiles.saveCurrent(buildProfileInput({ name: id, specialties }));
  actors.set(id, repositories);
  return repositories;
}

const reason = async (action: Promise<unknown>) => {
  try {
    await action;
    return 'sin error';
  } catch (cause) {
    return cause instanceof GroupError ? cause.reason : (cause as { code?: string }).code;
  }
};

/** Mete a `user` en el grupo de `admin` por like recíproco. */
async function admit(
  admin: Repositories,
  user: Repositories,
  userId: string,
  specialty: Specialty
) {
  const view = await mineOf(admin);
  const role = view!.roles.find((candidate) => candidate.specialty === specialty)!;
  await user.groups.swipeGroup(view!.group.id, 'like');
  const result = await admin.groups.swipeCandidate(userId, role.id, 'like');
  expect(result.joined).toBe(true);
}

/** El único grupo de una persona (o el que administra), o `null`. */
const mineOf = async (repositories: Repositories) =>
  (await repositories.groups.listMine())[0] ?? null;

/** Sale del único grupo de esa persona. */
const leaveOnly = async (repositories: Repositories) =>
  repositories.groups.leave((await mineOf(repositories))!.group.id);

let admin: Repositories;
let dev1: Repositories;
let dev2: Repositories;
let dev3: Repositories;
let designer: Repositories;
let lawyer: Repositories;

beforeEach(async () => {
  store = createMockStore();
  // Sin grupos ni perfiles semilla: cada caso parte de lo que él mismo crea.
  Object.assign(store.state, { groups: [], groupRoles: [], groupMembers: [], groupSwipes: [] });
  store.state.profiles.clear();
  actors.clear();
  admin = await person('admin', ['producto']);
  dev1 = await person('dev1', ['dev']);
  dev2 = await person('dev2', ['dev']);
  dev3 = await person('dev3', ['dev']);
  designer = await person('designer', ['diseno']);
  lawyer = await person('lawyer', ['legal']);
});

describe('crear', () => {
  it('quien crea es admin y miembro sin plaza', async () => {
    const view = await admin.groups.create(INPUT);

    expect(view.isAdmin).toBe(true);
    expect(view.group.adminId).toBe('admin');
    expect(view.group.maxMembers).toBe(6);
    expect(view.members).toHaveLength(1);
    expect(view.members[0]).toMatchObject({ isAdmin: true, specialty: null });
    expect(view.members[0].member.roleId).toBeNull();
    // Los puestos salen en el orden del enum: diseño antes que desarrollo.
    expect(view.roles.map((role) => [role.specialty, role.slots, role.filled])).toEqual([
      ['diseno', 1, 0],
      ['dev', 2, 0],
    ]);
    expect((await mineOf(admin))?.group.id).toBe(view.group.id);
    expect(await mineOf(dev1)).toBeNull();
  });

  it('valida los datos, exige perfil y solo deja administrar un grupo', async () => {
    expect(await reason(admin.groups.create({ ...INPUT, name: 'x' }))).toBe('invalid');
    const ghost = createMockRepositories(store, { actorId: 'ghost' });
    expect(await reason(ghost.groups.create(INPUT))).toBe('23503');

    await admin.groups.create(INPUT);
    expect(await reason(admin.groups.create(INPUT))).toBe('already-admin');
  });

  it('avisa a quien está suscrito a su grupo', async () => {
    const listener = jest.fn();
    const stop = admin.groups.subscribe(listener);
    await admin.groups.create(INPUT);
    expect(listener).toHaveBeenCalled();
    stop();
  });
});

describe('decks', () => {
  it('quien busca ve los grupos con un puesto abierto que encaja, con su puesto', async () => {
    const { group } = await admin.groups.create(INPUT);

    const deck = await dev1.groups.getDeck();
    expect(deck).toHaveLength(1);
    expect(deck[0].group.id).toBe(group.id);
    expect(deck[0].myRole.specialty).toBe('dev');
    expect(deck[0].members.map((entry) => entry.profile?.name)).toEqual(['admin']);

    expect(await lawyer.groups.getDeck()).toEqual([]);
    expect(await admin.groups.getDeck()).toEqual([]);
    const ghost = createMockRepositories(store, { actorId: 'ghost' });
    expect(await ghost.groups.getDeck()).toEqual([]);
  });

  it('el admin ve a quien encaja y no tiene grupo, con el puesto que cubriría', async () => {
    await admin.groups.create(INPUT);

    const deck = await admin.groups.getRecruitDeck();
    expect(deck.map((card) => [card.profile.id, card.role.specialty])).toEqual([
      ['designer', 'diseno'],
      ['dev1', 'dev'],
      ['dev2', 'dev'],
      ['dev3', 'dev'],
    ]);
    expect(await reason(dev1.groups.getRecruitDeck())).toBe('admin-only');
  });

  it('quien ya dio like sale primero, y un pass reciente queda fuera', async () => {
    const { group } = await admin.groups.create(INPUT);
    await dev3.groups.swipeGroup(group.id, 'like');
    await dev2.groups.swipeGroup(group.id, 'pass');

    const deck = await admin.groups.getRecruitDeck();
    expect(deck.map((card) => card.profile.id)).toEqual(['dev3', 'designer', 'dev1']);
    expect(await dev3.groups.getDeck()).toEqual([]);

    const role = deck[0].role;
    await admin.groups.swipeCandidate('dev1', role.id, 'pass');
    expect((await admin.groups.getRecruitDeck()).map((card) => card.profile.id)).toEqual([
      'dev3',
      'designer',
    ]);
    expect(await dev1.groups.getDeck()).toEqual([]);
  });

  it('un grupo que ya te dio like sale antes que otro', async () => {
    const first = await admin.groups.create(INPUT);
    const second = await designer.groups.create({
      ...INPUT,
      roles: [{ specialty: 'dev', slots: 1 }],
    });
    const role = second.roles[0];
    await designer.groups.swipeCandidate('dev1', role.id, 'like');

    const deck = await dev1.groups.getDeck();
    expect(deck.map((card) => card.group.id)).toEqual([second.group.id, first.group.id]);
  });

  it('un bloqueo con alguien de dentro esconde el grupo y a la persona', async () => {
    const { group } = await admin.groups.create(INPUT);
    await dev1.profiles.block('admin');

    expect(await dev1.groups.getDeck()).toEqual([]);
    expect((await admin.groups.getRecruitDeck()).some((card) => card.profile.id === 'dev1')).toBe(
      false
    );
    expect(await reason(dev1.groups.swipeGroup(group.id, 'like'))).toBe('unavailable');
    const role = (await mineOf(admin))!.roles[1];
    expect(await reason(admin.groups.swipeCandidate('dev1', role.id, 'like'))).toBe(
      'candidate-unavailable'
    );
  });

  it('bloquear un grupo lo esconde después del plazo aunque cambie de admin', async () => {
    const { group } = await admin.groups.create(INPUT);
    await admit(admin, designer, 'designer', 'diseno');
    await dev1.groups.block(group.id);
    await admin.groups.leave(group.id);
    store.advanceClock(72 * 3_600_000);
    expect(await dev1.groups.getDeck()).toEqual([]);
    expect((await designer.groups.getRecruitDeck()).map((card) => card.profile.id)).not.toContain(
      'dev1'
    );
    expect(await reason(dev1.groups.swipeGroup(group.id, 'like'))).toBe('unavailable');
  });

  it('suspensiones y expulsiones siguen excluidas aunque las decisiones sean antiguas', async () => {
    const { group, roles } = await admin.groups.create(INPUT);
    await admit(admin, dev1, 'dev1', 'dev');
    await admin.groups.kick('dev1');
    await admin.groups.swipeCandidate('dev2', roles[1].id, 'pass');
    store.advanceClock(72 * 3_600_000);
    expect((await dev1.groups.swipeGroup(group.id, 'like')).joined).toBe(false);
    expect((await admin.groups.swipeCandidate('dev1', roles[1].id, 'like')).joined).toBe(false);
    store.state.bannedUntil.set('dev2', store.nowMs() + 3_600_000);
    const ids = (await admin.groups.getRecruitDeck()).map((card) => card.profile.id);
    expect(ids).not.toContain('dev2');
    expect(ids).not.toContain('dev1');
    expect((await dev1.groups.getDeck()).map((card) => card.group.id)).not.toContain(group.id);
  });
});

describe('unión', () => {
  it('une con like recíproco en los dos órdenes y marca la plaza', async () => {
    const { group, roles } = await admin.groups.create(INPUT);
    const [design, dev] = roles;

    expect((await dev1.groups.swipeGroup(group.id, 'like')).joined).toBe(false);
    expect((await admin.groups.swipeCandidate('dev1', dev.id, 'like')).joined).toBe(true);

    expect((await admin.groups.swipeCandidate('designer', design.id, 'like')).joined).toBe(false);
    expect((await designer.groups.swipeGroup(group.id, 'like')).joined).toBe(true);

    const view = (await mineOf(dev1))!;
    expect(view.isAdmin).toBe(false);
    expect(view.members.map((entry) => entry.member.userId).sort()).toEqual([
      'admin',
      'designer',
      'dev1',
    ]);
    expect(view.roles.map((role) => role.filled)).toEqual([1, 1]);
    expect(view.members.find((entry) => entry.member.userId === 'dev1')?.specialty).toBe('dev');
  });

  it('un pase no une, y quien ya está dentro no vuelve a deslizar ese grupo', async () => {
    const { group, roles } = await admin.groups.create(INPUT);
    await dev1.groups.swipeGroup(group.id, 'pass');
    expect((await admin.groups.swipeCandidate('dev1', roles[1].id, 'like')).joined).toBe(false);
    // Cambiar el pase por un like sí une.
    expect((await dev1.groups.swipeGroup(group.id, 'like')).joined).toBe(true);
    expect(await reason(dev1.groups.swipeGroup(group.id, 'like'))).toBe('unavailable');
  });

  it('con el puesto lleno no entra nadie más ni sale en el deck', async () => {
    const { group, roles } = await admin.groups.create(INPUT);
    await admit(admin, dev1, 'dev1', 'dev');
    await admit(admin, dev2, 'dev2', 'dev');

    expect((await admin.groups.getRecruitDeck()).map((card) => card.profile.id)).toEqual([
      'designer',
    ]);
    expect(await dev3.groups.getDeck()).toEqual([]);
    await dev3.groups.swipeGroup(group.id, 'like');
    expect((await admin.groups.swipeCandidate('dev3', roles[1].id, 'like')).joined).toBe(false);
    expect((await mineOf(admin))!.members).toHaveLength(3);
  });

  it('si el puesto elegido se llenó, entra en otro abierto que encaje', async () => {
    const both = await person('both', ['dev', 'diseno']);
    const { group, roles } = await admin.groups.create({
      ...INPUT,
      roles: [
        { specialty: 'dev', slots: 1 },
        { specialty: 'diseno', slots: 1 },
      ],
    });
    const dev = roles.find((role) => role.specialty === 'dev')!;
    await admin.groups.swipeCandidate('both', dev.id, 'like');
    await admit(admin, dev1, 'dev1', 'dev');

    expect((await both.groups.swipeGroup(group.id, 'like')).joined).toBe(true);
    const view = (await mineOf(both))!;
    expect(view.members.find((entry) => entry.member.userId === 'both')?.specialty).toBe('diseno');
  });

  it('un grupo lleno no admite a nadie y su deck se vacía', async () => {
    const { group, roles } = await admin.groups.create({
      ...INPUT,
      maxMembers: 2,
      roles: [{ specialty: 'dev', slots: 1 }],
    });
    await admit(admin, dev1, 'dev1', 'dev');
    expect(await admin.groups.getRecruitDeck()).toEqual([]);
    expect(await dev2.groups.getDeck()).toEqual([]);
    await dev2.groups.swipeGroup(group.id, 'like');
    expect((await admin.groups.swipeCandidate('dev2', roles[0].id, 'like')).joined).toBe(false);
  });

  it('una persona entra en varios grupos, hasta el tope de 3', async () => {
    const first = await admin.groups.create(INPUT);
    const second = await designer.groups.create({
      ...INPUT,
      roles: [{ specialty: 'dev', slots: 1 }],
    });
    const third = await lawyer.groups.create({ ...INPUT, roles: [{ specialty: 'dev', slots: 1 }] });
    const sales = await person('sales', ['ventas']);
    const fourth = await sales.groups.create({ ...INPUT, roles: [{ specialty: 'dev', slots: 1 }] });

    for (const [owner, view] of [
      [admin, first],
      [designer, second],
      [lawyer, third],
    ] as const) {
      const role = view.roles.find((candidate) => candidate.specialty === 'dev')!;
      await dev1.groups.swipeGroup(view.group.id, 'like');
      expect((await owner.groups.swipeCandidate('dev1', role.id, 'like')).joined).toBe(true);
    }
    expect((await dev1.groups.listMine()).map((view) => view.group.id)).toEqual([
      first.group.id,
      second.group.id,
      third.group.id,
    ]);

    // En el tope: ni deck, ni swipe, ni sale en el deck de reclutamiento, ni entra.
    expect(await dev1.groups.getDeck()).toEqual([]);
    expect(await reason(dev1.groups.swipeGroup(fourth.group.id, 'like'))).toBe('group-limit');
    expect((await sales.groups.getRecruitDeck()).some((card) => card.profile.id === 'dev1')).toBe(
      false
    );
    expect(await reason(dev1.groups.create(INPUT))).toBe('group-limit');

    // Al salir de uno, vuelve a poder.
    await dev1.groups.leave(second.group.id);
    expect((await dev1.groups.listMine()).map((view) => view.group.id)).toEqual([
      first.group.id,
      third.group.id,
    ]);
    expect((await dev1.groups.getDeck()).map((card) => card.group.id)).toEqual([fourth.group.id]);
  });

  it('quien administra un grupo también busca otros, sin ver el suyo', async () => {
    const mine = await admin.groups.create(INPUT);
    const other = await designer.groups.create({
      ...INPUT,
      roles: [{ specialty: 'producto', slots: 1 }],
    });

    const deck = await admin.groups.getDeck();
    expect(deck.map((card) => card.group.id)).toEqual([other.group.id]);

    await admin.groups.swipeGroup(other.group.id, 'like');
    expect((await designer.groups.swipeCandidate('admin', other.roles[0].id, 'like')).joined).toBe(
      true
    );
    const views = await admin.groups.listMine();
    // El que administra va primero.
    expect(views.map((view) => [view.group.id, view.isAdmin])).toEqual([
      [mine.group.id, true],
      [other.group.id, false],
    ]);
    // Y sigue reclutando para el suyo.
    expect((await admin.groups.getRecruitDeck()).map((card) => card.profile.id)).toContain('dev1');
  });

  it('el admin solo desliza sobre sus puestos y sobre personas que existen', async () => {
    const { roles } = await admin.groups.create(INPUT);
    expect(await reason(dev1.groups.swipeCandidate('dev2', roles[0].id, 'like'))).toBe(
      'admin-only'
    );
    expect(await reason(admin.groups.swipeCandidate('dev1', 'otro-puesto', 'like'))).toBe(
      'invalid'
    );
    expect(await reason(admin.groups.swipeCandidate('admin', roles[0].id, 'like'))).toBe(
      'candidate-unavailable'
    );
    expect(await reason(admin.groups.swipeCandidate('nadie', roles[0].id, 'like'))).toBe(
      'candidate-unavailable'
    );
    expect(await reason(dev1.groups.swipeGroup('no-existe', 'like'))).toBe('unavailable');
    const ghost = createMockRepositories(store, { actorId: 'ghost' });
    expect(await reason(ghost.groups.swipeGroup('no-existe', 'like'))).toBe('23503');
  });
});

describe('salir y expulsar', () => {
  it('la plaza vuelve a quedar libre y no hay reentrada sola', async () => {
    const { group } = await admin.groups.create(INPUT);
    await admit(admin, dev1, 'dev1', 'dev');
    await admit(admin, dev2, 'dev2', 'dev');

    await leaveOnly(dev1);
    expect(await mineOf(dev1)).toBeNull();
    expect((await mineOf(admin))!.roles[1].filled).toBe(1);
    expect(await reason(dev1.groups.leave(group.id))).toBe('unavailable');
    // Sus likes con el grupo quedaron en pase.
    expect(await dev1.groups.getDeck()).toEqual([]);
    expect((await admin.groups.getRecruitDeck()).some((card) => card.profile.id === 'dev1')).toBe(
      false
    );

    expect(await reason(dev2.groups.kick('admin'))).toBe('admin-only');
    expect(await reason(admin.groups.kick('admin'))).toBe('invalid');
    expect(await reason(admin.groups.kick('dev1'))).toBe('candidate-unavailable');
    const listener = jest.fn();
    dev2.groups.subscribe(listener);
    await admin.groups.kick('dev2');
    expect(listener).toHaveBeenCalled();
    const view = (await mineOf(admin))!;
    expect(view.members).toHaveLength(1);
    expect(view.roles.every((role) => role.filled === 0)).toBe(true);
    expect(view.group.id).toBe(group.id);
  });

  it('si sale el admin, pasa al más antiguo; si no queda nadie, el grupo se borra', async () => {
    await admin.groups.create(INPUT);
    store.advanceClock(1000);
    await admit(admin, dev1, 'dev1', 'dev');
    store.advanceClock(1000);
    await admit(admin, designer, 'designer', 'diseno');

    await leaveOnly(admin);
    const view = (await mineOf(dev1))!;
    expect(view.group.adminId).toBe('dev1');
    expect(view.isAdmin).toBe(true);
    // Conserva su puesto: la plaza sigue ocupada.
    expect(view.members.find((entry) => entry.isAdmin)?.specialty).toBe('dev');

    await leaveOnly(dev1);
    expect((await mineOf(designer))!.group.adminId).toBe('designer');
    await leaveOnly(designer);
    expect(store.state.groups).toHaveLength(0);
    expect(store.state.groupRoles).toHaveLength(0);
    expect(store.state.groupSwipes).toHaveLength(0);
  });

  it('el liderazgo salta a quien ya administra otro grupo; sin nadie así, el grupo se disuelve', async () => {
    const { group } = await admin.groups.create(INPUT);
    store.advanceClock(1000);
    const designerGroup = await designer.groups.create({
      ...INPUT,
      roles: [{ specialty: 'legal', slots: 1 }],
    });
    store.advanceClock(1000);
    await admit(admin, designer, 'designer', 'diseno');
    store.advanceClock(1000);
    await admit(admin, dev1, 'dev1', 'dev');

    // `designer` es más antiguo, pero ya administra el suyo: pasa a `dev1`.
    await admin.groups.leave(group.id);
    const views = await dev1.groups.listMine();
    expect(views[0]).toMatchObject({ isAdmin: true, group: { id: group.id, adminId: 'dev1' } });

    // Si quedan solo admins de otros grupos, el grupo se disuelve.
    await dev1.groups.kick('designer');
    await admit(dev1, lawyer, 'lawyer', 'dev');
    const lawyerGroup = await lawyer.groups.create({
      ...INPUT,
      roles: [{ specialty: 'ventas', slots: 1 }],
    });
    await dev1.groups.leave(group.id);
    expect(store.state.groups.map((candidate) => candidate.id).sort()).toEqual(
      [designerGroup.group.id, lawyerGroup.group.id].sort()
    );
    expect(await lawyer.groups.listMine()).toHaveLength(1);
  });

  it('salir de un grupo no toca los demás', async () => {
    const first = await admin.groups.create(INPUT);
    const second = await designer.groups.create({
      ...INPUT,
      roles: [{ specialty: 'dev', slots: 1 }],
    });
    await admit(admin, dev1, 'dev1', 'dev');
    await admit(designer, dev1, 'dev1', 'dev');

    await dev1.groups.leave(first.group.id);
    expect((await dev1.groups.listMine()).map((view) => view.group.id)).toEqual([second.group.id]);
    expect(await reason(dev1.groups.leave(first.group.id))).toBe('unavailable');
  });

  it('borrar la cuenta saca de todos sus grupos', async () => {
    const first = await admin.groups.create(INPUT);
    const second = await designer.groups.create({
      ...INPUT,
      roles: [{ specialty: 'dev', slots: 1 }],
    });
    await admit(admin, dev1, 'dev1', 'dev');
    await admit(designer, dev1, 'dev1', 'dev');

    await dev1.session.deleteMyAccount();
    expect(store.state.groupMembers.some((member) => member.userId === 'dev1')).toBe(false);
    expect((await mineOf(admin))!.group.id).toBe(first.group.id);
    expect((await mineOf(designer))!.roles[0].filled).toBe(0);
    expect(second.group.id).toBeDefined();
  });

  it('borrar la cuenta saca del grupo, pasa el liderazgo y se lleva swipes y mensajes', async () => {
    const { group } = await admin.groups.create(INPUT);
    await admit(admin, dev1, 'dev1', 'dev');
    await dev2.groups.swipeGroup(group.id, 'like');
    await admin.groups.sendMessage(group.id, 'hola');
    await dev1.groups.sendMessage(group.id, 'buenas');
    await lawyer.groups.report({ groupId: group.id, reason: 'spam' });

    await dev2.session.deleteMyAccount();
    expect(store.state.groupSwipes.some((swipe) => swipe.userId === 'dev2')).toBe(false);

    await admin.session.deleteMyAccount();
    const view = (await mineOf(dev1))!;
    expect(view.group.adminId).toBe('dev1');
    expect(view.members).toHaveLength(1);
    expect((await dev1.groups.listMessages(group.id)).map((message) => message.body)).toEqual([
      'buenas',
    ]);
    // El like que el admin dio en nombre del grupo se queda, sin autor.
    expect(
      store.state.groupSwipes.find(
        (swipe) => swipe.userId === 'dev1' && swipe.direction === 'group_to_user'
      )?.actorId
    ).toBeNull();

    await dev1.session.deleteMyAccount();
    expect(store.state.groups).toHaveLength(0);
    expect(store.state.groupMessages).toHaveLength(0);
    // El reporte sobrevive al grupo, con su referencia en texto.
    expect(store.state.userReports[0]).toMatchObject({ groupId: null, groupRef: group.id });
  });
});

describe('chat de grupo', () => {
  it('solo los miembros leen y escriben, y los suscritos se enteran', async () => {
    const { group } = await admin.groups.create(INPUT);
    await admit(admin, dev1, 'dev1', 'dev');
    const listener = jest.fn();
    const stop = dev1.groups.subscribeMessages(group.id, listener);

    const sent = await admin.groups.sendMessage(group.id, 'hola equipo');
    expect(sent).toMatchObject({ groupId: group.id, senderId: 'admin', body: 'hola equipo' });
    expect(listener).toHaveBeenCalledTimes(1);
    stop();

    expect((await dev1.groups.listMessages(group.id)).map((message) => message.body)).toEqual([
      'hola equipo',
    ]);
    expect(await dev2.groups.listMessages(group.id)).toEqual([]);
    expect(await reason(dev2.groups.sendMessage(group.id, 'colado'))).toBe('42501');
    expect(await reason(admin.groups.sendMessage(group.id, '   '))).toBe('42501');
  });

  it('un bloqueo esconde los mensajes de esa persona', async () => {
    const { group } = await admin.groups.create(INPUT);
    await admit(admin, dev1, 'dev1', 'dev');
    await admit(admin, designer, 'designer', 'diseno');
    await dev1.groups.sendMessage(group.id, 'de dev1');
    await designer.groups.sendMessage(group.id, 'de designer');
    await designer.profiles.block('dev1');

    expect((await designer.groups.listMessages(group.id)).map((message) => message.body)).toEqual([
      'de designer',
    ]);
    expect(await admin.groups.listMessages(group.id)).toHaveLength(2);
    // Y su perfil deja de entregarse dentro del grupo.
    const view = (await mineOf(designer))!;
    expect(view.members.find((entry) => entry.member.userId === 'dev1')?.profile).toBeNull();
  });
});

describe('denunciar y bloquear', () => {
  it('el reporte de un grupo apunta a su admin y guarda la referencia', async () => {
    const { group } = await admin.groups.create(INPUT);

    await dev1.groups.report({ groupId: group.id, reason: 'spam', details: '  raro  ' });
    expect(store.state.userReports[0]).toMatchObject({
      reporterId: 'dev1',
      reportedId: 'admin',
      reason: 'spam',
      details: 'raro',
      groupId: group.id,
      groupName: 'Equipo',
    });

    expect(await reason(admin.groups.report({ groupId: group.id, reason: 'spam' }))).toBe('LI008');
    expect(await reason(dev1.groups.report({ groupId: 'no-existe', reason: 'spam' }))).toBe(
      'unavailable'
    );
    expect(await reason(dev1.groups.report({ groupId: group.id, reason: 'nada' as never }))).toBe(
      'LI009'
    );
    expect(
      await reason(
        dev1.groups.report({ groupId: group.id, reason: 'spam', details: 'x'.repeat(501) })
      )
    ).toBe('23514');
  });

  it('reportar un mensaje del chat: solo miembros y nunca el propio', async () => {
    const { group } = await admin.groups.create(INPUT);
    await admit(admin, dev1, 'dev1', 'dev');
    const message = await dev1.groups.sendMessage(group.id, 'mensaje feo');

    await admin.groups.reportMessage({ messageId: message.id, reason: 'acoso' });
    expect(store.state.userReports[0]).toMatchObject({
      reportedId: 'dev1',
      messageRef: message.id,
      messageExcerpt: 'mensaje feo',
      groupRef: group.id,
    });
    expect(
      await reason(dev1.groups.reportMessage({ messageId: message.id, reason: 'acoso' }))
    ).toBe('LI008');
    expect(
      await reason(dev2.groups.reportMessage({ messageId: message.id, reason: 'acoso' }))
    ).toBe('42501');
    expect(await reason(admin.groups.reportMessage({ messageId: 'nada', reason: 'acoso' }))).toBe(
      '42501'
    );
  });

  it('bloquear un grupo lo saca del deck y bloquea a su admin; desde dentro no se puede', async () => {
    const { group } = await admin.groups.create(INPUT);
    await admit(admin, dev1, 'dev1', 'dev');
    const listener = jest.fn();
    dev2.groups.subscribe(listener);

    await dev2.groups.block(group.id);
    expect(listener).toHaveBeenCalled();
    expect(await dev2.groups.getDeck()).toEqual([]);
    expect(await dev2.profiles.getById('admin')).toBeNull();
    expect((await admin.groups.getRecruitDeck()).some((card) => card.profile.id === 'dev2')).toBe(
      false
    );

    expect(await reason(dev1.groups.block(group.id))).toBe('invalid');
    expect(await reason(dev3.groups.block('no-existe'))).toBe('unavailable');
  });
});

describe('semillas', () => {
  it('la app nace con grupos de ejemplo, y el primero ya le ha dado like a la cuenta propia', async () => {
    const fresh = createMockStore();
    const me = createMockRepositories(fresh);
    await me.profiles.saveCurrent(buildProfileInput({ specialties: ['dev'] }));

    const deck = await me.groups.getDeck();
    expect(deck.map((card) => card.group.id)).toEqual(['seed-group-taller', 'seed-group-ruta']);
    expect(deck[0].members.map((entry) => entry.profile?.id)).toEqual(['seed-marc', 'seed-alba']);

    const result = await me.groups.swipeGroup('seed-group-taller', 'like');
    expect(result.joined).toBe(true);
    expect((await mineOf(me))?.members.map((entry) => entry.member.userId)).toContain(
      CURRENT_USER_ID
    );
  });
});
