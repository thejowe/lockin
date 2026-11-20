import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRoute, resetRepositories, resetRouter, router, repositories } from '../routes';
import { getLocalePreference, setLocalePreference } from '@/i18n';
import SettingsScreen from '../../src/app/settings';
import NotificationsScreen from '../../src/app/notifications';

jest.mock('expo-router', () => jest.requireActual('../routes').expoRouterMock());

beforeEach(async () => {
  resetRouter();
  resetRepositories();
  await setLocalePreference('es');
});
afterEach(async () => {
  await setLocalePreference('auto');
});

it('cambia el idioma desde Ajustes y permite recuperar la preferencia automática', async () => {
  await renderRoute(<SettingsScreen />);
  await fireEvent.press(screen.getByRole('radio', { name: 'Català' }));
  expect(getLocalePreference()).toBe('ca');
  await fireEvent.press(screen.getByRole('radio', { name: 'Automàtic' }));
  expect(getLocalePreference()).toBe('auto');
});

it('abre las preferencias y permite recuperar una lectura fallida', async () => {
  const view = await renderRoute(<SettingsScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Gestionar notificaciones' }));
  expect(router.push).toHaveBeenCalledWith('/notifications');
  await view.unmount();
  jest.spyOn(repositories.push, 'getPreferences').mockRejectedValueOnce(new Error('offline'));
  await renderRoute(<NotificationsScreen />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Reintentar' }));
  const toggle = await screen.findByLabelText('Mensajes de grupo');
  const save = jest.spyOn(repositories.push, 'setPreferences');
  await fireEvent(toggle, 'valueChange', false);
  await waitFor(() => expect(save).toHaveBeenCalledWith({ notify_group_messages: false }));
});
