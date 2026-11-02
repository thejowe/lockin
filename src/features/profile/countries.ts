/**
 * Prefijos telefónicos internacionales para el selector del paso «Tu teléfono».
 *
 * `dial` va sin el `+`. La búsqueda es solo por dígitos: quien escribe `3` ve
 * todos los prefijos que empiezan por 3 (+30, +31, +32, +33, +34…).
 */

import { getIntlLocale, getLocale, t } from '@/i18n';

export interface Country {
  /** ISO 3166-1 alfa-2. */
  iso: string;
  name: string;
  /** Prefijo sin `+`: `34`, `1`, `44`… */
  dial: string;
}

export const DEFAULT_COUNTRY: Country = {
  iso: 'ES',
  get name() {
    return t('España');
  },
  dial: '34',
};

export const COUNTRIES: readonly Country[] = [
  {
    iso: 'AF',
    get name() {
      return t('Afganistán');
    },
    dial: '93',
  },
  {
    iso: 'AL',
    get name() {
      return t('Albania');
    },
    dial: '355',
  },
  {
    iso: 'DE',
    get name() {
      return t('Alemania');
    },
    dial: '49',
  },
  {
    iso: 'AD',
    get name() {
      return t('Andorra');
    },
    dial: '376',
  },
  {
    iso: 'AO',
    get name() {
      return t('Angola');
    },
    dial: '244',
  },
  {
    iso: 'SA',
    get name() {
      return t('Arabia Saudí');
    },
    dial: '966',
  },
  {
    iso: 'DZ',
    get name() {
      return t('Argelia');
    },
    dial: '213',
  },
  {
    iso: 'AR',
    get name() {
      return t('Argentina');
    },
    dial: '54',
  },
  {
    iso: 'AM',
    get name() {
      return t('Armenia');
    },
    dial: '374',
  },
  {
    iso: 'AU',
    get name() {
      return t('Australia');
    },
    dial: '61',
  },
  {
    iso: 'AT',
    get name() {
      return t('Austria');
    },
    dial: '43',
  },
  {
    iso: 'AZ',
    get name() {
      return t('Azerbaiyán');
    },
    dial: '994',
  },
  {
    iso: 'BE',
    get name() {
      return t('Bélgica');
    },
    dial: '32',
  },
  {
    iso: 'BY',
    get name() {
      return t('Bielorrusia');
    },
    dial: '375',
  },
  {
    iso: 'BO',
    get name() {
      return t('Bolivia');
    },
    dial: '591',
  },
  {
    iso: 'BA',
    get name() {
      return t('Bosnia y Herzegovina');
    },
    dial: '387',
  },
  {
    iso: 'BR',
    get name() {
      return t('Brasil');
    },
    dial: '55',
  },
  {
    iso: 'BG',
    get name() {
      return t('Bulgaria');
    },
    dial: '359',
  },
  {
    iso: 'CA',
    get name() {
      return t('Canadá');
    },
    dial: '1',
  },
  {
    iso: 'TD',
    get name() {
      return t('Chad');
    },
    dial: '235',
  },
  {
    iso: 'CL',
    get name() {
      return t('Chile');
    },
    dial: '56',
  },
  {
    iso: 'CN',
    get name() {
      return t('China');
    },
    dial: '86',
  },
  {
    iso: 'CY',
    get name() {
      return t('Chipre');
    },
    dial: '357',
  },
  {
    iso: 'CO',
    get name() {
      return t('Colombia');
    },
    dial: '57',
  },
  {
    iso: 'KR',
    get name() {
      return t('Corea del Sur');
    },
    dial: '82',
  },
  {
    iso: 'CR',
    get name() {
      return t('Costa Rica');
    },
    dial: '506',
  },
  {
    iso: 'CI',
    get name() {
      return t('Costa de Marfil');
    },
    dial: '225',
  },
  {
    iso: 'HR',
    get name() {
      return t('Croacia');
    },
    dial: '385',
  },
  {
    iso: 'CU',
    get name() {
      return t('Cuba');
    },
    dial: '53',
  },
  {
    iso: 'DK',
    get name() {
      return t('Dinamarca');
    },
    dial: '45',
  },
  {
    iso: 'EC',
    get name() {
      return t('Ecuador');
    },
    dial: '593',
  },
  {
    iso: 'EG',
    get name() {
      return t('Egipto');
    },
    dial: '20',
  },
  {
    iso: 'SV',
    get name() {
      return t('El Salvador');
    },
    dial: '503',
  },
  {
    iso: 'AE',
    get name() {
      return t('Emiratos Árabes Unidos');
    },
    dial: '971',
  },
  {
    iso: 'SK',
    get name() {
      return t('Eslovaquia');
    },
    dial: '421',
  },
  {
    iso: 'SI',
    get name() {
      return t('Eslovenia');
    },
    dial: '386',
  },
  {
    iso: 'ES',
    get name() {
      return t('España');
    },
    dial: '34',
  },
  {
    iso: 'US',
    get name() {
      return t('Estados Unidos');
    },
    dial: '1',
  },
  {
    iso: 'EE',
    get name() {
      return t('Estonia');
    },
    dial: '372',
  },
  {
    iso: 'ET',
    get name() {
      return t('Etiopía');
    },
    dial: '251',
  },
  {
    iso: 'PH',
    get name() {
      return t('Filipinas');
    },
    dial: '63',
  },
  {
    iso: 'FI',
    get name() {
      return t('Finlandia');
    },
    dial: '358',
  },
  {
    iso: 'FR',
    get name() {
      return t('Francia');
    },
    dial: '33',
  },
  {
    iso: 'GE',
    get name() {
      return t('Georgia');
    },
    dial: '995',
  },
  {
    iso: 'GH',
    get name() {
      return t('Ghana');
    },
    dial: '233',
  },
  {
    iso: 'GI',
    get name() {
      return t('Gibraltar');
    },
    dial: '350',
  },
  {
    iso: 'GR',
    get name() {
      return t('Grecia');
    },
    dial: '30',
  },
  {
    iso: 'GT',
    get name() {
      return t('Guatemala');
    },
    dial: '502',
  },
  {
    iso: 'GQ',
    get name() {
      return t('Guinea Ecuatorial');
    },
    dial: '240',
  },
  {
    iso: 'HN',
    get name() {
      return t('Honduras');
    },
    dial: '504',
  },
  {
    iso: 'HU',
    get name() {
      return t('Hungría');
    },
    dial: '36',
  },
  {
    iso: 'IN',
    get name() {
      return t('India');
    },
    dial: '91',
  },
  {
    iso: 'ID',
    get name() {
      return t('Indonesia');
    },
    dial: '62',
  },
  {
    iso: 'IQ',
    get name() {
      return t('Irak');
    },
    dial: '964',
  },
  {
    iso: 'IR',
    get name() {
      return t('Irán');
    },
    dial: '98',
  },
  {
    iso: 'IE',
    get name() {
      return t('Irlanda');
    },
    dial: '353',
  },
  {
    iso: 'IS',
    get name() {
      return t('Islandia');
    },
    dial: '354',
  },
  {
    iso: 'IL',
    get name() {
      return t('Israel');
    },
    dial: '972',
  },
  {
    iso: 'IT',
    get name() {
      return t('Italia');
    },
    dial: '39',
  },
  {
    iso: 'JM',
    get name() {
      return t('Jamaica');
    },
    dial: '1876',
  },
  {
    iso: 'JP',
    get name() {
      return t('Japón');
    },
    dial: '81',
  },
  {
    iso: 'JO',
    get name() {
      return t('Jordania');
    },
    dial: '962',
  },
  {
    iso: 'KZ',
    get name() {
      return t('Kazajistán');
    },
    dial: '7',
  },
  {
    iso: 'KE',
    get name() {
      return t('Kenia');
    },
    dial: '254',
  },
  {
    iso: 'KW',
    get name() {
      return t('Kuwait');
    },
    dial: '965',
  },
  {
    iso: 'LV',
    get name() {
      return t('Letonia');
    },
    dial: '371',
  },
  {
    iso: 'LB',
    get name() {
      return t('Líbano');
    },
    dial: '961',
  },
  {
    iso: 'LY',
    get name() {
      return t('Libia');
    },
    dial: '218',
  },
  {
    iso: 'LI',
    get name() {
      return t('Liechtenstein');
    },
    dial: '423',
  },
  {
    iso: 'LT',
    get name() {
      return t('Lituania');
    },
    dial: '370',
  },
  {
    iso: 'LU',
    get name() {
      return t('Luxemburgo');
    },
    dial: '352',
  },
  {
    iso: 'MK',
    get name() {
      return t('Macedonia del Norte');
    },
    dial: '389',
  },
  {
    iso: 'MY',
    get name() {
      return t('Malasia');
    },
    dial: '60',
  },
  {
    iso: 'ML',
    get name() {
      return t('Mali');
    },
    dial: '223',
  },
  {
    iso: 'MT',
    get name() {
      return t('Malta');
    },
    dial: '356',
  },
  {
    iso: 'MA',
    get name() {
      return t('Marruecos');
    },
    dial: '212',
  },
  {
    iso: 'MX',
    get name() {
      return t('México');
    },
    dial: '52',
  },
  {
    iso: 'MD',
    get name() {
      return t('Moldavia');
    },
    dial: '373',
  },
  {
    iso: 'MC',
    get name() {
      return t('Mónaco');
    },
    dial: '377',
  },
  {
    iso: 'ME',
    get name() {
      return t('Montenegro');
    },
    dial: '382',
  },
  {
    iso: 'MZ',
    get name() {
      return t('Mozambique');
    },
    dial: '258',
  },
  {
    iso: 'NI',
    get name() {
      return t('Nicaragua');
    },
    dial: '505',
  },
  {
    iso: 'NG',
    get name() {
      return t('Nigeria');
    },
    dial: '234',
  },
  {
    iso: 'NO',
    get name() {
      return t('Noruega');
    },
    dial: '47',
  },
  {
    iso: 'NZ',
    get name() {
      return t('Nueva Zelanda');
    },
    dial: '64',
  },
  {
    iso: 'NL',
    get name() {
      return t('Países Bajos');
    },
    dial: '31',
  },
  {
    iso: 'PK',
    get name() {
      return t('Pakistán');
    },
    dial: '92',
  },
  {
    iso: 'PA',
    get name() {
      return t('Panamá');
    },
    dial: '507',
  },
  {
    iso: 'PY',
    get name() {
      return t('Paraguay');
    },
    dial: '595',
  },
  {
    iso: 'PE',
    get name() {
      return t('Perú');
    },
    dial: '51',
  },
  {
    iso: 'PL',
    get name() {
      return t('Polonia');
    },
    dial: '48',
  },
  {
    iso: 'PT',
    get name() {
      return t('Portugal');
    },
    dial: '351',
  },
  {
    iso: 'PR',
    get name() {
      return t('Puerto Rico');
    },
    dial: '1787',
  },
  {
    iso: 'GB',
    get name() {
      return t('Reino Unido');
    },
    dial: '44',
  },
  {
    iso: 'CZ',
    get name() {
      return t('República Checa');
    },
    dial: '420',
  },
  {
    iso: 'DO',
    get name() {
      return t('República Dominicana');
    },
    dial: '1809',
  },
  {
    iso: 'RO',
    get name() {
      return t('Rumanía');
    },
    dial: '40',
  },
  {
    iso: 'RU',
    get name() {
      return t('Rusia');
    },
    dial: '7',
  },
  {
    iso: 'SN',
    get name() {
      return t('Senegal');
    },
    dial: '221',
  },
  {
    iso: 'RS',
    get name() {
      return t('Serbia');
    },
    dial: '381',
  },
  {
    iso: 'SG',
    get name() {
      return t('Singapur');
    },
    dial: '65',
  },
  {
    iso: 'SY',
    get name() {
      return t('Siria');
    },
    dial: '963',
  },
  {
    iso: 'ZA',
    get name() {
      return t('Sudáfrica');
    },
    dial: '27',
  },
  {
    iso: 'SE',
    get name() {
      return t('Suecia');
    },
    dial: '46',
  },
  {
    iso: 'CH',
    get name() {
      return t('Suiza');
    },
    dial: '41',
  },
  {
    iso: 'TH',
    get name() {
      return t('Tailandia');
    },
    dial: '66',
  },
  {
    iso: 'TW',
    get name() {
      return t('Taiwán');
    },
    dial: '886',
  },
  {
    iso: 'TN',
    get name() {
      return t('Túnez');
    },
    dial: '216',
  },
  {
    iso: 'TR',
    get name() {
      return t('Turquía');
    },
    dial: '90',
  },
  {
    iso: 'UA',
    get name() {
      return t('Ucrania');
    },
    dial: '380',
  },
  {
    iso: 'UY',
    get name() {
      return t('Uruguay');
    },
    dial: '598',
  },
  {
    iso: 'VE',
    get name() {
      return t('Venezuela');
    },
    dial: '58',
  },
  {
    iso: 'VN',
    get name() {
      return t('Vietnam');
    },
    dial: '84',
  },
];

/**
 * Países cuyo prefijo empieza por los dígitos de `query`. Sin dígitos devuelve
 * la lista entera. Todo lo que no sea un dígito se ignora, así que pegar
 * «+34» o escribir «3 4» funciona igual que «34».
 */
export function filterCountries(query: string): readonly Country[] {
  const digits = query.replace(/\D/g, '');
  const all = sortedCountries();
  if (!digits) return all;
  return all.filter((country) => country.dial.startsWith(digits));
}

/** Une prefijo y número nacional: («34», «600 123 456») → «+34600123456». */
export function joinPhone(country: Country, national: string): string {
  const raw = national.trim();
  // Si ya escribió el prefijo con `+`, se respeta tal cual.
  if (raw.startsWith('+')) return raw;
  return `+${country.dial}${raw}`;
}

/** La lista está escrita por orden en español; en otro idioma se ordena al pintarla. */
function sortedCountries(): readonly Country[] {
  if (getLocale() === 'es') return COUNTRIES;
  const locale = getIntlLocale();
  return [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name, locale));
}
