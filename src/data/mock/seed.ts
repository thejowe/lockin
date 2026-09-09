/**
 * Catálogo de perfiles de ejemplo del mock.
 *
 * Es propiedad del bloque `perfil`: si hace falta otro perfil, se añade aquí —
 * nunca en una segunda lista paralela, o el deck de `descubrir` y la lista de
 * matches dejarían de contar la misma historia.
 *
 * El catálogo cubre a propósito los tres valores de `lookingFor`, los tres
 * puntos de partida, los tres niveles de ambición y las cuatro franjas horarias:
 * así cualquier filtro de `descubrir` encuentra algo que enseñar.
 *
 * `seekingSpecialties` respeta la invariante de `types.ts`: los dos perfiles de
 * `lockin` (Alba, Tomás) lo llevan vacío. Omar lo lleva vacío siendo `ambos`,
 * que es el otro significado del array vacío —«abierto a cualquiera»— y hace
 * falta en el catálogo para que nadie confunda ambos casos. En el resto,
 * complementa a `specialties` sin repetirla: quien construye busca quien vende
 * y al revés.
 *
 * `SEED_RECIPROCAL_IDS` son los perfiles que ya han dado like al usuario: darles
 * like genera match al instante. Es lo que hace demostrable el flujo de
 * `descubrir` sin backend.
 *
 * De ahí sale una regla que este catálogo tiene que cumplir y que no se ve
 * leyendo un perfil suelto: **quien encabeza el deck por complementariedad
 * tiene que estar en `SEED_RECIPROCAL_IDS`**. `getDeck` ordena por
 * complementariedad mutua y desempata por `id`; el desempate es arbitrario
 * —aquí los ids son `seed-<nombre>` y ordenan alfabéticamente, en Postgres son
 * UUID por orden de siembra y ordenan distinto—, así que el catálogo no puede
 * depender de él para decidir qué tarjeta va delante. Si dos perfiles empatan
 * en lo alto y solo uno es recíproco, la demo enseña delante a quien no puede
 * hacer match, y el recorrido E2E se cae. Lo fija `seed.test.ts`.
 *
 * Es lo que pasaba hasta el 2026-09-09: Lucía y Marc ocupaban la misma casilla
 * —diseño buscando desarrollo—, empataban en 2 para el perfil del E2E, y Lucía
 * ganaba el desempate sin ser recíproca. No se arregló añadiéndola a los
 * recíprocos: eso habría dejado dos perfiles contando la misma historia en un
 * catálogo de ocho que presume de cubrir el abanico, y el siguiente empate
 * habría vuelto a salir por donde nadie mira. Se arregló donde estaba el
 * defecto, dándole a Lucía lo que de verdad busca (`ventas`, `datos`, que
 * además no los buscaba nadie).
 */

import type { Profile } from '../types';

const now = '2026-01-01T09:00:00.000Z';

export const SEED_PROFILES: Profile[] = [
  {
    id: 'seed-nuria',
    name: 'Núria Bosch',
    age: 29,
    location: 'Barcelona',
    timezone: 'Europe/Madrid',
    avatar: { initials: 'NB', accent: 'teal' },
    specialties: ['dev', 'datos'],
    seekingSpecialties: ['marketing', 'ventas'],
    lookingFor: 'par',
    startingPoint: 'idea-sin-empezar',
    availability: { hoursPerWeek: 25, bands: ['tarde', 'noche'] },
    ambition: 'todo-o-nada',
    links: { github: 'https://github.com/example-nuria' },
    prompts: [
      {
        question: 'Lo que quiero construir es…',
        answer: 'Herramientas para equipos pequeños que odian las hojas de cálculo.',
      },
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'seed-marc',
    name: 'Marc Oller',
    age: 34,
    location: 'Valencia',
    timezone: 'Europe/Madrid',
    avatar: { initials: 'MO', accent: 'brass' },
    specialties: ['diseno', 'producto'],
    seekingSpecialties: ['dev', 'ventas'],
    lookingFor: 'ambos',
    startingPoint: 'algo-empezado',
    availability: { hoursPerWeek: 15, bands: ['manana'] },
    ambition: 'equilibrado',
    links: { portfolio: 'https://example.com/marc' },
    prompts: [
      {
        question: 'Mi mejor sesión de trabajo empieza…',
        answer: 'A las siete de la mañana, con el café todavía hirviendo.',
      },
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'seed-alba',
    name: 'Alba Ferrer',
    age: 26,
    location: 'Ciudad de México',
    timezone: 'America/Mexico_City',
    avatar: { initials: 'AF', accent: 'teal' },
    specialties: ['marketing', 'contenido'],
    seekingSpecialties: [],
    lookingFor: 'lockin',
    startingPoint: 'solo-ganas',
    availability: { hoursPerWeek: 10, bands: ['noche'] },
    ambition: 'lifestyle',
    links: {},
    prompts: [
      {
        question: 'Necesito compañía para…',
        answer: 'Sentarme a escribir sin abrir otra pestaña. Dos horas, sin excusas.',
      },
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'seed-diego',
    name: 'Diego Salas',
    age: 31,
    location: 'Bogotá',
    timezone: 'America/Bogota',
    avatar: { initials: 'DS', accent: 'brass' },
    specialties: ['ventas', 'marketing'],
    seekingSpecialties: ['dev', 'producto'],
    lookingFor: 'par',
    startingPoint: 'solo-ganas',
    availability: { hoursPerWeek: 30, bands: ['manana', 'tarde'] },
    ambition: 'todo-o-nada',
    links: { linkedin: 'https://linkedin.com/in/example-diego' },
    prompts: [
      {
        question: 'Lo que aporto desde el día uno es…',
        answer: 'Conseguir los diez primeros clientes antes de que exista el producto.',
      },
      {
        question: 'Busco a alguien que…',
        answer: 'Sepa construir lo que yo ya sé vender.',
      },
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'seed-ines',
    name: 'Inés Aranda',
    age: 24,
    location: 'Sevilla',
    timezone: 'Europe/Madrid',
    avatar: { initials: 'IA', accent: 'teal' },
    specialties: ['producto', 'dev'],
    seekingSpecialties: ['diseno', 'marketing'],
    lookingFor: 'ambos',
    startingPoint: 'idea-sin-empezar',
    availability: { hoursPerWeek: 20, bands: ['noche', 'madrugada'] },
    ambition: 'equilibrado',
    links: {
      github: 'https://github.com/example-ines',
      portfolio: 'https://example.com/ines',
    },
    prompts: [
      {
        question: 'Lo que quiero construir es…',
        answer: 'Algo aburrido y necesario para gremios que aún trabajan por WhatsApp.',
      },
      {
        question: 'Mi mejor sesión de trabajo empieza…',
        answer: 'Cuando el resto del mundo ya se ha ido a dormir.',
      },
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'seed-tomas',
    name: 'Tomás Ruiz',
    age: 38,
    location: 'Buenos Aires',
    timezone: 'America/Argentina/Buenos_Aires',
    avatar: { initials: 'TR', accent: 'brass' },
    specialties: ['finanzas', 'operaciones'],
    seekingSpecialties: [],
    lookingFor: 'lockin',
    startingPoint: 'algo-empezado',
    availability: { hoursPerWeek: 8, bands: ['manana'] },
    ambition: 'lifestyle',
    links: {},
    prompts: [
      {
        question: 'Necesito compañía para…',
        answer: 'Las dos horas de antes del trabajo. Solo no las cumplo nunca.',
      },
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'seed-lucia',
    name: 'Lucía Pardo',
    age: 27,
    location: 'Lisboa',
    timezone: 'Europe/Lisbon',
    avatar: { initials: 'LP', accent: 'teal' },
    specialties: ['diseno', 'contenido'],
    // Busca quien venda y quien mida, no quien construya: es lo que dice su
    // propio prompt —la marca preciosa que no vendió nada— y lo que la separa
    // de Marc, que es el otro perfil de diseño del catálogo. Ver la nota sobre
    // la tarjeta de delante en la cabecera de este archivo.
    seekingSpecialties: ['ventas', 'datos'],
    lookingFor: 'par',
    startingPoint: 'algo-empezado',
    availability: { hoursPerWeek: 35, bands: ['tarde', 'noche'] },
    ambition: 'todo-o-nada',
    links: { portfolio: 'https://example.com/lucia' },
    prompts: [
      {
        question: 'Lo que ya intenté y no salió…',
        answer: 'Una marca de cerámica preciosa que no vendió nada. Aprendí a validar antes.',
      },
      {
        question: 'Busco a alguien que…',
        answer: 'Se enfade conmigo cuando me pase tres días puliendo un icono.',
      },
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'seed-omar',
    name: 'Omar Chaib',
    age: 33,
    location: 'Madrid',
    timezone: 'Europe/Madrid',
    avatar: { initials: 'OC', accent: 'brass' },
    specialties: ['legal', 'producto'],
    seekingSpecialties: [],
    lookingFor: 'ambos',
    startingPoint: 'idea-sin-empezar',
    availability: { hoursPerWeek: 12, bands: ['noche'] },
    ambition: 'equilibrado',
    links: { linkedin: 'https://linkedin.com/in/example-omar' },
    prompts: [
      {
        question: 'Lo que aporto desde el día uno es…',
        answer: 'Que el pacto entre nosotros esté escrito antes de que haga falta.',
      },
    ],
    createdAt: now,
    updatedAt: now,
  },
];

/**
 * Perfiles que ya dieron like al usuario: darles like devuelve match.
 *
 * Hay uno de cada modo (`par`, `ambos`, `lockin`) a propósito: elija el modo que
 * elija el usuario en el onboarding, su deck contiene al menos un match posible.
 */
export const SEED_RECIPROCAL_IDS: string[] = ['seed-nuria', 'seed-marc', 'seed-alba'];
