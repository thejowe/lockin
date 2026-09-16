import { Redirect } from 'expo-router';
import { Button, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
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

  if (loading) return null;

  // Una consulta fallida no significa que el usuario no tenga perfil.
  if (error) {
    return (
      <SafeAreaView style={[styles.error, { backgroundColor: theme.background }]}>
        <ThemedText type="subtitle">No hemos podido recuperar tu perfil</ThemedText>
        <ThemedText>Comprueba tu conexión y vuelve a intentarlo.</ThemedText>
        <Button title="Reintentar" onPress={refresh} color={theme.brass} />
      </SafeAreaView>
    );
  }

  return <Redirect href={onboarded ? '/discover' : '/mode'} />;
}

const styles = StyleSheet.create({
  error: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
});
