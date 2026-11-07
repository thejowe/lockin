/**
 * Ramas de `auth.ts` que los otros dos archivos de test no pisan: los errores
 * del servidor que se propagan, el móvil de contacto y la recuperación de
 * contraseña terminada. Comparten el arnés mínimo de `auth.test.ts`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';

import {
  AccountError,
  completeAuthLink,
  deleteMyAccount,
  getAccountState,
  linkEmailToCurrentUser,
  linkLinkedinIdentity,
  saveAccountPhone,
  setRecoveredPassword,
  signOut,
} from './auth';
import { getSupabaseClient, peekSupabaseClient } from './client';

jest.mock('./client', () => ({ getSupabaseClient: jest.fn(), peekSupabaseClient: jest.fn() }));
jest.mock('expo-linking', () => ({ createURL: jest.fn() }));
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }));
jest.mock('expo-apple-authentication', () => ({
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

const auth = {
  getSession: jest.fn(),
  getUser: jest.fn(),
  signOut: jest.fn(),
  updateUser: jest.fn(),
  linkIdentity: jest.fn(),
  exchangeCodeForSession: jest.fn(),
  getUserIdentities: jest.fn(),
  unlinkIdentity: jest.fn(),
};
const rpc = jest.fn();
const functions = { invoke: jest.fn() };
const profileSeal = jest.fn();
const from = jest.fn(() => ({
  select: () => ({ eq: () => ({ maybeSingle: profileSeal }) }),
}));

const LINKEDIN_ATTEMPT_KEY = 'lockin.supabase.linkedin-attempt';
const PASSWORD_RECOVERY_KEY = 'lockin.supabase.password-recovery';

function user(overrides: Record<string, unknown> = {}) {
  return { id: 'usuario-1', email: null, new_email: null, email_confirmed_at: null, ...overrides };
}

function signedInAs(overrides: Record<string, unknown> = {}) {
  const current = user(overrides);
  auth.getSession.mockResolvedValue({ data: { session: { user: current } }, error: null });
  auth.getUser.mockResolvedValue({ data: { user: current }, error: null });
  return current;
}

const CONFIRMADA = { email: 'ana@example.com', email_confirmed_at: '2026-09-01T00:00:00Z' };

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  jest.mocked(Linking.createURL).mockReturnValue('cofounder://auth/callback');
  auth.signOut.mockResolvedValue({ error: null });
  auth.updateUser.mockResolvedValue({ data: { user: null }, error: null });
  auth.getUserIdentities.mockResolvedValue({ data: { identities: [] }, error: null });
  rpc.mockResolvedValue({ error: null });
  functions.invoke.mockResolvedValue({ data: { ok: true }, error: null });
  profileSeal.mockResolvedValue({ data: null, error: null });
  const shared = { auth, rpc, functions, from } as unknown as ReturnType<typeof getSupabaseClient>;
  jest.mocked(getSupabaseClient).mockReturnValue(shared);
  jest.mocked(peekSupabaseClient).mockReturnValue(shared);
});

describe('estado de la cuenta', () => {
  it('traduce el fallo de leer la sesión local', async () => {
    auth.getSession.mockResolvedValue({
      data: { session: null },
      error: Object.assign(new Error('x'), { code: 'LI007' }),
    });

    await expect(getAccountState()).rejects.toMatchObject({ reason: 'no-session' });
  });

  it('lee el móvil de contacto y descarta el que viene en blanco o sin metadatos', async () => {
    signedInAs({ user_metadata: { phone_number: '+34 600 000 000' } });
    await expect(getAccountState()).resolves.toMatchObject({ phone: '+34 600 000 000' });

    signedInAs({ user_metadata: { phone_number: '   ' } });
    await expect(getAccountState()).resolves.toMatchObject({ phone: null });

    signedInAs({ user_metadata: undefined });
    await expect(getAccountState()).resolves.toMatchObject({ phone: null });
  });

  it('si el ascenso no devuelve usuario, relee el estado', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    await expect(linkEmailToCurrentUser('ana@example.com')).resolves.toMatchObject({
      kind: 'none',
    });
  });
});

describe('móvil de contacto', () => {
  it('lo guarda en los metadatos del usuario', async () => {
    await saveAccountPhone('+34 600 000 000');

    expect(auth.updateUser).toHaveBeenCalledWith({ data: { phone_number: '+34 600 000 000' } });
  });

  it('traduce el fallo del servidor', async () => {
    auth.updateUser.mockResolvedValue({
      data: { user: null },
      error: Object.assign(new Error('x'), { code: 'LI007' }),
    });

    await expect(saveAccountPhone('1')).rejects.toBeInstanceOf(AccountError);
  });
});

describe('recuperación de contraseña', () => {
  it('con la recuperación vigente pone la nueva sin pedir la actual', async () => {
    const current = signedInAs(CONFIRMADA);
    await AsyncStorage.setItem(
      PASSWORD_RECOVERY_KEY,
      JSON.stringify({ userId: current.id, at: Date.now() })
    );
    auth.updateUser.mockResolvedValue({ data: { user: current }, error: null });

    await setRecoveredPassword('la-nueva-1');

    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'la-nueva-1' });
    expect(await AsyncStorage.getItem(PASSWORD_RECOVERY_KEY)).toBeNull();
  });

  it('un canje de recuperación sin usuario no apunta ninguna marca', async () => {
    signedInAs(CONFIRMADA);
    auth.exchangeCodeForSession.mockResolvedValue({
      data: { user: null, session: null, redirectType: 'recovery' },
      error: null,
    });

    await completeAuthLink('cofounder://auth/callback?code=recuperar');

    expect(await AsyncStorage.getItem(PASSWORD_RECOVERY_KEY)).toBeNull();
  });

  it('un canje sin datos tampoco rompe el enlace', async () => {
    signedInAs(CONFIRMADA);
    auth.exchangeCodeForSession.mockResolvedValue({ data: null, error: null });

    await expect(
      completeAuthLink('cofounder://auth/callback?code=sin-datos')
    ).resolves.toMatchObject({ recoverable: true });
  });
});

describe('cerrar sesión y borrar la cuenta', () => {
  it('propaga el fallo del servidor tras limpiar lo local', async () => {
    auth.signOut.mockResolvedValue({ error: Object.assign(new Error('x'), { code: 'LI007' }) });

    await expect(signOut({ acceptDataLoss: true })).rejects.toMatchObject({
      reason: 'no-session',
    });
  });

  it('con un cliente inyectado, propaga el fallo de su cierre local', async () => {
    const other = {
      auth: {
        signOut: jest.fn().mockResolvedValue({
          error: Object.assign(new Error('x'), { code: 'LI007' }),
        }),
      },
      rpc: jest.fn().mockResolvedValue({ error: null }),
      functions: { invoke: jest.fn().mockResolvedValue({ error: null }) },
      storage: { from: () => ({ remove: jest.fn().mockResolvedValue({ error: null }) }) },
      from,
    } as unknown as NonNullable<Parameters<typeof deleteMyAccount>[0]>;

    await expect(deleteMyAccount(other)).rejects.toMatchObject({ reason: 'no-session' });
  });
});

describe('vuelta en frío y vínculo de LinkedIn', () => {
  it('si no se puede leer las identidades al sellar, dice que no se pudo vincular', async () => {
    signedInAs(CONFIRMADA);
    await AsyncStorage.setItem(LINKEDIN_ATTEMPT_KEY, String(Date.now()));
    auth.exchangeCodeForSession.mockResolvedValue({
      data: { user: null, session: { provider_token: 'li-token' } },
      error: null,
    });
    auth.getUserIdentities.mockResolvedValue({
      data: { identities: [] },
      error: new Error('sin red'),
    });

    await expect(completeAuthLink('cofounder://auth/callback?code=frio')).rejects.toThrow(
      /LinkedIn ha quedado vinculado/
    );
  });

  it('vincular falla si no se pueden leer las identidades', async () => {
    const error = new Error('sin red');
    auth.getUserIdentities.mockResolvedValue({ data: { identities: [] }, error });

    await expect(linkLinkedinIdentity()).rejects.toBe(error);
  });

  it('vincular falla si no se puede leer el perfil de una identidad sin sello', async () => {
    signedInAs(CONFIRMADA);
    auth.getUserIdentities.mockResolvedValue({
      data: { identities: [{ provider: 'linkedin_oidc' }] },
      error: null,
    });
    const error = new Error('RLS');
    profileSeal.mockResolvedValue({ data: null, error });

    await expect(linkLinkedinIdentity()).rejects.toBe(error);
  });
});
