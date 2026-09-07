/**
 * Superficie pública del bloque `descubrir`.
 *
 * La pantalla (y cualquier otro bloque que lo necesite) importa desde
 * `@/features/discover`, nunca de los archivos sueltos.
 */

export { ActionButton } from './action-button';
export { Chip, type ChipTone } from './chip';
export { complementWith } from './complement';
export { DeckActions } from './deck-actions';
export { DeckEmpty } from './deck-empty';
export { MatchModal } from './match-modal';
export { ModeFilter } from './mode-filter';
export { ProfileCard } from './profile-card';
export { SwipeDeck } from './swipe-deck';
export { useDeck, type DeckState, type MatchEvent } from './use-deck';
