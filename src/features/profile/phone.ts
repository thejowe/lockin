/**
 * El móvil de contacto: obligatorio en el alta, editable en Ajustes.
 *
 * Se comprueba sin red contra el plan de numeración de cada país
 * (`libphonenumber-js`): «+34 123456789» no pasa porque en España ningún número
 * empieza por 1. No se verifica por SMS (no hay proveedor contratado), así que
 * esto no demuestra que la línea esté activa ni que sea de quien la escribe.
 */

import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

import { t } from '@/i18n';

/** Tras quitar separadores solo pueden quedar dígitos: nada de letras ni extensiones. */
const PHONE_CHARS = /^\+?\d+$/;

function stripSeparators(raw: string): string {
  return raw.replace(/[\s().-]/g, '');
}

/** Sin `+` se lee como número de España, el país por defecto del selector. */
function parsePhone(raw: string) {
  const stripped = stripSeparators(raw);
  if (!PHONE_CHARS.test(stripped)) return undefined;
  return parsePhoneNumberFromString(stripped, 'ES');
}

/**
 * Forma internacional canónica: «+34 600-123 456» → «+34600123456». También quita
 * el 0 nacional que algunos países escriben tras el prefijo: «+33 06…» → «+336…».
 */
export function normalizePhone(raw: string): string {
  return parsePhone(raw)?.number ?? stripSeparators(raw);
}

/** Qué falta para poder guardar el móvil, o `null` si está bien. */
export function phoneProblem(raw: string): string | null {
  if (!raw.trim()) return t('Escribe tu número de teléfono.');
  if (!parsePhone(raw)?.isValid()) {
    return t('Ese número no existe. Revisa el prefijo y los dígitos.');
  }
  return null;
}
