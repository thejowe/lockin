/**
 * Superficie pública del bloque `perfil`.
 *
 * Las pantallas (y otros bloques, si les sirve) importan desde `@/features/profile`,
 * nunca de los archivos sueltos: así se puede reorganizar por dentro sin tocarlas.
 */

export * from './catalog';
export { AccountSection } from './account-section';
export { AuthCallback } from './auth-callback';
export { GithubSeal } from './github-seal';
export { GithubVerification } from './github-verification';
export { ProfileAvatar } from './profile-avatar';
export { ProfileDetails } from './profile-details';
export { ProfileForm, type ProfileFormProps } from './profile-form';
export { RegisterForm } from './register-form';
export { SignInForm } from './sign-in-form';
export { useRegistrationGate, type RegistrationGate } from './use-registration-gate';
