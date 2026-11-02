/**
 * Etiquetas legibles de los enums de dominio.
 *
 * Los tipos de `@/data` son identificadores estables (`'diseno'`, `'todo-o-nada'`);
 * esto es la capa de presentación en castellano. Vive dentro de `chat` porque hoy
 * solo lo usa este bloque — si `perfil` o `descubrir` necesitan lo mismo, se sube
 * a un módulo compartido en vez de duplicarlo.
 */

import type { Ambition, Mode, Specialty, StartingPoint, TimeBand } from '@/data';
import { joinList, t } from '@/i18n';

export const SPECIALTY_LABELS: Record<Specialty, string> = {
  get diseno() {
    return t('diseño');
  },
  get dev() {
    return t('desarrollo');
  },
  get marketing() {
    return t('marketing');
  },
  get ventas() {
    return t('ventas');
  },
  get datos() {
    return t('datos');
  },
  get legal() {
    return t('legal');
  },
  get producto() {
    return t('producto');
  },
  get finanzas() {
    return t('finanzas');
  },
  get operaciones() {
    return t('operaciones');
  },
  get contenido() {
    return t('contenido');
  },
  get ia() {
    return t('IA');
  },
  get hardware() {
    return t('hardware');
  },
  get growth() {
    return t('growth');
  },
  get comunidad() {
    return t('comunidad');
  },
  get personas() {
    return t('personas');
  },
  get investigacion() {
    return t('investigación');
  },
  get audiovisual() {
    return t('audiovisual');
  },
  get seguridad() {
    return t('ciberseguridad');
  },
  get ecommerce() {
    return t('e-commerce');
  },
  get inversion() {
    return t('inversión');
  },
};

/** Franjas horarias, redactadas para caber dentro de una frase ("los dos estáis por la…"). */
export const TIME_BAND_LABELS: Record<TimeBand, string> = {
  get madrugada() {
    return t('madrugada');
  },
  get manana() {
    return t('mañana');
  },
  get tarde() {
    return t('tarde');
  },
  get noche() {
    return t('noche');
  },
};

export const AMBITION_LABELS: Record<Ambition, string> = {
  get lifestyle() {
    return t('negocio lifestyle');
  },
  get equilibrado() {
    return t('ambición equilibrada');
  },
  get 'todo-o-nada'() {
    return t('apostarlo todo');
  },
};

export const STARTING_POINT_LABELS: Record<StartingPoint, string> = {
  get 'solo-ganas'() {
    return t('solo ganas, sin idea todavía');
  },
  get 'idea-sin-empezar'() {
    return t('una idea sin empezar');
  },
  get 'algo-empezado'() {
    return t('algo ya empezado');
  },
};

/** Cómo se nombra el match en la lista: es el contexto bajo el que se conocieron. */
export const MODE_LABELS: Record<Mode, string> = {
  get par() {
    return t('Cofundador');
  },
  lockin: 'Lock-In',
};

/** "diseño y producto" — enumeración natural, sin coma de Oxford. */
export function joinNaturally(items: string[]): string {
  return joinList(items);
}
