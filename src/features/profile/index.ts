/**
 * Superficie pública del bloque `perfil`.
 *
 * Las pantallas (y otros bloques, si les sirve) importan desde `@/features/profile`,
 * nunca de los archivos sueltos: así se puede reorganizar por dentro sin tocarlas.
 */

export * from './catalog';
export { AccountSection } from './account-section';
export { Board } from './board';
export { AuthCallback, authLinkFromParams } from './auth-callback';
export { DayStrip, timezoneCity, type DaySchedule } from './day-strip';
export { GithubSeal } from './github-seal';
export { LinkAccounts } from './link-accounts';
export { LinkedinSeal } from './linkedin-seal';
export { PhotoSection } from './photo-section';
export { ProfileAvatar } from './profile-avatar';
export { ProfileDetails } from './profile-details';
export { ProfileForm, type ProfileFormProps, type ProfileSeed } from './profile-form';
export { ProviderButtons } from './provider-buttons';
export { RegisterForm } from './register-form';
export { RequireVerifiedEmail } from './require-verified-email';
export { SignInForm } from './sign-in-form';
export {
  LegalLinks,
  TermsAcceptance,
  TermsCheckbox,
  TermsLinks,
  useTermsGate,
  type TermsGate,
} from './terms';
export { AboutYouForm } from './about-you-form';
export { useRegistrationGate, type RegistrationGate } from './use-registration-gate';
