/**
 * El móvil de contacto: obligatorio en el alta, editable en Ajustes.
 *
 * No se verifica por SMS (no hay proveedor contratado): se comprueba solo que
 * tenga forma de número internacional, con 9 a 15 dígitos y un `+` opcional.
 */

import { t } from '@/i18n';

const PHONE_SHAPE = /^\+?\d{9,15}$/;

/** Quita espacios, guiones, puntos y paréntesis: «+34 600-123 456» → «+34600123456». */
export function normalizePhone(raw: string): string {
  return raw.replace(/[\s().-]/g, '');
}

/** Qué falta para poder guardar el móvil, o `null` si está bien. */
export function phoneProblem(raw: string): string | null {
  if (!raw.trim()) return t('Escribe tu número de teléfono.');
  if (!PHONE_SHAPE.test(normalizePhone(raw))) {
    return t(
      'El teléfono no parece válido. Usa de 9 a 15 dígitos, con prefijo si es de otro país (+34…).'
    );
  }
  return null;
}
