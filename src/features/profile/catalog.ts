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

import type {
  Ambition,
  Language,
  ModePreference,
  Specialty,
  StartingPoint,
  TimeBand,
} from '@/data';
import { joinList, lowerInSentence, t, tk } from '@/i18n';

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
    get label() {
      return t('Cofundador');
    },
    get description() {
      return t('Alguien en igualdad de condiciones para construir algo desde cero.');
    },
  },
  {
    value: 'lockin',
    get label() {
      return t('Compañero de Lock-In');
    },
    get description() {
      return t('Alguien con quien trabajar concentrado a la vez, cada uno en lo suyo.');
    },
  },
  {
    value: 'ambos',
    get label() {
      return t('Ambos');
    },
    get description() {
      return t('Enséñame las dos cosas y ya decido tarjeta a tarjeta.');
    },
  },
];

export const SPECIALTY_OPTIONS: Option<Specialty>[] = [
  {
    value: 'diseno',
    get label() {
      return t('Diseño');
    },
  },
  {
    value: 'dev',
    get label() {
      return t('Desarrollo');
    },
  },
  {
    value: 'producto',
    get label() {
      return t('Producto');
    },
  },
  { value: 'marketing', label: 'Marketing' },
  {
    value: 'ventas',
    get label() {
      return t('Ventas');
    },
  },
  {
    value: 'datos',
    get label() {
      return t('Datos');
    },
  },
  {
    value: 'contenido',
    get label() {
      return t('Contenido');
    },
  },
  {
    value: 'finanzas',
    get label() {
      return t('Finanzas');
    },
  },
  {
    value: 'operaciones',
    get label() {
      return t('Operaciones');
    },
  },
  {
    value: 'legal',
    get label() {
      return t('Legal');
    },
  },
  {
    value: 'ia',
    get label() {
      return t('IA y machine learning');
    },
  },
  { value: 'hardware', label: 'Hardware' },
  { value: 'growth', label: 'Growth' },
  {
    value: 'comunidad',
    get label() {
      return t('Comunidad');
    },
  },
  {
    value: 'personas',
    get label() {
      return t('Personas y RR. HH.');
    },
  },
  {
    value: 'investigacion',
    get label() {
      return t('Investigación');
    },
  },
  {
    value: 'audiovisual',
    get label() {
      return t('Vídeo y audiovisual');
    },
  },
  {
    value: 'seguridad',
    get label() {
      return t('Ciberseguridad');
    },
  },
  { value: 'ecommerce', label: 'E-commerce' },
  {
    value: 'inversion',
    get label() {
      return t('Inversión y fundraising');
    },
  },
];

/** Tope de especialidades por lista: el `check` de `profiles` lo pide así. */
export const SPECIALTIES_MAX = 10;

/** Longitud de la especialidad escrita a mano («Otra»), igual que el `check` de la base. */
export const OTHER_SPECIALTY_MIN_LENGTH = 2;
export const OTHER_SPECIALTY_MAX_LENGTH = 40;

export const LANGUAGE_OPTIONS: Option<Language>[] = [
  {
    value: 'es',
    get label() {
      return t('Español');
    },
  },
  {
    value: 'en',
    get label() {
      return t('Inglés');
    },
  },
  {
    value: 'ca',
    get label() {
      return t('Catalán');
    },
  },
  {
    value: 'eu',
    get label() {
      return t('Euskera');
    },
  },
  {
    value: 'gl',
    get label() {
      return t('Gallego');
    },
  },
  {
    value: 'pt',
    get label() {
      return t('Portugués');
    },
  },
  {
    value: 'fr',
    get label() {
      return t('Francés');
    },
  },
  {
    value: 'de',
    get label() {
      return t('Alemán');
    },
  },
  {
    value: 'it',
    get label() {
      return t('Italiano');
    },
  },
  {
    value: 'nl',
    get label() {
      return t('Neerlandés');
    },
  },
  {
    value: 'ro',
    get label() {
      return t('Rumano');
    },
  },
  {
    value: 'ar',
    get label() {
      return t('Árabe');
    },
  },
  {
    value: 'zh',
    get label() {
      return t('Chino');
    },
  },
  {
    value: 'ru',
    get label() {
      return t('Ruso');
    },
  },
];

/** Las tres opciones literales de `CONCEPTO.md`. */
export const STARTING_POINT_OPTIONS: Option<StartingPoint>[] = [
  {
    value: 'solo-ganas',
    get label() {
      return t('Solo ganas');
    },
    get description() {
      return t('Solo tengo ganas y ambición, sin idea todavía.');
    },
  },
  {
    value: 'idea-sin-empezar',
    get label() {
      return t('Idea sin empezar');
    },
    get description() {
      return t('Tengo una idea pero no he empezado nada.');
    },
  },
  {
    value: 'algo-empezado',
    get label() {
      return t('Algo empezado');
    },
    get description() {
      return t('Ya toqué algo pequeño, busco con quién llevarlo en serio.');
    },
  },
];

export const AMBITION_OPTIONS: Option<Ambition>[] = [
  {
    value: 'lifestyle',
    get label() {
      return t('Negocio lifestyle');
    },
    get description() {
      return t('Algo sostenible que quepa en la vida que ya tengo.');
    },
  },
  {
    value: 'equilibrado',
    get label() {
      return t('En serio, con equilibrio');
    },
    get description() {
      return t('Le meto horas de verdad, pero no me quemo.');
    },
  },
  {
    value: 'todo-o-nada',
    get label() {
      return t('Apostarlo todo');
    },
    get description() {
      return t('Lo demás se aparta hasta que esto funcione.');
    },
  },
];

export const TIME_BAND_OPTIONS: Option<TimeBand>[] = [
  {
    value: 'madrugada',
    get label() {
      return t('Madrugada');
    },
    description: '00–06',
  },
  {
    value: 'manana',
    get label() {
      return t('Mañana');
    },
    description: '06–12',
  },
  {
    value: 'tarde',
    get label() {
      return t('Tarde');
    },
    description: '12–20',
  },
  {
    value: 'noche',
    get label() {
      return t('Noche');
    },
    description: '20–00',
  },
];

/**
 * Preguntas de texto libre, estilo Hinge. Son lo que hace que un perfil se
 * sienta "swipeable" en vez de un CV: cortas, concretas y en primera persona.
 */
export const PROMPT_QUESTIONS: string[] = [
  tk('Lo que quiero construir es…'),
  tk('Mi mejor sesión de trabajo empieza…'),
  tk('Necesito compañía para…'),
  tk('Lo que aporto desde el día uno es…'),
  tk('Lo que ya intenté y no salió…'),
  tk('Busco a alguien que…'),
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
export const languageLabel = (value: Language) => labelOf(LANGUAGE_OPTIONS, value);

/** "Español, inglés y catalán". */
export function languagesSentence(values: Language[]): string {
  return joinList(
    values.map((value, index) =>
      index === 0 ? languageLabel(value) : lowerInSentence(languageLabel(value))
    )
  );
}

/** La franja dentro de una frase, entera porque cada idioma la dice distinto. */
export function timeBandPhrase(band: TimeBand): string {
  switch (band) {
    case 'madrugada':
      return t('de madrugada');
    case 'manana':
      return t('por la mañana');
    case 'tarde':
      return t('por la tarde');
    case 'noche':
      return t('por la noche');
  }
}

/**
 * Si a esta persona le tiene sentido declarar qué debe dominar la otra.
 *
 * Solo con `par` o `ambos`. Un compañero de lock-in se elige por franja horaria
 * y compromiso con la sesión, no por skills — no hay nada que complementar
 * cuando cada uno trabaja en lo suyo. Es la invariante de
 * `Profile.seekingSpecialties`, y quien pinta o guarda un perfil la mantiene.
 */
export function seeksComplement(lookingFor: ModePreference | null): boolean {
  return lookingFor === 'par' || lookingFor === 'ambos';
}

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
  const joined = joinList(labels) || t('Sin franja');

  return t('{hoursPerWeek} h/semana · {bands}', { hoursPerWeek, bands: joined.toLowerCase() });
}
