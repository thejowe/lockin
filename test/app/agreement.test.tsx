/**
 * La pantalla del acuerdo de socios.
 *
 * Se llama `agreement.test.tsx` y no `[matchId].test.tsx` por lo mismo que
 * `matchId.test.tsx`: los corchetes no son sintaxis de Jest.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { fireEvent, screen, waitFor } from '@testing-library/react-native';

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
const DEDICATION = '¿Cuánto tiempo le vas a dedicar los próximos 6 meses?';

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
  expect(screen.getByText(DEDICATION)).toBeTruthy();
  expect(screen.getByText('Lo que cada uno crea antes de constituir, ¿de quién es?')).toBeTruthy();
});

it('responder el tema que Núria ya respondió lo revela: Coincidís', async () => {
  await openWith(NURIA);
  await fireEvent.press(await screen.findByText(DEDICATION));
  await fireEvent.press(screen.getByRole('radio', { name: 'Jornada completa' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar respuesta' }));

  await waitFor(() => expect(screen.getByText('Coincidís')).toBeTruthy());
  expect(screen.getByText('Núria Bosch: «Lo dejo todo por esto.»')).toBeTruthy();
});

it('si guardar falla lo dice, sin perder la pantalla', async () => {
  await openWith(NURIA);
  jest.spyOn(repositories.agreement, 'answer').mockRejectedValueOnce(new Error('red'));
  await fireEvent.press(await screen.findByText(DEDICATION));
  await fireEvent.press(screen.getByRole('radio', { name: 'Jornada completa' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar respuesta' }));

  expect(await screen.findByText('No se ha podido guardar. Inténtalo de nuevo.')).toBeTruthy();
  expect(screen.getByText(DEDICATION)).toBeTruthy();
});

it('un match Lock-In dice que el acuerdo es solo para cofundadores', async () => {
  await openWith(ALBA, 'lockin');
  expect(await screen.findByText('El acuerdo es solo para matches de cofundador.')).toBeTruthy();
});

it('un match que no existe (deep link viejo) enseña el estado de match perdido', async () => {
  setSearchParams({ matchId: 'no-existe' });
  await renderRoute(<AgreementScreen />);
  expect(await screen.findByText('Esta conversación no está disponible')).toBeTruthy();
  expect(screen.getByText('Volver a Matches')).toBeTruthy();
});

it('un fallo de carga deja reintentar', async () => {
  jest.spyOn(repositories.agreement, 'get').mockRejectedValueOnce(new Error('red'));
  await openWith(NURIA);
  expect(await screen.findByText('No se ha podido cargar el acuerdo.')).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByText(DEDICATION)).toBeTruthy();
});
