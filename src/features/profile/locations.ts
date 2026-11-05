/**
 * Dónde vive la persona: país de la lista, ciudad escrita a mano y, del país,
 * la zona horaria (2026-11-03).
 *
 * La lista de países es la del prefijo telefónico (`countries.ts`), con los
 * nombres en el idioma de la app. Cada país lleva sus zonas IANA: la primera es
 * la de la capital. Los que tienen más de una (EE. UU., Brasil, México…)
 * enseñan un selector de zona; los demás la fijan solos.
 *
 * En `Profile` sigue habiendo `location` en texto («Barcelona, España») y
 * `timezone`: el país no se guarda aparte, se deduce de la zona al editar.
 */

import { getIntlLocale, sameTextInAllLocales, t } from '@/i18n';

import { COUNTRIES, type Country } from './countries';
import { timezoneCity } from './day-strip';

/** Zonas de cada país (ISO 3166-1 alfa-2). La primera es la de por defecto. */
export const COUNTRY_TIMEZONES: Readonly<Record<string, readonly string[]>> = {
  AD: ['Europe/Andorra'],
  AE: ['Asia/Dubai'],
  AF: ['Asia/Kabul'],
  AG: ['America/Antigua'],
  AI: ['America/Anguilla'],
  AL: ['Europe/Tirane'],
  AM: ['Asia/Yerevan'],
  AO: ['Africa/Luanda'],
  AR: ['America/Argentina/Buenos_Aires'],
  AS: ['Pacific/Pago_Pago'],
  AT: ['Europe/Vienna'],
  AU: [
    'Australia/Sydney',
    'Australia/Brisbane',
    'Australia/Adelaide',
    'Australia/Darwin',
    'Australia/Perth',
    // Reglas propias: con un alias, guardar el perfil les movería la hora.
    'Australia/Eucla',
    'Australia/Lord_Howe',
  ],
  AW: ['America/Aruba'],
  AZ: ['Asia/Baku'],
  BA: ['Europe/Sarajevo'],
  BB: ['America/Barbados'],
  BD: ['Asia/Dhaka'],
  BE: ['Europe/Brussels'],
  BF: ['Africa/Ouagadougou'],
  BG: ['Europe/Sofia'],
  BH: ['Asia/Bahrain'],
  BI: ['Africa/Bujumbura'],
  BJ: ['Africa/Porto-Novo'],
  BL: ['America/St_Barthelemy'],
  BM: ['Atlantic/Bermuda'],
  BN: ['Asia/Brunei'],
  BO: ['America/La_Paz'],
  BQ: ['America/Kralendijk'],
  BR: ['America/Sao_Paulo', 'America/Manaus', 'America/Rio_Branco', 'America/Noronha'],
  BS: ['America/Nassau'],
  BT: ['Asia/Thimphu'],
  BW: ['Africa/Gaborone'],
  BY: ['Europe/Minsk'],
  BZ: ['America/Belize'],
  CA: [
    'America/Toronto',
    'America/Vancouver',
    'America/Edmonton',
    'America/Winnipeg',
    // Saskatchewan y Yukón no cambian de hora: no valen Winnipeg ni Edmonton.
    'America/Regina',
    'America/Whitehorse',
    'America/Halifax',
    'America/St_Johns',
    // No cambian de hora: Toronto y Halifax les darían otra hora medio año.
    'America/Atikokan',
    'America/Coral_Harbour',
    'America/Blanc-Sablon',
  ],
  CD: ['Africa/Kinshasa', 'Africa/Lubumbashi'],
  CF: ['Africa/Bangui'],
  CG: ['Africa/Brazzaville'],
  CH: ['Europe/Zurich'],
  CI: ['Africa/Abidjan'],
  CK: ['Pacific/Rarotonga'],
  CL: ['America/Santiago', 'Pacific/Easter', 'America/Punta_Arenas'],
  CM: ['Africa/Douala'],
  // Urumqi va en UTC+6, dos horas por detrás de Shanghái.
  CN: ['Asia/Shanghai', 'Asia/Urumqi'],
  CO: ['America/Bogota'],
  CR: ['America/Costa_Rica'],
  CU: ['America/Havana'],
  CV: ['Atlantic/Cape_Verde'],
  CW: ['America/Curacao'],
  CY: ['Asia/Nicosia'],
  CZ: ['Europe/Prague'],
  DE: ['Europe/Berlin'],
  DJ: ['Africa/Djibouti'],
  DK: ['Europe/Copenhagen'],
  DM: ['America/Dominica'],
  DO: ['America/Santo_Domingo'],
  DZ: ['Africa/Algiers'],
  EC: ['America/Guayaquil', 'Pacific/Galapagos'],
  EE: ['Europe/Tallinn'],
  EG: ['Africa/Cairo'],
  ER: ['Africa/Asmera'],
  ES: ['Europe/Madrid', 'Atlantic/Canary'],
  ET: ['Africa/Addis_Ababa'],
  FI: ['Europe/Helsinki'],
  FJ: ['Pacific/Fiji'],
  FK: ['Atlantic/Stanley'],
  FM: ['Pacific/Ponape', 'Pacific/Truk'],
  FO: ['Atlantic/Faeroe'],
  FR: ['Europe/Paris'],
  GA: ['Africa/Libreville'],
  GB: ['Europe/London'],
  GD: ['America/Grenada'],
  GE: ['Asia/Tbilisi'],
  GF: ['America/Cayenne'],
  GH: ['Africa/Accra'],
  GI: ['Europe/Gibraltar'],
  GL: ['America/Godthab', 'America/Danmarkshavn', 'America/Thule'],
  GM: ['Africa/Banjul'],
  GN: ['Africa/Conakry'],
  GP: ['America/Guadeloupe'],
  GQ: ['Africa/Malabo'],
  GR: ['Europe/Athens'],
  GT: ['America/Guatemala'],
  GU: ['Pacific/Guam'],
  GW: ['Africa/Bissau'],
  GY: ['America/Guyana'],
  HK: ['Asia/Hong_Kong'],
  HN: ['America/Tegucigalpa'],
  HR: ['Europe/Zagreb'],
  HT: ['America/Port-au-Prince'],
  HU: ['Europe/Budapest'],
  ID: ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'],
  IE: ['Europe/Dublin'],
  IL: ['Asia/Jerusalem'],
  IN: ['Asia/Kolkata'],
  IQ: ['Asia/Baghdad'],
  IR: ['Asia/Tehran'],
  IS: ['Atlantic/Reykjavik'],
  IT: ['Europe/Rome'],
  JM: ['America/Jamaica'],
  JO: ['Asia/Amman'],
  JP: ['Asia/Tokyo'],
  KE: ['Africa/Nairobi'],
  KG: ['Asia/Bishkek'],
  KH: ['Asia/Phnom_Penh'],
  KI: ['Pacific/Tarawa', 'Pacific/Enderbury', 'Pacific/Kiritimati'],
  KM: ['Indian/Comoro'],
  KN: ['America/St_Kitts'],
  KP: ['Asia/Pyongyang'],
  KR: ['Asia/Seoul'],
  KW: ['Asia/Kuwait'],
  KY: ['America/Cayman'],
  KZ: ['Asia/Almaty'],
  LA: ['Asia/Vientiane'],
  LB: ['Asia/Beirut'],
  LC: ['America/St_Lucia'],
  LI: ['Europe/Vaduz'],
  LK: ['Asia/Colombo'],
  LR: ['Africa/Monrovia'],
  LS: ['Africa/Maseru'],
  LT: ['Europe/Vilnius'],
  LU: ['Europe/Luxembourg'],
  LV: ['Europe/Riga'],
  LY: ['Africa/Tripoli'],
  MA: ['Africa/Casablanca'],
  MC: ['Europe/Monaco'],
  MD: ['Europe/Chisinau'],
  ME: ['Europe/Podgorica'],
  MF: ['America/Marigot'],
  MG: ['Indian/Antananarivo'],
  MH: ['Pacific/Majuro'],
  MK: ['Europe/Skopje'],
  ML: ['Africa/Bamako'],
  MM: ['Asia/Rangoon'],
  MN: ['Asia/Ulaanbaatar', 'Asia/Hovd'],
  MO: ['Asia/Macau'],
  MP: ['Pacific/Saipan'],
  MQ: ['America/Martinique'],
  MR: ['Africa/Nouakchott'],
  MS: ['America/Montserrat'],
  MT: ['Europe/Malta'],
  MU: ['Indian/Mauritius'],
  MV: ['Indian/Maldives'],
  MW: ['Africa/Blantyre'],
  MX: [
    'America/Mexico_City',
    'America/Cancun',
    'America/Mazatlan',
    'America/Tijuana',
    'America/Matamoros',
    'America/Ciudad_Juarez',
  ],
  MY: ['Asia/Kuala_Lumpur'],
  MZ: ['Africa/Maputo'],
  NA: ['Africa/Windhoek'],
  NC: ['Pacific/Noumea'],
  NE: ['Africa/Niamey'],
  NF: ['Pacific/Norfolk'],
  NG: ['Africa/Lagos'],
  NI: ['America/Managua'],
  NL: ['Europe/Amsterdam'],
  NO: ['Europe/Oslo'],
  NP: ['Asia/Katmandu'],
  NR: ['Pacific/Nauru'],
  NU: ['Pacific/Niue'],
  NZ: ['Pacific/Auckland', 'Pacific/Chatham'],
  OM: ['Asia/Muscat'],
  PA: ['America/Panama'],
  PE: ['America/Lima'],
  PF: ['Pacific/Tahiti', 'Pacific/Marquesas', 'Pacific/Gambier'],
  PG: ['Pacific/Port_Moresby', 'Pacific/Bougainville'],
  PH: ['Asia/Manila'],
  PK: ['Asia/Karachi'],
  PL: ['Europe/Warsaw'],
  PM: ['America/Miquelon'],
  PR: ['America/Puerto_Rico'],
  PS: ['Asia/Hebron'],
  PT: ['Europe/Lisbon', 'Atlantic/Azores'],
  PW: ['Pacific/Palau'],
  PY: ['America/Asuncion'],
  QA: ['Asia/Qatar'],
  RE: ['Indian/Reunion'],
  RO: ['Europe/Bucharest'],
  RS: ['Europe/Belgrade'],
  RU: [
    'Europe/Moscow',
    'Europe/Kaliningrad',
    'Europe/Samara',
    'Asia/Yekaterinburg',
    'Asia/Novosibirsk',
    'Asia/Krasnoyarsk',
    'Asia/Irkutsk',
    'Asia/Vladivostok',
    'Asia/Omsk',
    'Asia/Yakutsk',
    'Asia/Magadan',
    'Asia/Kamchatka',
  ],
  RW: ['Africa/Kigali'],
  SA: ['Asia/Riyadh'],
  SB: ['Pacific/Guadalcanal'],
  SC: ['Indian/Mahe'],
  SD: ['Africa/Khartoum'],
  SE: ['Europe/Stockholm'],
  SG: ['Asia/Singapore'],
  SH: ['Atlantic/St_Helena'],
  SI: ['Europe/Ljubljana'],
  SK: ['Europe/Bratislava'],
  SL: ['Africa/Freetown'],
  SM: ['Europe/San_Marino'],
  SN: ['Africa/Dakar'],
  SO: ['Africa/Mogadishu'],
  SR: ['America/Paramaribo'],
  SS: ['Africa/Juba'],
  ST: ['Africa/Sao_Tome'],
  SV: ['America/El_Salvador'],
  SX: ['America/Lower_Princes'],
  SY: ['Asia/Damascus'],
  SZ: ['Africa/Mbabane'],
  TC: ['America/Grand_Turk'],
  TD: ['Africa/Ndjamena'],
  TG: ['Africa/Lome'],
  TH: ['Asia/Bangkok'],
  TJ: ['Asia/Dushanbe'],
  TK: ['Pacific/Fakaofo'],
  TL: ['Asia/Dili'],
  TM: ['Asia/Ashgabat'],
  TN: ['Africa/Tunis'],
  TO: ['Pacific/Tongatapu'],
  TR: ['Europe/Istanbul'],
  TT: ['America/Port_of_Spain'],
  TV: ['Pacific/Funafuti'],
  TW: ['Asia/Taipei'],
  TZ: ['Africa/Dar_es_Salaam'],
  // `Europe/Kiev` y no `Europe/Kyiv`: el ICU de algunos Android aún no conoce el nuevo.
  UA: ['Europe/Kiev'],
  UG: ['Africa/Kampala'],
  US: [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Phoenix',
    'America/Los_Angeles',
    'America/Anchorage',
    'America/Adak',
    'Pacific/Honolulu',
  ],
  UY: ['America/Montevideo'],
  UZ: ['Asia/Tashkent'],
  VC: ['America/St_Vincent'],
  VE: ['America/Caracas'],
  VG: ['America/Tortola'],
  VI: ['America/St_Thomas'],
  VN: ['Asia/Ho_Chi_Minh'],
  VU: ['Pacific/Efate'],
  WF: ['Pacific/Wallis'],
  WS: ['Pacific/Apia'],
  YE: ['Asia/Aden'],
  YT: ['Indian/Mayotte'],
  ZA: ['Africa/Johannesburg'],
  ZM: ['Africa/Lusaka'],
  ZW: ['Africa/Harare'],
};

/**
 * Nombres antiguos o alias que pueden venir del dispositivo o de perfiles viejos.
 * También zonas regionales con las mismas reglas que una de la lista (Detroit
 * cambia de hora igual que Nueva York), para que su país se reconozca.
 *
 * Un alias NUNCA puede cambiar la hora: al editar el perfil se guarda la zona
 * de destino. Una zona con reglas propias va en `COUNTRY_TIMEZONES`, no aquí.
 */
export const TIMEZONE_ALIASES: Readonly<Record<string, string>> = {
  'America/Detroit': 'America/New_York',
  'America/Indiana/Indianapolis': 'America/New_York',
  'America/Kentucky/Louisville': 'America/New_York',
  'America/Indiana/Knox': 'America/Chicago',
  'America/Menominee': 'America/Chicago',
  'America/Boise': 'America/Denver',
  'America/Juneau': 'America/Anchorage',
  'America/Montreal': 'America/Toronto',
  'America/Moncton': 'America/Halifax',
  'Australia/Melbourne': 'Australia/Sydney',
  'Australia/Hobart': 'Australia/Sydney',
  'Europe/Kyiv': 'Europe/Kiev',
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'America/Buenos_Aires': 'America/Argentina/Buenos_Aires',
  'Africa/Ceuta': 'Europe/Madrid',
  'Atlantic/Madeira': 'Europe/Lisbon',
  // Nombres nuevos de zonas que la lista guarda con el antiguo (el ICU de
  // algunos Android aún no conoce el nuevo, como con Kiev).
  'Asia/Kathmandu': 'Asia/Katmandu',
  'Asia/Yangon': 'Asia/Rangoon',
  'Africa/Asmara': 'Africa/Asmera',
  'Atlantic/Faroe': 'Atlantic/Faeroe',
  'America/Nuuk': 'America/Godthab',
  'Pacific/Pohnpei': 'Pacific/Ponape',
  'Pacific/Chuuk': 'Pacific/Truk',
  'Pacific/Kanton': 'Pacific/Enderbury',
  'Asia/Macao': 'Asia/Macau',
  'America/Indianapolis': 'America/New_York',
  'America/Louisville': 'America/New_York',
  // Zonas regionales con la misma hora que una de su país.
  'America/Indiana/Marengo': 'America/New_York',
  'America/Indiana/Petersburg': 'America/New_York',
  'America/Indiana/Vevay': 'America/New_York',
  'America/Indiana/Vincennes': 'America/New_York',
  'America/Indiana/Winamac': 'America/New_York',
  'America/Kentucky/Monticello': 'America/New_York',
  'America/Indiana/Tell_City': 'America/Chicago',
  'America/North_Dakota/Beulah': 'America/Chicago',
  'America/North_Dakota/Center': 'America/Chicago',
  'America/North_Dakota/New_Salem': 'America/Chicago',
  'America/Metlakatla': 'America/Anchorage',
  'America/Nome': 'America/Anchorage',
  'America/Sitka': 'America/Anchorage',
  'America/Yakutat': 'America/Anchorage',
  'America/Cambridge_Bay': 'America/Edmonton',
  'America/Inuvik': 'America/Edmonton',
  'America/Iqaluit': 'America/Toronto',
  'America/Rankin_Inlet': 'America/Winnipeg',
  'America/Resolute': 'America/Winnipeg',
  'America/Swift_Current': 'America/Regina',
  // Columbia Británica del noreste y el Yukón: UTC−7 todo el año.
  'America/Creston': 'America/Whitehorse',
  'America/Dawson': 'America/Whitehorse',
  'America/Dawson_Creek': 'America/Whitehorse',
  'America/Fort_Nelson': 'America/Whitehorse',
  'America/Glace_Bay': 'America/Halifax',
  'America/Goose_Bay': 'America/Halifax',
  'America/Bahia_Banderas': 'America/Mexico_City',
  'America/Chihuahua': 'America/Mexico_City',
  'America/Merida': 'America/Mexico_City',
  'America/Monterrey': 'America/Mexico_City',
  'America/Hermosillo': 'America/Mazatlan',
  'America/Ojinaga': 'America/Matamoros',
  'America/Araguaina': 'America/Sao_Paulo',
  'America/Bahia': 'America/Sao_Paulo',
  'America/Belem': 'America/Sao_Paulo',
  'America/Fortaleza': 'America/Sao_Paulo',
  'America/Maceio': 'America/Sao_Paulo',
  'America/Recife': 'America/Sao_Paulo',
  'America/Santarem': 'America/Sao_Paulo',
  'America/Boa_Vista': 'America/Manaus',
  'America/Campo_Grande': 'America/Manaus',
  'America/Cuiaba': 'America/Manaus',
  'America/Porto_Velho': 'America/Manaus',
  'America/Eirunepe': 'America/Rio_Branco',
  'America/Catamarca': 'America/Argentina/Buenos_Aires',
  'America/Cordoba': 'America/Argentina/Buenos_Aires',
  'America/Jujuy': 'America/Argentina/Buenos_Aires',
  'America/Mendoza': 'America/Argentina/Buenos_Aires',
  'America/Argentina/Catamarca': 'America/Argentina/Buenos_Aires',
  'America/Argentina/Cordoba': 'America/Argentina/Buenos_Aires',
  'America/Argentina/Jujuy': 'America/Argentina/Buenos_Aires',
  'America/Argentina/La_Rioja': 'America/Argentina/Buenos_Aires',
  'America/Argentina/Mendoza': 'America/Argentina/Buenos_Aires',
  'America/Argentina/Rio_Gallegos': 'America/Argentina/Buenos_Aires',
  'America/Argentina/Salta': 'America/Argentina/Buenos_Aires',
  'America/Argentina/San_Juan': 'America/Argentina/Buenos_Aires',
  'America/Argentina/San_Luis': 'America/Argentina/Buenos_Aires',
  'America/Argentina/Tucuman': 'America/Argentina/Buenos_Aires',
  'America/Argentina/Ushuaia': 'America/Argentina/Buenos_Aires',
  'America/Coyhaique': 'America/Punta_Arenas',
  'America/Scoresbysund': 'America/Godthab',
  'Australia/Broken_Hill': 'Australia/Adelaide',
  'Australia/Lindeman': 'Australia/Brisbane',
  'Asia/Pontianak': 'Asia/Jakarta',
  'Asia/Kuching': 'Asia/Kuala_Lumpur',
  'Asia/Famagusta': 'Asia/Nicosia',
  'Asia/Gaza': 'Asia/Hebron',
  'Asia/Samarkand': 'Asia/Tashkent',
  'Pacific/Kosrae': 'Pacific/Ponape',
  'Pacific/Kwajalein': 'Pacific/Majuro',
  // Kazajistán va entero a UTC+5 desde 2024.
  'Asia/Aqtau': 'Asia/Almaty',
  'Asia/Aqtobe': 'Asia/Almaty',
  'Asia/Atyrau': 'Asia/Almaty',
  'Asia/Oral': 'Asia/Almaty',
  'Asia/Qostanay': 'Asia/Almaty',
  'Asia/Qyzylorda': 'Asia/Almaty',
  'Europe/Kirov': 'Europe/Moscow',
  'Europe/Volgograd': 'Europe/Moscow',
  'Europe/Astrakhan': 'Europe/Samara',
  'Europe/Saratov': 'Europe/Samara',
  'Europe/Ulyanovsk': 'Europe/Samara',
  'Asia/Barnaul': 'Asia/Krasnoyarsk',
  'Asia/Novokuznetsk': 'Asia/Krasnoyarsk',
  'Asia/Tomsk': 'Asia/Krasnoyarsk',
  'Asia/Chita': 'Asia/Yakutsk',
  'Asia/Khandyga': 'Asia/Yakutsk',
  'Asia/Ust-Nera': 'Asia/Vladivostok',
  'Asia/Sakhalin': 'Asia/Magadan',
  'Asia/Srednekolymsk': 'Asia/Magadan',
  'Asia/Anadyr': 'Asia/Kamchatka',
  // Territorios que comparten hora y prefijo con su país.
  'Europe/Busingen': 'Europe/Berlin',
  'Europe/Guernsey': 'Europe/London',
  'Europe/Isle_of_Man': 'Europe/London',
  'Europe/Jersey': 'Europe/London',
  'Europe/Mariehamn': 'Europe/Helsinki',
  'Europe/Vatican': 'Europe/Rome',
  'Arctic/Longyearbyen': 'Europe/Oslo',
};

/** Las que no se leen bien con el nombre IANA. */
const ZONE_LABELS: Readonly<Record<string, string>> = {
  get 'Atlantic/Canary'() {
    return t('Canarias');
  },
  get 'Atlantic/Azores'() {
    return t('Azores');
  },
  get 'Pacific/Easter'() {
    return t('Isla de Pascua');
  },
  get 'Pacific/Galapagos'() {
    return t('Galápagos');
  },
  'America/Ciudad_Juarez': 'Ciudad Juárez',
  'Pacific/Ponape': 'Pohnpei',
  'Pacific/Truk': 'Chuuk',
  'Pacific/Enderbury': 'Kanton',
};

export function countryByIso(iso: string): Country | undefined {
  return COUNTRIES.find((country) => country.iso === iso);
}

export function timezonesOf(iso: string): readonly string[] {
  return COUNTRY_TIMEZONES[iso] ?? [];
}

/** Zona del dispositivo, o `undefined` si el runtime no la expone. */
export function deviceTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/** El país al que pertenece una zona, o `undefined` si no está en la lista. */
export function countryForTimezone(timezone: string): string | undefined {
  const zone = TIMEZONE_ALIASES[timezone] ?? timezone;
  return Object.keys(COUNTRY_TIMEZONES).find((iso) => COUNTRY_TIMEZONES[iso].includes(zone));
}

/**
 * La zona que toca al elegir un país: la del dispositivo si cae en ese país
 * (alguien de Chicago no tiene que buscar la suya), si no la de la capital.
 */
export function timezoneForCountry(iso: string, deviceZone?: string): string {
  const zones = timezonesOf(iso);
  const device = deviceZone ? (TIMEZONE_ALIASES[deviceZone] ?? deviceZone) : undefined;
  if (device && zones.includes(device)) return device;
  return zones[0] ?? '';
}

/** «New York», «Canarias»: cómo se enseña una zona en el selector. */
export function zoneLabel(timezone: string): string {
  return ZONE_LABELS[timezone] ?? timezoneCity(timezone);
}

/** Minúsculas y sin tildes: «España» y «espana» se encuentran igual. */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/[áàâäã]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[íìîï]/g, 'i')
    .replace(/[óòôöõ]/g, 'o')
    .replace(/[úùûü]/g, 'u')
    .replace(/ñ/g, 'n')
    .replace(/ç/g, 'c')
    .replace(/·/g, '')
    .trim();
}

/**
 * Países cuyo nombre (en el idioma de la app) empieza por `query`; detrás, los
 * que tienen una palabra que empieza por ella («unidos» → Estados Unidos).
 * Sin tildes ni mayúsculas. Vacío no devuelve nada: la lista aparece al escribir.
 */
export function searchCountries(query: string): Country[] {
  const needle = fold(query);
  if (!needle) return [];
  const locale = getIntlLocale();
  const byName = (a: Country, b: Country) => a.name.localeCompare(b.name, locale);

  const starts: Country[] = [];
  const words: Country[] = [];
  for (const country of COUNTRIES) {
    const name = fold(country.name);
    if (name.startsWith(needle)) starts.push(country);
    else if (name.split(/[\s\-']+/).some((word) => word.startsWith(needle))) words.push(country);
  }
  return [...starts.sort(byName), ...words.sort(byName)];
}

/** Lo que se guarda en `Profile.location`: «Barcelona, España». */
export function formatLocation(city: string, iso: string): string {
  const country = countryByIso(iso);
  const place = city.trim();
  return country ? `${place}, ${country.name}` : place;
}

/**
 * La ciudad de un `location` guardado: quita «, España» (o «, Spain»,
 * «, Espanya») si es el país. Un `location` antiguo sin país queda entero.
 */
export function cityFromLocation(location: string, iso: string): string {
  const country = countryByIso(iso);
  const comma = location.lastIndexOf(',');
  if (!country || comma === -1) return location.trim();
  const tail = fold(location.slice(comma + 1));
  // Se guardó en el idioma que tuviera la app entonces, que puede no ser el de ahora.
  const names = sameTextInAllLocales(country.name).map(fold);
  return names.includes(tail) ? location.slice(0, comma).trim() : location.trim();
}
