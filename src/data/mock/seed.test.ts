/**
 * Lo que el catálogo mock tiene que garantizar al recorrido E2E.
 *
 * El `.yaml` no elige tarjeta: crea un perfil, da like a la de delante y espera
 * «¡Match!». Eso solo es cierto si la tarjeta de delante es alguien que ya dio
 * like —`SEED_RECIPROCAL_IDS`—, y tiene que serlo por el criterio de producto
 * (complementariedad mutua), no por el desempate de `id`, que es arbitrario y
 * ni siquiera ordena igual en Postgres, donde los ids son UUID por orden de
 * siembra y aquí son `seed-<nombre>` por orden alfabético.
 *
 * Vive aquí y no en `e2e/` a propósito: el dato es de este bloque, y un fallo
 * de catálogo debe caer en `npm test`, no treinta minutos después en un
 * emulador.
 */

import fs from 'node:fs';
import path from 'node:path';

import { MODE_OPTIONS, SPECIALTY_OPTIONS } from '@/features/profile/catalog';

import { buildProfileInput } from '../test-fixtures';
import { createMockRepositories, resetState } from './index';
import { SEED_PROFILES, SEED_RECIPROCAL_IDS } from './seed';

import type { ModePreference, Specialty } from '../types';
import type { Repositories } from '../repositories';

const JOURNEY = fs.readFileSync(path.resolve(__dirname, '../../../e2e/full-journey.yaml'), 'utf8');

/**
 * Los `tapOn` literales del recorrido, en orden.
 *
 * Se leen del `.yaml` en vez de copiarse aquí: una copia a mano puede quedarse
 * atrás cuando alguien cambie los taps, y entonces este test seguiría en verde
 * describiendo un perfil que el recorrido ya no teclea. Es exactamente el fallo
 * que costó el run 34283362375.
 */
const TAPS = [...JOURNEY.matchAll(/^- tapOn: '([^']+)'/gm)].map((match) => match[1]);

/** Las opciones cuyo `label`, con el prefijo dado, aparece entre los taps. */
const tapped = <T>(options: { value: T; label: string }[], prefix = '') =>
  TAPS.flatMap((tap) => options.filter((option) => tap === prefix + option.label)).map(
    (option) => option.value
  );

/** Lo que domina el recorrido, lo que busca y en qué modo. Todo de los taps. */
const DOMINA = tapped<Specialty>(SPECIALTY_OPTIONS);
const BUSCA = tapped<Specialty>(SPECIALTY_OPTIONS, 'Busco ');
const MODO = tapped<ModePreference>(MODE_OPTIONS)[0];

/** El perfil que teclea `e2e/full-journey.yaml`, derivado de sus propios taps. */
const E2E_PROFILE = buildProfileInput({
  name: 'E2E-perfil',
  specialties: DOMINA,
  seekingSpecialties: BUSCA,
  lookingFor: MODO,
});

describe('el catálogo mock sostiene el recorrido E2E', () => {
  let repositories: Repositories;

  beforeEach(() => {
    resetState();
    repositories = createMockRepositories();
  });

  it('el perfil sale de los taps del `.yaml`, no de una copia a mano', () => {
    // Sin esta guardia, un `.yaml` que dejara de encajar con la expresión
    // regular daría un perfil vacío y los demás casos hablarían de otra cosa.
    expect(DOMINA).toEqual(['dev', 'marketing']);
    expect(BUSCA).toEqual(['diseno']);
    expect(MODO).toBe('ambos');
  });

  it('la tarjeta de delante es alguien que ya dio like', async () => {
    await repositories.session.setActiveMode('ambos');
    await repositories.profiles.saveCurrent(E2E_PROFILE);

    const [front] = await repositories.discovery.getDeck();

    expect(SEED_RECIPROCAL_IDS).toContain(front.id);
    // Y el like sobre ella cierra match, que es lo que el `.yaml` afirma con
    // «¡Match!». Comprobarlo aquí evita descubrirlo en el emulador.
    expect((await repositories.discovery.recordDecision(front.id, 'like')).match).not.toBeNull();
  });

  it('y lo es por puntuación máxima estricta, no por desempate de id', async () => {
    // Puntuación 2 = los dos sumandos del criterio: domina lo que el recorrido
    // busca (diseño) y busca algo de lo que el recorrido domina (dev o
    // marketing). Si hay dos, quién va delante lo decide el `id`, y entonces el
    // recorrido depende de cómo se llame la gente.
    const maximos = SEED_PROFILES.filter(
      (profile) =>
        profile.lookingFor !== 'lockin' &&
        BUSCA.every((tag) => profile.specialties.includes(tag)) &&
        profile.seekingSpecialties.some((tag) => DOMINA.includes(tag))
    );

    expect(maximos.map((profile) => profile.id)).toEqual(['seed-marc']);
  });
});
