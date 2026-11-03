import { setLocalePreference } from '@/i18n';

import { COUNTRIES } from './countries';
import {
  COUNTRY_TIMEZONES,
  cityFromLocation,
  countryForTimezone,
  formatLocation,
  searchCountries,
  timezoneForCountry,
} from './locations';

afterEach(async () => {
  await setLocalePreference('auto');
});

describe('COUNTRY_TIMEZONES', () => {
  it('cada país de la lista tiene al menos una zona, y no sobra ninguno', () => {
    const isos = COUNTRIES.map((country) => country.iso);
    expect(isos.filter((iso) => !COUNTRY_TIMEZONES[iso]?.length)).toEqual([]);
    expect(Object.keys(COUNTRY_TIMEZONES).filter((iso) => !isos.includes(iso))).toEqual([]);
  });

  it('todas las zonas existen para Intl', () => {
    const zones = Object.values(COUNTRY_TIMEZONES).flat();
    for (const timeZone of zones) {
      expect(() => new Intl.DateTimeFormat('en-US', { timeZone })).not.toThrow();
    }
  });

  it('ninguna zona está en dos países', () => {
    const zones = Object.values(COUNTRY_TIMEZONES).flat();
    expect(new Set(zones).size).toBe(zones.length);
  });
});

describe('searchCountries', () => {
  it('con «es» salen los que empiezan así, en orden', () => {
    expect(searchCountries('es').map((country) => country.name)).toEqual([
      'Eslovaquia',
      'Eslovenia',
      'España',
      'Estados Unidos',
      'Estonia',
    ]);
  });

  it('sin tildes ni mayúsculas', () => {
    expect(searchCountries('ESPANA').map((country) => country.iso)).toEqual(['ES']);
    expect(searchCountries('peru').map((country) => country.iso)).toEqual(['PE']);
  });

  it('detrás, los que tienen una palabra que empieza así', () => {
    expect(searchCountries('unidos').map((country) => country.iso)).toEqual(['AE', 'US']);
  });

  it('vacío no devuelve nada', () => {
    expect(searchCountries('  ')).toEqual([]);
  });

  it('busca en el idioma de la app', async () => {
    await setLocalePreference('en');
    expect(searchCountries('spa').map((country) => country.name)).toEqual(['Spain']);
    await setLocalePreference('ca');
    expect(searchCountries('espa').map((country) => country.name)).toEqual(['Espanya']);
  });
});

describe('zona del país', () => {
  it('la del dispositivo si es de ese país; si no, la de la capital', () => {
    expect(timezoneForCountry('US', 'America/Chicago')).toBe('America/Chicago');
    expect(timezoneForCountry('US', 'Europe/Madrid')).toBe('America/New_York');
    expect(timezoneForCountry('US')).toBe('America/New_York');
    expect(timezoneForCountry('UA', 'Europe/Kyiv')).toBe('Europe/Kiev');
  });

  it('de la zona sale el país, alias incluidos', () => {
    expect(countryForTimezone('Europe/Madrid')).toBe('ES');
    expect(countryForTimezone('Atlantic/Canary')).toBe('ES');
    expect(countryForTimezone('Asia/Calcutta')).toBe('IN');
    expect(countryForTimezone('Asia/Kathmandu')).toBeUndefined();
  });

  it('reconoce zonas regionales: las de reglas propias se pueden elegir y las demás son alias', () => {
    // Saskatchewan no cambia de hora: Winnipeg o Toronto le darían otra hora media año.
    expect(countryForTimezone('America/Regina')).toBe('CA');
    expect(timezoneForCountry('CA', 'America/Regina')).toBe('America/Regina');
    // Detroit cambia de hora igual que Nueva York: se reconoce el país.
    expect(countryForTimezone('America/Detroit')).toBe('US');
    expect(timezoneForCountry('US', 'America/Detroit')).toBe('America/New_York');
    expect(countryForTimezone('Australia/Melbourne')).toBe('AU');
  });

  it('todas las zonas de la lista existen en este runtime', () => {
    for (const zones of Object.values(COUNTRY_TIMEZONES)) {
      for (const zone of zones) {
        expect(() => new Intl.DateTimeFormat('en', { timeZone: zone })).not.toThrow();
      }
    }
  });
});

describe('location', () => {
  it('se guarda como «ciudad, país» en el idioma de la app', async () => {
    expect(formatLocation(' Vigo ', 'ES')).toBe('Vigo, España');
    await setLocalePreference('en');
    expect(formatLocation('Vigo', 'ES')).toBe('Vigo, Spain');
  });

  it('la ciudad sale quitando el país, en el idioma que se guardara', async () => {
    expect(cityFromLocation('Vigo, España', 'ES')).toBe('Vigo');
    expect(cityFromLocation('Vigo, Spain', 'ES')).toBe('Vigo');
    await setLocalePreference('en');
    expect(cityFromLocation('Vigo, Espanya', 'ES')).toBe('Vigo');
  });

  it('un location antiguo sin país, o con otra cosa detrás de la coma, queda entero', () => {
    expect(cityFromLocation('Barcelona', 'ES')).toBe('Barcelona');
    expect(cityFromLocation('Austin, TX', 'US')).toBe('Austin, TX');
    expect(cityFromLocation('Vigo, España', '')).toBe('Vigo, España');
  });
});
