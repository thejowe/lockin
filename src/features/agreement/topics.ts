/**
 * Catálogo del acuerdo de socios: ocho temas difíciles en tres secciones.
 *
 * Vive en el cliente a propósito (spec § «Por qué el catálogo vive en el
 * cliente»): la base solo guarda claves y no sabe cuáles son válidas. Las
 * claves cumplen `^[a-z0-9-]{1,40}$`, el `check` de la migración; el texto
 * visible se puede pulir sin migrar.
 *
 * Nada de esto es asesoría legal ni recomienda una opción, y ninguna opción
 * huele a «uno contrata al otro» (`CONCEPTO.md`).
 */

export const AGREEMENT_CATALOG_VERSION = 1;

/** Opción comodín de todos los temas. Nunca cuenta como desacuerdo. */
export const UNDECIDED = 'sin-decidir';

export type AgreementSection = 'compromiso' | 'reparto' | 'salida';

export interface AgreementOption {
  key: string;
  label: string;
}

export interface AgreementTopic {
  key: string;
  section: AgreementSection;
  question: string;
  /** Sin «Aún no lo sé»: lo añade `optionsOf`. */
  options: readonly AgreementOption[];
}

export const SECTION_LABELS: Record<AgreementSection, string> = {
  compromiso: 'Compromiso',
  reparto: 'Reparto',
  salida: 'Salida',
};

const UNDECIDED_OPTION: AgreementOption = { key: UNDECIDED, label: 'Aún no lo sé' };

export const AGREEMENT_CATALOG: readonly AgreementTopic[] = [
  {
    key: 'dedicacion',
    section: 'compromiso',
    question: '¿Cuánto tiempo le vas a dedicar los próximos 6 meses?',
    options: [
      { key: 'menos-10h', label: 'Menos de 10 h a la semana' },
      { key: '10-25h', label: 'Entre 10 y 25 h a la semana' },
      { key: 'media-jornada', label: 'Media jornada' },
      { key: 'completa', label: 'Jornada completa' },
    ],
  },
  {
    key: 'horizonte',
    section: 'compromiso',
    question: '¿Cuánto le das antes de replantearlo?',
    options: [
      { key: '3-meses', label: 'Unos 3 meses' },
      { key: '1-ano', label: 'Un año' },
      { key: 'hasta-que-funcione', label: 'Hasta que funcione o se acabe' },
    ],
  },
  {
    key: 'dinero-propio',
    section: 'compromiso',
    question: '¿Cuánto dinero tuyo estás dispuesto a poner?',
    options: [
      { key: 'nada', label: 'Nada' },
      { key: 'gastos-pequenos', label: 'Algo para gastos pequeños' },
      { key: 'colchon-serio', label: 'Un colchón serio' },
    ],
  },
  {
    key: 'participacion',
    section: 'reparto',
    question: '¿Cómo repartiríais la participación?',
    options: [
      { key: 'partes-iguales', label: 'A partes iguales' },
      { key: 'segun-aportacion', label: 'Según lo que aporte cada uno' },
      { key: 'mas-adelante', label: 'Lo decidimos más adelante' },
    ],
  },
  {
    key: 'consolidacion',
    section: 'reparto',
    question: '¿La participación se gana con el tiempo (vesting)?',
    options: [
      { key: 'si-con-periodo', label: 'Sí, con un periodo pactado' },
      { key: 'no', label: 'No, es de cada uno desde el principio' },
    ],
  },
  {
    key: 'decisiones',
    section: 'reparto',
    question: '¿Cómo se decide cuando no estáis de acuerdo?',
    options: [
      { key: 'consenso', label: 'Hasta llegar a un consenso' },
      { key: 'cada-uno-su-area', label: 'Cada uno decide en su área' },
      { key: 'desempate-pactado', label: 'Con un desempate pactado de antemano' },
    ],
  },
  {
    key: 'si-uno-se-va',
    section: 'salida',
    question: 'Si uno lo deja en el primer año…',
    options: [
      { key: 'se-va-sin-nada', label: 'Se va sin participación' },
      { key: 'conserva-lo-ganado', label: 'Conserva lo que ya haya ganado' },
      { key: 'lo-hablamos-entonces', label: 'Lo hablamos cuando pase' },
    ],
  },
  {
    key: 'lo-creado',
    section: 'salida',
    question: 'Lo que cada uno crea antes de constituir, ¿de quién es?',
    options: [
      { key: 'del-proyecto', label: 'Del proyecto, desde el primer día' },
      { key: 'de-quien-lo-hizo', label: 'De quien lo hizo, hasta constituir' },
    ],
  },
];

export function topicByKey(key: string): AgreementTopic | undefined {
  return AGREEMENT_CATALOG.find((topic) => topic.key === key);
}

export function optionsOf(topic: AgreementTopic): readonly AgreementOption[] {
  return [...topic.options, UNDECIDED_OPTION];
}

export function optionLabel(topicKey: string, optionKey: string): string | undefined {
  const topic = topicByKey(topicKey);
  return topic && optionsOf(topic).find((option) => option.key === optionKey)?.label;
}

/** Tema y opción existen en este catálogo. Lo demás se pinta como no respondido. */
export function isKnownAnswer(topicKey: string, optionKey: string): boolean {
  return optionLabel(topicKey, optionKey) !== undefined;
}
