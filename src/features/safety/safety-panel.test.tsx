import { fireEvent, render, screen } from '@testing-library/react-native';

import { DataProvider } from '@/data';
import { createMockRepositories, createMockStore } from '@/data/mock';
import { buildProfileInput } from '@/data/test-fixtures';

import { SafetyMenuButton, SafetyPanel } from './safety-panel';

describe('opciones de seguridad', () => {
  async function setup() {
    const repositories = createMockRepositories(createMockStore());
    await repositories.profiles.saveCurrent(buildProfileInput());
    const onClose = jest.fn();
    const onBlocked = jest.fn();
    await render(
      <DataProvider value={repositories}>
        <SafetyPanel profileId="seed-nuria" name="Núria" onClose={onClose} onBlocked={onBlocked} />
      </DataProvider>
    );
    return { repositories, onClose, onBlocked };
  }

  it('el menú tiene etiqueta accesible y superficie táctil de 44', async () => {
    const onPress = jest.fn();
    await render(<SafetyMenuButton name="Núria" onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Opciones de Núria' });
    expect(button).toHaveStyle({ minWidth: 44, minHeight: 44 });
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('bloquear exige confirmación en pantalla y permite cancelar', async () => {
    const { repositories, onBlocked } = await setup();
    const block = jest.spyOn(repositories.profiles, 'block');
    await fireEvent.press(screen.getByRole('button', { name: 'Bloquear a Núria' }));
    expect(screen.getByText('¿Bloquear a Núria?')).toBeTruthy();
    expect(block).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar bloqueo' }));
    expect(onBlocked).not.toHaveBeenCalled();
    expect(block).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Reportar a Núria' })).toBeTruthy();
  });

  it('confirma el bloqueo y actualiza el deck', async () => {
    const { repositories, onBlocked } = await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'Bloquear a Núria' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar bloqueo' }));
    expect(onBlocked).toHaveBeenCalledTimes(1);
    expect((await repositories.discovery.getDeck()).map((profile) => profile.id)).not.toContain(
      'seed-nuria'
    );
  });

  it('un fallo mantiene la confirmación y permite reintentar', async () => {
    const { repositories, onBlocked } = await setup();
    jest.spyOn(repositories.profiles, 'block').mockRejectedValueOnce(new Error('red'));
    await fireEvent.press(screen.getByRole('button', { name: 'Bloquear a Núria' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar bloqueo' }));
    expect(screen.getByText('No se ha podido bloquear. Inténtalo otra vez.')).toBeTruthy();
    expect(onBlocked).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar bloqueo' }));
    expect(onBlocked).toHaveBeenCalledTimes(1);
  });

  it('reportar envía sin bloquear y confirma el resultado en pantalla', async () => {
    const { repositories } = await setup();
    const report = jest.spyOn(repositories.profiles, 'report');
    await fireEvent.press(screen.getByRole('button', { name: 'Reportar a Núria' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Spam o estafa' }));
    await fireEvent.changeText(
      screen.getByLabelText('Detalles del reporte (opcional)'),
      'Mi explicación'
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar reporte' }));
    expect(report).toHaveBeenCalledWith({
      profileId: 'seed-nuria',
      reason: 'spam',
      details: 'Mi explicación',
    });
    expect(screen.getByText('Reporte enviado.')).toBeTruthy();
    expect((await repositories.discovery.getDeck()).map((profile) => profile.id)).toContain(
      'seed-nuria'
    );
  });
});
