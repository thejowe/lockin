import { fireEvent, render, screen } from '@testing-library/react-native';

import ChatScreen from '@/app/chat/[matchId]';
import { DataProvider } from '@/data';
import { createMockRepositories, createMockStore } from '@/data/mock';
import { TERMS_VERSION } from '@/constants/legal';
import { buildProfileInput } from '@/data/test-fixtures';

let mockMatchId = '';
// La puerta de foto tiene su propio test (`test/app/photo-gate.test.tsx`); aquí deja pasar.
jest.mock('@/features/profile/require-photo', () => ({
  ...jest.requireActual('@/features/profile/require-photo'),
  RequirePhoto: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void | (() => void)) =>
    jest.requireActual('react').useEffect(effect, [effect]),
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
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.getByRole('button', { name: 'Enviar mensaje' })).toBeTruthy();
  });

  it('muestra el mensaje completo cuando se cita un insulto', async () => {
    await setup();
    const body = 'En el correo pone «hijo de puta».';
    await fireEvent.changeText(screen.getByLabelText('Mensaje'), body);
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar mensaje' }));
    expect(await screen.findByText(body)).toBeTruthy();
  });
});
