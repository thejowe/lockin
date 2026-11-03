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
  AL: ['Europe/Tirane'],
  AM: ['Asia/Yerevan'],
  AO: ['Africa/Luanda'],
  AR: ['America/Argentina/Buenos_Aires'],
  AT: ['Europe/Vienna'],
  AU: [
    'Australia/Sydney',
    'Australia/Brisbane',
    'Australia/Adelaide',
    'Australia/Darwin',
    'Australia/Perth',
  ],
  AZ: ['Asia/Baku'],
  BA: ['Europe/Sarajevo'],
  BE: ['Europe/Brussels'],
  BG: ['Europe/Sofia'],
  BO: ['America/La_Paz'],
  BR: ['America/Sao_Paulo', 'America/Manaus', 'America/Rio_Branco', 'America/Noronha'],
  BY: ['Europe/Minsk'],
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
  ],
  CH: ['Europe/Zurich'],
  CI: ['Africa/Abidjan'],
  CL: ['America/Santiago', 'Pacific/Easter'],
  CN: ['Asia/Shanghai'],
  CO: ['America/Bogota'],
  CR: ['America/Costa_Rica'],
  CU: ['America/Havana'],
  CY: ['Asia/Nicosia'],
  CZ: ['Europe/Prague'],
  DE: ['Europe/Berlin'],
  DK: ['Europe/Copenhagen'],
  DO: ['America/Santo_Domingo'],
  DZ: ['Africa/Algiers'],
  EC: ['America/Guayaquil', 'Pacific/Galapagos'],
  EE: ['Europe/Tallinn'],
  EG: ['Africa/Cairo'],
  ES: ['Europe/Madrid', 'Atlantic/Canary'],
  ET: ['Africa/Addis_Ababa'],
  FI: ['Europe/Helsinki'],
  FR: ['Europe/Paris'],
  GB: ['Europe/London'],
  GE: ['Asia/Tbilisi'],
  GH: ['Africa/Accra'],
  GI: ['Europe/Gibraltar'],
  GQ: ['Africa/Malabo'],
  GR: ['Europe/Athens'],
  GT: ['America/Guatemala'],
  HN: ['America/Tegucigalpa'],
  HR: ['Europe/Zagreb'],
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
  KR: ['Asia/Seoul'],
  KW: ['Asia/Kuwait'],
  KZ: ['Asia/Almaty'],
  LB: ['Asia/Beirut'],
  LI: ['Europe/Vaduz'],
  LT: ['Europe/Vilnius'],
  LU: ['Europe/Luxembourg'],
  LV: ['Europe/Riga'],
  LY: ['Africa/Tripoli'],
  MA: ['Africa/Casablanca'],
  MC: ['Europe/Monaco'],
  MD: ['Europe/Chisinau'],
  ME: ['Europe/Podgorica'],
  MK: ['Europe/Skopje'],
  ML: ['Africa/Bamako'],
  MT: ['Europe/Malta'],
  MX: ['America/Mexico_City', 'America/Cancun', 'America/Mazatlan', 'America/Tijuana'],
  MY: ['Asia/Kuala_Lumpur'],
  MZ: ['Africa/Maputo'],
  NG: ['Africa/Lagos'],
  NI: ['America/Managua'],
  NL: ['Europe/Amsterdam'],
  NO: ['Europe/Oslo'],
  NZ: ['Pacific/Auckland'],
  PA: ['America/Panama'],
  PE: ['America/Lima'],
  PH: ['Asia/Manila'],
  PK: ['Asia/Karachi'],
  PL: ['Europe/Warsaw'],
  PR: ['America/Puerto_Rico'],
  PT: ['Europe/Lisbon', 'Atlantic/Azores'],
  PY: ['America/Asuncion'],
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
  ],
  SA: ['Asia/Riyadh'],
  SE: ['Europe/Stockholm'],
  SG: ['Asia/Singapore'],
  SI: ['Europe/Ljubljana'],
  SK: ['Europe/Bratislava'],
  SN: ['Africa/Dakar'],
  SV: ['America/El_Salvador'],
  SY: ['Asia/Damascus'],
  TD: ['Africa/Ndjamena'],
  TH: ['Asia/Bangkok'],
  TN: ['Africa/Tunis'],
  TR: ['Europe/Istanbul'],
  TW: ['Asia/Taipei'],
  // `Europe/Kiev` y no `Europe/Kyiv`: el ICU de algunos Android aún no conoce el nuevo.
  UA: ['Europe/Kiev'],
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
  VE: ['America/Caracas'],
  VN: ['Asia/Ho_Chi_Minh'],
  ZA: ['Africa/Johannesburg'],
};

/**
 * Nombres antiguos o alias que pueden venir del dispositivo o de perfiles viejos.
 * También zonas regionales con las mismas reglas que una de la lista (Detroit
 * cambia de hora igual que Nueva York), para que su país se reconozca.
 */
const TIMEZONE_ALIASES: Readonly<Record<string, string>> = {
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
