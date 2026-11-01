/**
 * Prefijos telefónicos internacionales para el selector del paso «Tu teléfono».
 *
 * `dial` va sin el `+`. La búsqueda es solo por dígitos: quien escribe `3` ve
 * todos los prefijos que empiezan por 3 (+30, +31, +32, +33, +34…).
 */

export interface Country {
  /** ISO 3166-1 alfa-2. */
  iso: string;
  name: string;
  /** Prefijo sin `+`: `34`, `1`, `44`… */
  dial: string;
}

export const DEFAULT_COUNTRY: Country = { iso: 'ES', name: 'España', dial: '34' };

export const COUNTRIES: readonly Country[] = [
  { iso: 'AF', name: 'Afganistán', dial: '93' },
  { iso: 'AL', name: 'Albania', dial: '355' },
  { iso: 'DE', name: 'Alemania', dial: '49' },
  { iso: 'AD', name: 'Andorra', dial: '376' },
  { iso: 'AO', name: 'Angola', dial: '244' },
  { iso: 'SA', name: 'Arabia Saudí', dial: '966' },
  { iso: 'DZ', name: 'Argelia', dial: '213' },
  { iso: 'AR', name: 'Argentina', dial: '54' },
  { iso: 'AM', name: 'Armenia', dial: '374' },
  { iso: 'AU', name: 'Australia', dial: '61' },
  { iso: 'AT', name: 'Austria', dial: '43' },
  { iso: 'AZ', name: 'Azerbaiyán', dial: '994' },
  { iso: 'BE', name: 'Bélgica', dial: '32' },
  { iso: 'BY', name: 'Bielorrusia', dial: '375' },
  { iso: 'BO', name: 'Bolivia', dial: '591' },
  { iso: 'BA', name: 'Bosnia y Herzegovina', dial: '387' },
  { iso: 'BR', name: 'Brasil', dial: '55' },
  { iso: 'BG', name: 'Bulgaria', dial: '359' },
  { iso: 'CA', name: 'Canadá', dial: '1' },
  { iso: 'TD', name: 'Chad', dial: '235' },
  { iso: 'CL', name: 'Chile', dial: '56' },
  { iso: 'CN', name: 'China', dial: '86' },
  { iso: 'CY', name: 'Chipre', dial: '357' },
  { iso: 'CO', name: 'Colombia', dial: '57' },
  { iso: 'KR', name: 'Corea del Sur', dial: '82' },
  { iso: 'CR', name: 'Costa Rica', dial: '506' },
  { iso: 'CI', name: 'Costa de Marfil', dial: '225' },
  { iso: 'HR', name: 'Croacia', dial: '385' },
  { iso: 'CU', name: 'Cuba', dial: '53' },
  { iso: 'DK', name: 'Dinamarca', dial: '45' },
  { iso: 'EC', name: 'Ecuador', dial: '593' },
  { iso: 'EG', name: 'Egipto', dial: '20' },
  { iso: 'SV', name: 'El Salvador', dial: '503' },
  { iso: 'AE', name: 'Emiratos Árabes Unidos', dial: '971' },
  { iso: 'SK', name: 'Eslovaquia', dial: '421' },
  { iso: 'SI', name: 'Eslovenia', dial: '386' },
  { iso: 'ES', name: 'España', dial: '34' },
  { iso: 'US', name: 'Estados Unidos', dial: '1' },
  { iso: 'EE', name: 'Estonia', dial: '372' },
  { iso: 'ET', name: 'Etiopía', dial: '251' },
  { iso: 'PH', name: 'Filipinas', dial: '63' },
  { iso: 'FI', name: 'Finlandia', dial: '358' },
  { iso: 'FR', name: 'Francia', dial: '33' },
  { iso: 'GE', name: 'Georgia', dial: '995' },
  { iso: 'GH', name: 'Ghana', dial: '233' },
  { iso: 'GI', name: 'Gibraltar', dial: '350' },
  { iso: 'GR', name: 'Grecia', dial: '30' },
  { iso: 'GT', name: 'Guatemala', dial: '502' },
  { iso: 'GQ', name: 'Guinea Ecuatorial', dial: '240' },
  { iso: 'HN', name: 'Honduras', dial: '504' },
  { iso: 'HU', name: 'Hungría', dial: '36' },
  { iso: 'IN', name: 'India', dial: '91' },
  { iso: 'ID', name: 'Indonesia', dial: '62' },
  { iso: 'IQ', name: 'Irak', dial: '964' },
  { iso: 'IR', name: 'Irán', dial: '98' },
  { iso: 'IE', name: 'Irlanda', dial: '353' },
  { iso: 'IS', name: 'Islandia', dial: '354' },
  { iso: 'IL', name: 'Israel', dial: '972' },
  { iso: 'IT', name: 'Italia', dial: '39' },
  { iso: 'JM', name: 'Jamaica', dial: '1876' },
  { iso: 'JP', name: 'Japón', dial: '81' },
  { iso: 'JO', name: 'Jordania', dial: '962' },
  { iso: 'KZ', name: 'Kazajistán', dial: '7' },
  { iso: 'KE', name: 'Kenia', dial: '254' },
  { iso: 'KW', name: 'Kuwait', dial: '965' },
  { iso: 'LV', name: 'Letonia', dial: '371' },
  { iso: 'LB', name: 'Líbano', dial: '961' },
  { iso: 'LY', name: 'Libia', dial: '218' },
  { iso: 'LI', name: 'Liechtenstein', dial: '423' },
  { iso: 'LT', name: 'Lituania', dial: '370' },
  { iso: 'LU', name: 'Luxemburgo', dial: '352' },
  { iso: 'MK', name: 'Macedonia del Norte', dial: '389' },
  { iso: 'MY', name: 'Malasia', dial: '60' },
  { iso: 'ML', name: 'Mali', dial: '223' },
  { iso: 'MT', name: 'Malta', dial: '356' },
  { iso: 'MA', name: 'Marruecos', dial: '212' },
  { iso: 'MX', name: 'México', dial: '52' },
  { iso: 'MD', name: 'Moldavia', dial: '373' },
  { iso: 'MC', name: 'Mónaco', dial: '377' },
  { iso: 'ME', name: 'Montenegro', dial: '382' },
  { iso: 'MZ', name: 'Mozambique', dial: '258' },
  { iso: 'NI', name: 'Nicaragua', dial: '505' },
  { iso: 'NG', name: 'Nigeria', dial: '234' },
  { iso: 'NO', name: 'Noruega', dial: '47' },
  { iso: 'NZ', name: 'Nueva Zelanda', dial: '64' },
  { iso: 'NL', name: 'Países Bajos', dial: '31' },
  { iso: 'PK', name: 'Pakistán', dial: '92' },
  { iso: 'PA', name: 'Panamá', dial: '507' },
  { iso: 'PY', name: 'Paraguay', dial: '595' },
  { iso: 'PE', name: 'Perú', dial: '51' },
  { iso: 'PL', name: 'Polonia', dial: '48' },
  { iso: 'PT', name: 'Portugal', dial: '351' },
  { iso: 'PR', name: 'Puerto Rico', dial: '1787' },
  { iso: 'GB', name: 'Reino Unido', dial: '44' },
  { iso: 'CZ', name: 'República Checa', dial: '420' },
  { iso: 'DO', name: 'República Dominicana', dial: '1809' },
  { iso: 'RO', name: 'Rumanía', dial: '40' },
  { iso: 'RU', name: 'Rusia', dial: '7' },
  { iso: 'SN', name: 'Senegal', dial: '221' },
  { iso: 'RS', name: 'Serbia', dial: '381' },
  { iso: 'SG', name: 'Singapur', dial: '65' },
  { iso: 'SY', name: 'Siria', dial: '963' },
  { iso: 'ZA', name: 'Sudáfrica', dial: '27' },
  { iso: 'SE', name: 'Suecia', dial: '46' },
  { iso: 'CH', name: 'Suiza', dial: '41' },
  { iso: 'TH', name: 'Tailandia', dial: '66' },
  { iso: 'TW', name: 'Taiwán', dial: '886' },
  { iso: 'TN', name: 'Túnez', dial: '216' },
  { iso: 'TR', name: 'Turquía', dial: '90' },
  { iso: 'UA', name: 'Ucrania', dial: '380' },
  { iso: 'UY', name: 'Uruguay', dial: '598' },
  { iso: 'VE', name: 'Venezuela', dial: '58' },
  { iso: 'VN', name: 'Vietnam', dial: '84' },
];

/**
 * Países cuyo prefijo empieza por los dígitos de `query`. Sin dígitos devuelve
 * la lista entera. Todo lo que no sea un dígito se ignora, así que pegar
 * «+34» o escribir «3 4» funciona igual que «34».
 */
export function filterCountries(query: string): readonly Country[] {
  const digits = query.replace(/\D/g, '');
  if (!digits) return COUNTRIES;
  return COUNTRIES.filter((country) => country.dial.startsWith(digits));
}

/** Une prefijo y número nacional: («34», «600 123 456») → «+34600123456». */
export function joinPhone(country: Country, national: string): string {
  const raw = national.trim();
  // Si ya escribió el prefijo con `+`, se respeta tal cual.
  if (raw.startsWith('+')) return raw;
  return `+${country.dial}${raw}`;
}
