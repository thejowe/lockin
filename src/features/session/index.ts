/**
 * Superficie pública del bloque `sesiones`.
 *
 * Las rutas de `src/app/` importan siempre desde aquí.
 */

export {
  blocksLabel,
  formatDayLabel,
  formatSessionWhen,
  formatStartsIn,
  formatTimeOfDay,
} from './format';
export { formatCountdown, phaseAt, type Phase, type PhaseKind } from './phase';
export { dayOptions, preselectSlot, slotsForDay } from './slots';
export { useAttendance } from './use-attendance';
export { useCounterpartPresence, type CounterpartPresence } from './use-counterpart-presence';
export { useNow } from './use-now';
export { useSessionRoom } from './use-session-room';
