import { Redirect } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/ambient-background';
import { Button } from '@/components/button';
import { LoadingState, MessageState } from '@/components/state-view';
import { useQuery, useRepositories } from '@/data';
import { useRegistrationGate } from '@/features/profile';
import { registrationRequired } from '@/features/profile/account-gateway';
import { hasPendingPassword } from '@/features/profile/pending-password';
import { useTheme } from '@/hooks/use-theme';

/** Recupera el perfil antes de decidir si hace falta onboarding. */
export default function IndexRoute() {
  const repositories = useRepositories();
  const theme = useTheme();
  const gate = useRegistrationGate();
  const {
    data: onboarded,
    loading,
    error,
    refresh,
  } = useQuery('session:onboarded', () => repositories.session.isOnboarded());
  // La contraseña del alta se aplica en `/register`; quien confirma el correo
  // fuera de la app y vuelve por el icono tiene que pasar por allí.
  const { data: pendingPassword, loading: pendingLoading } = useQuery(
    'signup:pending-password',
    hasPendingPassword
  );

  // Nunca en blanco: con Supabase esta consulta cruza la red, y una pantalla
  // vacía no distingue «tarda» de «se ha colgado».
  // Esperar también a la puerta: con perfil, no se enseña `/discover` a quien
  // luego tendrá que confirmar el correo; sin él, decide entre la bienvenida y
  // el formulario.
  if (loading || pendingLoading || gate === 'checking') {
    return <LoadingState label="Abriendo cofounder…" />;
  }

  // Una consulta fallida no significa que el usuario no tenga perfil.
  if (error) {
    return (
      <SafeAreaView style={[styles.error, { backgroundColor: theme.background }]}>
        <AmbientBackground />
        {/*
          La causa, tal cual. No es decorado: esta pantalla es donde muere el
          arranque cuando algo va mal, y con el texto fijo a secas nadie podía
          saber por qué —ni quien tiene la app delante, ni un E2E de CI, que
          vuelca la jerarquía de la pantalla pero no puede inventarse lo que no
          está escrito en ella (run 35362453233).
        */}
        <MessageState
          title="No hemos podido recuperar tu perfil"
          body="Comprueba tu conexión y vuelve a intentarlo."
          detail={error.message}>
          <Button label="Reintentar" onPress={refresh} />
        </MessageState>
      </SafeAreaView>
    );
  }

  // Sin perfil: con la cuenta ya creada y confirmada solo falta el formulario;
  // si no, la bienvenida (`/mode`), que empieza el alta por «Sobre ti». Con
  // perfil pero sin email confirmado —cuenta anónima anterior al registro
  // obligatorio— se asciende en `/register`: conserva perfil y matches.
  if (registrationRequired && gate === 'open' && pendingPassword) {
    return <Redirect href="/register" />;
  }
  if (!onboarded) {
    return <Redirect href={registrationRequired && gate === 'open' ? '/profile-form' : '/mode'} />;
  }
  return <Redirect href={gate === 'required' ? '/register' : '/discover'} />;
}

const styles = StyleSheet.create({
  error: { flex: 1 },
});
