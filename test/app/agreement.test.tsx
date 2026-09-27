/**
 * La pantalla del acuerdo de socios.
 *
 * Se llama `agreement.test.tsx` y no `[matchId].test.tsx` por lo mismo que
 * `matchId.test.tsx`: los corchetes no son sintaxis de Jest.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { AgreementForbiddenError } from '@/data';
import { SEED_RECIPROCAL_IDS } from '@/data/mock/seed';
import { buildProfileInput } from '@/data/test-fixtures';

import {
  renderRoute,
  repositories,
  resetRepositories,
  resetRouter,
  setSearchParams,
} from '../routes';

import AgreementScreen from '../../src/app/agreement/[matchId]';

jest.mock('expo-router', () => require('../routes').expoRouterMock());

const [NURIA, , ALBA] = SEED_RECIPROCAL_IDS;

beforeEach(() => {
  resetRouter();
  resetRepositories();
});

async function openWith(counterpartId: string, lookingFor: 'par' | 'lockin' = 'par') {
  await repositories.profiles.saveCurrent(buildProfileInput({ lookingFor }));
  const { match } = await repositories.discovery.recordDecision(counterpartId, 'like');
  setSearchParams({ matchId: match!.id });
  await renderRoute(<AgreementScreen />);
  return match!;
}

it('el aviso legal está siempre, arriba y sin botón de cerrar', async () => {
  await openWith(NURIA);
  expect(await screen.findByText(/Esto no es un contrato ni asesoría legal/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: /cerrar/i })).toBeNull();
});

it('pinta las tres secciones y los ocho temas', async () => {
  await openWith(NURIA);
  for (const section of ['Compromiso', 'Reparto', 'Salida']) {
    expect(await screen.findByText(section)).toBeTruthy();
  }
  expect(screen.getByText('¿Cuánto tiempo le vas a dedicar los próximos 6 meses?')).toBeTruthy();
  expect(screen.getByText('Lo que cada uno crea antes de constituir, ¿de quién es?')).toBeTruthy();
});

it('responder el tema que Núria ya respondió lo revela: Coincidís', async () => {
  await openWith(NURIA);
  await fireEvent.press(
    await screen.findByText('¿Cuánto tiempo le vas a dedicar los próximos 6 meses?')
  );
  await fireEvent.press(screen.getByRole('radio', { name: 'Jornada completa' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar respuesta' }));

  await waitFor(() => expect(screen.getByText('Coincidís')).toBeTruthy());
  expect(screen.getByText('Núria Bosch: «Lo dejo todo por esto.»')).toBeTruthy();
});

it('un match Lock-In dice que el acuerdo es solo para cofundadores', async () => {
  await openWith(ALBA, 'lockin');
  expect(await screen.findByText('El acuerdo es solo para matches de cofundador.')).toBeTruthy();
  expect(screen.queryByText(/Esto no es un contrato/)).toBeNull();
});

describe('deep link viejo (Review Focus 4)', () => {
  it('un match que no existe enseña el estado de match perdido, sin pantalla rota', async () => {
    setSearchParams({ matchId: 'no-existe' });
    await renderRoute(<AgreementScreen />);
    expect(await screen.findByText('Esta conversación no está disponible')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Volver a Matches' })).toBeTruthy();
    expect(screen.queryByText(/Esto no es un contrato/)).toBeNull();
  });

  it('un match ajeno se ve igual que uno que no existe', async () => {
    jest
      .spyOn(repositories.agreement, 'get')
      .mockRejectedValue(new AgreementForbiddenError('match ajeno'));
    await openWith(NURIA);
    expect(await screen.findByText('Esta conversación no está disponible')).toBeTruthy();
    expect(screen.queryByText(/Esto no es un contrato/)).toBeNull();
  });
});

it('un fallo cualquiera al leer el acuerdo no deja la pantalla vacía', async () => {
  jest.spyOn(repositories.agreement, 'get').mockRejectedValue(new Error('red'));
  await openWith(NURIA);
  expect(await screen.findByText('No se ha podido cargar el acuerdo')).toBeTruthy();
});
