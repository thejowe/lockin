/**
 * Superficie pública del bloque `sesiones`.
 *
 * Las rutas de `src/app/` importan siempre desde aquí.
 */

export { cardView, type CardView } from './card-state';
export {
  blocksLabel,
  formatDayLabel,
  formatSessionWhen,
  formatStartsIn,
  formatTimeOfDay,
} from './format';
export { formatCountdown, phaseAt, type Phase, type PhaseKind } from './phase';
export { ProposeSessionSheet } from './propose-session-sheet';
export { SessionCard } from './session-card';
export { SessionReminderSync } from './session-reminder-sync';
export { dayOptions, preselectSlot, slotsForDay } from './slots';
export { useActiveSession } from './use-active-session';
export { useAttendance } from './use-attendance';
export { useCounterpartPresence, type CounterpartPresence } from './use-counterpart-presence';
export { useNow } from './use-now';
export { useSessionRoom } from './use-session-room';
