/**
 * `profiles.setAvatarPhoto` / `removeAvatarPhoto` del repositorio Supabase.
 *
 * El cliente es un doble: se comprueba que el repositorio sube a pendientes,
 * pide la publicación a la función y devuelve el perfil releído (porque quien lo
 * escribe es el servidor), y que sin perfil no toca el almacenamiento.
 */

import { createSupabaseRepositories } from './index';

import type { LockInSupabaseClient } from './client';
import type { ProfileRow } from './database.types';

jest.mock('./avatar-file', () => ({
  readLocalImage: jest
    .fn()
    .mockResolvedValue({ bytes: new ArrayBuffer(4), contentType: 'image/jpeg' }),
}));

const PATH = 'u1/n.jpg';
const SIGNED = 'https://x.supabase.co/storage/v1/object/sign/avatars/u1/n.jpg?token=t';

function row(avatarUrl: string | null): ProfileRow {
  return {
    id: 'u1',
    name: 'Ana',
    age: 30,
    location: 'Madrid',
    timezone: 'Europe/Madrid',
    avatar_initials: 'A',
    avatar_accent: 'brass',
    avatar_url: avatarUrl,
    specialties: ['dev'],
    seeking_specialties: [],
    looking_for: 'par',
    starting_point: 'solo-ganas',
    availability_hours_per_week: 10,
    availability_bands: ['tarde'],
    ambition: 'equilibrado',
    link_github: null,
    github_handle: null,
    github_verified_at: null,
    link_portfolio: null,
    link_linkedin: null,
    link_instagram: null,
    link_tiktok: null,
    linkedin_name: null,
    linkedin_verified_at: null,
    prompts: [],
    created_at: '2026-10-12T10:00:00.000Z',
    updated_at: '2026-10-12T10:00:00.000Z',
  };
}

function setup(opts: { profile: ProfileRow | null; afterInvoke?: ProfileRow | null }) {
  let current = opts.profile;
  const upload = jest.fn().mockResolvedValue({ data: {}, error: null });
  const invoke = jest.fn(async () => {
    if (opts.afterInvoke !== undefined) current = opts.afterInvoke;
    return { data: { avatarPath: PATH }, error: null };
  });
  const client = {
    from: jest.fn(() => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: current, error: null }) }) }),
    })),
    storage: {
      from: jest.fn(() => ({
        upload,
        remove: jest.fn(),
        createSignedUrls: async (paths: string[]) => ({
          data: paths.map((path) => ({ path, signedUrl: SIGNED, error: null })),
          error: null,
        }),
      })),
    },
    functions: { invoke },
  } as unknown as LockInSupabaseClient;

  const repositories = createSupabaseRepositories({
    getClient: () => client,
    getUserId: async () => 'u1',
  });
  return { repositories, upload, invoke };
}

describe('profiles.setAvatarPhoto', () => {
  it('sube, pide la publicación y devuelve el perfil con la foto', async () => {
    const { repositories, upload, invoke } = setup({ profile: row(null), afterInvoke: row(PATH) });

    const profile = await repositories.profiles.setAvatarPhoto('file:///a.jpg');

    expect(upload).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('moderate-avatar', {
      body: { action: 'set', path: expect.stringMatching(/^u1\/.+\.jpg$/) },
    });
    expect(profile.avatar.imageUrl).toBe(SIGNED);
  });

  it('sin perfil no sube nada', async () => {
    const { repositories, upload, invoke } = setup({ profile: null });

    await expect(repositories.profiles.setAvatarPhoto('file:///a.jpg')).rejects.toThrow(
      /No hay perfil/
    );
    expect(upload).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });
});

describe('profiles.removeAvatarPhoto', () => {
  it('pide quitarla y devuelve el perfil sin foto', async () => {
    const { repositories, invoke } = setup({ profile: row(PATH), afterInvoke: row(null) });

    const profile = await repositories.profiles.removeAvatarPhoto();

    expect(invoke).toHaveBeenCalledWith('moderate-avatar', { body: { action: 'remove' } });
    expect('imageUrl' in profile.avatar).toBe(false);
  });

  it('sin perfil no invoca nada', async () => {
    const { repositories, invoke } = setup({ profile: null });

    await expect(repositories.profiles.removeAvatarPhoto()).rejects.toThrow(/No hay perfil/);
    expect(invoke).not.toHaveBeenCalled();
  });
});
