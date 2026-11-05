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
    iso: 'AI',
    get name() {
      return t('Anguila');
    },
    dial: '1264',
  },
  {
    iso: 'AG',
    get name() {
      return t('Antigua y Barbuda');
    },
    dial: '1268',
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
    iso: 'AW',
    get name() {
      return t('Aruba');
    },
    dial: '297',
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
    iso: 'BS',
    get name() {
      return t('Bahamas');
    },
    dial: '1242',
  },
  {
    iso: 'BD',
    get name() {
      return t('Bangladés');
    },
    dial: '880',
  },
  {
    iso: 'BB',
    get name() {
      return t('Barbados');
    },
    dial: '1246',
  },
  {
    iso: 'BH',
    get name() {
      return t('Baréin');
    },
    dial: '973',
  },
  {
    iso: 'BE',
    get name() {
      return t('Bélgica');
    },
    dial: '32',
  },
  {
    iso: 'BZ',
    get name() {
      return t('Belice');
    },
    dial: '501',
  },
  {
    iso: 'BJ',
    get name() {
      return t('Benín');
    },
    dial: '229',
  },
  {
    iso: 'BM',
    get name() {
      return t('Bermudas');
    },
    dial: '1441',
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
    iso: 'BW',
    get name() {
      return t('Botsuana');
    },
    dial: '267',
  },
  {
    iso: 'BR',
    get name() {
      return t('Brasil');
    },
    dial: '55',
  },
  {
    iso: 'BN',
    get name() {
      return t('Brunéi');
    },
    dial: '673',
  },
  {
    iso: 'BG',
    get name() {
      return t('Bulgaria');
    },
    dial: '359',
  },
  {
    iso: 'BF',
    get name() {
      return t('Burkina Faso');
    },
    dial: '226',
  },
  {
    iso: 'BI',
    get name() {
      return t('Burundi');
    },
    dial: '257',
  },
  {
    iso: 'BT',
    get name() {
      return t('Bután');
    },
    dial: '975',
  },
  {
    iso: 'CV',
    get name() {
      return t('Cabo Verde');
    },
    dial: '238',
  },
  {
    iso: 'KH',
    get name() {
      return t('Camboya');
    },
    dial: '855',
  },
  {
    iso: 'CM',
    get name() {
      return t('Camerún');
    },
    dial: '237',
  },
  {
    iso: 'CA',
    get name() {
      return t('Canadá');
    },
    dial: '1',
  },
  {
    iso: 'BQ',
    get name() {
      return t('Caribe neerlandés');
    },
    dial: '599',
  },
  {
    iso: 'QA',
    get name() {
      return t('Catar');
    },
    dial: '974',
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
    iso: 'KM',
    get name() {
      return t('Comoras');
    },
    dial: '269',
  },
  {
    iso: 'KP',
    get name() {
      return t('Corea del Norte');
    },
    dial: '850',
  },
  {
    iso: 'KR',
    get name() {
      return t('Corea del Sur');
    },
    dial: '82',
  },
  {
    iso: 'CI',
    get name() {
      return t('Costa de Marfil');
    },
    dial: '225',
  },
  {
    iso: 'CR',
    get name() {
      return t('Costa Rica');
    },
    dial: '506',
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
    iso: 'CW',
    get name() {
      return t('Curazao');
    },
    dial: '599',
  },
  {
    iso: 'DK',
    get name() {
      return t('Dinamarca');
    },
    dial: '45',
  },
  {
    iso: 'DM',
    get name() {
      return t('Dominica');
    },
    dial: '1767',
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
    iso: 'ER',
    get name() {
      return t('Eritrea');
    },
    dial: '291',
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
    iso: 'SZ',
    get name() {
      return t('Esuatini');
    },
    dial: '268',
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
    iso: 'FJ',
    get name() {
      return t('Fiyi');
    },
    dial: '679',
  },
  {
    iso: 'FR',
    get name() {
      return t('Francia');
    },
    dial: '33',
  },
  {
    iso: 'GA',
    get name() {
      return t('Gabón');
    },
    dial: '241',
  },
  {
    iso: 'GM',
    get name() {
      return t('Gambia');
    },
    dial: '220',
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
    iso: 'GD',
    get name() {
      return t('Granada');
    },
    dial: '1473',
  },
  {
    iso: 'GR',
    get name() {
      return t('Grecia');
    },
    dial: '30',
  },
  {
    iso: 'GL',
    get name() {
      return t('Groenlandia');
    },
    dial: '299',
  },
  {
    iso: 'GP',
    get name() {
      return t('Guadalupe');
    },
    dial: '590',
  },
  {
    iso: 'GU',
    get name() {
      return t('Guam');
    },
    dial: '1671',
  },
  {
    iso: 'GT',
    get name() {
      return t('Guatemala');
    },
    dial: '502',
  },
  {
    iso: 'GF',
    get name() {
      return t('Guayana Francesa');
    },
    dial: '594',
  },
  {
    iso: 'GN',
    get name() {
      return t('Guinea');
    },
    dial: '224',
  },
  {
    iso: 'GQ',
    get name() {
      return t('Guinea Ecuatorial');
    },
    dial: '240',
  },
  {
    iso: 'GW',
    get name() {
      return t('Guinea-Bisáu');
    },
    dial: '245',
  },
  {
    iso: 'GY',
    get name() {
      return t('Guyana');
    },
    dial: '592',
  },
  {
    iso: 'HT',
    get name() {
      return t('Haití');
    },
    dial: '509',
  },
  {
    iso: 'HN',
    get name() {
      return t('Honduras');
    },
    dial: '504',
  },
  {
    iso: 'HK',
    get name() {
      return t('Hong Kong');
    },
    dial: '852',
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
    iso: 'NF',
    get name() {
      return t('Isla Norfolk');
    },
    dial: '672',
  },
  {
    iso: 'IS',
    get name() {
      return t('Islandia');
    },
    dial: '354',
  },
  {
    iso: 'KY',
    get name() {
      return t('Islas Caimán');
    },
    dial: '1345',
  },
  {
    iso: 'CK',
    get name() {
      return t('Islas Cook');
    },
    dial: '682',
  },
  {
    iso: 'FO',
    get name() {
      return t('Islas Feroe');
    },
    dial: '298',
  },
  {
    iso: 'FK',
    get name() {
      return t('Islas Malvinas');
    },
    dial: '500',
  },
  {
    iso: 'MP',
    get name() {
      return t('Islas Marianas del Norte');
    },
    dial: '1670',
  },
  {
    iso: 'MH',
    get name() {
      return t('Islas Marshall');
    },
    dial: '692',
  },
  {
    iso: 'SB',
    get name() {
      return t('Islas Salomón');
    },
    dial: '677',
  },
  {
    iso: 'TC',
    get name() {
      return t('Islas Turcas y Caicos');
    },
    dial: '1649',
  },
  {
    iso: 'VG',
    get name() {
      return t('Islas Vírgenes Británicas');
    },
    dial: '1284',
  },
  {
    iso: 'VI',
    get name() {
      return t('Islas Vírgenes de EE. UU.');
    },
    dial: '1340',
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
    iso: 'KG',
    get name() {
      return t('Kirguistán');
    },
    dial: '996',
  },
  {
    iso: 'KI',
    get name() {
      return t('Kiribati');
    },
    dial: '686',
  },
  {
    iso: 'KW',
    get name() {
      return t('Kuwait');
    },
    dial: '965',
  },
  {
    iso: 'LA',
    get name() {
      return t('Laos');
    },
    dial: '856',
  },
  {
    iso: 'LS',
    get name() {
      return t('Lesoto');
    },
    dial: '266',
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
    iso: 'LR',
    get name() {
      return t('Liberia');
    },
    dial: '231',
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
    iso: 'MO',
    get name() {
      return t('Macao');
    },
    dial: '853',
  },
  {
    iso: 'MK',
    get name() {
      return t('Macedonia del Norte');
    },
    dial: '389',
  },
  {
    iso: 'MG',
    get name() {
      return t('Madagascar');
    },
    dial: '261',
  },
  {
    iso: 'MY',
    get name() {
      return t('Malasia');
    },
    dial: '60',
  },
  {
    iso: 'MW',
    get name() {
      return t('Malaui');
    },
    dial: '265',
  },
  {
    iso: 'MV',
    get name() {
      return t('Maldivas');
    },
    dial: '960',
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
    iso: 'MQ',
    get name() {
      return t('Martinica');
    },
    dial: '596',
  },
  {
    iso: 'MU',
    get name() {
      return t('Mauricio');
    },
    dial: '230',
  },
  {
    iso: 'MR',
    get name() {
      return t('Mauritania');
    },
    dial: '222',
  },
  {
    iso: 'YT',
    get name() {
      return t('Mayotte');
    },
    dial: '262',
  },
  {
    iso: 'MX',
    get name() {
      return t('México');
    },
    dial: '52',
  },
  {
    iso: 'FM',
    get name() {
      return t('Micronesia');
    },
    dial: '691',
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
    iso: 'MN',
    get name() {
      return t('Mongolia');
    },
    dial: '976',
  },
  {
    iso: 'ME',
    get name() {
      return t('Montenegro');
    },
    dial: '382',
  },
  {
    iso: 'MS',
    get name() {
      return t('Montserrat');
    },
    dial: '1664',
  },
  {
    iso: 'MZ',
    get name() {
      return t('Mozambique');
    },
    dial: '258',
  },
  {
    iso: 'MM',
    get name() {
      return t('Myanmar (Birmania)');
    },
    dial: '95',
  },
  {
    iso: 'NA',
    get name() {
      return t('Namibia');
    },
    dial: '264',
  },
  {
    iso: 'NR',
    get name() {
      return t('Nauru');
    },
    dial: '674',
  },
  {
    iso: 'NP',
    get name() {
      return t('Nepal');
    },
    dial: '977',
  },
  {
    iso: 'NI',
    get name() {
      return t('Nicaragua');
    },
    dial: '505',
  },
  {
    iso: 'NE',
    get name() {
      return t('Níger');
    },
    dial: '227',
  },
  {
    iso: 'NG',
    get name() {
      return t('Nigeria');
    },
    dial: '234',
  },
  {
    iso: 'NU',
    get name() {
      return t('Niue');
    },
    dial: '683',
  },
  {
    iso: 'NO',
    get name() {
      return t('Noruega');
    },
    dial: '47',
  },
  {
    iso: 'NC',
    get name() {
      return t('Nueva Caledonia');
    },
    dial: '687',
  },
  {
    iso: 'NZ',
    get name() {
      return t('Nueva Zelanda');
    },
    dial: '64',
  },
  {
    iso: 'OM',
    get name() {
      return t('Omán');
    },
    dial: '968',
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
    iso: 'PW',
    get name() {
      return t('Palaos');
    },
    dial: '680',
  },
  {
    iso: 'PS',
    get name() {
      return t('Palestina');
    },
    dial: '970',
  },
  {
    iso: 'PA',
    get name() {
      return t('Panamá');
    },
    dial: '507',
  },
  {
    iso: 'PG',
    get name() {
      return t('Papúa Nueva Guinea');
    },
    dial: '675',
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
    iso: 'PF',
    get name() {
      return t('Polinesia Francesa');
    },
    dial: '689',
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
    iso: 'CF',
    get name() {
      return t('República Centroafricana');
    },
    dial: '236',
  },
  {
    iso: 'CZ',
    get name() {
      return t('República Checa');
    },
    dial: '420',
  },
  {
    iso: 'CG',
    get name() {
      return t('República del Congo');
    },
    dial: '242',
  },
  {
    iso: 'CD',
    get name() {
      return t('República Democrática del Congo');
    },
    dial: '243',
  },
  {
    iso: 'DO',
    get name() {
      return t('República Dominicana');
    },
    dial: '1809',
  },
  {
    iso: 'RE',
    get name() {
      return t('Reunión');
    },
    dial: '262',
  },
  {
    iso: 'RW',
    get name() {
      return t('Ruanda');
    },
    dial: '250',
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
    iso: 'WS',
    get name() {
      return t('Samoa');
    },
    dial: '685',
  },
  {
    iso: 'AS',
    get name() {
      return t('Samoa Americana');
    },
    dial: '1684',
  },
  {
    iso: 'BL',
    get name() {
      return t('San Bartolomé');
    },
    dial: '590',
  },
  {
    iso: 'KN',
    get name() {
      return t('San Cristóbal y Nieves');
    },
    dial: '1869',
  },
  {
    iso: 'SM',
    get name() {
      return t('San Marino');
    },
    dial: '378',
  },
  {
    iso: 'MF',
    get name() {
      return t('San Martín');
    },
    dial: '590',
  },
  {
    iso: 'PM',
    get name() {
      return t('San Pedro y Miquelón');
    },
    dial: '508',
  },
  {
    iso: 'VC',
    get name() {
      return t('San Vicente y las Granadinas');
    },
    dial: '1784',
  },
  {
    iso: 'SH',
    get name() {
      return t('Santa Elena');
    },
    dial: '290',
  },
  {
    iso: 'LC',
    get name() {
      return t('Santa Lucía');
    },
    dial: '1758',
  },
  {
    iso: 'ST',
    get name() {
      return t('Santo Tomé y Príncipe');
    },
    dial: '239',
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
    iso: 'SC',
    get name() {
      return t('Seychelles');
    },
    dial: '248',
  },
  {
    iso: 'SL',
    get name() {
      return t('Sierra Leona');
    },
    dial: '232',
  },
  {
    iso: 'SG',
    get name() {
      return t('Singapur');
    },
    dial: '65',
  },
  {
    iso: 'SX',
    get name() {
      return t('Sint Maarten');
    },
    dial: '1721',
  },
  {
    iso: 'SY',
    get name() {
      return t('Siria');
    },
    dial: '963',
  },
  {
    iso: 'SO',
    get name() {
      return t('Somalia');
    },
    dial: '252',
  },
  {
    iso: 'LK',
    get name() {
      return t('Sri Lanka');
    },
    dial: '94',
  },
  {
    iso: 'ZA',
    get name() {
      return t('Sudáfrica');
    },
    dial: '27',
  },
  {
    iso: 'SD',
    get name() {
      return t('Sudán');
    },
    dial: '249',
  },
  {
    iso: 'SS',
    get name() {
      return t('Sudán del Sur');
    },
    dial: '211',
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
    iso: 'SR',
    get name() {
      return t('Surinam');
    },
    dial: '597',
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
    iso: 'TZ',
    get name() {
      return t('Tanzania');
    },
    dial: '255',
  },
  {
    iso: 'TJ',
    get name() {
      return t('Tayikistán');
    },
    dial: '992',
  },
  {
    iso: 'TL',
    get name() {
      return t('Timor Oriental');
    },
    dial: '670',
  },
  {
    iso: 'TG',
    get name() {
      return t('Togo');
    },
    dial: '228',
  },
  {
    iso: 'TK',
    get name() {
      return t('Tokelau');
    },
    dial: '690',
  },
  {
    iso: 'TO',
    get name() {
      return t('Tonga');
    },
    dial: '676',
  },
  {
    iso: 'TT',
    get name() {
      return t('Trinidad y Tobago');
    },
    dial: '1868',
  },
  {
    iso: 'TN',
    get name() {
      return t('Túnez');
    },
    dial: '216',
  },
  {
    iso: 'TM',
    get name() {
      return t('Turkmenistán');
    },
    dial: '993',
  },
  {
    iso: 'TR',
    get name() {
      return t('Turquía');
    },
    dial: '90',
  },
  {
    iso: 'TV',
    get name() {
      return t('Tuvalu');
    },
    dial: '688',
  },
  {
    iso: 'UA',
    get name() {
      return t('Ucrania');
    },
    dial: '380',
  },
  {
    iso: 'UG',
    get name() {
      return t('Uganda');
    },
    dial: '256',
  },
  {
    iso: 'UY',
    get name() {
      return t('Uruguay');
    },
    dial: '598',
  },
  {
    iso: 'UZ',
    get name() {
      return t('Uzbekistán');
    },
    dial: '998',
  },
  {
    iso: 'VU',
    get name() {
      return t('Vanuatu');
    },
    dial: '678',
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
  {
    iso: 'WF',
    get name() {
      return t('Wallis y Futuna');
    },
    dial: '681',
  },
  {
    iso: 'YE',
    get name() {
      return t('Yemen');
    },
    dial: '967',
  },
  {
    iso: 'DJ',
    get name() {
      return t('Yibuti');
    },
    dial: '253',
  },
  {
    iso: 'ZM',
    get name() {
      return t('Zambia');
    },
    dial: '260',
  },
  {
    iso: 'ZW',
    get name() {
      return t('Zimbabue');
    },
    dial: '263',
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
