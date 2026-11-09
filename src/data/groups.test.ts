import {
  firstOpenRoleFor,
  GROUP_CREATION_REQUIRES_PREMIUM,
  GROUP_ERROR_CODES,
  GROUP_MAX_MEMBERS,
  GROUP_MAX_ROLE_SLOTS,
  GroupError,
  openSlots,
  validateGroupInput,
  validateGroupUpdate,
} from './groups';

import type { GroupInput } from './types';

const input = (overrides: Partial<GroupInput> = {}): GroupInput => ({
  name: 'Taller Abierto',
  description: 'Un marketplace para talleres pequeños.',
  roles: [{ specialty: 'dev', slots: 2 }],
  ...overrides,
});

describe('reglas de los grupos', () => {
  it('crear un grupo es gratis por ahora, y caben seis personas contando al admin', () => {
    expect(GROUP_CREATION_REQUIRES_PREMIUM).toBe(false);
    expect(GROUP_MAX_MEMBERS).toBe(6);
    expect(GROUP_MAX_ROLE_SLOTS).toBe(5);
  });

  it('acepta un grupo bien formado', () => {
    expect(validateGroupInput(input())).toBeNull();
    expect(
      validateGroupInput(
        input({
          roles: [
            { specialty: 'dev', slots: 3 },
            { specialty: 'diseno', slots: 2 },
          ],
        })
      )
    ).toBeNull();
  });

  it.each<[string, Partial<GroupInput>]>([
    ['nombre corto', { name: ' a ' }],
    ['nombre largo', { name: 'x'.repeat(61) }],
    ['descripción corta', { description: 'poco' }],
    ['descripción larga', { description: 'x'.repeat(501) }],
    ['sin puestos', { roles: [] }],
    [
      'puesto repetido',
      {
        roles: [
          { specialty: 'dev', slots: 1 },
          { specialty: 'dev', slots: 1 },
        ],
      },
    ],
    ['plazas a cero', { roles: [{ specialty: 'dev', slots: 0 }] }],
    ['plazas con decimales', { roles: [{ specialty: 'dev', slots: 1.5 }] }],
    ['más plazas que sitio', { roles: [{ specialty: 'dev', slots: 6 }] }],
    [
      'plazas que no caben en un grupo pequeño',
      { maxMembers: 2, roles: [{ specialty: 'dev', slots: 2 }] },
    ],
    ['más de seis miembros', { maxMembers: 7 }],
    ['un solo miembro', { maxMembers: 1 }],
  ])('rechaza %s', (_, overrides) => {
    const error = validateGroupInput(input(overrides));
    expect(error).toBeInstanceOf(GroupError);
    expect(error?.reason).toBe('invalid');
  });

  it('al editar, no se quita un perfil ocupado ni se baja de quien ya está', () => {
    const current = {
      maxMembers: 6,
      roles: [
        { specialty: 'dev' as const, filled: 2 },
        { specialty: 'diseno' as const, filled: 0 },
      ],
    };
    expect(
      validateGroupUpdate(input({ roles: [{ specialty: 'dev', slots: 2 }] }), current)
    ).toBeNull();
    expect(
      validateGroupUpdate(input({ roles: [{ specialty: 'dev', slots: 1 }] }), current)?.reason
    ).toBe('invalid');
    expect(
      validateGroupUpdate(input({ roles: [{ specialty: 'diseno', slots: 1 }] }), current)?.reason
    ).toBe('invalid');
    // El aforo es el del grupo, no el de un grupo nuevo.
    expect(
      validateGroupUpdate(input({ roles: [{ specialty: 'dev', slots: 3 }] }), {
        ...current,
        maxMembers: 3,
      })?.reason
    ).toBe('invalid');
  });

  it('cuenta las plazas libres sin bajar de cero', () => {
    expect(openSlots({ slots: 2, filled: 1 })).toBe(1);
    expect(openSlots({ slots: 1, filled: 3 })).toBe(0);
  });

  it('elige el primer puesto abierto que encaja, o ninguno', () => {
    const roles = [
      { id: 'full', specialty: 'dev' as const, slots: 1, filled: 1 },
      { id: 'design', specialty: 'diseno' as const, slots: 1, filled: 0 },
      { id: 'legal', specialty: 'legal' as const, slots: 2, filled: 0 },
    ];
    expect(firstOpenRoleFor(roles, ['dev', 'legal', 'diseno'])?.id).toBe('design');
    expect(firstOpenRoleFor(roles, ['dev'])).toBeNull();
    expect(firstOpenRoleFor(roles, [])).toBeNull();
  });

  it('cada código del servidor tiene su motivo', () => {
    expect(GROUP_ERROR_CODES).toEqual({
      LG001: 'invalid',
      LG002: 'already-in-group',
      LG003: 'unavailable',
      LG004: 'admin-only',
      LG005: 'candidate-unavailable',
    });
    expect(new GroupError('unavailable', 'x').name).toBe('GroupError');
  });
});
