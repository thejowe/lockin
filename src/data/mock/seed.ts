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
 * `SEED_RECIPROCAL_IDS` son los perfiles que ya han dado like al usuario: darles
 * like genera match al instante. Es lo que hace demostrable el flujo de
 * `descubrir` sin backend.
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
