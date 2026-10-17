import { fireEvent, render, screen } from '@testing-library/react-native';

import ChatScreen from '@/app/chat/[matchId]';
import { DataProvider } from '@/data';
import { createMockRepositories, createMockStore } from '@/data/mock';
import { TERMS_VERSION } from '@/constants/legal';
import { buildProfileInput } from '@/data/test-fixtures';

let mockMatchId = '';
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ matchId: mockMatchId }),
  Stack: {
    Screen: ({ options }: { options: { headerRight?: () => React.ReactNode } }) =>
      options.headerRight?.() ?? null,
  },
  Link: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/features/agreement', () => ({ AgreementCard: () => null }));

describe('reportar un mensaje desde el chat', () => {
  async function setup() {
    const store = createMockStore();
    const repositories = createMockRepositories(store);
    await repositories.session.acceptTerms(TERMS_VERSION);
    await repositories.profiles.saveCurrent(buildProfileInput());
    const { match } = await repositories.discovery.recordDecision('seed-nuria', 'like');
    mockMatchId = match!.id;
    const nuria = createMockRepositories(store, { actorId: 'seed-nuria' });
    const sent = await nuria.messages.send({ matchId: match!.id, body: 'Hola desde Núria' });
    await render(
      <DataProvider value={repositories}>
        <ChatScreen />
      </DataProvider>
    );
    return { repositories, sent };
  }

  it('reporta el mensaje ajeno con motivo y confirma en pantalla', async () => {
    const { repositories, sent } = await setup();
    const report = jest.spyOn(repositories.messages, 'report');
    await fireEvent.press(await screen.findByRole('button', { name: 'Reportar mensaje' }));
    expect(screen.getByText('Reportar este mensaje')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Acoso' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar reporte' }));
    expect(report).toHaveBeenCalledWith({ messageId: sent.id, reason: 'acoso', details: '' });
    expect(await screen.findByText('Reporte enviado.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar reporte' }));
    expect(screen.getByRole('button', { name: 'Enviar mensaje' })).toBeTruthy();
  });

  it('un mensaje con contenido objetable no se envía y explica por qué', async () => {
    const { repositories } = await setup();
    const send = jest.spyOn(repositories.messages, 'send');
    await fireEvent.changeText(screen.getByLabelText('Mensaje'), 'eres un hijo de puta');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar mensaje' }));
    expect(await screen.findByText(/lenguaje que no permitimos/)).toBeTruthy();
    expect(send).not.toHaveBeenCalled();
  });
});
