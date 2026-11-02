/**
 * El móvil de contacto: obligatorio en el alta, editable en Ajustes.
 *
 * No se verifica por SMS (no hay proveedor contratado): se comprueba que tenga
 * forma de móvil real de su país — longitud y primer dígito del número nacional
 * (España: 9 dígitos que empiezan por 6 o 7) — y que no sea una repetición
 * absurda tipo «2222222222».
 */

interface NationalRule {
  /** Dígitos del número nacional (sin prefijo ni 0 de troncal): mínimo y máximo. */
  min: number;
  max: number;
  /** Cómo empieza un móvil de ese país. */
  start: RegExp;
}

const rule = (min: number, max: number, start: RegExp): NationalRule => ({ min, max, start });

/** Móviles por prefijo (sin `+`). Un país que no esté aquí usa `FALLBACK`. */
const RULES: Readonly<Record<string, NationalRule>> = {
  '1': rule(10, 10, /^[2-9]/), // EE. UU., Canadá y el plan NANP
  '7': rule(10, 10, /^[3-9]/), // Rusia, Kazajistán
  '20': rule(10, 10, /^1/), // Egipto
  '27': rule(9, 9, /^[6-8]/), // Sudáfrica
  '30': rule(10, 10, /^69/), // Grecia
  '31': rule(9, 9, /^6/), // Países Bajos
  '32': rule(9, 9, /^4/), // Bélgica
  '33': rule(9, 9, /^[67]/), // Francia
  '34': rule(9, 9, /^[67]/), // España
  '36': rule(9, 9, /^[237]/), // Hungría
  '39': rule(9, 10, /^3/), // Italia
  '40': rule(9, 9, /^7/), // Rumanía
  '41': rule(9, 9, /^7/), // Suiza
  '43': rule(10, 13, /^6/), // Austria
  '44': rule(10, 10, /^7/), // Reino Unido
  '45': rule(8, 8, /^[2-9]/), // Dinamarca
  '46': rule(9, 9, /^7/), // Suecia
  '47': rule(8, 8, /^[49]/), // Noruega
  '48': rule(9, 9, /^[4-8]/), // Polonia
  '49': rule(10, 11, /^1/), // Alemania
  '51': rule(9, 9, /^9/), // Perú
  '52': rule(10, 10, /^[1-9]/), // México
  '54': rule(10, 11, /^[1-9]/), // Argentina
  '55': rule(11, 11, /^[1-9][1-9]9/), // Brasil
  '56': rule(9, 9, /^9/), // Chile
  '57': rule(10, 10, /^3/), // Colombia
  '58': rule(10, 10, /^4/), // Venezuela
  '61': rule(9, 9, /^4/), // Australia
  '81': rule(10, 10, /^[789]/), // Japón
  '86': rule(11, 11, /^1/), // China
  '90': rule(10, 10, /^5/), // Turquía
  '91': rule(10, 10, /^[6-9]/), // India
  '212': rule(9, 9, /^[67]/), // Marruecos
  '234': rule(10, 10, /^[7-9]/), // Nigeria
  '351': rule(9, 9, /^9/), // Portugal
  '353': rule(9, 9, /^8/), // Irlanda
  '358': rule(9, 10, /^[45]/), // Finlandia
  '376': rule(6, 6, /^6/), // Andorra
  '380': rule(9, 9, /^[3-9]/), // Ucrania
  '420': rule(9, 9, /^[67]/), // Chequia
  '591': rule(8, 8, /^[67]/), // Bolivia
  '593': rule(9, 9, /^9/), // Ecuador
  '595': rule(9, 9, /^9/), // Paraguay
  '598': rule(8, 8, /^9/), // Uruguay
  '966': rule(9, 9, /^5/), // Arabia Saudí
  '971': rule(9, 9, /^5/), // Emiratos Árabes Unidos
};

/** Países sin regla propia: de 6 a 12 dígitos nacionales, sin 0 inicial. */
const FALLBACK = rule(6, 12, /^[1-9]/);

/** España: lo que se asume si el número llega sin `+` ni prefijo. */
const DEFAULT_DIAL = '34';

/** Quita espacios, guiones, puntos y paréntesis: «+34 600-123 456» → «+34600123456». */
export function normalizePhone(raw: string): string {
  return raw.replace(/[\s().-]/g, '');
}

/** Separa prefijo y número nacional; busca el prefijo conocido más largo. */
function splitDial(digits: string): { rule: NationalRule; national: string } {
  for (let size = 4; size >= 1; size--) {
    const known = RULES[digits.slice(0, size)];
    if (known) return { rule: known, national: digits.slice(size) };
  }
  // Prefijo sin regla propia: se asume de 1 a 3 dígitos, el resto es el nacional.
  return { rule: FALLBACK, national: digits.replace(/^\d{1,3}/, '') };
}

function isValidMobile(raw: string): boolean {
  const normalized = normalizePhone(raw);
  if (!/^\+?\d+$/.test(normalized)) return false;

  const hasPlus = normalized.startsWith('+');
  const digits = hasPlus ? normalized.slice(1) : normalized;
  // Sin `+` el número es nacional de España.
  const { rule: found, national } = hasPlus
    ? splitDial(digits)
    : { rule: RULES[DEFAULT_DIAL], national: digits };

  if (national.length < found.min || national.length > found.max) return false;
  if (!found.start.test(national)) return false;
  // «2222222222», «000000000»…: forma correcta, pero no es un número.
  if (/^(\d)\1+$/.test(national)) return false;
  return true;
}

/** Qué falta para poder guardar el móvil, o `null` si está bien. */
export function phoneProblem(raw: string): string | null {
  if (!raw.trim()) return 'Escribe tu número de teléfono.';
  if (!isValidMobile(raw)) {
    return 'Ese teléfono no existe. Revisa el número y el prefijo de tu país (en España, 9 dígitos que empiezan por 6 o 7).';
  }
  return null;
}
