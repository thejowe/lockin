import { buildProfile } from '@/data/test-fixtures';

import { roomRowView } from './row-view';

import type { RoomMember, RoomView } from '@/data';

const now = new Date(2026, 9, 3, 12).getTime();
const startsAt = new Date(2026, 9, 3, 13).toISOString();

function member(profileId: string, status: RoomMember['status']): RoomMember {
  return { roomId: 'room', profileId, status, respondedAt: null, joinedAt: null, leftAt: null };
}

function view(host = false): RoomView {
  return {
    room: {
      id: 'room',
      hostId: 'ana',
      startsAt,
      blocks: 2,
      cancelledAt: null,
      createdAt: startsAt,
    },
    me: member(host ? 'ana' : 'me', host ? 'aceptada' : 'invitada'),
    others: (host ? ['bea', 'carla', 'dani'] : ['ana', 'carla']).map((id, index) => ({
      member: member(id, index === 0 ? 'aceptada' : index === 1 ? 'invitada' : 'rechazada'),
      profile: buildProfile({ id, name: id === 'ana' ? 'Ana García' : id }),
    })),
  };
}

it('la invitación usa el nombre de pila, la fecha y los bloques', () => {
  expect(roomRowView(view(), now)).toEqual({
    kind: 'invitada',
    title: 'Ana te invita',
    detail: 'hoy 13:00 · 2 bloques',
    accent: 'brass',
  });
});

it('convocas: cuenta aceptadas sin incluirte y todos los invitados en el total', () => {
  expect(roomRowView(view(true), now)).toEqual({
    kind: 'convocas',
    title: 'Tu sala',
    detail: 'hoy 13:00 · 1 de 3 han aceptado',
    accent: null,
  });
});

it('convocas: conserva la sala aunque nadie más acepte', () => {
  const value = view(true);
  value.others[0].member.status = 'invitada';
  expect(roomRowView(value, now).detail).toBe('hoy 13:00 · 0 de 3 han aceptado');
});

it('convocas sin pendientes: la fila es la de una sala aceptada, con quién va', () => {
  // Spec § Matches: «Tu sala · k de n» es solo para quien convoca con pendientes.
  const value = view(true);
  value.others[1].member.status = 'aceptada';
  expect(roomRowView(value, now)).toEqual({
    kind: 'aceptada',
    title: 'Sala',
    detail: 'hoy 13:00 · 3 personas',
    accent: null,
  });
});

it('convocas y todas rechazan: sigue diciendo que no ha aceptado nadie', () => {
  const value = view(true);
  value.others.forEach(({ member }) => (member.status = 'rechazada'));
  expect(roomRowView(value, now)).toMatchObject({
    kind: 'convocas',
    detail: 'hoy 13:00 · 0 de 3 han aceptado',
  });
});

it('aceptada: cuenta a todas las que van, tú incluida', () => {
  const value = view();
  value.me.status = 'aceptada';
  expect(roomRowView(value, now)).toEqual({
    kind: 'aceptada',
    title: 'Sala',
    detail: 'hoy 13:00 · 2 personas',
    accent: null,
  });
});

it.each([false, true])('entrar gana en el inicio exacto de ventana (convocas: %s)', (host) => {
  const value = view(host);
  value.me.status = 'aceptada';
  expect(roomRowView(value, Date.parse(startsAt) - 5 * 60_000)).toEqual({
    kind: 'entrar',
    title: 'Entrar a la sala',
    detail: 'hoy 13:00 · 2 bloques',
    accent: 'brass',
  });
});

it('un milisegundo antes de la ventana aún no ofrece entrar', () => {
  expect(roomRowView(view(true), Date.parse(startsAt) - 5 * 60_000 - 1).kind).toBe('convocas');
});

it('una invitada no puede entrar aunque la ventana esté abierta', () => {
  expect(roomRowView(view(), Date.parse(startsAt)).kind).toBe('invitada');
});

it('una sala cancelada no ofrece entrar', () => {
  const value = view(true);
  value.room.cancelledAt = startsAt;
  expect(roomRowView(value, Date.parse(startsAt)).kind).not.toBe('entrar');
});

it('en el final exacto no ofrece entrar', () => {
  expect(roomRowView(view(true), Date.parse(startsAt) + 60 * 60_000).kind).not.toBe('entrar');
});

it('reutiliza el singular de bloques y la fecha de mañana', () => {
  const value = view();
  value.room.blocks = 1;
  expect(roomRowView(value, now - 24 * 60 * 60_000).detail).toBe('mañana 13:00 · 1 bloque');
});
