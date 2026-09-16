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
export {
  endingView,
  RATING_CLOSED,
  RATING_FAILED,
  RATING_OPTIONS,
  ratingLabel,
  type EndingView,
} from './rating';
export { RatingChips } from './rating-chips';
export { SessionCard } from './session-card';
export { SessionReminderSync } from './session-reminder-sync';
export { dayOptions, preselectSlot, slotsForDay } from './slots';
export { STREAK_MIN_VISIBLE, streakDeadline, streakLine, streakTag, visibleStreak } from './streak';
export { useActiveSession } from './use-active-session';
export { useAttendance } from './use-attendance';
export { useCounterpartPresence, type CounterpartPresence } from './use-counterpart-presence';
export { useMatchStreaks } from './use-match-streaks';
export { useNow } from './use-now';
export { useRating, type RatingState } from './use-rating';
export { useSessionRoom } from './use-session-room';
export { useVideoCall, type VideoCall, type VideoCallStatus } from './use-video-call';
export { VideoCallView } from './video-call-view';
