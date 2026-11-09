/**
 * `/group/info`: «Tu grupo» a pantalla completa. Se abre desde el deck de
 * reclutamiento y desde la cabecera del chat del grupo. Al salir del grupo (o
 * si ya no estás en ninguno) vuelve a donde se estaba.
 */

import { useRouter } from 'expo-router';

import { Screen } from '@/components/ambient-background';
import { Button } from '@/components/button';
import { LoadingState, MessageState } from '@/components/state-view';
import { GroupHome, useMyGroup } from '@/features/groups';
import { RequireVerifiedEmail } from '@/features/profile';
import { t } from '@/i18n';

function GroupInfo() {
  const router = useRouter();
  const mine = useMyGroup();
  const close = () => (router.canGoBack() ? router.back() : router.replace('/discover'));

  if (mine.loading) return <LoadingState label={t('Cargando grupos…')} />;
  if (!mine.group) {
    return (
      <MessageState
        title={t('Ya no estás en ningún grupo')}
        body={
          mine.error
            ? t('Ha fallado la carga. Inténtalo otra vez en un momento.')
            : t('Busca uno en Descubrir o crea el tuyo.')
        }>
        <Button label={t('Volver')} onPress={close} />
      </MessageState>
    );
  }

  return (
    <Screen ambient="teal">
      <GroupHome view={mine.group} onLeft={close} />
    </Screen>
  );
}

export default function GroupInfoRoute() {
  return (
    <RequireVerifiedEmail>
      <GroupInfo />
    </RequireVerifiedEmail>
  );
}
