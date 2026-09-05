/**
 * Etiquetas legibles de los enums de dominio.
 *
 * Los tipos de `@/data` son identificadores estables (`'diseno'`, `'todo-o-nada'`);
 * esto es la capa de presentación en castellano. Vive dentro de `chat` porque hoy
 * solo lo usa este bloque — si `perfil` o `descubrir` necesitan lo mismo, se sube
 * a un módulo compartido en vez de duplicarlo.
 */

import type { Ambition, Mode, Specialty, StartingPoint, TimeBand } from '@/data';

export const SPECIALTY_LABELS: Record<Specialty, string> = {
  diseno: 'diseño',
  dev: 'desarrollo',
  marketing: 'marketing',
  ventas: 'ventas',
  datos: 'datos',
  legal: 'legal',
  producto: 'producto',
  finanzas: 'finanzas',
  operaciones: 'operaciones',
  contenido: 'contenido',
};

/** Franjas horarias, redactadas para caber dentro de una frase ("los dos estáis por la…"). */
export const TIME_BAND_LABELS: Record<TimeBand, string> = {
  madrugada: 'madrugada',
  manana: 'mañana',
  tarde: 'tarde',
  noche: 'noche',
};

export const AMBITION_LABELS: Record<Ambition, string> = {
  lifestyle: 'negocio lifestyle',
  equilibrado: 'ambición equilibrada',
  'todo-o-nada': 'apostarlo todo',
};

export const STARTING_POINT_LABELS: Record<StartingPoint, string> = {
  'solo-ganas': 'solo ganas, sin idea todavía',
  'idea-sin-empezar': 'una idea sin empezar',
  'algo-empezado': 'algo ya empezado',
};

/** Cómo se nombra el match en la lista: es el contexto bajo el que se conocieron. */
export const MODE_LABELS: Record<Mode, string> = {
  par: 'Cofundador',
  lockin: 'Lock-In',
};

/** "diseño y producto" — enumeración natural, sin coma de Oxford. */
export function joinNaturally(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}
