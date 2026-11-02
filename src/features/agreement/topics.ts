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

import { t } from '@/i18n';

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
  get compromiso() {
    return t('Compromiso');
  },
  get reparto() {
    return t('Reparto');
  },
  get salida() {
    return t('Salida');
  },
};

const UNDECIDED_OPTION: AgreementOption = {
  key: UNDECIDED,
  get label() {
    return t('Aún no lo sé');
  },
};

export const AGREEMENT_CATALOG: readonly AgreementTopic[] = [
  {
    key: 'dedicacion',
    section: 'compromiso',
    get question() {
      return t('¿Cuánto tiempo le vas a dedicar los próximos 6 meses?');
    },
    options: [
      {
        key: 'menos-10h',
        get label() {
          return t('Menos de 10 h a la semana');
        },
      },
      {
        key: '10-25h',
        get label() {
          return t('Entre 10 y 25 h a la semana');
        },
      },
      {
        key: 'media-jornada',
        get label() {
          return t('Media jornada');
        },
      },
      {
        key: 'completa',
        get label() {
          return t('Jornada completa');
        },
      },
    ],
  },
  {
    key: 'horizonte',
    section: 'compromiso',
    get question() {
      return t('¿Cuánto le das antes de replantearlo?');
    },
    options: [
      {
        key: '3-meses',
        get label() {
          return t('Unos 3 meses');
        },
      },
      {
        key: '1-ano',
        get label() {
          return t('Un año');
        },
      },
      {
        key: 'hasta-que-funcione',
        get label() {
          return t('Hasta que funcione o se acabe');
        },
      },
    ],
  },
  {
    key: 'dinero-propio',
    section: 'compromiso',
    get question() {
      return t('¿Cuánto dinero tuyo estás dispuesto a poner?');
    },
    options: [
      {
        key: 'nada',
        get label() {
          return t('Nada');
        },
      },
      {
        key: 'gastos-pequenos',
        get label() {
          return t('Algo para gastos pequeños');
        },
      },
      {
        key: 'colchon-serio',
        get label() {
          return t('Un colchón serio');
        },
      },
    ],
  },
  {
    key: 'participacion',
    section: 'reparto',
    get question() {
      return t('¿Cómo repartiríais la participación?');
    },
    options: [
      {
        key: 'partes-iguales',
        get label() {
          return t('A partes iguales');
        },
      },
      {
        key: 'segun-aportacion',
        get label() {
          return t('Según lo que aporte cada uno');
        },
      },
      {
        key: 'mas-adelante',
        get label() {
          return t('Lo decidimos más adelante');
        },
      },
    ],
  },
  {
    key: 'consolidacion',
    section: 'reparto',
    get question() {
      return t('¿La participación se gana con el tiempo (vesting)?');
    },
    options: [
      {
        key: 'si-con-periodo',
        get label() {
          return t('Sí, con un periodo pactado');
        },
      },
      {
        key: 'no',
        get label() {
          return t('No, es de cada uno desde el principio');
        },
      },
    ],
  },
  {
    key: 'decisiones',
    section: 'reparto',
    get question() {
      return t('¿Cómo se decide cuando no estáis de acuerdo?');
    },
    options: [
      {
        key: 'consenso',
        get label() {
          return t('Hasta llegar a un consenso');
        },
      },
      {
        key: 'cada-uno-su-area',
        get label() {
          return t('Cada uno decide en su área');
        },
      },
      {
        key: 'desempate-pactado',
        get label() {
          return t('Con un desempate pactado de antemano');
        },
      },
    ],
  },
  {
    key: 'si-uno-se-va',
    section: 'salida',
    get question() {
      return t('Si uno lo deja en el primer año…');
    },
    options: [
      {
        key: 'se-va-sin-nada',
        get label() {
          return t('Se va sin participación');
        },
      },
      {
        key: 'conserva-lo-ganado',
        get label() {
          return t('Conserva lo que ya haya ganado');
        },
      },
      {
        key: 'lo-hablamos-entonces',
        get label() {
          return t('Lo hablamos cuando pase');
        },
      },
    ],
  },
  {
    key: 'lo-creado',
    section: 'salida',
    get question() {
      return t('Lo que cada uno crea antes de constituir, ¿de quién es?');
    },
    options: [
      {
        key: 'del-proyecto',
        get label() {
          return t('Del proyecto, desde el primer día');
        },
      },
      {
        key: 'de-quien-lo-hizo',
        get label() {
          return t('De quien lo hizo, hasta constituir');
        },
      },
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
