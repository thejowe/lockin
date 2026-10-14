/**
 * Filtro básico de contenido objetable (es/en) para bio, textos de perfil y
 * mensajes. Módulo puro: sin red, sin estado.
 *
 * ES UN COMPLEMENTO DEL REPORTE, NO SUSTITUYE A LA MODERACIÓN. Es una lista
 * corta y deliberadamente conservadora (insultos graves, amenazas, contenido
 * sexual explícito) que frena lo más obvio en el cliente y da un mensaje claro.
 * Se esquiva con facilidad y no ve imágenes ni contexto. Lo que escape lo
 * cubren el reporte de perfiles/mensajes, el bloqueo y la revisión humana de
 * `user_reports`. Al ampliarla, prioriza evitar falsos positivos: una persona
 * bloqueada sin motivo es peor que un insulto que llega al reporte.
 *
 * Normalización: minúsculas, sin tildes, sin apóstrofos, leetspeak básico
 * (0→o, 1→i, 3→e, 4→a, 5→s, 7→t, @→a, $→s) solo dentro de palabras con letras,
 * letras alargadas («puuuta») y letras sueltas separadas («p u t a»).
 * Se compara por palabra completa, no por subcadena.
 */

export type ObjectionableKind = 'insulto' | 'amenaza' | 'sexual';

export const OBJECTIONABLE_MESSAGE =
  'Este texto contiene lenguaje que no permitimos (insultos, amenazas o contenido sexual explícito). Reescríbelo para continuar.';

const WORDS: Record<ObjectionableKind, string[]> = {
  insulto: [
    // es
    'puta',
    'puto',
    'hijoputa',
    'hijueputa',
    'gilipollas',
    'cabron',
    'cabrona',
    'maricon',
    'zorra',
    'subnormal',
    'retrasado',
    'mongolo',
    'hdp',
    // en
    'cunt',
    'faggot',
    'fag',
    'nigger',
    'nigga',
    'retard',
    'whore',
    'slut',
    'bitch',
    'asshole',
    'motherfucker',
    'dumbass',
  ],
  amenaza: ['kys'],
  sexual: [
    // es
    'porno',
    'pornografia',
    'tetas',
    'polla',
    'follar',
    'follame',
    'onlyfans',
    // en
    'porn',
    'nudes',
    'nsfw',
    'pussy',
    'blowjob',
    'handjob',
    'cumshot',
    'boobs',
    'dick',
    'cock',
  ],
};

const PHRASES: { kind: ObjectionableKind; pattern: RegExp }[] = [
  { kind: 'insulto', pattern: /\bhij[oa] de (la )?puta\b/ },
  { kind: 'insulto', pattern: /\bfuck (you|off|u)\b/ },
  { kind: 'amenaza', pattern: /\bte (voy a|vamos a) (matar|violar|reventar)\b/ },
  { kind: 'amenaza', pattern: /\b(te mato|te violo|voy a (matarte|violarte))\b/ },
  { kind: 'amenaza', pattern: /\bojala (te )?(mueras|revientes)\b/ },
  { kind: 'amenaza', pattern: /\b(matate|suicidate|muerete)\b/ },
  {
    kind: 'amenaza',
    pattern: /\b(i will|ill|im going to|im gonna|gonna|going to) (kill|rape|murder) (you|u)\b/,
  },
  { kind: 'amenaza', pattern: /\bkill (yourself|urself)\b/ },
  { kind: 'amenaza', pattern: /\b(hope you die|go die)\b/ },
  { kind: 'sexual', pattern: /\b(send|manda|pasa|enviame|dame) nudes\b/ },
  { kind: 'sexual', pattern: /\bdick pic\b/ },
  { kind: 'sexual', pattern: /\bfuck me\b/ },
];

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
};

const collapse = (word: string): string => word.replace(/(.)\1+/g, '$1');
const STRETCHED = /(.)\1{2,}/;

const exact = new Map<string, ObjectionableKind>();
const collapsed = new Map<string, ObjectionableKind>();
for (const kind of Object.keys(WORDS) as ObjectionableKind[]) {
  for (const word of WORDS[kind]) {
    exact.set(word, kind);
    collapsed.set(collapse(word), kind);
  }
}

/** Texto en minúsculas, sin tildes ni apóstrofos. */
function baseNormalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’`´]/g, '');
}

function tokenize(text: string): string[] {
  const raw = baseNormalize(text)
    .split(/[^a-z0-9@$]+/)
    .filter(Boolean);
  const tokens = raw.map((token) =>
    /[a-z]/.test(token) ? token.replace(/[0-9@$]/g, (char) => LEET[char] ?? char) : token
  );

  // «p u t a»: tres o más letras sueltas seguidas se leen como una palabra.
  const merged: string[] = [];
  let run = '';
  const flush = () => {
    if (run.length >= 3) merged.push(run);
    run = '';
  };
  for (const token of tokens) {
    if (token.length === 1 && /[a-z]/.test(token)) run += token;
    else flush();
  }
  flush();
  return [...tokens, ...merged];
}

function withoutPlural(word: string): string[] {
  const forms = [word];
  if (word.endsWith('es')) forms.push(word.slice(0, -2));
  if (word.endsWith('s')) forms.push(word.slice(0, -1));
  return forms;
}

function lookup(token: string): ObjectionableKind | null {
  for (const form of withoutPlural(token)) {
    const hit = exact.get(form);
    if (hit) return hit;
  }
  if (STRETCHED.test(token)) {
    for (const form of withoutPlural(collapse(token))) {
      const hit = collapsed.get(form) ?? exact.get(form);
      if (hit) return hit;
    }
  }
  return null;
}

/** Primera categoría objetable encontrada, o `null` si el texto pasa el filtro. */
export function findObjectionableContent(text: string): ObjectionableKind | null {
  if (!text) return null;
  const tokens = tokenize(text);
  for (const token of tokens) {
    const hit = lookup(token);
    if (hit) return hit;
  }
  const sentence = tokens.join(' ');
  for (const { kind, pattern } of PHRASES) {
    if (pattern.test(sentence)) return kind;
  }
  return null;
}

export function isObjectionable(text: string): boolean {
  return findObjectionableContent(text) !== null;
}

/** Error que el cliente lanza antes de enviar; la UI enseña `message` tal cual. */
export class ObjectionableContentError extends Error {
  readonly kind: ObjectionableKind;
  constructor(kind: ObjectionableKind) {
    super(OBJECTIONABLE_MESSAGE);
    this.name = 'ObjectionableContentError';
    this.kind = kind;
  }
}
