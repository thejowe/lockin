import { Redirect } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/ambient-background';
import { Button } from '@/components/button';
import { LoadingState, MessageState } from '@/components/state-view';
import { useQuery, useRepositories } from '@/data';
import { useTheme } from '@/hooks/use-theme';

/** Recupera el perfil antes de decidir si hace falta onboarding. */
export default function IndexRoute() {
  const repositories = useRepositories();
  const theme = useTheme();
  const {
    data: onboarded,
    loading,
    error,
    refresh,
  } = useQuery('session:onboarded', () => repositories.session.isOnboarded());

  // Nunca en blanco: con Supabase esta consulta cruza la red, y una pantalla
  // vacía no distingue «tarda» de «se ha colgado».
  if (loading) return <LoadingState label="Abriendo cofounder…" />;

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

  return <Redirect href={onboarded ? '/discover' : '/mode'} />;
}

const styles = StyleSheet.create({
  error: { flex: 1 },
});
