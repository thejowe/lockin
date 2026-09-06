/**
 * Catálogo de opciones del perfil.
 *
 * Traduce los tipos de `@/data` (que son códigos estables) al texto que ve el
 * usuario. Los textos de "punto de partida" y de los modos son literales de
 * `docs/plan/CONCEPTO.md` — no los reescribas sin actualizar el concepto.
 *
 * Todo lo que se pinta como lista de opciones sale de aquí: así el formulario
 * de onboarding, la edición y la ficha de perfil no se desincronizan.
 */

import type { Ambition, ModePreference, Specialty, StartingPoint, TimeBand } from '@/data';

/** Una opción seleccionable: código estable, etiqueta y explicación opcional. */
export interface Option<T extends string> {
  value: T;
  label: string;
  /** Frase de apoyo bajo la etiqueta. Solo donde la elección no es obvia. */
  description?: string;
}

/** Qué busca la persona. `ambos` existe porque mucha gente quiere las dos cosas. */
export const MODE_OPTIONS: Option<ModePreference>[] = [
  {
    value: 'par',
    label: 'Cofundador',
    description: 'Alguien en igualdad de condiciones para construir algo desde cero.',
  },
  {
    value: 'lockin',
    label: 'Compañero de Lock-In',
    description: 'Alguien con quien trabajar concentrado a la vez, cada uno en lo suyo.',
  },
  {
    value: 'ambos',
    label: 'Ambos',
    description: 'Enséñame las dos cosas y ya decido tarjeta a tarjeta.',
  },
];

export const SPECIALTY_OPTIONS: Option<Specialty>[] = [
  { value: 'diseno', label: 'Diseño' },
  { value: 'dev', label: 'Desarrollo' },
  { value: 'producto', label: 'Producto' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'ventas', label: 'Ventas' },
  { value: 'datos', label: 'Datos' },
  { value: 'contenido', label: 'Contenido' },
  { value: 'finanzas', label: 'Finanzas' },
  { value: 'operaciones', label: 'Operaciones' },
  { value: 'legal', label: 'Legal' },
];

/** Las tres opciones literales de `CONCEPTO.md`. */
export const STARTING_POINT_OPTIONS: Option<StartingPoint>[] = [
  {
    value: 'solo-ganas',
    label: 'Solo ganas',
    description: 'Solo tengo ganas y ambición, sin idea todavía.',
  },
  {
    value: 'idea-sin-empezar',
    label: 'Idea sin empezar',
    description: 'Tengo una idea pero no he empezado nada.',
  },
  {
    value: 'algo-empezado',
    label: 'Algo empezado',
    description: 'Ya toqué algo pequeño, busco con quién llevarlo en serio.',
  },
];

export const AMBITION_OPTIONS: Option<Ambition>[] = [
  {
    value: 'lifestyle',
    label: 'Negocio lifestyle',
    description: 'Algo sostenible que quepa en la vida que ya tengo.',
  },
  {
    value: 'equilibrado',
    label: 'En serio, con equilibrio',
    description: 'Le meto horas de verdad, pero no me quemo.',
  },
  {
    value: 'todo-o-nada',
    label: 'Apostarlo todo',
    description: 'Lo demás se aparta hasta que esto funcione.',
  },
];

export const TIME_BAND_OPTIONS: Option<TimeBand>[] = [
  { value: 'madrugada', label: 'Madrugada', description: '00–06' },
  { value: 'manana', label: 'Mañana', description: '06–12' },
  { value: 'tarde', label: 'Tarde', description: '12–20' },
  { value: 'noche', label: 'Noche', description: '20–00' },
];

/**
 * Preguntas de texto libre, estilo Hinge. Son lo que hace que un perfil se
 * sienta "swipeable" en vez de un CV: cortas, concretas y en primera persona.
 */
export const PROMPT_QUESTIONS: string[] = [
  'Lo que quiero construir es…',
  'Mi mejor sesión de trabajo empieza…',
  'Necesito compañía para…',
  'Lo que aporto desde el día uno es…',
  'Lo que ya intenté y no salió…',
  'Busco a alguien que…',
];

/** Longitud máxima de una respuesta de prompt. Corta a propósito. */
export const PROMPT_MAX_LENGTH = 140;

/** Límites de la disponibilidad declarada, en horas por semana. */
export const HOURS_MIN = 2;
export const HOURS_MAX = 60;
export const HOURS_STEP = 1;

/** Rango de edad aceptado en el formulario. */
export const AGE_MIN = 16;
export const AGE_MAX = 99;

function labelOf<T extends string>(options: Option<T>[], value: T): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

export const modeLabel = (value: ModePreference) => labelOf(MODE_OPTIONS, value);
export const specialtyLabel = (value: Specialty) => labelOf(SPECIALTY_OPTIONS, value);
export const startingPointLabel = (value: StartingPoint) => labelOf(STARTING_POINT_OPTIONS, value);
export const ambitionLabel = (value: Ambition) => labelOf(AMBITION_OPTIONS, value);
export const timeBandLabel = (value: TimeBand) => labelOf(TIME_BAND_OPTIONS, value);

/** Frase completa del punto de partida, para la ficha de perfil. */
export function startingPointSentence(value: StartingPoint): string {
  return (
    STARTING_POINT_OPTIONS.find((option) => option.value === value)?.description ??
    startingPointLabel(value)
  );
}

/** "12 h/semana · Tarde y noche". Lo que se lee de un vistazo en una tarjeta. */
export function availabilitySummary(hoursPerWeek: number, bands: TimeBand[]): string {
  const labels = bands.map(timeBandLabel);
  const joined =
    labels.length <= 1
      ? (labels[0] ?? 'Sin franja')
      : `${labels.slice(0, -1).join(', ')} y ${labels[labels.length - 1]}`;

  return `${hoursPerWeek} h/semana · ${joined.toLowerCase()}`;
}
