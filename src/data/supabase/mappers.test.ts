/**
 * Tests de la traducción fila ↔ dominio.
 *
 * Son funciones puras: no hay red, ni sesión, ni Supabase. Lo que se comprueba
 * aquí es justo lo que `src/data/supabase/contract.test.ts` no puede ver de
 * cerca, porque allí todo pasa por una consulta real — el aplanado de
 * `availability` y `links` en columnas, y la reconstrucción del par de un match.
 */

import {
  byRecentActivity,
  counterpartIdOf,
  initialsFrom,
  toMatch,
  toMessage,
  toProfile,
  toProfileInsert,
} from './mappers';
import { buildProfile, buildProfileInput } from '../test-fixtures';

import type { MatchRow, MessageRow, ProfileRow } from './database.types';

const ME = '11111111-1111-4111-8111-00000000000a';
const OTHER = '22222222-2222-4222-8222-00000000000b';

function buildProfileRow(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    id: ME,
    name: 'Núria Bosch',
    age: 29,
    location: 'Barcelona',
    timezone: 'Europe/Madrid',
    avatar_initials: 'NB',
    avatar_accent: 'teal',
    specialties: ['dev', 'datos'],
    seeking_specialties: ['marketing', 'ventas'],
    looking_for: 'par',
    starting_point: 'idea-sin-empezar',
    availability_hours_per_week: 25,
    availability_bands: ['tarde', 'noche'],
    ambition: 'todo-o-nada',
    link_github: 'https://github.com/example-nuria',
    link_portfolio: null,
    link_linkedin: null,
    prompts: [{ question: 'Lo que quiero construir es…', answer: 'Herramientas pequeñas.' }],
    created_at: '2026-01-01T09:00:00.000Z',
    updated_at: '2026-01-02T09:00:00.000Z',
    ...overrides,
  };
}

function buildMatchRow(overrides: Partial<MatchRow> = {}): MatchRow {
  return {
    id: 'match-1',
    // El par va ordenado canónicamente en la base, no en orden de llegada.
    profile_a: ME < OTHER ? ME : OTHER,
    profile_b: ME < OTHER ? OTHER : ME,
    mode: 'par',
    created_at: '2026-01-01T09:00:00.000Z',
    last_message_at: null,
    ...overrides,
  };
}

describe('initialsFrom', () => {
  it('toma la primera y la última palabra', () => {
    expect(initialsFrom('Núria Bosch')).toBe('NB');
    expect(initialsFrom('María del Mar Ruiz')).toBe('MR');
  });

  it('con una sola palabra da una sola letra', () => {
    expect(initialsFrom('Omar')).toBe('O');
  });

  it('aguanta espacios de sobra y nombres vacíos', () => {
    expect(initialsFrom('  marc   oller  ')).toBe('MO');
    expect(initialsFrom('   ')).toBe('?');
  });
});

describe('toProfile', () => {
  it('reconstruye availability y avatar desde columnas planas', () => {
    const profile = toProfile(buildProfileRow());

    expect(profile.availability).toEqual({ hoursPerWeek: 25, bands: ['tarde', 'noche'] });
    expect(profile.avatar).toEqual({ initials: 'NB', accent: 'teal' });
  });

  it('omite los enlaces ausentes en vez de dejarlos en null', () => {
    // `ProfileLinks` los declara opcionales: un `portfolio: null` rompería
    // cualquier `if (links.portfolio)` de las pantallas de perfil.
    const profile = toProfile(buildProfileRow());

    expect(profile.links).toEqual({ github: 'https://github.com/example-nuria' });
    expect('portfolio' in profile.links).toBe(false);
  });

  it('conserva los dos timestamps por separado', () => {
    const profile = toProfile(buildProfileRow());

    expect(profile.createdAt).toBe('2026-01-01T09:00:00.000Z');
    expect(profile.updatedAt).toBe('2026-01-02T09:00:00.000Z');
  });

  it('distingue lo que el perfil domina de lo que busca', () => {
    // Son dos columnas distintas y es fácil cruzarlas al mapear: `specialties`
    // es lo que aporta esta persona, `seeking_specialties` lo que quiere de la
    // otra. La fila de prueba las lleva disjuntas justo para que un cruce se
    // vea.
    const profile = toProfile(buildProfileRow());

    expect(profile.specialties).toEqual(['dev', 'datos']);
    expect(profile.seekingSpecialties).toEqual(['marketing', 'ventas']);
  });

  it('el array vacío llega como array vacío, que es «abierto a cualquiera»', () => {
    const profile = toProfile(buildProfileRow({ looking_for: 'lockin', seeking_specialties: [] }));

    expect(profile.seekingSpecialties).toEqual([]);
  });
});

describe('toProfileInsert', () => {
  it('aplana availability y links, y deja los enlaces ausentes en null', () => {
    const row = toProfileInsert(
      ME,
      buildProfileInput({
        availability: { hoursPerWeek: 12, bands: ['noche'] },
        links: { github: 'https://github.com/example' },
      }),
      null
    );

    expect(row.availability_hours_per_week).toBe(12);
    expect(row.availability_bands).toEqual(['noche']);
    expect(row.link_github).toBe('https://github.com/example');
    expect(row.link_portfolio).toBeNull();
    expect(row.link_linkedin).toBeNull();
  });

  it('deriva las iniciales cuando el formulario no manda avatar', () => {
    const row = toProfileInsert(
      ME,
      buildProfileInput({ name: 'Núria Bosch', avatar: undefined }),
      null
    );

    expect(row.avatar_initials).toBe('NB');
  });

  it('hereda el acento del perfil existente antes de caer en el de por defecto', () => {
    // El formulario manda iniciales pero no acento: es el caso que obliga a
    // mirar el perfil que ya había.
    const input = buildProfileInput({ avatar: { initials: 'XX' } });
    const existing = buildProfile({ avatar: { initials: 'XX', accent: 'teal' } });

    expect(toProfileInsert(ME, input, existing).avatar_accent).toBe('teal');
    expect(toProfileInsert(ME, input, null).avatar_accent).toBe('brass');
  });

  it('el id lo pone quien llama, nunca el formulario', () => {
    // Es `auth.uid()`: si saliera del input, un cliente podría escribir el
    // perfil de otra persona (y solo lo pararía la política RLS).
    const row = toProfileInsert(ME, buildProfileInput(), null);

    expect(row.id).toBe(ME);
    expect(row).not.toHaveProperty('created_at');
    expect(row).not.toHaveProperty('updated_at');
  });

  it('guarda seekingSpecialties tal cual, sin deducirlo de specialties', () => {
    const row = toProfileInsert(
      ME,
      buildProfileInput({
        lookingFor: 'par',
        specialties: ['dev'],
        seekingSpecialties: ['diseno', 'ventas'],
      }),
      null
    );

    expect(row.seeking_specialties).toEqual(['diseno', 'ventas']);
    expect(row.specialties).toEqual(['dev']);
  });

  it('sin seekingSpecialties escribe [] y no lo hereda del perfil existente', () => {
    // `ProfileInput` lo declara opcional para que un formulario que todavía no
    // pregunta por el campo no se invente un valor. Heredar aquí dejaría al
    // usuario con una preferencia que ya no puede ver ni cambiar.
    const input = buildProfileInput({ lookingFor: 'par', seekingSpecialties: undefined });
    const existing = buildProfile({ seekingSpecialties: ['legal'] });

    expect(toProfileInsert(ME, input, existing).seeking_specialties).toEqual([]);
    expect(toProfileInsert(ME, input, null).seeking_specialties).toEqual([]);
  });

  it('no arrastra un id del input', () => {
    const input = { ...buildProfileInput(), id: OTHER } as ReturnType<typeof buildProfileInput>;

    expect(toProfileInsert(ME, input, null).id).toBe(ME);
  });
});

describe('toMatch', () => {
  it('devuelve el par como [propio, otro] venga como venga de la base', () => {
    const asA = toMatch(buildMatchRow({ profile_a: ME, profile_b: OTHER }), ME);
    const asB = toMatch(buildMatchRow({ profile_a: OTHER, profile_b: ME }), ME);

    expect(asA.profileIds).toEqual([ME, OTHER]);
    expect(asB.profileIds).toEqual([ME, OTHER]);
  });

  it('lastMessageAt es null mientras no haya conversación', () => {
    expect(toMatch(buildMatchRow(), ME).lastMessageAt).toBeNull();
  });
});

describe('counterpartIdOf', () => {
  it('da el otro lado esté en la columna que esté', () => {
    expect(counterpartIdOf(buildMatchRow({ profile_a: ME, profile_b: OTHER }), ME)).toBe(OTHER);
    expect(counterpartIdOf(buildMatchRow({ profile_a: OTHER, profile_b: ME }), ME)).toBe(OTHER);
  });
});

describe('toMessage', () => {
  it('renombra las columnas sin tocar el contenido', () => {
    const row: MessageRow = {
      id: 'message-1',
      match_id: 'match-1',
      sender_id: ME,
      body: '¿Arrancamos?',
      sent_at: '2026-01-03T09:00:00.000Z',
    };

    expect(toMessage(row)).toEqual({
      id: 'message-1',
      matchId: 'match-1',
      senderId: ME,
      body: '¿Arrancamos?',
      sentAt: '2026-01-03T09:00:00.000Z',
    });
  });
});

describe('byRecentActivity', () => {
  const sinMensajes = { createdAt: '2026-01-02T00:00:00.000Z', lastMessageAt: null };
  const conMensaje = {
    createdAt: '2026-01-01T00:00:00.000Z',
    lastMessageAt: '2026-01-03T00:00:00.000Z',
  };

  it('un mensaje reciente sube el match por encima de uno más nuevo sin conversación', () => {
    expect([sinMensajes, conMensaje].sort(byRecentActivity)).toEqual([conMensaje, sinMensajes]);
  });

  it('sin mensajes ordena por createdAt, del más nuevo al más viejo', () => {
    const viejo = { createdAt: '2026-01-01T00:00:00.000Z', lastMessageAt: null };

    expect([viejo, sinMensajes].sort(byRecentActivity)).toEqual([sinMensajes, viejo]);
  });
});
