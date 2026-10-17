/**
 * La contraseña del alta a la espera de confirmar el correo: va al almacén
 * seguro, tiene dueño, se borra al usarla y caduca con el enlace (24 h).
 */

import * as SecureStore from 'expo-secure-store';

import {
  clearPendingPassword,
  hasPendingPassword,
  readPendingPassword,
  stashPendingPassword,
} from './pending-password';

const KEY = 'cofounder.signup.pending-password';

beforeEach(async () => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  await clearPendingPassword();
});

it('la guarda en el almacén seguro y se la devuelve a su cuenta', async () => {
  await stashPendingPassword('una-clave-larga', 'uid-1');

  expect(await SecureStore.getItemAsync(KEY)).toContain('una-clave-larga');
  expect(await hasPendingPassword()).toBe(true);
  expect(await readPendingPassword('uid-1')).toBe('una-clave-larga');
});

it('a otra cuenta no se la da: la borra', async () => {
  await stashPendingPassword('una-clave-larga', 'uid-1');

  expect(await readPendingPassword('uid-2')).toBeNull();
  expect(await hasPendingPassword()).toBe(false);
  expect(await SecureStore.getItemAsync(KEY)).toBeNull();
});

it('borrada, no queda nada', async () => {
  await stashPendingPassword('una-clave-larga', 'uid-1');
  await clearPendingPassword();

  expect(await readPendingPassword('uid-1')).toBeNull();
  expect(await SecureStore.getItemAsync(KEY)).toBeNull();
});

it('si el almacén seguro no deja guardar la nueva, no queda en disco la anterior', async () => {
  await stashPendingPassword('la-vieja-clave', 'uid-1');
  jest.spyOn(SecureStore, 'setItemAsync').mockRejectedValueOnce(new Error('keystore'));

  await stashPendingPassword('la-nueva-clave', 'uid-1');

  expect(await readPendingPassword('uid-1')).toBe('la-nueva-clave');
  expect(await SecureStore.getItemAsync(KEY)).toBeNull();
});

it('pasadas 24 h ya no vale', async () => {
  jest.useFakeTimers({ now: new Date('2026-10-17T10:00:00Z') });
  await stashPendingPassword('una-clave-larga', 'uid-1');

  jest.setSystemTime(new Date('2026-10-18T10:00:01Z'));
  expect(await readPendingPassword('uid-1')).toBeNull();
});
