/**
 * Superficie pública del bloque `salas`. Las rutas de `src/app/` importan siempre desde aquí.
 */

export { useRoomPresence } from './use-room-presence';
export { RoomReminderSync } from './room-reminder-sync';
export { ROOM_REMINDER_KEY_PREFIX, syncRoomReminders } from './room-reminders';
export { roomRowView } from './row-view';
export { RoomRow } from './room-row';
export { useLiveRooms } from './use-live-rooms';
export { InviteePicker } from './invitee-picker';
export { useRoom, type RoomState } from './use-room';
export { RoomsSection } from './rooms-section';
export { useSingleFlight, type SingleFlight } from './use-single-flight';
