import { fireEvent, render, screen } from '@testing-library/react-native';

import ChatScreen from '@/app/chat/[matchId]';
import { DataProvider } from '@/data';
import { createMockRepositories, createMockStore } from '@/data/mock';
import { buildProfileInput } from '@/data/test-fixtures';

let mockMatchId = '';
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ matchId: mockMatchId }),
  Stack: {
    Screen: ({ options }: { options: { headerRight?: () => React.ReactNode } }) =>
      options.headerRight?.() ?? null,
  },
  Link: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/features/session', () => ({ SessionCard: () => null }));
jest.mock('@/features/agreement', () => ({ AgreementCard: () => null }));

describe('seguridad desde la cabecera del chat', () => {
  async function setup() {
    const repositories = createMockRepositories(createMockStore());
    await repositories.profiles.saveCurrent(buildProfileInput());
    const { match } = await repositories.discovery.recordDecision('seed-nuria', 'like');
    mockMatchId = match!.id;
    await render(
      <DataProvider value={repositories}>
        <ChatScreen />
      </DataProvider>
    );
    const menu = await screen.findByRole('button', { name: 'Opciones de Núria Bosch' });
    return { repositories, menu };
  }

  it('abre las opciones desde la cabecera y vuelve al chat al cerrar', async () => {
    const { menu } = await setup();
    await fireEvent.press(menu);
    expect(screen.getByRole('button', { name: 'Bloquear a Núria Bosch' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reportar a Núria Bosch' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Enviar mensaje' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar opciones' }));
    expect(screen.getByRole('button', { name: 'Enviar mensaje' })).toBeTruthy();
  });

  it('bloquear oculta el chat y el compositor después de confirmar', async () => {
    const { repositories, menu } = await setup();
    await fireEvent.press(menu);
    await fireEvent.press(screen.getByRole('button', { name: 'Bloquear a Núria Bosch' }));
    expect(await repositories.matches.list()).toHaveLength(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar bloqueo' }));
    expect(await screen.findByText('Esta conversación no está disponible')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Enviar mensaje' })).toBeNull();
    expect(await repositories.matches.list()).toEqual([]);
  });

  it('reportar no cierra la conversación ni bloquea a la persona', async () => {
    const { repositories, menu } = await setup();
    const report = jest.spyOn(repositories.profiles, 'report');
    await fireEvent.press(menu);
    await fireEvent.press(screen.getByRole('button', { name: 'Reportar a Núria Bosch' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Contenido inapropiado' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar reporte' }));
    expect(report).toHaveBeenCalledWith({
      profileId: 'seed-nuria',
      reason: 'contenido-inapropiado',
      details: '',
    });
    expect(screen.getByText('Reporte enviado.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar opciones' }));
    expect(await repositories.matches.list()).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Enviar mensaje' })).toBeTruthy();
  });
});
