/**
 * Reglas de tiempo de las sesiones Lock-In. Las usan el mock, el repositorio de
 * Supabase (para `getActive`) y la UI, así que un borde mal puesto aquí se ve en
 * los tres sitios a la vez.
 */

import {
  SessionConflictError,
  SessionExpiredError,
  SessionForbiddenError,
  SessionWindowError,
} from './session-errors';
import {
  attendedSession,
  BLOCK_MINUTES,
  isInJoinWindow,
  isInRatingWindow,
  isSessionBlocks,
  isSessionLive,
  isValidStartsAt,
  RATING_WINDOW_HOURS,
  sessionEndsAtMs,
} from './sessions';

import type { SessionAttendance } from './types';

const MINUTE = 60_000;
const START = Date.parse('2026-09-14T18:00:00.000Z');
const startsAt = new Date(START).toISOString();

describe('sessionEndsAtMs', () => {
  it('suma 30 minutos por bloque, descanso del último incluido', () => {
    expect(BLOCK_MINUTES).toBe(30);
    expect(sessionEndsAtMs(startsAt, 1)).toBe(START + 30 * MINUTE);
    expect(sessionEndsAtMs(startsAt, 4)).toBe(START + 120 * MINUTE);
  });
});

describe('isSessionLive', () => {
  it('una propuesta vive hasta la hora de inicio, exclusiva', () => {
    const session = { status: 'propuesta' as const, startsAt, blocks: 2 as const };
    expect(isSessionLive(session, START - 1)).toBe(true);
    expect(isSessionLive(session, START)).toBe(false);
  });

  it('una aceptada vive hasta el final, exclusivo', () => {
    const session = { status: 'aceptada' as const, startsAt, blocks: 2 as const };
    expect(isSessionLive(session, START + 60 * MINUTE - 1)).toBe(true);
    expect(isSessionLive(session, START + 60 * MINUTE)).toBe(false);
  });

  it.each(['rechazada', 'cancelada'] as const)('una %s nunca está viva', (status) => {
    expect(isSessionLive({ status, startsAt, blocks: 1 }, START - 10 * MINUTE)).toBe(false);
  });
});

describe('isInJoinWindow', () => {
  const accepted = { status: 'aceptada' as const, startsAt, blocks: 1 as const };

  it('abre 5 minutos antes y cierra al final', () => {
    expect(isInJoinWindow(accepted, START - 5 * MINUTE - 1)).toBe(false);
    expect(isInJoinWindow(accepted, START - 5 * MINUTE)).toBe(true);
    expect(isInJoinWindow(accepted, START + 30 * MINUTE - 1)).toBe(true);
    expect(isInJoinWindow(accepted, START + 30 * MINUTE)).toBe(false);
  });

  it('sin aceptar no hay ventana', () => {
    expect(isInJoinWindow({ ...accepted, status: 'propuesta' }, START)).toBe(false);
  });
});

describe('isInRatingWindow', () => {
  const accepted = { status: 'aceptada' as const, startsAt, blocks: 1 as const };
  const ENDS_AT = START + 30 * MINUTE;
  const WINDOW = RATING_WINDOW_HOURS * 60 * MINUTE;

  it('abre justo al terminar y cierra 24 h después', () => {
    expect(isInRatingWindow(accepted, ENDS_AT - 1)).toBe(false);
    expect(isInRatingWindow(accepted, ENDS_AT)).toBe(true);
    expect(isInRatingWindow(accepted, ENDS_AT + 12 * 60 * MINUTE)).toBe(true);
    expect(isInRatingWindow(accepted, ENDS_AT + WINDOW - 1)).toBe(true);
    expect(isInRatingWindow(accepted, ENDS_AT + WINDOW)).toBe(false);
  });

  it.each(['propuesta', 'cancelada', 'rechazada'] as const)(
    'una %s no se valora nunca',
    (status) => {
      expect(isInRatingWindow({ ...accepted, status }, ENDS_AT)).toBe(false);
    }
  );
});

describe('attendedSession', () => {
  const accepted = { status: 'aceptada' as const, startsAt, blocks: 1 as const };
  const ENDS_AT = START + 30 * MINUTE;
  const row = (joinedAtMs: number, leftAt: string | null = null): SessionAttendance => ({
    sessionId: 'session-1',
    profileId: 'p1',
    joinedAt: new Date(joinedAtMs).toISOString(),
    leftAt,
  });

  it('asistió quien entró antes del final, exclusivo', () => {
    expect(attendedSession([row(ENDS_AT - 1)], 'p1', accepted)).toBe(true);
    expect(attendedSession([row(ENDS_AT)], 'p1', accepted)).toBe(false);
  });

  it('sin fila propia no hay asistencia', () => {
    expect(attendedSession([], 'p1', accepted)).toBe(false);
    expect(attendedSession([{ ...row(START), profileId: 'p2' }], 'p1', accepted)).toBe(false);
  });

  it('irse antes del final no borra haber asistido', () => {
    const left = row(START, new Date(START + 5 * MINUTE).toISOString());
    expect(attendedSession([left], 'p1', accepted)).toBe(true);
  });
});

describe('isValidStartsAt', () => {
  const now = START - 60 * MINUTE;

  it('exige al menos 5 minutos de margen', () => {
    expect(isValidStartsAt(now + 5 * MINUTE - 1, now)).toBe(false);
    expect(isValidStartsAt(now + 5 * MINUTE, now)).toBe(true);
  });

  it('no admite más de 30 días', () => {
    expect(isValidStartsAt(now + 30 * 24 * 60 * MINUTE, now)).toBe(true);
    expect(isValidStartsAt(now + 30 * 24 * 60 * MINUTE + 1, now)).toBe(false);
  });
});

describe('isSessionBlocks', () => {
  it('solo acepta 1, 2 y 4', () => {
    expect([0, 1, 2, 3, 4, 5].filter(isSessionBlocks)).toEqual([1, 2, 4]);
  });
});

describe('errores de dominio', () => {
  it.each([
    [SessionConflictError, 'SessionConflictError'],
    [SessionExpiredError, 'SessionExpiredError'],
    [SessionWindowError, 'SessionWindowError'],
    [SessionForbiddenError, 'SessionForbiddenError'],
  ])('%p se distingue con instanceof y lleva su nombre', (ErrorClass, name) => {
    const error = new ErrorClass('detalle');
    expect(error).toBeInstanceOf(ErrorClass);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe(name);
    expect(error.message).toBe('detalle');
  });
});
