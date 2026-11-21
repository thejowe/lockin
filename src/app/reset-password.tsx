import { Redirect, useRouter } from 'expo-router';

import { NewPasswordForm } from '@/features/profile';
import { accountsAvailable } from '@/features/profile/account-gateway';

/**
 * `/reset-password`: la hoja que abre el enlace del correo de recuperación
 * (`auth/callback`). Al guardar o cerrarla, a la puerta de entrada, que decide
 * entre el deck y lo que falte del alta.
 */
export default function ResetPasswordRoute() {
  const router = useRouter();

  if (!accountsAvailable) return <Redirect href="/" />;

  return <NewPasswordForm onDone={() => router.replace('/')} />;
}
