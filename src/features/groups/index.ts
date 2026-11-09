/**
 * Superficie pública de los grupos.
 *
 * Las pantallas de `src/app/` importan siempre desde `@/features/groups`, nunca
 * de un archivo suelto de la carpeta.
 */

export { CreateGroupForm } from './create-group-form';
export { GroupChatRow } from './group-row';
export { GroupHome } from './group-home';
export { GroupsSection, SectionSwitch, type DiscoverSection } from './groups-section';
export { groupErrorMessage, memberRoleLabel } from './labels';
export { useGroupConversation, type GroupConversation } from './use-group-conversation';
export { MY_GROUP_QUERY, useMyGroup } from './use-my-group';
