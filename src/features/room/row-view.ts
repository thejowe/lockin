import { isInRoomJoinWindow, type RoomView } from '@/data';
import { blocksLabel, formatSessionWhen } from '@/features/session/format';

/** Textos de una sala viva; la lista se encarga de retirar las terminadas. */
export function roomRowView(
  view: RoomView,
  nowMs: number
): {
  kind: 'invitada' | 'convocas' | 'aceptada' | 'entrar';
  title: string;
  detail: string;
  accent: 'brass' | null;
} {
  const { room, me, others } = view;
  const when = formatSessionWhen(room.startsAt, nowMs);
  const detail = `${when} · ${blocksLabel(room.blocks)}`;

  if (isInRoomJoinWindow(room, me, nowMs)) {
    return { kind: 'entrar', title: 'Entrar a la sala', detail, accent: 'brass' };
  }

  if (me.status === 'invitada') {
    const host = others.find(({ member }) => member.profileId === room.hostId);
    const name = host?.profile.name.split(' ')[0];
    return {
      kind: 'invitada',
      title: name ? `${name} te invita` : 'Te invitan a una sala',
      detail,
      accent: 'brass',
    };
  }

  const accepted = others.filter(({ member }) => member.status === 'aceptada').length;
  const pending = others.some(({ member }) => member.status === 'invitada');
  // Quien convoca ve el recuento mientras falten respuestas, y también si no va
  // nadie más: «1 personas» escondería que la sala se ha quedado vacía.
  if (me.profileId === room.hostId && (pending || accepted === 0)) {
    return {
      kind: 'convocas',
      title: 'Tu sala',
      detail: `${when} · ${accepted} de ${others.length} han aceptado`,
      accent: null,
    };
  }

  return {
    kind: 'aceptada',
    title: 'Sala',
    detail: `${when} · ${accepted + 1} personas`,
    accent: null,
  };
}
