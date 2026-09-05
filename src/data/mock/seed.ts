/**
 * Datos de ejemplo mínimos del mock.
 *
 * Son los justos para que el shell arranque con algo que enseñar. El bloque
 * `perfil` es el dueño del catálogo completo (6-8 perfiles variados): amplía
 * `SEED_PROFILES` desde allí en vez de crear otra lista aparte.
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
];

/** Perfiles que ya dieron like al usuario: darles like devuelve match. */
export const SEED_RECIPROCAL_IDS: string[] = ['seed-nuria', 'seed-marc'];
