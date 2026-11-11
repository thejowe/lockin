/**
 * `/group/edit`: el admin cambia el nombre, el proyecto y los perfiles que
 * busca su grupo. Se abre desde «Tu grupo». Quien no administra (o ya no está
 * en ningún grupo) ve por qué no puede y vuelve.
 */

import { useRouter, type Href } from 'expo-router';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

import { Screen } from '@/components/ambient-background';
import { Button } from '@/components/button';
import { LoadingState, MessageState } from '@/components/state-view';
import { EditGroupForm, useMyGroups } from '@/features/groups';
import { RequireVerifiedEmail } from '@/features/profile';
import { t } from '@/i18n';

function EditGroup() {
  const router = useRouter();
  const mine = useMyGroups();
  const view = mine.adminGroup;
  const close = () =>
    router.canGoBack()
      ? router.back()
      : router.replace((view ? `/group/info?id=${view.group.id}` : '/group/info') as Href);

  if (mine.loading) return <LoadingState label={t('Cargando grupos…')} />;
  if (!view) {
    return (
      <MessageState
        title={t('No puedes editar este grupo')}
        body={t('Solo puede hacerlo quien administra el grupo.')}>
        <Button label={t('Volver')} onPress={close} />
      </MessageState>
    );
  }

  return (
    <Screen ambient="ember">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <EditGroupForm view={view} onSaved={close} />
      </KeyboardAvoidingView>
    </Screen>
  );
}

export default function EditGroupRoute() {
  return (
    <RequireVerifiedEmail>
      <EditGroup />
    </RequireVerifiedEmail>
  );
}
