import { COUNTRIES, DEFAULT_COUNTRY, filterCountries, joinPhone } from './countries';

describe('filterCountries', () => {
  it('sin dígitos devuelve todos', () => {
    expect(filterCountries('')).toHaveLength(COUNTRIES.length);
    expect(filterCountries('abc')).toHaveLength(COUNTRIES.length);
  });

  it('con un 3 salen solo prefijos que empiezan por 3', () => {
    const result = filterCountries('3');
    expect(result.length).toBeGreaterThan(5);
    expect(result.every((c) => c.dial.startsWith('3'))).toBe(true);
    expect(result.map((c) => c.dial)).toEqual(
      expect.arrayContaining(['30', '31', '32', '33', '34'])
    );
  });

  it('con 34 queda España', () => {
    expect(filterCountries('34').map((c) => c.iso)).toEqual(['ES']);
  });

  it('ignora el + y los espacios', () => {
    expect(filterCountries('+3 4').map((c) => c.iso)).toEqual(['ES']);
  });

  it('un prefijo inexistente no devuelve nada', () => {
    expect(filterCountries('999')).toEqual([]);
  });
});

describe('joinPhone', () => {
  it('une prefijo y número nacional', () => {
    expect(joinPhone(DEFAULT_COUNTRY, '600 123 456')).toBe('+34600 123 456');
  });

  it('respeta un número que ya trae +', () => {
    expect(joinPhone(DEFAULT_COUNTRY, '+44 7700 900123')).toBe('+44 7700 900123');
  });
});
