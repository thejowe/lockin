/**
 * Superficie pública del bloque `perfil`.
 *
 * Las pantallas (y otros bloques, si les sirve) importan desde `@/features/profile`,
 * nunca de los archivos sueltos: así se puede reorganizar por dentro sin tocarlas.
 */

export * from './catalog';
export { ProfileAvatar } from './profile-avatar';
export { ProfileDetails } from './profile-details';
export { ProfileForm, type ProfileFormProps } from './profile-form';
