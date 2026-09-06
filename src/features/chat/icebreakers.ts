/**
 * Icebreakers sugeridos al abrir una conversación nueva.
 *
 * Reglas simples sobre los dos perfiles — nada de IA en el MVP (ver
 * `docs/plan/CONCEPTO.md`). La gracia no es que sean ingeniosos, sino que
 * demuestren que la app ha leído los dos perfiles: eso es lo que quita la
 * fricción del primer mensaje.
 *
 * Las frases están escritas en primera persona, listas para enviarse tal cual.
 * Las reglas se evalúan de más específica a más genérica y nos quedamos con las
 * tres primeras, así que el orden de este archivo *es* la prioridad.
 */

import { SPECIALTY_LABELS, TIME_BAND_LABELS, joinNaturally } from './labels';

import type { Mode, Profile, StartingPoint } from '@/data';

/** Cuántas sugerencias enseñamos. Tres caben sin empujar la conversación fuera de pantalla. */
const MAX_SUGGESTIONS = 3;

/** Cómo se menciona el punto de partida del otro dentro de una pregunta. */
const STARTING_POINT_OPENERS: Record<StartingPoint, string> = {
  'solo-ganas':
    'Dices que aún no tienes idea, solo ganas. ¿Qué terreno te llama más para empezar a mirar?',
  'idea-sin-empezar': 'Tienes una idea pero sin empezar. ¿Qué te ha frenado hasta ahora?',
  'algo-empezado': 'Dices que ya tocaste algo. ¿Qué tienes montado y qué te falta?',
};

/**
 * Genera hasta tres aperturas para un chat recién abierto.
 *
 * @param counterpart Perfil del otro lado del match.
 * @param me Perfil propio, o `null` si aún no se ha creado — en ese caso solo se
 *   aplican las reglas que dependen del otro perfil.
 * @param mode Modo bajo el que nació el match: decide el tono del fallback.
 */
export function suggestIcebreakers(counterpart: Profile, me: Profile | null, mode: Mode): string[] {
  const suggestions: string[] = [];

  const push = (line: string | null) => {
    if (line && !suggestions.includes(line)) suggestions.push(line);
  };

  if (me) {
    push(complementarySpecialties(counterpart, me));
    push(sharedSpecialties(counterpart, me));
    push(sharedTimeBand(counterpart, me));
    push(sharedAmbition(counterpart, me));
    push(differentTimezone(counterpart, me));
  }

  push(quoteTheirPrompt(counterpart));
  push(theirSpecialties(counterpart));
  push(STARTING_POINT_OPENERS[counterpart.startingPoint]);
  push(modeFallback(mode));

  return suggestions.slice(0, MAX_SUGGESTIONS);
}

/** Lo más valioso en Modo Par: cada uno cubre lo que al otro le falta. */
function complementarySpecialties(counterpart: Profile, me: Profile): string | null {
  const mineOnly = me.specialties.filter((s) => !counterpart.specialties.includes(s));
  const theirsOnly = counterpart.specialties.filter((s) => !me.specialties.includes(s));
  if (mineOnly.length === 0 || theirsOnly.length === 0) return null;

  const mine = joinNaturally(mineOnly.map((s) => SPECIALTY_LABELS[s]));
  const theirs = joinNaturally(theirsOnly.map((s) => SPECIALTY_LABELS[s]));

  return `Yo voy más por ${mine} y tú por ${theirs} — eso encaja. ¿Qué parte te apetecería llevar?`;
}

function sharedSpecialties(counterpart: Profile, me: Profile): string | null {
  const shared = counterpart.specialties.filter((s) => me.specialties.includes(s));
  if (shared.length === 0) return null;

  return `Los dos venimos de ${joinNaturally(shared.map((s) => SPECIALTY_LABELS[s]))}. ¿En qué parte te sientes más fuerte?`;
}

/** Franja compartida: es la excusa natural para proponer la primera sesión Lock-In. */
function sharedTimeBand(counterpart: Profile, me: Profile): string | null {
  const shared = counterpart.availability.bands.filter((band) =>
    me.availability.bands.includes(band)
  );
  if (shared.length === 0) return null;

  return `Los dos solemos estar por la ${TIME_BAND_LABELS[shared[0]]}. ¿Probamos un Lock-In esta semana a esa hora?`;
}

function sharedAmbition(counterpart: Profile, me: Profile): string | null {
  if (counterpart.ambition !== me.ambition) return null;

  if (counterpart.ambition === 'todo-o-nada') {
    return 'Los dos hemos puesto apostarlo todo. ¿Qué significa eso para ti en los próximos seis meses?';
  }
  if (counterpart.ambition === 'lifestyle') {
    return 'Los dos buscamos algo sostenible más que un cohete. ¿Cómo sería para ti el tamaño ideal?';
  }
  return 'Los dos queremos algo serio sin quemarnos. ¿Cuántas horas de verdad puedes sostener al mes?';
}

/** Sin franja común y en husos distintos, la primera pregunta útil es la logística. */
function differentTimezone(counterpart: Profile, me: Profile): string | null {
  if (counterpart.timezone === me.timezone) return null;

  return `Tú estás en ${counterpart.location} y yo en ${me.location}. ¿Qué hora te encaja para coincidir?`;
}

/** Citar su propio prompt es lo que más se parece a haber leído el perfil. */
function quoteTheirPrompt(counterpart: Profile): string | null {
  const prompt = counterpart.prompts.find((entry) => entry.answer.trim().length > 0);
  if (!prompt) return null;

  return `Has puesto «${prompt.answer.trim()}». Cuéntame más.`;
}

/** Regla de reserva cuando no hay perfil propio: al menos hablamos de lo suyo. */
function theirSpecialties(counterpart: Profile): string | null {
  if (counterpart.specialties.length === 0) return null;

  return `Veo que llevas ${joinNaturally(counterpart.specialties.map((s) => SPECIALTY_LABELS[s]))}. ¿Cómo llegaste ahí?`;
}

function modeFallback(mode: Mode): string {
  return mode === 'lockin'
    ? '¿Cuándo es tu mejor rato para concentrarte? Busco con quién coincidir.'
    : '¿Qué es lo que más te apetece construir ahora mismo?';
}
