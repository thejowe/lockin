import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { secureAuthStorage } from './secure-storage';

const vault = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const secure = jest.mocked(SecureStore);
const KEY = 'sb-test-auth-token';
const MANIFEST = `${KEY}.m`;

function chunkKeys(): string[] {
  return [...vault.keys()].filter((k) => k !== MANIFEST);
}

beforeEach(async () => {
  vault.clear();
  await AsyncStorage.clear();
  jest.clearAllMocks();
  secure.getItemAsync.mockImplementation(async (k) => vault.get(k) ?? null);
  secure.setItemAsync.mockImplementation(async (k, v) => {
    vault.set(k, v);
  });
  secure.deleteItemAsync.mockImplementation(async (k) => {
    vault.delete(k);
  });
});

describe('secureAuthStorage', () => {
  it('guarda en el almacén seguro y no deja copia en claro', async () => {
    await AsyncStorage.setItem(KEY, 'viejo');
    await secureAuthStorage.setItem(KEY, 'refresh-token');

    expect(await secureAuthStorage.getItem(KEY)).toBe('refresh-token');
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });

  it('trocea valores grandes y los recompone', async () => {
    const big = 'x'.repeat(5000) + 'fin';
    await secureAuthStorage.setItem(KEY, big);

    expect(JSON.parse(vault.get(MANIFEST) as string).n).toBe(3);
    for (const k of chunkKeys()) expect(vault.get(k)?.length).toBeLessThanOrEqual(1800);
    expect(await secureAuthStorage.getItem(KEY)).toBe(big);
  });

  it('al reescribir no deja trozos de la generación anterior', async () => {
    await secureAuthStorage.setItem(KEY, 'y'.repeat(4000));
    await secureAuthStorage.setItem(KEY, 'corto');

    expect(chunkKeys()).toHaveLength(1);
    expect(await secureAuthStorage.getItem(KEY)).toBe('corto');
  });

  it('una escritura interrumpida antes del manifiesto deja el valor anterior', async () => {
    const original = 'a'.repeat(4000);
    await secureAuthStorage.setItem(KEY, original);

    // Muere la app al escribir el manifiesto de la generación nueva.
    secure.setItemAsync.mockImplementation(async (k, v) => {
      if (k === MANIFEST) throw new Error('proceso terminado');
      vault.set(k, v);
    });
    await secureAuthStorage.setItem(KEY, 'b');
    secure.setItemAsync.mockImplementation(async (k, v) => {
      vault.set(k, v);
    });

    // El valor nuevo cayó a AsyncStorage y el manifiesto viejo se invalidó.
    expect(await secureAuthStorage.getItem(KEY)).toBe('b');
  });

  it('migra la sesión antigua de AsyncStorage sin perderla', async () => {
    await AsyncStorage.setItem(KEY, 'sesion-en-claro');

    expect(await secureAuthStorage.getItem(KEY)).toBe('sesion-en-claro');
    expect(vault.has(MANIFEST)).toBe(true);
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
    expect(await secureAuthStorage.getItem(KEY)).toBe('sesion-en-claro');
  });

  it('si el almacén seguro lanza al leer y hay copia en AsyncStorage, la usa', async () => {
    await AsyncStorage.setItem(KEY, 'sesion-en-claro');
    secure.getItemAsync.mockRejectedValue(new Error('keystore'));

    expect(await secureAuthStorage.getItem(KEY)).toBe('sesion-en-claro');
  });

  it('si el almacén seguro lanza al leer y no hay copia, propaga el error', async () => {
    secure.getItemAsync.mockRejectedValue(new Error('keystore'));

    await expect(secureAuthStorage.getItem(KEY)).rejects.toThrow('keystore');
  });

  it('si no puede escribir en el almacén seguro, no pierde la sesión', async () => {
    secure.setItemAsync.mockRejectedValue(new Error('keystore'));

    await secureAuthStorage.setItem(KEY, 'token');

    expect(await AsyncStorage.getItem(KEY)).toBe('token');
  });

  it('el valor de reserva gana a uno antiguo del almacén seguro', async () => {
    await secureAuthStorage.setItem(KEY, 'antiguo');
    secure.setItemAsync.mockRejectedValue(new Error('keystore'));

    await secureAuthStorage.setItem(KEY, 'nuevo');
    secure.setItemAsync.mockImplementation(async (k, v) => {
      vault.set(k, v);
    });

    expect(await secureAuthStorage.getItem(KEY)).toBe('nuevo');
  });

  it('un trozo que falta no devuelve un valor a medias', async () => {
    await secureAuthStorage.setItem(KEY, 'z'.repeat(4000));
    vault.delete(chunkKeys()[1] as string);

    expect(await secureAuthStorage.getItem(KEY)).toBeNull();
  });

  it('removeItem limpia los dos almacenes', async () => {
    await secureAuthStorage.setItem(KEY, 'w'.repeat(4000));
    await AsyncStorage.setItem(KEY, 'residuo');

    await secureAuthStorage.removeItem(KEY);

    expect([...vault.keys()]).toEqual([]);
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });

  it('removeItem no da por cerrada la sesión si el almacén seguro falla', async () => {
    await secureAuthStorage.setItem(KEY, 'token');
    secure.deleteItemAsync.mockRejectedValue(new Error('keystore'));

    await expect(secureAuthStorage.removeItem(KEY)).rejects.toThrow('keystore');
  });

  it('en web usa AsyncStorage y no toca el almacén seguro', async () => {
    const original = Platform.OS;
    Platform.OS = 'web';
    try {
      await secureAuthStorage.setItem(KEY, 'web');
      expect(await secureAuthStorage.getItem(KEY)).toBe('web');
      expect(secure.setItemAsync).not.toHaveBeenCalled();
    } finally {
      Platform.OS = original;
    }
  });
});
