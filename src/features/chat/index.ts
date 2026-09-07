/**
 * Superficie pública del bloque `chat`.
 *
 * Las pantallas de `src/app/` importan siempre desde aquí, nunca de un archivo
 * suelto de la carpeta: así se puede reorganizar por dentro sin tocar rutas.
 */

export { ConversationIntro } from './conversation-intro';
export { IcebreakerSuggestions } from './icebreaker-suggestions';
export { LockInCta } from './lock-in-cta';
export { MatchRow, NO_MESSAGES_HINT } from './match-row';
export { MatchesEmpty } from './matches-empty';
export { DayDivider, MessageBubble } from './message-bubble';
export { MessageComposer } from './message-composer';
export { ProfileAvatar } from './profile-avatar';
export { suggestIcebreakers } from './icebreakers';
export { formatClock, formatDayHeading, formatRelative, isSameDayIso } from './format';
export { keyboardVerticalOffset } from './keyboard-offset';
export { useConversation, type Conversation } from './use-conversation';
export { useMatches } from './use-matches';
