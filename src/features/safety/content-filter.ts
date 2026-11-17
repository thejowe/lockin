export { findObjectionableContent, isObjectionable, type ObjectionableKind } from '../../../supabase/functions/_shared/profile-content';
import { tk } from '@/i18n';



export const OBJECTIONABLE_MESSAGE = tk(
  'Este texto contiene lenguaje que no permitimos (insultos, amenazas o contenido sexual explícito). Reescríbelo para continuar.'
);

